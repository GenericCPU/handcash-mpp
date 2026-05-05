import { executeConnectPay, type ExecuteConnectPayOptions } from "../adapters/connect-pay.js";
import { issueReceiptJwt } from "../receipts/jwt.js";
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
export async function connectPayAndIssueReceipt(
  opts: ConnectPayAndIssueReceiptOptions,
): Promise<{ receiptJwt: string; transactionId: string } | { error: string }> {
  const { receiptSecret, resource, challengeId, receiptTtlSeconds, ...payOpts } = opts;
  const { data, error } = await executeConnectPay(payOpts);
  if (error) return { error: error.message };
  const transactionId = data?.transactionId;
  if (!transactionId) return { error: "Connect.pay returned no transactionId" };

  const receiptJwt = await issueReceiptJwt(
    receiptSecret,
    {
      challengeId,
      resourceMethod: resource.method,
      resourcePath: resource.path,
      transactionId,
    },
    receiptTtlSeconds,
  );

  return { receiptJwt, transactionId };
}
