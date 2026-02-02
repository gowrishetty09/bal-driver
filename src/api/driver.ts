import axios from 'axios';

import { apiClient } from './client';
import { API_BASE_URL, USE_MOCKS } from '../utils/config';
import { SessionTokens, TokenResponse, deriveSessionTokens } from '../types/auth';

export type JobType = 'ACTIVE' | 'UPCOMING' | 'HISTORY';
export type JobStatus = 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type DriverUser = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    licenseNumber?: string;
    role?: string;
    roles?: string[];
    vehicleNumber?: string;
    status?: 'ACTIVE' | 'INACTIVE' | string;
    paymentAmount?: number | null;
    finalPrice?: number | null;
    latitude?: number;
    longitude?: number;
    lastLocation?: {
        latitude: number;
        longitude: number;
        updatedAt: string;
    };
    homeBaseLocation?: {
        address: string;
        latitude: number;
        longitude: number;
        placeId?: string;
        updatedAt?: string;
    };
    updatedAt?: string;
};

export type LocationPoint = {
    latitude?: number;
    longitude?: number;
    addressLine?: string;
    landmark?: string;
};

export type Coordinates = {
    lat: number;
    lng: number;
};

export type DriverJob = {
    id: string;
    reference: string;
    status: JobStatus;
    type: JobType;
    rideType?: string;
    source?: string;
    vehicleNumber?: string;
    pickup?: LocationPoint | null;
    dropoff?: LocationPoint | null;
    pickupCoords?: Coordinates | null;
    dropCoords?: Coordinates | null;
    paymentAmount: number | null;
    finalPrice?: number | null;
    paymentMethod?: string;
    paymentStatus?: string;
    passengerName: string;
    passengerPhone: string;
    passengerEmail?: string;
    scheduledTime: string;
    notes?: string;
    flightNo?: string | null;
    flightEta?: string | null;
};

export type DriverJobDetail = DriverJob & {
    vehiclePlate?: string;
    distanceKm?: number;
    durationMinutes?: number;
    timeline: Array<{
        status: JobStatus;
        timestamp: string;
    }>;
};

export type LoginPayload = {
    email: string;
    password: string;
};

export type LoginResponse = TokenResponse & {
    user: DriverUser;
};

export type LocationPayload = {
    latitude: number;
    longitude: number;
};

export type AuthenticatedDriverPayload = {
    tokens: SessionTokens;
    user: DriverUser;
};

const authHttp = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
});

const shouldUseMocks = () => USE_MOCKS;

type ErrorResponse = {
    message?: string;
    error?: string;
    statusCode?: number;
};

export const loginDriver = async (payload: LoginPayload): Promise<AuthenticatedDriverPayload> => {
    try {
        const { data } = await authHttp.post<LoginResponse | ErrorResponse>('/auth/login', payload);

        // Check if response is an error (backend returns 201 even for errors)
        const errorData = data as ErrorResponse;
        if (errorData.message && !('accessToken' in data)) {
            throw new Error(errorData.message);
        }

        const loginData = data as LoginResponse;
        if (!loginData.accessToken || !loginData.user) {
            throw new Error('Invalid login response');
        }

        const tokens = deriveSessionTokens(loginData, Date.now());
        return { tokens, user: loginData.user };
    } catch (error) {
        if (shouldUseMocks()) {
            return mockLogin(payload);
        }
        throw error;
    }
};

export const refreshDriverSession = async (refreshToken: string): Promise<SessionTokens> => {
    try {
        const { data } = await authHttp.post<TokenResponse>('/auth/refresh', { refreshToken });
        return deriveSessionTokens(data, Date.now());
    } catch (error) {
        if (shouldUseMocks()) {
            return mockTokens();
        }
        throw error;
    }
};

export const logoutDriver = async (refreshToken: string): Promise<void> => {
    try {
        await authHttp.post('/auth/logout', { refreshToken });
    } catch (error) {
        if (!shouldUseMocks()) {
            throw error;
        }
    }
};

export const getDriverJobs = async (type: JobType): Promise<DriverJob[]> => {
    try {
        const { data } = await apiClient.get<BackendJob[]>(`/driver/jobs`, { params: { type } });
        return data.map((j) => mapBackendJobToDriverJob(j, type));
    } catch (error) {
        if (shouldUseMocks()) {
            return mockJobs.filter((job) => job.type === type);
        }
        throw error;
    }
};

export const getDriverJobDetails = async (jobId: string): Promise<DriverJobDetail> => {
    try {
        const { data } = await apiClient.get<BackendJob>(`/driver/jobs/${jobId}`);
        return mapBackendJobToDriverJobDetail(data);
    } catch (error) {
        if (shouldUseMocks()) {
            return mockJobDetails(jobId);
        }
        throw error;
    }
};

export const updateDriverJobStatus = async (
    jobId: string,
    status: JobStatus,
    reason?: string,
    otp?: string
): Promise<DriverJobDetail> => {
    try {
        const payload: Record<string, unknown> = { status };
        if (reason) payload.reason = reason;
        if (otp) payload.otp = otp;
        const { data } = await apiClient.patch<DriverJobDetail>(`/driver/jobs/${jobId}/status`, payload);
        return data;
    } catch (error) {
        if (shouldUseMocks()) {
            return mockJobDetails(jobId, status);
        }
        throw error;
    }
};

export type PickupCodeVerificationError = 'INVALID_CODE' | 'CODE_LOCKED';

export type VerifyPickupCodeResult =
    | { ok: true }
    | { ok: false; error: PickupCodeVerificationError; message?: string };

const extractPickupCodeVerificationError = (data: unknown): PickupCodeVerificationError | null => {
    if (!data || typeof data !== 'object') return null;
    const anyData = data as any;
    const code = anyData.code ?? anyData.error ?? anyData.status;
    if (code === 'INVALID_CODE' || code === 'CODE_LOCKED') return code;
    return null;
};

/**
 * Verify pickup code before starting ride.
 *
 * Backend variants supported:
 * - POST /bookings/:id/verify-pickup-code  { code }
 * - POST /driver/jobs/:id/accept          { code }
 */
export const verifyPickupCode = async (bookingId: string, code: string): Promise<VerifyPickupCodeResult> => {
    const payload = { code };

    const postVerify = async (path: string) => {
        await apiClient.post(path, payload);
    };

    try {
        await postVerify(`/bookings/${bookingId}/verify-pickup-code`);
        return { ok: true };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const data = error.response?.data;
            const extracted = extractPickupCodeVerificationError(data);
            if (extracted) {
                return { ok: false, error: extracted, message: (data as any)?.message };
            }

            // If endpoint doesn't exist on this backend, fall back to the legacy accept route.
            // This is NOT a retry for invalid codes; it only handles backend route differences.
            if (status === 404 || status === 405) {
                try {
                    await postVerify(`/driver/jobs/${bookingId}/accept`);
                    return { ok: true };
                } catch (fallbackError) {
                    if (axios.isAxiosError(fallbackError)) {
                        const fallbackData = fallbackError.response?.data;
                        const fallbackExtracted = extractPickupCodeVerificationError(fallbackData);
                        if (fallbackExtracted) {
                            return {
                                ok: false,
                                error: fallbackExtracted,
                                message: (fallbackData as any)?.message,
                            };
                        }
                    }
                    throw fallbackError;
                }
            }
        }

        throw error;
    }
};

/**
 * Notify backend when driver arrives at pickup location
 * This triggers notifications to admin and customer
 */
export const notifyDriverArrival = async (
    jobId: string,
    type: 'arrived' | 'at_pickup' | 'en_route' | 'picked_up',
    coordinates?: { latitude: number; longitude: number }
): Promise<void> => {
    try {
        await apiClient.post(`/driver/jobs/${jobId}/notify`, {
            type,
            coordinates,
        });
    } catch (error) {
        if (!shouldUseMocks()) {
            console.warn('Failed to send arrival notification:', error);
        }
    }
};

export const sendLocation = async (coords: LocationPayload): Promise<void> => {
    try {
        await apiClient.post('/driver/location', coords);
    } catch (error) {
        if (!shouldUseMocks()) {
            throw error;
        }
    }
};

// Backend types and mappers
type BackendJob = {
    id: string;
    pickupTime?: string;
    status: JobStatus;
    rideType?: string;
    source?: string | null;
    pickupLocation?: string | null;
    dropLocation?: string | null;
    pickupCoords?: { lat: number; lng: number } | null;
    dropCoords?: { lat: number; lng: number } | null;
    flightNo?: string | null;
    flightEta?: string | null;
    paymentStatus?: string;
    paymentMethod?: string;
    paymentAmount?: number;
    finalPrice?: number | null;
    guestName?: string | null;
    guestPhone?: string | null;
    hotelName?: string | null;
    hotelContact?: string | null;
    vehicle?: { id: string; registrationNo?: string | null } | null;
    ref?: string | null;
};

const mapBackendJobToDriverJob = (j: BackendJob, listType: JobType): DriverJob => ({
    id: j.id,
    reference: j.ref ?? j.vehicle?.registrationNo ?? j.id,
    status: j.status,
    type: listType,
    rideType: j.rideType ?? undefined,
    source: j.source ?? undefined,
    pickup: j.pickupLocation && j.pickupLocation.trim() !== ''
        ? { addressLine: j.pickupLocation }
        : undefined,
    dropoff: j.dropLocation && j.dropLocation.trim() !== ''
        ? { addressLine: j.dropLocation }
        : undefined,
    pickupCoords: resolveCoords(j.pickupCoords, (j as any).pickup) ?? resolveCoordsFromFields(j, 'pickup') ?? undefined,
    dropCoords: resolveCoords(j.dropCoords, (j as any).dropoff) ?? resolveCoordsFromFields(j, 'drop') ?? undefined,
    passengerName: j.guestName && j.guestName.trim() !== '' ? j.guestName : 'Customer',
    passengerPhone: j.guestPhone && j.guestPhone.trim() !== '' ? j.guestPhone : '',
    // Prefer server-provided finalPrice if available, otherwise fall back to paymentAmount
    paymentAmount: (j.finalPrice ?? j.paymentAmount) ?? null,
    finalPrice: j.finalPrice ?? null,
    vehicleNumber: j.vehicle?.registrationNo ?? undefined,
    paymentMethod: j.paymentMethod ?? undefined,
    paymentStatus: j.paymentStatus ?? undefined,
    scheduledTime: j.pickupTime ?? new Date().toISOString(),
    notes: undefined,
    flightNo: j.flightNo ?? null,
    flightEta: j.flightEta ?? null,
});

const mapBackendJobToDriverJobDetail = (j: BackendJob): DriverJobDetail => ({
    ...mapBackendJobToDriverJob(j, 'ACTIVE'),
    vehiclePlate: j.vehicle?.registrationNo ?? undefined,
    distanceKm: undefined,
    durationMinutes: undefined,
    timeline: [
        { status: 'ASSIGNED', timestamp: j.pickupTime ?? new Date().toISOString() },
    ],
});

// Helpers to resolve coordinate shapes from different backend payload variations
const resolveCoords = (coords: any, fallback?: any): { lat: number; lng: number } | undefined => {
    if (!coords && !fallback) return undefined;
    const c = coords ?? fallback;
    if (!c) return undefined;
    // Accept { lat, lng }
    if (typeof c.lat === 'number' && typeof c.lng === 'number') return { lat: c.lat, lng: c.lng };
    // Accept { latitude, longitude }
    if (typeof c.latitude === 'number' && typeof c.longitude === 'number') return { lat: c.latitude, lng: c.longitude };
    // Accept { lat: string, lng: string }
    const maybeLat = Number(c.lat ?? c.latitude ?? c.latValue ?? c.latitudeValue);
    const maybeLng = Number(c.lng ?? c.longitude ?? c.lngValue ?? c.longitudeValue);
    if (!Number.isNaN(maybeLat) && !Number.isNaN(maybeLng)) return { lat: maybeLat, lng: maybeLng };
    return undefined;
};

const resolveCoordsFromFields = (j: any, prefix: 'pickup' | 'drop') => {
    // check fields like pickupLat/pickupLng, pickupLatitude/pickupLongitude
    const latKeys = [`${prefix}Lat`, `${prefix}Latitude`, `${prefix}_lat`, `${prefix}_latitude`];
    const lngKeys = [`${prefix}Lng`, `${prefix}Longitude`, `${prefix}_lng`, `${prefix}_longitude`];
    for (const lk of latKeys) {
        for (const rk of lngKeys) {
            const lat = j[lk];
            const lng = j[rk];
            if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
            const nlat = Number(lat);
            const nlng = Number(lng);
            if (!Number.isNaN(nlat) && !Number.isNaN(nlng)) return { lat: nlat, lng: nlng };
        }
    }
    return undefined;
};

// Mock helpers
const mockUser: DriverUser = {
    id: 'DRV-001',
    name: 'Demo Driver',
    email: 'driver@example.com',
    phone: '+911234567890',
    role: 'DRIVER',
    vehicleNumber: 'KA-01-AB-1234',
    status: 'ACTIVE',
    lastLocation: {
        latitude: 12.9716,
        longitude: 77.5946,
        updatedAt: new Date().toISOString(),
    },
    homeBaseLocation: {
        address: 'LIM HQ, Bengaluru',
        latitude: 12.9716,
        longitude: 77.5946,
        updatedAt: new Date().toISOString(),
    },
};

const mockJobs: DriverJob[] = [

];

const mockTimeline = (currentStatus: JobStatus) => {
    const statuses: JobStatus[] = ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKED_UP', 'COMPLETED'];
    const statusIndex = statuses.findIndex((status) => status === currentStatus);
    const timelineStatuses = statusIndex === -1 ? statuses : statuses.slice(0, statusIndex + 1);

    return timelineStatuses.map((status, index) => ({
        status,
        timestamp: new Date(Date.now() - (timelineStatuses.length - index) * 15 * 60 * 1000).toISOString(),
    }));
};

const mockJobDetails = (jobId: string, overrideStatus?: JobStatus): DriverJobDetail => {
    const job = mockJobs.find((item) => item.id === jobId) ?? mockJobs[0];
    const status = overrideStatus ?? job.status;

    return {
        ...job,
        status,
        timeline: mockTimeline(status),
        vehiclePlate: 'KA-01-AB-1234',
        distanceKm: 35,
        durationMinutes: 65,
    };
};

const mockTokens = (): SessionTokens => ({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
});

const mockLogin = (_payload: LoginPayload): AuthenticatedDriverPayload => ({
    tokens: mockTokens(),
    user: mockUser,
});

/**
 * Device token registration payload for push notifications
 */
export type RegisterDeviceTokenPayload = {
    token: string;
    platform: 'ANDROID' | 'IOS';
};

export type RegisterDeviceTokenResponse = {
    success: boolean;
    message?: string;
};

/**
 * Register device FCM token with the backend
 * This allows the server to send push notifications to this device
 */
export const registerDeviceToken = async (payload: RegisterDeviceTokenPayload): Promise<RegisterDeviceTokenResponse> => {
    const payloadBody = payload;
    try {
        const baseURL = API_BASE_URL;
        console.log('Registering device token to:', `${baseURL}/notifications/register-device`);
        const response = await apiClient.post<RegisterDeviceTokenResponse>('/notifications/register-device', payloadBody);
        console.log('Device token register response:', response.data);
        return response.data;
    } catch (error) {
        if (shouldUseMocks()) {
            return { success: true, message: 'Device token registered (mock)' };
        }
        if (axios.isAxiosError(error)) {
            const baseURL = error.config?.baseURL ?? API_BASE_URL;
            const url = error.config?.url ?? '/notifications/register-device';
            const method = String(error.config?.method ?? 'post').toUpperCase();
            console.error('Failed to register device token (axios):', {
                method,
                url: `${baseURL ?? ''}${url}`,
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
            });
        } else {
            console.error('Failed to register device token:', error);
        }
        throw error;
    }
};

/**
 * Update driver profile payload
 */
export type UpdateDriverProfilePayload = {
    name?: string;
    email?: string;
    phone?: string;
    licenseNumber?: string;
};

/**
 * Update the authenticated driver's profile
 */
export const updateDriverProfile = async (driverId: string, payload: UpdateDriverProfilePayload): Promise<DriverUser> => {
    try {
        const response = await apiClient.patch<DriverUser>(`/drivers/${driverId}`, payload);
        return response.data;
    } catch (error) {
        if (shouldUseMocks()) {
            return { ...mockUser, ...payload };
        }
        if (axios.isAxiosError(error)) {
            console.error('Failed to update driver profile:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
            });
        } else {
            console.error('Failed to update driver profile:', error);
        }
        throw error;
    }
};