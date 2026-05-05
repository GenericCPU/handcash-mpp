import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyPaymentRequestCompletedWebhook } from "../webhooks/payment-request.js";

describe("payment request webhook", () => {
  it("accepts valid secret", () => {
    const body = {
      appSecret: "s3cr3t",
      paymentRequestId: "pr1",
      paymentMethod: "onChain",
      transactionId: "tx1",
    };
    assert.equal(verifyPaymentRequestCompletedWebhook("s3cr3t", body), true);
  });

  it("rejects wrong secret", () => {
    const body = {
      appSecret: "wrong",
      paymentRequestId: "pr1",
      paymentMethod: "onChain",
      transactionId: "tx1",
    };
    assert.equal(verifyPaymentRequestCompletedWebhook("s3cr3t", body), false);
  });

  it("rejects missing fields", () => {
    assert.equal(verifyPaymentRequestCompletedWebhook("s3cr3t", { appSecret: "s3cr3t" }), false);
  });
});
