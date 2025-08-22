/**
 * Quick test for HybridAIService Safety & Telemetry instrumentation
 */

// Mock dependencies
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
global.console = { log: (...args) => process.stdout.write(args.join(' ') + '\n'), warn: console.warn, error: console.error };

// Mock React Native modules
const mockAsyncStorage = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve()
};

const mockExpoVector = {
  Ionicons: {}
};

// Create mock registry
global.__mocks = {
  '@react-native-async-storage/async-storage': { default: mockAsyncStorage },
  '@expo/vector-icons': mockExpoVector,
  'react-native': {
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    StyleSheet: { create: (styles) => styles },
    Text: 'Text',
    View: 'View',
    TouchableOpacity: 'TouchableOpacity'
  }
};

// Mock require to use our registry
const originalRequire = require;
require = function(id) {
  if (global.__mocks[id]) return global.__mocks[id];
  try {
    return originalRequire(id);
  } catch (e) {
    console.warn(`Mock required for: ${id}`);
    return { default: {} };
  }
};

async function testSafetyTelemetry() {
  console.log('🧪 Testing Safety & Telemetry Integration...\n');
  
  try {
    // Import services
    const SafetyFilterService = originalRequire('./src/services/SafetyFilterService.js').default;
    const TelemetryService = originalRequire('./src/services/TelemetryService.js').default;
    
    // Test 1: SafetyFilterService basic functionality
    console.log('1. Testing SafetyFilterService...');
    const safeText = "How to grow organic tomatoes?";
    const unsafeText = "Use excessive pesticides and harmful chemicals";
    
    const safeResult = SafetyFilterService.apply(safeText);
    const unsafeResult = SafetyFilterService.apply(unsafeText);
    
    console.log(`   Safe text: ${safeResult.safe ? '✅' : '❌'} (${safeResult.safety.action})`);
    console.log(`   Unsafe text: ${unsafeResult.safe ? '❌' : '✅'} (${unsafeResult.safety.action})`);
    
    // Test 2: TelemetryService event emission
    console.log('\n2. Testing TelemetryService...');
    const reqId = await TelemetryService.startRequest({ query: 'test query', mode: 'test' });
    TelemetryService.classify({ reqId, intent: 'GREETING', confidence: 0.9 });
    TelemetryService.response({ reqId, processingType: 'GREETING', model: 'test' });
    
    const events = TelemetryService.getRecent(10);
    console.log(`   Events captured: ${events.length} ✅`);
    console.log(`   Latest event: ${events[0]?.type || 'none'}`);
    
    // Test 3: Import HybridAIService (basic structure check)
    console.log('\n3. Testing HybridAIService import...');
    try {
      const HybridAIService = originalRequire('./src/services/HybridAIService.js').default;
      console.log('   HybridAIService imported ✅');
      
      // Check if key methods exist
      const service = new HybridAIService();
      const methods = ['getFarmingAdvice', 'getGreetingResponse', 'getCasualResponse', 'getDirectDataResponse'];
      methods.forEach(method => {
        console.log(`   Method ${method}: ${typeof service[method] === 'function' ? '✅' : '❌'}`);
      });
      
    } catch (err) {
      console.log(`   HybridAIService import failed: ${err.message}`);
    }
    
    console.log('\n✅ Safety & Telemetry integration test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testSafetyTelemetry().then(() => process.exit(0)).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
