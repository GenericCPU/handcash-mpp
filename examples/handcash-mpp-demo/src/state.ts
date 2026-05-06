import type { ResourceRef } from "@handcash/mpp";

/** One in-memory row per active 402 (hosted `paymentRequestId` + same `challengeId` for Connect). */
export type PremiumSession = {
  challengeId: string;
  paymentRequestId: string;
  resource: ResourceRef;
  receiptJwt?: string;
};

const byPaymentRequestId = new Map<string, PremiumSession>();
const byChallengeId = new Map<string, PremiumSession>();

export function registerPremiumSession(s: PremiumSession): void {
  byPaymentRequestId.set(s.paymentRequestId, s);
  byChallengeId.set(s.challengeId, s);
}

export function getSessionForPaymentRequest(id: string): PremiumSession | undefined {
  return byPaymentRequestId.get(id);
}

export function getSessionForChallenge(challengeId: string): PremiumSession | undefined {
  return byChallengeId.get(challengeId);
}

/** Hosted path settled (webhook or demo/complete): store JWT; drop Connect eligibility for this challenge. */
export function setHostedReceipt(paymentRequestId: string, receiptJwt: string): void {
  const s = byPaymentRequestId.get(paymentRequestId);
  if (!s) return;
  s.receiptJwt = receiptJwt;
  byChallengeId.delete(s.challengeId);
}

/** Connect path: client already has JWT — remove row so hosted poll does not see stale state. */
export function clearSessionAfterConnect(challengeId: string): void {
  const s = byChallengeId.get(challengeId);
  if (!s) return;
  byChallengeId.delete(challengeId);
  byPaymentRequestId.delete(s.paymentRequestId);
}
