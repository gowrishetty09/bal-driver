import { apiClient } from './client';

export type FeedbackCategory =
    | 'SERVICE_QUALITY'
    | 'DRIVER_BEHAVIOR'
    | 'VEHICLE_CONDITION'
    | 'APP_EXPERIENCE'
    | 'PRICING'
    | 'BOOKING_PROCESS'
    | 'OTHER';

export type FeedbackPayload = {
    rating: number;
    comment?: string;
    category?: FeedbackCategory;
    bookingId?: string;
    hotelId?: string;
};

export type FeedbackResponse = {
    id: string;
    rating: number;
    comment?: string;
    category?: FeedbackCategory;
    bookingId?: string;
    hotelId?: string;
    createdAt: string;
};

export const submitFeedback = async (payload: FeedbackPayload): Promise<FeedbackResponse> => {
    const response = await apiClient.post<FeedbackResponse>('/driver/feedback', payload);
    return response.data;
};
