import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { spacing } from '../styles/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Optional custom tab bar: calmer farmer-focused design.
export default function CalmTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const bottomPad = (insets.bottom || 0) + spacing.sm; // ensure at least small padding above gesture bar
  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}> 
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel !== undefined
          ? options.tabBarLabel
          : options.title !== undefined
            ? options.title
            : route.name;
        const isFocused = state.index === index;
        let iconName = 'ellipse';
        if (route.name === 'Home') iconName = isFocused ? 'home' : 'home-outline';
        else if (route.name === 'Crops') iconName = isFocused ? 'library' : 'library-outline';
        else if (route.name === 'Settings') iconName = isFocused ? 'settings' : 'settings-outline';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity key={route.key} accessibilityRole="button" accessibilityState={isFocused ? { selected: true } : {}} onPress={onPress} style={styles.item} hitSlop={{ top:6, bottom:6, left:12, right:12 }}>
            <Ionicons name={iconName} size={22} color={isFocused ? colors.primary : colors.textLight} />
            <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: spacing.md,
    paddingTop: 4,
    // paddingBottom dynamic via insets
    justifyContent: 'space-around'
  },
  item: { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:6, minHeight: 50 },
  label: { fontSize:11, color: colors.textLight, marginTop:2, fontWeight:'600' },
  labelActive: { color: colors.primary }
});
