import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../styles/colors';

const AgentStatus = ({ isActive, agent, message }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Animated dots
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      dotAnim.stopAnimation();
    }
  }, [isActive]);

  if (!isActive) return null;

  const getAgentEmoji = (agentType) => {
    switch (agentType) {
      case 'weather': return '🌦️';
      case 'market': return '💰';
      case 'pest': return '🐛';
      case 'soil': return '🌱';
      case 'irrigation': return '💧';
      default: return '🤖';
    }
  };

  const getAgentColor = (agentType) => {
    switch (agentType) {
      case 'weather': return colors.info;
      case 'market': return colors.secondary;
      case 'pest': return colors.warning;
      case 'soil': return colors.success;
      case 'irrigation': return colors.tertiary;
      default: return colors.primary;
    }
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        { 
          opacity: fadeAnim,
          backgroundColor: `${getAgentColor(agent)}15`
        }
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.emoji}>{getAgentEmoji(agent)}</Text>
        <Text style={styles.message}>{message}</Text>
        
        {/* Animated dots */}
        <View style={styles.dotsContainer}>
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: getAgentColor(agent),
                  opacity: dotAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                  transform: [
                    {
                      scale: dotAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 1.2, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 16,
    marginRight: 8,
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  },
});

export default AgentStatus;