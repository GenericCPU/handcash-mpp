export class MemoryIdempotencyStore {
    entries = new Map();
    tryReserve(key, ttlMs) {
        const now = Date.now();
        this.#sweep(now);
        if (this.entries.has(key))
            return false;
        this.entries.set(key, now + ttlMs);
        return true;
    }
    #sweep(now) {
        for (const [k, exp] of this.entries) {
            if (exp <= now)
                this.entries.delete(k);
        }
    }
}
//# sourceMappingURL=memory-store.js.map