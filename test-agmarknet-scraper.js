/**
 * Test script for Agmarknet scraper
 * Run this to verify the scraping functionality works
 */

const puppeteer = require('puppeteer');

// Function to select dropdown by visible text
async function selectByText(page, selector, text) {
  if (!text) return; // Skip if no text provided
  const options = await page.evaluate((sel) => {
    const opts = Array.from(document.querySelectorAll(`${sel} > option`));
    return opts.map(opt => ({ text: opt.textContent.trim(), value: opt.value }));
  }, selector);
  const option = options.find(opt => opt.text.toLowerCase() === text.toLowerCase());
  if (!option) {
    throw new Error(`Option "${text}" not found in ${selector}`);
  }
  await page.select(selector, option.value);
}

// Test data
const testParams = {
  commodity: 'Potato',
  state: 'Andhra Pradesh',
  district: '', // Optional
  market: '', // Optional
  dateFrom: '18-Aug-2025',
  dateTo: '18-Aug-2025'
};

async function testAgmarknetScraper() {
  console.log('🚀 Starting Agmarknet scraper test...');
  console.log('Test parameters:', testParams);

  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, // Set to true for headless mode
      slowMo: 100 // Add slight delay for debugging
    });
    
    const page = await browser.newPage();
    
    // Navigate to Agmarknet
    console.log('📱 Navigating to Agmarknet...');
    await page.goto('https://agmarknet.gov.in/', { waitUntil: 'networkidle2' });

    // Wait for form to load
    console.log('⏳ Waiting for form to load...');
    await page.waitForSelector('#ddlArrivalPrice', { timeout: 10000 });

    // Select 'Price'
    console.log('📊 Selecting Price option...');
    await selectByText(page, '#ddlArrivalPrice', 'Price');

    // Select commodity
    console.log(`🌾 Selecting commodity: ${testParams.commodity}`);
    await selectByText(page, '#ddlCommodity', testParams.commodity);

    // Select state
    console.log(`🗺️ Selecting state: ${testParams.state}`);
    await selectByText(page, '#ddlState', testParams.state);
    await page.waitForTimeout(3000); // Wait for district dropdown to populate

    // Select district if provided
    if (testParams.district) {
      console.log(`🏘️ Selecting district: ${testParams.district}`);
      await selectByText(page, '#ddlDistrict', testParams.district);
      await page.waitForTimeout(3000); // Wait for market dropdown to populate
    }

    // Select market if provided
    if (testParams.market) {
      console.log(`🏪 Selecting market: ${testParams.market}`);
      await selectByText(page, '#ddlMarket', testParams.market);
      await page.waitForTimeout(2000);
    }

    // Set dates
    console.log(`📅 Setting date range: ${testParams.dateFrom} to ${testParams.dateTo}`);
    await page.evaluate(() => { document.querySelector('#txtDateFrom').value = ''; });
    await page.type('#txtDateFrom', testParams.dateFrom);

    await page.evaluate(() => { document.querySelector('#txtDateTo').value = ''; });
    await page.type('#txtDateTo', testParams.dateTo);

    // Click Go button
    console.log('🔍 Submitting query...');
    await page.click('#btnGo');
    await page.waitForTimeout(5000); // Wait for results

    // Wait for table and extract data
    console.log('📋 Waiting for results table...');
    await page.waitForSelector('#cphBody_GridPriceData', { timeout: 10000 });

    const data = await page.evaluate(() => {
      const table = document.querySelector('#cphBody_GridPriceData');
      if (!table) return { headers: [], rows: [] };

      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = Array.from(table.querySelectorAll('tr')).slice(1).map(tr => {
        return Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
      });
      return { headers, rows };
    });

    if (data.headers.length === 0) {
      console.log('❌ No data found in table');
      return;
    }

    console.log('✅ Data extracted successfully!');
    console.log('Headers:', data.headers);
    console.log(`Rows found: ${data.rows.length}`);
    
    if (data.rows.length > 0) {
      console.log('Sample row:', data.rows[0]);
      
      // Create CSV output
      let csvContent = data.headers.join(',') + '\n';
      data.rows.forEach(row => {
        csvContent += row.join(',') + '\n';
      });
      
      const fs = require('fs');
      fs.writeFileSync('test_agmarknet_data.csv', csvContent);
      console.log('💾 Data saved to test_agmarknet_data.csv');
    }

    // Extract price summary
    const summary = extractPriceSummary(data, testParams.commodity, testParams.state);
    if (summary) {
      console.log('📊 Price Summary:', summary);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Helper function to extract price summary
function extractPriceSummary(data, commodity, state) {
  if (!data.rows || data.rows.length === 0) {
    return null;
  }

  const headers = data.headers;
  const minPriceIdx = headers.findIndex(h => h.toLowerCase().includes('minimum'));
  const maxPriceIdx = headers.findIndex(h => h.toLowerCase().includes('maximum'));
  const modalPriceIdx = headers.findIndex(h => h.toLowerCase().includes('modal'));

  if (modalPriceIdx === -1) {
    return null;
  }

  const latestRow = data.rows[0];
  const currentPrice = parseFloat(latestRow[modalPriceIdx]) || 0;
  const minPrice = parseFloat(latestRow[minPriceIdx]) || 0;
  const maxPrice = parseFloat(latestRow[maxPriceIdx]) || 0;

  return {
    commodity,
    state,
    currentPrice,
    minPrice,
    maxPrice,
    priceUnit: 'Rs/Quintal',
    recordCount: data.rows.length,
    date: latestRow[0] // Assuming first column is date
  };
}

// Run the test
if (require.main === module) {
  testAgmarknetScraper();
}

module.exports = { testAgmarknetScraper, selectByText };
