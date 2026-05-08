import { randomBytes } from "node:crypto";
const LEGACY_PAY_HOST = "pay.handcash.io";
const CHECKOUT_HOST = "handcash.io";
/** Typical HandCash payment-request template id (Mongo ObjectId hex). */
const TEMPLATE_ID_RE = /^[a-f0-9]{24}$/i;
function randomSid(length) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++)
        out += alphabet[bytes[i] % alphabet.length];
    return out;
}
/**
 * Rewrites legacy **`https://pay.handcash.io/{id}`** checkout links to
 * **`https://handcash.io/payment-request/{id}?sid=…`**, which is what the public web app expects.
 * Preserves **`referenceId`** as **`sid`** when present; otherwise mints a short random **`sid`**.
 * Copies **`domain`** when present (non-production app domains).
 * If Cloud already returns **`handcash.io`**, the URL is returned unchanged.
 */
export function canonicalizeHandCashPaymentRequestUrl(paymentRequestUrl) {
    let u;
    try {
        u = new URL(paymentRequestUrl);
    }
    catch {
        return paymentRequestUrl;
    }
    if (u.hostname !== LEGACY_PAY_HOST)
        return paymentRequestUrl;
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length !== 1)
        return paymentRequestUrl;
    const id = segments[0];
    if (!TEMPLATE_ID_RE.test(id))
        return paymentRequestUrl;
    const sid = u.searchParams.get("referenceId") || randomSid(8);
    const next = new URL(`https://${CHECKOUT_HOST}/payment-request/${id}`);
    next.searchParams.set("sid", sid);
    const domain = u.searchParams.get("domain");
    if (domain)
        next.searchParams.set("domain", domain);
    return next.toString();
}
//# sourceMappingURL=payment-request-url.js.map