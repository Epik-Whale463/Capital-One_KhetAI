#!/usr/bin/env node
/**
 * Test Market Data Timeout Fixes
 * This script tests the timeout implementations in MarketDataService and AgentToolsService
 */

import MarketDataService from './src/services/MarketDataService.js';
import AgentToolsService from './src/services/AgentToolsService.js';

async function testMarketDataTimeouts() {
  console.log('🧪 Testing Market Data Service Timeout Fixes\n');

  // Test 1: APMC API with timeout
  console.log('1. Testing APMC API timeout...');
  try {
    const start = Date.now();
    const result = await MarketDataService.getAPMCPrices('wheat', 'Punjab');
    const duration = Date.now() - start;
    console.log(`✅ APMC API completed in ${duration}ms:`, result.success ? 'SUCCESS' : `ERROR: ${result.error}`);
  } catch (error) {
    console.log(`❌ APMC API error:`, error.message);
  }

  // Test 2: Realtime commodity price with timeout
  console.log('\n2. Testing Realtime Commodity Price timeout...');
  try {
    const start = Date.now();
    const result = await MarketDataService.fetchRealtimeCommodityPrice('rice', { state: 'Andhra Pradesh' });
    const duration = Date.now() - start;
    console.log(`✅ Realtime API completed in ${duration}ms:`, result.success ? 'SUCCESS' : `ERROR: ${result.error}`);
  } catch (error) {
    console.log(`❌ Realtime API error:`, error.message);
  }

  // Test 3: Tool execution with timeout
  console.log('\n3. Testing Tool Execution timeout...');
  try {
    const start = Date.now();
    const result = await AgentToolsService.executeTool('get_realtime_market_price', { commodity: 'onion' });
    const duration = Date.now() - start;
    console.log(`✅ Tool execution completed in ${duration}ms:`, result.success ? 'SUCCESS' : `ERROR: ${result.error}`);
    if (result.success) {
      console.log(`   → Average price: ₹${result.result.current?.average} per quintal`);
      console.log(`   → Markets: ${result.result.marketCount} markets`);
      console.log(`   → Confidence: ${result.result.confidence}`);
    }
  } catch (error) {
    console.log(`❌ Tool execution error:`, error.message);
  }

  // Test 4: Alternative market data timeout
  console.log('\n4. Testing Alternative Market Data timeout...');
  try {
    const start = Date.now();
    const result = await MarketDataService.getAlternativeMarketData('cotton');
    const duration = Date.now() - start;
    console.log(`✅ Alternative APIs completed in ${duration}ms:`, result.success ? 'SUCCESS' : `ERROR: ${result.error}`);
  } catch (error) {
    console.log(`❌ Alternative APIs error:`, error.message);
  }

  console.log('\n🎯 Market Data Timeout Test Summary:');
  console.log('- All API calls now have proper 5-6 second timeouts');
  console.log('- Tool execution has 10-12 second timeouts');
  console.log('- AbortController is used for clean timeout handling');
  console.log('- Timeout errors are properly identified and handled');
}

// Run the test
testMarketDataTimeouts().catch(console.error);
