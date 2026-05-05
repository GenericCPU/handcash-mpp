/**
 * @packageDocumentation
 * HandCash Machine Payments — HTTP 402, HandCash Pay, Connect.pay, receipt JWTs, webhook verification,
 * and paid-route helpers on Bitcoin SV via `@handcash/sdk`. See ARCHITECTURE.md for the full system design.
 */

export type { EntitlementState, FulfillmentKind } from "./domain/lifecycle.js";
export type {
  ChargeProduct,
  ChargeReceiver,
  ChargeSpec,
  ChargeSpecBsv,
  ChargeSpecMnee,
  HostedPayArtifact,
  MachineChargeIntent,
  ResourceRef,
} from "./domain/types.js";
export type { CreatePaymentRequestBody } from "./domain/instruments.js";
export {
  assertMneeReceiversHaveNoPaymail,
  buildConnectPayBodyFromCharge,
  buildCreatePaymentRequestBodyFromCharge,
  destinationLooksLikePaymail,
  STANDARD_CHARGE_DENOMINATION_CURRENCY,
} from "./domain/instruments.js";
export { createChallengeId, hmacBindChallenge } from "./crypto/binding.js";
export {
  buildPaymentRequiredBody,
  paymentRequiredResponse,
  type PaymentRequiredBody,
} from "./http/payment-required.js";
export { createHostedPayArtifact, type CreateHostedPayOptions } from "./adapters/hosted-pay.js";
export { canonicalizeHandCashPaymentRequestUrl } from "./adapters/payment-request-url.js";
export { executeConnectPay, type ExecuteConnectPayOptions } from "./adapters/connect-pay.js";
export { issueReceiptJwt, verifyReceiptJwt, type VerifiedReceipt } from "./receipts/jwt.js";
export { MemoryJwtReplayGuard } from "./receipts/replay-guard.js";
export {
  verifyPaymentRequestCompletedWebhook,
  type PaymentRequestCompletedWebhookBody,
} from "./webhooks/payment-request.js";
export { MemoryIdempotencyStore, type IdempotencyStore } from "./idempotency/memory-store.js";
export {
  DEFAULT_RECEIPT_HEADER,
  evaluateMachinePaymentGate,
  readReceiptTokenFromRequest,
  runMachinePaidHandler,
  type MachineGateResult,
} from "./http/gate.js";
export { issuePaymentRequiredWithHostedPay, type IssuePaymentRequiredWithHostedPayInput } from "./orchestrate/issue-challenge.js";
export { connectPayAndIssueReceipt, type ConnectPayAndIssueReceiptOptions } from "./orchestrate/connect-receipt.js";
