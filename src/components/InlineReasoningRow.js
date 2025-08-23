import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';

/*
 * InlineReasoningRow
 * Dynamic reasoning display that expands/contracts to show AI thinking process
 * Resizes automatically based on content and user interaction
 */
export const InlineReasoningRow = ({ steps = [], visible = false, onPress, collapsed = true, onToggle }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [maxHeight, setMaxHeight] = useState(0);
  // Per-step animation refs
  const stepAnim = useRef({}); // { id: { opacity: Animated.Value, translateY: Animated.Value } }
  const prevStatuses = useRef({});

  useEffect(() => {
    if (visible) {
      // Enhanced entrance animation with much smoother timing
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500, // Increased from 280ms for smoother appearance
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 600, // Increased from 320ms for more fluid motion
          useNativeDriver: true
        })
      ]).start();
    } else {
      // Enhanced exit animation with smoother fade
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400, // Increased from 200ms for smoother fade
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          toValue: 8, // Increased from 6 for better visual feedback
          duration: 400, // Increased from 200ms
          useNativeDriver: true
        })
      ]).start();
    }
  }, [visible]);

  // Auto-expand when there are active steps or new content
  useEffect(() => {
    const hasActiveStep = steps.some(s => s.status === 'active');
    if (hasActiveStep && collapsed) {
      setIsExpanded(true);
    }
  }, [steps, collapsed]);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
    onToggle && onToggle();
  };

  if (!visible) return null;

  const active = steps.find(s => s.status === 'active');
  const completed = steps.filter(s => s.status === 'completed');
  const pct = steps.length ? Math.round((completed.length / steps.length) * 100) : 0;

  // Calculate dynamic height based on content
  const baseHeight = 60; // Collapsed height
  const stepHeight = 32; // Height per reasoning step
  const dynamicHeight = isExpanded ? baseHeight + (steps.length * stepHeight) + 20 : baseHeight;

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <View style={[styles.inner, { minHeight: dynamicHeight }]}>
        {/* Header - Always visible */}
        <TouchableOpacity style={styles.header} onPress={toggleExpanded} activeOpacity={0.8}>
          <View style={styles.leftIcon}>
            <Ionicons name="sparkles" size={14} color={colors.primary} />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {active ? active.title || 'Thinking' : 'Analyzing'}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {active ? active.description || 'Processing...' : `${completed.length}/${steps.length} steps`}
            </Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Expandable Content - Dynamic reasoning steps */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />
            {steps.map((step, index) => {
              const id = step.id || index.toString();
              if (!stepAnim.current[id]) {
                stepAnim.current[id] = {
                  opacity: new Animated.Value(0),
                  translateY: new Animated.Value(12) // Larger initial offset for smoother entrance
                };
                // Enhanced staggered entrance with much smoother timing
                setTimeout(() => {
                  Animated.parallel([
                    Animated.timing(stepAnim.current[id].opacity, {
                      toValue: 1,
                      duration: 500, // Increased from 320ms for smoother appearance
                      useNativeDriver: true
                    }),
                    Animated.timing(stepAnim.current[id].translateY, {
                      toValue: 0,
                      duration: 600, // Increased from 380ms for more fluid motion
                      useNativeDriver: true
                    })
                  ]).start();
                }, index * 120); // Increased stagger from 80ms for better visual flow
              }
              const isActive = step.status === 'active';
              const isDone = step.status === 'completed';
              // Enhanced animate transition to completed with much smoother feedback
              const prev = prevStatuses.current[id];
              if (prev && prev !== step.status && isDone) {
                // Much smoother fade to completed state
                Animated.timing(stepAnim.current[id].opacity, {
                  toValue: 0.6, // More visible when completed
                  duration: 700, // Much longer for smoother transition
                  useNativeDriver: true
                }).start();
              } else if (isActive) {
                // Enhanced active state with smoother micro-bounce for attention
                stepAnim.current[id].opacity.stopAnimation(() => {
                  Animated.sequence([
                    Animated.timing(stepAnim.current[id].opacity, {
                      toValue: 1,
                      duration: 350, // Increased from 200ms for smoother transition
                      useNativeDriver: true
                    }),
                    // Smoother micro-bounce for active feedback
                    Animated.timing(stepAnim.current[id].translateY, {
                      toValue: -2, // Slightly larger bounce
                      duration: 250, // Increased from 150ms for smoother motion
                      useNativeDriver: true
                    }),
                    Animated.timing(stepAnim.current[id].translateY, {
                      toValue: 0,
                      duration: 300, // Increased from 150ms for smoother return
                      useNativeDriver: true
                    })
                  ]).start();
                });
              }
              prevStatuses.current[id] = step.status;
              return (
                <Animated.View key={id} style={[styles.stepRow, {
                  opacity: isDone && !isActive ? stepAnim.current[id].opacity : stepAnim.current[id].opacity,
                  transform: [{ translateY: stepAnim.current[id].translateY }]
                }]}>
                  <View style={styles.stepIcon}>
                    {step.status === 'completed' ? (
                      <Ionicons name="checkmark-circle" size={16} color={colors.success || '#10b981'} />
                    ) : step.status === 'active' ? (
                      <View style={styles.activeIndicator}>
                        <View style={styles.pulse} />
                      </View>
                    ) : step.status === 'uncertain' ? (
                      <Ionicons name="help-circle" size={16} color="#ff8c00" />
                    ) : step.status === 'error' ? (
                      <Ionicons name="warning" size={16} color="#d9534f" />
                    ) : (
                      <View style={styles.pendingIndicator} />
                    )}
                  </View>
                  <View style={[styles.stepContent, (isDone && !isActive) && styles.stepContentCompleted]}>
                    <Text style={[styles.stepTitle, (isActive) && styles.stepTitleActive]}>{step.title || `Step ${index + 1}`}</Text>
                    {step.description && (
                      <Text style={[styles.stepDescription]} numberOfLines={2}>
                        {step.description}
                      </Text>
                    )}
                    {step.duration && step.status === 'completed' && (
                      <Text style={[styles.stepDuration]}>{step.duration}ms</Text>
                    )}
                  </View>
                </Animated.View>
              )
            })}

            {/* Show current thinking if active step */}
            {active && (
              <View style={styles.currentThought}>
                <Text style={styles.thoughtLabel}>Current thought:</Text>
                <Text style={styles.thoughtText}>{active.description || 'Processing...'}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  inner: {
    backgroundColor: 'rgba(45,106,79,0.08)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  leftIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(45,106,79,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  textBlock: {
    flex: 1
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  progressBarBg: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginTop: 6
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2
  },

  // Expandable content styles
  expandedContent: {
    paddingTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingLeft: 4,
  },
  stepRowCompleted: {
    opacity: 0.45,
  },
  stepIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  activeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // Enhanced shadow for premium feel
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    opacity: 0.9, // Slightly more visible
    // Add subtle glow effect
    shadowColor: 'white',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 2,
  },
  pendingIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.15)', // Slightly lighter
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  stepContent: {
    flex: 1,
  },
  stepContentCompleted: {
    // inherits dim opacity from row; extra adjustments if needed later
  },
  stepTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  stepDescription: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
  stepDuration: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
    opacity: 0.7,
  },
  stepTextCompleted: {
    // rely on parent opacity; could further tweak color if necessary
  },
  currentThought: {
    backgroundColor: 'rgba(45,106,79,0.06)',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  thoughtLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  thoughtText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});

export default InlineReasoningRow;
