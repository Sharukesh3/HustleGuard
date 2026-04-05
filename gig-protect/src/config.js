import { Platform } from 'react-native';

/**
 * Get the base HTTP API URL
 * In production (Azure Web Apps), it uses EXPO_PUBLIC_API_URL
 * In local development, it intelligently switches between localhost and local IP
 */
export const getBaseUrl = () => {
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }
    const host = Platform.OS === 'web' ? 'localhost:8000' : '192.168.1.110:8000';
    return `http://${host}`;
};

/**
 * Get the base WebSocket URL
 * Translates http/https to ws/wss automatically for production.
 */
export const getWsUrl = () => {
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL.replace(/^http/, 'ws');
    }
    const host = Platform.OS === 'web' ? 'localhost:8000' : '192.168.1.110:8000';
    return `ws://${host}`;
};
