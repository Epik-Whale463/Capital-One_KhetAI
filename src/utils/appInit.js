/**
 * Simple App Initialization for Khet AI
 * Just add this to your App.js useEffect
 */

import { initializeKhetAI } from './initializeApp';

// Simple one-line initialization
export const initKhet = () => {
  const result = initializeKhetAI();
  
  if (result.validation.isValid) {
    console.log('🎉 Khet AI ready! All services operational.');
  } else {
    console.log('⚠️ Khet AI started with some limitations.');
  }
  
  return result;
};

export default initKhet;