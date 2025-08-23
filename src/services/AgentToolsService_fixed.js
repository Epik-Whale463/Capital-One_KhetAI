/**
 * Agent Tools Service for Khet AI
 * LangChain.js style tools integration with AI reasoning service
 * NO MOCK DATA - Only real API calls
 */

import WeatherToolsService from './WeatherToolsService';
import MarketDataService from './MarketDataService';
import { AgmarknetPriceService } from './AgmarknetPriceService';
import GovernmentSchemesService from './GovernmentSchemesService';
import PlantDiseaseService from './PlantDiseaseService';
import TelemetryService from './TelemetryService';

// Lightweight tool registry & execution harness
class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.defaultTimeoutMs = 8000; // per tool timeout
  }

  register(tool) {
    this.tools.set(tool.name, { ...tool, registeredAt: Date.now() });
  }

  list() { return Array.from(this.tools.values()); }

  get(name) { return this.tools.get(name); }

  async executeMany(requests = []) {
    const executions = requests.map(r => this.executeWithTimeout(r.name, r.params || {}, r.timeoutMs));
    const results = await Promise.allSettled(executions);
    return results.map((res, idx) => ({
      tool: requests[idx].name,
      status: res.status,
      ...(res.status === 'fulfilled' ? res.value : { error: res.reason?.message || String(res.reason) })
    }));
  }

  async executeWithTimeout(name, params, timeoutMs) {
    const tool = this.get(name);
    if (!tool) throw new Error(`Tool '${name}' not registered`);
    const start = Date.now();
    TelemetryService.toolInvoke({ tool: name, params });
    const execPromise = (async () => {
      const result = await tool.func(params);
      return { success: true, result };
    })();
    const to = timeoutMs || tool.timeoutMs || this.defaultTimeoutMs;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), to));
    try {
      const value = await Promise.race([execPromise, timeoutPromise]);
      const latency = Date.now() - start;
      TelemetryService.toolResult({ tool: name, latency, success: true });
      return { ...value, latency };
    } catch (e) {
      const latency = Date.now() - start;
      TelemetryService.toolResult({ tool: name, latency, success: false, error: e.message });
      throw e;
    }
  }
}

const registry = new ToolRegistry();

class AgentToolsService {
  // Define tools in LangChain.js format
  static getAvailableTools() {
  // If already registered (hot reload safe), return list
  if (registry.list().length) return registry.list();
  const definitions = [
      {
        name: "get_current_weather",
        description: "Get current weather conditions and forecast for farming location",
        parameters: {
          type: "object",
          properties: {
            latitude: { type: "number", description: "Latitude coordinate" },
            longitude: { type: "number", description: "Longitude coordinate" },
            locationName: { type: "string", description: "Place name to geocode if coordinates absent" }
          },
          required: []
        },
        func: async ({ latitude, longitude, locationName }) => {
          // Try to get coordinates from location name if needed
          if ((latitude == null || longitude == null) && locationName) {
            try {
              const geo = await WeatherToolsService.geocodePlace(locationName);
              if (geo.success) {
                latitude = geo.lat; 
                longitude = geo.lon;
              } else {
                console.log(`⚠️ Geocoding failed for ${locationName}, using Delhi as fallback`);
                // Fallback to Delhi coordinates
                latitude = 28.6139;
                longitude = 77.2090;
              }
            } catch (geoError) {
              console.log(`⚠️ Geocoding error for ${locationName}, using Delhi as fallback:`, geoError.message);
              latitude = 28.6139;
              longitude = 77.2090;
            }
          }
          
          // Final fallback if still no coordinates
          if (latitude == null || longitude == null) {
            console.log(`⚠️ No coordinates available, using Delhi as default location`);
            latitude = 28.6139;
            longitude = 77.2090;
          }
          
          const result = await WeatherToolsService.getAgricultureWeather(latitude, longitude);
          if (!result.success) {
            throw new Error(`Current weather unavailable: ${result.error}`);
          }
          return {
            current: result.current,
            forecast: result.forecast,
            agriculture: result.agriculture,
            location: result.location,
            source: "OpenWeather API"
          };
        }
      },

      {
        name: "get_weather_irrigation_advice",
        description: "Get weather-based irrigation recommendations for crops",
        parameters: {
          type: "object",
          properties: {
            latitude: { type: "number", description: "Latitude coordinate" },
            longitude: { type: "number", description: "Longitude coordinate" },
            cropType: { type: "string", description: "Type of crop (wheat, rice, cotton, etc.)" },
            soilType: { type: "string", description: "Soil type (sandy, loam, clay)" },
            locationName: { type: "string", description: "Place name to geocode if coordinates absent" }
          },
          required: ["cropType"]
        },
        func: async ({ latitude, longitude, cropType, soilType = "loam", locationName }) => {
          // Try to get coordinates from location name if needed
          if ((latitude == null || longitude == null) && locationName) {
            try {
              const geo = await WeatherToolsService.geocodePlace(locationName);
              if (geo.success) {
                latitude = geo.lat; 
                longitude = geo.lon;
              } else {
                console.log(`⚠️ Geocoding failed for ${locationName}, using Delhi as fallback`);
                latitude = 28.6139;
                longitude = 77.2090;
              }
            } catch (geoError) {
              console.log(`⚠️ Geocoding error for ${locationName}, using Delhi as fallback:`, geoError.message);
              latitude = 28.6139;
              longitude = 77.2090;
            }
          }
          
          // Final fallback if still no coordinates
          if (latitude == null || longitude == null) {
            console.log(`⚠️ No coordinates available, using Delhi as default location`);
            latitude = 28.6139;
            longitude = 77.2090;
          }
          
          const result = await WeatherToolsService.getIrrigationAdvice(latitude, longitude, cropType, soilType);
          if (!result.success) {
            throw new Error(`Weather service unavailable: ${result.error}`);
          }
          return {
            recommendation: result.recommendation,
            data: result.data,
            source: "OpenWeather API + Agricultural calculations"
          };
        }
      },

      {
        name: "get_weather_alerts",
        description: "Get weather alerts and farming recommendations",
        parameters: {
          type: "object",
          properties: {
            latitude: { type: "number", description: "Latitude coordinate" },
            longitude: { type: "number", description: "Longitude coordinate" },
            crops: { type: "array", items: { type: "string" }, description: "List of crops grown" },
            locationName: { type: "string", description: "Place name to geocode if coordinates absent" }
          },
          required: []
        },
        func: async ({ latitude, longitude, crops = [], locationName }) => {
          // Try to get coordinates from location name if needed
          if ((latitude == null || longitude == null) && locationName) {
            try {
              const geo = await WeatherToolsService.geocodePlace(locationName);
              if (geo.success) {
                latitude = geo.lat; 
                longitude = geo.lon;
              } else {
                console.log(`⚠️ Geocoding failed for ${locationName}, using Delhi as fallback`);
                latitude = 28.6139;
                longitude = 77.2090;
              }
            } catch (geoError) {
              console.log(`⚠️ Geocoding error for ${locationName}, using Delhi as fallback:`, geoError.message);
              latitude = 28.6139;
              longitude = 77.2090;
            }
          }
          
          // Final fallback if still no coordinates
          if (latitude == null || longitude == null) {
            console.log(`⚠️ No coordinates available, using Delhi as default location`);
            latitude = 28.6139;
            longitude = 77.2090;
          }
          
          const result = await WeatherToolsService.getFarmingAlerts(latitude, longitude, crops);
          if (!result.success) {
            throw new Error(`Weather alerts unavailable: ${result.error}`);
          }
          return {
            alerts: result.alerts,
            summary: result.summary,
            source: "OpenWeather API"
          };
        }
      },

      {
        name: "get_market_prices",
        description: "Get current market prices and trends for agricultural commodities",
        timeoutMs: 10000, // 10 second timeout for market data
        parameters: {
          type: "object",
          properties: {
            commodity: { type: "string", description: "Agricultural commodity (wheat, rice, cotton, etc.)" },
            location: { type: "string", description: "State or region in India" }
          },
          required: ["commodity"]
        },
        func: async ({ commodity, location = "" }) => {
          const result = await MarketDataService.getMarketAnalysis(commodity, location);
          if (!result.success) {
            throw new Error(`Market data unavailable: ${result.error}`);
          }
          return {
            currentPrices: result.currentPrices,
            trends: result.trends,
            recommendations: result.recommendations,
            source: result.source
          };
        }
      },

      {
        name: "get_realtime_market_price",
        description: "Fetch latest-day modal/min/max prices across markets for a commodity (APMC realtime)",
        timeoutMs: 10000, // 10 second timeout for market data
        parameters: {
          type: "object",
          properties: {
            commodity: { type: "string", description: "Commodity name (wheat, rice, cotton, onion, etc.)" },
            state: { type: "string", description: "Optional state to filter" },
            market: { type: "string", description: "Optional specific market name" },
            variety: { type: "string", description: "Optional variety name substring" }
          },
          required: ["commodity"]
        },
        func: async ({ commodity, state = "", market = "", variety = "" }) => {
          const result = await MarketDataService.fetchRealtimeCommodityPrice(commodity, { state, market, variety });
          if (!result.success) {
            throw new Error(`Realtime price unavailable: ${result.error}`);
          }
          return result; // already structured
        }
      },

      {
        name: "get_agmarknet_prices",
        description: "Get detailed crop prices from Agmarknet (official government source) with specific market data",
        timeoutMs: 12000, // 12 second timeout for scraper service
        parameters: {
          type: "object",
          properties: {
            commodity: { type: "string", description: "Commodity name (e.g., Potato, Onion, Tomato, Rice, Wheat)" },
            state: { type: "string", description: "State name (e.g., Andhra Pradesh, Telangana, Maharashtra)" },
            district: { type: "string", description: "District name (optional, e.g., Chittoor, Medak)" },
            market: { type: "string", description: "Market name (optional, e.g., Punganur, Nizamabad)" },
            dateFrom: { type: "string", description: "Start date in dd-MMM-yyyy format (optional, defaults to today)" },
            dateTo: { type: "string", description: "End date in dd-MMM-yyyy format (optional, defaults to today)" }
          },
          required: ["commodity", "state"]
        },
        func: async ({ commodity, state, district = "", market = "", dateFrom, dateTo }) => {
          // Set default dates to today if not provided
          if (!dateFrom || !dateTo) {
            const today = new Date();
            const defaultDate = AgmarknetPriceService._formatDate(today);
            dateFrom = dateFrom || defaultDate;
            dateTo = dateTo || defaultDate;
          }

          const result = await AgmarknetPriceService.getCropPrices({
            commodity,
            state,
            district,
            market,
            dateFrom,
            dateTo
          });

          if (!result.success) {
            throw new Error(`Agmarknet data unavailable: ${result.error}`);
          }

          return {
            priceData: result.data,
            source: result.source,
            location: `${district || state}${market ? `, ${market}` : ''}`,
            query: result.query,
            cached: result.cached || false,
            fallback: result.fallback || false
          };
        }
      },

      {
        name: "get_government_schemes",
        description: "Get information about government agricultural schemes and benefits",
        parameters: {
          type: "object",
          properties: {
            farmerProfile: {
              type: "object",
              properties: {
                farmSize: { type: "number", description: "Farm size in hectares" },
                crops: { type: "array", items: { type: "string" }, description: "Crops grown" },
                location: { type: "string", description: "State/location" },
                income: { type: "number", description: "Annual income" }
              }
            }
          }
        },
        func: async ({ farmerProfile = {} }) => {
          const [schemesResult, recommendations] = await Promise.all([
            GovernmentSchemesService.getAllSchemeInfo(),
            Promise.resolve(GovernmentSchemesService.getSchemeRecommendations(farmerProfile))
          ]);
          
          if (!schemesResult.success) {
            throw new Error(`Government schemes data unavailable: ${schemesResult.error}`);
          }
          
          return {
            availableSchemes: schemesResult.schemes,
            recommendations: recommendations,
            source: "Government APIs + Web scraping"
          };
        }
      },

      {
        name: "analyze_plant_disease",
        description: "Analyze plant diseases based on symptoms and crop type",
        parameters: {
          type: "object",
          properties: {
            cropType: { type: "string", description: "Type of crop affected" },
            symptoms: { type: "array", items: { type: "string" }, description: "Observed symptoms" },
            imageAvailable: { type: "boolean", description: "Whether plant image is available" }
          },
          required: ["cropType", "symptoms"]
        },
        func: async ({ cropType, symptoms, imageAvailable = false }) => {
          // For now, use symptom-based analysis since image processing requires camera integration
          const result = await PlantDiseaseService.analyzePlantSymptoms(null, cropType, symptoms);
          if (!result.success) {
            throw new Error(`Plant disease analysis unavailable: ${result.error}`);
          }
          
          const preventiveMeasures = PlantDiseaseService.getPreventiveMeasures(cropType);
          
          return {
            analysis: result.analysis,
            preventiveMeasures: preventiveMeasures,
            source: result.source
          };
        }
      },

      {
        name: "get_fertilizer_prices",
        description: "Get current fertilizer prices from IFFCO and other sources",
        parameters: {
          type: "object",
          properties: {
            fertilizerType: { type: "string", description: "Type of fertilizer (urea, dap, npk, etc.)" }
          }
        },
        func: async ({ fertilizerType = "" }) => {
          const result = await GovernmentSchemesService.getIFFCOPrices();
          if (!result.success) {
            throw new Error(`Fertilizer price data unavailable: ${result.error}`);
          }
          
          let filteredPrices = result.data.prices;
          if (fertilizerType) {
            filteredPrices = result.data.prices.filter(price => 
              price.product.toLowerCase().includes(fertilizerType.toLowerCase())
            );
          }
          
          return {
            prices: filteredPrices,
            source: "IFFCO website"
          };
        }
      }
    ];
  // Register in registry
  for (const def of definitions) registry.register(def);
  return registry.list();
  }

  // Execute tool by name with parameters
  static async executeTool(toolName, parameters) {
    this.getAvailableTools(); // ensure registry populated
    return registry.executeWithTimeout(toolName, parameters);
  }

  // Execute multiple tools in parallel with provenance
  static async executeToolsParallel(toolCalls = []) {
    this.getAvailableTools();
    const prepared = toolCalls.map(c => ({ name: c.name, params: c.params || {}, timeoutMs: c.timeoutMs }));
    const results = await registry.executeMany(prepared);
    const successful = results.filter(r => r.status === 'fulfilled' && r.success).map(r => ({
      name: r.tool,
      latency: r.latency,
      data: r.result,
      provenance: 'tool'
    }));
    const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.success));
    if (failures.length) {
      TelemetryService.error({ phase: 'tools.parallel', failures: failures.map(f => ({ tool: f.tool, error: f.error })) });
    }
    return { successful, failures };
  }

  // Determine which tools to use based on user query
  static analyzeQueryForTools(query, userContext = {}) {
    const queryLower = query.toLowerCase();
    const suggestedTools = [];

    // Weather / irrigation related detection (now precision-focused to avoid unnecessary tool calls)
    const weatherKeywordsCore = ['weather', 'forecast', 'temperature', 'temp', 'humidity', 'rain', 'rainfall'];
    const irrigationKeywords = ['irrigation', 'water schedule', 'water my', 'watering', 'moisture'];
    const alertKeywords = ['alert', 'storm', 'cyclone', 'heavy rain', 'heatwave', 'heat wave', 'flood', 'wind speed'];
    const genericTemporalWords = ['today', 'tomorrow', 'now', 'current'];

    const mentionsCoreWeather = weatherKeywordsCore.some(k => queryLower.includes(k));
    const mentionsIrrigation = irrigationKeywords.some(k => queryLower.includes(k));
    const mentionsAlert = alertKeywords.some(k => queryLower.includes(k));
    const onlyTemporal = genericTemporalWords.some(k => queryLower.includes(k)) && !mentionsCoreWeather && !mentionsIrrigation && !mentionsAlert;
    const hasTemperaturePattern = /(\d+)\s*(degree|celsius|fahrenheit|°)/i.test(queryLower);

    // If query is about prices, schemes, fertilizer etc, suppress incidental weather trigger
    const nonWeatherDomains = ['price', 'market', 'scheme', 'subsidy', 'fertilizer', 'disease', 'pest'];
    const clearlyNonWeather = nonWeatherDomains.some(k => queryLower.includes(k));

    if (!clearlyNonWeather) {
      // Decide minimal weather tools
      if (mentionsCoreWeather || hasTemperaturePattern) {
        suggestedTools.push({
          name: 'get_current_weather',
          reason: 'User asked about weather conditions'
        });
      }
      if (mentionsIrrigation) {
        suggestedTools.push({
          name: 'get_weather_irrigation_advice',
          reason: 'User mentioned irrigation / watering'
        });
      }
      if (mentionsAlert) {
        suggestedTools.push({
          name: 'get_weather_alerts',
          reason: 'User asked about severe weather / alerts'
        });
      }

      // If user explicitly says "weather" but no specific irrigation/alert context, don't add extra tools
      if (mentionsCoreWeather && !mentionsIrrigation && !mentionsAlert) {
        // Already added current weather only
      }

      // Avoid triggering on temporal words alone
      if (onlyTemporal && suggestedTools.length === 0) {
        // Do nothing: temporal reference alone insufficient
      }
    }

    // Market and price related
    const priceKeywords = ['price', 'market rate', 'mandi', 'bhav', 'rate', 'sell', 'buy'];
    // Check for Agmarknet-specific queries
    const wantsAgmarknet = queryLower.includes('agmarknet') || queryLower.includes('agmark') || 
                          queryLower.includes('detailed price') || queryLower.includes('official price') ||
                          queryLower.includes('government price') || queryLower.includes('district price') ||
                          /market\s+wise|district\s+wise|mandi\s+wise/i.test(queryLower);
    // Broaden realtime detection: allow up to 3 intermediary words (e.g., "current market modal price")
    const wantsRealtime = /(today|current|latest|right\s*now)\s+(?:[a-z]+\s+){0,3}?(price|rate|bhav)/i.test(queryLower) || queryLower.includes('mandi price') || queryLower.includes('mandi rate');
    const mentionsPrice = priceKeywords.some(k => queryLower.includes(k));
    if (mentionsPrice) {
      if (wantsAgmarknet) {
        suggestedTools.push({
          name: 'get_agmarknet_prices',
          reason: 'User wants detailed/official price data from Agmarknet'
        });
      } else if (wantsRealtime) {
        suggestedTools.push({
          name: 'get_realtime_market_price',
          reason: 'User wants today/current/latest price'
        });
      } else {
        suggestedTools.push({
          name: 'get_market_prices',
          reason: 'User asked about market prices/trends'
        });
      }
    }

    // If both realtime and analytical tools somehow got added, keep realtime first and drop duplicate analytical for simplicity
    const hasRealtime = suggestedTools.some(t => t.name === 'get_realtime_market_price');
    if (hasRealtime) {
      const filtered = [];
      const seen = new Set();
      for (const t of suggestedTools) {
        if (t.name === 'get_market_prices') continue; // drop analytical when realtime present
        if (!seen.has(t.name)) { filtered.push(t); seen.add(t.name); }
      }
      return filtered;
    }

    // Disease and pest related
    if (queryLower.includes('disease') || queryLower.includes('pest') || 
        queryLower.includes('spots') || queryLower.includes('yellowing') ||
        queryLower.includes('wilting') || queryLower.includes('problem')) {
      suggestedTools.push({
        name: 'analyze_plant_disease',
        reason: 'Query mentions plant health issues'
      });
    }

    // Government schemes and subsidies
    if (queryLower.includes('scheme') || queryLower.includes('subsidy') || 
        queryLower.includes('government') || queryLower.includes('pm-kisan') ||
        queryLower.includes('loan') || queryLower.includes('credit')) {
      suggestedTools.push({
        name: 'get_government_schemes',
        reason: 'Query mentions government benefits or schemes'
      });
    }

    // Fertilizer related
    if (queryLower.includes('fertilizer') || queryLower.includes('urea') || 
        queryLower.includes('dap') || queryLower.includes('npk')) {
      suggestedTools.push({
        name: 'get_fertilizer_prices',
        reason: 'Query mentions fertilizers'
      });
    }

    return suggestedTools;
  }

  // Enhanced query processing with tool integration
  static async processQueryWithTools(query, userContext = {}) {
    try {
      console.log(`🔍 Processing query with tools: "${query}"`);
      console.log(`🔍 User context:`, userContext);
      
      // Analyze query to determine relevant tools
      const suggestedTools = this.analyzeQueryForTools(query, userContext);
      
      if (suggestedTools.length === 0) {
        console.log(`❌ No tools suggested for query: "${query}"`);
  // No tools needed, return null to let the AI reasoning service handle normally
        return null;
      }

      console.log(`🔍 Query analysis suggests ${suggestedTools.length} tools:`, 
        suggestedTools.map(t => t.name));

      // Execute relevant tools
      const toolResults = [];
      for (const toolSuggestion of suggestedTools.slice(0, 3)) { // Limit to 3 tools max
        try {
          const parameters = this.extractParametersFromContext(toolSuggestion.name, userContext, query);
          if (parameters && parameters.skip) {
            console.log(`⚠️ Skipping ${toolSuggestion.name}: ${parameters.reason}`);
            continue;
          }
          console.log(`🔧 Executing ${toolSuggestion.name} with parameters:`, parameters);
          const result = await this.executeTool(toolSuggestion.name, parameters);
          // Ensure a uniform shape with toolName & success flags for downstream usage
          if (result && typeof result === 'object') {
            if (!result.toolName) result.toolName = toolSuggestion.name; // normalize
            if (typeof result.success === 'undefined') result.success = true; // registry returns success implicitly
          }
          toolResults.push(result);
        } catch (error) {
          console.error(`❌ Tool ${toolSuggestion.name} failed:`, error.message);
          toolResults.push({
            success: false,
            toolName: toolSuggestion.name,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      console.log(`🔍 Tools result: ${toolResults.length} tools executed`);
      
      const enhancedContext = this.buildEnhancedContext(toolResults);
      console.log(`📋 Enhanced query with ${toolResults.length} tools: ${toolResults.map(r => r.toolName).join(', ')}`);

      return {
        originalQuery: query,
        toolsUsed: toolResults.map(r => r.toolName),
        toolResults: toolResults,
        enhancedContext: enhancedContext
      };

    } catch (error) {
      console.error('Tool processing error:', error);
  return null; // Fallback to normal AI reasoning processing
    }
  }

  // Extract parameters from user context and query
  static extractParametersFromContext(toolName, userContext, query) {
    const params = {};

    switch (toolName) {
      case 'get_current_weather':
      case 'get_weather_irrigation_advice':
      case 'get_weather_alerts': {
        // Try to get coordinates from context first
        if (userContext.coordinates?.latitude && userContext.coordinates?.longitude) {
          params.latitude = userContext.coordinates.latitude;
          params.longitude = userContext.coordinates.longitude;
        } else if (userContext.location) {
          params.locationName = userContext.location;
        } else {
          // Extract location from query if possible
          const locationFromQuery = this.extractLocationFromQuery(query);
          if (locationFromQuery) {
            params.locationName = locationFromQuery;
          } else {
            // If no location at all, skip weather tools; let model answer with generic guidance
            return { skip: true, reason: 'No location or coordinates supplied for weather-based tool' };
          }
        }
        
        // Extract crop information - prioritize farmer context
        if (userContext.farmerContext?.crops && userContext.farmerContext.crops.length > 0) {
          params.cropType = userContext.farmerContext.crops[0];
          params.crops = userContext.farmerContext.crops;
        } else if (userContext.crops && userContext.crops.length > 0) {
          params.cropType = userContext.crops[0];
          params.crops = userContext.crops;
        } else {
          // Try to extract crop from query
          const cropFromQuery = this.extractCropFromQuery(query);
          if (cropFromQuery) {
            params.cropType = cropFromQuery;
            params.crops = [cropFromQuery];
          } else {
            // Use rice as default for Indian farmers
            params.cropType = "rice";
            params.crops = ["rice"];
          }
        }
        break; }

      case 'get_market_prices':
        // Extract commodity from query or user context
        const commodities = ['wheat', 'rice', 'cotton', 'sugarcane', 'onion', 'potato', 'tomato'];
        const foundCommodity = commodities.find(c => query.toLowerCase().includes(c));
        params.commodity = foundCommodity || userContext.crops?.[0] || 'wheat';
        params.location = userContext.location || '';
        break;

      case 'get_realtime_market_price': {
        const commodities = ['wheat', 'rice', 'cotton', 'sugarcane', 'onion', 'potato', 'tomato', 'maize', 'tur', 'gram', 'soybean'];
        const foundCommodity = commodities.find(c => query.toLowerCase().includes(c));
        params.commodity = foundCommodity || userContext.crops?.[0] || 'wheat';
        // Attempt to parse optional variety tokens like 'basmati', 'sona masuri'
        const varietyMatches = query.match(/(basmati|sona\s*masuri|ir64|sharbati|hybrid|desi)/i);
        if (varietyMatches) params.variety = varietyMatches[1];
        // Extract a state if present
        const loc = this.extractLocationFromQuery(query);
        if (loc) params.state = loc;
        break; }

      case 'get_agmarknet_prices': {
        const commodities = ['wheat', 'rice', 'cotton', 'sugarcane', 'onion', 'potato', 'tomato', 'maize', 'tur', 'gram', 'soybean', 'turmeric', 'chilli', 'coriander', 'groundnut'];
        const foundCommodity = commodities.find(c => query.toLowerCase().includes(c));
        params.commodity = foundCommodity || userContext.crops?.[0] || 'wheat';
        
        // Extract state from query or user context
        const extractedState = this.extractLocationFromQuery(query) || userContext.location;
        params.state = extractedState || 'Andhra Pradesh'; // Default state
        
        // Try to extract district if mentioned in query
        const districtMatch = query.match(/district[:\s]+([a-z\s]+)|([a-z\s]+)\s+district/i);
        if (districtMatch) {
          params.district = (districtMatch[1] || districtMatch[2]).trim();
        }
        
        // Try to extract market if mentioned in query
        const marketMatch = query.match(/market[:\s]+([a-z\s]+)|([a-z\s]+)\s+market/i);
        if (marketMatch) {
          params.market = (marketMatch[1] || marketMatch[2]).trim();
        }
        
        // Extract dates if mentioned, otherwise use today
        const dateMatch = query.match(/(\d{1,2}[-\/]\w{3}[-\/]\d{4})/i);
        if (dateMatch) {
          params.dateFrom = dateMatch[1];
          params.dateTo = dateMatch[1];
        }
        // If no specific date mentioned, the service will default to today
        
        break; }

      case 'analyze_plant_disease':
        params.cropType = userContext.crops?.[0] || 'wheat';
        params.symptoms = this.extractSymptomsFromQuery(query);
        params.imageAvailable = false;
        break;

      case 'get_government_schemes':
        params.farmerProfile = {
          farmSize: userContext.farmSize || 2,
          crops: userContext.crops || [],
          location: userContext.location || '',
          income: userContext.income || 100000
        };
        break;

      case 'get_fertilizer_prices':
        const fertilizers = ['urea', 'dap', 'npk', 'mop'];
        params.fertilizerType = fertilizers.find(f => query.toLowerCase().includes(f)) || '';
        break;
    }

    return params;
  }

  // Helper methods
  static extractLocationFromQuery(query) {
    const queryLower = query.toLowerCase();
    
    // Common Indian cities and states
    const locations = [
      'delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'pune', 'ahmedabad',
      'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam',
      'pimpri', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad',
      'meerut', 'rajkot', 'kalyan', 'vasai', 'varanasi', 'srinagar', 'aurangabad', 'dhanbad',
      'amritsar', 'navi mumbai', 'allahabad', 'ranchi', 'howrah', 'coimbatore', 'jabalpur',
      'gwalior', 'vijayawada', 'jodhpur', 'madurai', 'raipur', 'kota', 'guwahati', 'chandigarh',
      'solapur', 'hubli', 'tiruchirappalli', 'bareilly', 'mysore', 'tiruppur', 'gurgaon',
      'aligarh', 'jalandhar', 'bhubaneswar', 'salem', 'warangal', 'guntur', 'bhiwandi',
      'saharanpur', 'gorakhpur', 'bikaner', 'amravati', 'noida', 'jamshedpur', 'bhilai',
      'cuttack', 'firozabad', 'kochi', 'nellore', 'bhavnagar', 'dehradun', 'durgapur',
      'asansol', 'rourkela', 'nanded', 'kolhapur', 'ajmer', 'akola', 'gulbarga', 'jamnagar',
      'ujjain', 'loni', 'siliguri', 'jhansi', 'ulhasnagar', 'jammu', 'sangli', 'mangalore',
      'erode', 'belgaum', 'ambattur', 'tirunelveli', 'malegaon', 'gaya', 'jalgaon', 'udaipur',
      'maheshtala', 'davanagere', 'kozhikode', 'kurnool', 'rajpur sonarpur', 'rajahmundry',
      'bokaro', 'south dumdum', 'bellary', 'patiala', 'gopalpur', 'agartala', 'bhagalpur',
      'muzaffarnagar', 'bhatpara', 'panihati', 'latur', 'dhule', 'rohtak', 'korba',
      'bhilwara', 'berhampur', 'muzaffarpur', 'ahmednagar', 'mathura', 'kollam', 'avadi',
      'kadapa', 'kamarhati', 'sambalpur', 'bilaspur', 'shahjahanpur', 'satara', 'bijapur',
      'rampur', 'shivamogga', 'chandrapur', 'junagadh', 'thrissur', 'alwar', 'bardhaman',
      'kulti', 'kakinada', 'nizamabad', 'parbhani', 'tumkur', 'khammam', 'ozhukarai',
      'bihar sharif', 'panipat', 'darbhanga', 'bally', 'aizawl', 'dewas', 'ichalkaranji',
      'karnal', 'bathinda', 'jalna', 'eluru', 'kirari suleman nagar', 'barabanki', 'purnia',
      'satna', 'mau', 'sonipat', 'farrukhabad', 'sagar', 'rourkela', 'durg', 'imphal',
      'ratlam', 'hapur', 'arrah', 'anantapur', 'karimnagar', 'etawah', 'ambernath', 'north dumdum',
      'bharatpur', 'begusarai', 'new delhi', 'gandhidham', 'baranagar', 'tiruvottiyur', 'puducherry',
      'sikar', 'thoothukudi', 'rewa', 'mirzapur', 'raichur', 'pali', 'ramagundam', 'silchar',
      'orai', 'nandyal', 'morena', 'bhiwani', 'porbandar', 'palakkad', 'anand', 'puruliya',
      'maharashtra', 'uttar pradesh', 'bihar', 'west bengal', 'madhya pradesh', 'tamil nadu',
      'rajasthan', 'karnataka', 'gujarat', 'andhra pradesh', 'odisha', 'telangana', 'kerala',
      'jharkhand', 'assam', 'punjab', 'chhattisgarh', 'haryana', 'jammu and kashmir', 'ladakh',
      'uttarakhand', 'himachal pradesh', 'tripura', 'meghalaya', 'manipur', 'nagaland',
      'goa', 'arunachal pradesh', 'mizoram', 'sikkim'
    ];
    
    for (const location of locations) {
      if (queryLower.includes(location)) {
        return location.charAt(0).toUpperCase() + location.slice(1);
      }
    }
    
    return null;
  }

  static extractCropFromQuery(query) {
    const queryLower = query.toLowerCase();
    
    // Common crops in India
    const crops = [
      'wheat', 'rice', 'cotton', 'sugarcane', 'maize', 'barley', 'jowar', 'bajra',
      'ragi', 'oats', 'gram', 'tur', 'moong', 'urad', 'masoor', 'arhar', 'chana',
      'groundnut', 'sunflower', 'safflower', 'sesame', 'niger', 'castor', 'linseed',
      'mustard', 'rapeseed', 'soybean', 'coconut', 'arecanut', 'cashew', 'cocoa',
      'coffee', 'tea', 'rubber', 'jute', 'mesta', 'tobacco', 'potato', 'onion',
      'tomato', 'brinjal', 'okra', 'cabbage', 'cauliflower', 'peas', 'beans',
      'carrot', 'radish', 'beetroot', 'spinach', 'fenugreek', 'coriander', 'turmeric',
      'ginger', 'garlic', 'chilli', 'black pepper', 'cardamom', 'cinnamon', 'clove',
      'nutmeg', 'mango', 'banana', 'orange', 'apple', 'grapes', 'pomegranate',
      'guava', 'papaya', 'pineapple', 'watermelon', 'muskmelon', 'cucumber'
    ];
    
    for (const crop of crops) {
      if (queryLower.includes(crop)) {
        return crop;
      }
    }
    
    return null;
  }

  // Removed getCityCoordinates: dynamic geocoding now mandatory; placeholder left for backward calls
  static getCityCoordinates() {
    throw new Error('getCityCoordinates deprecated: supply coordinates or locationName in userContext');
  }

  static extractSymptomsFromQuery(query) {
    const symptoms = [];
    const symptomKeywords = {
      'yellow': 'yellowing leaves',
      'brown': 'brown spots',
      'spots': 'leaf spots',
      'wilting': 'wilting',
      'dry': 'drying leaves',
      'curl': 'leaf curling',
      'holes': 'holes in leaves'
    };

    Object.entries(symptomKeywords).forEach(([keyword, symptom]) => {
      if (query.toLowerCase().includes(keyword)) {
        symptoms.push(symptom);
      }
    });

    return symptoms.length > 0 ? symptoms : ['general symptoms'];
  }

  static buildEnhancedContext(toolResults) {
    // Build concise, machine-parseable snippets; outer caller will prefix heading
    let context = "";

    toolResults.forEach(result => {
      console.log(`🌡️ Building context for ${result.toolName}:`, result.success ? result.result : result.error);
      switch (result.toolName) {
        case 'get_current_weather':
          if (result.success === false) { 
            context += `Current Weather: Data unavailable (${result.error})\n`; 
            break; 
          }
          context += `Current Weather: ${Math.round(result.result.current.temp)}°C, ${result.result.current.weather[0].description}. `;
          context += `${result.result.current.humidity}% humidity wind ${Math.round(result.result.current.wind_speed * 3.6)} km/h\n`;
          if (result.result.forecast && result.result.forecast.length > 0) {
            context += `Tomorrow up to ${Math.round(result.result.forecast[0].temp)}°C\n`;
          }
          break;

        case 'get_weather_irrigation_advice':
          if (result.success === false) { 
            context += `Irrigation: Data unavailable (${result.error})\n`; 
            break; 
          }
          context += `Irrigation: ${result.result.recommendation.message} `;
          context += `(${result.result.recommendation.waterAmount}mm needed)\n`;
          break;

        case 'get_market_prices':
          if (result.success === false) { 
            context += `Market Prices: Data unavailable (${result.error})\n`; 
            break; 
          }
          context += `Market: ₹${result.result.currentPrices.average} avg, `;
          context += `${result.result.trends.direction} ${result.result.trends.change}%\n`;
          break;

        case 'get_realtime_market_price':
          if (result.success === false) {
            context += `Agmarknet Prices: Data unavailable (${result.error})\n`;
            break;
          }
          context += `Agmarknet: Latest prices retrieved for verification\n`;
          break;

        case 'identify_plant_disease':
          if (result.success === false) {
            context += `Disease Analysis: Data unavailable (${result.error})\n`;
            break;
          }
          context += `Disease: ${result.result.condition} identified, `;
          context += `confidence ${result.result.confidence}%\n`;
          break;

        case 'get_government_schemes':
          if (result.success === false) {
            context += `Government Schemes: Data unavailable (${result.error})\n`;
            break;
          }
          context += `Schemes: ${result.result.schemes.length} relevant programs found\n`;
          break;

        default:
          if (result.success === false) {
            context += `${result.toolName}: Data unavailable (${result.error})\n`;
          } else {
            context += `${result.toolName}: Data retrieved successfully\n`;
          }
      }
    });

    return context.trim();
  }

  // Enhanced context building with conflict detection
  static buildEnhancedContextWithConflicts(toolResults) {
    const baseContext = this.buildEnhancedContext(toolResults);
    const conflicts = this.detectDataConflicts(toolResults);
    
    if (conflicts.length > 0) {
      let conflictNote = "\n\nData Conflicts Detected:\n";
      conflicts.forEach(conflict => {
        conflictNote += `- ${conflict.type}: ${conflict.description}\n`;
      });
      return baseContext + conflictNote;
    }
    
    return baseContext;
  }

  static detectDataConflicts(toolResults) {
    const conflicts = [];
    
    // Check for conflicting weather data
    const weatherResults = toolResults.filter(r => r.tool === 'get_weather_forecast');
    if (weatherResults.length > 1) {
      const temps = weatherResults.map(r => r.result?.temperature);
      const tempDiff = Math.max(...temps) - Math.min(...temps);
      if (tempDiff > 5) {
        conflicts.push({
          type: 'Weather Data Mismatch',
          description: `Temperature readings vary by ${tempDiff}°C across sources`
        });
      }
    }
    
    // Check for conflicting price data
    const priceResults = toolResults.filter(r => r.tool === 'get_market_prices' || r.tool === 'get_agmarknet_prices');
    if (priceResults.length > 1) {
      const prices = priceResults.map(r => r.result?.price || r.result?.average);
      const priceDiff = (Math.max(...prices) - Math.min(...prices)) / Math.min(...prices) * 100;
      if (priceDiff > 10) {
        conflicts.push({
          type: 'Price Data Mismatch',
          description: `Market prices vary by ${priceDiff.toFixed(1)}% across sources`
        });
      }
    }
    
    // Check for failed tool executions
    const failedTools = toolResults.filter(r => r.success === false);
    if (failedTools.length > 0) {
      conflicts.push({
        type: 'Data Unavailable',
        description: `${failedTools.length} tools failed: ${failedTools.map(t => t.tool).join(', ')}`
      });
    }
    
    return conflicts;
  }

  static categorizeFailure(error) {
    const errorStr = error?.toString().toLowerCase() || '';
    
    if (errorStr.includes('network') || errorStr.includes('timeout') || errorStr.includes('connection')) {
      return {
        category: 'Network Issue',
        severity: 'medium',
        suggestion: 'Check internet connection and try again'
      };
    }
    
    if (errorStr.includes('rate limit') || errorStr.includes('too many requests')) {
      return {
        category: 'Rate Limiting',
        severity: 'low',
        suggestion: 'Wait a few moments before trying again'
      };
    }
    
    if (errorStr.includes('api key') || errorStr.includes('unauthorized') || errorStr.includes('authentication')) {
      return {
        category: 'Authentication Error',
        severity: 'high',
        suggestion: 'Check API key configuration'
      };
    }
    
    return {
      category: 'Unknown Error',
      severity: 'medium',
      suggestion: 'Please try again or contact support'
    };
  }

  static getDataSource(toolName) {
    const sourceMap = {
      'get_weather_forecast': {
        source: 'OpenWeather API',
        reliability: 'high',
        data_type: 'weather'
      },
      'get_market_prices': {
        source: 'Market Data API',
        reliability: 'medium',
        data_type: 'pricing'
      },
      'get_agmarknet_prices': {
        source: 'Agmarknet Official',
        reliability: 'high',
        data_type: 'pricing'
      },
      'get_weather_alerts': {
        source: 'Weather Alert API',
        reliability: 'high',
        data_type: 'alerts'
      },
      'analyze_plant_disease': {
        source: 'PlantNet AI',
        reliability: 'medium',
        data_type: 'analysis'
      },
      'get_government_schemes': {
        source: 'Government Portal',
        reliability: 'high',
        data_type: 'schemes'
      },
      'get_fertilizer_prices': {
        source: 'Fertilizer Market API',
        reliability: 'medium',
        data_type: 'pricing'
      }
    };
    
    return sourceMap[toolName] || {
      source: 'Unknown',
      reliability: 'unknown',
      data_type: 'unknown'
    };
  }
}

export default AgentToolsService;
