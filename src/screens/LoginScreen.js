import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { LocationService } from '../services/LocationService';
import { useTranslation } from '../localization/translations';

const { width, height } = Dimensions.get('window');

const LoginScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState('english');
  const [preferVoice, setPreferVoice] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { login, register } = useAuth();
  const { t } = useTranslation(language);

  const handleLogin = async () => {
    if (!mobile || !password) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    setIsLoading(true);
    const result = await login(mobile, password);
    setIsLoading(false);

    if (!result.success) {
      Alert.alert(t('error'), result.error);
    }
  };

  const handleRegister = async () => {
    if (!name || !mobile || !password || !confirmPassword) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('error'), t('passwordsNotMatch'));
      return;
    }

    setIsLoading(true);

    const result = await register({
      name: name.trim(),
      mobile: mobile.trim(),
      password,
      language,
      preferVoice
    });

    setIsLoading(false);

    if (!result.success) {
      Alert.alert(t('error'), result.error);
    }
  };

  const toggleLanguage = () => {
    const languages = ['english', 'hindi', 'telugu'];
    const currentIndex = languages.indexOf(language);
    const nextIndex = (currentIndex + 1) % languages.length;
    setLanguage(languages[nextIndex]);
  };

  return (
    <LinearGradient
      colors={['#FFE066', '#87CEEB', '#F8F6F0']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🌾</Text>
              <Text style={styles.logoText}>{t('appName')}</Text>
            </View>
            
            <TouchableOpacity style={styles.languageToggle} onPress={toggleLanguage}>
              <Ionicons name="globe" size={16} color={colors.primary} />
              <Text style={styles.languageText}>{language === 'english' ? 'EN' : language === 'hindi' ? 'HI' : 'TE'}</Text>
            </TouchableOpacity>
          </View>

          {/* Welcome Text */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>{isLogin ? t('welcome') : t('createAccount')}</Text>
            <Text style={styles.welcomeSubtitle}>{t('tagline')}</Text>
          </View>

          {/* Login/Register Card */}
          <View style={styles.card}>
            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, isLogin && styles.activeTab]}
                onPress={() => setIsLogin(true)}
              >
                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>
                  {t('login')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, !isLogin && styles.activeTab]}
                onPress={() => setIsLogin(false)}
              >
                <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>
                  {t('register')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {!isLogin && (
                <View style={styles.inputContainer}>
                  <Ionicons name="person" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('name')}
                    value={name}
                    onChangeText={setName}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <Ionicons name="call" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('mobile')}
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('password')}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons 
                    name={showPassword ? "eye" : "eye-off"} 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>
              </View>

              {!isLogin && (
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('confirmPassword')}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              )}

              {!isLogin && (
                <View style={styles.preferenceContainer}>
                  <Text style={styles.preferenceLabel}>
                    {t('preferVoice')}
                  </Text>
                  <TouchableOpacity
                    style={[styles.toggle, preferVoice && styles.toggleActive]}
                    onPress={() => setPreferVoice(!preferVoice)}
                  >
                    <View style={[styles.toggleThumb, preferVoice && styles.toggleThumbActive]} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Action Button */}
              <TouchableOpacity
                style={[styles.actionButton, isLoading && styles.actionButtonDisabled]}
                onPress={isLogin ? handleLogin : handleRegister}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={[colors.primary, colors.tertiary]}
                  style={styles.actionButtonGradient}
                >
                  <Text style={styles.actionButtonText}>
                    {isLoading 
                      ? t('pleaseWait')
                      : isLogin 
                        ? t('login')
                        : t('createAccountButton')
                    }
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {isLogin && (
                <TouchableOpacity style={styles.forgotPassword}>
                  <Text style={styles.forgotPasswordText}>
                    {t('forgotPassword')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.privacyNote}>
                <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                <Text style={styles.privacyText}>
                  {t('dataSecure')}
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: width * 0.05, // 5% of screen width
    paddingVertical: height * 0.02, // 2% of screen height
    justifyContent: 'center',
    minHeight: height * 0.9, // Ensure minimum height
  },
  logoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: height * 0.025, // 2.5% of screen height
    paddingHorizontal: width * 0.02, // 2% of screen width
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: Math.min(width * 0.07, 28), // Responsive font size
    marginRight: 6,
  },
  logoText: {
    fontSize: Math.min(width * 0.05, 20), // Responsive font size
    fontWeight: 'bold',
    color: colors.primary,
  },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  languageText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: height * 0.025, // 2.5% of screen height
    paddingHorizontal: width * 0.05, // 5% of screen width
  },
  welcomeTitle: {
    fontSize: Math.min(width * 0.055, 22), // Responsive font size
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: Math.min(width * 0.035, 14), // Responsive font size
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: width * 0.8, // Limit width for better readability
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(248, 246, 240, 0.5)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  formContainer: {
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 246, 240, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.1)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  preferenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  preferenceLabel: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    maxWidth: '90%',
  },
  privacyText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default LoginScreen;