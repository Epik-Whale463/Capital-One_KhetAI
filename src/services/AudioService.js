import { Alert } from 'react-native';

// Simplified AudioService that provides basic functionality
// This will work without the complex audio recording for now
export class AudioService {
    static recording = null;
    static player = null;

    // Request audio permissions (simplified)
    static async requestPermissions() {
        try {
            // For now, return true - in a real app you'd implement proper permissions
            return true;
        } catch (error) {
            console.error('Error requesting audio permissions:', error);
            return false;
        }
    }

    // Start recording (mock implementation)
    static async startRecording() {
        try {
            const hasPermission = await this.requestPermissions();

            if (!hasPermission) {
                Alert.alert(
                    'Microphone Permission Required',
                    'Please enable microphone access to use voice features.',
                    [{ text: 'OK' }]
                );
                return { success: false, error: 'Permission denied' };
            }

            console.log('Starting audio recording...');
            this.recording = { id: Date.now() };

            return { success: true, recording: this.recording };
        } catch (error) {
            console.error('Error starting recording:', error);
            return { success: false, error: error.message };
        }
    }

    // Stop recording (mock implementation)
    static async stopRecording() {
        try {
            if (!this.recording) {
                return { success: false, error: 'No active recording' };
            }

            console.log('Stopping audio recording...');
            
            // Mock audio data
            const mockBlob = new Blob(['mock audio data'], { type: 'audio/wav' });
            const uri = 'mock://audio.wav';
            const duration = 3000; // 3 seconds

            this.recording = null;

            return {
                success: true,
                uri,
                blob: mockBlob,
                duration: duration
            };
        } catch (error) {
            console.error('Error stopping recording:', error);
            return { success: false, error: error.message };
        }
    }

    // Play audio from URL (mock implementation)
    static async playAudio(audioUrl) {
        try {
            console.log('Playing audio:', audioUrl);
            
            // Check for turboModuleProxy availability
            if (typeof globalThis.__turboModuleProxy === 'undefined') {
                throw new Error('Audio playback not supported on this platform');
            }
            
            // Stop any currently playing sound
            if (this.player) {
                this.player = null;
            }

            // Mock player
            this.player = { id: Date.now(), url: audioUrl };

            console.log('Audio playback started successfully');
            return { success: true };
        } catch (error) {
            console.error('Error playing audio:', error);
            
            // Handle specific turboModuleProxy errors
            if (error.message.includes('turboModuleProxy')) {
                throw new Error('Audio playback not supported on this device');
            }
            
            return { success: false, error: error.message };
        }
    }

    // Stop current audio playback
    static async stopAudio() {
        try {
            if (this.player) {
                console.log('Stopping audio playback');
                this.player = null;
            }
            return { success: true };
        } catch (error) {
            console.error('Error stopping audio:', error);
            return { success: false, error: error.message };
        }
    }

    // Check if currently recording
    static isRecording() {
        return this.recording !== null;
    }

    // Check if currently playing
    static isPlaying() {
        return this.player !== null;
    }

    // Get recording duration
    static async getRecordingDuration() {
        return 0;
    }

    // Cleanup resources
    static async cleanup() {
        try {
            this.recording = null;
            this.player = null;
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}