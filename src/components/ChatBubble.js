import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Markdown from 'react-native-markdown-display';
import { colors } from '../styles/colors';
import { AudioService } from '../services/AudioService';
import { SarvamAIService } from '../services/SarvamAIService';
import { useTranslation } from '../localization/translations';

const { width: screenWidth } = Dimensions.get('window');
// Fixed (but responsive) width applied to every bubble so they don't shrink/expand per content length
const FIXED_BUBBLE_WIDTH = Math.min(680, screenWidth * 0.88);

const ChatBubble = ({ message = {}, isUser = false, onUpdateMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [currentContent, setCurrentContent] = useState(message.answer || message.advice || '');
  const [currentLanguage, setCurrentLanguage] = useState(message.language || 'en-IN');
  const [showOriginal, setShowOriginal] = useState(false);
  const { t } = useTranslation(message.language || 'english');

  // Simplified - no complex animations that cause disappearing issues

  const handleSpeak = async () => {
    if (!currentContent) return;

    try {
      setIsPlaying(true);
      const ttsResult = await SarvamAIService.textToSpeech(
        currentContent,
        currentLanguage,
        'meera'
      );

      if (ttsResult.success && ttsResult.audioBlob) {
        try {
          // Create a proper blob URL for React Native
          const audioUrl = `data:audio/wav;base64,${await blobToBase64(ttsResult.audioBlob)}`;
          await AudioService.playAudio(audioUrl);
        } catch (audioError) {
          console.warn('Audio playback not supported on this device:', audioError.message);
          // Show user-friendly message instead of crashing
          alert(t('audioNotSupported'));
        }
      } else {
        alert(`${t('speechFailed')}: ${ttsResult.error || t('unknownError')}`);
      }
      setIsPlaying(false);
    } catch (error) {
      console.error('Error speaking:', error);
      alert(`${t('speechError')}: ${error.message}`);
      setIsPlaying(false);
    }
  };

  // Helper function to convert blob to base64
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleTranslate = async (targetLanguage) => {
    if (isTranslating || !currentContent) return;
    
    setIsTranslating(true);
    try {
      console.log('Translating to:', targetLanguage);
      
      const targetLangCode = SarvamAIService.LANGUAGES[targetLanguage];
      const result = await SarvamAIService.translateText(
        currentContent,
        'auto',
        targetLangCode
      );

      if (result.success) {
        // Update the content in place instead of creating new message
        setCurrentContent(result.translatedText);
        setCurrentLanguage(targetLangCode);
        
        // Optionally update the message in the parent component
        if (onUpdateMessage) {
          onUpdateMessage(message.id, {
            ...message,
            answer: result.translatedText,
            language: targetLangCode,
            translatedTo: targetLanguage
          });
        }
      } else {
        alert(`${t('translationFailed')}: ${result.error || t('unknownError')}`);
      }
    } catch (error) {
      console.error('Translation error:', error);
      alert(`${t('translationError')}: ${error.message}`);
    }
    setIsTranslating(false);
    setShowActions(false);
  };

  const getFollowUpSuggestions = () => {
    // Use existing suggestion translation keys
    return [
      t('weatherForecast') || 'Weather forecast',
      t('marketPrices') || 'Market prices',
      t('pestControl') || 'Pest control',
      t('irrigation') || 'Irrigation',
      t('fertilizer') || 'Fertilizer'
    ].slice(0,3);
  };

  // Standardized layout: consistent structure for user & AI
  const displayText = isUser
    ? (message.question || message.answer || message.text || '')
    : (showOriginal && message.originalEnglish
        ? message.originalEnglish
        : currentContent || message.answer || message.advice || message.text || '');

  return (
    <View style={[styles.container,{alignSelf: isUser ? 'flex-end':'flex-start', width: FIXED_BUBBLE_WIDTH}]}> 
      <View style={[styles.bubbleContainer,isUser?styles.userBubble:styles.aiBubble,{width: '100%'}]}>
        <View style={[styles.messageContainer,isUser?styles.userMessage:styles.aiMessage]}>
          {/* Meta Row (safety + translation toggle) */}
          {!isUser && (
            <View style={styles.metaRow}> 
              {message.safety?.action && message.safety.action !== 'allow' && (
                <View style={styles.safetyPill}>
                  <Ionicons name={message.safety.action === 'block' ? 'warning' : 'alert-circle'} size={12} color={message.safety.action === 'block' ? '#c62828' : '#ed6c02'} />
                  <Text style={[styles.safetyText,{color: message.safety.action === 'block' ? '#c62828' : '#ed6c02'}]}>
                    {message.safety.action === 'block' ? (message.safety.reason || 'Adjusted') : 'Moderated'}
                  </Text>
                </View>
              )}
              {message.originalEnglish && (
                <TouchableOpacity onPress={()=>setShowOriginal(!showOriginal)} style={styles.togglePill}>
                  <Text style={styles.toggleText}>
                    {showOriginal ? (t('showTranslation') || 'Show Translation') : (t('showOriginal') || 'Show Original')}
                  </Text>
                </TouchableOpacity>
              )}
              {message.translationMeta?.cached && (
                <Text style={styles.cachedTag}>{t('cached') || 'cached'}</Text>
              )}
            </View>
          )}

          {/* Content */}
          <View style={styles.contentContainer}>
            {isUser ? (
              <Text style={styles.userText}>{displayText}</Text>
            ) : (
              <Markdown style={markdownStyles}>{displayText}</Markdown>
            )}
          </View>

          {/* Translation Status */}
          {isTranslating && (
            <View style={styles.translatingContainer}>
              <Text style={styles.translatingText}>{t('translating')}</Text>
            </View>
          )}

          {/* Actions (collapsed into single row) */}
          <View style={styles.utilityRow}>
            {!isUser && (
              <TouchableOpacity style={styles.utilityIcon} onPress={()=>setShowActions(!showActions)}>
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {message.hasAudio && (
              <TouchableOpacity style={styles.utilityIcon} onPress={handleSpeak} disabled={isPlaying}>
                <Ionicons name={isPlaying? 'volume-high':'play'} size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {showActions && !isUser && (
            <View style={styles.expandedActions}>
              <TouchableOpacity style={styles.actionChip} onPress={handleSpeak} disabled={isPlaying}>
                <Ionicons name="volume-medium" size={14} color={colors.primary} />
                <Text style={styles.actionChipText}>{t('speak')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionChip} onPress={()=>handleTranslate('hindi')} disabled={isTranslating}>
                <Ionicons name="language" size={14} color={colors.primary} />
                <Text style={styles.actionChipText}>हिंदी</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionChip} onPress={()=>handleTranslate('telugu')} disabled={isTranslating}>
                <Ionicons name="language" size={14} color={colors.primary} />
                <Text style={styles.actionChipText}>తెలుగు</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.timestamp,isUser?styles.userTimestamp:styles.aiTimestamp]}>
        {message.timestamp ? new Date(message.timestamp).toLocaleTimeString():''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    marginHorizontal: 12,
  },
  bubbleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  aiBubble: {
    justifyContent: 'flex-start',
  },
  // Avatar styles removed
  messageContainer: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  userMessage: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    backgroundColor: colors.cardBackground,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 202, 58, 0.15)',
  },
  questionContainer: {
    backgroundColor: 'rgba(45, 106, 79, 0.08)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  questionText: {
  fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6
  },
  safetyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  safetyText: {
    fontSize: 10,
    marginLeft: 3,
    fontWeight: '500'
  },
  togglePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(45,106,79,0.08)',
    marginRight: 6,
  },
  toggleText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500'
  },
  cachedTag: {
    fontSize: 10,
    color: colors.textSecondary,
    marginRight: 6
  },
  contentContainer: {
    flex: 1,
  },
  userText: {
  fontSize: 16,
    color: '#FFFFFF',
  lineHeight: 24,
    flexWrap: 'wrap',
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 106, 79, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  audioText: {
    fontSize: 11,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  utilityRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  utilityIcon: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginRight: 8
  },
  actionButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  expandedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 106, 79, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  actionChipText: {
    fontSize: 11,
    color: colors.primary,
    marginLeft: 3,
    fontWeight: '500',
  },
  suggestionsContainer: {
    display: 'none', // Hide suggestions for cleaner look
  },
  suggestionChip: {
    display: 'none',
  },
  suggestionText: {
    display: 'none',
  },
  timestamp: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 4,
    marginHorizontal: 4,
     },
   userTimestamp: {
     textAlign: 'right',
   },
   aiTimestamp: {
     textAlign: 'left',
   },
   translatingContainer: {
     backgroundColor: 'rgba(45, 106, 79, 0.08)',
     borderRadius: 8,
     padding: 6,
     marginTop: 6,
     alignSelf: 'flex-start',
   },
   translatingText: {
     fontSize: 11,
     color: colors.primary,
     fontStyle: 'italic',
   },
});

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 24,
    flexWrap: 'wrap',
  },
  heading1: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginVertical: 6,
  },
  heading2: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
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
    marginVertical: 1,
  },
  bullet_list: {
    marginVertical: 4,
  },
  code_inline: {
    backgroundColor: 'rgba(45, 106, 79, 0.1)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
  fontSize: 11,
    color: colors.primary,
  },
});

export default React.memo(ChatBubble);