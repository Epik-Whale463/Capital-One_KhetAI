/**
 * Agmarknet Scraper Server
 * A Node.js service that runs the Puppeteer scraping code
 * This should be deployed as a separate service/API
 */

const puppeteer = require('puppeteer');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

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

// API endpoint to get crop prices
app.post('/api/crop-prices', async (req, res) => {
  const { commodity, state, district, market, dateFrom, dateTo } = req.body;

  // Validate required fields
  if (!commodity || !state || !dateFrom || !dateTo) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: commodity, state, dateFrom, dateTo'
    });
  }

  let browser;
  try {
    console.log(`Fetching prices for ${commodity} in ${state}...`);
    
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // For production deployment
    });
    
    const page = await browser.newPage();
    await page.goto('https://agmarknet.gov.in/', { waitUntil: 'networkidle2' });

    // Wait for form to load
    await page.waitForSelector('#ddlArrivalPrice', { timeout: 10000 });

    // Select 'Price' (assuming we want prices; change to 'Arrivals' if needed)
    await selectByText(page, '#ddlArrivalPrice', 'Price');

    // Select commodity
    await selectByText(page, '#ddlCommodity', commodity);

    // Select state
    await selectByText(page, '#ddlState', state);
    await page.waitForTimeout(3000); // Wait for district to load

    // Select district if provided
    if (district) {
      await selectByText(page, '#ddlDistrict', district);
      await page.waitForTimeout(3000); // Wait for market to load
    }

    // Select market if provided
    if (market) {
      await selectByText(page, '#ddlMarket', market);
      await page.waitForTimeout(2000);
    }

    // Clear and enter dates
    await page.evaluate(() => { document.querySelector('#txtDateFrom').value = ''; });
    await page.type('#txtDateFrom', dateFrom);

    await page.evaluate(() => { document.querySelector('#txtDateTo').value = ''; });
    await page.type('#txtDateTo', dateTo);

    // Click Go button
    await page.click('#btnGo');
    await page.waitForTimeout(5000); // Wait for results

    // Wait for table
    await page.waitForSelector('#cphBody_GridPriceData', { timeout: 10000 });

    // Extract table data
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
      return res.json({
        success: false,
        error: 'No data found in table',
        data: null
      });
    }

    // Process the data to extract price summary
    const summary = extractPriceSummary(data, commodity, state, district, market);

    res.json({
      success: true,
      source: 'agmarknet',
      data: {
        ...data,
        summary
      },
      query: { commodity, state, district, market, dateFrom, dateTo },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: null
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Helper function to extract price summary from scraped data
function extractPriceSummary(data, commodity, state, district, market) {
  if (!data.rows || data.rows.length === 0) {
    return null;
  }

  // Find price columns (assuming standard Agmarknet format)
  const headers = data.headers;
  const minPriceIdx = headers.findIndex(h => h.toLowerCase().includes('minimum'));
  const maxPriceIdx = headers.findIndex(h => h.toLowerCase().includes('maximum'));
  const modalPriceIdx = headers.findIndex(h => h.toLowerCase().includes('modal'));

  if (modalPriceIdx === -1) {
    return null;
  }

  // Get the most recent price (first row)
  const latestRow = data.rows[0];
  const currentPrice = parseFloat(latestRow[modalPriceIdx]) || 0;
  const minPrice = parseFloat(latestRow[minPriceIdx]) || 0;
  const maxPrice = parseFloat(latestRow[maxPriceIdx]) || 0;

  // Calculate trend if we have multiple rows
  let trend = 'stable';
  let change = 0;
  
  if (data.rows.length > 1) {
    const previousPrice = parseFloat(data.rows[1][modalPriceIdx]) || 0;
    if (previousPrice > 0) {
      change = currentPrice - previousPrice;
      trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
    }
  }

  return {
    commodity,
    state,
    district,
    market,
    currentPrice,
    minPrice,
    maxPrice,
    priceUnit: 'Rs/Quintal',
    trend,
    change: change.toFixed(2),
    recordCount: data.rows.length
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'agmarknet-scraper' });
});

// Get available commodities
app.get('/api/commodities', (req, res) => {
  res.json({
    success: true,
    commodities: [
      'Potato', 'Onion', 'Tomato', 'Rice', 'Wheat', 'Maize',
      'Cotton', 'Sugarcane', 'Groundnut', 'Soybean', 'Turmeric',
      'Chilli', 'Coriander', 'Cumin', 'Ginger', 'Garlic',
      'Banana', 'Mango', 'Apple', 'Grapes', 'Orange'
    ]
  });
});

// Get available states
app.get('/api/states', (req, res) => {
  res.json({
    success: true,
    states: [
      'Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu',
      'Maharashtra', 'Gujarat', 'Rajasthan', 'Madhya Pradesh',
      'Uttar Pradesh', 'Bihar', 'West Bengal', 'Odisha',
      'Punjab', 'Haryana', 'Himachal Pradesh', 'Kerala',
      'Assam', 'Jharkhand', 'Chhattisgarh', 'Uttarakhand'
    ]
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Agmarknet Scraper Server running on port ${PORT}`);
  console.log(`📊 API endpoint: http://localhost:${PORT}/api/crop-prices`);
});

module.exports = app;
