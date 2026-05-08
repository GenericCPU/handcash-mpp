import { createHostedPayArtifact } from "../adapters/hosted-pay.js";
import { createChallengeId, hmacBindChallenge } from "../crypto/binding.js";
import { buildPaymentRequiredBody, paymentRequiredResponse } from "../http/payment-required.js";
/**
 * One-shot: mint **challengeId**, create **HandCash Pay** payment request, return **402** with URLs + binding.
 * Point **`webhookUrl`** at your server; after you verify the webhook and **`appSecret`**, issue {@link issueReceiptJwt}
 * and return it to the client (or set cookie) so retries include the receipt.
 */
export async function issuePaymentRequiredWithHostedPay(input) {
    const challengeId = createChallengeId();
    const binding = hmacBindChallenge(input.serverSecret, challengeId, input.resource.method, input.resource.path);
    const { serverSecret: _sec, resource: _res, client, charge, ...hostedRest } = input;
    const { data, error } = await createHostedPayArtifact({
        client,
        charge,
        ...hostedRest,
    });
    if (error) {
        return {
            response: new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { "Content-Type": "application/json; charset=utf-8" },
            }),
            error: error.message,
        };
    }
    if (!data) {
        return {
            response: new Response(JSON.stringify({ error: "Empty payment request response" }), {
                status: 500,
                headers: { "Content-Type": "application/json; charset=utf-8" },
            }),
            error: "Empty payment request response",
        };
    }
    const body = buildPaymentRequiredBody({
        challengeId,
        handcash: {
            fulfillment: "hosted_pay",
            paymentRequestId: data.paymentRequestId,
            paymentRequestUrl: data.paymentRequestUrl,
            paymentRequestQrCodeUrl: data.paymentRequestQrCodeUrl,
            challengeBinding: binding,
        },
    });
    return { response: paymentRequiredResponse(body), challengeId };
}
//# sourceMappingURL=issue-challenge.js.map