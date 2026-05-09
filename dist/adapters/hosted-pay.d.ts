import type { Client } from "@hey-api/client-fetch";
import { type CreatePaymentRequestBody } from "../domain/instruments.js";
import type { ChargeSpec } from "../domain/types.js";
import type { HostedPayArtifact } from "../domain/types.js";
type CreatePaymentRequestHttpBody = CreatePaymentRequestBody & {
    /** Required by HandCash Cloud for `POST /v3/paymentRequests/`. */
    expirationType: "never" | "limit" | "onPaymentCompleted";
    requestedUserData?: Array<"paymail" | "email" | "phoneNumber">;
    paymentMethods?: Array<"onChain" | "externalPaymentProcessor">;
    redirectUrl?: string;
    notifications?: {
        webhook?: {
            webhookUrl: string;
            customParameters?: Record<string, never>;
        };
        email?: string;
    };
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
export declare function createHostedPayArtifact(opts: CreateHostedPayOptions): Promise<{
    data: HostedPayArtifact | null;
    error: {
        message: string;
    } | null;
}>;
export {};
//# sourceMappingURL=hosted-pay.d.ts.map