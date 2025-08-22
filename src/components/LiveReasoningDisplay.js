import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import ReasoningChain from './ReasoningChain';

const { width: screenWidth } = Dimensions.get('window');

const LiveReasoningDisplay = ({ 
    isVisible = false, 
    reasoningSteps = [], 
    onComplete 
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current; // Reduced from 30 for smoother entry
    const scaleAnim = useRef(new Animated.Value(0.97)).current; // Closer to 1 for subtler effect
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const breatheAnim = useRef(new Animated.Value(1)).current; // Additional breathing animation
    const [displayedSteps, setDisplayedSteps] = useState([]);

    // Enhanced continuous pulse with breathing effect
    useEffect(() => {
        if (isVisible) {
            // Main pulse animation
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15, // Reduced from 1.2 for subtler effect
                        duration: 900, // Slightly longer for smoothness
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                ])
            );

            // Breathing animation for additional life
            const breathe = Animated.loop(
                Animated.sequence([
                    Animated.timing(breatheAnim, {
                        toValue: 1.08,
                        duration: 2000, // Slower breathing effect
                        useNativeDriver: true,
                    }),
                    Animated.timing(breatheAnim, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                ])
            );

            pulse.start();
            breathe.start();
            return () => {
                pulse.stop();
                breathe.stop();
            };
        }
    }, [isVisible]);

    useEffect(() => {
        if (isVisible) {
            // Enhanced show animation with staggered effects
            Animated.stagger(80, [
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 350, // Slightly longer for smoothness
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 450, // Progressive timing
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            // Enhanced hide animation
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 15, // Reduced movement for smoother exit
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.98, // Subtler scale change
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start(() => {
                if (onComplete) {
                    onComplete(displayedSteps);
                }
            });
        }
    }, [isVisible]);

    useEffect(() => {
        // Update displayed steps when reasoning steps change
        setDisplayedSteps([...reasoningSteps]);
    }, [reasoningSteps]);

    if (!isVisible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: fadeAnim,
                    transform: [
                        { translateY: slideAnim },
                        { scale: scaleAnim }
                    ]
                }
            ]}
        >
            <View style={styles.header}>
                <View style={styles.brainContainer}>
                    <Text style={styles.brainText}>AI</Text>
                </View>
                <Text style={styles.title}>AI is thinking...</Text>
                <Animated.View 
                    style={[
                        styles.pulse,
                        { 
                            transform: [
                                { scale: pulseAnim },
                                { scale: breatheAnim } // Combined animations
                            ]
                        }
                    ]}
                >
                    <Animated.View 
                        style={[
                            styles.pulseRing,
                            {
                                shadowOpacity: pulseAnim.interpolate({
                                    inputRange: [1, 1.15],
                                    outputRange: [0.3, 0.7]
                                })
                            }
                        ]} 
                    />
                </Animated.View>
            </View>

            <ReasoningChain
                steps={displayedSteps}
                isVisible={true}
                isCollapsed={false}
                onToggleCollapsed={() => {}} // Disable collapsing during live display
                title=""
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent', // Remove background completely
        borderRadius: 0,
        marginHorizontal: 12,
        marginVertical: 4,
        padding: 8,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
        borderWidth: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    brainContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
        flex: 1,
    },
    pulse: {
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseRing: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
        opacity: 0.9,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 4,
        elevation: 3,
    },
    brainText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: colors.primary,
    },
});

export default LiveReasoningDisplay;
