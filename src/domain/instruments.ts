import type { PayData } from "@handcash/sdk";

/**
 * Single fiat denomination for all HandCash MPP charges in this package.
 * `instrumentCurrencyCode` selects **BSV** vs **MNEE** as the settlement rail; **pricing is always USD**.
 */
export const STANDARD_CHARGE_DENOMINATION_CURRENCY = "USD" as const;

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
 * JSON body for **`POST /v3/paymentRequests/`** (hosted HandCash Pay), before optional fields
 * (`redirectUrl`, `notifications`, etc.).
 */
export type CreatePaymentRequestBody =
  | {
      instrumentCurrencyCode: "BSV";
      denominationCurrencyCode: typeof STANDARD_CHARGE_DENOMINATION_CURRENCY;
      product: ChargeProduct;
      receivers: ChargeReceiver[];
    }
  | {
      instrumentCurrencyCode: "MNEE";
      product: ChargeProduct;
      receivers: ChargeReceiver[];
    };

/** Same heuristic as HandCash Cloud `isPaymail`: any `@` in destination. */
export function destinationLooksLikePaymail(destination: string): boolean {
  return destination.includes("@");
}

/**
 * Validates MNEE + Connect rules before calling the API.
 * Payment requests may still hit Cloud-side rules; this catches the known paymail restriction early.
 */
export function assertMneeReceiversHaveNoPaymail(receivers: ChargeReceiver[]): void {
  const bad = receivers.find((r) => destinationLooksLikePaymail(r.destination));
  if (bad) {
    throw new Error(
      `MNEE (instrument) transfers cannot use paymail destinations. Offender: "${bad.destination}". Use a HandCash handle or a BSV address.`,
    );
  }
}

/**
 * JSON body for HandCash Cloud **`POST /v3/paymentRequests/`** (hosted HandCash Pay).
 *
 * - **BSV:** always sends `denominationCurrencyCode: USD` so `sendAmount` is a **USD quote** (continuity with MNEE pricing).
 * - **MNEE:** **never** sends `denominationCurrencyCode` (forbidden by Cloud); `sendAmount` values are passed through as MNEE numerics (see {@link ChargeReceiver.sendAmount}).
 */
export function buildCreatePaymentRequestBodyFromCharge(charge: ChargeSpec): CreatePaymentRequestBody {
  const shared = {
    product: charge.product,
    receivers: charge.receivers,
  } as const;

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
export function buildConnectPayBodyFromCharge(
  charge: ChargeSpec,
  extras?: {
    note?: string;
    attachment?: PayData["body"]["attachment"];
    exchangeRateVersion?: string;
  },
): PayData["body"] {
  const base: PayData["body"] = {
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
