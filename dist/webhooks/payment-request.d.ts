/**
 * Payload HandCash Cloud posts to your **`notifications.webhook.webhookUrl`**
 * when a payment request completes (see `NotifyPaymentRequestCompletedUseCase`).
 * The body includes **`appSecret`** — verify it matches your app secret (constant-time) before trusting fields.
 *
 * **Payer identity (HandCash Pay):** Cloud may include the payer in **`userData`** / **`customParameters`**
 * (often `handle`, `alias`, `paymail`), as a nested **`payer`** object (`{ handle, displayName }` per product docs),
 * inside **`metadata`**, and/or at the **top level** under names like **`paidBy`**, **`userHandle`**,
 * **`handle`**, or snake_case variants. Treat as untrusted strings until you verify **`appSecret`**; only use
 * after `verifyPaymentRequestCompletedWebhook` succeeds.
 */
export type PaymentRequestCompletedWebhookBody = {
    appSecret: string;
    paymentRequestId: string;
    paymentMethod: string;
    transactionId: string;
    customParameters?: Record<string, unknown>;
    userData?: Record<string, unknown>;
    /** When Cloud mirrors HandCash Pay webhook docs: payer handle / display name. */
    payer?: string | {
        handle?: string;
        displayName?: string;
        paymail?: string;
        alias?: string;
    };
    metadata?: Record<string, unknown>;
    /** Payer handle or paymail when Cloud sends it at top level (optional). */
    paidBy?: string;
    handle?: string;
    userHandle?: string;
};
/**
 * Validates shape and **`appSecret`** (timing-safe). Does **not** parse signature headers —
 * HandCash payment-request completion webhooks authenticate via **body `appSecret`**, not `handcash-signature`.
 */
export declare function verifyPaymentRequestCompletedWebhook(expectedAppSecret: string, body: unknown): body is PaymentRequestCompletedWebhookBody;
//# sourceMappingURL=payment-request.d.ts.map