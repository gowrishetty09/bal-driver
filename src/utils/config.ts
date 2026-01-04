import Constants from 'expo-constants';

// Safely access `extra` coming from either `expoConfig` or `manifest`.
// Different Expo runtime types may not expose `extra` on the manifest type,
// so coerce to `any` to avoid TypeScript errors while preserving runtime behavior.
const extra = (((Constants as unknown) as any).expoConfig ?? ((Constants as unknown) as any).manifest)?.extra ?? {};
const env = process.env as Record<string, string | undefined>;

const fromEnv = (key: string, fallback?: string) => {
    const expoKey = `EXPO_PUBLIC_${key}`;
    return env[expoKey] ?? env[key] ?? fallback;
};

export const API_BASE_URL: string =
    process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl ?? 'https://bestaerolimo.online/api';

// WebSocket endpoint (used for realtime driver updates)
export const WS_URL: string =
    process.env.EXPO_PUBLIC_WS_URL ?? extra.wsUrl ?? 'wss://bestaerolimo.online/ws';

export const USE_MOCKS: boolean =
    (process.env.EXPO_PUBLIC_USE_MOCKS ?? '').toLowerCase() === 'true' || Boolean(extra.useMocks);

export const GOOGLE_PLACES_API_KEY: string | undefined =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? extra.googlePlacesApiKey;

// Used by RideMapView to draw turn-by-turn route polylines.
// Falls back to the Places key since many projects use a single restricted key.
export const GOOGLE_DIRECTIONS_API_KEY: string | undefined =
    process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY ?? extra.googleDirectionsApiKey ?? GOOGLE_PLACES_API_KEY;

type SosContacts = {
    police: string;
    medical: string;
    support: string;
    shareTemplate?: string;
};

export const SOS_CONTACTS: SosContacts = {
    police: fromEnv('EMERGENCY_POLICE_NUMBER', extra.sosContacts?.police ?? '112')!,
    medical: fromEnv('EMERGENCY_MEDICAL_NUMBER', extra.sosContacts?.medical ?? '108')!,
    support: fromEnv('SUPPORT_NUMBER', extra.sosContacts?.support ?? '+1800123456')!,
    shareTemplate:
        extra.sosContacts?.shareTemplate ??
        fromEnv('SOS_SHARE_TEMPLATE', 'Emergency! Please track me at https://maps.google.com/?q={lat},{lng}') ??
        'Emergency! Please track me at https://maps.google.com/?q={lat},{lng}',
};

export const SUPPORT_EMAIL = fromEnv('SUPPORT_EMAIL', 'support@cab.local');
