import { executeConnectPay } from "../adapters/connect-pay.js";
import { issueReceiptJwt } from "../receipts/jwt.js";
/**
 * After a successful **`Connect.pay`**, mint a **receipt JWT** the client can send on retries
 * (see {@link evaluateMachinePaymentGate} / {@link runMachinePaidHandler}).
 */
export async function connectPayAndIssueReceipt(opts) {
    const { receiptSecret, resource, challengeId, receiptTtlSeconds, ...payOpts } = opts;
    const { data, error } = await executeConnectPay(payOpts);
    if (error)
        return { error: error.message };
    const transactionId = data?.transactionId;
    if (!transactionId)
        return { error: "Connect.pay returned no transactionId" };
    const receiptJwt = await issueReceiptJwt(receiptSecret, {
        challengeId,
        resourceMethod: resource.method,
        resourcePath: resource.path,
        transactionId,
    }, receiptTtlSeconds);
    return { receiptJwt, transactionId };
}
//# sourceMappingURL=connect-receipt.js.map