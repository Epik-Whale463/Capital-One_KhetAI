import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { SarvamAIService } from '../services/SarvamAIService';
import { AudioService } from '../services/AudioService';
import { useAuth } from '../context/AuthContext';





const AIResponseCard = ({ response, onTranslate }) => {
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
        <View style={styles.answerContainer}>
          <Text style={styles.answerText}>
            {response.answer}
          </Text>
        </View>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    fontStyle: 'italic',
    lineHeight: 22,
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
  answerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    minHeight: 60,
  },
  markdownContainer: {
    minWidth: '100%',
  },
  answerText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    fontWeight: '400',
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

// Markdown styles following the specified formatting rules
const markdownStyles = StyleSheet.create({
  // Body text
  body: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    fontWeight: '400',
  },

  // Headings - clear hierarchy
  heading1: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 20,
    marginBottom: 12,
    lineHeight: 32,
  },
  heading2: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 10,
    lineHeight: 28,
  },
  heading3: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 14,
    marginBottom: 8,
    lineHeight: 26,
  },
  heading4: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
    lineHeight: 24,
  },
  heading5: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
    marginBottom: 4,
    lineHeight: 22,
  },
  heading6: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 20,
  },

  // Paragraphs
  paragraph: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 12,
  },

  // Lists - unordered for general items, ordered only when rank/order matters
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  list_item: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 4,
  },

  // Emphasis - sparing use of bold, italics for emphasis
  strong: {
    fontWeight: '600',
    color: '#111827',
  },
  em: {
    fontStyle: 'italic',
    color: '#374151',
  },

  // Code blocks with syntax highlighting
  code_inline: {
    backgroundColor: '#F3F4F6',
    color: '#DC2626',
    fontSize: 14,
    fontFamily: 'monospace',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: '#F9FAFB',
    color: '#374151',
    fontSize: 14,
    fontFamily: 'monospace',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  fence: {
    backgroundColor: '#F9FAFB',
    color: '#374151',
    fontSize: 14,
    fontFamily: 'monospace',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },

  // Tables - for comparisons and structured data, no bold inside tables
  table: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginVertical: 12,
    overflow: 'hidden',
  },
  thead: {
    backgroundColor: '#F9FAFB',
  },
  tbody: {
    backgroundColor: '#FFFFFF',
  },
  th: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  td: {
    fontSize: 14,
    color: '#374151',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  tr: {
    flexDirection: 'row',
  },

  // Blockquotes
  blockquote: {
    backgroundColor: '#F9FAFB',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingLeft: 16,
    paddingVertical: 12,
    marginVertical: 8,
    fontStyle: 'italic',
  },

  // Horizontal rules
  hr: {
    backgroundColor: '#E5E7EB',
    height: 1,
    marginVertical: 16,
  },

  // Links
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },

  // Images
  image: {
    marginVertical: 8,
    borderRadius: 8,
  },

  // Text styling
  text: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
});

export default AIResponseCard;