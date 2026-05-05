import type { FulfillmentKind } from "../domain/lifecycle.js";

const PAYMENT_REQUIRED_TYPE = "https://paymentauth.org/problems/payment-required";

export type PaymentRequiredBody = {
  type: typeof PAYMENT_REQUIRED_TYPE;
  title: string;
  status: 402;
  detail: string;
  challengeId: string;
  handcash?: {
    fulfillment: FulfillmentKind;
    paymentRequestUrl?: string;
    paymentRequestId?: string;
    paymentRequestQrCodeUrl?: string;
    /** HMAC binding from {@link hmacBindChallenge} — proves challenge was minted for this resource. */
    challengeBinding?: string;
    [key: string]: unknown;
  };
};

/**
 * Builds the JSON body for HTTP 402 (MPP-style machine payment challenge).
 */
export function buildPaymentRequiredBody(input: {
  challengeId: string;
  title?: string;
  detail?: string;
  handcash?: PaymentRequiredBody["handcash"];
}): PaymentRequiredBody {
  return {
    type: PAYMENT_REQUIRED_TYPE,
    title: input.title ?? "Payment Required",
    status: 402,
    detail: input.detail ?? "Payment is required.",
    challengeId: input.challengeId,
    ...(input.handcash ? { handcash: input.handcash } : {}),
  };
}

/**
 * Standard JSON `Response` with status 402 (Web Fetch API).
 */
export function paymentRequiredResponse(
  body: PaymentRequiredBody,
  init?: { headers?: HeadersInit },
): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(body), { status: 402, headers });
}
