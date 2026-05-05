import type { FulfillmentKind } from "./lifecycle.js";
import type { ChargeSpec } from "./instruments.js";

export type { ChargeSpec, ChargeSpecBsv, ChargeSpecMnee, ChargeProduct, ChargeReceiver } from "./instruments.js";

/**
 * Canonical identity for the resource being sold (path + method, or your own key).
 */
export type ResourceRef = {
  /** e.g. `POST` */
  method: string;
  /** e.g. `/v1/paid/weather` */
  path: string;
};

/**
 * Merchant-issued machine payment intent (not the same object as HandCash Cloud’s internal ids).
 */
export type MachineChargeIntent = {
  challengeId: string;
  resource: ResourceRef;
  fulfillment: FulfillmentKind;
  charge: ChargeSpec;
  /** Echoed into 402 `handcash` extension for client routing. */
  extensions?: Record<string, unknown>;
};

/**
 * Subset of HandCash Pay surfaces needed for 402 follow-up.
 */
export type HostedPayArtifact = {
  fulfillment: "hosted_pay";
  paymentRequestId: string;
  paymentRequestUrl: string;
  paymentRequestQrCodeUrl?: string;
};
