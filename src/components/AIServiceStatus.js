import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import HybridAIService from '../services/HybridAIService';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../localization/translations';

// Create instance of HybridAIService
const hybridAIService = new HybridAIService();

const AIServiceStatus = ({ compact = false }) => {
  const { user } = useAuth();
  const { t } = useTranslation(user?.language);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    checkServiceStatus();
  }, []);

  const checkServiceStatus = async () => {
    try {
  // Check groq availability
  const groqAvailable = await hybridAIService.groq.checkAvailability();
      
      // Check Sarvam configuration
      const sarvamConfigured = hybridAIService.sarvam.isConfigured();
      
      setServiceStatus({
        groq: {
          available: groqAvailable,
          status: groqAvailable ? 'connected' : 'disconnected'
        },
        sarvam: {
          configured: sarvamConfigured,
          status: sarvamConfigured ? 'configured' : 'not_configured'
        },
  overall: groqAvailable ? 'operational' : 'limited'
      });
    } catch (error) {
      console.error('Error checking service status:', error);
      setServiceStatus({
        overall: 'error',
        error: error.message
      });
    }
  };

  const getStatusIcon = (available) => {
    return available ? 'checkmark-circle' : 'alert-circle';
  };

  const getStatusColor = (available) => {
    return available ? colors.success : colors.warning;
  };

  if (!serviceStatus) {
    return null;
  }

  if (compact) {
    return (
      <TouchableOpacity 
        style={styles.compactContainer} 
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.compactHeader}>
          <Ionicons 
            name="hardware-chip" 
            size={16} 
            color={serviceStatus.availability.groq ? colors.success : colors.primary} 
          />
          <Text style={styles.compactText}>
            {serviceStatus.availability.groq ? 'Groq AI' : 'Basic AI'}
          </Text>
          <Ionicons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={12} 
            color={colors.textSecondary} 
          />
        </View>
        
        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.serviceRow}>
              <Ionicons 
          name={getStatusIcon(serviceStatus.availability.groq)} 
            size={14} 
            color={getStatusColor(serviceStatus.availability.groq)} 
              />
              <Text style={styles.serviceText}>AI Reasoning: {serviceStatus.aiReasoning}</Text>
            </View>
            <View style={styles.serviceRow}>
              <Ionicons 
                name={getStatusIcon(serviceStatus.availability.sarvam)} 
                size={14} 
                color={getStatusColor(serviceStatus.availability.sarvam)} 
              />
              <Text style={styles.serviceText}>Voice & Translation: {serviceStatus.voiceServices}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="settings" size={20} color={colors.primary} />
        <Text style={styles.title}>AI Services Status</Text>
        <TouchableOpacity onPress={checkServiceStatus}>
          <Ionicons name="refresh" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.servicesGrid}>
        <View style={styles.serviceCard}>
          <View style={styles.serviceHeader}>
            <Ionicons 
              name={getStatusIcon(serviceStatus.availability.groq)} 
              size={20} 
              color={getStatusColor(serviceStatus.availability.groq)} 
            />
            <Text style={styles.serviceName}>AI Reasoning</Text>
          </View>
          <Text style={styles.serviceValue}>{serviceStatus.aiReasoning}</Text>
          <Text style={styles.serviceDescription}>
            {serviceStatus.availability.groq 
              ? 'Advanced cloud AI models for intelligent farming advice'
              : 'Basic rule-based farming recommendations'
            }
          </Text>
        </View>

        <View style={styles.serviceCard}>
          <View style={styles.serviceHeader}>
            <Ionicons 
              name={getStatusIcon(serviceStatus.availability.sarvam)} 
              size={20} 
              color={getStatusColor(serviceStatus.availability.sarvam)} 
            />
            <Text style={styles.serviceName}>Voice & Translation</Text>
          </View>
          <Text style={styles.serviceValue}>{serviceStatus.voiceServices}</Text>
          <Text style={styles.serviceDescription}>
            {serviceStatus.availability.sarvam 
              ? 'Multilingual voice interaction and translation'
              : 'Voice services not available'
            }
          </Text>
        </View>
      </View>

      <View style={styles.modeIndicator}>
        <Ionicons name="layers" size={16} color={colors.tertiary} />
        <Text style={styles.modeText}>Mode: {serviceStatus.mode}</Text>
        <Text style={styles.modeDescription}>
          {serviceStatus.availability.groq 
            ? 'Workflow: Sarvam ASR → Groq Chat → Sarvam Translation → Sarvam TTS'
            : 'Using cloud-based services with fallback support'
          }
        </Text>
      </View>

      {serviceStatus.availability.groq && (
        <View style={styles.groqInfo}>
          <Text style={styles.groqTitle}>Available Groq Models:</Text>
          <Text style={styles.groqModels}>
            • qwen2.5:3b (Simple queries - Fast & efficient){'\n'}
            • qwen2.5:7b-instruct-q5_K_M (Tool-enabled queries){'\n'}
            • Smart model selection based on complexity
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compactContainer: {
    backgroundColor: 'rgba(45, 106, 79, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginHorizontal: 4,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactText: {
    fontSize: 12,
    color: colors.textPrimary,
    marginLeft: 4,
    marginRight: 4,
    fontWeight: '500',
  },
  expandedContent: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(45, 106, 79, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginLeft: 8,
    flex: 1,
  },
  servicesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: 'rgba(248, 246, 240, 0.5)',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 6,
  },
  serviceValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  serviceText: {
    fontSize: 11,
    color: colors.textPrimary,
    marginLeft: 6,
  },
  modeIndicator: {
    backgroundColor: 'rgba(255, 202, 58, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 6,
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  groqInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(87, 204, 153, 0.06)',
    borderRadius: 8,
  },
  groqTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  groqModels: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  }
});

export default AIServiceStatus;