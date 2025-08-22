/**
 * Environment Configuration for Khet AI
 * Loads API keys from environment variables only (no hardcoded secrets).
 * Populate them via .env (and app.config.js if using Expo) locally.
 */

import Constants from 'expo-constants';
const __extra = (Constants?.expoConfig?.extra) || {};

class EnvironmentConfig {
  // OpenWeather API Configuration
  static getOpenWeatherApiKey() {
    return (typeof process !== 'undefined' ? (process.env?.OPENWEATHER_API_KEY || process.env?.EXPO_PUBLIC_OPENWEATHER_API_KEY) : null)
      || __extra.OPENWEATHER_API_KEY
      || null;
  }

  // Sarvam AI API Configuration
  static getSarvamApiKey() {
  // Excluded from .env usage by request – always return null unless provided via extra
  return __extra.SARVAM_API_KEY || null;
  }

  // Groq AI API Configuration
  static getGroqApiKey() {
    return (typeof process !== 'undefined' ? (process.env?.GROQ_API_KEY || process.env?.EXPO_PUBLIC_GROQ_API_KEY) : null)
      || __extra.GROQ_API_KEY
      || null;
  }

  // News API Configuration (for agriculture news flashcards)
  static getNewsApiKey() {
    return (typeof process !== 'undefined' ? (process.env?.NEWS_API_KEY || process.env?.EXPO_PUBLIC_NEWS_API_KEY) : null)
      || __extra.NEWS_API_KEY
      || null;
  }

  // PlantNet API Configuration
  static getPlantNetApiKey() {
    return (typeof process !== 'undefined' ? (process.env?.PLANTNET_API_KEY || process.env?.EXPO_PUBLIC_PLANTNET_API_KEY) : null)
      || __extra.PLANTNET_API_KEY
      || null;
  }

  // Data.gov.in API key (for APMC / commodity prices)
  static getDataGovApiKey() {
    return (typeof process !== 'undefined' ? (process.env?.DATA_GOV_API_KEY || process.env?.EXPO_PUBLIC_DATA_GOV_API_KEY) : null)
      || __extra.DATA_GOV_API_KEY
      || null;
  }

  // Groq Configuration
  static getGroqConfig() {
    return {
      baseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: 'openai/gpt-oss-20b' // Primary model for complex queries
    };
  }

  // Local on-prem model configuration (deprecated - using Groq cloud by default)
  static getLocalModelConfig() {
    return {
      baseUrl: null,
      defaultModel: null,
      deprecated: true,
      note: 'Local on-prem models disabled; using Groq cloud models (openai/gpt-oss-20b)'
    };
  }

  // Validate configuration
  static validateConfig() {
    const issues = [];

    const check = (label, key) => {
      if (!key || key.length < 10) issues.push(`${label} missing`);
    };
    check('OpenWeather API key', this.getOpenWeatherApiKey());
    check('Sarvam AI API key', this.getSarvamApiKey());
    check('Groq API key', this.getGroqApiKey());
    check('News API key', this.getNewsApiKey());

    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }

  // For React Native - set API keys programmatically
  static setApiKeys(config) {
    this._apiKeys = {
      openweather: config.openweather,
      sarvam: config.sarvam,
      plantnet: config.plantnet,
      groq: config.groq
    };
  }

  // Get API keys from memory (React Native)
  static getApiKeysFromMemory() {
    return this._apiKeys || {};
  }
}

export default EnvironmentConfig;