import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../styles/colors';

const TypingIndicator = ({ isVisible }) => {
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;
  const containerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // Container fade in
      Animated.timing(containerAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Staggered dot animations
      const animateDots = () => {
        Animated.loop(
          Animated.stagger(200, [
            Animated.sequence([
              Animated.timing(dot1Anim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
              }),
              Animated.timing(dot1Anim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(dot2Anim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
              }),
              Animated.timing(dot2Anim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(dot3Anim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
              }),
              Animated.timing(dot3Anim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
              }),
            ]),
          ])
        ).start();
      };

      animateDots();
    } else {
      // Fade out
      Animated.timing(containerAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Stop animations
      dot1Anim.stopAnimation();
      dot2Anim.stopAnimation();
      dot3Anim.stopAnimation();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        { opacity: containerAnim }
      ]}
    >
      <View style={styles.bubbleContainer}>
        <View style={styles.avatar}>
          <LinearGradient
            colors={[colors.primary, colors.tertiary]}
            style={styles.avatarGradient}
          >
            <Text style={styles.avatarEmoji}>🌾</Text>
          </LinearGradient>
        </View>

        <View style={styles.typingBubble}>
          <View style={styles.dotsContainer}>
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: dot1Anim,
                  transform: [
                    {
                      scale: dot1Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: dot2Anim,
                  transform: [
                    {
                      scale: dot2Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: dot3Anim,
                  transform: [
                    {
                      scale: dot3Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    marginHorizontal: 12,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  bubbleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  avatar: {
    marginRight: 8,
  },
  avatarGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  typingBubble: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 202, 58, 0.15)',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginHorizontal: 2,
  },
});

export default TypingIndicator;