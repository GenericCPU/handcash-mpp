import { verifyReceiptJwt } from "../receipts/jwt.js";
export const DEFAULT_RECEIPT_HEADER = "x-handcash-receipt";
/**
 * Reads a bearer or raw JWT from `Authorization: Bearer …` or a custom header.
 */
export function readReceiptTokenFromRequest(request, headerName = DEFAULT_RECEIPT_HEADER) {
    const auth = request.headers.get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) {
        const t = auth.slice(7).trim();
        return t || null;
    }
    const h = request.headers.get(headerName)?.trim();
    return h || null;
}
function resourceMatches(receipt, resource) {
    return receipt.resourceMethod.toUpperCase() === resource.method.toUpperCase() && receipt.resourcePath === resource.path;
}
/**
 * Web **`Request`** gate: valid receipt JWT bound to the same **resource** (method + path).
 * Optionally enforce single-use **`jti`** via {@link MemoryJwtReplayGuard}.
 */
export async function evaluateMachinePaymentGate(request, options) {
    const raw = readReceiptTokenFromRequest(request, options.receiptHeader ?? DEFAULT_RECEIPT_HEADER);
    if (!raw)
        return { ok: false, reason: "missing_token" };
    const receipt = await verifyReceiptJwt(options.receiptSecret, raw);
    if (!receipt)
        return { ok: false, reason: "invalid_token" };
    if (!resourceMatches(receipt, options.resource)) {
        return { ok: false, reason: "wrong_resource" };
    }
    if (options.replayGuard) {
        const ttl = options.replayTtlMs ?? 120_000;
        if (!options.replayGuard.tryConsume(receipt.jti, ttl)) {
            return { ok: false, reason: "replay" };
        }
    }
    return { ok: true, receipt };
}
/**
 * Convenience: run gate and branch to **`onPaid`** or **`onUnpaid`** handlers.
 */
export async function runMachinePaidHandler(request, opts) {
    const gate = await evaluateMachinePaymentGate(request, {
        receiptSecret: opts.receiptSecret,
        resource: opts.resource,
        receiptHeader: opts.receiptHeader,
        replayGuard: opts.replayGuard,
        replayTtlMs: opts.replayTtlMs,
    });
    if (gate.ok)
        return opts.onPaid(request, gate.receipt);
    return opts.onUnpaid();
}
//# sourceMappingURL=gate.js.map