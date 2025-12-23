import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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

import { Screen } from '../../components/Screen';
import { FeedbackPrompt } from '../../components/FeedbackPrompt';
import { RideMapView } from '../../components/RideMapView';
import { useLocationService } from '../../hooks/useLocationService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { ActiveJobsStackParamList, HistoryJobsStackParamList, UpcomingJobsStackParamList } from '../../types/navigation';
import {
  DriverJobDetail,
  JobStatus,
  getDriverJobDetails,
  updateDriverJobStatus,
} from '../../api/driver';
import { getErrorMessage } from '../../utils/errors';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { emitJobRefresh } from '../../utils/events';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
const ACTIVE_RIDE_STATUSES: JobStatus[] = ['EN_ROUTE', 'ARRIVED', 'PICKED_UP'];

type CombinedStackParamList = ActiveJobsStackParamList & UpcomingJobsStackParamList & HistoryJobsStackParamList;

type Props = NativeStackScreenProps<CombinedStackParamList, 'JobDetails'>;

export const JobDetailsScreen: React.FC<Props> = ({ route }) => {
  const { jobId } = route.params ?? {};
  const [job, setJob] = useState<DriverJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  
  // Use global location service
  const { isSharingLocation, setHighFrequencyMode, isHighFrequencyMode, lastKnownCoordinates } = useLocationService();

  // Determine if map should be shown (active ride statuses only)
  const showMap = job && ACTIVE_RIDE_STATUSES.includes(job.status);

  const fetchDetails = useCallback(async () => {
    if (!jobId) {
      setLoading(false);
      return;
    }
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
  }, [fetchDetails]);

  // Enable high-frequency location updates when on an active ride
  useEffect(() => {
    if (!job) {
      return;
    }

    const needsHighFrequency = ACTIVE_RIDE_STATUSES.includes(job.status);
    const isTerminal = TERMINAL_STATUSES.includes(job.status);
    
    if (needsHighFrequency) {
      setHighFrequencyMode(true);
    } else if (isTerminal) {
      setHighFrequencyMode(false);
    }
    
    // Cleanup: disable high frequency when leaving this screen
    return () => {
      setHighFrequencyMode(false);
    };
  }, [job?.status, setHighFrequencyMode]);

  const handleStatusUpdate = useCallback(
    async (nextStatus: JobStatus, reason?: string) => {
      if (!job) {
        return;
      }

      setActionLoading(true);
      try {
        const updatedJob = await updateDriverJobStatus(job.id, nextStatus, reason);
        // Merge updated job with existing job data to preserve fields like coordinates
        // that may not be returned by the status update endpoint
        setJob((prevJob) => ({
          ...prevJob!,
          ...updatedJob,
          // Preserve coordinate data if not returned by the update endpoint
          pickupCoords: updatedJob.pickupCoords ?? prevJob?.pickupCoords,
          dropCoords: updatedJob.dropCoords ?? prevJob?.dropCoords,
          pickup: updatedJob.pickup ?? prevJob?.pickup,
          dropoff: updatedJob.dropoff ?? prevJob?.dropoff,
        }));
        emitJobRefresh();
        showSuccessToast('Status updated', `Ride marked as ${STATUS_LABELS[nextStatus]}`);

        // Show feedback prompt after completing a trip
        if (nextStatus === 'COMPLETED') {
          setTimeout(() => setShowFeedbackPrompt(true), 1000);
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
    [job]
  );

  const nextStatus = job ? STATUS_TRANSITIONS[job.status] ?? null : null;
  const isJobTerminal = job ? TERMINAL_STATUSES.includes(job.status) : false;

  const handleCallPassenger = useCallback(() => {
    if (!job || !job.passengerPhone || job.passengerPhone.trim() === '') {
      Alert.alert('No phone number', 'Customer phone number is not available.');
      return;
    }
    Linking.openURL(`tel:${job.passengerPhone}`).catch(() =>
      Alert.alert('Dial failed', 'Unable to initiate a call on this device.')
    );
  }, [job]);

  const handleWhatsApp = useCallback(() => {
    if (!job || !job.passengerPhone || job.passengerPhone.trim() === '') {
      Alert.alert('No phone number', 'Customer phone number is not available.');
      return;
    }
    const digits = job.passengerPhone.replace(/[^\d+]/g, '');
    if (!digits) {
      Alert.alert('Invalid phone number', 'Customer phone number is invalid.');
      return;
    }
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

  if (!jobId) {
    return (
      <Screen contentContainerStyle={styles.loaderContainer}>
        <Text style={styles.errorText}>Invalid job reference. Please go back and try again.</Text>
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

  // Active ride: Full-screen map with bottom overlay card
  if (showMap) {
    return (
      <View style={styles.fullScreenContainer}>
        {/* Full-screen map */}
        <RideMapView
          driverLocation={lastKnownCoordinates}
          pickupCoords={job.pickupCoords}
          dropCoords={job.dropCoords}
          status={job.status}
          pickupAddress={pickupAddress}
          dropAddress={dropoffAddress}
          fullScreen
        />

        {/* Bottom overlay card */}
        <View style={styles.bottomOverlay}>
          {/* Navigate button at top of overlay */}
          <Pressable 
            style={styles.navigateOverlayButton} 
            onPress={() => {
              const destination = job.status === 'PICKED_UP' && job.dropCoords 
                ? { lat: job.dropCoords.lat, lng: job.dropCoords.lng, label: 'Drop-off' }
                : job.pickupCoords 
                  ? { lat: job.pickupCoords.lat, lng: job.pickupCoords.lng, label: 'Pickup' }
                  : null;
              if (destination) {
                const url = `google.navigation:q=${destination.lat},${destination.lng}`;
                Linking.openURL(url).catch(() => {
                  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`);
                });
              }
            }}
          >
            <Text style={styles.navigateOverlayButtonText}>
              Navigate to {job.status === 'PICKED_UP' ? 'Drop-off' : 'Pickup'}
            </Text>
          </Pressable>

          {/* Status badge */}
          <View style={styles.overlayStatusBadge}>
            <Text style={styles.overlayStatusText}>
              {job.status === 'EN_ROUTE' && '🚗 Heading to pickup'}
              {job.status === 'ARRIVED' && '📍 Waiting at pickup'}
              {job.status === 'PICKED_UP' && '🛣️ En route to drop-off'}
            </Text>
          </View>

          {/* Customer info row */}
          <View style={styles.overlayCustomerRow}>
            <View style={styles.overlayCustomerInfo}>
              <Text style={styles.overlayCustomerName}>{job.passengerName || 'Customer'}</Text>
            </View>
            <Pressable
              style={[
                styles.overlayCallButton,
                (!job.passengerPhone || job.passengerPhone.trim() === '') && styles.overlayCallButtonDisabled
              ]}
              onPress={handleCallPassenger}
              disabled={!job.passengerPhone || job.passengerPhone.trim() === ''}
            >
              <Text style={styles.overlayCallIcon}>📞</Text>
            </Pressable>
          </View>

          {/* Fare & Payment info row */}
          <View style={styles.overlayPaymentRow}>
            <View style={styles.overlayPaymentItem}>
              <Text style={styles.overlayPaymentLabel}>Fare</Text>
              <Text style={styles.overlayPaymentValue}>
                {job.paymentAmount != null && job.paymentAmount > 0 ? `₹${job.paymentAmount}` : '—'}
              </Text>
            </View>
            <View style={styles.overlayPaymentItem}>
              <Text style={styles.overlayPaymentLabel}>Method</Text>
              <Text style={styles.overlayPaymentValue}>{job.paymentMethod ?? '—'}</Text>
            </View>
            <View style={styles.overlayPaymentItem}>
              <Text style={styles.overlayPaymentLabel}>Status</Text>
              <Text style={[
                styles.overlayPaymentValue,
                job.paymentStatus === 'PAID' && styles.overlayPaymentPaid
              ]}>
                {job.paymentStatus ?? '—'}
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.overlayActionsContainer}>
            {nextStatus && (
              <Pressable
                style={styles.overlayPrimaryAction}
                onPress={() => handleStatusUpdate(nextStatus)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.overlayPrimaryActionLabel}>
                    {nextStatus === 'ARRIVED' && 'Mark as Arrived'}
                    {nextStatus === 'PICKED_UP' && 'Mark Pickup'}
                    {nextStatus === 'COMPLETED' && 'Mark Completed'}
                  </Text>
                )}
              </Pressable>
            )}
            <Pressable
              style={styles.overlayCancelAction}
              onPress={() => setCancelModalVisible(true)}
            >
              <Text style={styles.overlayCancelActionLabel}>Cancel Ride</Text>
            </Pressable>
          </View>
        </View>

        {/* Cancel Modal */}
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

        {/* Feedback Prompt */}
        <FeedbackPrompt
          visible={showFeedbackPrompt}
          onClose={() => setShowFeedbackPrompt(false)}
          bookingId={job?.id}
          title="How was this trip?"
        />
      </View>
    );
  }

  // Non-active ride: Regular scrollable layout
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
          <Text style={styles.customerName}>{job.passengerName || 'Customer'}</Text>
          {job.passengerPhone && job.passengerPhone.trim() !== '' ? (
            <Text style={styles.customerContact}>{job.passengerPhone}</Text>
          ) : (
            <Text style={[styles.customerContact, { color: colors.muted }]}>Phone not available</Text>
          )}
          {job.passengerEmail ? (
            <Text style={styles.customerContact}>{job.passengerEmail}</Text>
          ) : null}
          <View style={styles.actionRow}>
            <Pressable 
              style={[
                styles.actionButton, 
                (!job.passengerPhone || job.passengerPhone.trim() === '') && styles.actionButtonDisabled
              ]} 
              onPress={handleCallPassenger}
              disabled={!job.passengerPhone || job.passengerPhone.trim() === ''}
            >
              <Text style={[
                styles.actionLabel,
                (!job.passengerPhone || job.passengerPhone.trim() === '') && styles.actionLabelDisabled
              ]}>Call</Text>
            </Pressable>
            <Pressable 
              style={[
                styles.actionButton,
                (!job.passengerPhone || job.passengerPhone.trim() === '') && styles.actionButtonDisabled
              ]} 
              onPress={handleWhatsApp}
              disabled={!job.passengerPhone || job.passengerPhone.trim() === ''}
            >
              <Text style={[
                styles.actionLabel,
                (!job.passengerPhone || job.passengerPhone.trim() === '') && styles.actionLabelDisabled
              ]}>WhatsApp</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride Details</Text>
          {(job.distanceKm !== undefined || job.durationMinutes !== undefined) && (
            <View style={styles.distanceTimeRow}>
              {job.distanceKm !== undefined && (
                <View style={styles.distanceTimeItem}>
                  <Text style={styles.distanceTimeValue}>{job.distanceKm.toFixed(1)} km</Text>
                  <Text style={styles.distanceTimeLabel}>Distance</Text>
                </View>
              )}
              {job.durationMinutes !== undefined && (
                <View style={styles.distanceTimeItem}>
                  <Text style={styles.distanceTimeValue}>{job.durationMinutes} min</Text>
                  <Text style={styles.distanceTimeLabel}>Est. Time</Text>
                </View>
              )}
            </View>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Estimated Fare</Text>
            <Text style={styles.metaValue}>{
               job.paymentAmount != null && job.paymentAmount > 0 ? `₹${job.paymentAmount}` : '—'
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
          {isSharingLocation && ACTIVE_RIDE_STATUSES.includes(job.status) && (
            <Text style={styles.trackingBadge}>
              Sharing live location with dispatch{isHighFrequencyMode ? ' (high frequency)' : ''}…
            </Text>
          )}
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

      {/* Feedback Prompt - shown after completing a trip */}
      <FeedbackPrompt
        visible={showFeedbackPrompt}
        onClose={() => setShowFeedbackPrompt(false)}
        bookingId={job?.id}
        title="How was this trip?"
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  navigateOverlayButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  navigateOverlayButtonText: {
    color: '#fff',
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  overlayStatusBadge: {
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignSelf: 'center',
  },
  overlayStatusText: {
    fontSize: typography.caption,
    color: colors.text,
    fontFamily: typography.fontFamilyMedium,
  },
  overlayCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  overlayCustomerInfo: {
    flex: 1,
  },
  overlayCustomerName: {
    fontSize: typography.subheading,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
  },
  overlayCallButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  overlayCallButtonDisabled: {
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  overlayCallIcon: {
    fontSize: 20,
  },
  overlayPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  overlayPaymentItem: {
    alignItems: 'center',
    flex: 1,
  },
  overlayPaymentLabel: {
    fontSize: typography.caption,
    color: colors.muted,
    marginBottom: 4,
  },
  overlayPaymentValue: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
  },
  overlayPaymentPaid: {
    color: colors.primary,
  },
  overlayActionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  overlayPrimaryAction: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayPrimaryActionLabel: {
    color: '#fff',
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  overlayCancelAction: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCancelActionLabel: {
    color: colors.danger,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
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
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
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
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
  },
  customerContact: {
    fontSize: typography.body,
    color: colors.muted,
    marginTop: 4,
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
  actionButtonDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.background,
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: typography.body,
    color: colors.primary,
  },
  actionLabelDisabled: {
    color: colors.muted,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  distanceTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  distanceTimeItem: {
    alignItems: 'center',
  },
  distanceTimeValue: {
    fontSize: typography.heading,
    fontFamily: typography.fontFamilyBold,
    color: colors.primary,
  },
  distanceTimeLabel: {
    fontSize: typography.caption,
    color: colors.muted,
    marginTop: 4,
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
