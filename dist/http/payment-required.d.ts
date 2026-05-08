import type { FulfillmentKind } from "../domain/lifecycle.js";
declare const PAYMENT_REQUIRED_TYPE = "https://paymentauth.org/problems/payment-required";
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
export declare function buildPaymentRequiredBody(input: {
    challengeId: string;
    title?: string;
    detail?: string;
    handcash?: PaymentRequiredBody["handcash"];
}): PaymentRequiredBody;
/**
 * Standard JSON `Response` with status 402 (Web Fetch API).
 */
export declare function paymentRequiredResponse(body: PaymentRequiredBody, init?: {
    headers?: HeadersInit;
}): Response;
export {};
//# sourceMappingURL=payment-required.d.ts.map