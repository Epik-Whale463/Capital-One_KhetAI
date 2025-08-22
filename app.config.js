// Expo dynamic config – injects .env values into the JS bundle via extra
// Reference: https://docs.expo.dev/workflow/configuration/#app-configjs
// Loads .env at build/start time only (NOT refreshed until next restart)
require('dotenv').config();

module.exports = ({ config }) => {
	return {
		...config,
		name: config?.name || 'KhetAI',
		slug: config?.slug || 'Khet-ai',
		version: config?.version || '1.0.0',
		android: {
			// Unique reverse-DNS style package name (adjust if you own a domain)
			package: process.env.ANDROID_PACKAGE || 'com.khetai.app',
			versionCode: parseInt(process.env.ANDROID_VERSION_CODE || '1', 10)
		},
		ios: {
			bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.khetai.app'
		},
		plugins: [
			...(config?.plugins || []),
			'expo-font',
			'expo-audio',
			'expo-video'
		],
		extra: {
			...(config?.extra || {}),
			OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY || process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || null,
			SARVAM_API_KEY: process.env.SARVAM_API_KEY || process.env.EXPO_PUBLIC_SARVAM_API_KEY || null,
			GROQ_API_KEY: process.env.GROQ_API_KEY || process.env.EXPO_PUBLIC_GROQ_API_KEY || null,
			NEWS_API_KEY: process.env.NEWS_API_KEY || process.env.EXPO_PUBLIC_NEWS_API_KEY || null,
			PLANTNET_API_KEY: process.env.PLANTNET_API_KEY || process.env.EXPO_PUBLIC_PLANTNET_API_KEY || null,
			DATA_GOV_API_KEY: process.env.DATA_GOV_API_KEY || process.env.EXPO_PUBLIC_DATA_GOV_API_KEY || null,
			eas: { projectId: process.env.EAS_PROJECT_ID || (config?.extra?.eas?.projectId) }
		}
	};
};
