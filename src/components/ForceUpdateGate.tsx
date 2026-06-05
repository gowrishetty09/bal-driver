import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { getDriverAppUpdateConfig, type DriverAppUpdateConfig } from '../api/publicSettings';
import { Loader } from './Loader';
import { useTheme, ThemeColors } from '../context/ThemeContext';

type ForceUpdateGateProps = {
  children: React.ReactNode;
};

const FALLBACK_ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.bal.driver';

const getCurrentAppVersion = (): string => {
  const config = ((Constants as unknown) as any).expoConfig ?? ((Constants as unknown) as any).manifest;
  return String(config?.version ?? '').trim();
};

const parseVersion = (value: string): number[] =>
  value
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));

const compareVersions = (left: string, right: string): number => {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
};

export const ForceUpdateGate: React.FC<ForceUpdateGateProps> = ({ children }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isChecking, setIsChecking] = useState(true);
  const [updateConfig, setUpdateConfig] = useState<DriverAppUpdateConfig | null>(null);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        if (Updates.isEnabled) {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
            return;
          }
        }

        const config = await getDriverAppUpdateConfig();
        const currentVersion = getCurrentAppVersion();

        if (config.minimumVersion && currentVersion && compareVersions(currentVersion, config.minimumVersion) < 0) {
          if (isActive) {
            setUpdateConfig(config);
          }
        }
      } catch (error) {
        console.warn('[ForceUpdateGate] Failed to load update configuration:', error);
      } finally {
        if (isActive) {
          setIsChecking(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const openUpdateLink = async () => {
    const targetUrl = updateConfig?.updateUrl ?? (Platform.OS === 'android' ? FALLBACK_ANDROID_STORE_URL : null);

    if (!targetUrl) {
      Alert.alert('Update required', 'Please ask support for the latest app link.');
      return;
    }

    try {
      await Linking.openURL(targetUrl);
    } catch {
      Alert.alert('Unable to open', 'Could not open the app store link.');
    }
  };

  if (isChecking) {
    return <Loader />;
  }

  if (updateConfig) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Update required</Text>
        <Text style={styles.message}>{updateConfig.message}</Text>
        <Pressable style={styles.button} onPress={openUpdateLink}>
          <Text style={styles.buttonText}>Update now</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: colors.background,
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '800',
      marginBottom: 12,
      textAlign: 'center',
    },
    message: {
      color: colors.textSecondary,
      fontSize: 16,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 24,
    },
    button: {
      minWidth: 180,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });