import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { Screen } from "../../components/Screen";
import { FeedbackPrompt } from "../../components/FeedbackPrompt";
import { RideMapView } from "../../components/RideMapView";
import { useLocationService } from "../../hooks/useLocationService";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import {
  ActiveJobsStackParamList,
  HistoryJobsStackParamList,
  UpcomingJobsStackParamList,
} from "../../types/navigation";
import {
  DriverJob,
  DriverJobDetail,
  JobStatus,
  getDriverJobDetails,
  getDriverJobs,
  updateDriverJobStatus,
  verifyPickupCode,
  notifyDriverArrival,
} from "../../api/driver";
import { getErrorMessage } from "../../utils/errors";
import {
  showErrorToast,
  showSuccessToast,
  showInfoToast,
} from "../../utils/toast";
import { emitJobRefresh } from "../../utils/events";
import { socketService } from "../../services/socketService";
import { formatMYR, shortBookingRef, bookingRefFull } from "../../utils/format";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const PICKUP_CODE_LENGTH = 6;

// Pickup proximity threshold in meters (100m radius)
const PICKUP_PROXIMITY_THRESHOLD_METERS = 200;

// Simple distance calculation using Haversine formula (no external dependency)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

const STATUS_LABELS: Record<JobStatus, string> = {
  ASSIGNED: "Assigned",
  EN_ROUTE: "En route",
  ARRIVED: "Arrived",
  PICKED_UP: "Picked up",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_TRANSITIONS: Partial<Record<JobStatus, JobStatus>> = {
  ASSIGNED: "EN_ROUTE",
  EN_ROUTE: "ARRIVED",
  ARRIVED: "PICKED_UP",
  PICKED_UP: "COMPLETED",
};

const TERMINAL_STATUSES: JobStatus[] = ["COMPLETED", "CANCELLED"];
const ACTIVE_RIDE_STATUSES: JobStatus[] = ["EN_ROUTE", "ARRIVED", "PICKED_UP"];

type CombinedStackParamList = ActiveJobsStackParamList &
  UpcomingJobsStackParamList &
  HistoryJobsStackParamList;

type Props = NativeStackScreenProps<CombinedStackParamList, "JobDetails">;

export const JobDetailsScreen: React.FC<Props> = ({ route }) => {
  const { jobId } = route.params ?? {};
  const rootNavigation = useNavigation<any>();
  const [job, setJob] = useState<DriverJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [hasInProgressRide, setHasInProgressRide] = useState(false);
  const [inProgressRideId, setInProgressRideId] = useState<string | null>(null);
  const [pickupCodeModalVisible, setPickupCodeModalVisible] = useState(false);
  const [pickupCode, setPickupCode] = useState("");
  const [awaitingRideStartConfirmation, setAwaitingRideStartConfirmation] =
    useState(false);

  const canSubmitPickupCode = useMemo(() => {
    const normalized = pickupCode.trim();
    return /^\d{6}$/.test(normalized);
  }, [pickupCode]);

  // Use global location service
  const {
    permissionStatus,
    requestPermission,
    isSharingLocation,
    setHighFrequencyMode,
    isHighFrequencyMode,
    lastKnownCoordinates,
    setActiveBookingId,
  } = useLocationService();

  // Determine if map should be shown (active ride statuses only)
  const showMap = job && ACTIVE_RIDE_STATUSES.includes(job.status);

  const pickupProximity = useMemo(() => {
    try {
      const hasDriverCoords = !!lastKnownCoordinates;
      const hasPickupCoords = !!job?.pickupCoords;
      if (!hasDriverCoords || !hasPickupCoords) {
        return {
          canVerify: false,
          distanceMeters: null as number | null,
          isNear: false,
        };
      }

      const driverLat = Number(lastKnownCoordinates!.latitude);
      const driverLng = Number(lastKnownCoordinates!.longitude);
      const pickupLat = Number(job!.pickupCoords!.lat);
      const pickupLng = Number(job!.pickupCoords!.lng);

      if (
        !Number.isFinite(driverLat) ||
        !Number.isFinite(driverLng) ||
        !Number.isFinite(pickupLat) ||
        !Number.isFinite(pickupLng)
      ) {
        return {
          canVerify: false,
          distanceMeters: null as number | null,
          isNear: false,
        };
      }

      const distance = calculateDistance(
        driverLat,
        driverLng,
        pickupLat,
        pickupLng
      );
      if (!Number.isFinite(distance)) {
        return {
          canVerify: false,
          distanceMeters: null as number | null,
          isNear: false,
        };
      }

      return {
        canVerify: true,
        distanceMeters: distance,
        isNear: distance <= PICKUP_PROXIMITY_THRESHOLD_METERS,
      };
    } catch (error) {
      console.warn("Error calculating pickup proximity:", error);
      return {
        canVerify: false,
        distanceMeters: null as number | null,
        isNear: false,
      };
    }
  }, [lastKnownCoordinates, job?.pickupCoords]);

  const isNearPickup = pickupProximity.canVerify
    ? pickupProximity.isNear
    : false;

  // Check for in-progress rides (EN_ROUTE, ARRIVED, PICKED_UP)
  const checkForInProgressRides = useCallback(async () => {
    try {
      const activeJobs = await getDriverJobs("ACTIVE");
      const inProgressJob = activeJobs.find(
        (j: DriverJob) =>
          ACTIVE_RIDE_STATUSES.includes(j.status) && j.id !== jobId
      );
      setHasInProgressRide(!!inProgressJob);
      setInProgressRideId(inProgressJob?.id ?? null);
    } catch (error) {
      console.warn("Failed to check for in-progress rides:", error);
    }
  }, [jobId]);

  // Notify admin and customer when driver arrives or is at pickup
  const notifyArrival = useCallback(
    async (bookingId: string, type: "arrived" | "at_pickup") => {
      // Send via WebSocket for real-time notification
      socketService.safeSend({
        event: "driver:statusNotification",
        data: {
          bookingId,
          notificationType: type,
          timestamp: new Date().toISOString(),
        },
      });

      // Also send via REST API for persistence and push notifications
      await notifyDriverArrival(
        bookingId,
        type,
        lastKnownCoordinates
          ? {
              latitude: lastKnownCoordinates.latitude,
              longitude: lastKnownCoordinates.longitude,
            }
          : undefined
      );
    },
    [lastKnownCoordinates]
  );

  const fetchDetails = useCallback(async () => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    try {
      const data = await getDriverJobDetails(jobId);
      setJob(data);
    } catch (error) {
      const message = getErrorMessage(error, "Unable to load job details");
      showErrorToast("Job details", message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Fallback: if socket confirmation doesn't arrive, refresh once and unblock UI.
  useEffect(() => {
    if (!awaitingRideStartConfirmation || !jobId) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          const updated = await getDriverJobDetails(jobId);
          setJob(updated);

          if (updated.status === "PICKED_UP") {
            setAwaitingRideStartConfirmation(false);
            setPickupCodeModalVisible(false);
            setPickupCode("");
            emitJobRefresh();
            showSuccessToast("Ride started", "Pickup confirmed.");

            rootNavigation.navigate("ActiveJobsTab", {
              screen: "JobDetails",
              params: { jobId },
            });
            return;
          }

          setAwaitingRideStartConfirmation(false);
          showErrorToast(
            "Ride start",
            "No confirmation received. Please try again."
          );
        } catch (error) {
          setAwaitingRideStartConfirmation(false);
          const message = getErrorMessage(
            error,
            "Failed to refresh ride status"
          );
          showErrorToast("Ride start", message);
        }
      })();
    }, 8000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [awaitingRideStartConfirmation, jobId, rootNavigation]);

  // Join booking room for realtime events and gate ride-start UI on socket confirmation.
  useEffect(() => {
    if (!job?.id) {
      return;
    }

    socketService.joinBookingRoom(job.id);

    const extractBookingId = (payload: any): string | null => {
      if (!payload || typeof payload !== "object") return null;
      return (
        payload.bookingId ??
        payload.id ??
        payload.jobId ??
        payload.booking?.id ??
        payload.job?.id ??
        null
      );
    };

    const extractStatus = (payload: any): string | null => {
      if (!payload || typeof payload !== "object") return null;
      return payload.status ?? payload.booking?.status ?? payload.job?.status;
    };

    const onRideStarted = (payload: any) => {
      const bookingIdFromEvent = extractBookingId(payload);
      if (!bookingIdFromEvent || bookingIdFromEvent !== job.id) return;

      setAwaitingRideStartConfirmation(false);
      setPickupCodeModalVisible(false);
      setPickupCode("");

      void fetchDetails();
      emitJobRefresh();
      showSuccessToast("Ride started", "Pickup confirmed.");

      // Ensure the driver lands in Active tab after ride is started.
      rootNavigation.navigate("ActiveJobsTab", {
        screen: "JobDetails",
        params: { jobId: job.id },
      });
    };

    // Primary: explicit event from backend.
    socketService.on("RIDE_STARTED", onRideStarted);

    // Compatibility: treat status updates to PICKED_UP as confirmation.
    const onStatusUpdated = (payload: any) => {
      const bookingIdFromEvent = extractBookingId(payload);
      if (!bookingIdFromEvent || bookingIdFromEvent !== job.id) return;
      const status = extractStatus(payload);
      if (status === "PICKED_UP") {
        onRideStarted(payload);
      }
    };
    socketService.on("BOOKING_STATUS_UPDATED", onStatusUpdated);

    return () => {
      socketService.off("RIDE_STARTED", onRideStarted);
      socketService.off("BOOKING_STATUS_UPDATED", onStatusUpdated);
      socketService.leaveBookingRoom(job.id);
    };
  }, [job?.id, fetchDetails, rootNavigation]);

  useEffect(() => {
    fetchDetails();
    checkForInProgressRides();
  }, [fetchDetails, checkForInProgressRides]);

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

  // Attach the active booking/job id to location updates while on an active ride
  useEffect(() => {
    if (!job) {
      return;
    }

    const isActiveRide = ACTIVE_RIDE_STATUSES.includes(job.status);
    setActiveBookingId(isActiveRide ? job.id : null);

    return () => {
      setActiveBookingId(null);
    };
  }, [job?.id, job?.status, setActiveBookingId]);

  const performStatusUpdate = useCallback(
    async (nextStatus: JobStatus, reason?: string) => {
      if (!job) {
        return;
      }

      // Prevent En Route if another ride is in progress
      if (nextStatus === "EN_ROUTE" && hasInProgressRide) {
        Alert.alert(
          "Ride In Progress",
          "You have another ride in progress. Please complete or cancel that ride first.",
          [{ text: "OK" }]
        );
        return;
      }

      setActionLoading(true);
      try {
        const updatedJob = await updateDriverJobStatus(
          job.id,
          nextStatus,
          reason
        );
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
        showSuccessToast(
          "Status updated",
          `Ride marked as ${STATUS_LABELS[nextStatus]}`
        );

        // Notify admin and customer when driver marks as arrived
        if (nextStatus === "ARRIVED") {
          notifyArrival(job.id, "arrived");
          showInfoToast(
            "Notification sent",
            "Admin and customer have been notified of your arrival"
          );
        }

        // Show feedback prompt after completing a trip
        if (nextStatus === "COMPLETED") {
          setTimeout(() => setShowFeedbackPrompt(true), 1000);
        }

        // Refresh in-progress rides check
        checkForInProgressRides();
      } catch (error) {
        const message = getErrorMessage(error, "Failed to update status");
        showErrorToast("Update failed", message);
      } finally {
        setActionLoading(false);
        setCancelModalVisible(false);
        setCancelReason("");
        setPickupCodeModalVisible(false);
        setPickupCode("");
        setAwaitingRideStartConfirmation(false);
      }
    },
    [job, hasInProgressRide, notifyArrival, checkForInProgressRides]
  );

  const handleStatusUpdate = useCallback(
    async (nextStatus: JobStatus, reason?: string) => {
      if (!job) {
        return;
      }

      // Prevent En Route if another ride is in progress
      if (nextStatus === "EN_ROUTE" && hasInProgressRide) {
        Alert.alert(
          "Ride In Progress",
          "You have another ride in progress. Please complete or cancel that ride first.",
          [{ text: "OK" }]
        );
        return;
      }

      // Validate proximity for marking as ARRIVED
      if (nextStatus === "ARRIVED") {
        if (pickupProximity.canVerify && !pickupProximity.isNear) {
          const distanceText =
            typeof pickupProximity.distanceMeters === "number"
              ? ` (currently ~${Math.round(
                  pickupProximity.distanceMeters
                )}m away)`
              : "";
          Alert.alert(
            "Not at Pickup Location",
            `You need to be within ${PICKUP_PROXIMITY_THRESHOLD_METERS}m of the pickup location to mark as arrived.${distanceText}`,
            [{ text: "OK" }]
          );
          return;
        }

        // If we cannot verify (missing pickup coords or location), allow with confirmation.
        if (!pickupProximity.canVerify) {
          if (permissionStatus !== "granted") {
            Alert.alert(
              "Location Permission Needed",
              "Enable location permission to verify you are at the pickup point.",
              [
                { text: "Not now", style: "cancel" },
                {
                  text: "Enable",
                  onPress: () => {
                    requestPermission().catch(() => undefined);
                  },
                },
              ]
            );
            return;
          }

          Alert.alert(
            "Unable to Verify Proximity",
            "Pickup coordinates or your current GPS location are unavailable. Do you want to mark as arrived anyway?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Mark arrived",
                onPress: () => void performStatusUpdate(nextStatus, reason),
              },
            ]
          );
          return;
        }
      }

      await performStatusUpdate(nextStatus, reason);
    },
    [
      job,
      hasInProgressRide,
      performStatusUpdate,
      pickupProximity,
      permissionStatus,
      requestPermission,
    ]
  );

  const nextStatus = job ? STATUS_TRANSITIONS[job.status] ?? null : null;
  const isJobTerminal = job ? TERMINAL_STATUSES.includes(job.status) : false;

  const getStatusColor = (status?: JobStatus) => {
    switch (status) {
      case "COMPLETED":
        return "#2E7D32"; // green
      case "CANCELLED":
        return "#C62828"; // red
      case "PICKED_UP":
        return "#1565C0"; // blue
      case "ARRIVED":
        return "#F9A825"; // amber
      default:
        return colors.border;
    }
  };

  const confirmCashAndComplete = useCallback(() => {
    if (!job) return;
    Alert.alert(
      "Confirm cash received",
      "Have you received the cash payment from the passenger?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, received",
          onPress: async () => {
            // Use reason to indicate cash received; backend may record payment when completing
            await performStatusUpdate("COMPLETED", "CASH_PAID");
            // Ensure UI reflects payment status
            setJob((prev) =>
              prev ? { ...prev, paymentStatus: "PAID" } : prev
            );
          },
        },
      ]
    );
  }, [job, performStatusUpdate]);

  const handleCallPassenger = useCallback(() => {
    if (!job || !job.passengerPhone || job.passengerPhone.trim() === "") {
      Alert.alert("No phone number", "Customer phone number is not available.");
      return;
    }
    Linking.openURL(`tel:${job.passengerPhone}`).catch(() =>
      Alert.alert("Dial failed", "Unable to initiate a call on this device.")
    );
  }, [job]);

  const handleWhatsApp = useCallback(() => {
    if (!job || !job.passengerPhone || job.passengerPhone.trim() === "") {
      Alert.alert("No phone number", "Customer phone number is not available.");
      return;
    }
    const digits = job.passengerPhone.replace(/[^\d+]/g, "");
    if (!digits) {
      Alert.alert("Invalid phone number", "Customer phone number is invalid.");
      return;
    }
    const url = `https://wa.me/${digits.replace("+", "")}`;
    Linking.openURL(url).catch(() =>
      Alert.alert(
        "WhatsApp unavailable",
        "Install WhatsApp or try calling the customer instead."
      )
    );
  }, [job]);

  const confirmCancellation = useCallback(() => {
    if (!cancelReason.trim()) {
      Alert.alert(
        "Reason required",
        "Please provide a reason to cancel this ride."
      );
      return;
    }
    handleStatusUpdate("CANCELLED", cancelReason.trim());
  }, [cancelReason, handleStatusUpdate]);

  const formatDateTime = useCallback((value?: string) => {
    if (!value) {
      return "—";
    }
    return new Date(value).toLocaleString();
  }, []);

  const timelineItems = useMemo(() => job?.timeline ?? [], [job]);

  // Calculate estimated time display (must be before any early returns - hooks rule)
  const estimatedTime = useMemo((): string | undefined => {
    if (job?.durationMinutes) {
      const hours = Math.floor(job.durationMinutes / 60);
      const mins = job.durationMinutes % 60;
      if (hours > 0) {
        return `${hours}h ${mins}m`;
      }
      return `${mins} min`;
    }
    return undefined;
  }, [job?.durationMinutes]);

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
        <Text style={styles.errorText}>
          Invalid job reference. Please go back and try again.
        </Text>
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

  const isAirportTransfer =
    job.rideType === "AIRPORT_TRANSFER" ||
    job.rideType === "AIRPORT_RETURN_TRANSFER";

  const pickupAddress = job.pickup?.addressLine ?? "Pickup location pending";
  const dropoffAddress = job.dropoff?.addressLine ?? "Dropoff location pending";
  const dropoffNote = job.dropoff?.landmark ?? "";

  // Active ride: Map at top with details panel below (non-overlapping)
  if (showMap) {
    // Fullscreen map modal
    if (isMapFullscreen) {
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
            showDirections
            estimatedTime={estimatedTime}
            estimatedDistance={
              job.distanceKm ? `${job.distanceKm.toFixed(1)} km` : undefined
            }
          />

          {/* Close fullscreen button */}
          <Pressable
            style={styles.closeFullscreenButton}
            onPress={() => setIsMapFullscreen(false)}
          >
            <Text style={styles.closeFullscreenButtonText}>✕</Text>
          </Pressable>

          {/* Navigate button overlay */}
          <View style={styles.fullscreenNavigateContainer}>
            <Pressable
              style={styles.navigateOverlayButton}
              onPress={() => {
                const destination =
                  job.status === "PICKED_UP" && job.dropCoords
                    ? {
                        lat: job.dropCoords.lat,
                        lng: job.dropCoords.lng,
                        label: "Drop-off",
                      }
                    : job.pickupCoords
                    ? {
                        lat: job.pickupCoords.lat,
                        lng: job.pickupCoords.lng,
                        label: "Pickup",
                      }
                    : null;
                if (destination) {
                  const url = `google.navigation:q=${destination.lat},${destination.lng}`;
                  Linking.openURL(url).catch(() => {
                    Linking.openURL(
                      `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`
                    );
                  });
                }
              }}
            >
              <Text style={styles.navigateOverlayButtonText}>
                🧭 Navigate to{" "}
                {job.status === "PICKED_UP" ? "Drop-off" : "Pickup"}
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    // Normal view: Map at top, details panel below (no overlap)
    return (
      <View style={styles.activeRideContainer}>
        {/* Map section - top aligned */}
        <View style={styles.mapSection}>
          <RideMapView
            driverLocation={lastKnownCoordinates}
            pickupCoords={job.pickupCoords}
            dropCoords={job.dropCoords}
            status={job.status}
            pickupAddress={pickupAddress}
            dropAddress={dropoffAddress}
            showDirections
            estimatedTime={estimatedTime}
            estimatedDistance={
              job.distanceKm ? `${job.distanceKm.toFixed(1)} km` : undefined
            }
          />

          {/* Maximize map button */}
          <Pressable
            style={styles.maximizeMapButton}
            onPress={() => setIsMapFullscreen(true)}
          >
            <Text style={styles.maximizeMapButtonText}>⛶</Text>
          </Pressable>
        </View>

        {/* Details panel - scrollable below map */}
        <ScrollView
          style={styles.detailsPanel}
          contentContainerStyle={styles.detailsPanelContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Customer info row */}
          <View style={styles.overlayCustomerRow}>
            <View style={styles.overlayCustomerInfo}>
              <Text style={styles.overlayCustomerName}>
                {job.passengerName || "Customer"}
              </Text>
              <Text style={styles.overlayCustomerPhone}>
                Booking ID: {shortBookingRef(job.id)}
              </Text>
              {job.passengerPhone && job.passengerPhone.trim() !== "" && (
                <Text style={styles.overlayCustomerPhone}>
                  {job.passengerPhone}
                </Text>
              )}
            </View>
            <View style={styles.customerActions}>
              <Pressable
                style={[
                  styles.overlayCallButton,
                  (!job.passengerPhone || job.passengerPhone.trim() === "") &&
                    styles.overlayCallButtonDisabled,
                ]}
                onPress={handleCallPassenger}
                disabled={
                  !job.passengerPhone || job.passengerPhone.trim() === ""
                }
              >
                <Text style={styles.overlayCallIcon}>📞</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.overlayCallButton,
                  styles.whatsappButton,
                  (!job.passengerPhone || job.passengerPhone.trim() === "") &&
                    styles.overlayCallButtonDisabled,
                ]}
                onPress={handleWhatsApp}
                disabled={
                  !job.passengerPhone || job.passengerPhone.trim() === ""
                }
              >
                <Text style={styles.overlayCallIcon}>💬</Text>
              </Pressable>
            </View>
          </View>

          {/* Location details */}
          <View style={styles.locationDetailsCard}>
            <View style={styles.locationDetailRow}>
              <View style={[styles.locationDot, styles.pickupDot]} />
              <View style={styles.locationDetailText}>
                <Text style={styles.locationDetailLabel}>Pickup</Text>
                <Text style={styles.locationDetailValue}>{pickupAddress}</Text>
              </View>
            </View>
            <View style={styles.locationConnector} />
            <View style={styles.locationDetailRow}>
              <View style={[styles.locationDot, styles.dropDotStyle]} />
              <View style={styles.locationDetailText}>
                <Text style={styles.locationDetailLabel}>Drop-off</Text>
                <Text style={styles.locationDetailValue}>{dropoffAddress}</Text>
                {dropoffNote ? (
                  <Text style={styles.locationDetailNote}>{dropoffNote}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {isAirportTransfer && job.flightNo ? (
            <View style={styles.locationDetailsCard}>
              <View style={styles.locationDetailRow}>
                <View style={[styles.locationDot, styles.pickupDot]} />
                <View style={styles.locationDetailText}>
                  <Text style={styles.locationDetailLabel}>Flight No</Text>
                  <Text style={styles.locationDetailValue}>{job.flightNo}</Text>
                </View>
              </View>
              <View style={styles.locationConnector} />
              <View style={styles.locationDetailRow}>
                <View style={[styles.locationDot, styles.dropDotStyle]} />
                <View style={styles.locationDetailText}>
                  <Text style={styles.locationDetailLabel}>Flight ETA</Text>
                  <Text style={styles.locationDetailValue}>
                    {job.flightEta ? formatDateTime(job.flightEta) : "—"}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Fare & Payment info row */}
          <View style={styles.overlayPaymentRow}>
            <View style={styles.overlayPaymentItem}>
              <Text style={styles.overlayPaymentLabel}>Fare</Text>
              <Text style={styles.overlayPaymentValue}>
                {job.paymentAmount != null && job.paymentAmount > 0
                  ? formatMYR(job.paymentAmount)
                  : "—"}
              </Text>
            </View>
            <View style={styles.overlayPaymentItem}>
              <Text style={styles.overlayPaymentLabel}>Method</Text>
              <Text style={styles.overlayPaymentValue}>
                {job.paymentMethod ?? "—"}
              </Text>
            </View>
            <View style={styles.overlayPaymentItem}>
              <Text style={styles.overlayPaymentLabel}>Status</Text>
              <Text
                style={[
                  styles.overlayPaymentValue,
                  job.paymentStatus === "PAID" && styles.overlayPaymentPaid,
                ]}
              >
                {job.paymentStatus ?? "—"}
              </Text>
            </View>
          </View>

          {/* Proximity indicator for ARRIVED status validation */}
          {job.status === "EN_ROUTE" && (
            <View
              style={[
                styles.proximityIndicator,
                isNearPickup ? styles.proximityNear : styles.proximityFar,
              ]}
            >
              <Text style={styles.proximityText}>
                {isNearPickup
                  ? `✓ You are at the pickup location${
                      pickupProximity.canVerify &&
                      typeof pickupProximity.distanceMeters === "number"
                        ? ` (~${Math.round(pickupProximity.distanceMeters)}m)`
                        : ""
                    }`
                  : pickupProximity.canVerify &&
                    typeof pickupProximity.distanceMeters === "number"
                  ? `Navigate to pickup to mark as arrived (within ${PICKUP_PROXIMITY_THRESHOLD_METERS}m) • ~${Math.round(
                      pickupProximity.distanceMeters
                    )}m away`
                  : `Navigate to pickup to mark as arrived (within ${PICKUP_PROXIMITY_THRESHOLD_METERS}m)`}
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.overlayActionsContainer}>
            {nextStatus && (
              <Pressable
                style={[
                  styles.overlayPrimaryAction,
                  nextStatus === "ARRIVED" &&
                    pickupProximity.canVerify &&
                    !pickupProximity.isNear &&
                    styles.actionButtonDisabledStyle,
                ]}
                onPress={() => {
                  if (nextStatus === "PICKED_UP") {
                    setPickupCodeModalVisible(true);
                    return;
                  }
                  if (
                    nextStatus === "COMPLETED" &&
                    (job.paymentMethod ?? "").toUpperCase() === "CASH" &&
                    job.paymentStatus !== "PAID"
                  ) {
                    confirmCashAndComplete();
                  } else {
                    handleStatusUpdate(nextStatus);
                  }
                }}
                disabled={
                  actionLoading ||
                  (nextStatus === "ARRIVED" &&
                    pickupProximity.canVerify &&
                    !pickupProximity.isNear)
                }
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.overlayPrimaryActionLabel,
                      nextStatus === "ARRIVED" &&
                        pickupProximity.canVerify &&
                        !pickupProximity.isNear &&
                        styles.overlayPrimaryActionLabelDisabled,
                    ]}
                  >
                    {nextStatus === "ARRIVED" && "Mark as Arrived"}
                    {nextStatus === "PICKED_UP" && "Start Ride"}
                    {nextStatus === "COMPLETED" &&
                      ((job.paymentMethod ?? "").toUpperCase() === "CASH" &&
                      job.paymentStatus !== "PAID"
                        ? "Confirm Cash Received"
                        : "Mark Completed")}
                  </Text>
                )}
              </Pressable>
            )}
            <Pressable
              style={styles.overlayCancelAction}
              onPress={() => setCancelModalVisible(true)}
            >
              <Text style={styles.overlayCancelActionLabel}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Pickup Code Modal */}
        <Modal
          visible={pickupCodeModalVisible}
          animationType="slide"
          transparent
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>Enter Pickup Code</Text>
              <Text style={styles.subtle}>
                Ask the customer for the pickup code to start the ride.
              </Text>
              {awaitingRideStartConfirmation && (
                <Text style={styles.subtle}>
                  Code accepted. Waiting for confirmation…
                </Text>
              )}
              <TextInput
                style={styles.modalInput}
                placeholder={`Enter ${PICKUP_CODE_LENGTH}-digit code`}
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={pickupCode}
                onChangeText={(value) => {
                  const digitsOnly = value
                    .replace(/[^0-9]/g, "")
                    .slice(0, PICKUP_CODE_LENGTH);
                  setPickupCode(digitsOnly);
                }}
                maxLength={PICKUP_CODE_LENGTH}
                editable={!actionLoading && !awaitingRideStartConfirmation}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalSecondary}
                  onPress={() => {
                    if (awaitingRideStartConfirmation) {
                      return;
                    }
                    setPickupCodeModalVisible(false);
                    setPickupCode("");
                  }}
                  disabled={actionLoading || awaitingRideStartConfirmation}
                >
                  <Text style={styles.secondaryActionLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalPrimary}
                  onPress={() => {
                    if (!job) return;
                    if (awaitingRideStartConfirmation) return;

                    const normalizedCode = pickupCode.trim();
                    if (!/^\d{6}$/.test(normalizedCode)) {
                      Alert.alert(
                        "Invalid code",
                        `Please enter the ${PICKUP_CODE_LENGTH}-digit pickup code to start the ride.`
                      );
                      return;
                    }

                    setActionLoading(true);
                    setPickupCode("");

                    void (async () => {
                      try {
                        const result = await verifyPickupCode(
                          job.id,
                          normalizedCode
                        );

                        if (result.ok) {
                          setAwaitingRideStartConfirmation(true);
                          showInfoToast(
                            "Pickup code verified",
                            "Waiting for ride start confirmation…"
                          );

                          // Also refresh once immediately in case the socket event is missed.
                          void (async () => {
                            try {
                              const updated = await getDriverJobDetails(job.id);
                              setJob(updated);
                              if (updated.status === "PICKED_UP") {
                                setAwaitingRideStartConfirmation(false);
                                setPickupCodeModalVisible(false);
                                setPickupCode("");
                                emitJobRefresh();
                                showSuccessToast(
                                  "Ride started",
                                  "Pickup confirmed."
                                );

                                rootNavigation.navigate("ActiveJobsTab", {
                                  screen: "JobDetails",
                                  params: { jobId: job.id },
                                });
                              }
                            } catch {
                              // Ignore; timeout fallback will handle.
                            }
                          })();
                          return;
                        }

                        if (result.error === "INVALID_CODE") {
                          showErrorToast(
                            "Invalid code",
                            result.message ??
                              "Pickup code is incorrect. Please try again."
                          );
                          return;
                        }

                        if (result.error === "CODE_LOCKED") {
                          Alert.alert(
                            "Code locked",
                            result.message ??
                              "Too many attempts. Please contact support."
                          );
                          return;
                        }
                      } catch (error) {
                        const message = getErrorMessage(
                          error,
                          "Failed to verify pickup code"
                        );
                        showErrorToast("Verification failed", message);
                      } finally {
                        setActionLoading(false);
                      }
                    })();
                  }}
                  disabled={
                    actionLoading ||
                    awaitingRideStartConfirmation ||
                    !canSubmitPickupCode
                  }
                >
                  {actionLoading || awaitingRideStartConfirmation ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryActionLabel}>
                      Verify & Start Ride
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Cancel Modal */}
        <Modal visible={cancelModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>Cancel Ride</Text>
              <Text style={styles.subtle}>
                Provide a reason so dispatch can notify the rider.
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Reason for cancellation"
                placeholderTextColor={colors.muted}
                multiline
                value={cancelReason}
                onChangeText={setCancelReason}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalSecondary}
                  onPress={() => setCancelModalVisible(false)}
                >
                  <Text style={styles.secondaryActionLabel}>Dismiss</Text>
                </Pressable>
                <Pressable
                  style={styles.modalPrimary}
                  onPress={confirmCancellation}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryActionLabel}>
                      Confirm cancel
                    </Text>
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
            <Text style={styles.jobId}>Ref: {shortBookingRef(job.id)}</Text>
            <Text style={[styles.subtle, { marginTop: 6 }]}>
              Vehicle: {job.vehiclePlate ?? "—"}
            </Text>
          </View>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>
              {STATUS_LABELS[job.status]}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup & Drop</Text>
          <View style={styles.locationRow}>
            <View style={styles.locationBullet} />
            <View>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationValue}>{pickupAddress}</Text>
              <Text style={styles.subtle}>
                {formatDateTime(job.scheduledTime)}
              </Text>
            </View>
          </View>
          <View style={[styles.locationRow, { marginTop: 16 }]}>
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
          <Text style={styles.customerName}>
            {job.passengerName || "Customer"}
          </Text>
          {job.passengerPhone && job.passengerPhone.trim() !== "" ? (
            <Text style={styles.customerContact}>{job.passengerPhone}</Text>
          ) : (
            <Text style={[styles.customerContact, { color: colors.muted }]}>
              Phone not available
            </Text>
          )}
          {job.passengerEmail ? (
            <Text style={styles.customerContact}>{job.passengerEmail}</Text>
          ) : null}
          <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.actionButton,
                (!job.passengerPhone || job.passengerPhone.trim() === "") &&
                  styles.actionButtonDisabled,
              ]}
              onPress={handleCallPassenger}
              disabled={!job.passengerPhone || job.passengerPhone.trim() === ""}
            >
              <Text
                style={[
                  styles.actionLabel,
                  (!job.passengerPhone || job.passengerPhone.trim() === "") &&
                    styles.actionLabelDisabled,
                ]}
              >
                Call
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.actionButton,
                (!job.passengerPhone || job.passengerPhone.trim() === "") &&
                  styles.actionButtonDisabled,
              ]}
              onPress={handleWhatsApp}
              disabled={!job.passengerPhone || job.passengerPhone.trim() === ""}
            >
              <Text
                style={[
                  styles.actionLabel,
                  (!job.passengerPhone || job.passengerPhone.trim() === "") &&
                    styles.actionLabelDisabled,
                ]}
              >
                WhatsApp
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride Details</Text>
          {(job.distanceKm !== undefined ||
            job.durationMinutes !== undefined) && (
            <View style={styles.distanceTimeRow}>
              {job.distanceKm !== undefined && (
                <View style={styles.distanceTimeItem}>
                  <Text style={styles.distanceTimeValue}>
                    {job.distanceKm.toFixed(1)} km
                  </Text>
                  <Text style={styles.distanceTimeLabel}>Distance</Text>
                </View>
              )}
              {job.durationMinutes !== undefined && (
                <View style={styles.distanceTimeItem}>
                  <Text style={styles.distanceTimeValue}>
                    {job.durationMinutes} min
                  </Text>
                  <Text style={styles.distanceTimeLabel}>Est. Time</Text>
                </View>
              )}
            </View>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Estimated Fare</Text>
            <Text style={styles.metaValue}>
              {job.paymentAmount != null && job.paymentAmount > 0
                ? formatMYR(job.paymentAmount)
                : "—"}
            </Text>
          </View>
          {isAirportTransfer && job.flightNo ? (
            <>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Flight No</Text>
                <Text style={styles.metaValue}>{job.flightNo}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Flight ETA</Text>
                <Text style={styles.metaValue}>
                  {job.flightEta ? formatDateTime(job.flightEta) : "—"}
                </Text>
              </View>
            </>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Payment Method</Text>
            <Text style={styles.metaValue}>{job.paymentMethod ?? "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Payment Status</Text>
            <Text style={styles.metaValue}>{job.paymentStatus ?? "—"}</Text>
          </View>
          {job.notes ? <Text style={styles.notes}>{job.notes}</Text> : null}
          {isSharingLocation && ACTIVE_RIDE_STATUSES.includes(job.status) && (
            <Text style={styles.trackingBadge}>
              Sharing live location with dispatch
              {isHighFrequencyMode ? " (high frequency)" : ""}…
            </Text>
          )}
        </View>

        {!isJobTerminal && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status Timeline</Text>
            {timelineItems.map((item) => {
              const isActive = item.status === job.status;
              return (
                <View
                  key={`${item.status}-${item.timestamp}`}
                  style={styles.timelineRow}
                >
                  <View
                    style={[
                      styles.timelineIndicator,
                      isActive && styles.timelineIndicatorActive,
                    ]}
                  />
                  <View>
                    <Text
                      style={[
                        styles.timelineStatus,
                        isActive && styles.timelineStatusActive,
                      ]}
                    >
                      {STATUS_LABELS[item.status]}
                    </Text>
                    <Text style={styles.subtle}>
                      {formatDateTime(item.timestamp)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!isJobTerminal && (
          <View style={styles.section}>
            {/* Warning for in-progress ride */}
            {hasInProgressRide && nextStatus === "EN_ROUTE" && (
              <View style={styles.inProgressWarning}>
                <Text style={styles.inProgressWarningText}>
                  ⚠️ You have another ride in progress. Complete or cancel that
                  ride first.
                </Text>
              </View>
            )}

            {nextStatus && (
              <Pressable
                style={[
                  styles.primaryAction,
                  hasInProgressRide &&
                    nextStatus === "EN_ROUTE" &&
                    styles.primaryActionDisabled,
                ]}
                onPress={() => {
                  if (
                    nextStatus === "COMPLETED" &&
                    (job.paymentMethod ?? "").toUpperCase() === "CASH" &&
                    job.paymentStatus !== "PAID"
                  ) {
                    confirmCashAndComplete();
                  } else {
                    handleStatusUpdate(nextStatus);
                  }
                }}
                disabled={
                  actionLoading ||
                  (hasInProgressRide && nextStatus === "EN_ROUTE")
                }
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryActionLabel}>
                    {nextStatus === "COMPLETED" &&
                    (job.paymentMethod ?? "").toUpperCase() === "CASH" &&
                    job.paymentStatus !== "PAID"
                      ? "Confirm Cash Received"
                      : `Mark as ${STATUS_LABELS[nextStatus]}`}
                  </Text>
                )}
              </Pressable>
            )}

            <Pressable
              style={styles.secondaryAction}
              onPress={() => setCancelModalVisible(true)}
            >
              <Text style={styles.secondaryActionLabel}>Cancel ride</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={cancelModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Cancel Ride</Text>
            <Text style={styles.subtle}>
              Provide a reason so dispatch can notify the rider.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for cancellation"
              placeholderTextColor={colors.muted}
              multiline
              value={cancelReason}
              onChangeText={setCancelReason}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondary}
                onPress={() => setCancelModalVisible(false)}
              >
                <Text style={styles.secondaryActionLabel}>Dismiss</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimary}
                onPress={confirmCancellation}
                disabled={actionLoading}
              >
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
  activeRideContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapSection: {
    height: SCREEN_HEIGHT * 0.35,
    position: "relative",
  },
  detailsPanel: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
  },
  detailsPanelContent: {
    padding: 16,
    paddingBottom: 32,
  },
  maximizeMapButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  maximizeMapButtonText: {
    fontSize: 20,
    color: colors.text,
  },
  closeFullscreenButton: {
    position: "absolute",
    top: 40,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeFullscreenButtonText: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  fullscreenNavigateContainer: {
    position: "absolute",
    bottom: 40,
    left: 16,
    right: 16,
  },
  statusEtaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  etaBadge: {
    flexDirection: "row",
    gap: 12,
  },
  etaText: {
    fontSize: typography.caption,
    color: colors.primary,
    fontFamily: typography.fontFamilyMedium,
  },
  overlayCustomerPhone: {
    fontSize: typography.caption,
    color: colors.muted,
    marginTop: 2,
  },
  customerActions: {
    flexDirection: "row",
    gap: 8,
  },
  whatsappButton: {
    backgroundColor: "#25D366",
  },
  locationDetailsCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  locationDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  pickupDot: {
    backgroundColor: colors.primary,
  },
  dropDotStyle: {
    backgroundColor: colors.accent,
  },
  locationDetailText: {
    flex: 1,
  },
  locationDetailLabel: {
    fontSize: typography.caption,
    color: colors.muted,
  },
  locationDetailValue: {
    fontSize: typography.body,
    color: colors.text,
    marginTop: 2,
  },
  locationDetailNote: {
    fontSize: typography.caption,
    color: colors.muted,
    fontStyle: "italic",
    marginTop: 2,
  },
  locationConnector: {
    width: 2,
    height: 20,
    backgroundColor: colors.border,
    marginLeft: 5,
    marginVertical: 4,
  },
  proximityIndicator: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  proximityNear: {
    backgroundColor: "#E8F5E9",
  },
  proximityFar: {
    backgroundColor: "#FFF3E0",
  },
  proximityText: {
    fontSize: typography.caption,
    textAlign: "center",
    color: colors.text,
  },
  actionButtonDisabledStyle: {
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 24,
    shadowColor: "#000",
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
    alignItems: "center",
    marginBottom: 12,
  },
  navigateOverlayButtonText: {
    color: "#fff",
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  overlayStatusBadge: {
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignSelf: "center",
  },
  overlayStatusText: {
    fontSize: typography.caption,
    color: colors.text,
    fontFamily: typography.fontFamilyMedium,
  },
  overlayCustomerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingVertical: 8,
  },
  overlayPaymentItem: {
    alignItems: "center",
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
    flexDirection: "row",
    gap: 12,
  },
  overlayPrimaryAction: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayPrimaryActionLabel: {
    color: "#fff",
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  overlayPrimaryActionLabelDisabled: {
    color: colors.text,
  },
  overlayCancelAction: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayCancelActionLabel: {
    color: colors.danger,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    color: "#fff",
    fontSize: typography.caption,
  },
  section: {
    backgroundColor: "#fff",
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
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
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
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  distanceTimeRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  distanceTimeItem: {
    alignItems: "center",
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
    flexDirection: "row",
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
    alignItems: "center",
    marginBottom: 12,
  },
  primaryActionDisabled: {
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  primaryActionLabel: {
    color: "#fff",
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  inProgressWarning: {
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FFB74D",
  },
  inProgressWarningText: {
    fontSize: typography.caption,
    color: "#E65100",
    textAlign: "center",
  },
  secondaryAction: {
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryActionLabel: {
    color: colors.danger,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
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
    textAlignVertical: "top",
  },
  modalActions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
  },
  modalSecondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    paddingVertical: 12,
  },
  modalPrimary: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    paddingVertical: 12,
  },
});
