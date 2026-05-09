/** Default minimum length for {@link assertMinMppSecretLength} (HS256 / HMAC key material). */
export declare const DEFAULT_MIN_MPP_SECRET_LENGTH = 32;
/**
 * Throws if `secret` is missing or shorter than `minLength`.
 * Call once at process startup for `MPP_RECEIPT_SECRET`, `MPP_SERVER_SECRET`, and similar.
 * Does **not** guarantee entropy—still use a CSPRNG (e.g. `openssl rand -base64 32`).
 */
export declare function assertMinMppSecretLength(name: string, secret: string, minLength?: number): void;
//# sourceMappingURL=secrets.d.ts.map