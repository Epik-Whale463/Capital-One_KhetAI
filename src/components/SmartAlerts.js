import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { spacing, radius } from '../styles/layout';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../localization/translations';
import AlertGeneratorService from '../services/AlertGeneratorService';
import FarmerCropProjectsService from '../services/FarmerCropProjectsService';
import { LocationService } from '../services/LocationService';

const SmartAlerts = () => {
  const { user } = useAuth();
  const { t } = useTranslation(user?.language);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      loadAlerts();
      if (!refreshTimerRef.current) {
        // Auto refresh every 6 minutes to balance freshness vs API usage
        refreshTimerRef.current = setInterval(() => loadAlerts({ silent: true }), 6 * 60 * 1000);
      }
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [user?.id]);

  const loadAlerts = async ({ silent = false } = {}) => {
    if (!user?.id) return;
    try {
      if (!silent) setLoading(true);

      // Ensure we have coordinates (use stored, else refresh once if absent)
      let coordinates = user.coordinates;
      if (!coordinates) {
        const loc = await LocationService.getLocationWithAddress();
        if (loc?.coordinates) coordinates = loc.coordinates;
      }

      // Refresh underlying per-project alerts (weather + state)
      await AlertGeneratorService.refreshAlerts(user.id, coordinates);

      // Pull projects and collect alerts directly from workflows (authoritative source)
      const projects = await FarmerCropProjectsService.getFarmerProjects(user.id);
      const active = projects.filter(p => p.status === 'active');
      const collected = [];
      active.forEach(p => {
        (p.workflows?.alerts || []).forEach(a => {
          if (!a || !a.severity) return; // strict: require real severity
          collected.push({
            id: a.id,
            projectId: p.id,
            cropName: p.cropName,
            type: a.type,
            severity: a.severity,
            message: a.message,
            aiSummary: a.aiSummary,
            createdAt: a.createdAt,
            key: a.key
          });
        });
      });

      // Sort newest first (by createdAt)
      collected.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));

      setAlerts(collected.slice(0,20));
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const dismissAlert = async (alert) => {
    try {
      if (!alert?.projectId) return;
      // Remove from project workflows and persist
      const project = (await FarmerCropProjectsService.getFarmerProjects(user.id)).find(p=> p.id === alert.projectId);
      if (!project) return;
      const currentAlerts = project.workflows?.alerts || [];
      const filtered = currentAlerts.filter(a => a.id !== alert.id);
      await FarmerCropProjectsService.updateProject(project.id, { workflows: { ...project.workflows, alerts: filtered } });
      setAlerts(prev => prev.filter(a => a.id !== alert.id));
    } catch (e) {
      console.error('Error dismissing alert:', e);
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'severe_weather': return 'warning';
      case 'disease_risk': return 'medkit';
      case 'task_overdue': return 'time';
      case 'rain_deficit': return 'water';
      case 'rain_excess': return 'rainy';
      case 'wind_risk': return 'flag';
      case 'sowing_window': return 'calendar';
      default: return 'information-circle';
    }
  };

  const severityColor = (severity) => {
    switch (severity) {
      case 'critical': return colors.danger;
      case 'high': return colors.warning;
      case 'medium': return colors.info;
      case 'low': return colors.textSecondary;
      default: return colors.textSecondary;
    }
  };

  const titleForType = (type) => {
    switch (type) {
      case 'severe_weather': return 'Severe Weather';
      case 'disease_risk': return 'Disease / Pest Risk';
      case 'task_overdue': return 'Task Overdue';
      case 'rain_deficit': return 'Rainfall Deficit';
      case 'rain_excess': return 'Heavy Rain';
      case 'wind_risk': return 'Wind Risk';
      case 'sowing_window': return 'Sowing Window';
      default: return ''; // no generic placeholder fallback
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('smartAlerts')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </View>
    );
  }

  if (alerts.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('smartAlerts')}</Text>
          <TouchableOpacity onPress={() => loadAlerts()}>
            <Ionicons name="refresh" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>0 alerts</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('smartAlerts')}</Text>
        <TouchableOpacity onPress={() => loadAlerts() }>
          <Ionicons name="refresh" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {alerts.map((alert) => (
          <View key={alert.id} style={[styles.alertCard, { borderLeftColor: severityColor(alert.severity) }] }>
            <View style={styles.alertHeader}>
              <View style={styles.alertIconContainer}>
                <Ionicons 
                  name={getAlertIcon(alert.type)} 
                  size={20} 
                  color={severityColor(alert.severity)} 
                />
                <View style={[styles.priorityDot, { backgroundColor: severityColor(alert.severity) }]} />
              </View>
              <TouchableOpacity onPress={() => dismissAlert(alert)}>
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.alertTitle}>
              {titleForType(alert.type) ? `${titleForType(alert.type)} - ${alert.cropName}` : alert.cropName}
            </Text>
            {alert.aiSummary ? (
              <Text style={styles.aiSummary}>{alert.aiSummary}</Text>
            ) : (
              <Text style={styles.aiSummaryFallback}>{alert.message.slice(0,80)}</Text>
            )}
            {!alert.aiSummary && (
              <Text style={styles.alertMessage}>{alert.message}</Text>
            )}
            <Text style={styles.alertTime}>
              {new Date(alert.createdAt).toLocaleString()}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, marginVertical: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  loadingContainer: { backgroundColor: colors.cardBackground, borderRadius: 12, padding: 20, alignItems: 'center' },
  loadingText: { color: colors.textSecondary },
  emptyContainer: { backgroundColor: colors.cardBackground, borderRadius: 12, padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.xs },
  alertCard: { backgroundColor: colors.cardBackground, borderRadius: radius.lg, padding: spacing.md, marginRight: spacing.md, width: 260, borderLeftWidth: 3, borderColor: 'rgba(0,0,0,0.06)' },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  alertIconContainer: { position: 'relative' },
  priorityDot: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4 },
  alertTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  aiSummary: { fontSize: 12, fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.xs, lineHeight: 16 },
  aiSummaryFallback: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.xs, lineHeight: 16 },
  alertMessage: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
  alertTime: { fontSize: 10, color: colors.textLight },
});

export default SmartAlerts;