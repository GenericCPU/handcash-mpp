import { verifyReceiptJwt } from "../receipts/jwt.js";
export const DEFAULT_RECEIPT_HEADER = "x-handcash-receipt";
/**
 * Reads a machine-pay receipt candidate: prefers the explicit receipt header so the same request can use
 * `Authorization: Bearer …` for another credential (e.g. HandCash Connect) without colliding with receipt detection.
 * Does not verify the token — callers that need disambiguation should use {@link evaluateMachinePaymentGate}.
 */
export function readReceiptTokenFromRequest(request, headerName = DEFAULT_RECEIPT_HEADER) {
    const h = request.headers.get(headerName)?.trim();
    if (h)
        return h;
    const auth = request.headers.get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) {
        const t = auth.slice(7).trim();
        return t || null;
    }
    return null;
}
function resourceMatches(receipt, resource) {
    return receipt.resourceMethod.toUpperCase() === resource.method.toUpperCase() && receipt.resourcePath === resource.path;
}
/**
 * Web **`Request`** gate: valid receipt JWT bound to the same **resource** (method + path).
 * Optionally enforce single-use **`jti`** via {@link MemoryJwtReplayGuard}.
 */
export async function evaluateMachinePaymentGate(request, options) {
    const headerName = options.receiptHeader ?? DEFAULT_RECEIPT_HEADER;
    const fromReceiptHeader = request.headers.get(headerName)?.trim() || "";
    let receipt = null;
    if (fromReceiptHeader) {
        receipt = await verifyReceiptJwt(options.receiptSecret, fromReceiptHeader);
        if (!receipt)
            return { ok: false, reason: "invalid_token" };
    }
    else {
        const auth = request.headers.get("authorization");
        if (auth?.toLowerCase().startsWith("bearer ")) {
            const t = auth.slice(7).trim();
            if (t)
                receipt = await verifyReceiptJwt(options.receiptSecret, t);
        }
        if (!receipt)
            return { ok: false, reason: "missing_token" };
    }
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