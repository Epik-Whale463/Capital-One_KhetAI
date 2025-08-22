/**
 * App Initialization for Khet AI
 * Sets up API keys and validates configuration
 */

import ConfigHelper from './configHelper';

// Initialize the app with API keys
export const initializeKhetAI = (config = {}) => {
  console.log('🚀 Initializing Khet AI...');

  // API keys are now built into the environment config
  // No need for manual setup - using provided keys
  const validation = ConfigHelper.validateConfiguration();

  if (validation.isValid) {
    console.log('✅ All API keys configured and ready');
  } else {
    console.warn('⚠️ Configuration issues found:');
    validation.issues.forEach(issue => console.warn(`  - ${issue}`));
  }

  return {
    success: true,
    validation,
    needsSetup: false // No setup needed - keys are provided
  };
};

// Quick setup with your own API keys
export const quickSetup = (openweatherApiKey, sarvamApiKey = null, plantnetApiKey = null) => {
  return initializeKhetAI({
    openweatherApiKey,
    sarvamApiKey,
    plantnetApiKey
  });
};

export default { initializeKhetAI, quickSetup };