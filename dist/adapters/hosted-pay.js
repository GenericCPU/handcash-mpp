import { canonicalizeHandCashPaymentRequestUrl } from "./payment-request-url.js";
import { buildCreatePaymentRequestBodyFromCharge } from "../domain/instruments.js";
function isRecord(x) {
    return typeof x === "object" && x !== null;
}
function readString(obj, key) {
    const v = obj[key];
    return typeof v === "string" ? v : undefined;
}
/**
 * HandCash Pay: creates a **payment request** and returns URLs for the 402 `handcash` extension.
 * This acts as the hosted payment redirect URL inside a machine-pay flow.
 * When Cloud still returns **`pay.handcash.io/{id}`**, the checkout URL is rewritten to **`handcash.io/payment-request/{id}?sid=…`**
 * so the payer lands on the current public web checkout.
 */
export async function createHostedPayArtifact(opts) {
    const body = {
        ...buildCreatePaymentRequestBodyFromCharge(opts.charge),
        expirationType: "never",
        ...(opts.requestedUserData ? { requestedUserData: opts.requestedUserData } : {}),
        ...(opts.paymentMethods !== undefined ? { paymentMethods: opts.paymentMethods } : {}),
        ...(opts.redirectUrl ? { redirectUrl: opts.redirectUrl } : {}),
        ...(opts.webhookUrl
            ? {
                notifications: {
                    webhook: { webhookUrl: opts.webhookUrl },
                },
            }
            : {}),
    };
    const { data, error } = await opts.client.post({
        url: "/v3/paymentRequests",
        body,
    });
    if (error) {
        const msg = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
            ? error.message
            : "POST /v3/paymentRequests failed";
        return { data: null, error: { message: msg } };
    }
    if (!isRecord(data)) {
        return { data: null, error: { message: "Unexpected payment request response" } };
    }
    const id = readString(data, "id");
    const paymentRequestUrl = readString(data, "paymentRequestUrl");
    if (!id || !paymentRequestUrl) {
        return { data: null, error: { message: "Missing id or paymentRequestUrl in response" } };
    }
    const qr = readString(data, "paymentRequestQrCodeUrl");
    const canonicalUrl = canonicalizeHandCashPaymentRequestUrl(paymentRequestUrl);
    return {
        data: {
            fulfillment: "hosted_pay",
            paymentRequestId: id,
            paymentRequestUrl: canonicalUrl,
            ...(qr ? { paymentRequestQrCodeUrl: qr } : {}),
        },
        error: null,
    };
}
//# sourceMappingURL=hosted-pay.js.map