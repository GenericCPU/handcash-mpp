import type { ChargeSpec } from "../domain/types.js";
import type { HostedPayArtifact } from "../domain/types.js";
/**
 * App-level client from `getInstance({ appId, appSecret }).client` (`@handcash/sdk` ≥ 1.x).
 * Uses `POST /v3/paymentRequests`, which is not exposed as a generated SDK helper yet.
 */
export type HandCashAppLevelClient = {
    post(options: {
        url: string;
        body?: unknown;
    }): Promise<{
        data?: unknown;
        error?: unknown;
    }>;
};
export type CreateHostedPayOptions = {
    /** App-level client from `getInstance({ appId, appSecret }).client` */
    client: HandCashAppLevelClient;
    charge: ChargeSpec;
    /** Tie Cloud webhooks back to your `challengeId`. */
    webhookUrl?: string;
    redirectUrl?: string;
    requestedUserData?: Record<string, unknown>;
    paymentMethods?: unknown;
};
/**
 * HandCash Pay: creates a **payment request** and returns URLs for the 402 `handcash` extension.
 * This acts as the hosted payment redirect URL inside a machine-pay flow.
 * When Cloud still returns **`pay.handcash.io/{id}`**, the checkout URL is rewritten to **`handcash.io/payment-request/{id}?sid=…`**
 * so the payer lands on the current public web checkout.
 */
export declare function createHostedPayArtifact(opts: CreateHostedPayOptions): Promise<{
    data: HostedPayArtifact | null;
    error: {
        message: string;
    } | null;
}>;
//# sourceMappingURL=hosted-pay.d.ts.map