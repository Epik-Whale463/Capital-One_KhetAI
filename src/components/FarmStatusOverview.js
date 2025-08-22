import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { spacing, radius } from '../styles/layout';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../localization/translations';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FarmerCropProjectsService from '../services/FarmerCropProjectsService';
import WeatherToolsService from '../services/WeatherToolsService';
import NextActionService from '../services/NextActionService';
import { LocationService } from '../services/LocationService';

const { width } = Dimensions.get('window');

const FarmStatusOverview = () => {
  const { user } = useAuth();
  const { t } = useTranslation(user?.language);
  const [farmData, setFarmData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState(null);
  const [nextAction, setNextAction] = useState(null);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      loadFarmData();
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [user?.id]);

  // Periodic refresh (5 min) for near real-time updates without push infra
  useEffect(() => {
    if (farmData && !refreshTimerRef.current) {
      refreshTimerRef.current = setInterval(() => {
        loadFarmData({ silent: true });
      }, 5 * 60 * 1000);
    }
  }, [farmData]);

  const loadFarmData = async ({ silent = false } = {}) => {
    if (!user?.id) return;
    try {
      if (!silent) setLoading(true);

      // 1. Load all crop projects for farmer (authoritative crop context)
      const projects = await FarmerCropProjectsService.getFarmerProjects(user.id);

      // 2. Derive aggregate stats from real project data
      const activeProjects = projects.filter(p => p.status === 'active');
      const totalArea = activeProjects.reduce((sum, p) => sum + (p.cropDetails?.area || 0), 0);
      const crops = activeProjects.map(p => p.cropName);

      // Crop health heuristic: completeness of mandatory detail fields
      const REQUIRED_FIELDS = ['variety','area','plantingDate','expectedHarvest','growthStage'];
      let completenessSum = 0;
      activeProjects.forEach(p => {
        const d = p.cropDetails || {};
        const filled = REQUIRED_FIELDS.filter(f => d[f]).length;
        completenessSum += (filled / REQUIRED_FIELDS.length);
      });
      const cropHealthPct = activeProjects.length ? Math.round((completenessSum / activeProjects.length) * 100) : 0;

      // 3. Weather (live) based on current coordinates
      let coordinates = user.coordinates;
      if (!coordinates) {
        // get fresh location only if not stored already
        const loc = await LocationService.getLocationWithAddress();
        if (loc?.coordinates) coordinates = loc.coordinates;
      }
      let weatherData = null;
      if (coordinates?.latitude && coordinates?.longitude) {
        const w = await WeatherToolsService.getAgricultureWeather(coordinates.latitude, coordinates.longitude);
        if (w?.success) {
          weatherData = w;
          setWeather(w);
        }
      }

      // 4. Dynamic irrigation & pest inference (no placeholders)
      let irrigationStatus = null;
      let pestRisk = null;
      if (weatherData?.current) {
        const { humidity, temp } = weatherData.current;
        if (humidity < 45) irrigationStatus = 'needed';
        else if (humidity > 80 && temp > 20) irrigationStatus = 'defer';
        if (humidity > 85 && temp > 24) pestRisk = 'high';
        else if (humidity > 70) pestRisk = 'medium';
        else pestRisk = 'low';
      }

      // 5. Recent activities derived from project history (conversation + tasks + updates)
      const activities = [];
      activeProjects.forEach(p => {
        if (p.aiContext?.conversationHistory?.length) {
          const first = p.aiContext.conversationHistory[0];
          activities.push({ id: `${p.id}_conv`, activity: `Chat: ${p.cropName}`, date: new Date(first.timestamp).toLocaleDateString() });
        }
        if (p.workflows?.tasks?.length) {
          const recentTask = p.workflows.tasks.find(t => t.status !== 'completed');
          if (recentTask) activities.push({ id: `${p.id}_task`, activity: `Task: ${recentTask.label} (${p.cropName})`, date: new Date(recentTask.createdAt).toLocaleDateString() });
        }
      });
      activities.sort((a,b)=> a.date < b.date ? 1 : -1);
      const limitedActivities = activities.slice(0,5);

      // 6. Compute next action using service
      const next = await NextActionService.computeGlobalNextAction(user.id, coordinates);
      setNextAction(next);

      const merged = {
        totalArea,
        crops,
        currentSeason: getCurrentSeason(),
        lastUpdated: new Date().toISOString(),
        stats: {
          cropHealth: cropHealthPct,
          soilMoisture: null, // no sensor data integration yet (left null intentionally)
          irrigationStatus,
          pestRisk,
          expectedYield: null
        },
        activities: limitedActivities,
        needsAI: false,
        projectCount: activeProjects.length
      };
      setFarmData(merged);
    } catch (error) {
      console.error('Error loading farm data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const getCurrentSeason = () => {
    const month = new Date().getMonth() + 1;
    if (month >= 4 && month <= 9) return 'Kharif';
    if (month >= 10 && month <= 3) return 'Rabi';
    return 'Summer';
  };

  // Removed random mock activity generator

  const getHealthColor = (percentage) => {
    if (percentage == null) return colors.textSecondary;
    if (percentage >= 80) return colors.success;
    if (percentage >= 60) return colors.warning;
    return colors.danger;
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'low': return colors.success;
      case 'medium': return colors.warning;
      case 'high': return colors.danger;
      default: return colors.textSecondary;
    }
  };

  const updateFarmData = async (updates) => {
    try {
      const updatedData = { ...farmData, ...updates, lastUpdated: new Date().toISOString() };
      setFarmData(updatedData);
      await AsyncStorage.setItem(`farmData_${user?.id}`, JSON.stringify(updatedData));
    } catch (error) {
      console.error('Error updating farm data:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('farmStatus')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </View>
    );
  }

  if (!farmData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('farmStatus')}</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="leaf-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No farm data available</Text>
          <TouchableOpacity style={styles.setupButton} onPress={loadFarmData}>
            <Text style={styles.setupButtonText}>Setup Farm Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{t('farmStatus')}</Text>
          {farmData.needsAI && (
            <View style={styles.aiTag}>
              <Text style={styles.aiTagText}>{t('needsAI')}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={loadFarmData}>
          <Ionicons name="refresh" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.overviewCard}>
        <View style={styles.farmInfo}>
          {farmData.totalArea != null && (
            <View style={styles.farmStat}>
              <Text style={styles.statValue}>{farmData.totalArea}</Text>
              <Text style={styles.statLabel}>{t('areaUnitAcres')}</Text>
            </View>
          )}
          <View style={styles.farmStat}>
            <Text style={styles.statValue}>{farmData.crops.length}</Text>
            <Text style={styles.statLabel}>{t('myCrops')}</Text>
          </View>
          <View style={styles.farmStat}>
            <Text style={styles.statValue}>{farmData.currentSeason}</Text>
            <Text style={styles.statLabel}>{t('season') || 'Season'}</Text>
          </View>
        </View>

        {nextAction?.text && (
          <View style={styles.nextActionBar}>
            <Ionicons name="flash" size={16} color={colors.warning} />
            <Text style={styles.nextActionText}>{nextAction.text}</Text>
          </View>
        )}

        <View style={styles.healthMetrics}>
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Ionicons name="leaf" size={16} color={getHealthColor(farmData.stats.cropHealth)} />
              <Text style={styles.metricLabel}>{t('cropHealth')}</Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${farmData.stats.cropHealth}%`,
                    backgroundColor: getHealthColor(farmData.stats.cropHealth)
                  }
                ]} 
              />
            </View>
            <Text style={styles.metricValue}>{farmData.stats.cropHealth}%</Text>
          </View>

          {farmData.stats.soilMoisture != null && (
            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <Ionicons name="water" size={16} color={colors.info} />
                <Text style={styles.metricLabel}>{t('soilMoisture')}</Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${farmData.stats.soilMoisture}%`,
                      backgroundColor: colors.info
                    }
                  ]} 
                />
              </View>
              <Text style={styles.metricValue}>{farmData.stats.soilMoisture}%</Text>
            </View>
          )}
        </View>

        <View style={styles.statusRow}>
          {farmData.stats.irrigationStatus && (
            <View style={styles.statusItem}>
              <Ionicons name="water-outline" size={20} color={colors.tertiary} />
              <Text style={styles.statusLabel}>{t('irrigationLabel')}</Text>
              <Text style={[styles.statusValue, { color: colors.tertiary }]}>
                {farmData.stats.irrigationStatus}
              </Text>
            </View>
          )}
          {farmData.stats.pestRisk && (
            <View style={styles.statusItem}>
              <Ionicons name="bug-outline" size={20} color={getRiskColor(farmData.stats.pestRisk)} />
              <Text style={styles.statusLabel}>{t('pestRisk') || 'Pest Risk'}</Text>
              <Text style={[styles.statusValue, { color: getRiskColor(farmData.stats.pestRisk) }]}>
                {farmData.stats.pestRisk}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.recentActivities}>
          <Text style={styles.activitiesTitle}>{t('recentActivities') || 'Recent Activities'}</Text>
          {farmData.activities.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.activityText}>{activity.activity}</Text>
              <Text style={styles.activityDate}>{activity.date}</Text>
            </View>
          ))}
          {farmData.activities.length === 0 && (
            <Text style={styles.activityDate}>{t('noActivities') || 'No recent activities'}</Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, marginVertical: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.sm },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.2 },
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
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
  },
  emptyContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 16,
  },
  setupButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  setupButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  overviewCard: { backgroundColor: colors.cardBackground, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  nextActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,193,7,0.15)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  nextActionText: {
    marginLeft: 6,
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  farmInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' },
  farmStat: {
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  healthMetrics: { marginBottom: spacing.md },
  metricItem: { marginBottom: spacing.sm },
  metricHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  metricLabel: { fontSize: 13, color: colors.textPrimary, marginLeft: spacing.xs, flex: 1 },
  metricValue: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  progressBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, marginBottom: 4 },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  statusValue: { fontSize: 13, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  recentActivities: {
  },
  activitiesTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  activityItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  activityText: { fontSize: 12, color: colors.textPrimary, marginLeft: spacing.xs, flex: 1 },
  activityDate: { fontSize: 10, color: colors.textSecondary },
});

export default FarmStatusOverview;