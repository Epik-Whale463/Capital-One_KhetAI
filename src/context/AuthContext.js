import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationService } from '../services/LocationService';
import { getTranslation } from '../localization/translations';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (mobile, password) => {
    try {
      // Validate input
      if (!mobile || !password) {
        return { success: false, error: getTranslation('fillAllFields', 'english') };
      }

      // Validate mobile number format (Indian mobile numbers)
      const mobileRegex = /^[6-9]\d{9}$/;
      if (!mobileRegex.test(mobile)) {
        return { success: false, error: getTranslation('invalidMobile', 'english') };
      }

      // Check if user exists in storage
      const existingUsers = await AsyncStorage.getItem('registeredUsers');
      const users = existingUsers ? JSON.parse(existingUsers) : [];
      
      const user = users.find(u => u.mobile === mobile && u.password === password);
      
      if (!user) {
        return { success: false, error: getTranslation('invalidCredentials', 'english') };
      }

      // Get user's current location for updated info
      const locationData = await LocationService.getLocationWithAddress();
      
      let currentLocation = user.location || 'India';
      let coordinates = user.coordinates || null;
      
      if (locationData) {
        currentLocation = locationData.address.formatted;
        coordinates = locationData.coordinates;
      }

      // Update user with current location
      const updatedUser = {
        ...user,
        location: currentLocation,
        coordinates: coordinates,
        lastLogin: new Date().toISOString()
      };

      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: getTranslation('loginFailed', 'english') };
    }
  };

  const register = async (userData) => {
    try {
      // Validate input
      if (!userData.name || !userData.mobile || !userData.password) {
        return { success: false, error: getTranslation('fillAllFields', 'english') };
      }

      // Validate mobile number format
      const mobileRegex = /^[6-9]\d{9}$/;
      if (!mobileRegex.test(userData.mobile)) {
        return { success: false, error: getTranslation('invalidMobile', 'english') };
      }

      // Validate password strength
      if (userData.password.length < 6) {
        return { success: false, error: getTranslation('passwordTooShort', 'english') };
      }

      // Check if user already exists
      const existingUsers = await AsyncStorage.getItem('registeredUsers');
      const users = existingUsers ? JSON.parse(existingUsers) : [];
      
      const existingUser = users.find(u => u.mobile === userData.mobile);
      if (existingUser) {
        return { success: false, error: getTranslation('mobileAlreadyRegistered', 'english') };
      }

      // Get user's location
      const locationData = await LocationService.getLocationWithAddress();
      
      let locationString = userData.location || 'India';
      let coordinates = null;
      
      if (locationData) {
        locationString = locationData.address.formatted;
        coordinates = locationData.coordinates;
      }

      // Create new user
      const newUser = {
        id: Date.now().toString(),
        name: userData.name.trim(),
        mobile: userData.mobile,
        password: userData.password, // In production, hash this password
        language: userData.language || 'english',
        preferVoice: userData.preferVoice || false,
        location: locationString,
        coordinates: coordinates,
        crops: [],
        farmSize: '0 acres',
        registeredAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      // Save to registered users list
      users.push(newUser);
      await AsyncStorage.setItem('registeredUsers', JSON.stringify(users));

      // Set as current user
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: getTranslation('registrationFailed', 'english') };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const updateUser = async (updatedData) => {
    try {
      const updatedUser = { ...user, ...updatedData };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const updateLocation = async () => {
    try {
      const locationData = await LocationService.getLocationWithAddress();
      
      if (locationData && user) {
        const updatedUser = {
          ...user,
          location: locationData.address.formatted,
          coordinates: locationData.coordinates
        };
        
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        return { success: true, location: locationData.address.formatted };
      }
      
      return { success: false, error: 'Unable to get location' };
    } catch (error) {
      console.error('Error updating location:', error);
      return { success: false, error: 'Location update failed' };
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    updateUser,
    updateLocation
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};