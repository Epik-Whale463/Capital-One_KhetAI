import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { SarvamAIService } from '../services/SarvamAIService';
import { AudioService } from '../services/AudioService';
import { useAuth } from '../context/AuthContext';

const AIResponseCard = ({ response, onTranslate, onSpeak }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const { user } = useAuth();

  const handleSpeak = async () => {
    if (!response.answer) return;

    try {
      setIsPlaying(true);
      
      const userLanguage = SarvamAIService.LANGUAGES[user?.language] || 'en-IN';
      const ttsResult = await SarvamAIService.textToSpeech(
        response.answer,
        userLanguage,
        'meera'
      );

      if (ttsResult.success) {
        await AudioService.playAudio(ttsResult.audioUrl);
      }
      
      setIsPlaying(false);
    } catch (error) {
      console.error('Error speaking response:', error);
      setIsPlaying(false);
    }
  };

  const handleTranslate = async (targetLanguage) => {
    if (!response.answer || isTranslating) return;

    try {
      setIsTranslating(true);
      
      const targetLangCode = SarvamAIService.LANGUAGES[targetLanguage];
      const translateResult = await SarvamAIService.translateText(
        response.answer,
        'auto',
        targetLangCode
      );

      if (translateResult.success && onTranslate) {
        const translatedResponse = {
          ...response,
          answer: translateResult.translatedText,
          translatedTo: targetLanguage,
          originalAnswer: response.answer
        };
        onTranslate(translatedResponse, response); // Pass both translated and original
      }
      
      setIsTranslating(false);
    } catch (error) {
      console.error('Error translating response:', error);
      setIsTranslating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(response.answer);
      Alert.alert('Copied!', 'Response copied to clipboard');
    } catch (error) {
      console.error('Copy error:', error);
      Alert.alert('Error', 'Failed to copy text');
    }
  };

  const getLanguageOptions = () => {
    const currentLang = user?.language || 'english';
    return ['english', 'hindi', 'telugu'].filter(lang => lang !== currentLang);
  };

  return (
    <View style={styles.container}>
      {/* Question */}
      <View style={styles.questionSection}>
        <View style={styles.questionHeader}>
          <Ionicons name="person" size={16} color={colors.primary} />
          <Text style={styles.questionLabel}>Your Question</Text>
        </View>
        <Text style={styles.questionText}>{response.question}</Text>
      </View>

      {/* Answer */}
      <View style={styles.answerSection}>
        <View style={styles.answerHeader}>
          <Ionicons name="leaf" size={16} color={colors.success} />
          <Text style={styles.answerLabel}>Khet AI</Text>
          {response.translatedTo && (
            <Text style={styles.translatedLabel}>
              (Translated to {response.translatedTo})
            </Text>
          )}
        </View>
        <ScrollView 
          style={styles.answerScrollView} 
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          contentContainerStyle={styles.answerScrollContent}
          horizontal={true}
        >
          <View style={{ minWidth: '100%' }}>
            <Markdown style={markdownStyles}>
              {response.answer}
            </Markdown>
          </View>
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {/* Speak Button */}
        <TouchableOpacity 
          style={[styles.actionButton, isPlaying && styles.actionButtonActive]}
          onPress={handleSpeak}
          disabled={isPlaying}
        >
          <Ionicons 
            name={isPlaying ? "volume-high" : "volume-medium"} 
            size={16} 
            color={isPlaying ? colors.success : colors.textSecondary} 
          />
          <Text style={[styles.actionButtonText, isPlaying && styles.actionButtonTextActive]}>
            {isPlaying ? 'Speaking...' : 'Speak'}
          </Text>
        </TouchableOpacity>

        {/* Translation Buttons */}
        {getLanguageOptions().map((language) => (
          <TouchableOpacity
            key={language}
            style={[styles.actionButton, isTranslating && styles.actionButtonDisabled]}
            onPress={() => handleTranslate(language)}
            disabled={isTranslating}
          >
            <Ionicons name="language" size={16} color={colors.textSecondary} />
            <Text style={styles.actionButtonText}>
              {language === 'hindi' ? 'हिंदी' : language === 'telugu' ? 'తెలుగు' : 'English'}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Copy Button */}
        <TouchableOpacity style={styles.actionButton} onPress={() => handleCopy()}>
          <Ionicons name="copy" size={16} color={colors.textSecondary} />
          <Text style={styles.actionButtonText}>Copy</Text>
        </TouchableOpacity>
      </View>

      {/* Metadata */}
      <View style={styles.metadata}>
        <Text style={styles.metadataText}>
          {response.language && `Detected: ${response.language} • `}
          {new Date().toLocaleTimeString()}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  questionSection: {
    marginBottom: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 6,
  },
  questionText: {
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 12,
    fontStyle: 'italic',
  },
  answerSection: {
    marginBottom: 16,
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
    marginLeft: 6,
  },
  translatedLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  answerScrollView: {
    maxHeight: 300,
    minHeight: 60,
  },
  answerScrollContent: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  answerText: {
    fontSize: 11, // Further reduced font size for better compactness
    color: colors.textPrimary,
    lineHeight: 16, // Slightly reduced line height
    backgroundColor: '#F8FDF8',
    padding: 16,
    borderRadius: 12,
    wordWrap: 'break-word',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 246, 240, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.1)',
  },
  actionButtonActive: {
    backgroundColor: 'rgba(87, 204, 153, 0.1)',
    borderColor: colors.success,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
    fontWeight: '500',
  },
  actionButtonTextActive: {
    color: colors.success,
  },
  metadata: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    paddingTop: 8,
  },
  metadataText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

const markdownStyles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    marginVertical: 8,
    backgroundColor: '#FFF',
    minWidth: 350,
    overflow: 'hidden',
  },
  thead: {
    backgroundColor: '#F8F8F8',
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  th: {
    fontWeight: 'bold',
    fontSize: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
    textAlign: 'center',
    color: colors.primary,
    backgroundColor: '#F8F8F8',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    minWidth: 60,
    maxWidth: 120,
    flexShrink: 1,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  td: {
    fontSize: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
    textAlign: 'center',
    color: colors.textPrimary,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    minWidth: 60,
    maxWidth: 120,
    flexShrink: 1,
    flexWrap: 'nowrap',
    overflow: 'hidden',
    wordBreak: 'keep-all',
  },
  body: {
    fontSize: 12, // Reduced font size for markdown body
    color: colors.textPrimary,
    lineHeight: 18,
  },
  heading1: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.primary,
    marginVertical: 8,
  },
  heading2: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.primary,
    marginVertical: 6,
  },
  heading3: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginVertical: 4,
  },
  strong: {
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  em: {
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  list_item: {
    marginVertical: 2,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  code_inline: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 14,
  },
  fence: {
    backgroundColor: '#F8F8F8',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    fontFamily: 'monospace',
    fontSize: 14,
  },
  blockquote: {
    backgroundColor: '#F0F9FF',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
    fontStyle: 'italic',
  },
});

export default AIResponseCard;