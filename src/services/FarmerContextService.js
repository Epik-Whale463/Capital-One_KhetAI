/**
 * Farmer Context Service for Khet AI
 * Maintains and enriches farmer context for intelligent AI responses
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

class FarmerContextService {
  static async getFarmerContext(userId, currentQuery = '') {
    try {
      if (!userId) return this.getDefaultContext();

      // Get farmer profile
      const farmProfileRaw = await AsyncStorage.getItem(`farmProfile_${userId}`);
      const farmProfile = farmProfileRaw ? JSON.parse(farmProfileRaw) : null;

      // Get user preferences
      const userPrefsRaw = await AsyncStorage.getItem(`userPrefs_${userId}`);
      const userPrefs = userPrefsRaw ? JSON.parse(userPrefsRaw) : {};

      // Get recent chat context
      const recentChatsRaw = await AsyncStorage.getItem(`recentChats_${userId}`);
      const recentChats = recentChatsRaw ? JSON.parse(recentChatsRaw) : [];

      return this.buildEnhancedContext(farmProfile, userPrefs, recentChats, currentQuery);
    } catch (error) {
      console.error('Failed to get farmer context:', error);
      return this.getDefaultContext();
    }
  }

  static buildEnhancedContext(farmProfile, userPrefs, recentChats, currentQuery = '') {
    const context = {
      // Basic info
      farmerId: farmProfile?.userId || 'unknown',
      farmerName: farmProfile?.farmName || farmProfile?.ownerName || 'Farmer',
      
      // Location data
      location: farmProfile?.location || userPrefs?.defaultLocation || 'India',
      coordinates: farmProfile?.coordinates || userPrefs?.coordinates || null,
      state: farmProfile?.state || this.extractStateFromLocation(farmProfile?.location),
      district: farmProfile?.district || '',
      
      // Farm details
      farmSize: farmProfile?.totalArea || 2, // acres
      farmSizeText: farmProfile?.totalArea ? `${farmProfile.totalArea} acres` : '2 acres (default)',
      soilType: farmProfile?.soilType || 'loam',
      irrigationType: farmProfile?.irrigationType || 'drip',
      farmingType: farmProfile?.farmingType || 'mixed',
      establishedYear: farmProfile?.establishedYear || new Date().getFullYear() - 5,
      
      // Crops and cultivation
      crops: farmProfile?.crops || ['rice'],
      primaryCrop: farmProfile?.crops?.[0] || 'rice',
      cropDetails: farmProfile?.cropDetails || {},
      currentSeason: this.getCurrentSeason(),
      
      // Preferences and settings
      language: userPrefs?.language || 'en-IN',
      currency: userPrefs?.currency || 'INR',
      units: userPrefs?.units || 'metric',
      
      // AI interaction context - filtered by current query to prevent bleeding
      recentTopics: this.extractRecentTopics(recentChats, currentQuery),
      commonQueries: this.extractCommonQueries(recentChats),
      lastInteraction: recentChats.length > 0 ? recentChats[0]?.timestamp : null,
      
      // System context for AI
      __systemFarmContext: '',
      __enrichedAt: new Date().toISOString()
    };

    // Build comprehensive system context for AI
    context.__systemFarmContext = this.buildSystemContext(context);
    
    return context;
  }

  static buildSystemContext(context) {
    const parts = [];
    
    // Farmer identity and location
    parts.push(`Farmer: ${context.farmerName} from ${context.location}, ${context.state || 'India'}.`);
    
    // Farm characteristics
    parts.push(`Farm: ${context.farmSizeText} of ${context.soilType} soil, ${context.irrigationType} irrigation, ${context.farmingType} farming since ${context.establishedYear}.`);
    
    // Current crops
    if (context.crops.length > 0) {
      parts.push(`Crops: ${context.crops.join(', ')} (primary: ${context.primaryCrop}).`);
    }
    
    // Crop details if available
    if (context.cropDetails && Object.keys(context.cropDetails).length > 0) {
      const cropInfo = Object.entries(context.cropDetails).map(([crop, details]) => {
        const info = [];
        if (details.area) info.push(`${details.area} acres`);
        if (details.variety) info.push(`variety: ${details.variety}`);
        if (details.plantingDate) info.push(`planted: ${details.plantingDate}`);
        if (details.expectedHarvest) info.push(`harvest: ${details.expectedHarvest}`);
        return `${crop} (${info.join(', ')})`;
      }).join(', ');
      parts.push(`Crop details: ${cropInfo}.`);
    }
    
    // Current season context
    parts.push(`Current season: ${context.currentSeason}.`);
    
    // FARMERS NEED FRESH RESPONSES - Skip recent topics completely to prevent bleeding
    // Previous context bleeding was confusing farmers with mixed responses
    
    return parts.join(' ').trim();
  }

  static getDefaultContext() {
    return {
      farmerId: 'default',
      farmerName: 'Farmer',
      location: 'India',
      coordinates: null,
      state: 'Unknown',
      district: '',
      farmSize: 2,
      farmSizeText: '2 acres (default)',
      soilType: 'loam',
      irrigationType: 'drip',
      farmingType: 'mixed',
      establishedYear: new Date().getFullYear() - 5,
      crops: ['rice'],
      primaryCrop: 'rice',
      cropDetails: {},
      currentSeason: this.getCurrentSeason(),
      language: 'en-IN',
      currency: 'INR',
      units: 'metric',
      recentTopics: [],
      commonQueries: [],
      lastInteraction: null,
      __systemFarmContext: 'Farmer from India with 2 acres of loam soil, drip irrigation, mixed farming. Crops: rice (primary). Current season: ' + this.getCurrentSeason() + '. Ready to provide comprehensive agricultural guidance.',
      __enrichedAt: new Date().toISOString()
    };
  }

  static getCurrentSeason() {
    const month = new Date().getMonth() + 1; // 1-12
    
    if (month >= 6 && month <= 9) return 'Kharif (Monsoon)';
    if (month >= 10 && month <= 3) return 'Rabi (Winter)';
    return 'Zaid (Summer)';
  }

  static extractStateFromLocation(location) {
    if (!location) return 'Unknown';
    
    const stateMap = {
      'andhra pradesh': 'Andhra Pradesh',
      'telangana': 'Telangana',
      'karnataka': 'Karnataka',
      'tamil nadu': 'Tamil Nadu',
      'kerala': 'Kerala',
      'maharashtra': 'Maharashtra',
      'gujarat': 'Gujarat',
      'rajasthan': 'Rajasthan',
      'punjab': 'Punjab',
      'haryana': 'Haryana',
      'uttar pradesh': 'Uttar Pradesh',
      'bihar': 'Bihar',
      'west bengal': 'West Bengal',
      'odisha': 'Odisha',
      'jharkhand': 'Jharkhand',
      'chhattisgarh': 'Chhattisgarh',
      'madhya pradesh': 'Madhya Pradesh',
      'assam': 'Assam',
      'nagaland': 'Nagaland',
      'manipur': 'Manipur',
      'mizoram': 'Mizoram',
      'tripura': 'Tripura',
      'meghalaya': 'Meghalaya',
      'arunachal pradesh': 'Arunachal Pradesh',
      'sikkim': 'Sikkim',
      'himachal pradesh': 'Himachal Pradesh',
      'jammu and kashmir': 'Jammu and Kashmir',
      'ladakh': 'Ladakh',
      'delhi': 'Delhi',
      'goa': 'Goa'
    };

    const locationLower = location.toLowerCase();
    for (const [key, value] of Object.entries(stateMap)) {
      if (locationLower.includes(key)) {
        return value;
      }
    }
    
    return 'India';
  }

  static extractRecentTopics(recentChats, currentQuery = '') {
    // FARMERS NEED FRESH RESPONSES - Minimize context bleeding
    if (!recentChats || recentChats.length === 0) return [];
    
    // Only check if current query is directly related to the LAST conversation
    const lastChat = recentChats[0];
    if (!lastChat) return [];
    
    const topicKeywords = {
      'weather': ['weather', 'rain', 'temperature', 'climate', 'forecast'],
      'irrigation': ['water', 'irrigation', 'watering', 'drought'],
      'diseases': ['disease', 'pest', 'problem', 'spots', 'yellowing'],
      'market prices': ['price', 'market', 'sell', 'cost'],
      'fertilizers': ['fertilizer', 'nutrients', 'urea', 'npk'],
      'government schemes': ['scheme', 'subsidy', 'government', 'loan'],
      'planting': ['plant', 'sow', 'seed', 'planting'],
      'harvest': ['harvest', 'harvesting', 'yield', 'crop cutting']
    };

    // Detect current query topic
    const currentQueryTopic = this.detectQueryTopic(currentQuery, topicKeywords);
    const lastChatTopic = this.detectQueryTopic(lastChat.message, topicKeywords);
    
    // Only include last topic if it EXACTLY matches current query topic
    if (currentQueryTopic && lastChatTopic && currentQueryTopic === lastChatTopic) {
      return [currentQueryTopic];
    }
    
    // For farmers, return empty to ensure fresh responses
    return [];
  }

  // Helper method to detect the main topic of current query
  static detectQueryTopic(query, topicKeywords) {
    if (!query) return null;
    
    const queryLower = query.toLowerCase();
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => queryLower.includes(keyword))) {
        return topic;
      }
    }
    return null;
  }

  static extractCommonQueries(recentChats) {
    if (!recentChats || recentChats.length === 0) return [];
    
    const queries = recentChats
      .slice(0, 20) // Last 20 chats
      .filter(chat => chat.message && chat.message.length > 10)
      .map(chat => chat.message.toLowerCase())
      .reduce((acc, query) => {
        // Count similar queries
        const existing = acc.find(item => 
          this.calculateSimilarity(item.query, query) > 0.7
        );
        if (existing) {
          existing.count++;
        } else {
          acc.push({ query, count: 1 });
        }
        return acc;
      }, [])
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(item => item.query);
    
    return queries;
  }

  static calculateSimilarity(str1, str2) {
    // Simple similarity calculation
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    return intersection.length / union.length;
  }

  // Save farmer interaction for future context
  static async saveInteraction(userId, message, response) {
    try {
      if (!userId) return;

      const key = `recentChats_${userId}`;
      const existingRaw = await AsyncStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      
      // Add new interaction
      const interaction = {
        message,
        response,
        timestamp: new Date().toISOString(),
        id: Date.now().toString()
      };
      
      existing.unshift(interaction);
      
      // Keep only last 50 interactions
      const trimmed = existing.slice(0, 50);
      
      await AsyncStorage.setItem(key, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to save interaction:', error);
    }
  }

  // Update farmer context with new information
  static async updateFarmerProfile(userId, updates) {
    try {
      if (!userId) return false;

      const key = `farmProfile_${userId}`;
      const existingRaw = await AsyncStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      
      const updated = {
        ...existing,
        ...updates,
        lastUpdated: new Date().toISOString()
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      return true;
    } catch (error) {
      console.error('Failed to update farmer profile:', error);
      return false;
    }
  }
}

export default FarmerContextService;
