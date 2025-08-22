import * as Location from 'expo-location';
import { Alert } from 'react-native';

export class LocationService {
    static async requestLocationPermission() {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            return status === 'granted';
        } catch (error) {
            console.error('Error requesting location permission:', error);
            return false;
        }
    }

    static async getCurrentLocation() {
        try {
            const hasPermission = await this.requestLocationPermission();

            if (!hasPermission) {
                Alert.alert(
                    'Location Permission Required',
                    'Please enable location services to get personalized farming advice for your area.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
                    ]
                );
                return null;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                timeout: 10000,
            });

            return location;
        } catch (error) {
            console.error('Error getting current location:', error);
            Alert.alert(
                'Location Error',
                'Unable to get your current location. Please check your GPS settings.',
                [{ text: 'OK' }]
            );
            return null;
        }
    }

    static async reverseGeocode(latitude, longitude) {
        // Basic coordinate validation (avoid meaningless geocoder calls)
        const isValidNumber = (n) => typeof n === 'number' && isFinite(n);
        if (!isValidNumber(latitude) || !isValidNumber(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            console.error('Invalid coordinates supplied to reverseGeocode:', { latitude, longitude });
            return null;
        }

        const MAX_RETRIES = 3; // keep small to avoid hammering underlying Android geocoder
        let lastError = null;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const reverseGeocodedAddress = await Location.reverseGeocodeAsync({
                    latitude,
                    longitude,
                });

                if (Array.isArray(reverseGeocodedAddress) && reverseGeocodedAddress.length > 0) {
                    const address = reverseGeocodedAddress[0];
                    const locationString = this.formatAddress(address);
                    return {
                        formatted: locationString,
                        city: address.city || address.subregion,
                        state: address.region,
                        country: address.country,
                        district: address.district,
                        postalCode: address.postalCode,
                        coordinates: { latitude, longitude }
                    };
                }
                return null; // No address found (do not fabricate)
            } catch (error) {
                lastError = error;
                const message = String(error?.message || error);
                const isTransient = /UNAVAILABLE|E_LOCATION_REVERSE_GEOCODE_FAILED|io\.IOException/i.test(message);
                const shouldRetry = isTransient && attempt < MAX_RETRIES;
                console.error(`Error reverse geocoding (attempt ${attempt}/${MAX_RETRIES})${shouldRetry ? ' - will retry' : ''}:`, message);
                if (shouldRetry) {
                    // Exponential backoff-ish delay
                    await new Promise(res => setTimeout(res, 400 * attempt));
                    continue;
                }
                // Non-transient or final failure: stop
                break;
            }
        }
        // After retries, give up without returning fabricated data
        return null;
    }

    static formatAddress(address) {
        const parts = [];

        if (address.city || address.subregion) {
            parts.push(address.city || address.subregion);
        }

        if (address.region && address.region !== (address.city || address.subregion)) {
            parts.push(address.region);
        }

        if (address.country && address.country !== 'India') {
            parts.push(address.country);
        }

        return parts.join(', ') || 'Unknown Location';
    }

    static async getLocationWithAddress() {
        try {
            const location = await this.getCurrentLocation();

            if (!location) {
                return null;
            }

            const { latitude, longitude } = location.coords;
            const addressInfo = await this.reverseGeocode(latitude, longitude);

            return {
                coordinates: { latitude, longitude },
                address: addressInfo || {
                    formatted: 'Unknown Location',
                    city: null,
                    state: null,
                    country: 'India'
                }
            };
        } catch (error) {
            console.error('Error getting location with address:', error);
            return null;
        }
    }

    static getLocationEmoji(state) {
        const stateEmojis = {
            'Punjab': '🌾',
            'Haryana': '🌾',
            'Uttar Pradesh': '🌾',
            'Madhya Pradesh': '🌾',
            'Rajasthan': '🐪',
            'Gujarat': '🌾',
            'Maharashtra': '🍇',
            'Karnataka': '☕',
            'Tamil Nadu': '🌴',
            'Andhra Pradesh': '🌶️',
            'Telangana': '🌶️',
            'Kerala': '🥥',
            'West Bengal': '🐟',
            'Bihar': '🌾',
            'Odisha': '🌾',
            'Assam': '🍃',
        };

        return stateEmojis[state] || '📍';
    }
}