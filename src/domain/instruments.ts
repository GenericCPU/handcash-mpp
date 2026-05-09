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
   * - **BSV + hosted payment request / Connect.pay:** Cloud uses **`denominationCurrencyCode: USD`** and **`sendAmount`** as a USD quote.
   * - **MNEE instrument:** no denomination field on the request; value is sent as **MNEE** amount.
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
export function normalizePaymentRequestDestinationForCloud(destination: string): string {
  const s = destination.trim().replace(/^\$+/u, "");
  if (!s) return s;
  const looksLikeP2pkh = /^(1|3)[a-km-zA-HJ-NP-Z1-9]{24,33}$/.test(s);
  const looksLikeBc1 = /^bc1[a-z0-9]+$/i.test(s);
  if (looksLikeP2pkh || looksLikeBc1) return s;
  return s.toLowerCase();
}

/**
 * **BSV** settlement — Cloud gets **`denominationCurrencyCode: 'USD'`** from {@link buildCreatePaymentRequestBodyFromCharge} (same field name as Connect.pay).
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
      /** Live Cloud rejects top-level `currency` on this route; use `denominationCurrencyCode` (matches poker / SDK examples). */
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
 * - **BSV:** sends **`denominationCurrencyCode: USD`**; `sendAmount` is a **USD quote**. Receiver destinations are plain handles (leading **`$`** stripped).
 * - **MNEE:** **never** sends denomination on the payment-request body; `sendAmount` values are passed through as MNEE numerics (see {@link ChargeReceiver.sendAmount}).
 */
export function buildCreatePaymentRequestBodyFromCharge(charge: ChargeSpec): CreatePaymentRequestBody {
  const receivers = charge.receivers.map((r) => ({
    ...r,
    destination: normalizePaymentRequestDestinationForCloud(r.destination),
  }));
  const shared = {
    product: charge.product,
    receivers,
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
