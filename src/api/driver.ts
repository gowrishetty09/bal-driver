import axios from 'axios';

import { apiClient } from './client';
import { API_BASE_URL, USE_MOCKS } from '../utils/config';
import { SessionTokens, TokenResponse, deriveSessionTokens } from '../types/auth';

export type JobType = 'ACTIVE' | 'UPCOMING' | 'HISTORY';
export type JobStatus = 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED';

export type DriverUser = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    role?: string;
    roles?: string[];
    vehicleNumber?: string;
    status?: 'ACTIVE' | 'INACTIVE' | string;
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
};

export type LocationPoint = {
    latitude?: number;
    longitude?: number;
    addressLine?: string;
    landmark?: string;
};

export type DriverJob = {
    id: string;
    reference: string;
    status: JobStatus;
    type: JobType;
    pickup?: LocationPoint | null;
    dropoff?: LocationPoint | null;
    paymentAmount: number;
    paymentMethod?: string;
    paymentStatus?: string;
    passengerName: string;
    passengerPhone: string;
    scheduledTime: string;
    notes?: string;
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

export const loginDriver = async (payload: LoginPayload): Promise<AuthenticatedDriverPayload> => {
    try {
        const { data } = await authHttp.post<LoginResponse>('/auth/login', payload);
        const tokens = deriveSessionTokens(data, Date.now());
        return { tokens, user: data.user };
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
    reason?: string
): Promise<DriverJobDetail> => {
    try {
        const payload = reason ? { status, reason } : { status };
        const { data } = await apiClient.patch<DriverJobDetail>(`/driver/jobs/${jobId}/status`, payload);
        return data;
    } catch (error) {
        if (shouldUseMocks()) {
            return mockJobDetails(jobId, status);
        }
        throw error;
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
    pickupLocation?: string | null;
    dropLocation?: string | null;
    paymentStatus?: string;
    paymentMethod?: string;
    paymentAmount?: number;
    guestName?: string | null;
    guestPhone?: string | null;
    hotelName?: string | null;
    hotelContact?: string | null;
    vehicle?: { id: string; registrationNo?: string | null } | null;
};

const mapBackendJobToDriverJob = (j: BackendJob, listType: JobType): DriverJob => ({
    id: j.id,
    reference: j.vehicle?.registrationNo ?? j.id,
    status: j.status,
    type: listType,
    pickup: j.pickupLocation ? { addressLine: j.pickupLocation } : undefined,
    dropoff: j.dropLocation ? { addressLine: j.dropLocation } : undefined,
    passengerName: j.guestName ?? '—',
    passengerPhone: j.guestPhone ?? '—',
    paymentAmount: j.paymentAmount ?? 0, // will render as '—' where applicable
    paymentMethod: j.paymentMethod ?? undefined,
    paymentStatus: j.paymentStatus ?? undefined,
    scheduledTime: j.pickupTime ?? new Date().toISOString(),
    notes: undefined,
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