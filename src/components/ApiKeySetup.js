/**
 * API Key Setup Component for Khet AI
 * Allows users to configure their API keys
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Alert,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import ConfigHelper from '../utils/configHelper';

const ApiKeySetup = ({ onComplete }) => {
  const [apiKeys, setApiKeys] = useState({
    openweatherApiKey: '',
    sarvamApiKey: '',
    plantnetApiKey: ''
  });
  const [configStatus, setConfigStatus] = useState({});

  useEffect(() => {
    // Load current configuration status
    const status = ConfigHelper.getConfigurationStatus();
    setConfigStatus(status);
  }, []);

  const handleSaveConfiguration = () => {
    try {
      // Initialize API keys
      ConfigHelper.initializeApiKeys(apiKeys);
      
      // Validate configuration
      const validation = ConfigHelper.validateConfiguration();
      
      if (validation.isValid) {
        Alert.alert(
          'Success',
          'API keys configured successfully! You can now use all Khet AI features.',
          [{ text: 'OK', onPress: onComplete }]
        );
      } else {
        Alert.alert(
          'Configuration Issues',
          validation.issues.join('\n\n'),
          [
            { text: 'Continue Anyway', onPress: onComplete },
            { text: 'Fix Issues', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', `Failed to save configuration: ${error.message}`);
    }
  };

  const openApiKeyInstructions = (service) => {
    const instructions = ConfigHelper.getApiKeyInstructions();
    const serviceInfo = instructions[service];
    
    Alert.alert(
      `Get ${service.toUpperCase()} API Key`,
      serviceInfo.steps.join('\n') + '\n\n' + serviceInfo.note,
      [
        { text: 'Open Website', onPress: () => Linking.openURL(serviceInfo.url) },
        { text: 'Close', style: 'cancel' }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="settings-outline" size={32} color={colors.primary} />
        <Text style={styles.title}>API Configuration</Text>
        <Text style={styles.subtitle}>
          Configure your API keys to enable all Khet AI features
        </Text>
      </View>

      {/* OpenWeather API Key */}
      <View style={styles.apiKeySection}>
        <View style={styles.apiKeyHeader}>
          <Text style={styles.apiKeyTitle}>OpenWeather API Key</Text>
          <View style={styles.statusBadge}>
            <Ionicons 
              name={configStatus.openweather?.configured ? "checkmark-circle" : "alert-circle"} 
              size={16} 
              color={configStatus.openweather?.configured ? colors.success : colors.warning} 
            />
            <Text style={[
              styles.statusText,
              { color: configStatus.openweather?.configured ? colors.success : colors.warning }
            ]}>
              {configStatus.openweather?.configured ? 'Configured' : 'Required'}
            </Text>
          </View>
        </View>
        <Text style={styles.description}>
          Required for weather services and irrigation advice
        </Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter your OpenWeather API key"
            value={apiKeys.openweatherApiKey}
            onChangeText={(text) => setApiKeys(prev => ({ ...prev, openweatherApiKey: text }))}
            secureTextEntry
          />
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => openApiKeyInstructions('openweather')}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sarvam AI API Key */}
      <View style={styles.apiKeySection}>
        <View style={styles.apiKeyHeader}>
          <Text style={styles.apiKeyTitle}>Sarvam AI API Key</Text>
          <View style={styles.statusBadge}>
            <Ionicons 
              name={configStatus.sarvam?.configured ? "checkmark-circle" : "alert-circle"} 
              size={16} 
              color={configStatus.sarvam?.configured ? colors.success : colors.info} 
            />
            <Text style={[
              styles.statusText,
              { color: configStatus.sarvam?.configured ? colors.success : colors.info }
            ]}>
              {configStatus.sarvam?.configured ? 'Configured' : 'Optional'}
            </Text>
          </View>
        </View>
        <Text style={styles.description}>
          For AI responses and translation (fallback key available)
        </Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter your Sarvam AI API key (optional)"
            value={apiKeys.sarvamApiKey}
            onChangeText={(text) => setApiKeys(prev => ({ ...prev, sarvamApiKey: text }))}
            secureTextEntry
          />
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => openApiKeyInstructions('sarvam')}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* PlantNet API Key */}
      <View style={styles.apiKeySection}>
        <View style={styles.apiKeyHeader}>
          <Text style={styles.apiKeyTitle}>PlantNet API Key</Text>
          <View style={styles.statusBadge}>
            <Ionicons 
              name="information-circle-outline" 
              size={16} 
              color={colors.info} 
            />
            <Text style={[styles.statusText, { color: colors.info }]}>
              Optional
            </Text>
          </View>
        </View>
        <Text style={styles.description}>
          For advanced plant disease identification from photos
        </Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter your PlantNet API key (optional)"
            value={apiKeys.plantnetApiKey}
            onChangeText={(text) => setApiKeys(prev => ({ ...prev, plantnetApiKey: text }))}
            secureTextEntry
          />
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => openApiKeyInstructions('plantnet')}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSaveConfiguration}>
        <Ionicons name="save-outline" size={20} color="white" />
        <Text style={styles.saveButtonText}>Save Configuration</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton} onPress={onComplete}>
        <Text style={styles.skipButtonText}>Skip for Now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 5,
  },
  apiKeySection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  apiKeyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  apiKeyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.background,
  },
  helpButton: {
    marginLeft: 8,
    padding: 8,
  },
  saveButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  skipButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 10,
  },
  skipButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});

export default ApiKeySetup;