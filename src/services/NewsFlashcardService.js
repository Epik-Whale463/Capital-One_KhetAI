// NewsFlashcardService
// Fetches latest Indian agriculture news and converts into AI summarized flashcards
// Uses NewsAPI.org + Groq summarization

import EnvironmentConfig from '../config/environment';
import GroqAIService from './GroqAIService';
import AsyncStorage from '@react-native-async-storage/async-storage';

class NewsFlashcardService {
  constructor() {
    this.newsApiKey = EnvironmentConfig.getNewsApiKey();
    this.newsUrl = 'https://newsapi.org/v2/everything';
    // Tuned agriculture-only query (logical OR keywords)
    this.defaultQuery = 'agriculture OR farming OR crop OR agri OR farmer OR irrigation';
    this.maxArticles = 20; // fetch more then filter
    this.cacheTtlMs = 15 * 60 * 1000; // 15 min
    this._cache = null; // { timestamp, flashcards }
  this.storageKey = '@newsFlashcardsCacheV1';
  this.inFlightPromise = null; // de-dupe concurrent refresh
    // Trusted agriculture / business-agri focused domains
    this.sourceDomains = [
      'thehindubusinessline.com',
      'krishijagran.com',
      'agrinews.in',
      'agribusinessglobal.com',
      'agriland.ie'
    ];

  // Keyword filters (used after domain restriction for extra safety)
    this.includeKeywords = [
      'agri','agriculture','farming','farmer','farmers','crop','crops','harvest','sowing','planting','yield','irrigation',
      'monsoon','rainfall','fertiliser','fertilizer','pesticide','seed','soil','mandi','apmc','msp','kharif','rabi','dairy',
      'livestock','horticulture','commodity','procurement','storage','warehouse','grain','wheat','rice','paddy','cotton'
    ];
    this.excludeKeywords = [
      'cricket','movie','entertainment','bollywood','stock market','celebrity','politics only','election rally','iphone','smartphone','crypto'
    ];
  }

  static getInstance() {
    if (!global.__newsFlashcardService) {
      global.__newsFlashcardService = new NewsFlashcardService();
    }
    return global.__newsFlashcardService;
  }

  // Load cache from AsyncStorage (persistent)
  async loadCacheFromStorage() {
    if (this._cache) return this._cache; // already in memory
    try {
      const raw = await AsyncStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.timestamp && parsed.flashcards) {
        this._cache = parsed; // hydrate memory cache
        return parsed;
      }
    } catch (e) {
      // non-fatal; ignore corrupt cache
      console.warn('NewsFlashcardService: failed to load cache', e.message);
    }
    return null;
  }

  async saveCacheToStorage(cacheObj) {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(cacheObj));
    } catch (e) {
      // Storage failure not critical; proceed silently
      console.warn('NewsFlashcardService: failed to persist cache', e.message);
    }
  }

  async fetchRawArticles(query = this.defaultQuery) {
    if (!this.newsApiKey) {
      throw new Error('News API key missing');
    }
    const params = new URLSearchParams({
      q: query,
      apiKey: this.newsApiKey,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: String(this.maxArticles),
      domains: this.sourceDomains.join(',')
    });
    const url = `${this.newsUrl}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`News API error ${res.status}`);
    }
    const data = await res.json();
    return (data.articles || []).map(a => ({
      title: a.title,
      description: a.description,
      source: a.source?.name,
      url: a.url,
      publishedAt: a.publishedAt
    }));
  }

  // Score and filter articles to retain only agriculture-related content
  filterRelevant(articles) {
    const inc = this.includeKeywords;
    const exc = this.excludeKeywords;
    const scored = articles.map(a => {
      const text = `${a.title || ''} ${a.description || ''}`.toLowerCase();
      const incHits = inc.filter(k => text.includes(k)).length;
      const excHits = exc.filter(k => text.includes(k)).length;
      const score = incHits - excHits * 2; // penalize exclusions heavier
      return { ...a, _score: score, _inc: incHits, _exc: excHits };
    });
    // Keep those with at least 1 inclusion and non-negative score
    return scored
      .filter(a => a._inc > 0 && a._score >= 1)
      .sort((a,b)=>b._score - a._score)
      .slice(0, this.maxArticles / 2); // trim to reasonable count
  }

  buildSummarizePrompt(article) {
    return `Summarize this Indian agriculture news article in 2-3 concise bullet points focused on farmer impact. Then create ONE flashcard in JSON: {"summary":["..."],"flashcard":{"q":"Question","a":"Answer"}}. Avoid quotes conflicts.\nTitle: ${article.title}\nDescription: ${article.description || ''}`;
  }

  async summarizeArticle(article) {
    const groq = GroqAIService.getInstance();
    const prompt = this.buildSummarizePrompt(article);
    try {
      const raw = await groq.callGroq(groq.models.lightweight, '', prompt, { maxTokens: 400, disableReasoning: true });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return { ...article, summary: parsed.summary || [], flashcard: parsed.flashcard || null };
        } catch (e) { /* ignore JSON parse error */ }
      }
      return { ...article, summary: [raw.substring(0, 180)], flashcard: null };
    } catch (error) {
      return { ...article, error: error.message };
    }
  }

  isCacheValid() {
  return this._cache && (Date.now() - this._cache.timestamp < this.cacheTtlMs);
  }

  async getFlashcards(forceRefresh = false) {
    // If in-memory cache valid & not forcing refresh, return it
    if (!forceRefresh && this.isCacheValid()) {
      return { fromCache: true, flashcards: this._cache.flashcards };
    }

    // Try loading persistent cache if memory empty or expired
    if (!forceRefresh && !this.isCacheValid()) {
      const stored = await this.loadCacheFromStorage();
      if (stored && (Date.now() - stored.timestamp < this.cacheTtlMs)) {
        return { fromCache: true, flashcards: stored.flashcards };
      }
    }

    // De-dupe concurrent refresh requests
    if (this.inFlightPromise && !forceRefresh) {
      const result = await this.inFlightPromise;
      return { fromCache: true, flashcards: result.flashcards };
    }

    // Build refresh promise
    this.inFlightPromise = (async () => {
      try {
        const raw = await this.fetchRawArticles(this.defaultQuery);
        let articles = this.filterRelevant(raw);
        if (articles.length === 0) {
          articles = raw.filter(a => {
            const text = `${a.title || ''} ${a.description || ''}`.toLowerCase();
            return this.includeKeywords.some(k => text.includes(k));
          }).slice(0, 10);
        }
        const summarized = [];
        for (const a of articles) {
          const s = await this.summarizeArticle(a);
          summarized.push(s);
        }
        const flashcards = summarized.map((s, idx) => ({
          id: `${s.publishedAt || idx}-${idx}`,
          title: s.title,
          bullets: s.summary || [],
          question: s.flashcard?.q || null,
          answer: s.flashcard?.a || null,
          source: s.source,
          url: s.url,
          publishedAt: s.publishedAt,
          error: s.error || null
        }));
        const cacheObj = { timestamp: Date.now(), flashcards };
        this._cache = cacheObj;
        this.saveCacheToStorage(cacheObj); // async fire & forget
        return cacheObj;
      } finally {
        // Clear in-flight promise after completion (small delay to allow awaiting callers)
        setTimeout(() => { this.inFlightPromise = null; }, 50);
      }
    })();

    const fresh = await this.inFlightPromise;
    return { fromCache: false, flashcards: fresh.flashcards };
  }
}

export default NewsFlashcardService;
