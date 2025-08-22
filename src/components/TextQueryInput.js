import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { SarvamAIService } from '../services/SarvamAIService';
import HybridAIService from '../services/HybridAIService';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../localization/translations';

// Create instance of HybridAIService
const hybridAIService = new HybridAIService();

const TextQueryInput = ({ onResponse }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { t } = useTranslation(user?.language);

  const handleSubmit = async () => {
    if (!query.trim()) return;

    if (!SarvamAIService.isConfigured()) {
      Alert.alert(t('serviceUnavailable'), t('aiFeaturesAvailable'));
      return;
    }

    try {
      setIsLoading(true);

      const userLanguage = SarvamAIService.LANGUAGES[user?.language] || 'en-IN';
      const userContext = {
        crops: user?.crops || [],
        farmSize: user?.farmSize,
        experience: user?.experience
      };
      
      const result = await hybridAIService.getFarmingAdvice(
        query.trim(),
        userLanguage,
        user?.location,
        userContext
      );

      if (result.success && onResponse) {
        onResponse({
          question: query.trim(),
          answer: result.advice,
          language: userLanguage,
          hasAudio: false
        });
        setQuery(''); // Clear input after successful submission
      } else {
        Alert.alert(t('error'), result.error || t('unknownError'));
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error processing text query:', error);
      setIsLoading(false);
      Alert.alert(t('error'), t('unknownError'));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder={t('typeQuestion')}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[styles.submitButton, (!query.trim() || isLoading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!query.trim() || isLoading}
        >
          <Ionicons
            name={isLoading ? "sync" : "send"}
            size={20}
            color={(!query.trim() || isLoading) ? colors.textSecondary : colors.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.1)',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    maxHeight: 100,
    paddingVertical: 8,
    paddingRight: 8,
  },
  submitButton: {
    padding: 8,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
});

export default TextQueryInput;