import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { SosProvider } from './src/context/SosContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useFeedbackSync } from './src/hooks/useFeedbackSync';
import { NetworkStatusModal } from './src/components/NetworkStatusModal';

const FeedbackSyncProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  useFeedbackSync();
  return <>{children}</>;
};

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <LocationProvider>
                <SosProvider>
                  <FeedbackSyncProvider>
                    <AppNavigator />
                    <NetworkStatusModal />
                  </FeedbackSyncProvider>
                </SosProvider>
              </LocationProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
