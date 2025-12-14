import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { FeedbackPayload, FeedbackResponse, submitFeedback } from '../api/feedback';

const PENDING_FEEDBACK_KEY = 'pendingFeedback';

export type PendingFeedback = FeedbackPayload & {
    id: string;
    createdAt: string;
};

export type FeedbackStoreState = {
    isSubmitting: boolean;
    pendingFeedback: PendingFeedback[];
    isSyncing: boolean;
    lastSubmittedFeedback: FeedbackResponse | null;
    submit: (payload: FeedbackPayload) => Promise<FeedbackResponse | null>;
    loadPendingFeedback: () => Promise<void>;
    syncPendingFeedback: () => Promise<void>;
    removePendingFeedback: (id: string) => Promise<void>;
    reset: () => void;
};

const initialState: Pick<
    FeedbackStoreState,
    'isSubmitting' | 'pendingFeedback' | 'isSyncing' | 'lastSubmittedFeedback'
> = {
    isSubmitting: false,
    pendingFeedback: [],
    isSyncing: false,
    lastSubmittedFeedback: null,
};

const savePendingFeedbackToStorage = async (feedback: PendingFeedback[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(PENDING_FEEDBACK_KEY, JSON.stringify(feedback));
    } catch (error) {
        console.warn('Failed to save pending feedback to storage', error);
    }
};

const loadPendingFeedbackFromStorage = async (): Promise<PendingFeedback[]> => {
    try {
        const stored = await AsyncStorage.getItem(PENDING_FEEDBACK_KEY);
        if (stored) {
            return JSON.parse(stored) as PendingFeedback[];
        }
    } catch (error) {
        console.warn('Failed to load pending feedback from storage', error);
    }
    return [];
};

export const useFeedbackStore = create<FeedbackStoreState>()((set, get) => ({
    ...initialState,

    loadPendingFeedback: async () => {
        const pending = await loadPendingFeedbackFromStorage();
        set({ pendingFeedback: pending });
    },

    submit: async (payload: FeedbackPayload): Promise<FeedbackResponse | null> => {
        set({ isSubmitting: true });

        // Check network connectivity
        const networkState = await NetInfo.fetch();
        const isConnected = networkState.isConnected && networkState.isInternetReachable !== false;

        if (!isConnected) {
            // Save to pending queue for later sync
            const pendingItem: PendingFeedback = {
                ...payload,
                id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                createdAt: new Date().toISOString(),
            };
            const updatedPending = [...get().pendingFeedback, pendingItem];
            set({ pendingFeedback: updatedPending, isSubmitting: false });
            await savePendingFeedbackToStorage(updatedPending);
            return null;
        }

        try {
            const response = await submitFeedback(payload);
            set({ lastSubmittedFeedback: response, isSubmitting: false });
            return response;
        } catch (error) {
            // If network error, queue for retry
            if (
                error &&
                typeof error === 'object' &&
                'message' in error &&
                typeof (error as { message: string }).message === 'string' &&
                ((error as { message: string }).message.includes('Network Error') ||
                    (error as { message: string }).message.includes('timeout'))
            ) {
                const pendingItem: PendingFeedback = {
                    ...payload,
                    id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    createdAt: new Date().toISOString(),
                };
                const updatedPending = [...get().pendingFeedback, pendingItem];
                set({ pendingFeedback: updatedPending, isSubmitting: false });
                await savePendingFeedbackToStorage(updatedPending);
                return null;
            }
            set({ isSubmitting: false });
            throw error;
        }
    },

    syncPendingFeedback: async () => {
        const { pendingFeedback, isSyncing } = get();
        if (isSyncing || pendingFeedback.length === 0) {
            return;
        }

        const networkState = await NetInfo.fetch();
        const isConnected = networkState.isConnected && networkState.isInternetReachable !== false;

        if (!isConnected) {
            return;
        }

        set({ isSyncing: true });

        const failedItems: PendingFeedback[] = [];

        for (const item of pendingFeedback) {
            try {
                const { id, createdAt, ...payload } = item;
                await submitFeedback(payload);
            } catch (error) {
                console.warn('Failed to sync pending feedback item', item.id, error);
                failedItems.push(item);
            }
        }

        set({ pendingFeedback: failedItems, isSyncing: false });
        await savePendingFeedbackToStorage(failedItems);
    },

    removePendingFeedback: async (id: string) => {
        const updated = get().pendingFeedback.filter((item) => item.id !== id);
        set({ pendingFeedback: updated });
        await savePendingFeedbackToStorage(updated);
    },

    reset: () => {
        set(initialState);
    },
}));
