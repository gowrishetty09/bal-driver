export type SessionTokens = {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
};

export type TokenResponse = {
    accessToken: string;
    refreshToken: string;
    expiresIn?: number;
    refreshExpiresIn?: number;
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
    tokenType?: string;
};

const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export const deriveSessionTokens = (
    payload: TokenResponse,
    issuedAtMs: number = Date.now()
): SessionTokens => {
    const accessExpiresAt =
        payload.accessTokenExpiresAt ??
        new Date(issuedAtMs + 1000 * (payload.expiresIn ?? DEFAULT_ACCESS_TTL_SECONDS)).toISOString();
    const refreshExpiresAt =
        payload.refreshTokenExpiresAt ??
        new Date(issuedAtMs + 1000 * (payload.refreshExpiresIn ?? DEFAULT_REFRESH_TTL_SECONDS)).toISOString();

    return {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        accessTokenExpiresAt: accessExpiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
    };
};

export const isTokenExpired = (expiryIso: string | null | undefined, skewMs = 30_000): boolean => {
    if (!expiryIso) {
        return true;
    }

    const expiresAt = new Date(expiryIso).getTime();
    if (Number.isNaN(expiresAt)) {
        return true;
    }

    return Date.now() >= expiresAt - skewMs;
};
