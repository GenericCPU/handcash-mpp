import { timingSafeEqual } from "node:crypto";

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

function buffersEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * Validates shape and **`appSecret`** (timing-safe). Does **not** parse signature headers —
 * HandCash payment-request completion webhooks authenticate via **body `appSecret`**, not `handcash-signature`.
 */
export function verifyPaymentRequestCompletedWebhook(
  expectedAppSecret: string,
  body: unknown,
): body is PaymentRequestCompletedWebhookBody {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  if (typeof o.appSecret !== "string") return false;
  if (typeof o.paymentRequestId !== "string") return false;
  if (typeof o.transactionId !== "string") return false;
  if (typeof o.paymentMethod !== "string") return false;
  return buffersEqual(expectedAppSecret, o.appSecret);
}
