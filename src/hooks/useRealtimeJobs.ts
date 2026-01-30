import { useCallback, useEffect, useRef, useState } from 'react';

import { DriverJob, getDriverJobs, JobStatus, JobType } from '../api/driver';
import { socketService } from '../services/socketService';

type BookingAssignedPayload = any;
type BookingStatusUpdatedPayload = any;

const STATUS_TO_TYPE_FALLBACK = (status?: JobStatus, scheduledTime?: string): JobType => {
	if (status === 'COMPLETED' || status === 'CANCELLED') return 'HISTORY';
	if (scheduledTime) {
		const t = Date.parse(scheduledTime);
		if (!Number.isNaN(t) && t > Date.now()) return 'UPCOMING';
	}
	return 'ACTIVE';
};

const normalizeIncomingJob = (payload: any, defaultType: JobType): DriverJob | null => {
	if (!payload || typeof payload !== 'object') return null;

	// Already in DriverJob shape
	if (typeof payload.id === 'string' && typeof payload.status === 'string' && typeof payload.reference === 'string') {
		const type: JobType = payload.type ?? STATUS_TO_TYPE_FALLBACK(payload.status, payload.scheduledTime);
		return { ...(payload as DriverJob), type };
	}

	// BackendJob-like shape (best effort)
	if (typeof payload.id === 'string' && typeof payload.status === 'string') {
		const type: JobType = payload.type ?? defaultType ?? STATUS_TO_TYPE_FALLBACK(payload.status, payload.pickupTime);
		return {
			id: payload.id,
			reference: payload.ref ?? payload.reference ?? payload.id,
			status: payload.status,
			type,
			rideType: payload.rideType,
			source: payload.source,
			vehicleNumber: payload.vehicle?.registrationNo ?? payload.vehicleNumber,
			pickup: payload.pickup ? payload.pickup : payload.pickupLocation ? { addressLine: payload.pickupLocation } : null,
			dropoff: payload.dropoff ? payload.dropoff : payload.dropLocation ? { addressLine: payload.dropLocation } : null,
			pickupCoords: payload.pickupCoords ?? null,
			dropCoords: payload.dropCoords ?? null,
			paymentAmount: payload.paymentAmount ?? null,
			finalPrice: payload.finalPrice ?? null,
			paymentMethod: payload.paymentMethod,
			paymentStatus: payload.paymentStatus,
			passengerName: payload.guestName ?? payload.passengerName ?? 'Customer',
			passengerPhone: payload.guestPhone ?? payload.passengerPhone ?? '',
			passengerEmail: payload.passengerEmail,
			scheduledTime: payload.pickupTime ?? payload.scheduledTime ?? new Date().toISOString(),
			notes: payload.notes,
			flightNo: payload.flightNo ?? null,
			flightEta: payload.flightEta ?? null,
		};
	}

	return null;
};

const extractJobId = (payload: any): string | null => {
	if (!payload || typeof payload !== 'object') return null;
	return payload.id ?? payload.jobId ?? payload.bookingId ?? null;
};

const extractPartialUpdate = (payload: any): Partial<DriverJob> => {
	if (!payload || typeof payload !== 'object') return {};
	const partial: Partial<DriverJob> = {};
	if (payload.status) partial.status = payload.status;
	if (payload.type) partial.type = payload.type;
	if (payload.scheduledTime) partial.scheduledTime = payload.scheduledTime;
	if (payload.pickupTime) partial.scheduledTime = payload.pickupTime;
	if (payload.reference) partial.reference = payload.reference;
	if (payload.ref) partial.reference = payload.ref;
	return partial;
};

export const useRealtimeJobs = (type: JobType) => {
	const [bookings, setBookings] = useState<DriverJob[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	const hasFetchedInitialRef = useRef(false);
	const hadDisconnectRef = useRef(false);
	const refetchedAfterReconnectRef = useRef(false);

	const loadBookings = useCallback(async () => {
		try {
			const data = await getDriverJobs(type);
			setBookings(data);
		} finally {
			setIsLoading(false);
			setRefreshing(false);
			hasFetchedInitialRef.current = true;
		}
	}, [type]);

	const refresh = useCallback(() => {
		setRefreshing(true);
		loadBookings();
	}, [loadBookings]);

	useEffect(() => {
		// Requirement: fetch initial bookings on app launch (screen mount).
		loadBookings();
	}, [loadBookings]);

	useEffect(() => {
		const onAssigned = (payload: BookingAssignedPayload) => {
			const job = normalizeIncomingJob(payload?.booking ?? payload?.job ?? payload, type);
			if (!job) return;
			if (job.type !== type) return;

			setBookings((prev) => {
				const existingIndex = prev.findIndex((j) => j.id === job.id);
				if (existingIndex >= 0) {
					// Merge details but preserve order
					const next = prev.slice();
					next[existingIndex] = { ...next[existingIndex], ...job };
					return next;
				}
				// Insert without refetching whole list
				return [job, ...prev];
			});
		};

		const onStatusUpdated = (payload: BookingStatusUpdatedPayload) => {
			const jobId = extractJobId(payload);
			if (!jobId) return;

			// Payload might include full job or just partial fields.
			const fullMaybe = normalizeIncomingJob(payload?.booking ?? payload?.job ?? payload, type);
			const partial = fullMaybe ? fullMaybe : extractPartialUpdate(payload);

			setBookings((prev) => {
				const idx = prev.findIndex((j) => j.id === jobId);
				if (idx === -1) return prev;

				const updated: DriverJob = { ...prev[idx], ...partial };
				const updatedType: JobType =
					updated.type ?? STATUS_TO_TYPE_FALLBACK(updated.status, updated.scheduledTime);

				// If it no longer belongs in this list, remove it.
				if (updatedType !== type) {
					return prev.filter((j) => j.id !== jobId);
				}

				// Preserve list order and scroll position: replace in-place.
				const next = prev.slice();
				next[idx] = { ...updated, type: updatedType };
				return next;
			});
		};

		const onDisconnect = () => {
			hadDisconnectRef.current = true;
			refetchedAfterReconnectRef.current = false;
		};

		const onConnect = () => {
			// Requirement: on reconnect, rejoin room (handled by socketService) and refetch once if needed.
			if (!hadDisconnectRef.current) return;
			if (!hasFetchedInitialRef.current) return;
			if (refetchedAfterReconnectRef.current) return;

			refetchedAfterReconnectRef.current = true;
			loadBookings();
		};

		socketService.on('BOOKING_ASSIGNED', onAssigned);
		socketService.on('BOOKING_STATUS_UPDATED', onStatusUpdated);
		socketService.on('disconnect', onDisconnect);
		socketService.on('connect', onConnect);

		return () => {
			socketService.off('BOOKING_ASSIGNED', onAssigned);
			socketService.off('BOOKING_STATUS_UPDATED', onStatusUpdated);
			socketService.off('disconnect', onDisconnect);
			socketService.off('connect', onConnect);
		};
	}, [loadBookings, type]);

	return {
		bookings,
		isLoading,
		refreshing,
		refresh,
	};
};
