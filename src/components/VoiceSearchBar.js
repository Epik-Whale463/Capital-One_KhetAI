import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { SarvamAIService } from '../services/SarvamAIService';
import GroqAdapterService from '../services/GroqAdapterService';
const groqService = new GroqAdapterService();
import { AudioService } from '../services/AudioService';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../localization/translations';

const VoiceSearchBar = ({ onResponse }) => {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const pulseAnim = new Animated.Value(1);
    const { user } = useAuth();
    const { t } = useTranslation(user?.language);

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            AudioService.cleanup();
        };
    }, []);

    const startListening = async () => {
        if (!SarvamAIService.isConfigured()) {
            Alert.alert(t('serviceUnavailable'), t('voiceFeaturesAvailable'));
            return;
        }

        try {
            setIsListening(true);

            // Start pulse animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Start recording
            const recordResult = await AudioService.startRecording();

            if (!recordResult.success) {
                setIsListening(false);
                pulseAnim.stopAnimation();
                pulseAnim.setValue(1);
                Alert.alert('Recording Error', recordResult.error);
                return;
            }

            // Auto-stop after 60 seconds (Sarvam AI recommended limit for ASR)
            setTimeout(() => {
                if (isListening) {
                    stopListening();
                }
            }, 60000);

        } catch (error) {
            console.error('Error starting voice input:', error);
            setIsListening(false);
            pulseAnim.stopAnimation();
            pulseAnim.setValue(1);
        }
    };

    const stopListening = async () => {
        try {
            setIsListening(false);
            setIsProcessing(true);
            pulseAnim.stopAnimation();
            pulseAnim.setValue(1);

            // Stop recording
            const recordResult = await AudioService.stopRecording();

            if (!recordResult.success) {
                setIsProcessing(false);
                Alert.alert(t('recordingError'), recordResult.error);
                return;
            }

            // Process voice query: Sarvam ASR → Groq Chat → Sarvam Translation → Sarvam TTS
            const userLanguage = SarvamAIService.LANGUAGES[user?.language] || 'en-IN';
            const userContext = {
                crops: user?.crops || [],
                farmSize: user?.farmSize,
                experience: user?.experience
            };
            
            // Import HybridAIService for proper workflow
            const HybridAIServiceClass = (await import('../services/HybridAIService')).default;
            const hybridAIService = new HybridAIServiceClass();
            const result = await hybridAIService.processVoiceQuery(
                recordResult.blob, 
                userLanguage, 
                user?.location, 
                userContext
            );

            setIsProcessing(false);

            if (result.success) {
                // Play response audio if available
                if (result.audioUrl) {
                    setIsPlaying(true);
                    try {
                        const playResult = await AudioService.playAudio(result.audioUrl);
                        if (!playResult.success) {
                            console.warn('Audio playback failed, but continuing with text response');
                        }
                    } catch (audioError) {
                        console.warn('Audio playback error, but continuing with text response:', audioError);
                    }
                    setIsPlaying(false);
                }

                // Pass response to parent component
                if (onResponse) {
                    onResponse({
                        question: result.transcript,
                        answer: result.advice,
                        language: result.detectedLanguage,
                        hasAudio: !!result.audioUrl
                    });
                }
            } else {
                // Show user-friendly error messages
                let errorMessage = 'Could not process your voice input';
                if (result.error?.includes('Network request failed')) {
                    errorMessage = 'Network connection issue. Please check your internet and try again.';
                } else if (result.error?.includes('500 characters')) {
                    errorMessage = 'Response too long for voice. Text answer provided instead.';
                } else if (result.error?.includes('Invalid audio data')) {
                    errorMessage = 'Audio recording failed. Please try again.';
                } else if (result.error?.includes('turboModuleProxy')) {
                    errorMessage = 'Audio playback not supported on this device.';
                }
                Alert.alert(t('voiceProcessingError'), errorMessage);
            }

        } catch (error) {
            console.error('Error processing voice input:', error);
            setIsProcessing(false);
            Alert.alert(t('error'), t('voiceProcessingFailed'));
        }
    };

    const handleVoicePress = () => {
        if (isListening) {
            stopListening();
        } else if (!isProcessing && !isPlaying) {
            startListening();
        }
    };

    const getStatusText = () => {
        if (isListening) return t('listening');
        if (isProcessing) return t('processing');
        if (isPlaying) return t('speaking');
        return t('askAnything');
    };

    const statusText = getStatusText();
    const suggestions = [
        t('willItRain'),
        t('howIsMyWheat'),
        t('marketPrices'),
        t('bestFertilizer'),
        t('pestControl')
    ];

    const getMicIcon = () => {
        if (isListening) return "radio-button-on";
        if (isProcessing) return "sync";
        if (isPlaying) return "volume-high";
        return "mic";
    };

    const getMicColors = () => {
        if (isListening) return [colors.tertiary, colors.primary];
        if (isProcessing) return [colors.warning, colors.secondary];
        if (isPlaying) return [colors.success, colors.tertiary];
        return [colors.secondary, '#FFE066'];
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                onPress={handleVoicePress}
                style={styles.micContainer}
                disabled={isProcessing}
            >
                <LinearGradient
                    colors={getMicColors()}
                    style={[styles.micButton, (isProcessing || isPlaying) && styles.micButtonDisabled]}
                >
                    <Animated.View style={[styles.micInner, { transform: [{ scale: pulseAnim }] }]}>
                        <Ionicons
                            name={getMicIcon()}
                            size={32}
                            color="#FFFFFF"
                        />
                    </Animated.View>
                </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.promptText}>
                {statusText}
            </Text>

            <View style={styles.suggestionsContainer}>
                {suggestions.map((suggestion, index) => (
                    <TouchableOpacity key={index} style={styles.suggestionChip}>
                        <Text style={styles.suggestionText}>{t('try')}: {suggestion}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    micContainer: {
        marginBottom: 16,
    },
    micButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    micInner: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    promptText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 4,
    },

    micButtonDisabled: {
        opacity: 0.7,
    },
    suggestionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
    },
    suggestionChip: {
        backgroundColor: colors.cardBackground,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.secondary,
        shadowColor: colors.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    suggestionText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500',
    },
});

export default VoiceSearchBar;