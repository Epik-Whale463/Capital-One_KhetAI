import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';

const NewsFlashcard = ({ card }) => {
  const openLink = () => {
    if (card.url) Linking.openURL(card.url).catch(()=>{});
  };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{card.title}</Text>
      {card.bullets?.length > 0 && (
        <View style={styles.bullets}>
          {card.bullets.map((b,i)=> (
            <Text key={i} style={styles.bullet}>• {b}</Text>
          ))}
        </View>
      )}
      {card.question && card.answer && (
        <View style={styles.flashcardBox}>
          <Text style={styles.qaLabel}>Flashcard</Text>
          <Text style={styles.question}>Q: {card.question}</Text>
          <Text style={styles.answer}>A: {card.answer}</Text>
        </View>
      )}
      {card.error && <Text style={styles.error}>Error: {card.error}</Text>}
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{card.source || 'Source'}{card.publishedAt ? ' • ' + new Date(card.publishedAt).toLocaleDateString() : ''}</Text>
        {card.url && (
          <TouchableOpacity onPress={openLink} style={styles.linkBtn}>
            <Ionicons name="open-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)'
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6
  },
  bullets: { marginBottom: 8 },
  bullet: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
    marginBottom: 2
  },
  flashcardBox: {
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
    marginBottom: 8
  },
  qaLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4
  },
  question: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  answer: { fontSize: 11, color: colors.textSecondary },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 11, color: colors.textSecondary },
  linkBtn: { padding: 4 },
  error: { fontSize: 12, color: colors.danger, marginTop: 4 }
});

export default NewsFlashcard;
