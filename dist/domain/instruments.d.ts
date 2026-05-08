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
     * - **BSV instrument:** Cloud receives `denominationCurrencyCode: USD` and interprets `sendAmount` as a USD quote.
     * - **MNEE instrument:** Cloud **does not** accept a denomination field; this value is sent as the numeric **MNEE** amount.
     *   For HandCash’s USD-pegged MNEE instrument, use the **same USD price** as the figure you would pass for BSV-with-USD-denomination.
     *   If your peg or spread differs, convert USD→MNEE **before** building the charge.
     */
    sendAmount: number;
    tags?: Array<string>;
};
/**
 * **BSV** settlement — Cloud gets `denominationCurrencyCode: 'USD'` from {@link buildCreatePaymentRequestBodyFromCharge} (fixed in this package).
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
 * Core JSON body for **`POST /v3/paymentRequests`** (app `client` from `getInstance`).
 * The public `@handcash/sdk` package does not yet export generated `PaymentRequests` helpers; MPP builds this shape explicitly (same as HandCash Cloud / admin tooling).
 */
export type PaymentRequestChargePayload = {
    product: ChargeProduct;
    receivers: ChargeReceiver[];
    instrumentCurrencyCode: "BSV" | "MNEE";
    denominationCurrencyCode?: typeof STANDARD_CHARGE_DENOMINATION_CURRENCY;
};
/** Same heuristic as HandCash Cloud `isPaymail`: any `@` in destination. */
export declare function destinationLooksLikePaymail(destination: string): boolean;
/**
 * Validates MNEE + Connect rules before calling the API.
 * Payment requests may still hit Cloud-side rules; this catches the known paymail restriction early.
 */
export declare function assertMneeReceiversHaveNoPaymail(receivers: ChargeReceiver[]): void;
/**
 * Builds the charge portion of **`POST /v3/paymentRequests`**.
 *
 * - **BSV:** always sends `denominationCurrencyCode: USD` so `sendAmount` is a **USD quote** (continuity with MNEE pricing).
 * - **MNEE:** **never** sends `denominationCurrencyCode` (forbidden by Cloud); `sendAmount` values are passed through as MNEE numerics (see {@link ChargeReceiver.sendAmount}).
 */
export declare function buildCreatePaymentRequestBodyFromCharge(charge: ChargeSpec): PaymentRequestChargePayload;
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