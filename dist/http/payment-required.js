const PAYMENT_REQUIRED_TYPE = "https://paymentauth.org/problems/payment-required";
/**
 * Builds the JSON body for HTTP 402 (MPP-style machine payment challenge).
 */
export function buildPaymentRequiredBody(input) {
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
export function paymentRequiredResponse(body, init) {
    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json; charset=utf-8");
    }
    return new Response(JSON.stringify(body), { status: 402, headers });
}
//# sourceMappingURL=payment-required.js.map