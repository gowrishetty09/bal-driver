import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { useFeedbackStore } from '../store/feedbackStore';

/**
 * Hook to sync pending feedback when network becomes available.
 * Should be called once in the app root component.
 */
export const useFeedbackSync = () => {
    const { loadPendingFeedback, syncPendingFeedback, pendingFeedback } = useFeedbackStore();
    const isInitialized = useRef(false);

    // Load pending feedback on mount
    useEffect(() => {
        if (!isInitialized.current) {
            isInitialized.current = true;
            loadPendingFeedback();
        }
    }, [loadPendingFeedback]);

    // Listen for network changes and sync when online
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            if (state.isConnected && state.isInternetReachable && pendingFeedback.length > 0) {
                syncPendingFeedback();
            }
        });

        return () => {
            unsubscribe();
        };
    }, [syncPendingFeedback, pendingFeedback.length]);

    return {
        pendingCount: pendingFeedback.length,
    };
};
