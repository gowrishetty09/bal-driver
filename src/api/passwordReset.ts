import { apiClient } from './client';

export type DriverPasswordResetRequestPayload = {
    email: string;
};

export type DriverPasswordResetVerifyPayload = {
    email: string;
    otp: string;
};

export type DriverPasswordResetConfirmPayload = {
    email: string;
    resetToken: string;
    newPassword: string;
};

export type DriverPasswordResetGenericResponse = {
    success: boolean;
    message?: string;
};

export type DriverPasswordResetVerifyResponse = {
    resetToken: string;
    expiresAt: string;
};

export type DriverPasswordResetConfirmResponse = {
    success: boolean;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const requestDriverPasswordReset = async (
    payload: DriverPasswordResetRequestPayload
): Promise<DriverPasswordResetGenericResponse> => {
    const { data } = await apiClient.post<DriverPasswordResetGenericResponse>(
        '/auth/driver/forgot-password/request',
        { email: normalizeEmail(payload.email) }
    );
    return data;
};

export const verifyDriverPasswordOtp = async (
    payload: DriverPasswordResetVerifyPayload
): Promise<DriverPasswordResetVerifyResponse> => {
    const { data } = await apiClient.post<DriverPasswordResetVerifyResponse>(
        '/auth/driver/forgot-password/verify',
        {
            email: normalizeEmail(payload.email),
            otp: payload.otp.trim(),
        }
    );
    return data;
};

export const confirmDriverPasswordReset = async (
    payload: DriverPasswordResetConfirmPayload
): Promise<DriverPasswordResetConfirmResponse> => {
    const { data } = await apiClient.post<DriverPasswordResetConfirmResponse>(
        '/auth/driver/forgot-password/reset',
        {
            email: normalizeEmail(payload.email),
            resetToken: payload.resetToken.trim(),
            newPassword: payload.newPassword,
        }
    );
    return data;
};

// Change password while authenticated
export type ChangePasswordPayload = {
    currentPassword: string;
    newPassword: string;
};

export type ChangePasswordResponse = {
    success: boolean;
    message?: string;
};

export const changeDriverPassword = async (
    payload: ChangePasswordPayload
): Promise<ChangePasswordResponse> => {
    const { data } = await apiClient.post<ChangePasswordResponse>(
        '/auth/driver/change-password',
        payload
    );
    return data;
};
