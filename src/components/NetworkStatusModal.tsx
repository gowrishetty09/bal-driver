import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export const NetworkStatusModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
  const [showConnectedToast, setShowConnectedToast] = useState(false);
  const wasDisconnected = useRef(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const nowConnected = state.isConnected === true && state.isInternetReachable !== false;
      const wasOffline = wasDisconnected.current;

      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);

      // Show toast when reconnected after being disconnected
      if (nowConnected && wasOffline) {
        wasDisconnected.current = false;
        setShowConnectedToast(true);
        
        // Animate toast in
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        // Hide toast after 2.5 seconds
        setTimeout(() => {
          Animated.timing(toastOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setShowConnectedToast(false);
          });
        }, 2500);
      }

      // Track disconnection state
      if (state.isConnected === false || state.isInternetReachable === false) {
        wasDisconnected.current = true;
      }
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
      if (state.isConnected === false || state.isInternetReachable === false) {
        wasDisconnected.current = true;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [toastOpacity]);

  // Show modal when not connected or internet is not reachable
  const showModal = isConnected === false || isInternetReachable === false;

  return (
    <>
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>📡</Text>
            </View>
            <Text style={styles.title}>No Internet Connection</Text>
            <Text style={styles.message}>
              Please check your network connection and try again.
            </Text>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.brandGold} />
              <Text style={styles.loadingText}>Waiting for connection...</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Connected Toast */}
      {showConnectedToast && (
        <Animated.View 
          style={[
            styles.connectedToast, 
            { 
              opacity: toastOpacity,
              bottom: insets.bottom + 56, // 56 is approximate tab bar height
            }
          ]}
        >
          <Text style={styles.connectedIcon}>✓</Text>
          <Text style={styles.connectedText}>You are now connected to the internet</Text>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.brandNavy,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.brandGold,
    fontWeight: '500',
  },
  connectedToast: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectedIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  connectedText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
