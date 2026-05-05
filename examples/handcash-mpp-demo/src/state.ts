import type { ResourceRef } from "@handcash/mpp";

export type PendingPayment = {
  challengeId: string;
  resource: ResourceRef;
};

/** paymentRequestId → pending challenge (cleared after receipt issued) */
export const pendingByPaymentRequestId = new Map<string, PendingPayment>();

/** paymentRequestId → receipt JWT (for demo UI to poll after hosted pay) */
export const receiptJwtByPaymentRequestId = new Map<string, string>();

/** challengeId → same resource as hosted 402 (for Connect.pay path) */
export const pendingConnectByChallengeId = new Map<string, { resource: ResourceRef }>();

/** challengeId → hosted paymentRequestId (clear Connect path when either path completes) */
export const challengeIdToHostedPaymentRequestId = new Map<string, string>();

export function clearPendingForChallenge(challengeId: string): void {
  pendingConnectByChallengeId.delete(challengeId);
  const pid = challengeIdToHostedPaymentRequestId.get(challengeId);
  if (pid) pendingByPaymentRequestId.delete(pid);
  challengeIdToHostedPaymentRequestId.delete(challengeId);
}
