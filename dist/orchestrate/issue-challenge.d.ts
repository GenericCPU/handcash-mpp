import { type CreateHostedPayOptions } from "../adapters/hosted-pay.js";
import type { ResourceRef } from "../domain/types.js";
export type IssuePaymentRequiredWithHostedPayInput = CreateHostedPayOptions & {
    serverSecret: string;
    resource: ResourceRef;
};
/**
 * One-shot: mint **challengeId**, create **HandCash Pay** payment request, return **402** with URLs + binding.
 * Point **`webhookUrl`** at your server; after you verify the webhook and **`appSecret`**, issue {@link issueReceiptJwt}
 * and return it to the client (or set cookie) so retries include the receipt.
 */
export declare function issuePaymentRequiredWithHostedPay(input: IssuePaymentRequiredWithHostedPayInput): Promise<{
    response: Response;
    challengeId: string;
} | {
    response: Response;
    error: string;
}>;
//# sourceMappingURL=issue-challenge.d.ts.map