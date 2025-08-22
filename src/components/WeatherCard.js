import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../localization/translations';
import WeatherToolsService from '../services/WeatherToolsService';

const WeatherCard = () => {
  const { user } = useAuth();
  const { t } = useTranslation(user?.language);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  useEffect(() => {
    fetchWeatherData();
  }, [user?.coordinates]);

  const fetchWeatherData = async () => {
    try {
      setLoading(true);
      setError(null);

      const coords = user?.coordinates;
      if (!coords) {
        setError('Location unavailable');
        setLoading(false);
        return;
      }

      const apiResult = await WeatherToolsService.getAgricultureWeather(
        coords.latitude,
        coords.longitude
      );

      if (!apiResult.success) {
        throw new Error(apiResult.error || 'Weather fetch failed');
      }

      const current = apiResult.current;
      const conditionMain = current.weather?.[0]?.main || 'Unknown';

      const weatherData = {
        location: user?.location || 'Unknown',
        temperature: current.temp,
        condition: conditionMain,
        humidity: current.humidity,
        windSpeed: Math.round(current.wind_speed * 3.6),
        icon: current.weather?.[0]?.icon || 'partly-sunny',
        needsAI: false
      };

      setWeather(weatherData);
      await getWeatherBasedAdvice(weatherData);
      setLoading(false);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError(err.message || 'Failed to fetch weather data');
      setLoading(false);
    }
  };

  const getWeatherBasedAdvice = async (weatherData) => {
    try {
      setLoadingAdvice(true);
      
      // Use real weather tools service for irrigation advice
      const WeatherToolsService = (await import('../services/WeatherToolsService')).default;
      
      if (user?.coordinates) {
        const { latitude, longitude } = user.coordinates;
        const cropType = user?.crops?.[0] || 'wheat';
        
        const advice = await WeatherToolsService.getIrrigationAdvice(
          latitude, 
          longitude, 
          cropType, 
          'loam'
        );
        
        if (advice.success) {
          setAiAdvice({
            analysis: advice.recommendation.message,
            source: 'weather-tools-service',
            data: advice.data
          });
        } else {
          throw new Error(advice.error);
        }
      } else {
        // If no coordinates, get weather alerts based on location
        const alerts = await WeatherToolsService.getFarmingAlerts(28.6139, 77.2090, user?.crops || []);
        if (alerts.success) {
          setAiAdvice({
            analysis: alerts.summary,
            source: 'weather-alerts-service'
          });
        } else {
          throw new Error(alerts.error);
        }
      }
    } catch (error) {
      console.error('Error getting weather advice:', error);
  setAiAdvice(null);
    } finally {
      setLoadingAdvice(false);
    }
  };

  const getWeatherIcon = (condition) => {
    switch (condition?.toLowerCase()) {
      case 'sunny':
      case 'clear':
        return 'sunny';
      case 'partly cloudy':
        return 'partly-sunny';
      case 'cloudy':
        return 'cloudy';
      case 'rain':
      case 'light rain':
        return 'rainy';
      default:
        return 'partly-sunny';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline" size={48} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchWeatherData}>
            <Text style={styles.retryText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="partly-sunny" size={20} color={colors.primary} />
          <Text style={styles.title}>{t('weather')}</Text>
          {weather?.needsAI && (
            <View style={styles.aiTag}>
              <Text style={styles.aiTagText}>{t('needsAI')}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={fetchWeatherData}>
          <Ionicons name="refresh" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weatherContent}>
        <View style={styles.mainWeather}>
          <View style={styles.temperatureContainer}>
            <Ionicons
              name={getWeatherIcon(weather?.condition)}
              size={48}
              color={colors.secondary}
            />
            <Text style={styles.temperature}>{weather?.temperature}°C</Text>
          </View>
          <View style={styles.weatherDetails}>
            <Text style={styles.condition}>{weather?.condition}</Text>
            <Text style={styles.location}>{weather?.location}</Text>
          </View>
        </View>

        <View style={styles.weatherStats}>
          <View style={styles.statItem}>
            <Ionicons name="water" size={16} color={colors.info} />
            <Text style={styles.statLabel}>{t('humidity')}</Text>
            <Text style={styles.statValue}>{weather?.humidity}%</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="leaf" size={16} color={colors.success} />
            <Text style={styles.statLabel}>{t('windSpeed')}</Text>
            <Text style={styles.statValue}>{weather?.windSpeed} km/h</Text>
          </View>
        </View>
      </View>

      {/* AI-Powered Farming Advice */}
      <View style={styles.farmingTip}>
  <Ionicons name={aiAdvice?.source === 'groq-weather-agent' ? 'hardware-chip' : 'bulb'} size={16} color={colors.warning} />
        <View style={styles.tipContent}>
          {loadingAdvice ? (
            <Text style={styles.tipText}>{t('processing')}</Text>
          ) : aiAdvice ? (
            <>
              <Text style={styles.tipText}>
                {aiAdvice.analysis || aiAdvice.recommendations?.join('. ') || 'AI analysis complete'}
              </Text>
              {aiAdvice.source === 'groq-weather-agent' && (
                <Text style={styles.aiSourceText}>🤖 Powered by Groq AI</Text>
              )}
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  aiTag: {
    backgroundColor: colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  aiTagText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    color: colors.textSecondary,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    color: colors.danger,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  weatherContent: {
    marginBottom: 16,
  },
  mainWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  temperatureContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  temperature: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 4,
  },
  weatherDetails: {
    flex: 1,
  },
  condition: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  weatherStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  farmingTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 202, 58, 0.1)',
    padding: 12,
    borderRadius: 8,
  },
  tipContent: {
    flex: 1,
    marginLeft: 8,
  },
  tipText: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  aiSourceText: {
    fontSize: 10,
    color: colors.success,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default WeatherCard;