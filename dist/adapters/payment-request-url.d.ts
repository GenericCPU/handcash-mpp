/**
 * Rewrites legacy **`https://pay.handcash.io/{id}`** checkout links to
 * **`https://handcash.io/payment-request/{id}?sid=…`**, which is what the public web app expects.
 * Preserves **`referenceId`** as **`sid`** when present; otherwise mints a short random **`sid`**.
 * Copies **`domain`** when present (non-production app domains).
 * If Cloud already returns **`handcash.io`**, the URL is returned unchanged.
 */
export declare function canonicalizeHandCashPaymentRequestUrl(paymentRequestUrl: string): string;
//# sourceMappingURL=payment-request-url.d.ts.map