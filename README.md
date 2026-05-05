# `@handcash/mpp`

> **Note:** This is an unofficial, open-source project and is not affiliated with or endorsed by HandCash.

**HandCash Machine Payments** — HTTP **402** challenges, **HandCash Pay** (payment requests), **Connect.pay**, **receipt JWTs**, **webhook verification**, and a small **Request/Response gate** for paid APIs on **Bitcoin SV** via [`@handcash/sdk`](https://www.npmjs.com/package/@handcash/sdk).

Design and Cloud rules: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

Runnable reference server: **[examples/handcash-mpp-demo/](./examples/handcash-mpp-demo/)** (see [examples/README.md](./examples/README.md)).

## Build

```bash
git clone git@github.com:GenericCPU/handcash-mpp.git
cd handcash-mpp
npm install
npm test
```

`npm install` runs **`prepare`** and compiles **`dist/`** (requires `@handcash/sdk` from npm).

## Surface area (v1)

| Area | Exports |
|------|---------|
| **Money** | `ChargeSpec` / `ChargeSpecBsv` / `ChargeSpecMnee`, `STANDARD_CHARGE_DENOMINATION_CURRENCY` (`USD`), `buildCreatePaymentRequestBodyFromCharge`, `buildConnectPayBodyFromCharge`, `assertMneeReceiversHaveNoPaymail` |
| **402** | `buildPaymentRequiredBody`, `paymentRequiredResponse` |
| **Challenges** | `createChallengeId`, `hmacBindChallenge` |
| **HandCash Pay** | `createHostedPayArtifact`, `issuePaymentRequiredWithHostedPay`, `canonicalizeHandCashPaymentRequestUrl` |
| **Connect** | `executeConnectPay`, `connectPayAndIssueReceipt` |
| **Receipts** | `issueReceiptJwt`, `verifyReceiptJwt`, `MemoryJwtReplayGuard` |
| **HTTP gate** | `evaluateMachinePaymentGate`, `runMachinePaidHandler`, `readReceiptTokenFromRequest`, `DEFAULT_RECEIPT_HEADER` |
| **Webhooks** | `verifyPaymentRequestCompletedWebhook` (body `appSecret` from Cloud) |
| **Idempotency** | `MemoryIdempotencyStore`, `IdempotencyStore` |

## Minimal flow (hosted pay)

1. On first request, call **`issuePaymentRequiredWithHostedPay`** → return **402** + `paymentRequestUrl`.
2. Buyer pays on HandCash; your **`webhookUrl`** receives the completion payload → **`verifyPaymentRequestCompletedWebhook`** with your app secret.
3. Issue **`issueReceiptJwt`** (bind `challengeId`, resource method/path, `transactionId` / `paymentRequestId`).
4. On retry, client sends JWT in **`x-handcash-receipt`** or **`Authorization: Bearer …`**; **`runMachinePaidHandler`** serves the resource.

**Connect path:** **`connectPayAndIssueReceipt`** after the user has an **`authToken`**.

## Production readiness

For integrations that move real value, treat the following as baseline hygiene. This package supplies primitives; **wiring and persistence are your responsibility**.

- **Webhook authenticity:** Act only on payloads that pass **`verifyPaymentRequestCompletedWebhook`** using your HandCash app secret. Reject missing or invalid signatures before mutating state.
- **Idempotent fulfillment:** The same `paymentRequestId` or completion notification may arrive more than once. Your handlers must not double-grant entitlements, decrement inventory twice, or persist duplicate “paid” rows keyed only by delivery attempt.
- **Receipt replay:** Pair **`evaluateMachinePaymentGate`** with **`MemoryJwtReplayGuard`** when a receipt JWT must not unlock the same resource repeatedly within a short window. For more than one application process, replace the in-memory guard with **shared** storage keyed by JWT **`jti`** (or equivalent), with TTL aligned to receipt lifetime.
- **Idempotency keys:** Generate stable keys for payment-request creation and wallet debits where HandCash Cloud or your gateway accepts them, so client or intermediary retries cannot create parallel charges.
- **Secrets:** Keep `receiptSecret`, challenge-binding `serverSecret`, and app credentials out of source control; rotate on compromise. Serve webhook endpoints over HTTPS.

See **[SECURITY.md](./SECURITY.md)** for how to report vulnerabilities in this package.

## Dependencies

- **Runtime:** `jose` (HS256 receipts), `@handcash/sdk` (peer).
