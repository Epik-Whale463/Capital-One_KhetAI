/**
 * Market Data Service for Khet AI
 * Fetches live commodity prices from Indian markets
 */

class MarketDataService {
  // Simple in-memory cache to avoid hammering public APIs (TTL: 5 minutes)
  static _cache = { }; // key -> { timestamp, data }
  static CACHE_TTL_MS = 5 * 60 * 1000;
  static APMC_API_URL = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
  static AGMARKNET_URL = 'https://agmarknet.gov.in';

  // Get current market prices from APMC API
  static async getAPMCPrices(commodity = '', state = '', market = '', { noCache = false, limit = 100 } = {}) {
    try {
      // Resolve API key dynamically (avoids hardcoding) with lightweight dynamic import
      let apiKey = 'SET_DATA_GOV_API_KEY';
      try {
        const envMod = await import('../config/environment.js');
        apiKey = envMod.default.getDataGovApiKey() || apiKey;
      } catch (e) {
        console.warn('Could not load environment for DataGov key', e);
      }

      let url = `${this.APMC_API_URL}?api-key=${apiKey}&format=json&limit=${limit}`;
      
      if (commodity) url += `&filters[commodity]=${encodeURIComponent(commodity)}`;
      if (state) url += `&filters[state]=${encodeURIComponent(state)}`;
      if (market) url += `&filters[market]=${encodeURIComponent(market)}`;

      const cacheKey = `apmc:${commodity}:${state}:${market}:${limit}`;
      if (!noCache && this._cache[cacheKey]) {
        const entry = this._cache[cacheKey];
        if (Date.now() - entry.timestamp < this.CACHE_TTL_MS) {
          return { ...entry.data, cached: true };
        }
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 second timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Khet-AI/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`APMC API error: ${response.status}`);
      }

  const data = await response.json();

  const payload = {
        success: true,
        data: data.records || [],
        source: 'APMC',
        timestamp: new Date().toISOString()
      };

  this._cache[cacheKey] = { timestamp: Date.now(), data: payload };
      
  return payload;

    } catch (error) {
      console.error('APMC API error:', error);
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout' : error.message,
        source: 'APMC'
      };
    }
  }

  // Get market data from alternative real APIs
  static async getAlternativeMarketData(commodity = 'wheat') {
    try {
      // Try multiple real market data sources
      const sources = [
        {
          name: 'NCDEX',
          url: `https://www.ncdex.com/api/marketdata/commodity/${commodity}`,
          parser: this.parseNCDEXData
        },
        {
          name: 'MCX',
          url: `https://www.mcxindia.com/api/marketdata/${commodity}`,
          parser: this.parseMCXData
        }
      ];

      for (const source of sources) {
        try {
          // Create AbortController for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout per source

          const response = await fetch(source.url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Khet-AI/1.0'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const parsedData = source.parser(data, commodity);
            
            if (parsedData.length > 0) {
              return {
                success: true,
                data: parsedData,
                source: source.name,
                timestamp: new Date().toISOString()
              };
            }
          }
        } catch (sourceError) {
          console.warn(`${source.name} API failed:`, sourceError.message);
          continue;
        }
      }

      throw new Error('All alternative market data sources failed');

    } catch (error) {
      console.error('Alternative market data error:', error);
      return {
        success: false,
        error: error.message,
        source: 'Alternative APIs'
      };
    }
  }

  // Realtime (latest-day) consolidated price snapshot using data.gov.in APMC resource
  static async fetchRealtimeCommodityPrice(commodity, { state = '', market = '', variety = '', limit = 100 } = {}) {
    try {
      if (!commodity) throw new Error('commodity required');
      const envMod = await import('../config/environment.js');
      const apiKey = envMod.default.getDataGovApiKey();
      if (!apiKey || apiKey === 'SET_DATA_GOV_API_KEY') {
        return { success: false, error: 'DATA_GOV_API_KEY missing – configure in environment' };
      }

      // Basic alias normalization
      const alias = { paddy: 'Rice', paddy_rice: 'Rice', chana: 'Gram', arhar: 'Tur', pigeonpea: 'Tur' };
      const normalized = alias[commodity.toLowerCase()] || commodity;

      const params = new URLSearchParams({ 'api-key': apiKey, format: 'json', limit: String(limit) });
      params.append('filters[commodity]', normalized);
      if (state) params.append('filters[state]', state);
      if (market) params.append('filters[market]', market);

      const url = `${this.APMC_API_URL}?${params.toString()}`;
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 second timeout
      
      const res = await fetch(url, { 
        headers: { 'Accept': 'application/json', 'User-Agent': 'Khet-AI/1.0' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`APMC realtime status ${res.status}`);
      const json = await res.json();

      // Normalize candidate records and be tolerant of different price field names
      const rawRecords = Array.isArray(json.records) ? json.records : [];

      const pickPriceField = (rec) => {
        // Try common fields in order
        return rec.modal_price ?? rec.modal_price_in_rs ?? rec.modal_price_rs ?? rec.price ?? rec.modal ?? rec.max_price ?? rec.min_price ?? null;
      };

      const rows = rawRecords.filter(r => {
        const p = pickPriceField(r);
        return p !== null && p !== undefined && String(p).trim() !== '';
      }).map(r => ({ ...r, _picked_price: pickPriceField(r) }));

      // If no rows found from the realtime endpoint, attempt APMC API as a fallback
      if (!rows.length) {
        console.warn('Realtime endpoint returned no price rows; attempting APMC API fallback');
        try {
          const apmc = await this.getAPMCPrices(commodity, state, market, { noCache: true, limit });
          if (apmc && apmc.success && Array.isArray(apmc.data) && apmc.data.length) {
            // Use the APMC records as a fallback data source
            const fallbackRaw = apmc.data;
            const fallbackRows = fallbackRaw.filter(r => pickPriceField(r) !== null).map(r => ({ ...r, _picked_price: pickPriceField(r) }));
            if (fallbackRows.length) {
              // Use fallbackRows for subsequent processing
              filtered = fallbackRows;
            }
          }
        } catch (fallbackErr) {
          console.warn('APMC fallback failed:', fallbackErr?.message || fallbackErr);
        }
      }

      // If we still don't have rows after fallback, provide diagnostics and fail
      let filtered = rows;
      if (!filtered || filtered.length === 0) {
        const sampleCount = rawRecords.length;
        return { success: false, error: 'No price rows returned', commodity: normalized, diagnostics: { sampleCount, rawSample: rawRecords.slice(0,3) } };
      }

      // Filter by variety if requested (case-insensitive substring)
      if (variety) {
        const vLower = variety.toLowerCase();
        const match = filtered.filter(r => (r.variety || r.commodity_variety || '').toLowerCase().includes(vLower));
        if (match.length) filtered = match;
      }
      if (variety) {
        const vLower = variety.toLowerCase();
        const match = rows.filter(r => (r.variety || '').toLowerCase().includes(vLower));
        if (match.length) filtered = match;
      }

      // Sort by arrival_date descending and take most recent date group
      filtered.sort((a,b) => (b.arrival_date || '').localeCompare(a.arrival_date || ''));
      const latestDate = filtered[0].arrival_date;
      const latest = filtered.filter(r => r.arrival_date === latestDate);

      // Extract numeric modal prices using the picked field first, then modal_price
      const priceNums = latest.map(r => {
        const candidate = r._picked_price ?? r.modal_price ?? r.price ?? r.modal;
        const num = parseFloat(String(candidate).replace(/,/g, ''));
        return isNaN(num) ? 0 : num;
      }).filter(p => p > 0);
      const avg = priceNums.reduce((s,p)=>s+p,0)/priceNums.length;
      const min = Math.min(...priceNums);
      const max = Math.max(...priceNums);

      // Confidence heuristic
      const confidence = priceNums.length >= 5 ? 'high' : priceNums.length >= 2 ? 'medium' : 'low';

      return {
        success: true,
        commodity: normalized,
        date: latestDate,
        marketCount: latest.length,
        confidence,
        current: { average: Math.round(avg), min, max },
        markets: latest.map(r => ({
          market: r.market,
          district: r.district,
          state: r.state,
          variety: r.variety,
          modal: parseFloat(r.modal_price),
          min: parseFloat(r.min_price),
          max: parseFloat(r.max_price)
        })),
        source: 'APMC (data.gov.in)',
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error('Realtime commodity price error:', err);
      return { 
        success: false, 
        error: err.name === 'AbortError' ? 'Request timeout' : err.message, 
        commodity 
      };
    }
  }

  // Get comprehensive market analysis - REAL DATA ONLY
  static async getMarketAnalysis(commodity, location) {
    try {
      console.log(`🏪 Fetching real market data for ${commodity} in ${location}`);
      
      // Try APMC API first (most reliable)
      let marketData = await this.getAPMCPrices(commodity, location);
      
      // If APMC fails, try alternative real APIs
      if (!marketData.success) {
        console.log('APMC failed, trying alternative market APIs...');
        marketData = await this.getAlternativeMarketData(commodity);
      }

      // If all real APIs fail, return error - NO FALLBACK DATA
      if (!marketData.success) {
        throw new Error(`Unable to fetch real market data for ${commodity}. All APIs unavailable.`);
      }

      // Process and analyze the real data
      const analysis = this.analyzeMarketData(marketData.data, commodity);

      return {
        success: true,
        commodity,
        location,
        currentPrices: analysis.currentPrices,
        trends: analysis.trends,
        recommendations: analysis.recommendations,
        source: marketData.source,
        timestamp: marketData.timestamp,
        dataType: 'REAL_API_DATA'
      };

    } catch (error) {
      console.error('❌ Market analysis error:', error);
      // Return error instead of mock data
      return {
        success: false,
        error: `Real market data unavailable: ${error.message}`,
        commodity,
        location,
        dataType: 'ERROR_NO_FALLBACK'
      };
    }
  }

  // Generate price alerts
  static async getPriceAlerts(watchlist = []) {
    try {
      const alerts = [];
      
      for (const item of watchlist) {
        const { commodity, location, thresholds } = item;
        const marketData = await this.getMarketAnalysis(commodity, location);
        
        if (marketData.success) {
          const currentPrice = marketData.currentPrices.average;
          
          if (thresholds.high && currentPrice > thresholds.high) {
            alerts.push({
              type: 'price_high',
              commodity,
              location,
              currentPrice,
              threshold: thresholds.high,
              message: `${commodity} price (₹${currentPrice}) is above your high threshold (₹${thresholds.high})`,
              recommendation: 'Consider selling if you have stock'
            });
          }
          
          if (thresholds.low && currentPrice < thresholds.low) {
            alerts.push({
              type: 'price_low',
              commodity,
              location,
              currentPrice,
              threshold: thresholds.low,
              message: `${commodity} price (₹${currentPrice}) is below your low threshold (₹${thresholds.low})`,
              recommendation: 'Good time to buy if you need stock'
            });
          }
        }
      }

      return {
        success: true,
        alerts,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Price alerts error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper methods
  static parseAgMarkNetHTML(html, commodity) {
    // Simplified HTML parsing - in production, use a proper HTML parser
    const prices = [];
    
    try {
      // Extract price data using regex (basic implementation)
      const priceRegex = /₹\s*(\d+(?:,\d+)*(?:\.\d+)?)/g;
      const matches = html.match(priceRegex);
      
      if (matches) {
        matches.forEach((match, index) => {
          const price = parseFloat(match.replace(/[₹,]/g, ''));
          prices.push({
            commodity,
            price,
            market: `Market ${index + 1}`,
            date: new Date().toISOString().split('T')[0]
          });
        });
      }
    } catch (error) {
      console.error('HTML parsing error:', error);
    }

    return prices;
  }

  static analyzeMarketData(data, commodity) {
    if (!data || data.length === 0) {
      return {
        currentPrices: { min: 0, max: 0, average: 0 },
        trends: { direction: 'stable', change: 0 },
        recommendations: ['No market data available'],
        volatilityPct: 0,
        momentumPct: 0,
        marketSummaries: [],
        topMarkets: [],
        bottomMarkets: []
      };
    }

    // Normalize records and extract modal/representative prices
    const normalized = data.map(item => ({
      market: item.market || item.market_name || 'Unknown',
      state: item.state || item.state_name || '',
      variety: item.variety || item.commodity_variety || item.variety_name || '',
      date: item.arrival_date || item.date || new Date().toISOString().split('T')[0],
      modal: parseFloat(item.modal_price || item.price || item.max_price || 0),
      min: parseFloat(item.min_price || item.min || 0),
      max: parseFloat(item.max_price || item.max || 0)
    })).filter(r => r.modal > 0);

    const prices = normalized.map(r => r.modal);

    if (prices.length === 0) {
      return {
        currentPrices: { min: 0, max: 0, average: 0 },
        trends: { direction: 'stable', change: 0 },
        recommendations: ['Unable to parse price data'],
        volatilityPct: 0,
        momentumPct: 0,
        marketSummaries: [],
        topMarkets: [],
        bottomMarkets: []
      };
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;

    // Simple trend analysis (would be more sophisticated in production)
    const recentPrices = prices.slice(-5); // Last 5 prices
    const olderPrices = prices.slice(-10, -5); // Previous 5 prices
    
    const recentAvg = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
    const olderAvg = olderPrices.length > 0 
      ? olderPrices.reduce((sum, price) => sum + price, 0) / olderPrices.length 
      : recentAvg;

    const change = olderAvg === 0 ? 0 : ((recentAvg - olderAvg) / olderAvg) * 100;
    const direction = change > 2 ? 'rising' : change < -2 ? 'falling' : 'stable';

    // Volatility (population std dev / mean * 100)
    const mean = average;
    const variance = prices.reduce((acc,p) => acc + Math.pow(p - mean,2),0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const volatilityPct = mean === 0 ? 0 : (stdDev / mean) * 100;

    // Momentum: last price vs mean of previous (exclude last)
    const lastPrice = prices[prices.length - 1];
    const prevMean = prices.length > 1 ? prices.slice(0, -1).reduce((s,p)=>s+p,0)/(prices.length-1) : lastPrice;
    const momentumPct = prevMean === 0 ? 0 : ((lastPrice - prevMean)/prevMean)*100;

    // Group by market for summaries
    const marketMap = {};
    normalized.forEach(rec => {
      if (!marketMap[rec.market]) marketMap[rec.market] = [];
      marketMap[rec.market].push(rec);
    });
    const marketSummaries = Object.entries(marketMap).map(([market, rows]) => {
      const mPrices = rows.map(r => r.modal);
      const mAvg = mPrices.reduce((s,p)=>s+p,0)/mPrices.length;
      return {
        market,
        samples: rows.length,
        average: Math.round(mAvg),
        latest: rows[rows.length - 1].modal,
        min: Math.min(...mPrices),
        max: Math.max(...mPrices)
      };
    }).sort((a,b)=>b.average - a.average);

    const topMarkets = marketSummaries.slice(0,3);
    const bottomMarkets = marketSummaries.slice(-3).reverse();

    // Generate recommendations
    const recommendations = this.generateMarketRecommendations(direction, change, average, commodity);

    return {
      currentPrices: {
        min: Math.round(min),
        max: Math.round(max),
        average: Math.round(average)
      },
      trends: {
        direction,
        change: Math.round(change * 100) / 100
      },
      recommendations,
      volatilityPct: Math.round(volatilityPct * 100) / 100,
      momentumPct: Math.round(momentumPct * 100) / 100,
      marketSummaries,
      topMarkets,
      bottomMarkets
    };
  }

  static generateMarketRecommendations(direction, change, averagePrice, commodity) {
    const recommendations = [];

    if (direction === 'rising') {
      recommendations.push(`${commodity} prices are trending upward (+${Math.abs(change).toFixed(1)}%)`);
      recommendations.push('Consider selling if you have stock ready');
      recommendations.push('Good time for farmers with produce to market');
    } else if (direction === 'falling') {
      recommendations.push(`${commodity} prices are declining (-${Math.abs(change).toFixed(1)}%)`);
      recommendations.push('Hold stock if possible, prices may recover');
      recommendations.push('Good buying opportunity for traders');
    } else {
      recommendations.push(`${commodity} prices are stable around ₹${averagePrice}`);
      recommendations.push('Normal market conditions, proceed with regular trading');
    }

    // Add seasonal advice
    const month = new Date().getMonth();
    if (commodity.toLowerCase().includes('wheat') && month >= 2 && month <= 4) {
      recommendations.push('Wheat harvest season - expect price fluctuations');
    } else if (commodity.toLowerCase().includes('rice') && month >= 9 && month <= 11) {
      recommendations.push('Rice harvest season - monitor prices closely');
    }

    return recommendations;
  }

  // Parser methods for alternative APIs
  static parseNCDEXData(data, commodity) {
    try {
      if (!data || !data.marketData) return [];
      
      return data.marketData.map(item => ({
        commodity: commodity,
        price: item.lastPrice || item.closePrice,
        market: 'NCDEX',
        date: item.date || new Date().toISOString().split('T')[0],
        volume: item.volume,
        change: item.change
      }));
    } catch (error) {
      console.error('NCDEX data parsing error:', error);
      return [];
    }
  }

  static parseMCXData(data, commodity) {
    try {
      if (!data || !data.commodityData) return [];
      
      return data.commodityData.map(item => ({
        commodity: commodity,
        price: item.ltp || item.close,
        market: 'MCX',
        date: item.tradeDate || new Date().toISOString().split('T')[0],
        volume: item.volume,
        change: item.netChange
      }));
    } catch (error) {
      console.error('MCX data parsing error:', error);
      return [];
    }
  }

  // Get popular commodities for a region
  static getPopularCommodities(state = '') {
    const commodities = {
      'punjab': ['wheat', 'rice', 'cotton', 'sugarcane'],
      'haryana': ['wheat', 'rice', 'cotton', 'mustard'],
      'uttar pradesh': ['wheat', 'rice', 'sugarcane', 'potato'],
      'maharashtra': ['cotton', 'sugarcane', 'soybean', 'onion'],
      'gujarat': ['cotton', 'groundnut', 'wheat', 'castor'],
      'rajasthan': ['wheat', 'mustard', 'barley', 'gram'],
      'madhya pradesh': ['wheat', 'soybean', 'gram', 'cotton'],
      'andhra pradesh': ['rice', 'cotton', 'chili', 'turmeric'],
      'telangana': ['rice', 'cotton', 'maize', 'turmeric'],
      'karnataka': ['rice', 'cotton', 'sugarcane', 'ragi'],
      'tamil nadu': ['rice', 'sugarcane', 'cotton', 'turmeric'],
      'default': ['wheat', 'rice', 'cotton', 'sugarcane', 'onion', 'potato']
    };

    return commodities[state.toLowerCase()] || commodities.default;
  }
}

export default MarketDataService;