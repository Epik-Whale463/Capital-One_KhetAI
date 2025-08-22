import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../localization/translations';
import { colors } from '../styles/colors';

const RecentConversationsPreview = () => {
    const navigation = useNavigation();
    const { getRecentConversations } = useChat();
    const { user } = useAuth();
    const { t } = useTranslation(user?.language);
    const recentConversations = getRecentConversations(3); // Show only 3 recent

    if (recentConversations.length === 0) {
        return null; // Don't show anything if no conversations
    }

    const handleViewAllChats = () => {
        navigation.navigate('Chat');
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.sectionTitle}>{t('recentConversations')}</Text>
                <TouchableOpacity onPress={handleViewAllChats} style={styles.viewAllButton}>
                    <Text style={styles.viewAllText}>{t('viewAll')}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {recentConversations.map((conversation, index) => (
                <TouchableOpacity
                    key={conversation.id}
                    style={styles.conversationPreview}
                    onPress={handleViewAllChats}
                >
                    <View style={styles.conversationHeader}>
                        <Ionicons
                            name={conversation.type === 'voice' ? 'mic' : 'chatbubble'}
                            size={16}
                            color={colors.primary}
                        />
                        <Text style={styles.timestamp}>
                            {new Date(conversation.timestamp).toLocaleTimeString()}
                        </Text>
                    </View>
                    <Text style={styles.questionPreview} numberOfLines={1}>
                        {conversation.question}
                    </Text>
                    <Text style={styles.answerPreview} numberOfLines={2}>
                        {conversation.answer.replace(/\*\*/g, '').replace(/[#*-]/g, '')} {/* Remove markdown */}
                    </Text>
                </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.startChatButton} onPress={handleViewAllChats}>
                <Ionicons name="chatbubbles" size={20} color={colors.primary} />
                <Text style={styles.startChatText}>{t('continueChatting')}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
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
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    viewAllText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
        marginRight: 4,
    },
    conversationPreview: {
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        shadowColor: colors.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    conversationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    timestamp: {
        fontSize: 11,
        color: colors.textSecondary,
        marginLeft: 6,
    },
    questionPreview: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    answerPreview: {
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 16,
    },
    startChatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(45, 106, 79, 0.1)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(45, 106, 79, 0.2)',
    },
    startChatText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
        marginHorizontal: 8,
    },
});

export default RecentConversationsPreview;