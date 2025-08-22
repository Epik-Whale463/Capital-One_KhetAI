import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { spacing } from '../styles/layout';

// Minimal, reusable header focused on clarity for the farmer.
// Props: title (string), subtitle (string, optional), onBack (function, optional), right (node, optional)
export default function CalmHeader({ title, subtitle, onBack, right }) {
  return (
    <View style={styles.container}>
      <View style={styles.leftGroup}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        <View style={styles.textBlock}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          {!!subtitle && <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  leftGroup: { flexDirection: 'row', alignItems: 'center', flex:1 },
  backBtn: { marginRight: spacing.sm, padding:4, borderRadius:8 },
  textBlock: { flex:1 },
  title: { fontSize:18, fontWeight:'700', color: colors.textPrimary },
  subtitle: { fontSize:12, color: colors.textSecondary, marginTop:2 },
  right: { marginLeft: spacing.md }
});
