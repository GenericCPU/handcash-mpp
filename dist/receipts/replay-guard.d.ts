/**
 * Optional **single-use** guard for receipt JWT `jti` to reduce replay within a single process.
 * For multiple instances, callers need their own shared deduplication aligned to JWT expiry; this class is in-memory only.
 */
export declare class MemoryJwtReplayGuard {
    #private;
    private readonly seen;
    /**
     * @returns `true` if `jti` is fresh; `false` if already seen and still within TTL window.
     */
    tryConsume(jti: string, ttlMs: number): boolean;
}
//# sourceMappingURL=replay-guard.d.ts.map