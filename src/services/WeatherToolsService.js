/**
 * Enhanced Weather Tools Service for Khet AI
 * Uses OpenWeather OneCall API for advanced agricultural weather data
 */

import EnvironmentConfig from '../config/environment.js';

class WeatherToolsService {
  // Static irrigation recommendation logic (restored for compatibility)
  static generateIrrigationRecommendation(cropET, upcomingRain, soilCapacity, temp, humidity) {
    const netWaterNeed = Math.max(0, cropET - upcomingRain);
    if (netWaterNeed < 2) {
      return {
        action: 'no_irrigation',
        message: 'No irrigation needed. Sufficient rainfall expected.',
        waterAmount: 0,
        timing: 'none'
      };
    } else if (netWaterNeed < 5) {
      return {
        action: 'light_irrigation',
        message: 'Light irrigation recommended in 2-3 days.',
        waterAmount: Math.round(netWaterNeed),
        timing: 'evening'
      };
    } else {
      return {
        action: 'irrigation_needed',
        message: 'Irrigation needed within 24 hours.',
        waterAmount: Math.round(netWaterNeed),
        timing: temp > 30 ? 'early_morning_or_evening' : 'morning'
      };
    }
  }
  static BASE_URL = 'https://api.openweathermap.org/data';
  static GEO_URL = 'https://api.openweathermap.org/geo/1.0/direct';
  static _geoCache = new Map();
  // Lightweight in‑memory weather cache to reduce latency & API hits
  // key: `${lat}|${lon}` -> { ts: epochMs, data }
  static _weatherCache = new Map();
  static WEATHER_TTL_MS = 10 * 60 * 1000; // 10 minutes

  static getApiKey() {
    const apiKey = EnvironmentConfig.getOpenWeatherApiKey() || 
                   EnvironmentConfig.getApiKeysFromMemory().openweather;
    
    if (!apiKey) {
      throw new Error('OpenWeather API key not configured');
    }
    
    return apiKey;
  }

  // Geocode a place name to coordinates (no hardcoded coordinates)
  static async geocodePlace(placeName) {
    if (!placeName || typeof placeName !== 'string') {
      return { success: false, error: 'No place name provided' };
    }

    const key = placeName.toLowerCase().trim();
    if (this._geoCache.has(key)) {
      return { success: true, ...this._geoCache.get(key) };
    }

    try {
      const apiKey = this.getApiKey();
      const response = await fetch(`${this.GEO_URL}?q=${encodeURIComponent(placeName)}&limit=1&appid=${apiKey}`);
      if (!response.ok) {
        return { success: false, error: `Geocoding failed: ${response.status}` };
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        return { success: false, error: 'Location not found' };
      }
      const { lat, lon, name, state, country } = data[0];
      const value = { lat, lon, name: name || placeName, state, country };
      this._geoCache.set(key, value);
      return { success: true, ...value };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Test if API key is working
  static async testApiKey() {
    try {
      const apiKey = this.getApiKey();
      const response = await fetch(
        `${this.BASE_URL}/2.5/weather?q=Delhi&appid=${apiKey}&units=metric`
      );
      
      if (response.status === 401) {
        return { valid: false, error: 'API key is invalid or expired' };
      } else if (response.status === 429) {
        return { valid: false, error: 'API key quota exceeded' };
      } else if (!response.ok) {
        return { valid: false, error: `API error: ${response.status}` };
      }
      
      return { valid: true, error: null };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Get comprehensive weather data for farming using free API
  static async getAgricultureWeather(lat, lon) {
    try {
      const cacheKey = `${lat}|${lon}`;
      const cached = this._weatherCache.get(cacheKey);
      if (cached && (Date.now() - cached.ts) < this.WEATHER_TTL_MS) {
        return cached.data; // already shaped object
      }
      const apiKey = this.getApiKey();
      
      // Use free 2.5 API endpoints instead of paid OneCall 3.0
      const [currentResponse, forecastResponse] = await Promise.all([
        fetch(`${this.BASE_URL}/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
        fetch(`${this.BASE_URL}/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`)
      ]);

      if (!currentResponse.ok) {
        throw new Error(`Weather API error: ${currentResponse.status}`);
      }
      
      if (!forecastResponse.ok) {
        throw new Error(`Forecast API error: ${forecastResponse.status}`);
      }

      const currentData = await currentResponse.json();
      const forecastData = await forecastResponse.json();
      
      // Transform free API data to match OneCall format
      const transformedData = {
        current: {
          temp: Math.round(currentData.main.temp), // Round to match WeatherCard
          humidity: currentData.main.humidity,
          wind_speed: currentData.wind.speed,
          weather: currentData.weather,
          dt: currentData.dt
        },
        hourly: forecastData.list.slice(0, 24).map(item => ({
          dt: item.dt,
          temp: Math.round(item.main.temp), // Round to match WeatherCard
          humidity: item.main.humidity,
          wind_speed: item.wind.speed,
          weather: item.weather,
          rain: item.rain
        })),
        daily: this.groupForecastByDay(forecastData.list).slice(0, 7),
        alerts: [] // Free API doesn't include alerts
      };
      
      const shaped = {
        success: true,
        current: transformedData.current,
        hourly: transformedData.hourly,
        daily: transformedData.daily,
        alerts: transformedData.alerts,
        location: { lat, lon }
      };
      // store in cache
      this._weatherCache.set(cacheKey, { ts: Date.now(), data: shaped });
      return shaped;
    } catch (error) {
      console.error('Weather Tools API error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Calculate irrigation recommendations
  static async getIrrigationAdvice(lat, lon, cropType, soilType = 'loam') {
    try {
      const weatherData = await this.getAgricultureWeather(lat, lon);
      
      if (!weatherData.success) {
        throw new Error('Failed to get weather data');
      }

      const { current, daily } = weatherData;
      
      // Calculate ET0 (Reference Evapotranspiration) - simplified
      const temperature = current.temp;
      const humidity = current.humidity;
      const windSpeed = current.wind_speed;
      
      // Simplified Penman-Monteith equation
      const et0 = this.calculateET0(temperature, humidity, windSpeed);
      
      // Crop coefficient (Kc) - simplified values
      const cropCoefficients = {
        wheat: 1.15,
        rice: 1.20,
        cotton: 1.15,
        sugarcane: 1.25,
        tomato: 1.15,
        potato: 1.15,
        maize: 1.20,
        default: 1.10
      };
      
      const kc = cropCoefficients[cropType?.toLowerCase()] || cropCoefficients.default;
      
      // Calculate crop water requirement
      const cropET = et0 * kc;
      
      // Check upcoming rainfall
      const upcomingRain = daily.slice(0, 3).reduce((total, day) => {
        return total + (day.rain?.['1h'] || 0);
      }, 0);
      
      // Soil water holding capacity (simplified)
      const soilCapacity = {
        sandy: 25,    // mm
        loam: 50,     // mm  
        clay: 75,     // mm
        default: 50
      };
      
      const waterHoldingCapacity = soilCapacity[soilType] || soilCapacity.default;
      
      // Generate irrigation recommendation
      const recommendation = this.generateIrrigationRecommendation(
        cropET, 
        upcomingRain, 
        waterHoldingCapacity,
        current.temp,
        current.humidity
      );

      return {
        success: true,
        recommendation,
        data: {
          et0: Math.round(et0 * 100) / 100,
          cropET: Math.round(cropET * 100) / 100,
          upcomingRain: Math.round(upcomingRain * 100) / 100,
          soilCapacity: waterHoldingCapacity,
          temperature: current.temp,
          humidity: current.humidity
        }
      };

    } catch (error) {
      console.error('Irrigation advice error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get weather alerts for farming
  static async getFarmingAlerts(lat, lon, crops = []) {
    try {
      const weatherData = await this.getAgricultureWeather(lat, lon);
      
      if (!weatherData.success) {
        throw new Error('Failed to get weather data');
      }

      const { current, daily, alerts } = weatherData;
      const farmingAlerts = [];

      // Process official weather alerts
      if (alerts && alerts.length > 0) {
        alerts.forEach(alert => {
          farmingAlerts.push({
            type: 'official',
            severity: alert.severity,
            title: alert.event,
            description: alert.description,
            start: new Date(alert.start * 1000),
            end: new Date(alert.end * 1000),
            farmingImpact: this.getFarmingImpact(alert.event, crops)
          });
        });
      }

      // Generate custom farming alerts
      const customAlerts = this.generateCustomFarmingAlerts(current, daily, crops);
      farmingAlerts.push(...customAlerts);

      return {
        success: true,
        alerts: farmingAlerts,
        summary: this.generateAlertSummary(farmingAlerts)
      };

    } catch (error) {
      console.error('Farming alerts error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper methods
  static calculateET0(temp, humidity, windSpeed) {
    // Simplified ET0 calculation (Hargreaves method)
    const tempRange = 10; // Assumed temperature range
    return 0.0023 * (temp + 17.8) * Math.sqrt(tempRange) * 0.408;
  }


  static generateCustomFarmingAlerts(current, daily, crops) {
    const alerts = [];
    
    // High temperature alert
    if (current.temp > 35) {
      alerts.push({
        type: 'custom',
        severity: 'warning',
        title: 'High Temperature Alert',
        description: `Temperature is ${current.temp}°C. Protect crops from heat stress.`,
        farmingImpact: 'Increase irrigation frequency, provide shade for sensitive crops'
      });
    }

    // Low humidity alert
    if (current.humidity < 30) {
      alerts.push({
        type: 'custom',
        severity: 'advisory',
        title: 'Low Humidity Alert',
        description: `Humidity is ${current.humidity}%. Monitor crop water stress.`,
        farmingImpact: 'Increase irrigation, consider mulching'
      });
    }

    // Frost warning
    const tomorrowMin = daily[1]?.temp?.min;
    if (tomorrowMin && tomorrowMin < 5) {
      alerts.push({
        type: 'custom',
        severity: 'severe',
        title: 'Frost Warning',
        description: `Minimum temperature expected: ${tomorrowMin}°C`,
        farmingImpact: 'Cover sensitive crops, harvest mature produce'
      });
    }

    return alerts;
  }

  static getFarmingImpact(eventType, crops) {
    const impacts = {
      'thunderstorm': 'Secure loose structures, delay spraying operations',
      'rain': 'Postpone irrigation, protect harvested crops',
      'snow': 'Protect crops from cold damage, ensure livestock shelter',
      'wind': 'Secure tall crops, check greenhouse structures',
      'fog': 'Delay spraying, monitor for fungal diseases',
      'extreme temperature': 'Adjust irrigation schedule, protect sensitive crops'
    };

    return impacts[eventType.toLowerCase()] || 'Monitor crops closely and take appropriate precautions';
  }

  static generateAlertSummary(alerts) {
    if (alerts.length === 0) {
      return 'No weather alerts. Conditions are favorable for farming activities.';
    }

    const severeAlerts = alerts.filter(a => a.severity === 'severe').length;
    const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
    
    if (severeAlerts > 0) {
      return `${severeAlerts} severe weather alert(s). Take immediate protective action.`;
    } else if (warningAlerts > 0) {
      return `${warningAlerts} weather warning(s). Monitor conditions closely.`;
    } else {
      return `${alerts.length} weather advisory(s). Plan farming activities accordingly.`;
    }
  }

  // Helper method to group 5-day forecast into daily data
  static groupForecastByDay(forecastList) {
    const dailyData = {};
    
    forecastList.forEach(item => {
      const date = new Date(item.dt * 1000).toDateString();
      
      if (!dailyData[date]) {
        dailyData[date] = {
          dt: item.dt,
          temp: { min: item.main.temp, max: item.main.temp },
          humidity: item.main.humidity,
          weather: item.weather,
          rain: item.rain || null,
          wind_speed: item.wind.speed
        };
      } else {
        // Update min/max temperatures
        dailyData[date].temp.min = Math.min(dailyData[date].temp.min, item.main.temp);
        dailyData[date].temp.max = Math.max(dailyData[date].temp.max, item.main.temp);
        
        // Accumulate rain if present
        if (item.rain && dailyData[date].rain) {
          dailyData[date].rain['1h'] = (dailyData[date].rain['1h'] || 0) + (item.rain['3h'] || 0);
        } else if (item.rain) {
          dailyData[date].rain = item.rain;
        }
      }
    });
    
    return Object.values(dailyData);
  }
}

export default WeatherToolsService;