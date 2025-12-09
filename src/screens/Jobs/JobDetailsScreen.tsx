import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';

import { Screen } from '../../components/Screen';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { ActiveJobsStackParamList, HistoryJobsStackParamList, UpcomingJobsStackParamList } from '../../types/navigation';
import {
  DriverJobDetail,
  JobStatus,
  getDriverJobDetails,
  sendLocation,
  updateDriverJobStatus,
} from '../../api/driver';
import { getErrorMessage } from '../../utils/errors';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { emitJobRefresh } from '../../utils/events';

const STATUS_LABELS: Record<JobStatus, string> = {
  ASSIGNED: 'Assigned',
  EN_ROUTE: 'En route',
  ARRIVED: 'Arrived',
  PICKED_UP: 'Picked up',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_TRANSITIONS: Partial<Record<JobStatus, JobStatus>> = {
  ASSIGNED: 'EN_ROUTE',
  EN_ROUTE: 'ARRIVED',
  ARRIVED: 'PICKED_UP',
  PICKED_UP: 'COMPLETED',
};

const TERMINAL_STATUSES: JobStatus[] = ['COMPLETED', 'CANCELLED'];

type CombinedStackParamList = ActiveJobsStackParamList & UpcomingJobsStackParamList & HistoryJobsStackParamList;

type Props = NativeStackScreenProps<CombinedStackParamList, 'JobDetails'>;

export const JobDetailsScreen: React.FC<Props> = ({ route }) => {
  const { jobId } = route.params;
  const [job, setJob] = useState<DriverJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const trackerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopLocationUpdates = useCallback(() => {
    if (trackerRef.current) {
      clearInterval(trackerRef.current);
      trackerRef.current = null;
    }
    setIsTrackingLocation(false);
  }, []);

  const startLocationUpdates = useCallback(async () => {
    if (trackerRef.current) {
      return;
    }

    const permissions = await Location.requestForegroundPermissionsAsync();
    if (permissions.status !== 'granted') {
      showErrorToast('Location', 'Permission required to share location with dispatch.');
      return;
    }

    const sendCurrentLocation = async () => {
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await sendLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch (error) {
        console.warn('Unable to send location update', error);
      }
    };

    await sendCurrentLocation();
    trackerRef.current = setInterval(sendCurrentLocation, 10000);
    setIsTrackingLocation(true);
  }, []);

  const fetchDetails = useCallback(async () => {
    try {
      const data = await getDriverJobDetails(jobId);
      setJob(data);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to load job details');
      showErrorToast('Job details', message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchDetails();
    return () => stopLocationUpdates();
  }, [fetchDetails, stopLocationUpdates]);

  useEffect(() => {
    if (!job) {
      return;
    }

    if (job.status === 'EN_ROUTE' && !trackerRef.current) {
      startLocationUpdates();
    }

    if (TERMINAL_STATUSES.includes(job.status)) {
      stopLocationUpdates();
    }
  }, [job, startLocationUpdates, stopLocationUpdates]);

  const handleStatusUpdate = useCallback(
    async (nextStatus: JobStatus, reason?: string) => {
      if (!job) {
        return;
      }

      setActionLoading(true);
      try {
        const updatedJob = await updateDriverJobStatus(job.id, nextStatus, reason);
        setJob(updatedJob);
        emitJobRefresh();
        showSuccessToast('Status updated', `Ride marked as ${STATUS_LABELS[nextStatus]}`);

        if (nextStatus === 'EN_ROUTE') {
          await startLocationUpdates();
        }

        if (TERMINAL_STATUSES.includes(nextStatus)) {
          stopLocationUpdates();
        }
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update status');
        showErrorToast('Update failed', message);
      } finally {
        setActionLoading(false);
        setCancelModalVisible(false);
        setCancelReason('');
      }
    },
    [job, startLocationUpdates, stopLocationUpdates]
  );

  const nextStatus = job ? STATUS_TRANSITIONS[job.status] ?? null : null;
  const isJobTerminal = job ? TERMINAL_STATUSES.includes(job.status) : false;

  const handleCallPassenger = useCallback(() => {
    if (!job) {
      return;
    }
    Linking.openURL(`tel:${job.passengerPhone}`).catch(() =>
      Alert.alert('Dial failed', 'Unable to initiate a call on this device.')
    );
  }, [job]);

  const handleWhatsApp = useCallback(() => {
    if (!job) {
      return;
    }
    const digits = job.passengerPhone.replace(/[^\d+]/g, '');
    const url = `https://wa.me/${digits.replace('+', '')}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('WhatsApp unavailable', 'Install WhatsApp or try calling the customer instead.')
    );
  }, [job]);

  const confirmCancellation = useCallback(() => {
    if (!cancelReason.trim()) {
      Alert.alert('Reason required', 'Please provide a reason to cancel this ride.');
      return;
    }
    handleStatusUpdate('CANCELLED', cancelReason.trim());
  }, [cancelReason, handleStatusUpdate]);

  const formatDateTime = useCallback((value?: string) => {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleString();
  }, []);

  const timelineItems = useMemo(() => job?.timeline ?? [], [job]);

  if (loading) {
    return (
      <Screen contentContainerStyle={styles.loaderContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  if (!job) {
    return (
      <Screen contentContainerStyle={styles.loaderContainer}>
        <Text style={styles.errorText}>Job not found.</Text>
      </Screen>
    );
  }

  const pickupAddress = job.pickup?.addressLine ?? 'Pickup location pending';
  const dropoffAddress = job.dropoff?.addressLine ?? 'Dropoff location pending';
  const dropoffNote = job.dropoff?.landmark ?? '';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.jobId}>Vehicle: {job.vehiclePlate ?? job.reference}</Text>
          </View>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{STATUS_LABELS[job.status]}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup & Drop</Text>
          <View style={styles.locationRow}>
            <View style={styles.locationBullet} />
            <View>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationValue}>{pickupAddress}</Text>
              <Text style={styles.subtle}>{formatDateTime(job.scheduledTime)}</Text>
            </View>
          </View>
          <View style={[styles.locationRow, { marginTop: 16 }] }>
            <View style={[styles.locationBullet, styles.dropBullet]} />
            <View>
              <Text style={styles.locationLabel}>Drop</Text>
              <Text style={styles.locationValue}>{dropoffAddress}</Text>
              <Text style={styles.subtle}>{dropoffNote}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <Text style={styles.customerName}>{job.passengerName}</Text>
          <View style={styles.actionRow}>
            <Pressable style={styles.actionButton} onPress={handleCallPassenger}>
              <Text style={styles.actionLabel}>Call</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={handleWhatsApp}>
              <Text style={styles.actionLabel}>WhatsApp</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride Details</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Estimated Fare</Text>
            <Text style={styles.metaValue}>{
               `₹${job.paymentAmount}`
            }</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Payment Method</Text>
            <Text style={styles.metaValue}>{job.paymentMethod ?? '—'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Payment Status</Text>
            <Text style={styles.metaValue}>{job.paymentStatus ?? '—'}</Text>
          </View>
          {job.notes ? <Text style={styles.notes}>{job.notes}</Text> : null}
          {isTrackingLocation && <Text style={styles.trackingBadge}>Sharing live location with dispatch…</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Timeline</Text>
          {timelineItems.map((item) => {
            const isActive = item.status === job.status;
            return (
              <View key={`${item.status}-${item.timestamp}`} style={styles.timelineRow}>
                <View style={[styles.timelineIndicator, isActive && styles.timelineIndicatorActive]} />
                <View>
                  <Text style={[styles.timelineStatus, isActive && styles.timelineStatusActive]}>
                    {STATUS_LABELS[item.status]}
                  </Text>
                  <Text style={styles.subtle}>{formatDateTime(item.timestamp)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {!isJobTerminal && (
          <View style={styles.section}>
            {nextStatus && (
              <Pressable style={styles.primaryAction} onPress={() => handleStatusUpdate(nextStatus)} disabled={actionLoading}>
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryActionLabel}>{`Mark as ${STATUS_LABELS[nextStatus]}`}</Text>
                )}
              </Pressable>
            )}

            <Pressable style={styles.secondaryAction} onPress={() => setCancelModalVisible(true)}>
              <Text style={styles.secondaryActionLabel}>Cancel ride</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={cancelModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Cancel Ride</Text>
            <Text style={styles.subtle}>Provide a reason so dispatch can notify the rider.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for cancellation"
              placeholderTextColor={colors.muted}
              multiline
              value={cancelReason}
              onChangeText={setCancelReason}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setCancelModalVisible(false)}>
                <Text style={styles.secondaryActionLabel}>Dismiss</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={confirmCancellation} disabled={actionLoading}>
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryActionLabel}>Confirm cancel</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: typography.body,
    color: colors.danger,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobId: {
    fontSize: typography.heading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
  },
  subtle: {
    fontSize: typography.caption,
    color: colors.muted,
    marginTop: 4,
  },
  statusChip: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  statusChipText: {
    color: '#fff',
    fontSize: typography.caption,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontFamily: typography.fontFamilyMedium,
    marginBottom: 12,
    color: colors.text,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  locationBullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  dropBullet: {
    backgroundColor: colors.accent,
  },
  locationLabel: {
    fontSize: typography.caption,
    color: colors.muted,
  },
  locationValue: {
    fontSize: typography.body,
    color: colors.text,
  },
  customerName: {
    fontSize: typography.subheading,
    color: colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: typography.body,
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: typography.body,
    color: colors.muted,
  },
  metaValue: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
  },
  notes: {
    marginTop: 8,
    fontSize: typography.body,
    color: colors.text,
  },
  trackingBadge: {
    marginTop: 10,
    fontSize: typography.caption,
    color: colors.primary,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timelineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  timelineIndicatorActive: {
    backgroundColor: colors.primary,
  },
  timelineStatus: {
    fontSize: typography.body,
    color: colors.muted,
  },
  timelineStatusActive: {
    color: colors.text,
    fontFamily: typography.fontFamilyMedium,
  },
  primaryAction: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryActionLabel: {
    color: '#fff',
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  secondaryAction: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryActionLabel: {
    color: colors.danger,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    padding: 12,
    marginTop: 16,
    textAlignVertical: 'top',
  },
  modalActions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  modalSecondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalPrimary: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingVertical: 12,
  },
});
