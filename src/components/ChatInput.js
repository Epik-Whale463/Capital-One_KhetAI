import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  ScrollView,
  Text,
  Dimensions,
  Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { AudioService } from '../services/AudioService';
import { SarvamAIService } from '../services/SarvamAIService';
import HybridAIService from '../services/HybridAIService';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../localization/translations';

const { width } = Dimensions.get('window');

// Create instance of HybridAIService
const hybridAIService = new HybridAIService();

const ChatInput = ({ onSendMessage, onVoiceMessage }) => {
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const { user } = useAuth();
  const { t } = useTranslation(user?.language);

  const micPulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const inputHeightAnim = useRef(new Animated.Value(50)).current;

  const suggestions = [
    t('weatherForecast'),
    t('marketPrices'),
    t('pestControl'),
    t('irrigation'),
    t('fertilizer'),
    t('cropOptimization')
  ];

  useEffect(() => {
    if (isListening) {
      // Claude-style ripple animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(rippleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(rippleAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Mic pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(micPulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      rippleAnim.stopAnimation();
      micPulseAnim.stopAnimation();
      rippleAnim.setValue(0);
      micPulseAnim.setValue(1);
    }
  }, [isListening]);

  const handleSendText = () => {
    if (message.trim() && onSendMessage) {
      onSendMessage(message.trim());
      setMessage('');
      setShowSuggestions(false);
    }
  };

  const handleVoicePress = async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  const startListening = async () => {
    try {
      setIsListening(true);
      const recordResult = await AudioService.startRecording();
      
      if (!recordResult.success) {
        setIsListening(false);
        return;
      }

      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (isListening) {
          stopListening();
        }
      }, 60000);
    } catch (error) {
      console.error('Error starting voice input:', error);
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      setIsListening(false);
      setIsProcessing(true);

      const recordResult = await AudioService.stopRecording();
      
      if (!recordResult.success) {
        setIsProcessing(false);
        return;
      }

  // Process with Hybrid AI: Sarvam ASR → Groq Chat → Sarvam Translation → Sarvam TTS
      const userLanguage = SarvamAIService.LANGUAGES[user?.language] || 'en-IN';
      const userContext = {
        crops: user?.crops || [],
        farmSize: user?.farmSize,
        experience: user?.experience
      };
      
      const result = await hybridAIService.processVoiceQuery(
        recordResult.blob,
        userLanguage,
        user?.location,
        userContext
      );

      setIsProcessing(false);

      if (result.success && onVoiceMessage) {
        onVoiceMessage({
          question: result.transcript,
          answer: result.advice,
          language: result.detectedLanguage,
          hasAudio: !!result.audioUrl
        });
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      setIsProcessing(false);
    }
  };

  const handleSuggestionPress = (suggestion) => {
    const cleanSuggestion = suggestion.replace(/^[🌦️💰🐛💧🌱📈]\s*/, '');
    setMessage(cleanSuggestion);
    setShowSuggestions(false);
  };

  const getMicIcon = () => {
    if (isProcessing) return 'sync';
    if (isListening) return 'stop-circle';
    return 'mic';
  };

  const getMicColors = () => {
    if (isProcessing) return [colors.warning, colors.secondary];
    if (isListening) return [colors.danger, '#FF6B6B'];
    return [colors.primary, colors.tertiary];
  };

  return (
    <View style={styles.container}>
      {/* Suggestions */}
      {showSuggestions && message.length === 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>{t('quickSuggestions')}</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsScroll}
          >
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.suggestionChip, { maxWidth: 220 }]}
                onPress={() => handleSuggestionPress(suggestion)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputBackground}>
          {/* Text Input Container */}
          <View style={styles.textInputContainer}>
            <TextInput
              style={[styles.textInput, Platform.OS === 'ios' && styles.textInputIOS]}
              placeholder={t('askFarming')}
              placeholderTextColor={colors.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={500}
              onFocus={() => setShowSuggestions(false)}
              textAlignVertical="top"
              returnKeyType="default"
              blurOnSubmit={false}
            />
            
            {/* Send Button */}
            {message.trim().length > 0 && (
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSendText}
                activeOpacity={0.8}
                accessibilityLabel={t('send') || 'send'}
              >
                <View style={styles.sendButtonBackground}>
                  <Ionicons name="send" size={16} color={colors.primary} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  suggestionsTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  suggestionsScroll: {
    paddingRight: 16,
  },
  suggestionChip: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  suggestionText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  inputBackground: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 202, 58, 0.2)',
    minHeight: 48,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 120,
    minHeight: 20,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    paddingHorizontal: 0,
    lineHeight: 20,
  },
  textInputIOS: {
    paddingTop: 6,
  },
  sendButton: {
    marginLeft: 8,
  },
  sendButtonBackground: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(45, 106, 79, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatInput;