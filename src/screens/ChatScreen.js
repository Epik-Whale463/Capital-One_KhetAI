import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    Animated
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
// Gradient removed for simpler, cleaner UI
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { spacing, radius } from '../styles/layout';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import TypingIndicator from '../components/TypingIndicator';
// LiveReasoningDisplay no longer shown separately; inline reasoning row used
import InlineReasoningRow from '../components/InlineReasoningRow';
import { SarvamAIService } from '../services/SarvamAIService';
import HybridAIService from '../services/HybridAIService';
import { LocationService } from '../services/LocationService';
import { useTranslation } from '../localization/translations';
import FarmerCropProjectsService from '../services/FarmerCropProjectsService';

const { height: screenHeight } = Dimensions.get('window');

// Create instance of HybridAIService
const hybridAIService = new HybridAIService();

const ChatScreen = ({ route }) => {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const navigation = useNavigation();
    const { conversations, addMessage, clearConversations } = useChat();
    const [isTyping, setIsTyping] = useState(false);
    const [agentStatus, setAgentStatus] = useState({ isActive: false, agent: '', message: '' });
    const [inlineReasoningVisible, setInlineReasoningVisible] = useState(false);
    const [inlineReasoningSteps, setInlineReasoningSteps] = useState([]);
    const [inlineCollapsed, setInlineCollapsed] = useState(true);
    const [activeReasoningMessageId, setActiveReasoningMessageId] = useState(null); // Track which user message is showing live reasoning
    const scrollViewRef = useRef(null);
    const [userCoordinates, setUserCoordinates] = useState(null);
    // Removed header pulse animation for calmer interface
    const { t } = useTranslation(user?.language);
    
    // Project context from navigation
    const [activeProjectId, setActiveProjectId] = useState(route?.params?.activeProjectId || null);
    const [projectName, setProjectName] = useState(route?.params?.projectName || null);
    const [cropName, setCropName] = useState(route?.params?.cropName || null);
    // Load last selected project if none provided
    useEffect(() => {
        (async () => {
            if (!activeProjectId && user?.id) {
                const last = await FarmerCropProjectsService.getLastSelectedProject(user.id);
                if (last) {
                    const projects = await FarmerCropProjectsService.getFarmerProjects(user.id);
                    const match = projects.find(p => p.id === last && p.status === 'active');
                    if (match) {
                        setActiveProjectId(match.id);
                        setProjectName(match.displayName);
                        setCropName(match.cropName);
                    }
                }
            }
        })();
    }, [user?.id]);
    const [availableCrops, setAvailableCrops] = useState([]);
    const [showSwitcher, setShowSwitcher] = useState(false);

    useEffect(() => {
        // Scroll to bottom when new messages arrive
        if (conversations.length > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 300);
        }
    }, [conversations.length]);

    // Load crops for switcher
    useEffect(() => {
        (async () => {
            if (user?.id) {
                const projects = await FarmerCropProjectsService.getFarmerProjects(user.id);
                setAvailableCrops(projects.filter(p => p.status === 'active'));
            }
        })();
    }, [user?.id]);

    // Acquire user coordinates once (used for precise weather/tool data like home screen)
    useEffect(() => {
        (async () => {
            try {
                const locationData = await LocationService.getLocationWithAddress?.();
                if (locationData?.coordinates) {
                    setUserCoordinates(locationData.coordinates);
                }
            } catch (e) {
                console.warn('Location fetch failed (non-blocking):', e.message);
            }
        })();
    }, []);

    const handleTextMessage = async (message) => {
        // Add user message immediately
    const userMessage = await addMessage({
            type: 'text',
            question: message,
            answer: message,
            language: user?.language || 'english',
            hasAudio: false,
            isUser: true
        });
    setActiveReasoningMessageId(userMessage.id);

        // Show typing indicator and agent status
        setIsTyping(true);
        setAgentStatus({
            isActive: true,
            agent: 'farming',
            message: t('processing')
        });

        // Set up reasoning step tracking
    const reasoningSteps = [];
    setInlineReasoningSteps([]);
    setInlineReasoningVisible(true);
        
    const onReasoningStep = (step) => {
            const existingIndex = reasoningSteps.findIndex(s => s.id === step.id);
            if (existingIndex >= 0) {
                reasoningSteps[existingIndex] = step;
            } else {
                reasoningSteps.push(step);
            }
            
            // Update live display
            setInlineReasoningSteps([...reasoningSteps]);
        };

        try {
            // Get AI response using Hybrid workflow: Groq Chat + Sarvam Translation
            const userLanguage = SarvamAIService.LANGUAGES[user?.language] || 'en-IN';
                        // Conversation summary (lightweight memory) - last 2 exchanges to prevent context bleeding
                        const recentPairs = conversations.slice(0, 2) // reduced from 4 to prevent bleeding
                            .filter(m => m.type === 'text')
                            .slice(0, 2) // reduced from 4 to prevent bleeding
                            .reverse();
                        let convoSummary = '';
                        if (recentPairs.length) {
                            convoSummary = recentPairs
                                .map(m => (m.isUser ? 'Farmer: ' : 'AI: ') + (m.question || m.answer || '').slice(0,80)) // reduced from 200 to 80
                                .join('\n');
                        }

                        const userContext = {
                                userId: user?.id,
                                crops: user?.crops || [],
                                farmSize: user?.farmSize,
                                experience: user?.experience,
                                onReasoningStep: onReasoningStep, // Pass reasoning callback
                                coordinates: userCoordinates ? { latitude: userCoordinates.latitude, longitude: userCoordinates.longitude } : undefined,
                                location: user?.location, // string for geocoding
                                conversationSummary: convoSummary,
                                activeProjectId: activeProjectId // Pass project context
                        };
            
            const result = await hybridAIService.getFarmingAdvice(
                message,
                userLanguage,
                user?.location,
                userContext
            );

            setIsTyping(false);
            setAgentStatus({ isActive: false, agent: '', message: '' });
            setInlineReasoningVisible(false); // Hide inline indicator once answer is appended
                setActiveReasoningMessageId(null);

            if (result.success) {
                // Internal metrics removed for farmer-focused UI
                
                // Add AI response with reasoning steps
                addMessage({
                    type: 'text',
                    question: message,
                    answer: result.advice,
                    language: userLanguage,
                    hasAudio: false,
                    isUser: false,
                    source: result.source, // Track the AI source
                    hasTranslation: result.hasTranslation,
                    originalEnglish: result.originalEnglish,
                    translationMeta: result.translationMeta,
                    reasoningSteps: reasoningSteps, // Include reasoning chain
                    toolsUsed: result.toolsUsed || [],
                    model: result.model
                });

                // Animation removed
            }
        } catch (error) {
            setIsTyping(false);
            setInlineReasoningVisible(false);
                setActiveReasoningMessageId(null);
            setAgentStatus({ isActive: false, agent: '', message: '' });
            // Suppressed noisy error log (can be routed to telemetry if needed)
        }
    };

    const handleVoiceMessage = async (audioBlob) => {
        // Show voice processing status
        setIsTyping(true);
        setAgentStatus({
            isActive: true,
            agent: 'voice',
            message: t('listeningVoice')
        });

        // Set up reasoning step tracking for voice
    const reasoningSteps = [];
    setInlineReasoningSteps([]);
    setInlineReasoningVisible(true);
        
    const onReasoningStep = (step) => {
            const existingIndex = reasoningSteps.findIndex(s => s.id === step.id);
            if (existingIndex >= 0) {
                reasoningSteps[existingIndex] = step;
            } else {
                reasoningSteps.push(step);
            }
            
            // Update live display
            setInlineReasoningSteps([...reasoningSteps]);
        };

        try {
            const userLanguage = SarvamAIService.LANGUAGES[user?.language] || 'en-IN';
            const userContext = {
                userId: user?.id,
                crops: user?.crops || [],
                farmSize: user?.farmSize,
                experience: user?.experience,
                onReasoningStep: onReasoningStep, // Pass reasoning callback
                coordinates: userCoordinates ? { latitude: userCoordinates.latitude, longitude: userCoordinates.longitude } : undefined,
                location: user?.location,
                conversationSummary: conversations.slice(0,3).reverse().map(m => (m.isUser? 'Farmer: ':'AI: ')+(m.question || m.answer || '').slice(0,200)).join('\n')
            };

            const response = await hybridAIService.processVoiceQuery(
                audioBlob,
                userLanguage,
                user?.location,
                userContext
            );

            setIsTyping(false);
            setAgentStatus({ isActive: false, agent: '', message: '' });
            setInlineReasoningVisible(false);

            if (response.success) {
                // Add user voice message
                addMessage({
                    type: 'voice',
                    question: response.transcript,
                    answer: response.transcript,
                    language: response.language,
                    hasAudio: true,
                    isUser: true
                });

                // Add AI response with reasoning
                addMessage({
                    type: 'voice',
                    question: response.transcript,
                    answer: response.advice,
                    language: response.language,
                    hasAudio: response.audioUrl ? true : false,
                    isUser: false,
                    source: response.source,
                    reasoningSteps: reasoningSteps // Include reasoning chain
                });
            } else {
                // Error handling
                addMessage({
                    type: 'voice',
                    question: t('voiceError'),
                    answer: response.error || t('voiceProcessingFailed'),
                    language: userLanguage,
                    hasAudio: false,
                    isUser: false,
                    source: 'error'
                });
            }
        } catch (error) {
            setIsTyping(false);
            setInlineReasoningVisible(false);
            setAgentStatus({ isActive: false, agent: '', message: '' });
            // Suppressed voice error console for end-user clarity
            
            addMessage({
                type: 'voice',
                question: t('voiceError'),
                answer: t('voiceProcessingFailed'),
                language: SarvamAIService.LANGUAGES[user?.language] || 'en-IN',
                hasAudio: false,
                isUser: false,
                source: 'error'
            });
        }
    };

    const handleUpdateMessage = (messageId, updatedMessage) => {
        // For now, we'll just log the update since we're doing in-place updates
    // Debug update logging removed
    };

    const renderMessage = ({ item }) => {
        if (!item || typeof item !== 'object') {
            return null;
        }
        const showReasoning = inlineReasoningVisible && activeReasoningMessageId === item.id;
        return (
            <View>
                {showReasoning && (
                    <InlineReasoningRow
                        steps={inlineReasoningSteps}
                        visible={inlineReasoningVisible}
                        collapsed={inlineCollapsed}
                        onToggle={() => setInlineCollapsed(!inlineCollapsed)}
                    />
                )}
                <ChatBubble
                    message={item}
                    isUser={item.isUser || false}
                    onUpdateMessage={handleUpdateMessage}
                />
            </View>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconPlain}><Text style={styles.emptyEmoji}>🌾</Text></View>
            <Text style={styles.emptyTitle}>{t('welcomeChat')}</Text>
            <Text style={styles.emptySubtitle}>
                {t('chatSubtitle')}
            </Text>
        </View>
    );

    const renderFooter = () => {
        if (isTyping) {
            return <TypingIndicator isVisible={true} />;
        }
        return null;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                style={styles.keyboardContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                {/* Header */}
    <Animated.View style={styles.headerWrapper}>
            <BlurView intensity={28} tint="light" style={styles.glassHeader}>
                    <View style={styles.headerContent}>
            <View style={styles.headerIconPlain}><Text style={styles.headerEmoji}>🌾</Text></View>
                        <View style={styles.headerText}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.headerTitle}>
                                    {activeProjectId ? projectName : 'Select a Crop'}
                                </Text>
                                {activeProjectId && availableCrops.length > 1 && (
                                    <TouchableOpacity style={styles.switcherToggle} onPress={() => setShowSwitcher(s=>!s)}>
                                        <Ionicons name={showSwitcher ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            {showSwitcher && availableCrops.length > 1 && (
                                <View style={styles.switcherList}>
                                    {availableCrops.map(cp => (
                                        <TouchableOpacity key={cp.id} style={[styles.switcherItem, cp.id===activeProjectId && styles.switcherItemActive]} onPress={() => {
                                            setShowSwitcher(false);
                                            if (cp.id !== activeProjectId) {
                                                // Navigate replacing params
                                                setActiveProjectId(cp.id);
                                                setProjectName(cp.displayName);
                                                setCropName(cp.cropName);
                                                FarmerCropProjectsService.setLastSelectedProject(user.id, cp.id);
                                                // Could also use navigation.setParams if stack supports
                                            }
                                        }}>
                                            <Text style={[styles.switcherItemText, cp.id===activeProjectId && styles.switcherItemTextActive]}>{cp.displayName}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                            {activeProjectId ? (
                                <Text style={styles.subHeaderText}>Advice for your {cropName}</Text>
                            ) : (
                                <Text style={styles.subHeaderTextMuted}>Pick a crop to get tailored advice</Text>
                            )}
                        </View>
                        {conversations.length > 0 && (
                            <TouchableOpacity onPress={clearConversations} style={styles.clearButton}>
                                <Ionicons name="refresh" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                    {/* Project banner removed for cleaner farmer-focused UI */}
                    </BlurView>
                </Animated.View>



                {/* Chat Messages */}
                                <FlatList
                    ref={scrollViewRef}
                    data={[...conversations].reverse()}
                    renderItem={renderMessage}
                    keyExtractor={(item, index) => item.id?.toString() || `message-${index}`}
                    style={styles.messagesContainer}
                    contentContainerStyle={[
                        styles.messagesContent,
                        conversations.length === 0 && styles.emptyContainer
                    ]}
                    ListEmptyComponent={renderEmptyState}
                    ListFooterComponent={renderFooter}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={false}
                    initialNumToRender={10}
                    maxToRenderPerBatch={5}
                    windowSize={10}
                    getItemLayout={null}
                    onContentSizeChange={() => {
                        if (conversations.length > 0) {
                            setTimeout(() => {
                                scrollViewRef.current?.scrollToEnd({ animated: true });
                            }, 100);
                        }
                    }}
                />

                {/* Input Area */}
                {activeProjectId ? (
                    <View style={styles.inputArea}>
                        <ChatInput onSendMessage={handleTextMessage} onVoiceMessage={handleVoiceMessage} />
                    </View>
                ) : (
                    <View style={styles.noProjectContainer}>
                        <TouchableOpacity style={styles.selectCropButton} onPress={() => navigation.navigate('CropsList')}>
                            <Ionicons name="leaf" size={16} color="#fff" />
                            <Text style={styles.selectCropText}>Choose a Crop Project</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardContainer: {
        flex: 1,
    },
    headerWrapper: { paddingTop: Platform.OS === 'android' ? spacing.md : spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    glassHeader: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: 'rgba(250,249,245,0.72)', borderBottomLeftRadius:0, borderBottomRightRadius:0 },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    headerIconPlain: { width:32, height:32, borderRadius:16, backgroundColor: colors.primary, justifyContent:'center', alignItems:'center', marginRight: spacing.sm },
    headerEmoji: {
        fontSize: 16,
        color: '#FFFFFF',
    },
    headerText: {
        flex: 1,
        marginRight: 12,
    },
    headerTitle: { fontSize:18, fontWeight:'700', color: colors.textPrimary, letterSpacing:0.2 },
    subHeaderText: { fontSize:12, color: colors.primary, fontWeight:'500', marginTop:2 },
    subHeaderTextMuted: { fontSize:12, color: colors.textSecondary, marginTop:2 },
    switcherToggle: {
        marginLeft: 6,
        padding: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.05)'
    },
    switcherList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 6,
        gap: 6,
    },
    switcherItem: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
    },
    switcherItemActive: {
        backgroundColor: colors.primary,
    },
    switcherItemText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500'
    },
    switcherItemTextActive: {
        color: '#fff'
    },
    // Removed detailed status & AI chip for farmer simplicity
    clearButton: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: colors.secondary,
        minWidth: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Project banner removed
    // Removed general banner styles (general mode eliminated)
    noProjectContainer: { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical: spacing.md, backgroundColor: colors.cardBackground, borderTopWidth:1, borderTopColor:'rgba(0,0,0,0.05)' },
    selectCropButton: { flexDirection:'row', alignItems:'center', backgroundColor: colors.primary, paddingHorizontal:16, paddingVertical:10, borderRadius: 20, gap:8 },
    selectCropText: { color:'#fff', fontWeight:'600', fontSize:14 },
    messagesContainer: { flex:1, backgroundColor: colors.backgroundSecondary, paddingHorizontal: spacing.md },
    messagesContent: { paddingTop: spacing.md, paddingBottom: spacing.lg, flexGrow:1 },
    emptyContainer: {
        justifyContent: 'center',
        minHeight: screenHeight * 0.5,
    },
    emptyState: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    emptyIconPlain: { width:60, height:60, borderRadius:30, backgroundColor: colors.primary, justifyContent:'center', alignItems:'center', marginBottom: spacing.md },
    emptyEmoji: {
        fontSize: 28,
        color: '#FFFFFF',
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    inputArea: { backgroundColor: colors.cardBackground, borderTopWidth:1, borderTopColor:'rgba(0,0,0,0.05)', paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
});

export default ChatScreen;