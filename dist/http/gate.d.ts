import type { ResourceRef } from "../domain/types.js";
import { type VerifiedReceipt } from "../receipts/jwt.js";
import type { MemoryJwtReplayGuard } from "../receipts/replay-guard.js";
export declare const DEFAULT_RECEIPT_HEADER = "x-handcash-receipt";
/**
 * Reads a bearer or raw JWT from `Authorization: Bearer …` or a custom header.
 */
export declare function readReceiptTokenFromRequest(request: Request, headerName?: string): string | null;
export type MachineGateResult = {
    ok: true;
    receipt: VerifiedReceipt;
} | {
    ok: false;
    reason: "missing_token" | "invalid_token" | "wrong_resource" | "replay";
};
/**
 * Web **`Request`** gate: valid receipt JWT bound to the same **resource** (method + path).
 * Optionally enforce single-use **`jti`** via {@link MemoryJwtReplayGuard}.
 */
export declare function evaluateMachinePaymentGate(request: Request, options: {
    receiptSecret: string;
    resource: ResourceRef;
    receiptHeader?: string;
    replayGuard?: MemoryJwtReplayGuard;
    /** TTL for replay guard entry (should cover request burst window, e.g. 120_000). */
    replayTtlMs?: number;
}): Promise<MachineGateResult>;
/**
 * Convenience: run gate and branch to **`onPaid`** or **`onUnpaid`** handlers.
 */
export declare function runMachinePaidHandler(request: Request, opts: {
    receiptSecret: string;
    resource: ResourceRef;
    receiptHeader?: string;
    replayGuard?: MemoryJwtReplayGuard;
    replayTtlMs?: number;
    onPaid: (request: Request, receipt: VerifiedReceipt) => Promise<Response>;
    onUnpaid: () => Promise<Response>;
}): Promise<Response>;
//# sourceMappingURL=gate.d.ts.map