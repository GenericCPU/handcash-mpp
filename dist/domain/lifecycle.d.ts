/**
 * Logical entitlement states for a machine-paid resource.
 * Maps to the machine payment mental model: 402 → pay → retry with proof → 200.
 */
export type EntitlementState = "UNPAID" | "PENDING" | "SETTLED" | "ENTITLED";
/**
 * How the payer satisfies the charge on HandCash rails.
 */
export type FulfillmentKind = "connect" | "hosted_pay";
//# sourceMappingURL=lifecycle.d.ts.map