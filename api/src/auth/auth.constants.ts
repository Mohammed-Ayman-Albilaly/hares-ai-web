/** Token lifetimes and issuer (ARCHITECTURE §2, decisions 12 and 30). */
export const JWT_ISSUER = 'hares-api';

/** Web access token: 15 minutes, kept in memory by the SPA. */
export const WEB_ACCESS_TTL_SECONDS = 15 * 60;

/** Extension access token: at most 1 hour (decision 30). */
export const EXTENSION_ACCESS_TTL_SECONDS = 60 * 60;

/** Refresh tokens (web cookie and extension storage): 30 days, rotated on every use. */
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

/** bcrypt cost (decision 32). */
export const BCRYPT_COST = 12;

/** Which client a token belongs to. Also used as the JWT `aud` claim. */
export type ClientKind = 'web' | 'extension';
