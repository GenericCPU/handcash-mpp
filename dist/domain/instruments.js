/**
 * Single fiat denomination for all HandCash MPP charges in this package.
 * `instrumentCurrencyCode` selects **BSV** vs **MNEE** as the settlement rail; **pricing is always USD**.
 */
export const STANDARD_CHARGE_DENOMINATION_CURRENCY = "USD";
/**
 * Strip a leading **`$`** so **`POST /v3/paymentRequests/`** uses plain handles per HandCash Pay docs
 * (`destination` without `$`; {@link buildConnectPayBodyFromCharge} is unchanged).
 * HandCash handles are treated as **case-insensitive** here (**lowercased**) except when the value looks like a **case-sensitive** on-chain address.
 */
export function normalizePaymentRequestDestinationForCloud(destination) {
    const s = destination.trim().replace(/^\$+/u, "");
    if (!s)
        return s;
    const looksLikeP2pkh = /^(1|3)[a-km-zA-HJ-NP-Z1-9]{24,33}$/.test(s);
    const looksLikeBc1 = /^bc1[a-z0-9]+$/i.test(s);
    if (looksLikeP2pkh || looksLikeBc1)
        return s;
    return s.toLowerCase();
}
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
 * JSON body for HandCash Cloud **`POST /v3/paymentRequests/`** (hosted HandCash Pay).
 *
 * - **BSV:** sends **`currency: USD`** (HandCash Pay docs); `sendAmount` is a **USD quote**. Receiver destinations are plain handles (leading **`$`** stripped).
 * - **MNEE:** **never** sends `currency` / denomination on the payment-request body; `sendAmount` values are passed through as MNEE numerics (see {@link ChargeReceiver.sendAmount}).
 */
export function buildCreatePaymentRequestBodyFromCharge(charge) {
    const receivers = charge.receivers.map((r) => ({
        ...r,
        destination: normalizePaymentRequestDestinationForCloud(r.destination),
    }));
    const shared = {
        product: charge.product,
        receivers,
    };
    if (charge.instrumentCurrencyCode === "BSV") {
        return {
            ...shared,
            instrumentCurrencyCode: "BSV",
            currency: STANDARD_CHARGE_DENOMINATION_CURRENCY,
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