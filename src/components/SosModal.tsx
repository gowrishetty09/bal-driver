import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DriverJob, getDriverJobs } from '../api/driver';
import { logSosEvent, resolveCurrentLocation, SosKind } from '../api/sos';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { SOS_CONTACTS, SUPPORT_EMAIL } from '../utils/config';
import { showErrorToast, showSuccessToast } from '../utils/toast';

export type SosModalProps = {
  visible: boolean;
  onRequestClose: () => void;
};

type SosOption = {
  key: SosKind;
  label: string;
  description: string;
  phone?: string;
  share?: boolean;
};

const ACTIVE_JOB_STATUSES: DriverJob['status'][] = ['EN_ROUTE', 'ARRIVED', 'PICKED_UP', 'ASSIGNED'];

const buildOptions = (): SosOption[] => [
  {
    key: 'POLICE',
    label: 'Call Police',
    description: `Dial ${SOS_CONTACTS.police} immediately`,
    phone: SOS_CONTACTS.police,
  },
  {
    key: 'MEDICAL',
    label: 'Call Medical Emergency',
    description: `Dial ${SOS_CONTACTS.medical} for ambulance support`,
    phone: SOS_CONTACTS.medical,
  },
  {
    key: 'SUPPORT',
    label: 'Call Dispatch Support',
    description: `Dial ${SOS_CONTACTS.support} and auto-open support chat`,
    phone: SOS_CONTACTS.support,
  },
  {
    key: 'OTHER',
    label: 'Share live location',
    description: 'Send your coordinates + booking id to any app',
    share: true,
  },
];

const sanitizePhone = (phone: string) => phone.replace(/[^+\d]/g, '');

export const SosModal: React.FC<SosModalProps> = ({ visible, onRequestClose }) => {
  const options = useMemo(buildOptions, []);
  const [processing, setProcessing] = useState<SosKind | null>(null);
  const [tripContext, setTripContext] = useState<{ bookingId: string; reference?: string } | null>(null);
  const [tripLoading, setTripLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const fetchActiveJob = async () => {
      setTripLoading(true);
      try {
        const jobs = await getDriverJobs('ACTIVE');
        if (cancelled) return;
        const current = jobs.find((job) => ACTIVE_JOB_STATUSES.includes(job.status)) ?? jobs[0];
        setTripContext(current ? { bookingId: current.id, reference: current.reference } : null);
      } catch (error) {
        if (!cancelled) {
          setTripContext(null);
          console.warn('Unable to fetch active job for SOS context', error);
        }
      } finally {
        if (!cancelled) {
          setTripLoading(false);
        }
      }
    };
    void fetchActiveJob();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const ensureCallPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    const permission = PermissionsAndroid.PERMISSIONS.CALL_PHONE;
    const alreadyGranted = await PermissionsAndroid.check(permission);
    if (alreadyGranted) {
      return true;
    }
    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const placeEmergencyCall = useCallback(
    async (phone: string) => {
      if (!phone) {
        throw new Error('Phone number unavailable');
      }
      if (!(await ensureCallPermission())) {
        throw new Error('Call permission denied');
      }
      const telUrl = `tel:${phone}`;
      const supported = await Linking.canOpenURL(telUrl);
      if (!supported) {
        throw new Error('Calling not supported on this device');
      }
      await Linking.openURL(telUrl);
    },
    [ensureCallPermission]
  );

  const openSupportChatChannel = useCallback(async (message: string) => {
    const smsUrl = `sms:${sanitizePhone(SOS_CONTACTS.support)}?body=${encodeURIComponent(message)}`;
    try {
      if (await Linking.canOpenURL(smsUrl)) {
        await Linking.openURL(smsUrl);
        return true;
      }
    } catch (error) {
      console.warn('Unable to open SMS support chat', error);
    }

    if (SUPPORT_EMAIL) {
      const mailUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Driver SOS Support')}&body=${encodeURIComponent(message)}`;
      try {
        if (await Linking.canOpenURL(mailUrl)) {
          await Linking.openURL(mailUrl);
          return true;
        }
      } catch (error) {
        console.warn('Unable to open email support channel', error);
      }
    }
    return false;
  }, []);

  const buildShareMessage = useCallback(
    (coords?: { latitude: number; longitude: number } | null) => {
      const template = SOS_CONTACTS.shareTemplate ?? 'Emergency! Please track me at https://maps.google.com/?q={lat},{lng}';
      const messageWithCoords = coords
        ? template.replace('{lat}', coords.latitude.toString()).replace('{lng}', coords.longitude.toString())
        : template.replace('{lat}', '0').replace('{lng}', '0');
      if (tripContext?.bookingId) {
        const ref = tripContext.reference ?? tripContext.bookingId;
        return `${messageWithCoords} Booking ${ref}.`;
      }
      return messageWithCoords;
    },
    [tripContext]
  );

  const confirmAction = (option: SosOption) => {
    Alert.alert('Send SOS', `Are you sure you want to ${option.label.toLowerCase()}?`, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: () => executeAction(option),
      },
    ]);
  };

  const executeAction = async (option: SosOption) => {
    setProcessing(option.key);
    const location = await resolveCurrentLocation();
    const shareMessage = option.share ? buildShareMessage(location) : undefined;
    const bookingId = tripContext?.bookingId;

    logSosEvent({
      type: option.key,
      latitude: location?.latitude,
      longitude: location?.longitude,
      bookingId,
      notes: shareMessage ?? `${option.label} triggered${bookingId ? ` for ${bookingId}` : ''}`,
    }).catch((error) => console.log('SOS logging failed', error));

    try {
      if (option.phone) {
        await placeEmergencyCall(option.phone);
        if (option.key === 'SUPPORT') {
          const opened = await openSupportChatChannel(
            shareMessage ??
              `Driver requested support${bookingId ? ` for booking ${bookingId}` : ''}. Please follow up.`
          );
          if (!opened) {
            showErrorToast('Chat unavailable', 'Could not open support chat, but dispatch has been alerted.');
          }
        }
      } else if (option.share) {
        await Share.share({ message: shareMessage ?? 'Emergency alert triggered.' });
      }
      showSuccessToast('SOS triggered', 'We have alerted dispatch and opened the requested channel.');
    } catch (error) {
      showErrorToast('SOS action failed', error instanceof Error ? error.message : 'Unable to complete action');
    } finally {
      setProcessing(null);
      onRequestClose();
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Emergency SOS</Text>
          <Text style={styles.subtitle}>Choose how you would like to reach out. A log will be sent to dispatch.</Text>
          <View style={styles.tripContextBox}>
            <Text style={styles.tripContextLabel}>Trip context</Text>
            {tripLoading ? (
              <Text style={styles.tripContextValueMuted}>Checking assignments…</Text>
            ) : tripContext ? (
              <Text style={styles.tripContextValue}>
                Booking {tripContext.reference ?? tripContext.bookingId}
              </Text>
            ) : (
              <Text style={styles.tripContextValueMuted}>No active trip detected</Text>
            )}
          </View>
          {options.map((option) => (
            <Pressable
              key={option.key}
              style={styles.option}
              onPress={() => confirmAction(option)}
              disabled={Boolean(processing)}
            >
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              {processing === option.key && <Text style={styles.processing}>…</Text>}
            </Pressable>
          ))}
          <Pressable style={styles.closeButton} onPress={onRequestClose}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  title: {
    fontSize: typography.heading,
    fontFamily: typography.fontFamilyBold,
    color: colors.brandNavy,
  },
  subtitle: {
    marginTop: 4,
    fontSize: typography.body,
    color: colors.muted,
  },
  tripContextBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripContextLabel: {
    fontSize: typography.caption,
    color: colors.muted,
    marginBottom: 4,
  },
  tripContextValue: {
    fontSize: typography.body,
    color: colors.brandNavy,
    fontFamily: typography.fontFamilyMedium,
  },
  tripContextValueMuted: {
    fontSize: typography.body,
    color: colors.muted,
  },
  option: {
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    paddingRight: 12,
  },
  optionLabel: {
    fontSize: typography.subheading,
    color: colors.text,
    fontFamily: typography.fontFamilyMedium,
  },
  optionDescription: {
    marginTop: 4,
    fontSize: typography.caption,
    color: colors.muted,
  },
  processing: {
    color: colors.primary,
    fontSize: typography.subheading,
  },
  closeButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.brandNavy,
    alignItems: 'center',
  },
  closeLabel: {
    color: '#fff',
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
});
