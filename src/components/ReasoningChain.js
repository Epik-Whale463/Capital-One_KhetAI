import React, { useState, useEffect, useRef, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Dimensions,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';

const { width: screenWidth } = Dimensions.get('window');

// Map step ids / types to visual metadata similar to Claude / GPT reasoning previews
const STEP_META = {
    understand: { icon: 'book', color: colors.primary },
    tools: { icon: 'construct', color: '#946300' },
    analysis: { icon: 'sparkles', color: '#6b4aff' },
    response: { icon: 'document-text', color: colors.success },
    error: { icon: 'warning', color: '#d9534f' },
    default: { icon: 'flash', color: colors.primary }
};

// Cleaner, minimal animation variant
const ReasoningStep = memo(({ step, isActive, isCompleted, delay = 0, isLast = false }) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(6)).current;
    const activePulse = useRef(new Animated.Value(0)).current; // 0..1 to drive scale + glow
    const lineProgress = useRef(new Animated.Value(0)).current;
    const descOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isActive || isCompleted) {
            // Enhanced entrance animation with smoother timing
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(opacity, { 
                        toValue: 1, 
                        duration: 320, // Increased duration for smoothness
                        useNativeDriver: true 
                    }),
                    Animated.timing(translateY, { 
                        toValue: 0, 
                        duration: 380, // Slightly longer for fluid motion
                        useNativeDriver: true 
                    })
                ])
            ]).start();
            
            // Enhanced description reveal with stagger
            Animated.timing(descOpacity, { 
                toValue: 1, 
                duration: 420, // Longer for smoother text appearance
                delay: delay + 150, // Increased delay for better stagger
                useNativeDriver: true 
            }).start();
        } else {
            opacity.setValue(0);
            translateY.setValue(6);
            descOpacity.setValue(0);
        }

        // Enhanced connection line animation
        if (isCompleted && !isLast) {
            Animated.timing(lineProgress, { 
                toValue: 1, 
                duration: 420, // Increased for smoother line drawing
                delay: 100, // Small delay for better visual flow
                useNativeDriver: false 
            }).start();
        }

        // Enhanced active pulse with smoother breathing
        if (isActive && !isCompleted) {
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(activePulse, { 
                        toValue: 1, 
                        duration: 1100, // Longer for smoother breathing
                        useNativeDriver: true 
                    }),
                    Animated.timing(activePulse, { 
                        toValue: 0, 
                        duration: 1100, 
                        useNativeDriver: true 
                    })
                ])
            );
            loop.start();
            return () => loop.stop();
        }
    }, [isActive, isCompleted, delay, isLast]);

    const meta = STEP_META[step.id] || STEP_META[step.type] || STEP_META.default;

    const getStepIcon = () => {
        if (isCompleted) {
            return <View style={styles.minimalCompletedDot}><Text style={styles.minimalCheck}>✓</Text></View>;
        }
        if (isActive) {
            const scale = activePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
            const shadowOpacity = activePulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] });
            return (
                <Animated.View style={[styles.minimalActiveDot, { transform: [{ scale }], shadowOpacity }]} />
            );
        }
        return <View style={styles.minimalInactiveDot} />;
    };

    const getStepColor = () => {
        if (isCompleted) return colors.success;
        if (isActive) return colors.primary;
        return colors.textSecondary;
    };

    // Tool chips if provided
    const tools = step.tools || step.toolsUsed || [];

    return (
        <Animated.View style={[styles.stepContainer, { opacity, transform: [{ translateY }] }]}>        
            <View style={styles.stepIconContainer}>
                <View style={styles.stepIcon}>
                    {getStepIcon()}
                </View>
                
                {/* Connection Line to Next Step */}
                {!isLast && (
                    <View style={styles.connectionLineContainer}>
                        <View style={styles.connectionLineBackground} />
                        <Animated.View style={[styles.connectionLine, { height: lineProgress.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }) }]} />
                    </View>
                )}
            </View>
            
            <View style={styles.stepContent}>
                <View style={styles.stepTitleRow}>
                    <Ionicons name={meta.icon} size={14} color={getStepColor()} style={{ marginRight: 4, opacity: 0.85 }} />
                    <Text style={[styles.stepTitle, { color: getStepColor() }]} numberOfLines={3}>
                        {step.title}
                    </Text>
                </View>
                {step.description && (
                    <Animated.Text style={[styles.stepDescription, { opacity: descOpacity }]} numberOfLines={3}>
                        {step.description}
                    </Animated.Text>
                )}
                {tools.length > 0 && (
                    <View style={styles.toolChipsRow}>
                        {tools.slice(0,4).map((toolName, idx) => (
                            <View key={idx} style={styles.toolChip}>
                                <Text style={styles.toolChipText}>{toolName.replace(/_/g,' ')}</Text>
                            </View>
                        ))}
                        {tools.length > 4 && (
                            <View style={styles.toolChip}><Text style={styles.toolChipText}>+{tools.length-4}</Text></View>
                        )}
                    </View>
                )}
                {step.duration && isCompleted && (
                    <Text style={styles.stepDuration}>✓ {step.duration}ms</Text>
                )}
            </View>
        </Animated.View>
    );
});

const ReasoningChain = ({ 
    steps = [], 
    isVisible = false, 
    isCollapsed = false, 
    onToggleCollapsed,
    title = "AI Reasoning Process"
}) => {
    const containerFadeAnim = useRef(new Animated.Value(0)).current;
    const [containerHeight, setContainerHeight] = useState(0);
    const scrollRef = useRef(null);
    const prevCountRef = useRef(steps.length);

    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(containerFadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(containerFadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [isVisible, isCollapsed, containerHeight]);

    const handleLayout = (event) => {
        if (!isCollapsed) {
            setContainerHeight(event.nativeEvent.layout.height);
        }
    };

    const getActiveStepIndex = () => {
        const activeIndex = steps.findIndex(step => step.status === 'active');
        return activeIndex >= 0 ? activeIndex : steps.filter(step => step.status === 'completed').length;
    };

    const completedSteps = steps.filter(step => step.status === 'completed').length;
    const totalSteps = steps.length;

    // Auto-scroll to newest step when expanded
    useEffect(() => {
        if (!isCollapsed && scrollRef.current && steps.length > prevCountRef.current) {
            setTimeout(() => {
                try { scrollRef.current.scrollToEnd({ animated: true }); } catch {}
            }, 50);
        }
        prevCountRef.current = steps.length;
    }, [steps.length, isCollapsed]);

    if (!isVisible && !steps.length) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: containerFadeAnim,
                    maxHeight: isCollapsed ? 60 : 400,
                    overflow: 'hidden'
                }
            ]}
        >
            <TouchableOpacity
                style={styles.header}
                onPress={onToggleCollapsed}
                activeOpacity={0.7}
            >
                <View style={styles.headerLeft}>
                    <View style={styles.brainIcon}>
                        <Text style={styles.brainText}>AI</Text>
                    </View>
                    <Text style={styles.headerTitle}>{title}</Text>
                    {totalSteps > 0 && (
                        <View style={styles.progressBadge}>
                            <Text style={styles.progressText}>
                                {completedSteps}/{totalSteps}
                            </Text>
                        </View>
                    )}
                </View>
                <Animated.View
                    style={[
                        styles.expandIcon,
                        {
                            transform: [{
                                rotate: isCollapsed ? '0deg' : '180deg'
                            }]
                        }
                    ]}
                >
                    <Text style={styles.expandText}>▼</Text>
                </Animated.View>
            </TouchableOpacity>

            {!isCollapsed && (
                <ScrollView
                    ref={scrollRef}
                    style={styles.stepsContainer}
                    showsVerticalScrollIndicator={true}
                    onLayout={handleLayout}
                >
                    {/* Progress Bar with subtle gradient */}
                    {totalSteps > 0 && (
                        <View style={styles.progressBarContainer}>
                            <View style={styles.progressBarBackground} />
                            <Animated.View
                                style={[
                                    styles.progressBarFill,
                                    {
                                        width: `${(completedSteps / totalSteps) * 100}%`,
                                        backgroundColor: completedSteps === totalSteps ? colors.success : colors.primary,
                                        opacity: 0.9
                                    }
                                ]}
                            />
                        </View>
                    )}

                    {/* Reasoning Steps */}
                    {steps.map((step, index) => (
                        <ReasoningStep
                            key={step.id || index}
                            step={step}
                            isActive={step.status === 'active'}
                            isCompleted={step.status === 'completed'}
                            isLast={index === steps.length - 1}
                            delay={index * 100} // Faster stagger for smoother flow
                        />
                    ))}

                    {steps.length === 0 && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>
                                Preparing reasoning steps...
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent', // Remove background completely
        borderRadius: 0,
        borderWidth: 0,
        marginVertical: 4,
        overflow: 'visible',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'transparent', // Remove header background
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    brainIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        flex: 1,
    },
    progressBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 8,
    },
    progressText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    expandIcon: {
        padding: 4,
    },
    stepsContainer: {
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    progressBarContainer: {
        height: 2,
        backgroundColor: 'rgba(45, 106, 79, 0.05)',
        borderRadius: 1,
        marginBottom: 12,
        overflow: 'hidden',
    },
    progressBarBackground: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(45, 106, 79, 0.05)',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 1,
    },
    stepContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 6,
        paddingVertical: 4,
        position: 'relative',
    },
    stepIconContainer: {
        alignItems: 'center',
        marginRight: 12,
        position: 'relative',
        minHeight: 40,
    },
    stepIcon: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
        zIndex: 2,
    },
    connectionLineContainer: {
        position: 'absolute',
        top: 28,
        left: 11.5,
        width: 1,
        height: 40,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    connectionLineBackground: {
        position: 'absolute',
        width: 2,
        height: '100%',
        backgroundColor: 'rgba(45, 106, 79, 0.1)',
        borderRadius: 1,
    },
    connectionLine: {
        width: 2,
        backgroundColor: colors.primary,
        borderRadius: 1,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
    connectionDot: {
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 3,
        elevation: 3,
    },
    activeDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4,
    },
    inactiveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.textSecondary,
        opacity: 0.4,
    },
    // Minimal dot variants with enhanced visual feedback
    minimalActiveDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 8, // Increased shadow for premium feel
        shadowOpacity: 0.35, // Slightly more pronounced shadow
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(0, 122, 255, 0.15)', // Subtle border for depth
    },
    minimalInactiveDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(0,0,0,0.12)', // Slightly lighter for subtlety
        borderWidth: 0.5,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    minimalCompletedDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.success,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        shadowOpacity: 0.25,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(40, 167, 69, 0.2)', // Success green border
    },
    minimalCheck: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff'
    },
    stepContent: {
        flex: 1,
        paddingRight: 8,
        paddingTop: 2,
    },
    stepTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap'
    },
    stepTitle: {
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 18,
        marginBottom: 3,
    },
    stepDescription: {
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 16,
        marginBottom: 3,
    },
    stepDuration: {
        fontSize: 10,
        color: colors.success,
        fontWeight: '600',
        marginTop: 2,
    },
    toolChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 2,
        marginBottom: 2
    },
    toolChip: {
        backgroundColor: 'rgba(45,106,79,0.10)',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginRight: 4,
        marginVertical: 2
    },
    toolChipText: {
        fontSize: 10,
        color: colors.primary,
        fontWeight: '600'
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    emptyText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    stepTextIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.success,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepIconText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    brainText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: colors.primary,
    },
    expandText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
});

export default ReasoningChain;
