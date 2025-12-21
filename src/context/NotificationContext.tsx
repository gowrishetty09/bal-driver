/**
 * NotificationProvider context for managing Expo push notifications
 * Initializes notification service and provides state to the app
 */
import { createContext, useContext } from 'react';
import { useNotificationService, PendingNavigation } from '../hooks/useNotificationService';

export type NotificationContextValue = {
  isInitialized: boolean;
  expoPushToken: string | null;
  pendingNavigation: PendingNavigation;
  clearPendingNavigation: () => void;
};

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // Initialize notification service
  const { isInitialized, expoPushToken, pendingNavigation, clearPendingNavigation } = useNotificationService();

  const value: NotificationContextValue = {
    isInitialized,
    expoPushToken,
    pendingNavigation,
    clearPendingNavigation,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Hook to access notification context
 */
export const useNotificationContext = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};
