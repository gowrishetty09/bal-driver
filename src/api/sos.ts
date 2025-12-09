import * as Location from 'expo-location';

import { apiClient } from './client';
import { USE_MOCKS } from '../utils/config';

export type SosKind = 'POLICE' | 'MEDICAL' | 'SUPPORT' | 'OTHER';

export type SosPayload = {
    type: SosKind;
    latitude?: number;
    longitude?: number;
    address?: string;
    bookingId?: string;
    notes?: string;
};

const ENDPOINT = '/alerts/sos';

export const logSosEvent = async (payload: SosPayload): Promise<void> => {
    try {
        await apiClient.post(ENDPOINT, payload);
    } catch (error) {
        if (!USE_MOCKS) {
            throw error;
        }
    }
};

export const resolveCurrentLocation = async () => {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            return null;
        }
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
        };
    } catch (error) {
        console.log('Unable to capture current location for SOS', error);
        return null;
    }
};
