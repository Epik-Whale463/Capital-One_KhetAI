/**
 * Configuration Helper for Khet AI
 * Helps set up API keys and configuration in React Native environment
 */

import EnvironmentConfig from '../config/environment.js';

class ConfigHelper {
  // Initialize API keys for React Native
  static initializeApiKeys(config = {}) {
    const apiKeys = {
      openweather: config.openweatherApiKey || null,
      sarvam: config.sarvamApiKey || 'sk_eiva2gau_o1ieX3tQ2xEmSWj6H3gfnXvd', // Fallback
      plantnet: config.plantnetApiKey || null
    };

    EnvironmentConfig.setApiKeys(apiKeys);
    
    console.log('🔧 API Keys configured:', {
      openweather: !!apiKeys.openweather,
      sarvam: !!apiKeys.sarvam,
      plantnet: !!apiKeys.plantnet
    });

    return apiKeys;
  }

  // Validate current configuration
  static validateConfiguration() {
    const validation = EnvironmentConfig.validateConfig();
    
    if (!validation.isValid) {
      console.warn('⚠️ Configuration issues found:');
      validation.issues.forEach(issue => console.warn(`  - ${issue}`));
    } else {
      console.log('✅ All API keys configured correctly');
    }

    return validation;
  }

  // Get configuration status
  static getConfigurationStatus() {
    const apiKeys = EnvironmentConfig.getApiKeysFromMemory();
    
    return {
      openweather: {
        configured: !!EnvironmentConfig.getOpenWeatherApiKey(),
        required: true,
        description: 'Required for weather services and irrigation advice'
      },
      sarvam: {
        configured: !!EnvironmentConfig.getSarvamApiKey(),
        required: true,
        description: 'Required for AI responses and translation'
      },
      plantnet: {
        configured: !!EnvironmentConfig.getPlantNetApiKey(),
        required: false,
        description: 'Optional for advanced plant disease identification'
      }
    };
  }

  // Instructions for getting API keys
  static getApiKeyInstructions() {
    return {
      openweather: {
        url: 'https://openweathermap.org/api',
        steps: [
          '1. Go to https://openweathermap.org/api',
          '2. Sign up for a free account',
          '3. Go to API Keys section',
          '4. Generate a new API key',
          '5. Copy the API key and use it in your app'
        ],
        note: 'Free tier includes 1000 calls/day which is sufficient for most users'
      },
      sarvam: {
        url: 'https://www.sarvam.ai/',
        steps: [
          '1. Go to https://www.sarvam.ai/',
          '2. Sign up for an account',
          '3. Go to API section',
          '4. Generate an API key',
          '5. Copy the API key and use it in your app'
        ],
        note: 'Required for AI responses and translation services'
      },
      plantnet: {
        url: 'https://my.plantnet.org/',
        steps: [
          '1. Go to https://my.plantnet.org/',
          '2. Create an account',
          '3. Request API access',
          '4. Get your API key from the dashboard',
          '5. Copy the API key and use it in your app'
        ],
        note: 'Optional - enables advanced plant identification from photos'
      }
    };
  }
}

export default ConfigHelper;