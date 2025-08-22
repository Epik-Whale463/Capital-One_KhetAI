import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { LocationService } from '../services/LocationService';
import { SarvamAIService } from '../services/SarvamAIService';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '../localization/translations';

import WeatherCard from '../components/WeatherCard';
import FarmerCropProjectsService from '../services/FarmerCropProjectsService';
import WeatherToolsService from '../services/WeatherToolsService'; // still used by WeatherCard
import NextActionService from '../services/NextActionService';
import AlertGeneratorService from '../services/AlertGeneratorService';
import SmartAlerts from '../components/SmartAlerts';
import FarmStatusOverview from '../components/FarmStatusOverview';

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, updateLocation, updateUser } = useAuth();
  const { getRecentConversations } = useChat();
  const navigation = useNavigation();
  const [notificationCount, setNotificationCount] = useState(0);
  const { t } = useTranslation(user?.language);
  const [nextAction, setNextAction] = useState({ text: 'Analyzing...', loading: true });

  const computeNextAction = async () => {
    setNextAction(prev => ({ ...prev, loading: true }));
    // Refresh alerts based on latest weather & tasks before computing
    try {
      await AlertGeneratorService.refreshAlerts(user?.id, user?.coordinates);
    } catch (e) { /* non-blocking */ }
    const result = await NextActionService.computeGlobalNextAction(user?.id, user?.coordinates);
    setNextAction(result);
  };

  React.useEffect(() => {
    loadNotificationCount();
    if (SarvamAIService.isConfigured()) {
      SarvamAIService.testConnection();
    }
    computeNextAction();
  }, [user?.id, user?.coordinates, user?.language]);

  const loadNotificationCount = async () => {
    try {
      // Count unread alerts and messages using the chat context already available
      const recentChats = getRecentConversations(10);
  const unreadCount = recentChats.filter(chat => !chat.read).length;
  setNotificationCount(unreadCount);
    } catch (error) {
      console.error('Error loading notifications:', error);
  setNotificationCount(0);
    }
  };

  const handleLocationRefresh = async () => {
    const result = await updateLocation();
    if (result.success) {
      // Could show a toast or brief success message
      console.log('Location updated:', result.location);
    }
  };

  const getLocationEmoji = () => {
    if (user?.location) {
      const state = user.location.split(',').pop()?.trim();
      return LocationService.getLocationEmoji(state);
    }
    return '📍';
  };

  const getLanguageCode = (language) => {
    switch (language) {
      case 'hindi': return 'HI';
      case 'telugu': return 'TE';
      case 'english':
      default: return 'EN';
    }
  };

  const handleLanguageChange = () => {
    const languages = [
      { code: 'english', name: 'English', native: 'English' },
      { code: 'hindi', name: 'Hindi', native: 'हिंदी' },
      { code: 'telugu', name: 'Telugu', native: 'తెలుగు' }
    ];

    const currentIndex = languages.findIndex(lang => lang.code === user?.language);
    const nextIndex = (currentIndex + 1) % languages.length;
    const nextLanguage = languages[nextIndex];

    updateUser({ language: nextLanguage.code });
  };



  // Chat text input removed as per user request; rapid chat entry deprecated.

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.farmInfo}>
            <Text style={styles.farmName}>{user?.name}{t('farmTitle')}</Text>
            <TouchableOpacity onPress={handleLocationRefresh} style={styles.locationContainer}>
              <Text style={styles.farmLocation}>
                {getLocationEmoji()} {user?.location || t('defaultCountry')}
              </Text>
              <Ionicons name="refresh" size={12} color={colors.textSecondary} style={styles.refreshIcon} />
            </TouchableOpacity>
          </View>
          <View style={styles.topBarActions}>
            <TouchableOpacity style={styles.languageButton} onPress={handleLanguageChange}>
              <Text style={styles.languageText}>{getLanguageCode(user?.language)}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.notificationButton} onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="notifications" size={24} color={colors.primary} />
        {notificationCount > 0 && (
                <View style={styles.notificationBadge}>
          <Text style={styles.badgeText}>{notificationCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom, paddingHorizontal: 16 }]}
        >
          {/* Next Action Strip (dynamic) */}
          <View style={[styles.section, styles.nextActionSection]}>
            <View style={styles.nextActionRow}>
              <Ionicons name="flash" size={18} color={colors.primary} />
              <View style={styles.nextActionTextWrap}>
                <Text style={styles.nextActionLabel}>Next Action</Text>
                <Text style={styles.nextActionText} numberOfLines={3}>
                  {nextAction.loading ? 'Analyzing current crops & weather...' : nextAction.text}
                </Text>
              </View>
              <TouchableOpacity style={styles.refreshMini} onPress={computeNextAction}>
                <Ionicons name="refresh" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Weather Card (compact) */}
          <View style={styles.section}>
            <WeatherCard />
          </View>

          {/* Chat text input removed */}

          {/* Smart Alerts */}
          <View style={styles.section}>
            <SmartAlerts />
          </View>

          {/* Farm Status Overview */}
          <View style={styles.section}>
            <FarmStatusOverview />
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? 16 : 12,
    backgroundColor: 'rgba(248, 246, 240, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 202, 58, 0.1)',
  },
  farmInfo: {
    flex: 1,
  },
  farmName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  farmLocation: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  refreshIcon: {
    marginLeft: 4,
    opacity: 0.7,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  languageText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
    marginRight: 4,
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // paddingBottom will be set dynamically using insets
  },
  section: {
    marginBottom: 16,
    backgroundColor: colors.cardBackground,
    borderRadius: 16, // slightly larger for softer cards
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  nextActionSection: {
    padding: 12,
  },
  nextActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextActionTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  nextActionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  nextActionText: {
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 2,
    lineHeight: 18,
  },
  refreshMini: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)'
  },
  bottomSpacing: {
    height: 30,
  },
});

export default HomeScreen;