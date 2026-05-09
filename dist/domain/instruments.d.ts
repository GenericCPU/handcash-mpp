import type { PayData } from "@handcash/sdk";
/**
 * Single fiat denomination for all HandCash MPP charges in this package.
 * `instrumentCurrencyCode` selects **BSV** vs **MNEE** as the settlement rail; **pricing is always USD**.
 */
export declare const STANDARD_CHARGE_DENOMINATION_CURRENCY: "USD";
/**
 * Product block shared by BSV and MNEE payment requests.
 */
export type ChargeProduct = {
    name: string;
    description?: string;
    longDescription?: string;
    imageUrl?: string;
};
export type ChargeReceiver = {
    destination: string;
    /**
     * **Always in USD** (dollar amount, same mental model for BSV and MNEE).
     * - **BSV + hosted payment request:** Cloud field **`currency`** (e.g. `USD`) + `sendAmount` as USD quote.
     * - **BSV + Connect.pay:** **`denominationCurrencyCode: USD`** (see {@link buildConnectPayBodyFromCharge}).
     * - **MNEE instrument:** no denomination on payment requests; value is sent as **MNEE** amount.
     *   For HandCash’s USD-pegged MNEE instrument, use the **same USD price** as the figure you would pass for BSV-with-USD-denomination.
     *   If your peg or spread differs, convert USD→MNEE **before** building the charge.
     */
    sendAmount: number;
    tags?: Array<string>;
};
/**
 * Strip a leading **`$`** so **`POST /v3/paymentRequests/`** uses plain handles per HandCash Pay docs
 * (`destination` without `$`; {@link buildConnectPayBodyFromCharge} is unchanged).
 * HandCash handles are treated as **case-insensitive** here (**lowercased**) except when the value looks like a **case-sensitive** on-chain address.
 */
export declare function normalizePaymentRequestDestinationForCloud(destination: string): string;
/**
 * **BSV** settlement — hosted payment requests send **`currency: USD`** on Cloud (see {@link buildCreatePaymentRequestBodyFromCharge}).
 */
export type ChargeSpecBsv = {
    instrumentCurrencyCode: "BSV";
    receivers: ChargeReceiver[];
    product: ChargeProduct;
};
/**
 * **MNEE** settlement — Cloud **forbids** `denominationCurrencyCode` for non-BSV instruments.
 * You still express {@link ChargeReceiver.sendAmount} in **USD** for product continuity; it is submitted as the MNEE amount (see {@link ChargeReceiver.sendAmount}).
 *
 * **Connect-only constraint (Cloud):** instrument (MNEE) sends **cannot** use **paymail** destinations (`@` in string).
 * Handles and raw BSV addresses are fine.
 */
export type ChargeSpecMnee = {
    instrumentCurrencyCode: "MNEE";
    receivers: ChargeReceiver[];
    product: ChargeProduct;
};
export type ChargeSpec = ChargeSpecBsv | ChargeSpecMnee;
/**
 * JSON body for **`POST /v3/paymentRequests/`** (hosted HandCash Pay), before optional fields
 * (`redirectUrl`, `notifications`, etc.).
 */
export type CreatePaymentRequestBody = {
    instrumentCurrencyCode: "BSV";
    /** HandCash Cloud `POST /v3/paymentRequests/` — display / quote currency (not `denominationCurrencyCode`). */
    currency: typeof STANDARD_CHARGE_DENOMINATION_CURRENCY;
    product: ChargeProduct;
    receivers: ChargeReceiver[];
} | {
    instrumentCurrencyCode: "MNEE";
    product: ChargeProduct;
    receivers: ChargeReceiver[];
};
/** Same heuristic as HandCash Cloud `isPaymail`: any `@` in destination. */
export declare function destinationLooksLikePaymail(destination: string): boolean;
/**
 * Validates MNEE + Connect rules before calling the API.
 * Payment requests may still hit Cloud-side rules; this catches the known paymail restriction early.
 */
export declare function assertMneeReceiversHaveNoPaymail(receivers: ChargeReceiver[]): void;
/**
 * JSON body for HandCash Cloud **`POST /v3/paymentRequests/`** (hosted HandCash Pay).
 *
 * - **BSV:** sends **`currency: USD`** (HandCash Pay docs); `sendAmount` is a **USD quote**. Receiver destinations are plain handles (leading **`$`** stripped).
 * - **MNEE:** **never** sends `currency` / denomination on the payment-request body; `sendAmount` values are passed through as MNEE numerics (see {@link ChargeReceiver.sendAmount}).
 */
export declare function buildCreatePaymentRequestBodyFromCharge(charge: ChargeSpec): CreatePaymentRequestBody;
/**
 * Body for **`Connect.pay`** — mirrors Cloud `PayValidator`: **USD** denomination for **BSV**;
 * **MNEE** omits denomination and enforces the paymail rule before you call the API.
 */
export declare function buildConnectPayBodyFromCharge(charge: ChargeSpec, extras?: {
    note?: string;
    attachment?: PayData["body"]["attachment"];
    exchangeRateVersion?: string;
}): PayData["body"];
//# sourceMappingURL=instruments.d.ts.map