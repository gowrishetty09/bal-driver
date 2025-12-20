/**
 * NotificationProvider context for managing FCM initialization
 * Initializes Firebase Cloud Messaging and handles notification setup
 */
import React, { createContext } from 'react';
import { useNotificationService } from '../hooks/useNotificationService';

export type NotificationContextValue = {
  isInitialized: boolean;
};

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // Initialize notification service
  useNotificationService();

  const value: NotificationContextValue = {
    isInitialized: true,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
