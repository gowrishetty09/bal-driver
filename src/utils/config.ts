import Constants from 'expo-constants';

const extra = (Constants.expoConfig ?? Constants.manifest)?.extra ?? {};
const env = process.env as Record<string, string | undefined>;

const fromEnv = (key: string, fallback?: string) => {
    const expoKey = `EXPO_PUBLIC_${key}`;
    return env[expoKey] ?? env[key] ?? fallback;
};

export const API_BASE_URL: string =
    process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl ?? 'http://192.168.0.144:3000';

export const USE_MOCKS: boolean =
    (process.env.EXPO_PUBLIC_USE_MOCKS ?? '').toLowerCase() === 'true' || Boolean(extra.useMocks);

export const GOOGLE_PLACES_API_KEY: string | undefined =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? extra.googlePlacesApiKey;

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
