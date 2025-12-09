import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { API_BASE_URL } from '../utils/config';
import { SessionTokens } from '../types/auth';

type AuthenticatedRequestConfig = InternalAxiosRequestConfig & {
    _retry?: boolean;
};

let sessionTokens: SessionTokens | null = null;
let refreshHandler: (() => Promise<SessionTokens | null>) | null = null;
let unauthorizedHandler: (() => Promise<void> | void) | null = null;
let refreshPromise: Promise<SessionTokens | null> | null = null;

export const setSessionTokens = (tokens: SessionTokens | null) => {
    sessionTokens = tokens;
};

export const registerAuthHandlers = (handlers: {
    onRefresh?: () => Promise<SessionTokens | null>;
    onUnauthorized?: () => Promise<void> | void;
}) => {
    refreshHandler = handlers.onRefresh ?? null;
    unauthorizedHandler = handlers.onUnauthorized ?? null;
};

const ensureRefreshPromise = (): Promise<SessionTokens | null> => {
    if (!refreshPromise) {
        if (!refreshHandler) {
            return Promise.resolve(null);
        }

        refreshPromise = refreshHandler().finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
};

const notifyUnauthorized = async () => {
    if (unauthorizedHandler) {
        await unauthorizedHandler();
    }
};

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
    if (sessionTokens?.accessToken) {
        config.headers.Authorization = `Bearer ${sessionTokens.accessToken}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const status = error.response?.status;
        const originalRequest = error.config as AuthenticatedRequestConfig | undefined;

        if (status !== 401 || !refreshHandler || !originalRequest || originalRequest._retry) {
            return Promise.reject(error);
        }

        if (!sessionTokens?.refreshToken) {
            await notifyUnauthorized();
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            const tokens = await ensureRefreshPromise();

            if (!tokens?.accessToken) {
                await notifyUnauthorized();
                return Promise.reject(error);
            }

            sessionTokens = tokens;
            originalRequest.headers = {
                ...originalRequest.headers,
                Authorization: `Bearer ${tokens.accessToken}`,
            };

            return apiClient(originalRequest);
        } catch (refreshError) {
            await notifyUnauthorized();
            return Promise.reject(refreshError);
        }
    }
);
