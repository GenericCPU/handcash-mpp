# `@handcash/mpp`

> **Note:** This is an unofficial, open-source project and is not affiliated with or endorsed by HandCash.

**HandCash Machine Payments** — HTTP **402** challenges, **HandCash Pay** (payment requests), **Connect.pay**, **receipt JWTs**, **webhook verification**, and a small **Request/Response gate** for paid APIs on **Bitcoin SV** via [`@handcash/sdk`](https://www.npmjs.com/package/@handcash/sdk).

### Why an MPP server — and why now

The **[Machine Payments Protocol](https://mpp.dev/)** (`MPP`) is shaping up as a **global, HTTP-native** way to sell **machine-accessible** resources: unpaid request → **402** + structured challenge → payer settles → **retry** the **same** request with a **receipt** (or credential) → **200** + payload. That is **good DX for agents, automation, and microservices** because the contract is **predictable** (status codes + JSON), not “scrape a checkout page and hope.”

**Stripe** ships the same **402 / challenge / receipt** loop for **machine payments** on their rails (e.g. **shared payment tokens** and cards, or **crypto PaymentIntents** in their docs) — see **[Stripe MPP payments](https://docs.stripe.com/payments/machine/mpp)**. That is useful context: **serious payment infrastructure is converging on MPP-shaped flows**, not one-off paywalls.

**`@handcash/mpp`** applies those **application-level standards** where settlement is **HandCash / BSV** instead: same **challenge + retry + receipt** discipline, with **HandCash Pay**, **Connect.pay**, and **receipt JWTs** wired for your routes. You stay aligned with the **emerging standard** while keeping a **HandCash-native** money path.

**Multi-receiver splits:** `ChargeSpec.receivers` can list **many** payees (platform fee, creators, sellers, etc.) in **one** payment request or Connect pay—HandCash supports **high fan-out** (on the order of **up to 1000 receivers** per transaction). This library forwards your array as-is; confirm current Cloud limits in HandCash’s official docs for production.

**Hosted pay vs Connect:** Same charge model; different **authorization** and **settlement plumbing**—hosted = payer completes **HandCash Pay** (URL/QR) and you usually learn via **webhook**; Connect = **`authToken`** then **`Connect.pay`** and you often get **`transactionId`** inline. Side-by-side table: **ARCHITECTURE.md §4.E** in the doc linked below.

Design and Cloud rules: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

Industry context (402 / MPP meta, Stripe machine payments, positioning): **[STRATEGIC_OVERVIEW.md](./STRATEGIC_OVERVIEW.md)**.

Runnable reference server: **[examples/handcash-mpp-demo/](./examples/handcash-mpp-demo/)** (see [examples/README.md](./examples/README.md)).

## Build

```bash
git clone git@github.com:GenericCPU/handcash-mpp.git
cd handcash-mpp
npm install
npm test
```

**`dist/`** is **committed** so `git+https://…` / Vercel installs resolve the package without running a post-clone build. After changing `src/`, run **`npm run build`** and commit the updated **`dist/`** before pushing.

## TypeScript: SDK `client` types

When you first wire **`issuePaymentRequiredWithHostedPay`** or **`connectPayAndIssueReceipt`**, pass the HandCash **`client`** from **`getInstance({ appId, appSecret }).client`** or **`getAccountClient(authToken)`**. Across **`@handcash/sdk`** and **`@handcash/mpp`** versions, that value’s **TypeScript type** may not **structurally** match the narrow **`client`** type those helpers expect—even though it is correct at runtime.

The **[examples/handcash-mpp-demo](examples/handcash-mpp-demo/)** server uses a small **`as unknown as`** cast to the parameter type in both places (hosted pay and Connect pay). Mirror that pattern from [`examples/handcash-mpp-demo/src/server.ts`](examples/handcash-mpp-demo/src/server.ts) when you add your first **402** route.

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
| **Secrets hygiene** | `assertMinMppSecretLength`, `DEFAULT_MIN_MPP_SECRET_LENGTH` |

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
- **Secrets:** Keep `receiptSecret`, challenge-binding `serverSecret`, and app credentials out of source control; rotate on compromise. Serve webhook endpoints over HTTPS. Prefer **long random** values (e.g. `openssl rand -base64 32`); you can enforce a minimum length at startup with **`assertMinMppSecretLength`** from this package.
- **Demo vs production:** If you start from **`examples/handcash-mpp-demo`**, treat **`POST /demo/complete`** as **local development only** (it simulates a paid webhook). That route is **disabled when `NODE_ENV=production`** unless you set **`ALLOW_DEMO_COMPLETE=1`** (not recommended for real money). Remove or guard any similar shortcuts in your own fork.

See **[SECURITY.md](./SECURITY.md)** for how to report vulnerabilities in this package.

## Dependencies

- **Runtime:** `jose` (HS256 receipts), `@handcash/sdk` (peer).
