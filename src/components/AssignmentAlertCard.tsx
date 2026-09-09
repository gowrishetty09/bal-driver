import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { startAssignmentAlarm, stopAssignmentAlarm } from "../services/assignmentAlarm";

import { acknowledgeDriverJob, type DriverJob } from "../api/driver";
import { useTheme, type ThemeColors } from "../context/ThemeContext";
import { typography } from "../theme/typography";
import { formatBookingRef } from "../utils/format";
import { getErrorMessage } from "../utils/errors";
import { showErrorToast, showSuccessToast } from "../utils/toast";
import { emitJobRefresh, subscribeAssignmentConfirmed } from "../utils/events";



type Props = {
  job: DriverJob;
  onAcknowledge?: (job: DriverJob) => void;
  onOpenDetails?: (job: DriverJob) => void;
};

export const AssignmentAlertCard: React.FC<Props> = ({
  job,
  onAcknowledge,
  onOpenDetails,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [ackLoading, setAckLoading] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const accepted = confirmedBookingId === job.id || Boolean(job.assignmentAcknowledgedAt);

  useEffect(() => { setConfirmedBookingId(null); }, [job.id, job.assignmentNotifiedAt]);

  useEffect(() => {
    const subscription = subscribeAssignmentConfirmed(({jobId}) => {
      if (jobId === job.id) {
        stopAssignmentAlarm(jobId);
        setConfirmedBookingId(jobId);
      }
    });
    return () => subscription.remove();
  }, [job.id]);

  useEffect(() => {
    if (accepted || job.status !== 'ASSIGNED') return;
    return startAssignmentAlarm(job.id);
  }, [job.id, job.status, accepted]);

  const handleAcknowledge = useCallback(async () => {
    if (ackLoading) return;
    setAckLoading(true);
    try {
      const updated = await acknowledgeDriverJob(job.id);
      stopAssignmentAlarm(job.id);
      setConfirmedBookingId(job.id);
      emitJobRefresh();
      showSuccessToast("Assignment confirmed", "Dispatch can see you received this booking.");
      onAcknowledge?.({ ...job, ...updated });
    } catch (error) {
      showErrorToast("Confirmation failed", getErrorMessage(error, "Please try again."));
    } finally {
      setAckLoading(false);
    }
  }, [ackLoading, job, onAcknowledge]);

  const pickup = job.pickup?.addressLine ?? "Pickup not set";
  const dropoff = job.dropoff?.addressLine ?? "Drop not set";

  if (accepted) {
    return null;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onOpenDetails?.(job)}
    >
      <View style={styles.titleRow}>
        <View style={styles.badge}>
          <Ionicons name="alert-circle" size={17} color={colors.brandNavy} />
          <Text style={styles.badgeText}>New ride</Text>
        </View>
        <Text style={styles.ref} numberOfLines={1}>
          {formatBookingRef(job.reference || job.id)}
        </Text>
      </View>

      <Text style={styles.route} numberOfLines={2}>
        {`${pickup} -> ${dropoff}`}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={15} color={colors.muted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {job.scheduledTime
              ? new Date(job.scheduledTime).toLocaleString("en-MY", { hour12: false })
              : "Time not set"}
          </Text>
        </View>
        {job.vehicleNumber ? (
          <View style={styles.metaItem}>
            <Ionicons name="car-outline" size={15} color={colors.muted} />
            <Text style={styles.metaText} numberOfLines={1}>{job.vehicleNumber}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={() => onOpenDetails?.(job)}>
          <Text style={styles.secondaryLabel}>Details</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={handleAcknowledge} disabled={ackLoading}>
          {ackLoading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.primaryLabel}>Got it, confirmed</Text>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginTop: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.brandGold,
      backgroundColor: colors.card,
      padding: 14,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    cardPressed: {
      transform: [{ scale: 0.99 }],
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.brandGold,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    badgeText: {
      color: colors.brandNavy,
      fontSize: typography.caption,
      fontFamily: typography.fontFamilyBold,
    },
    ref: {
      flex: 1,
      textAlign: "right",
      color: colors.text,
      fontSize: typography.caption,
      fontFamily: typography.fontFamilyBold,
    },
    route: {
      marginTop: 10,
      color: colors.text,
      fontSize: typography.body,
      lineHeight: 20,
    },
    metaRow: {
      marginTop: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      maxWidth: "100%",
    },
    metaText: {
      color: colors.muted,
      fontSize: typography.caption,
    },
    actions: {
      marginTop: 12,
      flexDirection: "row",
      gap: 10,
    },
    secondaryButton: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 11,
      alignItems: "center",
    },
    secondaryLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontFamily: typography.fontFamilyMedium,
    },
    primaryButton: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: colors.primary,
      paddingVertical: 11,
      alignItems: "center",
    },
    primaryLabel: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontFamily: typography.fontFamilyBold,
    },
  });
