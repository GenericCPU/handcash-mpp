/**
 * Optional **single-use** guard for receipt JWT `jti` to reduce replay within a single process.
 * For multiple instances, callers need their own shared deduplication aligned to JWT expiry; this class is in-memory only.
 */
export class MemoryJwtReplayGuard {
    seen = new Map();
    /**
     * @returns `true` if `jti` is fresh; `false` if already seen and still within TTL window.
     */
    tryConsume(jti, ttlMs) {
        const now = Date.now();
        this.#sweep(now);
        if (this.seen.has(jti))
            return false;
        this.seen.set(jti, now + ttlMs);
        return true;
    }
    #sweep(now) {
        for (const [k, exp] of this.seen) {
            if (exp <= now)
                this.seen.delete(k);
        }
    }
}
//# sourceMappingURL=replay-guard.js.map