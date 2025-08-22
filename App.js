import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ChatProvider } from './src/context/ChatContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import CropProjectsScreen from './src/screens/CropProjectsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AgriNewsScreen from './src/screens/AgriNewsScreen';
import { colors } from './src/styles/colors';
import CalmTabBar from './src/components/CalmTabBar';
import { useTranslation } from './src/localization/translations';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack navigator for Projects and Chat
function ProjectStack() {
    const { user } = useAuth();
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="CropsList">
                {(props) => <CropProjectsScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen name="ChatScreen" component={ChatScreen} />
        </Stack.Navigator>
    );
}

function LoadingScreen() {
    const { user } = useAuth();
    const { t } = useTranslation(user?.language);
    
    return (
        <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>🌾</Text>
            <Text style={styles.loadingSubtext}>{t('loadingApp')}</Text>
        </View>
    );
}

function TabNavigator() {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { t } = useTranslation(user?.language);

    return (
        <Tab.Navigator
            tabBar={(props) => <CalmTabBar {...props} />}
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Crops') {
                        iconName = focused ? 'library' : 'library-outline';
                    } else if (route.name === 'News') {
                        iconName = focused ? 'newspaper' : 'newspaper-outline';
                    } else if (route.name === 'Settings') {
                        iconName = focused ? 'settings' : 'settings-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                // Label & icon colors handled inside CalmTabBar
                headerShown: false,
            })}
        >
            <Tab.Screen 
                name="Home" 
                component={HomeScreen} 
                options={{ tabBarLabel: t('home') }}
            />
            <Tab.Screen 
                name="Crops" 
                component={ProjectStack} 
                options={{ tabBarLabel: 'Crops' }}
            />
            <Tab.Screen
                name="News"
                component={AgriNewsScreen}
                options={{ tabBarLabel: 'News' }}
            />
            <Tab.Screen 
                name="Settings" 
                component={SettingsScreen} 
                options={{ tabBarLabel: t('settings') }}
            />
        </Tab.Navigator>
    );
}

function AppContent() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <NavigationContainer>
            <StatusBar style="dark" />
            {isAuthenticated ? <TabNavigator /> : <LoginScreen />}
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <ChatProvider>
                    <AppContent />
                </ChatProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    loadingText: {
        fontSize: 48,
        marginBottom: 16,
    },
    loadingSubtext: {
        fontSize: 18,
        color: colors.textSecondary,
        fontWeight: '600',
    },
});