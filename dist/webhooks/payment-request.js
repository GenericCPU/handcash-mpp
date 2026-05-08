import { timingSafeEqual } from "node:crypto";
function buffersEqual(a, b) {
    const x = Buffer.from(a, "utf8");
    const y = Buffer.from(b, "utf8");
    if (x.length !== y.length)
        return false;
    return timingSafeEqual(x, y);
}
/**
 * Validates shape and **`appSecret`** (timing-safe). Does **not** parse signature headers —
 * HandCash payment-request completion webhooks authenticate via **body `appSecret`**, not `handcash-signature`.
 */
export function verifyPaymentRequestCompletedWebhook(expectedAppSecret, body) {
    if (!body || typeof body !== "object")
        return false;
    const o = body;
    if (typeof o.appSecret !== "string")
        return false;
    if (typeof o.paymentRequestId !== "string")
        return false;
    if (typeof o.transactionId !== "string")
        return false;
    if (typeof o.paymentMethod !== "string")
        return false;
    return buffersEqual(expectedAppSecret, o.appSecret);
}
//# sourceMappingURL=payment-request.js.map