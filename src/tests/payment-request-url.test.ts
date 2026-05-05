import assert from "node:assert";
import { describe, it } from "node:test";
import { canonicalizeHandCashPaymentRequestUrl } from "../adapters/payment-request-url.js";

describe("canonicalizeHandCashPaymentRequestUrl", () => {
  it("rewrites pay.handcash.io template URL to handcash.io with sid", () => {
    const id = "69f93c0a0c409ffebbc08296";
    const out = canonicalizeHandCashPaymentRequestUrl(`https://pay.handcash.io/${id}`);
    assert.match(out, new RegExp(`^https://handcash\\.io/payment-request/${id}\\?sid=`));
  });

  it("maps referenceId to sid", () => {
    const id = "69f93c0a0c409ffebbc08296";
    const out = canonicalizeHandCashPaymentRequestUrl(
      `https://pay.handcash.io/${id}?referenceId=MyRef`,
    );
    assert.ok(out.includes("sid=MyRef"));
  });

  it("copies domain when present", () => {
    const id = "69f93c0a0c409ffebbc08296";
    const out = canonicalizeHandCashPaymentRequestUrl(
      `https://pay.handcash.io/${id}?domain=app.example.com`,
    );
    assert.ok(out.includes("domain=app.example.com"));
  });

  it("passes through already-canonical URLs", () => {
    const u = "https://handcash.io/payment-request/69f93c0a0c409ffebbc08296?sid=nJa2LJ";
    assert.strictEqual(canonicalizeHandCashPaymentRequestUrl(u), u);
  });

  it("does not rewrite non-template paths", () => {
    const u = "https://pay.handcash.io/api/paymentPreview/qr/abc123";
    assert.strictEqual(canonicalizeHandCashPaymentRequestUrl(u), u);
  });
});
