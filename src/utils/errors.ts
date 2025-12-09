import axios from 'axios';

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.') => {
    if (axios.isAxiosError(error)) {
        const responseMessage =
            (typeof error.response?.data === 'string' && error.response.data) ||
            (error.response?.data as { message?: string })?.message;
        return responseMessage ?? error.message ?? fallback;
    }

    if (error instanceof Error) {
        return error.message || fallback;
    }

    return fallback;
};
