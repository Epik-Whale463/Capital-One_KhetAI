/**
 * Hybrid AI Service for Khet AI
 * Enhanced with intelligent query analysis and autonomous reasoning
 * Features: Query intent classification, ReAct pattern, tool usage, farmer context awareness
 */

import { SarvamAIService } from './SarvamAIService';
import GroqAIService from './GroqAIService';
import AutonomousAgentService from './AutonomousAgentService';
import FarmerContextService from './FarmerContextService';
import AgentToolsService from './AgentToolsService';
import IntelligentQueryClassifier from './IntelligentQueryClassifier';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TelemetryService from './TelemetryService';
import SafetyFilterService from './SafetyFilterService';
import FarmerCropProjectsService from './FarmerCropProjectsService';

class HybridAIService {
  constructor() {
    this.sarvam = SarvamAIService; // Keep as class since it uses static methods
    this.groq = new GroqAIService(); // Create instance for Groq AI service
    this.queryClassifier = new IntelligentQueryClassifier(); // Advanced query classification
    // Default to intelligent routing; can be switched to 'autonomous' elsewhere
    this.mode = 'intelligent'; // or 'autonomous'
    // Initialize autonomous agent (lazy heavy operations inside agent itself)
    this.agent = new AutonomousAgentService();
  }

  // Main farming advice method - Intelligent query routing with autonomous reasoning
  async getFarmingAdvice(query, language = 'en-IN', location = null, userContext = {}) {
    try {
      // Step 0: Validate language workflow
      const validation = this.validateLanguageWorkflow(query, language, userContext);
      if (!validation.isValid) {
        console.error('❌ Language workflow validation failed:', validation.issues);
        // Try to fix common issues
        if (typeof query !== 'string') {
          query = String(query);
          console.log('🔧 Fixed query type conversion');
        }
      }
      
      // Step 1: Enrich user context with comprehensive farmer profile
      const enhancedContext = await this.enrichUserContext(userContext, query);
      
      // Step 1.5: Load project-specific context if activeProjectId provided
      if (userContext.activeProjectId) {
        const projectContext = await FarmerCropProjectsService.getProjectAIContext(userContext.activeProjectId);
        if (projectContext) {
          enhancedContext.__activeProject = projectContext;
          enhancedContext.__systemFarmContext = projectContext.__systemProjectContext;
          // Override general crop context with project-specific data
          enhancedContext.crops = [projectContext.cropName];
          enhancedContext.primaryCrop = projectContext.cropName;
          enhancedContext.cropDetails = { [projectContext.cropName]: projectContext.cropDetails };
          console.log(`🎯 Using isolated project context: ${projectContext.cropName} (Project Mode)`);
        }
      } else {
        console.log(`🌾 Using general farming context (General Mode)`);
      }
      
      console.log(`🧠 Enhanced farmer context loaded for: ${enhancedContext.farmerName}`);
      console.log(`📍 Farm details: ${enhancedContext.farmSizeText}, ${enhancedContext.soilType} soil, ${enhancedContext.crops.join(', ')}`);
      console.log(`🌐 Language workflow: ${language} (Backend: English, Translation: ${language !== 'en-IN' ? 'Yes' : 'No'})`);
      // Start unified telemetry request
      const reqId = await TelemetryService.startRequest({ query, language, location, farmerId: enhancedContext.farmerId, mode: 'auto' });      // Step 2: Intelligent Query Analysis - Decide between reasoning vs data fetching
  const queryIntent = await this.analyzeQueryIntent(query, enhancedContext);
      console.log(`🎯 Query Analysis: ${queryIntent.type} (confidence: ${queryIntent.confidence})`);
  TelemetryService.classify({ reqId, intent: queryIntent.type, confidence: queryIntent.confidence, toolsNeeded: queryIntent.toolsNeeded });
      
      // Step 3: Route to appropriate processing method based on intent
      let response;
      if (queryIntent.type === 'GREETING') {
        // Simple greeting response without any tools
        response = await this.getGreetingResponse(query, language, enhancedContext, reqId, queryIntent);
      } else if (queryIntent.type === 'CASUAL') {
        // Casual conversation response without tools
        response = await this.getCasualResponse(query, language, enhancedContext, reqId, queryIntent);
      } else if (queryIntent.type === 'SIMPLE_DATA' && queryIntent.confidence > 0.3) {
        // Direct data fetching for simple queries like weather, prices, schemes
        response = await this.getDirectDataResponse(query, language, location, enhancedContext, queryIntent, reqId);
      } else {
        // Complex reasoning for agricultural advice, problem-solving, planning
        response = await this.getReasoningBasedResponse(query, language, location, enhancedContext, queryIntent, reqId);
      }
      
      // Step 4: Save interaction for future context building
      if (enhancedContext.farmerId !== 'default') {
        await FarmerContextService.saveInteraction(
          enhancedContext.farmerId, 
          query, 
          response?.message || response?.advice || 'No response'
        );
        
        // Save to project-specific history if active project
        if (userContext.activeProjectId && response) {
          await FarmerCropProjectsService.addConversation(
            userContext.activeProjectId,
            query,
            response
          );
        }
      }
      
      return response;
      
    } catch (error) {
      console.error('❌ HybridAIService error:', error);
      // Graceful degradation to standard mode
      return await this.getStandardFarmingAdvice(query, language, location, userContext);
    }
  }

  // Get intelligent classification analytics
  getClassificationAnalytics() {
    return this.queryClassifier.getAnalytics();
  }

  // Reset classifier learning (for testing or data privacy)
  resetClassifierLearning() {
    this.queryClassifier = new IntelligentQueryClassifier();
    console.log('🔄 Query classifier learning data reset');
  }

  // Enrich user context with comprehensive farmer profile
  async enrichUserContext(userContext = {}, currentQuery = '') {
    try {
      // Get farmer context from FarmerContextService with current query for context isolation
      const farmerContext = await FarmerContextService.getFarmerContext(userContext.userId, currentQuery);
      
      // Merge with provided userContext, prioritizing provided values
      const enhancedContext = {
        ...farmerContext,
        ...userContext, // Override with any explicitly provided context
        // Ensure coordinates are properly structured
        coordinates: userContext.coordinates || farmerContext.coordinates || null,
        location: userContext.location || farmerContext.location || 'India'
      };
      
      return enhancedContext;
    } catch (error) {
      console.warn('Context enrichment failed, using default:', error.message);
      return FarmerContextService.getDefaultContext();
    }
  }

  // Intelligent Query Intent Analysis - Uses machine learning-like approach
  async analyzeQueryIntent(query, farmerContext = {}) {
    try {
      // Use the intelligent classifier instead of hardcoded patterns
      const classification = await this.queryClassifier.classifyIntent(query, farmerContext);
      
      console.log(`🤖 Smart Classification: ${classification.reasoning}`);
      
  return {
        type: classification.type,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        toolsNeeded: this.detectToolsNeeded(query, farmerContext),
        farmerContext,
        queryLength: query.length,
        timestamp: new Date().toISOString(),
        signals: classification.signals, // For debugging
        analysis: classification.analysis // For debugging
      };
    } catch (error) {
      console.warn('🚨 Intelligent classifier failed, using fallback:', error.message);
      // Fallback to simple classification
      return this.fallbackQueryAnalysis(query, farmerContext);
    }
  }

  // Fallback classification for when intelligent classifier fails
  fallbackQueryAnalysis(query, farmerContext = {}) {
    const queryLower = query.toLowerCase().trim();
    
    // Simple fallback patterns
    if (/^(hi|hello|hey|namaste|good morning|good evening)$/i.test(query)) {
      return {
        type: 'GREETING',
        confidence: 0.9,
        reasoning: 'Simple greeting pattern detected',
        toolsNeeded: [],
        farmerContext,
        queryLength: query.length,
        timestamp: new Date().toISOString()
      };
    }
    
    if (query.length < 15 && !/weather|price|crop|farm|plant|soil|water/i.test(query)) {
      return {
        type: 'CASUAL',
        confidence: 0.8,
        reasoning: 'Short query without agricultural terms',
        toolsNeeded: [],
        farmerContext,
        queryLength: query.length,
        timestamp: new Date().toISOString()
      };
    }
    
    if (/what.*weather|current.*weather|today.*weather|weather.*today/i.test(query)) {
      return {
        type: 'SIMPLE_DATA',
        confidence: 0.85,
        reasoning: 'Weather data request detected',
        toolsNeeded: this.detectToolsNeeded(query, farmerContext),
        farmerContext,
        queryLength: query.length,
        timestamp: new Date().toISOString()
      };
    }
    
    // Default to complex reasoning for safety
    return {
      type: 'COMPLEX_REASONING',
      confidence: 0.6,
      reasoning: 'Fallback classification - using complex reasoning',
      toolsNeeded: this.detectToolsNeeded(query, farmerContext),
      farmerContext,
      queryLength: query.length,
      timestamp: new Date().toISOString()
    };
  }

  // Check if query is farmer-specific and needs personalized response
  isPersonalizedQuery(query, farmerContext) {
    const personalPatterns = [
      /my (crop|farm|field|harvest)/i,
      /my (rice|wheat|cotton|corn|potato|tomato|onion)/i,
      /should i (plant|sow|harvest|sell|water)/i,
      /when (should|can) i/i,
      /is my.*ready/i,
      /what.*for my/i
    ];

    return personalPatterns.some(pattern => pattern.test(query)) ||
           (farmerContext.recentTopics && farmerContext.recentTopics.length > 0);
  }

  // Helper to detect which tools might be needed
  detectToolsNeeded(query, farmerContext = {}) {
    const toolsNeeded = [];
    const queryLower = query.toLowerCase();
    
    if (/weather|rain|temperature|forecast|climate|humidity|wind/i.test(query)) {
      toolsNeeded.push('weather');
    }
    
    if (/price|market|cost|sell|buy|rate|value/i.test(query)) {
      toolsNeeded.push('market_data');
    }
    
    if (/scheme|subsidy|government|pm.?kisan|loan|credit|benefit/i.test(query)) {
      toolsNeeded.push('government_schemes');
    }
    
    if (/disease|pest|problem|issue|diagnosis|spots|yellowing|wilting|infection/i.test(query)) {
      toolsNeeded.push('plant_disease');
    }
    
    if (/fertilizer|nutrient|urea|dap|npk|mop|manure/i.test(query)) {
      toolsNeeded.push('fertilizer_prices');
    }
    
    // Add tools based on farmer context
    if (farmerContext.recentTopics) {
      if (farmerContext.recentTopics.includes('weather') && !toolsNeeded.includes('weather')) {
        toolsNeeded.push('weather');
      }
      if (farmerContext.recentTopics.includes('market prices') && !toolsNeeded.includes('market_data')) {
        toolsNeeded.push('market_data');
      }
    }
    
    return toolsNeeded;
  }

  // Simple Greeting Response - No tools needed
  async getGreetingResponse(query, language = 'en-IN', userContext = {}, reqId = null, queryIntent = null) {
    const farmerName = userContext.farmerName || 'friend';
    const greetingResponses = {
      'en-IN': [
        `Hey ${farmerName}! Good to see you. What's happening on the farm today?`,
        `Hi there! I'm here to help with whatever farming challenges you've got.`,
        `Hello ${farmerName}! How are your crops doing? Anything I can help with?`,
        `Hey! Ready to tackle some farming questions together?`
      ],
      'hi-IN': [
        `नमस्ते ${farmerName}! आज खेत में क्या चल रहा है?`,
        `हैलो दोस्त! आज किस चीज़ में मदद चाहिए?`,
        `आपको देखकर खुशी हुई! फसल कैसी चल रही है?`,
        `नमस्कार! आज किस खेती के काम में हाथ बंटाना है?`
      ],
      'te-IN': [
        `నమస్కారం ${farmerName}! ఈరోజు పొలంలో ఏం జరుగుతోంది?`,
        `హాయ్! ఏదైనా వ్యవసాయ సమస్య ఉందా? నేను సహాయం చేస్తాను.`,
        `హలో! మీ పంటలు ఎలా ఉన్నాయి? ఏదైనా సహాయం కావాలా?`,
        `నమస్కారం! కలిసి ఏదైనా వ్యవసాయ సమస్యలు పరిష్కరించుకుందాం.`
      ]
    };

    const langCode = this.sarvam.normalizeLanguageCode(language);
    const responses = greetingResponses[langCode] || greetingResponses['en-IN'];
    const idx = Math.floor(Math.random() * responses.length);
    const randomResponse = responses[idx];
    const originalEnglish = langCode !== 'en-IN' ? greetingResponses['en-IN'][idx] : randomResponse;
    const safety = SafetyFilterService.apply(randomResponse);
    const result = {
      success: true,
      advice: safety.filteredText || randomResponse,
      message: safety.filteredText || randomResponse,
      source: 'greeting',
      hasTranslation: langCode !== 'en-IN',
      toolsUsed: [],
      model: 'template_response',
      processingType: 'GREETING',
      originalEnglish: langCode !== 'en-IN' ? originalEnglish : undefined,
      translationMeta: langCode !== 'en-IN' ? { mode: 'template', cached: true } : null,
      safety: safety?.safety,
      responseTime: new Date().toISOString(),
      queryIntent
    };
    if (reqId) TelemetryService.response({ reqId, processingType: 'GREETING', model: 'template_response', safety: result.safety });
    return result;
  }

  // Casual Conversation Response - No tools needed
  async getCasualResponse(query, language = 'en-IN', userContext = {}, reqId = null, queryIntent = null) {
    const casualResponses = {
      'en-IN': [
        `What can I help you with today? Whether it's your crops, weather concerns, market prices, or just farming tips - I'm here for it!`,
        `Got any farming questions on your mind? I'm ready to help with whatever you need to know.`,
        `Let's talk farming! What's going on with your crops or what would you like to figure out?`,
        `I'm here to help make your farming easier. What's on your mind today?`
      ],
      'hi-IN': [
        `मैं आपकी कृषि आवश्यकताओं में मदद के लिए यहां हूं। फसलों, मौसम, बाजार की कीमतों या खेती की तकनीकों के बारे में बेझिझक पूछें!`,
        `अगर आपके पास कोई खेती के सवाल हैं तो मुझे बताएं - मैं फसल सलाह, मौसम अपडेट, बाजार की जानकारी और बहुत कुछ में मदद कर सकता हूं।`,
        `कृषि के बारे में कुछ भी पूछने के लिए स्वतंत्र महसूस करें - फसलें, मिट्टी, मौसम, कीमतें या खेती के तरीके!`
      ],
      'te-IN': [
        `మీ వ్యవసాయ అవసరాలతో సహాయం చేయడానికి నేను ఇక్కడ ఉన్నాను. పంటలు, వాతావరణం, మార్కెట్ ధరలు లేదా వ్యవసాయ పద్ధతుల గురించి సంకోచం లేకుండా అడగండి!`,
        `మీకు ఏవైనా వ్యవసాయ ప్రశ్నలు ఉంటే నాకు చెప్పండి - నేను పంట సలహాలు, వాతావరణ అప్‌డేట్‌లు, మార్కెట్ సమాచారం మరియు మరిన్నింటిలో సహాయం చేయగలను।`,
        `వ్యవసాయం గురించి ఏదైనా అడగడానికి సంకోచించకండి - పంటలు, మట్టి, వాతావరణం, ధరలు లేదా వ్యవసాయ పద్ధతులు!`
      ]
    };

    const langCode = this.sarvam.normalizeLanguageCode(language);
    const responses = casualResponses[langCode] || casualResponses['en-IN'];
    const idx = Math.floor(Math.random() * responses.length);
    const randomResponse = responses[idx];
    const originalEnglish = langCode !== 'en-IN' ? casualResponses['en-IN'][idx] : randomResponse;
    const safety = SafetyFilterService.apply(randomResponse);
    const result = {
      success: true,
      advice: safety.filteredText || randomResponse,
      message: safety.filteredText || randomResponse,
      source: 'casual_conversation',
      hasTranslation: langCode !== 'en-IN',
      toolsUsed: [],
      model: 'template_response',
      processingType: 'CASUAL',
      originalEnglish: langCode !== 'en-IN' ? originalEnglish : undefined,
      translationMeta: langCode !== 'en-IN' ? { mode: 'template', cached: true } : null,
      safety: safety?.safety,
      responseTime: new Date().toISOString(),
      queryIntent
    };
    if (reqId) TelemetryService.response({ reqId, processingType: 'CASUAL', model: 'template_response', safety: result.safety });
    return result;
  }

  // Direct Data Response - For simple queries requiring only data fetching
  async getDirectDataResponse(query, language = 'en-IN', location = null, userContext = {}, queryIntent, reqId = null) {
    console.log(`📊 Processing direct data query: ${queryIntent.type}`);
    
    try {
      // Import standardized animation service
      const ReasoningAnimationService = (await import('./ReasoningAnimationService')).default;
      
      const targetLang = this.sarvam.normalizeLanguageCode(language);
  let response = { success: false, message: 'No data found' };
  let originalEnglish = null;
  let translationMeta = null;
      
      // Create standardized callback
      const reasoningCallback = ReasoningAnimationService.createCallback(userContext.onReasoningStep);

      // Animate tools phase
      await ReasoningAnimationService.animateToolsPhase(reasoningCallback, queryIntent.toolsNeeded);

      // Execute tools based on detected needs
      const toolResults = {};
      
      for (const tool of queryIntent.toolsNeeded) {
        try {
          switch (tool) {
            case 'weather':
              // Fetch weather if we have either coordinates or a location string; else fallback
              const weatherService = await import('./WeatherToolsService');
              try {
                if (userContext.coordinates?.latitude && userContext.coordinates?.longitude) {
                  const { latitude, longitude } = userContext.coordinates;
                  toolResults.weather = await weatherService.default.getAgricultureWeather(latitude, longitude);
                } else if (typeof location === 'object' && location?.coordinates) {
                  const { latitude, longitude } = location.coordinates;
                  toolResults.weather = await weatherService.default.getAgricultureWeather(latitude, longitude);
                } else if (typeof location === 'string' && location.trim().length) {
                  const geo = await weatherService.default.geocodePlace(location);
                  if (geo.success) {
                    toolResults.weather = await weatherService.default.getAgricultureWeather(geo.lat, geo.lon);
                  } else {
                    throw new Error(`Geocode failed: ${geo.error}`);
                  }
                } else {
                  throw new Error('No location data provided (coordinates or name)');
                }
              } catch (wErr) {
                console.warn('Weather tool fallback error:', wErr.message);
              }
              break;
              
            case 'market_data':
              const marketService = await import('./MarketDataService');
              // Get farmer's primary crop for market data
              const primaryCrop = userContext.crops?.[0] || userContext.farmProfile?.crops?.[0] || 'rice';
              const farmerLocation = userContext.location || userContext.farmProfile?.location || '';
              toolResults.market = await marketService.default.getMarketAnalysis(primaryCrop, farmerLocation);
              break;
              
            case 'government_schemes':
              const schemesService = await import('./GovernmentSchemesService');
              toolResults.schemes = await schemesService.default.getAllSchemeInfo();
              break;
              
            case 'plant_disease':
              const diseaseService = await import('./PlantDiseaseService');
              toolResults.diseases = await diseaseService.default.getCommonDiseases();
              break;
          }
        } catch (toolError) {
          console.warn(`⚠️ Tool ${tool} failed:`, toolError.message);
        }
      }

      // Generate simple response based on collected data
      const hasTools = Object.keys(toolResults).length > 0;
      if (hasTools) {
        // Build structured data response first
        response = await this.generateDataResponse(query, toolResults, targetLang);
        
        // Enrich via Groq for consistency & better UX
        try {
          if (await this.groq.checkAvailability()) {
            // Animate synthesis phase
            reasoningCallback({
              id: ReasoningAnimationService.STEP_IDS.SYNTHESIS,
              title: 'Synthesizing Data',
              description: 'Creating farmer-friendly summary',
              status: ReasoningAnimationService.PHASES.ACTIVE,
              icon: ReasoningAnimationService.ICONS.SYNTHESIS
            });
            
            const enrichment = await this.groq.generateFarmingAdvice(
              `${query}\n\nReal-time data context:\n${response.message}`,
              { toolsUsed: Object.keys(toolResults), mode: 'data_synthesis', onReasoningStep: () => {} }
            );
            
            if (enrichment?.advice) {
              response.message = enrichment.advice;
              response.source = enrichment.source || response.source;
              
              reasoningCallback({
                id: ReasoningAnimationService.STEP_IDS.SYNTHESIS,
                title: 'Summary Ready',
                description: 'Data synthesized into actionable advice',
                status: ReasoningAnimationService.PHASES.COMPLETED,
                duration: ReasoningAnimationService.TIMINGS.SLOW,
                icon: ReasoningAnimationService.ICONS.SUCCESS
              });
            } else {
              reasoningCallback({
                id: ReasoningAnimationService.STEP_IDS.SYNTHESIS,
                title: 'Using Raw Data',
                description: 'Providing direct data response',
                status: ReasoningAnimationService.PHASES.COMPLETED,
                duration: ReasoningAnimationService.TIMINGS.FAST,
                icon: ReasoningAnimationService.ICONS.SUCCESS
              });
            }
          }
        } catch (enrichErr) {
          console.warn('Data enrichment failed:', enrichErr.message);
          ReasoningAnimationService.animateError(reasoningCallback, 'Data enrichment failed, using raw data');
        }
      } else {
        // Fallback to basic Groq response without reasoning
        response = await this.groq.getSimpleResponse(query);
      }

      // Translate response if needed
  if (targetLang !== 'en-IN' && response.success && this.sarvam.isConfigured()) {
        await ReasoningAnimationService.animateTranslation(reasoningCallback, 'English', targetLang);
        console.log(`🔄 Translating data response to ${targetLang}...`);
        
        // Use formatting-aware translation for data responses
        const dataTranslationResult = await this.sarvam.translateTextWithFormatting(
          response.message,
          'en-IN',
          targetLang
        );
        
        if (dataTranslationResult.success) {
          originalEnglish = response.message;
          response.message = dataTranslationResult.translatedText;
          translationMeta = { cached: dataTranslationResult.cached || false, preservedFormatting: dataTranslationResult.preservedFormatting, mode: dataTranslationResult.mode };
          console.log(`✅ Data response translated with formatting preserved: ${dataTranslationResult.preservedFormatting}`);
        } else {
          // Fallback to regular translation
          const fallbackResult = await this.sarvam.translateText(response.message, 'en-IN', targetLang);
          if (fallbackResult.success) {
            originalEnglish = response.message;
            response.message = fallbackResult.translatedText || response.message;
            translationMeta = { cached: fallbackResult.cached || false, mode: fallbackResult.mode };
          }
        }
      }
      // Safety filtering
      const safety = SafetyFilterService.apply(response.message);
      if (!safety.safe || safety.safety.action === 'flag') {
        response.message = safety.filteredText;
      }
      const finalObj = {
        success: response.success,
        advice: response.message,
        message: response.message,
        language: language,
        location: location,
        processingType: 'DIRECT_DATA',
        queryIntent,
        toolsUsed: Object.keys(toolResults),
        model: 'data-tools',
        source: 'direct-data',
        responseTime: new Date().toISOString(),
        originalEnglish,
        translationMeta,
        safety: safety?.safety,
        hasTranslation: !!originalEnglish
      };
      if (reqId) TelemetryService.response({ reqId, processingType: 'DIRECT_DATA', model: 'data-tools', safety: finalObj.safety });
      return finalObj;

    } catch (error) {
      console.error('❌ Direct data response error:', error);
      
      // Import animation service for error handling
      const ReasoningAnimationService = (await import('./ReasoningAnimationService')).default;
      ReasoningAnimationService.animateError(
        ReasoningAnimationService.createCallback(userContext.onReasoningStep),
        'Unable to fetch data at this time'
      );
      
      return {
        success: false,
        advice: 'Unable to fetch data at this time. Please try again.',
        message: 'Unable to fetch data at this time. Please try again.',
        error: error.message,
        processingType: 'DIRECT_DATA_ERROR'
      };
    }
  }

  // Reasoning-Based Response - For complex queries requiring step-by-step thinking
  async getReasoningBasedResponse(query, language = 'en-IN', location = null, userContext = {}, queryIntent, reqId = null) {
    console.log(`🧠 Processing reasoning-based query: "${query}"`);
    
    try {
      // Import standardized animation service
      const ReasoningAnimationService = (await import('./ReasoningAnimationService')).default;
      
      // Create standardized callback
      const reasoningCallback = ReasoningAnimationService.createCallback(userContext.onReasoningStep);
      const targetLang = this.sarvam.normalizeLanguageCode(language);

      // Step 1: Query Translation (if needed)
      let englishQuery = query;
      if (targetLang !== 'en-IN' && this.sarvam.isConfigured()) {
        reasoningCallback({
          id: 'query-translate',
          title: 'Query Translation',
          description: 'Converting query to English for processing',
          status: ReasoningAnimationService.PHASES.ACTIVE,
          icon: ReasoningAnimationService.ICONS.TRANSLATE
        });
        
        console.log(`🔄 Translating query from ${targetLang} to English for processing...`);
        
        try {
          // For queries, regular translation is usually sufficient since they're typically short
          const translationResult = await this.sarvam.translateText(query, targetLang, 'en-IN');
          if (translationResult.success) {
            englishQuery = translationResult.translatedText;
            console.log(`Query translated: "${query}" → "${englishQuery}"`);
          } else {
            console.warn('Query translation failed, using original:', translationResult.error);
            englishQuery = query; // Fallback to original
          }
        } catch (translationError) {
          console.warn('Query translation error:', translationError.message);
          englishQuery = query; // Fallback to original
        }
        
        reasoningCallback({
          id: 'query-translate',
          title: 'Query Translated',
          description: 'Query ready for AI processing',
          status: ReasoningAnimationService.PHASES.COMPLETED,
          duration: ReasoningAnimationService.TIMINGS.NORMAL,
          icon: ReasoningAnimationService.ICONS.SUCCESS
        });
      }

      // Step 2: Understanding Phase
      await ReasoningAnimationService.animateUnderstanding(reasoningCallback, englishQuery);

      // Step 3: Tools Phase
  const AgentToolsService = (await import('./AgentToolsService')).default;
  if (!reqId) {
    reqId = await TelemetryService.startRequest({ query: englishQuery, language, location, mode: 'reasoning' });
    TelemetryService.classify({ reqId, intent: queryIntent.type, confidence: queryIntent.confidence, toolsNeeded: queryIntent.toolsNeeded });
  }
  const toolResults = await AgentToolsService.processQueryWithTools(englishQuery, userContext);
      
      const toolsUsed = toolResults?.toolsUsed || [];
      await ReasoningAnimationService.animateToolsPhase(reasoningCallback, toolsUsed);

      // Step 4: Reasoning Phase
      await ReasoningAnimationService.animateReasoning(reasoningCallback, 'Agricultural Reasoning');

      let enhancedPrompt = englishQuery;
      
      // Add farmer context to prompt
      if (userContext.__systemFarmContext) {
        // Ensure englishQuery is a string
        const queryString = typeof englishQuery === 'string' ? englishQuery : String(englishQuery);
        enhancedPrompt = `Farmer Context: ${userContext.__systemFarmContext}\n\nQuestion: ${queryString}`;
      }
      
      // Add tool results context if available
      if (toolResults && toolResults.enhancedContext) {
        enhancedPrompt += `\n\n${toolResults.enhancedContext}`;
      }

      const groqResult = await this.groq.generateFarmingAdvice(enhancedPrompt, {
        location,
        onReasoningStep: () => {}, // Disable nested reasoning callbacks
        farmerContext: userContext,
        toolResults: toolResults?.toolResults || [],
        mode: 'comprehensive_advice'
      });

      // Step 5: Response Translation (if needed)
  let finalMessage = groqResult?.advice || groqResult?.message || 'Unable to generate advice at this time.';
  let originalEnglish = finalMessage; // keep baseline before translation
  let translationMeta = null;
      
  if (targetLang !== 'en-IN' && this.sarvam.isConfigured()) {
        // Use immediate animation for translation
        ReasoningAnimationService.animateTranslationImmediate(reasoningCallback, 'English', targetLang);
        
        console.log(`🔄 Translating reasoning result from English to ${targetLang}...`);
        
        try {
          // Improve text structure before translation
          let textToTranslate = this.improveTextStructure(finalMessage);
          
          // Ensure text is under 2000 characters for Sarvam translation API
          if (textToTranslate.length > 1800) {
            console.log(`⚠️ Text too long for translation (${textToTranslate.length} chars), truncating...`);
            textToTranslate = this.truncateForTranslation(textToTranslate, 1800);
          }
          
          // Use formatting-aware translation for better structure preservation
          const translationResult = await this.sarvam.translateTextWithFormatting(textToTranslate, 'en-IN', targetLang);
          if (translationResult.success) {
            finalMessage = translationResult.translatedText;
    translationMeta = { cached: translationResult.cached || false, mode: translationResult.mode, preservedFormatting: translationResult.preservedFormatting };
            console.log(`✅ Response translated successfully to ${targetLang} (Formatting preserved: ${translationResult.preservedFormatting})`);
          } else {
            console.warn('Formatting-aware translation failed, trying regular translation:', translationResult.error);
            // Fallback to regular translation
            const fallbackResult = await this.sarvam.translateText(textToTranslate, 'en-IN', targetLang);
            if (fallbackResult.success) {
              finalMessage = fallbackResult.translatedText;
      translationMeta = { cached: fallbackResult.cached || false, mode: fallbackResult.mode };
            } else {
              finalMessage = textToTranslate; // Keep original English
            }
          }
        } catch (translationError) {
          console.warn('Response translation error:', translationError.message);
          // Keep original English text if translation fails
        }
      }

      // Safety filtering
      const safety = SafetyFilterService.apply(finalMessage);
      if (!safety.safe || safety.safety.action === 'flag') {
        finalMessage = safety.filteredText;
      }

      // Final completion
      reasoningCallback({
        id: 'complete',
        title: 'Processing Complete',
        description: 'Personalized farming guidance ready',
        status: ReasoningAnimationService.PHASES.COMPLETED,
        duration: ReasoningAnimationService.TIMINGS.FAST,
        icon: ReasoningAnimationService.ICONS.SUCCESS
      });

  // Removed automatic injection of "Top 1-2 actions for today" per user request
      const finalObj = {
        success: true,
        advice: finalMessage,
        message: finalMessage,
        language: language,
        location: location,
        processingType: 'REASONING_BASED',
        queryIntent,
        reasoning: {
          toolsUsed: toolResults?.toolsUsed || [],
          farmerContext: userContext.__systemFarmContext,
          model: groqResult?.model || 'groq'
        },
        toolsUsed: toolResults?.toolsUsed || [],
        model: groqResult?.model || 'groq',
        source: groqResult?.source || 'Khet AI',
        farmContext: userContext.__systemFarmContext,
        hasTranslation: targetLang !== 'en-IN',
        originalEnglish,
        translationMeta,
        safety: safety?.safety,
        responseTime: new Date().toISOString()
      };
      if (reqId) TelemetryService.response({ reqId, processingType: 'REASONING_BASED', model: finalObj.model, safety: finalObj.safety });
      return finalObj;

    } catch (error) {
      console.error('❌ Reasoning-based response error:', error);
      
      // Import animation service for error handling
      const ReasoningAnimationService = (await import('./ReasoningAnimationService')).default;
      ReasoningAnimationService.animateError(
        ReasoningAnimationService.createCallback(userContext.onReasoningStep),
        'Processing failed, please try rephrasing your question'
      );
      
      return {
        success: false,
        advice: 'I apologize, but I encountered an issue processing your request. Please try asking your question in a different way.',
        message: 'I apologize, but I encountered an issue processing your request. Please try asking your question in a different way.',
        error: error.message,
        processingType: 'REASONING_ERROR'
      };
    }
  }

  // Enhanced ReAct Reasoning with Tool Usage
  async executeReActReasoning(query, location, reasoningCallback, queryIntent) {
    try {
      // Call underlying Groq service (returns an object, not plain string)
      const groqResult = await this.groq.generateFarmingAdvice(query, {
        location,
        onReasoningStep: reasoningCallback,
        ...queryIntent,
        // ensure coordinates propagate for tool parameter extraction
        coordinates: queryIntent.coordinates || undefined
      });

      if (!groqResult || typeof groqResult !== 'object') {
        return {
          success: false,
            message: 'AI service returned an unexpected response format.',
          error: 'INVALID_RESPONSE_FORMAT'
        };
      }

      return {
        success: groqResult.success,
        message: groqResult.advice || groqResult.message || 'No response generated',
        reasoning: {
          toolsUsed: groqResult.toolsUsed || [],
          model: groqResult.model,
          processingType: 'Integrated'
        },
        toolsUsed: groqResult.toolsUsed || [],
        source: groqResult.source,
        model: groqResult.model
      };
    } catch (error) {
      console.error('❌ Integrated reasoning error:', error);
      return {
        success: false,
        message: 'Unable to process your request at this time. Please try again.',
        error: error.message || String(error)
      };
    }
  }

  // Helper method to generate data response from tool results
  async generateDataResponse(query, toolResults, language) {
    try {
      // Build a simple response based on available data
      let responseText = '';
      
      if (toolResults.weather) {
        if (toolResults.weather.success) {
          const w = toolResults.weather.current || {};
          const forecast = toolResults.weather.daily?.[0];
            const temp = w.temp !== undefined ? `${w.temp}°C` : 'n/a';
          const desc = w.weather?.[0]?.description || 'current conditions';
          const humidity = w.humidity !== undefined ? `${w.humidity}% humidity` : '';
          const wind = w.wind_speed !== undefined ? `wind ${Math.round(w.wind_speed * 3.6)} km/h` : '';
          const tomorrow = forecast?.temp?.max ? `Tomorrow up to ${Math.round(forecast.temp.max)}°C` : '';
          responseText += `Current Weather: ${temp}, ${desc}. ${humidity} ${wind} ${tomorrow}`.trim() + '\n';
        } else {
          responseText += `Weather: unavailable (${toolResults.weather.error || 'error'})\n`;
        }
      }
      
      if (toolResults.market) {
        responseText += `Market Prices: ${JSON.stringify(toolResults.market, null, 2)}\n`;
      }
      
      if (toolResults.schemes) {
        responseText += `Government Schemes: ${toolResults.schemes.length} schemes available\n`;
      }
      
      if (toolResults.diseases) {
        responseText += `Plant Disease Info: ${toolResults.diseases.length} common issues found\n`;
      }

      // Use Groq for simple formatting if no structured data
      if (!responseText.trim()) {
        return await this.groq.getSimpleResponse(query);
      }

      return {
        success: true,
  message: responseText.trim(),
        type: 'data_response'
      };
    } catch (error) {
      console.error('Error generating data response:', error);
      return {
        success: false,
        message: 'Unable to generate response from data',
        error: error.message
      };
    }
  }

  // Helper method to build ReAct prompts
  buildReActPrompt(query, step, previousThought, toolResults, queryIntent) {
    const availableTools = [
      'get_weather - Get current weather for a location',
      'get_market_data - Get latest crop prices',
      'get_government_schemes - Get available agricultural schemes',
      'diagnose_plant_disease - Identify plant diseases and treatments',
      'Final Answer - Provide the final answer when ready'
    ];

    let prompt = `You are an expert agricultural advisor. Use the following format:

Question: ${query}

Available Tools:
${availableTools.join('\n')}

Previous observations:
${Object.entries(toolResults).map(([tool, result]) => 
  `${tool}: ${JSON.stringify(result, null, 2)}`
).join('\n') || 'None yet'}

Step ${step}: Think step by step about this agricultural question.

Thought: [Your reasoning about what to do next]
Action: [Choose a tool or "Final Answer"]
Action Input: [Input for the tool or your final answer]

Begin:`;

    return prompt;
  }

  // Helper method to parse ReAct responses
  parseReActResponse(response) {
    const thoughtMatch = response.match(/Thought:\s*(.*?)(?=Action:|$)/s);
    const actionMatch = response.match(/Action:\s*(.*?)(?=Action Input:|$)/s);
    const inputMatch = response.match(/Action Input:\s*(.*?)$/s);

    return {
      thought: thoughtMatch ? thoughtMatch[1].trim() : response,
      action: actionMatch ? actionMatch[1].trim() : null,
      input: inputMatch ? inputMatch[1].trim() : null
    };
  }

  // Helper method to execute ReAct actions
  async executeReActAction(action, input, location) {
    try {
      switch (action.toLowerCase()) {
        case 'get_weather':
          try {
            const weatherService = await import('./WeatherToolsService');
            if (location && typeof location === 'object' && location.coordinates) {
              const { latitude, longitude } = location.coordinates;
              return await weatherService.default.getAgricultureWeather(latitude, longitude);
            } else if (typeof location === 'string') {
              const geo = await weatherService.default.geocodePlace(location);
              if (!geo.success) return { error: geo.error };
              return await weatherService.default.getAgricultureWeather(geo.lat, geo.lon);
            }
            return { error: 'No location provided for weather retrieval' };
          } catch (wxErr) {
            return { error: wxErr.message };
          }

        case 'get_market_data':
          const marketService = await import('./MarketDataService');
          // Use input as commodity or default to common crops
          const commodity = input || 'rice';
          return await marketService.default.getMarketAnalysis(commodity, location);

        case 'get_government_schemes':
          const schemesService = await import('./GovernmentSchemesService');
          return await schemesService.default.getActiveSchemes();

        case 'diagnose_plant_disease':
          const diseaseService = await import('./PlantDiseaseService');
          return await diseaseService.default.diagnoseDiseaseBySymptoms(input);

        default:
          return { error: `Unknown action: ${action}` };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  // Standard farming advice method (existing functionality as fallback)
  async getStandardFarmingAdvice(query, language = 'en-IN', location = null, userContext = {}) {
    try {
      // Normalize language code
      const targetLang = this.sarvam.normalizeLanguageCode(language);
      
      // Extract reasoning callback if provided
      const reasoningCallback = userContext.onReasoningStep || (() => {});
      
      // Step 1: Translate user query to English if needed (for tool detection & processing)
      let englishQuery = query;
      if (targetLang !== 'en-IN' && this.sarvam.isConfigured()) {
        console.log(`🔄 Translating user query from ${targetLang} to English for processing...`);
        const queryTranslation = await this.sarvam.translateText(
          query,
          targetLang,
          'en-IN'
        );
        
        if (queryTranslation.success) {
          englishQuery = queryTranslation.translatedText;
    console.log(`Query translated: "${query}" → "${englishQuery}"`);
        } else {
          console.warn('⚠️ Query translation failed, proceeding with original text');
          // Use fallback text if available, otherwise keep original
          englishQuery = queryTranslation.translatedText || query;
        }
      }

  // Step 2: Use Groq for chat/reasoning (always in English)
      const context = {
        location: location,
  language: 'english', // Groq-based workflow uses English for core reasoning
        onReasoningStep: reasoningCallback, // Pass through reasoning callback
        ...userContext
      };

      // Use Groq for chat and reasoning - NO FALLBACKS
      if (!(await this.groq.checkAvailability())) {
        throw new Error('AI service is currently unavailable. Please check your API key and try again.');
      }

      // Process the English query (tools will now work correctly)
      const adviceResult = await this.groq.generateFarmingAdvice(englishQuery, context);

      // Step 3: Translate response back to user's language if needed
      let finalAdvice = adviceResult.advice;
      if (targetLang !== 'en-IN' && this.sarvam.isConfigured()) {
        // Add translation step to reasoning if callback exists
        reasoningCallback({
          id: 'translate',
          title: 'Translating Response',
          description: `Converting to ${language}`,
          status: 'active'
        });
        
        // Improve text structure before translation
        let textToTranslate = this.improveTextStructure(adviceResult.advice);
        
        // Ensure text is under 2000 characters for Sarvam translation API
        if (textToTranslate.length > 1800) {
          console.log(`⚠️ Text too long for translation (${textToTranslate.length} chars), truncating...`);
          textToTranslate = this.truncateForTranslation(textToTranslate, 1800);
        }
        
        console.log(`🔄 Translating response from English to ${targetLang}...`);
        
        // Use formatting-aware translation for better structure preservation
        const translationResult = await this.sarvam.translateTextWithFormatting(
          textToTranslate,
          'en-IN',
          targetLang
        );
        
        if (translationResult.success) {
          finalAdvice = translationResult.translatedText;
          console.log(`Response translated successfully to ${targetLang} (Formatting preserved: ${translationResult.preservedFormatting})`);
          
          reasoningCallback({
            id: 'translate',
            title: 'Translation Complete',
            description: `Response ready in ${language}`,
            status: 'completed',
            duration: 400
          });
        } else {
          console.warn('Formatting-aware translation failed, trying regular translation:', translationResult.error);
          // Fallback to regular translation
          const fallbackResult = await this.sarvam.translateText(textToTranslate, 'en-IN', targetLang);
          if (fallbackResult.success) {
            finalAdvice = fallbackResult.translatedText;
            console.log(`Response translated with regular method to ${targetLang}`);
          } else {
            finalAdvice = textToTranslate; // Keep original English
            console.error('❌ All translation methods failed:', fallbackResult.error);
          }
          
          reasoningCallback({
            id: 'translate',
            title: 'Translation Complete',
            description: 'Response ready with best available translation',
            status: 'completed',
            duration: 400
          });
        }
      }

      return {
        success: true,
        advice: finalAdvice,
        originalAdvice: adviceResult.advice,
        source: adviceResult.source,
        language: targetLang,
        hasTranslation: finalAdvice !== adviceResult.advice,
        englishQuery: englishQuery // For debugging
      };

    } catch (error) {
      console.error('Hybrid AI Service error:', error);
      return {
        success: false,
        error: error.message,
        advice: 'I apologize, but I cannot provide advice at the moment. Please try again later.'
      };
    }
  }

  // Voice query processing - Clear workflow: Sarvam ASR → Groq Chat → Sarvam Translation → Sarvam TTS
  async processVoiceQuery(audioBlob, language = 'en-IN', location = null, userContext = {}) {
    try {
      // Extract reasoning callback if provided
      const reasoningCallback = userContext.onReasoningStep || (() => {});
      
      // Step 1: Speech to Text using Sarvam ASR
      reasoningCallback({
        id: 'stt',
        title: '🎤 Processing Voice',
        description: 'Converting speech to text',
        status: 'active'
      });

      const normalizedLang = this.sarvam.normalizeLanguageCode(language);
      const sttResult = await this.sarvam.speechToText(audioBlob, normalizedLang);
      
      if (!sttResult.success) {
        throw new Error(sttResult.error || 'Speech recognition failed');
      }

      const transcript = sttResult.transcript;
      
      reasoningCallback({
        id: 'stt',
        title: '🎤 Voice Processed',
        description: `Recognized: "${transcript.substring(0, 50)}..."`,
        status: 'completed',
        duration: 800
      });

  // Step 2: Translate user query to English if needed (for Groq)
      let englishQuery = transcript;
      if (normalizedLang !== 'en-IN' && this.sarvam.isConfigured()) {
        reasoningCallback({
          id: 'query-translate',
          title: '🔄 Query Translation',
          description: 'Converting query to English for processing',
          status: 'active'
        });

        const queryTranslation = await this.sarvam.translateText(
          transcript,
          normalizedLang,
          'en-IN'
        );
        
        if (queryTranslation.success) {
          englishQuery = queryTranslation.translatedText;
          
          reasoningCallback({
            id: 'query-translate',
            title: '🔄 Query Translated',
            description: 'Query ready for AI processing',
            status: 'completed',
            duration: 300
          });
        } else {
          reasoningCallback({
            id: 'query-translate',
            title: 'Translation Skipped',
            description: 'Using original query',
            status: 'completed',
            duration: 100
          });
        }
      }

  // Step 3: Get farming advice from Groq (in English)
      const context = {
        location: location,
        language: 'english',
        onReasoningStep: reasoningCallback,
        ...userContext
      };

      let adviceResult;
      if (await this.groq.checkAvailability()) {
        adviceResult = await this.groq.generateFarmingAdvice(englishQuery, context);
      } else {
        reasoningCallback({
          id: 'fallback',
          title: '🔄 Using Fallback',
          description: 'AI service unavailable, using basic responses',
          status: 'active'
        });

        adviceResult = {
          success: true,
          advice: await this.generateBasicAdvice(englishQuery, context),
          source: 'basic'
        };

        reasoningCallback({
          id: 'fallback',
          title: 'Fallback Complete',
          description: 'Basic response generated',
          status: 'completed',
          duration: 200
        });
      }

  // Step 4: Translate Groq response to user's language using Sarvam
      let finalAdvice = adviceResult.advice;
      if (normalizedLang !== 'en-IN' && this.sarvam.isConfigured()) {
        reasoningCallback({
          id: 'response-translate',
          title: '🌐 Response Translation',
          description: `Converting to ${language}`,
          status: 'active'
        });

        const translationResult = await this.sarvam.translateText(
          adviceResult.advice,
          'en-IN',
          normalizedLang
        );
        
        if (translationResult.success) {
          finalAdvice = translationResult.translatedText;
          
          reasoningCallback({
            id: 'response-translate',
            title: 'Translation Complete',
            description: `Response ready in ${language}`,
            status: 'completed',
            duration: 400
          });
        } else {
          reasoningCallback({
            id: 'response-translate',
            title: 'Translation Partial',
            description: 'Using fallback response',
            status: 'completed',
            duration: 200
          });
        }
      }

      // Step 5: Convert to speech using Sarvam TTS
      let audioUrl = null;
      try {
        reasoningCallback({
          id: 'tts',
          title: 'Generating Speech',
          description: 'Converting text to audio',
          status: 'active'
        });

        const ttsResult = await this.sarvam.textToSpeech(finalAdvice, normalizedLang);
        if (ttsResult.success) {
          audioUrl = ttsResult.audioUrl;
          
          reasoningCallback({
            id: 'tts',
            title: 'Speech Ready',
            description: 'Audio response generated',
            status: 'completed',
            duration: 600
          });
        } else {
          reasoningCallback({
            id: 'tts',
            title: 'TTS Failed',
            description: 'Text response only',
            status: 'completed',
            duration: 100
          });
        }
      } catch (ttsError) {
        console.warn('TTS failed:', ttsError.message);
        reasoningCallback({
          id: 'tts',
          title: 'TTS Error',
          description: 'Audio generation failed',
          status: 'completed',
          duration: 100
        });
      }

      return {
        success: true,
        transcript: transcript,
        advice: finalAdvice,
        audioUrl: audioUrl,
        source: adviceResult.source,
        language: normalizedLang
      };

    } catch (error) {
      console.error('Voice query error:', error);
      return {
        success: false,
        error: error.message,
        transcript: '',
        advice: 'Sorry, I couldn\'t process your voice query. Please try again.'
      };
    }
  }

  // Weather analysis agent - uses real weather tools
  async getWeatherBasedAdvice(weatherData, userContext = {}) {
    try {
      const reasoningCallback = userContext.onReasoningStep || (() => {});
      
      reasoningCallback({
        id: 'weather-analysis',
        title: 'Weather Analysis',
        description: 'Analyzing weather data for farming insights',
        status: 'active'
      });

      if (await this.groq.checkAvailability()) {
        const result = await this.groq.analyzeWeatherForFarming(weatherData, userContext.crops || []);
        
        reasoningCallback({
          id: 'weather-analysis',
          title: 'Weather Analyzed',
          description: 'Farming recommendations generated',
          status: 'completed',
          duration: 1200
        });

        return result;
      } else {
        reasoningCallback({
          id: 'weather-analysis',
          title: 'Basic Weather Info',
          description: 'Advanced analysis unavailable',
          status: 'completed',
          duration: 200
        });

        return {
          success: true,
          analysis: 'Weather analysis requires advanced AI features. Please ensure Groq is available.',
          recommendations: ['Monitor weather conditions', 'Adjust irrigation as needed', 'Protect crops from extreme weather'],
          source: 'basic'
        };
      }
    } catch (error) {
      console.error('Weather analysis error:', error);
      throw error;
    }
  }

  // Crop health diagnostic
  async diagnoseCropIssue(symptoms, cropType, images = [], userContext = {}) {
    try {
      const reasoningCallback = userContext.onReasoningStep || (() => {});
      
      reasoningCallback({
        id: 'crop-diagnosis',
        title: 'Crop Diagnosis',
        description: `Analyzing ${cropType} symptoms`,
        status: 'active'
      });

      if (await this.groq.checkAvailability()) {
        // Note: diagnoseCropIssues method doesn't exist in GroqAIService, using generateFarmingAdvice instead
        const result = await this.groq.generateFarmingAdvice(`Diagnose crop issues for ${cropType} with symptoms: ${symptoms.join(', ')}`, {
          mode: 'crop-diagnosis',
          onReasoningStep: () => {}
        });
        
        reasoningCallback({
          id: 'crop-diagnosis',
          title: 'Diagnosis Complete',
          description: 'Treatment recommendations ready',
          status: 'completed',
          duration: 1000
        });

        return result;
      } else {
        reasoningCallback({
          id: 'crop-diagnosis',
          title: 'Basic Diagnosis',
          description: 'Limited analysis available',
          status: 'completed',
          duration: 200
        });

        return {
          success: true,
          diagnosis: `For ${cropType} showing symptoms: ${symptoms}. Please consult with a local agricultural expert for detailed diagnosis.`,
          source: 'basic'
        };
      }
    } catch (error) {
      console.error('Crop diagnosis error:', error);
      throw error;
    }
  }

  // Market analysis
  async getMarketAnalysis(cropType, location, userContext = {}) {
    try {
      const reasoningCallback = userContext.onReasoningStep || (() => {});
      
      reasoningCallback({
        id: 'market-analysis',
        title: 'Market Analysis',
        description: `Analyzing ${cropType} market trends`,
        status: 'active'
      });

      if (await this.groq.checkAvailability()) {
        // Note: analyzeMarketTrends method doesn't exist in GroqAIService, using generateFarmingAdvice instead
        const result = await this.groq.generateFarmingAdvice(`Analyze market trends for ${cropType} in ${location}`, {
          mode: 'market-analysis',
          onReasoningStep: () => {}
        });
        
        reasoningCallback({
          id: 'market-analysis',
          title: 'Market Analyzed',
          description: 'Price predictions and strategies ready',
          status: 'completed',
          duration: 1100
        });

        return result;
      } else {
        reasoningCallback({
          id: 'market-analysis',
          title: 'Basic Market Info',
          description: 'Advanced analysis unavailable',
          status: 'completed',
          duration: 200
        });

        return {
          success: true,
          analysis: `Market analysis for ${cropType} in ${location}. Please check local market prices and trends.`,
          source: 'basic'
        };
      }
    } catch (error) {
      console.error('Market analysis error:', error);
      throw error;
    }
  }

  // Farm optimization
  async optimizeFarm(farmData, weatherData = null, userContext = {}) {
    try {
      const reasoningCallback = userContext.onReasoningStep || (() => {});
      
      reasoningCallback({
        id: 'farm-optimization',
  title: 'Farm Optimization',
        description: 'Analyzing farm data for improvements',
        status: 'active'
      });

      if (await this.groq.checkAvailability()) {
        const result = await this.groq.generateFarmingAdvice(`Optimize farm with data: ${JSON.stringify(farmData)}`, {
          weather: weatherData,
          mode: 'optimization',
          onReasoningStep: reasoningCallback,
          ...userContext
        });
        
        reasoningCallback({
          id: 'farm-optimization',
          title: 'Optimization Complete',
          description: 'Improvement strategies ready',
          status: 'completed',
          duration: 1300
        });

        return result;
      } else {
        reasoningCallback({
          id: 'farm-optimization',
          title: 'Basic Optimization',
          description: 'Limited analysis available',
          status: 'completed',
          duration: 200
        });

        return {
          success: true,
          advice: 'Farm optimization requires detailed analysis. Please ensure all AI services are available.',
          source: 'basic'
        };
      }
    } catch (error) {
      console.error('Farm optimization error:', error);
      throw error;
    }
  }

  // Pest risk prediction
  async predictPestRisks(weatherData, cropData, seasonData, userContext = {}) {
    try {
      const reasoningCallback = userContext.onReasoningStep || (() => {});
      
      reasoningCallback({
        id: 'pest-prediction',
  title: 'Pest Risk Analysis',
        description: 'Predicting pest threats based on conditions',
        status: 'active'
      });

      if (await this.groq.checkAvailability()) {
        const query = `Predict pest risks based on weather: ${JSON.stringify(weatherData)}, crops: ${JSON.stringify(cropData)}, season: ${JSON.stringify(seasonData)}`;
        const result = await this.groq.generateFarmingAdvice(query, {
          mode: 'pest-prediction',
          onReasoningStep: reasoningCallback,
          ...userContext
        });
        
        reasoningCallback({
          id: 'pest-prediction',
          title: 'Risk Assessment Complete',
          description: 'Prevention strategies ready',
          status: 'completed',
          duration: 1000
        });

        return result;
      } else {
        reasoningCallback({
          id: 'pest-prediction',
          title: 'Basic Pest Info',
          description: 'General monitoring advice',
          status: 'completed',
          duration: 200
        });

        return {
          success: true,
          advice: 'Monitor crops regularly for signs of pests. Use integrated pest management practices.',
          source: 'basic'
        };
      }
    } catch (error) {
      console.error('Pest prediction error:', error);
      throw error;
    }
  }

  // Comprehensive farm analysis
  async getComprehensiveFarmAnalysis(farmData, weatherData, query = 'analyze my farm', userContext = {}) {
    try {
      const reasoningCallback = userContext.onReasoningStep || (() => {});
      
      reasoningCallback({
        id: 'comprehensive-analysis',
        title: 'Comprehensive Analysis',
        description: 'Analyzing all farm aspects',
        status: 'active'
      });

      const context = {
        farm: farmData,
        weather: weatherData,
        mode: 'comprehensive-analysis',
        onReasoningStep: reasoningCallback,
        ...userContext
      };

      if (await this.groq.checkAvailability()) {
        const result = await this.groq.generateFarmingAdvice(query, context);
        
        reasoningCallback({
          id: 'comprehensive-analysis',
          title: 'Analysis Complete',
          description: 'Comprehensive insights ready',
          status: 'completed',
          duration: 1500
        });

        return result;
      } else {
        reasoningCallback({
          id: 'comprehensive-analysis',
          title: 'Basic Analysis',
          description: 'Limited insights available',
          status: 'completed',
          duration: 200
        });

        return {
          success: true,
          advice: 'Comprehensive farm analysis requires advanced AI capabilities. Please ensure Groq is available.',
          source: 'basic'
        };
      }
    } catch (error) {
      console.error('Comprehensive analysis error:', error);
      throw error;
    }
  }

  // Generate basic advice when Groq is not available
  async generateBasicAdvice(query, context = {}) {
    const basicResponses = {
      greeting: "Hello! I'm here to help with your farming questions. Ask me about crops, weather, or farming techniques.",
      weather: "For weather information, I recommend checking local meteorological services. Generally, monitor rainfall, temperature, and humidity for your crops.",
      crops: "Different crops have different requirements. Consider soil type, climate, and market demand when choosing crops to grow.",
      irrigation: "Water management is crucial. Use drip irrigation to conserve water and avoid overwatering which can lead to root rot.",
      pests: "Regular monitoring for pests is important. Use integrated pest management combining biological, cultural, and chemical controls as needed.",
      default: "I'd be happy to help with your farming question. Could you please rephrase or ask about specific crops, weather, irrigation, or pest management?"
    };

    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('hello') || queryLower.includes('hi') || queryLower.includes('namaste')) {
      return basicResponses.greeting;
    } else if (queryLower.includes('weather') || queryLower.includes('rain') || queryLower.includes('temperature')) {
      return basicResponses.weather;
    } else if (queryLower.includes('crop') || queryLower.includes('plant') || queryLower.includes('grow')) {
      return basicResponses.crops;
    } else if (queryLower.includes('water') || queryLower.includes('irrigation') || queryLower.includes('drip')) {
      return basicResponses.irrigation;
    } else if (queryLower.includes('pest') || queryLower.includes('insect') || queryLower.includes('disease')) {
      return basicResponses.pests;
    } else {
      return basicResponses.default;
    }
  }

  // Utility function to truncate text for translation
  truncateForTranslation(text, maxLength = 1800) {
    if (text.length <= maxLength) return text;
    
    // Try to cut at sentence boundary
    const sentences = text.split(/[.!?]+/);
    let result = '';
    
    for (const sentence of sentences) {
      const nextResult = result + sentence.trim() + '. ';
      if (nextResult.length > maxLength - 50) break;
      result = nextResult;
    }
    
    // If no complete sentence fits, truncate at word boundary
    if (result.length === 0) {
      const words = text.split(' ');
      result = words.slice(0, Math.floor(words.length * 0.7)).join(' ');
      result += '...';
    }
    
    return result.trim();
  }

  // Check service availability
  async checkAvailability() {
    const groqStatus = await this.groq.checkAvailability();
    const sarvamStatus = this.sarvam.isConfigured();
    
    return {
      groq: groqStatus,
      sarvam: sarvamStatus,
      overall: groqStatus || sarvamStatus
    };
  }

  // Get service status
  getStatus() {
    return {
      groq: this.groq.getStatus(),
      sarvam: {
        isConfigured: this.sarvam.isConfigured(),
        features: ['Translation', 'Speech-to-Text', 'Text-to-Speech']
      }
    };
  }

  // Simple text translation wrapper
  async translateText(text, fromLanguage, toLanguage) {
    try {
      return await this.sarvam.translateText(text, fromLanguage, toLanguage);
    } catch (error) {
      console.error('Translation error:', error);
      return {
        success: false,
        error: error.message,
        translatedText: text // Fallback to original text
      };
    }
  }

  // Simple TTS wrapper
  async textToSpeech(text, language = 'en-IN', speaker = 'meera') {
    try {
      return await this.sarvam.textToSpeech(text, language, speaker);
    } catch (error) {
      console.error('TTS error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Simple STT wrapper
  async speechToText(audioBlob, language = 'en-IN') {
    try {
      return await this.sarvam.speechToText(audioBlob, language);
    } catch (error) {
      console.error('STT error:', error);
      return {
        success: false,
        error: error.message,
        transcript: ''
      };
    }
  }

  // === AUTONOMOUS AGENT CAPABILITIES ===

  // Switch between autonomous and standard modes
  setMode(mode) {
    if (mode === 'autonomous' || mode === 'standard') {
      this.mode = mode;
      console.log(`🔄 HybridAIService mode set to: ${mode}`);
      return true;
    }
    console.warn(`⚠️ Invalid mode: ${mode}. Use 'autonomous' or 'standard'`);
    return false;
  }

  // Get current mode
  getMode() {
    return this.mode;
  }

  // Get comprehensive service status
  async getServiceStatus() {
    const groqStatus = await this.groq.getStatus();
    let agentStatus = { isAvailable: false };
    try {
      agentStatus = this.agent ? await this.agent.getStatus() : { isAvailable: false };
    } catch (e) {
      console.warn('Agent status unavailable:', e.message);
    }

    return {
      mode: this.mode,
      groq: groqStatus,
      agent: agentStatus,
      sarvam: {
        isConfigured: this.sarvam.isConfigured(),
        supportedLanguages: this.sarvam.getSupportedLanguages()
      },
      capabilities: {
        autonomous_reasoning: agentStatus.isAvailable,
        multilingual: this.sarvam.isConfigured(),
        tool_usage: groqStatus.isAvailable,
        conversation_memory: agentStatus.isAvailable
      }
    };
  }

  // Process multi-turn conversation with memory
  async processConversation(messages, language = 'en-IN', location = null, userContext = {}) {
    try {
      // Ensure we have a thread ID for conversation continuity
      const threadId = userContext.threadId || `thread_${Date.now()}`;
      
      // Extract the latest message as the query
      const latestMessage = messages[messages.length - 1];
      if (!latestMessage || latestMessage.role !== 'user') {
        throw new Error('Invalid conversation format: latest message must be from user');
      }

      // Add conversation history to context
      const enhancedContext = {
        ...userContext,
        threadId: threadId,
        conversationHistory: messages.slice(0, -1), // All messages except the latest
        isMultiTurn: messages.length > 1
      };

      // Process with either autonomous or standard mode
      const result = await this.getFarmingAdvice(
        latestMessage.content,
        language,
        location,
        enhancedContext
      );

      return {
        ...result,
        threadId: threadId,
        conversationContext: {
          messageCount: messages.length,
          hasHistory: messages.length > 1,
          mode: this.mode
        }
      };

    } catch (error) {
      console.error('❌ Conversation processing failed:', error);
      return {
        success: false,
        advice: 'I apologize, but I encountered an error processing this conversation. Please try again.',
        error: error.message,
        threadId: userContext.threadId || null
      };
    }
  }

  // Enhanced autonomous planning for complex farming scenarios
  async planFarmingStrategy(scenario, timeframe = '1_year', userContext = {}) {
    if (this.mode !== 'autonomous') {
      console.warn('⚠️ Strategic planning requires autonomous mode');
      this.setMode('autonomous');
    }
    if (!this.agent) {
      console.warn('Autonomous agent not initialized');
      return { success: false, strategy: 'Agent unavailable' };
    }

    try {
      const reasoningCallback = userContext.onReasoningStep || (() => {});
      
      reasoningCallback({
        id: 'strategic_planning',
  title: 'Strategic Planning',
        description: 'Analyzing farming scenario for comprehensive strategy',
        status: 'active'
      });

      const planningQuery = `Develop a comprehensive ${timeframe.replace('_', ' ')} farming strategy for: ${scenario}

      Please provide:
      1. Detailed analysis of the scenario
      2. Step-by-step implementation plan
      3. Risk assessment and mitigation strategies
      4. Resource requirements and optimization
      5. Timeline with milestones
      6. Success metrics and monitoring approach
      7. Contingency plans for various outcomes`;

      const result = await this.agent.processQuery(planningQuery, {
        ...userContext,
        planningMode: true,
        timeframe: timeframe,
        scenario: scenario
      });

      reasoningCallback({
        id: 'strategic_planning',
        title: '🎯 Strategy Complete',
        description: 'Comprehensive farming strategy developed',
        status: 'completed',
        duration: 2000
      });

      return {
        success: true,
        strategy: result.content,
        timeframe: timeframe,
        scenario: scenario,
        confidence: result.confidence,
        reasoning: result.reasoning,
        metadata: {
          ...result.metadata,
          type: 'strategic_planning',
          complexity: 'high'
        }
      };

    } catch (error) {
      console.error('❌ Strategic planning failed:', error);
      return {
        success: false,
        strategy: 'Unable to generate strategic plan at this time. Please try again later.',
        error: error.message
      };
    }
  }

  // Autonomous problem diagnosis and solution generation
  async diagnoseProblem(problemDescription, urgency = 'medium', userContext = {}) {
    if (this.mode !== 'autonomous') {
      console.warn('⚠️ Problem diagnosis requires autonomous mode');
      this.setMode('autonomous');
    }
    if (!this.agent) {
      console.warn('Autonomous agent not initialized');
      return { success: false, diagnosis: 'Agent unavailable' };
    }

    try {
      const reasoningCallback = userContext.onReasoningStep || (() => {});
      
      const diagnosticQuery = `Diagnose this farming problem with ${urgency} urgency: ${problemDescription}

      Please provide:
      1. Problem analysis and potential root causes
      2. Immediate actions required (especially for high urgency)
      3. Detailed solution steps with timelines
      4. Prevention strategies for future
      5. Tools and resources needed
      6. Expected outcomes and success indicators
      7. Alternative approaches if primary solution fails`;

      const result = await this.agent.processQuery(diagnosticQuery, {
        ...userContext,
        diagnosticMode: true,
        urgency: urgency,
        problemType: 'farming_issue'
      });

      return {
        success: true,
        diagnosis: result.content,
        urgency: urgency,
        confidence: result.confidence,
        reasoning: result.reasoning,
        recommendedActions: this.extractActionItems(result.content),
        metadata: {
          ...result.metadata,
          type: 'problem_diagnosis',
          urgency: urgency
        }
      };

    } catch (error) {
      console.error('❌ Problem diagnosis failed:', error);
      return {
        success: false,
        diagnosis: 'Unable to diagnose the problem at this time. For urgent issues, please consult local agricultural experts.',
        error: error.message
      };
    }
  }

  // Extract actionable items from response
  extractActionItems(content) {
    const actions = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for numbered actions, bullet points, or action words
      if (line.match(/^\d+\./i) || 
          line.match(/^[-•*]/i) || 
          line.toLowerCase().includes('immediate') ||
          line.toLowerCase().includes('action') ||
          line.toLowerCase().includes('step')) {
        
        actions.push({
          action: line.replace(/^\d+\.|-|•|\*/, '').trim(),
          urgency: line.toLowerCase().includes('immediate') ? 'high' : 'medium',
          type: 'recommendation'
        });
      }
    }
    
    return actions.slice(0, 10); // Limit to top 10 actions
  }

  // Clear conversation memory for a specific thread
  clearConversationMemory(threadId) {
    if (this.mode === 'autonomous') {
  return this.agent ? this.agent.clearThread(threadId) : false;
    }
    return false; // Standard mode doesn't have persistent memory
  }

  // Get conversation history for a thread
  getConversationHistory(threadId) {
    if (this.mode === 'autonomous') {
  return this.agent ? this.agent.getThreadHistory(threadId) : null;
    }
    return null;
  }

  // Helper method to truncate text for translation
  truncateForTranslation(text, maxLength = 1800) {
    if (text.length <= maxLength) return text;

    // Try to cut at sentence boundary
    const sentences = text.split(/[.!?]+/);
    let result = '';

    for (const sentence of sentences) {
      const nextResult = result + sentence.trim() + '. ';
      if (nextResult.length > maxLength - 50) break; // Leave buffer for clean ending
      result = nextResult;
    }

    // If no complete sentence fits, just truncate at word boundary
    if (result.length === 0) {
      const words = text.split(' ');
      result = words.slice(0, Math.floor(words.length * 0.7)).join(' ');
    }

    return result.trim() + (result.endsWith('.') ? '' : '.');
  }

  // Helper method to improve English text structure before translation
  improveTextStructure(text) {
    if (!text || typeof text !== 'string') return text;

    // Add line breaks before numbered lists if missing
    text = text.replace(/(\.)(\s*)(\d+\.)/g, '$1\n\n$3');
    
    // Add line breaks before bullet points if missing
    text = text.replace(/(\.)(\s*)([•\-\*])/g, '$1\n\n$3');
    
    // Ensure headers end with colons and have proper spacing
    text = text.replace(/^([A-Z][^.!?]*[^:])(\s*\n)/gm, '$1:\n');
    
    // Clean up multiple consecutive spaces
    text = text.replace(/\s+/g, ' ');
    
    // Clean up multiple consecutive line breaks
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return text.trim();
  }

  // Validate language workflow configuration
  validateLanguageWorkflow(query, language, userContext) {
    const issues = [];
    
    // Check if query is properly formatted
    if (typeof query !== 'string') {
      issues.push(`Query is not a string: ${typeof query} - ${query}`);
    }
    
    // Check if language is supported
    const supportedLanguages = ['en-IN', 'hi-IN', 'te-IN'];
    if (!supportedLanguages.includes(language)) {
      issues.push(`Unsupported language: ${language}`);
    }
    
    // Check if Sarvam is configured for non-English languages
    if (language !== 'en-IN' && !this.sarvam.isConfigured()) {
      issues.push('Sarvam AI not configured for translation');
    }
    
    // Log validation results
    if (issues.length > 0) {
      console.warn('🚨 Language workflow validation issues:', issues);
    } else {
      console.log('✅ Language workflow validation passed');
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }
}

// Export the class instead of a singleton instance
export default HybridAIService;
