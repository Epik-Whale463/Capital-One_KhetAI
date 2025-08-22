// Adapter to mimic legacy local model interface using GroqAIService underneath
import GroqAIService from './GroqAIService.js';

class GroqAdapterService {
  constructor() {
    this.groq = new GroqAIService();
  }

  async checkAvailability() {
    return this.groq.checkAvailability();
  }

  getStatus() {
    const status = this.groq.getStatus();
    return { ...status, isAvailable: status.isAvailable, source: 'groq' };
  }

  async generateFarmingAdvice(query, context = {}) {
    return this.groq.generateFarmingAdvice(query, context);
  }

  async getSimpleResponse(query, context = {}) {
    return this.groq.getSimpleResponse(query, context);
  }

  async analyzeWeatherForFarming(weatherData, cropData = []) {
    return this.groq.analyzeWeatherForFarming(weatherData, cropData);
  }

  // Legacy methods not applicable for Groq - preserve names for compatibility
  async setLocalModelUrl() { throw new Error('setLocalModelUrl not supported with Groq cloud service'); }
  async discoverLocalModelServers() { return []; }
}

export default GroqAdapterService;
