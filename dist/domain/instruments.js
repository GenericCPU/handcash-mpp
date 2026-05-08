/**
 * Single fiat denomination for all HandCash MPP charges in this package.
 * `instrumentCurrencyCode` selects **BSV** vs **MNEE** as the settlement rail; **pricing is always USD**.
 */
export const STANDARD_CHARGE_DENOMINATION_CURRENCY = "USD";
/** Same heuristic as HandCash Cloud `isPaymail`: any `@` in destination. */
export function destinationLooksLikePaymail(destination) {
    return destination.includes("@");
}
/**
 * Validates MNEE + Connect rules before calling the API.
 * Payment requests may still hit Cloud-side rules; this catches the known paymail restriction early.
 */
export function assertMneeReceiversHaveNoPaymail(receivers) {
    const bad = receivers.find((r) => destinationLooksLikePaymail(r.destination));
    if (bad) {
        throw new Error(`MNEE (instrument) transfers cannot use paymail destinations. Offender: "${bad.destination}". Use a HandCash handle or a BSV address.`);
    }
}
/**
 * Builds the charge portion of **`POST /v3/paymentRequests`**.
 *
 * - **BSV:** always sends `denominationCurrencyCode: USD` so `sendAmount` is a **USD quote** (continuity with MNEE pricing).
 * - **MNEE:** **never** sends `denominationCurrencyCode` (forbidden by Cloud); `sendAmount` values are passed through as MNEE numerics (see {@link ChargeReceiver.sendAmount}).
 */
export function buildCreatePaymentRequestBodyFromCharge(charge) {
    const shared = {
        product: charge.product,
        receivers: charge.receivers,
    };
    if (charge.instrumentCurrencyCode === "BSV") {
        return {
            ...shared,
            instrumentCurrencyCode: "BSV",
            denominationCurrencyCode: STANDARD_CHARGE_DENOMINATION_CURRENCY,
        };
    }
    return {
        ...shared,
        instrumentCurrencyCode: "MNEE",
    };
}
/**
 * Body for **`Connect.pay`** — mirrors Cloud `PayValidator`: **USD** denomination for **BSV**;
 * **MNEE** omits denomination and enforces the paymail rule before you call the API.
 */
export function buildConnectPayBodyFromCharge(charge, extras) {
    const base = {
        instrumentCurrencyCode: charge.instrumentCurrencyCode,
        receivers: charge.receivers,
        ...(extras?.note ? { note: extras.note } : {}),
        ...(extras?.attachment ? { attachment: extras.attachment } : {}),
        ...(extras?.exchangeRateVersion ? { exchangeRateVersion: extras.exchangeRateVersion } : {}),
    };
    if (charge.instrumentCurrencyCode === "BSV") {
        return {
            ...base,
            denominationCurrencyCode: STANDARD_CHARGE_DENOMINATION_CURRENCY,
        };
    }
    assertMneeReceiversHaveNoPaymail(charge.receivers);
    return base;
}
//# sourceMappingURL=instruments.js.map