import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../localization/translations';

const SettingsScreen = () => {
  const { user, logout, updateUser } = useAuth();
  const { t } = useTranslation(user?.language);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [notifications, setNotifications] = useState(user?.notifications !== false);
  const [voicePreference, setVoicePreference] = useState(user?.preferVoice !== false);

  const handleLogout = () => {
    Alert.alert(
      t('logout'),
      t('logoutConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('logout'), style: 'destructive', onPress: logout }
      ]
    );
  };

  const handleLanguageChange = async (language) => {
    try {
      const updatedUser = { ...user, language };
      await updateUser(updatedUser);
      setShowLanguageModal(false);
    } catch (error) {
      Alert.alert(t('error'), t('failedToUpdateSettings'));
    }
  };

  const handleNotificationToggle = async (value) => {
    try {
      setNotifications(value);
      const updatedUser = { ...user, notifications: value };
      await updateUser(updatedUser);
    } catch (error) {
      Alert.alert(t('error'), t('failedToUpdateSettings'));
      setNotifications(!value);
    }
  };

  const handleVoiceToggle = async (value) => {
    try {
      setVoicePreference(value);
      const updatedUser = { ...user, preferVoice: value };
      await updateUser(updatedUser);
    } catch (error) {
      Alert.alert(t('error'), t('failedToUpdateSettings'));
      setVoicePreference(!value);
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings')}</Text>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* User Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.name}</Text>
                <Text style={styles.profileMobile}>{user?.mobile}</Text>
                <Text style={styles.profileLocation}>📍 {user?.location}</Text>
              </View>
            </View>
          </View>

          {/* Demo/testing components removed for production build */}

          {/* Essential Farmer Settings Only */}
          <View style={styles.settingsSection}>
            <TouchableOpacity style={styles.settingItem} onPress={() => setShowLanguageModal(true)}>
              <Ionicons name="globe" size={24} color={colors.primary} />
              <Text style={styles.settingText}>{t('language')}</Text>
              <Text style={styles.settingValue}>
                {user?.language === 'hindi' ? t('languageHindiNative') : user?.language === 'telugu' ? t('languageTeluguNative') : t('languageEnglishNative')}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.settingItem}>
              <Ionicons name="mic" size={24} color={colors.primary} />
              <Text style={styles.settingText}>{t('voicePreferences')}</Text>
              <Switch
                value={voicePreference}
                onValueChange={handleVoiceToggle}
                trackColor={{ false: colors.textSecondary, true: colors.primary }}
                thumbColor={voicePreference ? colors.secondary : '#f4f3f4'}
              />
            </View>

            <View style={[styles.settingItem, styles.lastSettingItem]}>
              <Ionicons name="notifications" size={24} color={colors.primary} />
              <Text style={styles.settingText}>{t('notifications')}</Text>
              <Switch
                value={notifications}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: colors.textSecondary, true: colors.primary }}
                thumbColor={notifications ? colors.secondary : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color={colors.danger} />
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </TouchableOpacity>

          {/* Language Selection Modal */}
          <Modal
            visible={showLanguageModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowLanguageModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('selectLanguage')}</Text>
                
                {['english','hindi','telugu'].map(code => (
                  <TouchableOpacity
                    key={code}
                    style={[styles.languageOption, user?.language === code && styles.languageOptionSelected]}
                    onPress={() => handleLanguageChange(code)}
                  >
                    <Text style={[styles.languageText, user?.language === code && styles.languageTextSelected]}>
                      {code === 'english' && t('languageEnglishNative')}
                      {code === 'hindi' && t('languageHindiNative')}
                      {code === 'telugu' && t('languageTeluguNative')}
                    </Text>
                    {user?.language === code && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                ))}

                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={() => setShowLanguageModal(false)}
                >
                  <Text style={styles.modalCloseText}>{t('cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 202, 58, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  profileSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  profileMobile: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  profileLocation: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  settingsSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  lastSettingItem: {
    borderBottomWidth: 0,
  },
  settingText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    marginLeft: 12,
  },
  settingValue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 6,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.danger,
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  languageOptionSelected: {
    backgroundColor: 'rgba(45, 106, 79, 0.1)',
  },
  languageText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  languageTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalCloseText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});

export default SettingsScreen;