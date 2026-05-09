import type { Client } from "@hey-api/client-fetch";
import { canonicalizeHandCashPaymentRequestUrl } from "./payment-request-url.js";
import {
  buildCreatePaymentRequestBodyFromCharge,
  type CreatePaymentRequestBody,
} from "../domain/instruments.js";
import type { ChargeSpec } from "../domain/types.js";
import type { HostedPayArtifact } from "../domain/types.js";

type CreatePaymentRequestHttpBody = CreatePaymentRequestBody & {
  /** Required by HandCash Cloud for `POST /v3/paymentRequests/`. */
  expirationType: "never" | "limit" | "onPaymentCompleted";
  requestedUserData?: Array<"paymail" | "email" | "phoneNumber">;
  paymentMethods?: Array<"onChain" | "externalPaymentProcessor">;
  redirectUrl?: string;
  notifications?: {
    webhook?: { webhookUrl: string; customParameters?: Record<string, never> };
    email?: string;
  };
};

type CreatePaymentRequestSuccess = {
  id: string;
  paymentRequestUrl: string;
  paymentRequestQrCodeUrl?: string;
};

export type CreateHostedPayOptions = {
  /** App-level client from `getInstance({ appId, appSecret }).client` */
  client: Client;
  charge: ChargeSpec;
  /** Tie Cloud webhooks back to your `challengeId`. */
  webhookUrl?: string;
  redirectUrl?: string;
  requestedUserData?: CreatePaymentRequestHttpBody["requestedUserData"];
  paymentMethods?: CreatePaymentRequestHttpBody["paymentMethods"];
};

/**
 * HandCash Pay: creates a **payment request** and returns URLs for the 402 `handcash` extension.
 * This acts as the hosted payment redirect URL inside a machine-pay flow.
 * When Cloud still returns **`pay.handcash.io/{id}`**, the checkout URL is rewritten to **`handcash.io/payment-request/{id}?sid=…`**
 * so the payer lands on the current public web checkout.
 *
 * Uses **`POST /v3/paymentRequests/`** on the app-scoped Hey API client (same route the full OpenAPI SDK exposes as `PaymentRequests.createPaymentRequest` where available).
 */
export async function createHostedPayArtifact(
  opts: CreateHostedPayOptions,
): Promise<{ data: HostedPayArtifact | null; error: { message: string } | null }> {
  const body: CreatePaymentRequestHttpBody = {
    expirationType: "never",
    ...buildCreatePaymentRequestBodyFromCharge(opts.charge),
    ...(opts.requestedUserData ? { requestedUserData: opts.requestedUserData } : {}),
    ...(opts.paymentMethods ? { paymentMethods: opts.paymentMethods } : {}),
    ...(opts.redirectUrl ? { redirectUrl: opts.redirectUrl } : {}),
    ...(opts.webhookUrl
      ? {
          notifications: {
            webhook: { webhookUrl: opts.webhookUrl },
          },
        }
      : {}),
  };

  const { data: rawData, error } = await opts.client.post({
    security: [
      { name: "app-id", type: "apiKey" },
      { name: "app-secret", type: "apiKey" },
    ],
    url: "/v3/paymentRequests/",
    body,
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = rawData as CreatePaymentRequestSuccess | undefined;

  if (error) {
    const msg =
      typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Create payment request (POST /v3/paymentRequests/) failed";
    return { data: null, error: { message: msg } };
  }

  if (!data?.id || !data.paymentRequestUrl) {
    return { data: null, error: { message: "Missing paymentRequest id or paymentRequestUrl in response" } };
  }

  const paymentRequestUrl = canonicalizeHandCashPaymentRequestUrl(data.paymentRequestUrl);

  return {
    data: {
      fulfillment: "hosted_pay",
      paymentRequestId: data.id,
      paymentRequestUrl,
      ...(data.paymentRequestQrCodeUrl
        ? { paymentRequestQrCodeUrl: data.paymentRequestQrCodeUrl }
        : {}),
    },
    error: null,
  };
}
