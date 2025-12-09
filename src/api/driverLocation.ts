import { apiClient } from './client';
import { USE_MOCKS } from '../utils/config';

export type SavedLocationPayload = {
    address: string;
    latitude: number;
    longitude: number;
    placeId?: string;
};

export type SavedLocationResponse = SavedLocationPayload & {
    updatedAt: string;
};

const ENDPOINT = '/driver/location/manual'; // TODO: align with backend route once confirmed

export const updateDriverLocation = async (payload: SavedLocationPayload): Promise<SavedLocationResponse> => {
    try {
        const { data } = await apiClient.post<SavedLocationResponse>(ENDPOINT, payload);
        return data;
    } catch (error) {
        if (USE_MOCKS) {
            return {
                ...payload,
                updatedAt: new Date().toISOString(),
            };
        }
        throw error;
    }
};
