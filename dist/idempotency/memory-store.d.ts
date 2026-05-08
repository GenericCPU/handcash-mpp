/**
 * Deduplicate dangerous retries (e.g. second **Connect.pay** with same merchant key).
 */
export interface IdempotencyStore {
    /**
     * Reserve `key` for `ttlMs`. Returns **`true`** if newly reserved, **`false`** if already present.
     */
    tryReserve(key: string, ttlMs: number): boolean;
}
export declare class MemoryIdempotencyStore implements IdempotencyStore {
    #private;
    private readonly entries;
    tryReserve(key: string, ttlMs: number): boolean;
}
//# sourceMappingURL=memory-store.d.ts.map