/**
 * Deduplicate dangerous retries (e.g. second **Connect.pay** with same merchant key).
 */
export interface IdempotencyStore {
  /**
   * Reserve `key` for `ttlMs`. Returns **`true`** if newly reserved, **`false`** if already present.
   */
  tryReserve(key: string, ttlMs: number): boolean;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, number>();

  tryReserve(key: string, ttlMs: number): boolean {
    const now = Date.now();
    this.#sweep(now);
    if (this.entries.has(key)) return false;
    this.entries.set(key, now + ttlMs);
    return true;
  }

  #sweep(now: number): void {
    for (const [k, exp] of this.entries) {
      if (exp <= now) this.entries.delete(k);
    }
  }
}
