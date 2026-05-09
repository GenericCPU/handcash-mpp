/**
 * Payload HandCash Cloud posts to your **`notifications.webhook.webhookUrl`**
 * when a payment request completes (see `NotifyPaymentRequestCompletedUseCase`).
 * The body includes **`appSecret`** — verify it matches your app secret (constant-time) before trusting fields.
 */
export type PaymentRequestCompletedWebhookBody = {
    appSecret: string;
    paymentRequestId: string;
    paymentMethod: string;
    transactionId: string;
    customParameters?: Record<string, unknown>;
    userData?: Record<string, unknown>;
};
/**
 * Validates shape and **`appSecret`** (timing-safe). Does **not** parse signature headers —
 * HandCash payment-request completion webhooks authenticate via **body `appSecret`**, not `handcash-signature`.
 */
export declare function verifyPaymentRequestCompletedWebhook(expectedAppSecret: string, body: unknown): body is PaymentRequestCompletedWebhookBody;
//# sourceMappingURL=payment-request.d.ts.map