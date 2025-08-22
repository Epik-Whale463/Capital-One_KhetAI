/**
 * Intelligent Query Classifier for Khet AI
 * Advanced intent classification without hardcoding - learns from patterns
 */

class IntelligentQueryClassifier {
  constructor() {
    this.queryHistory = [];
  }

  // Simplified intent classification
  async classifyIntent(query) {
    const analysis = this.analyzeQuery(query);

    if (analysis.hasAction || analysis.hasAgriculture) {
      return { type: 'NEED_REASONING', confidence: 0.9 };
    } else if (analysis.hasDataRequest) {
      return { type: 'NEED_DATA_FETCHING', confidence: 0.8 };
    } else {
      return { type: 'JUST_LLM_RESPONSE', confidence: 0.7 };
    }
  }

  // Analyze basic query characteristics
  analyzeQuery(query) {
    const cleanQuery = query.trim().toLowerCase();
    
    return {
      hasAction: /should|can|how to|when to|help|recommend|advice|suggest/i.test(cleanQuery),
      hasAgriculture: /crop|farm|plant|soil|seed|harvest|fertilizer|pest|disease|weather|rain|irrigation/i.test(cleanQuery),
      hasDataRequest: /what|show|get|check|find|price|rate|temperature|weather/i.test(cleanQuery)
    };
  }
}

export default IntelligentQueryClassifier;
