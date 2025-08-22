import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const storedConversations = await AsyncStorage.getItem('conversations');
      if (storedConversations) {
        const parsedConversations = JSON.parse(storedConversations);
        setConversations(parsedConversations);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConversations = async (newConversations) => {
    try {
      await AsyncStorage.setItem('conversations', JSON.stringify(newConversations));
    } catch (error) {
      console.error('Error saving conversations:', error);
    }
  };

  const addMessage = async (message) => {
    const newMessage = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type: message.type || 'text',
      ...message
    };

    const updatedConversations = [newMessage, ...conversations];
    setConversations(updatedConversations);
    setCurrentConversation(newMessage);
    
    // Save to AsyncStorage
    await saveConversations(updatedConversations);
    
    return newMessage;
  };

  const clearConversations = async () => {
    setConversations([]);
    setCurrentConversation(null);
    try {
      await AsyncStorage.removeItem('conversations');
    } catch (error) {
      console.error('Error clearing conversations:', error);
    }
  };

  const getRecentConversations = (limit = 5) => {
    return conversations.slice(0, limit);
  };

  const deleteConversation = async (conversationId) => {
    const updatedConversations = conversations.filter(conv => conv.id !== conversationId);
    setConversations(updatedConversations);
    await saveConversations(updatedConversations);
  };

  const getConversationStats = () => {
    const totalConversations = conversations.length;
    const voiceConversations = conversations.filter(conv => conv.type === 'voice').length;
    const textConversations = conversations.filter(conv => conv.type === 'text').length;
    
    const today = new Date().toDateString();
    const todayConversations = conversations.filter(conv => 
      new Date(conv.timestamp).toDateString() === today
    ).length;

    return {
      total: totalConversations,
      voice: voiceConversations,
      text: textConversations,
      today: todayConversations
    };
  };

  const value = {
    conversations,
    currentConversation,
    isLoading,
    addMessage,
    updateMessage: async (id, partial) => {
      let changed = false;
      const updated = conversations.map(msg => {
        if (msg.id === id) {
          changed = true;
          return { ...msg, ...partial };
        }
        return msg;
      });
      if (changed) {
        setConversations(updated);
        await saveConversations(updated);
      }
      return updated.find(m => m.id === id) || null;
    },
    clearConversations,
    getRecentConversations,
    deleteConversation,
    getConversationStats,
    setCurrentConversation
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};