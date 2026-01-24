import React, { useCallback } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocationService } from '../hooks/useLocationService';
import { useTheme, ThemeColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

export const LocationStatusBanner: React.FC = () => {
  const { permissionStatus, isSharingLocation, requestPermission } = useLocationService();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const permissionGranted = permissionStatus === 'granted';
  const showBanner = !permissionGranted || (permissionGranted && !isSharingLocation);

  const isDenied = permissionStatus === 'denied';
  const isUndetermined = permissionStatus === 'undetermined';

  const title = isDenied
    ? 'Location access disabled'
    : isUndetermined
    ? 'Enable location access'
    : 'Location paused';

  const description = isDenied
    ? 'Allow location access from settings so dispatch can see your live position.'
    : isUndetermined
    ? 'Grant location access to keep dispatch informed about your whereabouts.'
    : 'We will resume location sharing shortly. Keep the app open to stay visible.';

  const handleAction = useCallback(async () => {
    if (isDenied) {
      try {
        await Linking.openSettings();
      } catch (error) {
        Alert.alert('Open Settings', 'Please enable location permission from device settings.');
      }
      return;
    }

    requestPermission();
  }, [isDenied, requestPermission]);

  if (!showBanner) {
    return null;
  }

  const showActionButton = !permissionGranted;

  return (
    <View style={[styles.container, permissionGranted ? styles.paused : styles.warning]}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{description}</Text>
      </View>
      {showActionButton ? (
        <Pressable style={styles.button} onPress={handleAction}>
          <Text style={styles.buttonLabel}>{isDenied ? 'Open settings' : 'Enable now'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#af6600',
  },
  warning: {
    backgroundColor: colors.card,
    borderColor: colors.warning,
  },
  paused: {
    backgroundColor: colors.card,
    borderColor: colors.primary,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: typography.caption,
    color: colors.muted,
  },
  button: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  buttonLabel: {
    color: colors.textInverse,
    fontSize: typography.caption,
    fontFamily: typography.fontFamilyMedium,
  },
});
