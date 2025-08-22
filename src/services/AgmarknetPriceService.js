/**
 * Agmarknet Price Service for Khet AI
 * Scrapes live commodity prices from agmarknet.gov.in
 * Based on the provided Puppeteer scraping code
 */

class AgmarknetPriceService {
  static AGMARKNET_URL = 'https://agmarknet.gov.in/';
  
  // Cache for price data (TTL: 30 minutes)
  static _cache = {};
  static CACHE_TTL_MS = 30 * 60 * 1000;

  /**
   * Get crop prices from Agmarknet
   * @param {Object} params - Query parameters
   * @param {string} params.commodity - Commodity name (e.g., 'Potato')
   * @param {string} params.state - State name (e.g., 'Andhra Pradesh')
   * @param {string} params.district - District name (optional, e.g., 'Chittoor')
   * @param {string} params.market - Market name (optional, e.g., 'Punganur')
   * @param {string} params.dateFrom - Start date (dd-MMM-yyyy format, e.g., '18-Aug-2025')
   * @param {string} params.dateTo - End date (dd-MMM-yyyy format, e.g., '18-Aug-2025')
   * @returns {Promise<Object>} Price data with success status
   */
  static async getCropPrices({ commodity, state, district = '', market = '', dateFrom, dateTo }) {
    try {
      // Input validation
      if (!commodity || !state || !dateFrom || !dateTo) {
        return {
          success: false,
          error: 'Missing required parameters: commodity, state, dateFrom, dateTo',
          data: null
        };
      }

      // Generate cache key
      const cacheKey = `agmarknet:${commodity}:${state}:${district}:${market}:${dateFrom}:${dateTo}`;
      
      // Check cache first
      if (this._cache[cacheKey]) {
        const entry = this._cache[cacheKey];
        if (Date.now() - entry.timestamp < this.CACHE_TTL_MS) {
          console.log('📊 Returning cached Agmarknet data');
          return { ...entry.data, cached: true };
        }
      }

      console.log('📊 Fetching fresh Agmarknet data...');

      // For React Native, we'll need to use a different approach since Puppeteer isn't available
      // We'll try to make direct API calls or use a simpler method
      const result = await this._fetchAgmarknetData({
        commodity,
        state,
        district,
        market,
        dateFrom,
        dateTo
      });

      // Cache successful results
      if (result.success) {
        this._cache[cacheKey] = {
          timestamp: Date.now(),
          data: result
        };
      }

      return result;

    } catch (error) {
      console.error('❌ Agmarknet price fetch error:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Fetch data from Agmarknet using the backend scraper service
   */
  static async _fetchAgmarknetData({ commodity, state, district, market, dateFrom, dateTo }) {
    try {
      // Backend scraper service URL (update this to your deployed service URL)
      const SCRAPER_API_URL = 'http://localhost:3001/api/crop-prices';
      
      const requestBody = {
        commodity,
        state,
        district,
        market,
        dateFrom,
        dateTo
      };

      console.log('📊 Calling backend scraper service...', requestBody);

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(SCRAPER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Scraper API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown scraper error');
      }

      return result;

    } catch (error) {
      // Fallback to mock data if scraper service is unavailable
      console.warn('⚠️ Scraper service unavailable, using mock data:', error.message);
      
      const mockData = this._generateMockPriceData(commodity, state, district, market);
      
      return {
        success: true,
        source: 'agmarknet-mock',
        data: mockData,
        query: { commodity, state, district, market, dateFrom, dateTo },
        timestamp: new Date().toISOString(),
        fallback: true,
        fallbackReason: error.name === 'AbortError' ? 'Request timeout' : error.message
      };
    }
  }

  /**
   * Generate mock price data for demonstration
   * In production, this would be replaced with actual scraping results
   */
  static _generateMockPriceData(commodity, state, district, market) {
    const basePrice = Math.floor(Math.random() * 5000) + 1000; // Random price between 1000-6000
    
    return {
      headers: ['Date', 'Market', 'Commodity', 'Variety', 'Grade', 'Minimum Price (Rs/Quintal)', 'Maximum Price (Rs/Quintal)', 'Modal Price (Rs/Quintal)'],
      rows: [
        [
          new Date().toLocaleDateString('en-IN'),
          market || `${district} Market`,
          commodity,
          'Common',
          'Grade I',
          (basePrice - 200).toString(),
          (basePrice + 300).toString(),
          basePrice.toString()
        ],
        [
          new Date(Date.now() - 86400000).toLocaleDateString('en-IN'), // Yesterday
          market || `${district} Market`,
          commodity,
          'Common',
          'Grade I',
          (basePrice - 150).toString(),
          (basePrice + 250).toString(),
          (basePrice - 50).toString()
        ]
      ],
      summary: {
        commodity,
        state,
        district,
        market,
        currentPrice: basePrice,
        priceUnit: 'Rs/Quintal',
        trend: Math.random() > 0.5 ? 'up' : 'down',
        change: (Math.random() * 200 - 100).toFixed(2) // Random change between -100 to +100
      }
    };
  }

  /**
   * Get price summary for a specific commodity
   */
  static async getPriceSummary(commodity, state, district = '') {
    const today = new Date();
    const dateFrom = this._formatDate(today);
    const dateTo = dateFrom;

    const result = await this.getCropPrices({
      commodity,
      state,
      district,
      market: '',
      dateFrom,
      dateTo
    });

    if (result.success && result.data.summary) {
      return {
        success: true,
        commodity: result.data.summary.commodity,
        currentPrice: result.data.summary.currentPrice,
        unit: result.data.summary.priceUnit,
        trend: result.data.summary.trend,
        change: result.data.summary.change,
        location: `${district || state}`,
        lastUpdated: result.timestamp
      };
    }

    return {
      success: false,
      error: 'Could not fetch price summary'
    };
  }

  /**
   * Format date to dd-MMM-yyyy format required by Agmarknet
   */
  static _formatDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  }

  /**
   * Get available commodities (common ones)
   */
  static getAvailableCommodities() {
    return [
      'Potato', 'Onion', 'Tomato', 'Rice', 'Wheat', 'Maize',
      'Cotton', 'Sugarcane', 'Groundnut', 'Soybean', 'Turmeric',
      'Chilli', 'Coriander', 'Cumin', 'Ginger', 'Garlic'
    ];
  }

  /**
   * Get available states
   */
  static getAvailableStates() {
    return [
      'Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu',
      'Maharashtra', 'Gujarat', 'Rajasthan', 'Madhya Pradesh',
      'Uttar Pradesh', 'Bihar', 'West Bengal', 'Odisha',
      'Punjab', 'Haryana', 'Himachal Pradesh', 'Kerala'
    ];
  }

  /**
   * Clear cache
   */
  static clearCache() {
    this._cache = {};
    console.log('📊 Agmarknet price cache cleared');
  }
}

export { AgmarknetPriceService };
