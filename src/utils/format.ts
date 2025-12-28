export const formatMYR = (value?: number | null, minimumFractionDigits = 0): string => {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
    try {
        // Prefer Intl when available
        // Use en-MY locale and MYR currency
        // If Intl is not available in runtime, fallback to simple formatting
        // Show no fraction digits by default (amounts often whole numbers)
        const nf = new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'RM',
            minimumFractionDigits,
            maximumFractionDigits: minimumFractionDigits,
        });
        return nf.format(Number(value));
    } catch (e) {
        const val = Number(value);
        return `RM${val.toFixed(minimumFractionDigits)}`;
    }
};

export const shortBookingRef = (id?: string | null): string => {
    if (!id) return '—';
    return `#${id.slice(-8).toUpperCase()}`;
};

export const bookingRefFull = (ref?: string | null): string => {
    if (!ref) return '—';
    return String(ref).toUpperCase();
};

export default {
    formatMYR,
    shortBookingRef,
    bookingRefFull,
};
