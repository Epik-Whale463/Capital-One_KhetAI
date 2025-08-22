import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';

import { useChat } from '../context/ChatContext';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../localization/translations';

const RecentConversations = () => {
  const { getRecentConversations } = useChat();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useTranslation(user?.language);
  const conversations = getRecentConversations(5); // Get last 5 conversations

  if (conversations.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.sectionTitle}>{t('recentConversations')}</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>{t('noConversations')}</Text>
          <Text style={styles.emptySubtext}>{t('noConversationsSubtext')}</Text>
          <TouchableOpacity 
            style={styles.startChatButton}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.startChatText}>{t('startChatting')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const ConversationBubble = ({ conversation }) => {
    const formatTimestamp = (timestamp) => {
      const now = new Date();
      const messageTime = new Date(timestamp);
      const diffInHours = Math.floor((now - messageTime) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return t('justNow');
      if (diffInHours < 24) return `${diffInHours}${t('hoursAgo')}`;
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `${diffInDays}${t('daysAgo')}`;
      return messageTime.toLocaleDateString();
    };

    return (
      <TouchableOpacity 
        style={styles.conversationCard}
        onPress={() => navigation.navigate('Chat')}
      >
        <View style={styles.conversationHeader}>
          <View style={styles.typeIndicator}>
            <Ionicons 
              name={conversation.type === 'voice' ? 'mic' : 'chatbubble'} 
              size={16} 
              color={colors.primary} 
            />
          </View>
          <Text style={styles.timestamp}>{formatTimestamp(conversation.timestamp)}</Text>
        </View>
        
        <View style={styles.questionBubble}>
          <Text style={styles.questionText}>{conversation.question}</Text>
        </View>
        
        <View style={styles.answerBubble}>
          <Text style={styles.answerText} numberOfLines={3}>
            {conversation.answer.replace(/\*\*/g, '').replace(/[#*-]/g, '')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{t('recentConversations')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Chat')}>
          <Text style={styles.viewAllText}>{t('viewAll')}</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {conversations.map((conversation) => (
          <ConversationBubble key={conversation.id} conversation={conversation} />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  conversationCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E6F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  timestamp: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  replayButton: {
    padding: 4,
  },
  questionBubble: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  questionText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  answerBubble: {
    backgroundColor: '#F8FDF8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  answerText: {
    fontSize: 12, // Reduced font size for consistency
    color: colors.textPrimary,
    lineHeight: 16, // Adjusted line height for better readability
    padding: 16, // Added padding for consistent spacing
    wordWrap: 'break-word', // Ensures proper text wrapping
  },
  expandButton: {
    marginTop: 4,
  },
  expandText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  startChatButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startChatText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RecentConversations;