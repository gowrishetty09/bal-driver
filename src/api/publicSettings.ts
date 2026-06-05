import { apiClient } from './client';

export type DriverAppUpdateConfig = {
    minimumVersion: string | null;
    updateUrl: string | null;
    message: string;
};

export const getDriverAppUpdateConfig = async (): Promise<DriverAppUpdateConfig> => {
    const { data } = await apiClient.get<DriverAppUpdateConfig>('/public/settings/driver-app');
    return data;
};