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

const BOOKING_DISPLAY_PREFIX = 'BAL';

const getBookingSourceCode = (source?: string | null): string => {
    const value = String(source ?? '').trim().toUpperCase();
    if (!value) return 'UK';
    if (value === 'HOTEL_PORTAL') return 'HT';
    if (value === 'KIOSK' || value === 'KIOSK_PORTAL') return 'KI';
    if (value === 'CUSTOMER_APP') return 'CU';
    if (value === 'DRIVER_APP') return 'DR';
    if (value === 'ADMIN_CONSOLE') return 'AD';
    return 'UK';
};

export const formatBookingRef = (
    idOrRef?: string | null,
    source?: string | null,
    options?: { includeHash?: boolean; defaultSource?: string | null }
): string => {
    const includeHash = options?.includeHash ?? true;
    const effectiveSource = source ?? options?.defaultSource ?? null;
    const empty = '—';
    if (!idOrRef) return empty;

    const raw = String(idOrRef).trim().replace(/^#/, '');
    if (!raw) return empty;

    if (/^bal[a-z0-9]{2,3}[a-z0-9]{4}$/i.test(raw)) {
        const prefix = BOOKING_DISPLAY_PREFIX;
        let code = raw.slice(3, raw.length - 4).toUpperCase();
        if (code === 'CEO') code = 'CU';
        const suffix = raw.slice(-4);
        const already = `${prefix}${code}${suffix}`;
        return includeHash ? `#${already}` : already;
    }

    const suffix = raw.slice(-4);
    const sourceCode = getBookingSourceCode(effectiveSource);
    const formatted = `${BOOKING_DISPLAY_PREFIX}${sourceCode}${suffix}`;
    return includeHash ? `#${formatted}` : formatted;
};

export default {
    formatMYR,
    shortBookingRef,
    bookingRefFull,
    formatBookingRef,
};
