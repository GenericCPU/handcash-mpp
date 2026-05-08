import { type ExecuteConnectPayOptions } from "../adapters/connect-pay.js";
import type { ResourceRef } from "../domain/types.js";
export type ConnectPayAndIssueReceiptOptions = ExecuteConnectPayOptions & {
    receiptSecret: string;
    resource: ResourceRef;
    challengeId: string;
    receiptTtlSeconds: number;
};
/**
 * After a successful **`Connect.pay`**, mint a **receipt JWT** the client can send on retries
 * (see {@link evaluateMachinePaymentGate} / {@link runMachinePaidHandler}).
 */
export declare function connectPayAndIssueReceipt(opts: ConnectPayAndIssueReceiptOptions): Promise<{
    receiptJwt: string;
    transactionId: string;
} | {
    error: string;
}>;
//# sourceMappingURL=connect-receipt.d.ts.map