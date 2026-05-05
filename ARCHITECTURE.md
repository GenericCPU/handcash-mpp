# HandCash Machine Payments — Architecture

This document describes the architecture for delivering **machine-native payments** (HTTP 402 → pay → retry → receipt) on **Bitcoin SV** using the HandCash ecosystem.

## 0. External references (open source & specs)

| Artifact | Role |
|----------|------|
| [Machine Payments Protocol](https://mpp.dev/) | Public protocol: challenges, credentials, receipts. Serves as inspiration for the architecture, though not a strict dependency. |

## 1. Design principles

1. **One lifecycle, two fulfillment strategies** — Every paid resource follows the same state machine; only the **settlement adapter** changes.
2. **HandCash SDK is the only BSV rail** — No parallel invented ledger APIs. `@handcash/sdk` is the system boundary to HandCash Cloud.
3. **Connect vs HandCash Pay is a routing decision, not two products** — Same merchant-facing “charge”; different **credential** and **UX** path.
4. **Lean gateway, fat cloud** — Cryptographic binding, idempotency keys, and replay safety live in **this package + your service**; money movement policy stays in **HandCash Cloud** (Connect, payment requests, webhooks).
5. **Focused scope** — This package targets HandCash integration only; it does not implement card rails or other payment networks.

## 2. Layer model

```
┌─────────────────────────────────────────────────────────────┐
│  Merchant API (your routes)                                  │
│  attachMachinePayment({ secret, fulfill, ... })              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  handcash-mpp (this package)                                 │
│  • HTTP 402 problem documents                                 │
│  • Challenge IDs + HMAC binding                               │
│  • Idempotency + receipt envelope types                       │
│  • Fulfillment orchestration (pure + side-effect adapters)    │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌───────────────┐                     ┌──────────────────────┐
│ Connect.pay   │                     │ POST /v3/paymentRequests/ │
│ (authToken)   │                     │ → HandCash Pay URL │
└───────────────┘                     └──────────────────────┘
        │                                       │
        └───────────────────┬───────────────────┘
                            ▼
                  HandCash Cloud (BSV)
```

## 3. State machine (canonical)

States are **logical**; persist only what your application needs.

| State | Meaning |
|-------|---------|
| `UNPAID` | Resource not entitled; first `GET`/`POST` without payment → **402** + challenge. |
| `PENDING` | Challenge issued; awaiting settlement (user in HandCash Pay tab, or Connect tx in flight). |
| `SETTLED` | Payment confirmed (webhook, poll, or synchronous Connect result). |
| `ENTITLED` | Retry with valid **receipt credential** succeeds; handler returns 200 + resource. |

**Transitions**

- `UNPAID` → `PENDING`: merchant issues challenge (optionally creates **payment request** for hosted path).
- `PENDING` → `SETTLED`: Cloud notifies (webhook) or Connect returns success.
- `SETTLED` → `ENTITLED`: server attaches **receipt** (signed cookie/header/JWT) bound to `challengeId` + resource path.

## 4. Fulfillment strategies

### 4.A — **Connect** (programmatic wallet)

- **When:** Caller already has **HandCash Connect** `authToken` (user or agent delegated).
- **Mechanism:** `Connect.pay` with receivers and amounts — same as instant payments in the SDK; use **`denominationCurrencyCode: 'USD'`** here to match this package’s pricing rule.
- **Mental model:** A follow-up call carries **spend authority** already delegated to your app via the wallet provider’s session (HandCash Connect `authToken`), rather than card PAN entry on each charge.

### 4.B — **HandCash Pay** (hosted)

- **When:** No `authToken`; need **hosted checkout** (human, cold start, QR, agent opens browser).
- **Mechanism:** HandCash Cloud **`POST /v3/paymentRequests/`** (app client) → `paymentRequestUrl` / QR; optional **webhook** on the payment request ties settlement back to `challengeId`.
- **Mental model:** A **hosted payer URL** (browser redirect or QR) returned inside the **402** response so humans or agents can complete payment out of band, then your server learns completion via webhook or polling.

### 4.C — **Multi-receiver (split) payments**

- **Model:** `ChargeSpec.receivers` is an array of `{ destination, sendAmount }` in **USD** (subject to the BSV vs MNEE rules in §4.D).
- **HandCash Cloud:** One **payment request** or **Connect.pay** can split a single payer flow across **many** destinations in one settlement. High fan-out (on the order of **up to 1000 receivers** per transaction) is a supported HandCash pattern for royalties, marketplaces, and similar splits—confirm the exact current cap and any tier rules in **official HandCash / API documentation** before you rely on the maximum in production.
- **This package:** Forwards your `receivers` through **`buildCreatePaymentRequestBodyFromCharge`** and **`buildConnectPayBodyFromCharge`** without imposing a smaller limit. You still own **sum checks**, **destination validation**, and **product policy** in your gateway.

### 4.D — **BSV vs MNEE** (Cloud contracts — read before calling the SDK)

HandCash exposes **two** on-chain instruments as `instrumentCurrencyCode`: **`BSV`** and **`MNEE`**. The OpenAPI types look symmetric, but **HandCash Cloud validators and use cases are not**. Internally the MNEE instrument is modeled as a **BSV21 USD token** while still advertising the code **`MNEE`** to apps (`instrumentRepository`, `instrumentCurrencyCodes`).

**Product rule in this package:** **all pricing is expressed in USD** (`receivers[].sendAmount` as a dollar amount). The merchant only selects the **base instrument** (BSV vs MNEE). That gives one mental model across rails (including **§4.C** multi-receiver splits).

| Surface | `instrumentCurrencyCode: 'BSV'` | `instrumentCurrencyCode: 'MNEE'` |
|--------|-----------------------------------|-------------------------------------|
| **`denominationCurrencyCode` on payment requests** | This package **always** sends **`USD`** so Cloud treats `sendAmount` as a **USD quote**. | **Forbidden** by Cloud — field is **omitted**. The same **USD price** numeric is sent as the **MNEE** amount (appropriate for USD-pegged MNEE; convert upstream if your pricing differs). |
| **`denominationCurrencyCode` on `Connect.pay`** | Use **`USD`** with the same `sendAmount` semantics when you implement Connect (validator requires a denomination for BSV). | **Forbidden** — pass MNEE-side amounts per Cloud; keep **USD-priced** values in your app layer and convert if needed. |
| **Paymail receivers (`destination` contains `@`)** | Allowed (BSV path). | **Rejected** for instrument sends — use **handle** or **P2PKH address** only. |

This package encodes the payment-request half via **`buildCreatePaymentRequestBodyFromCharge`** (always `USD` for BSV; omits denomination for MNEE) and exposes **`assertMneeReceiversHaveNoPaymail`** for the Connect paymail rule. When you add the Connect adapter, call the assertion before `Connect.pay` for MNEE.

### 4.E — **HandCash Pay (hosted) vs Connect — comparison**

Same **`ChargeSpec`** (including **§4.C** multi-receiver splits) can back **either** path. The difference is **who authorizes spend** and **how your server learns the money moved**.

| | **HandCash Pay (hosted)** | **Connect (`Connect.pay`)** |
|--|---------------------------|------------------------------|
| **Credential on pay** | None from the payer to your API beyond opening the **hosted** URL / QR. Your server uses **app** credentials only to **create** the payment request. | Payer (or agent) must have completed **Connect**; your server holds an **`authToken`** for that identity when calling **`Connect.pay`**. |
| **Payer UX** | Browser redirect, QR, or handoff—good for **cold start**, guests, or devices where Connect is not set up. | Popup / redirect to **authorize the wallet**, then programmatic pay—good for **signed-in** users and **repeat** purchases. |
| **How settlement reaches you** | Typically **asynchronous**: **webhook** (and/or client return URL + **polling**). You verify the webhook and then **`issueReceiptJwt`**. | Often **synchronous**: **`connectPayAndIssueReceipt`** returns **`transactionId`** and receipt in the **same** server round-trip (still persist idempotently). |
| **Infra you expose** | **`webhookUrl`** must be reachable by HandCash Cloud (or you use a dev-only substitute). **`redirectUrl`** may need allowlisting in the dashboard. | **Connect callback** URL for OAuth-style return; protect **`authToken`** in transit and at rest; least-privilege **Connect app** permissions. |
| **Who “pushes” the payment** | The **payer** completes checkout on HandCash’s hosted surface. | Your **server** calls **`Connect.pay`** with the user’s delegated authority (after they’ve connected). |
| **Splits / fan-out** | Full **`receivers[]`** on the payment request. | Full **`receivers[]`** on Connect pay (same MNEE paymail rules as **§4.D**). |
| **Trade-off summary** | Less integration for the payer (no Connect app install/session), more **async** plumbing on your side (webhooks, retries, idempotency). | Smoother **in-app** or **API** debit once connected; you must **safely handle** session tokens and session lifecycle. |

**Product rule:** For a **single** `challengeId`, pick **one** fulfillment path per business transaction—completing **both** hosted pay and Connect pay for the same challenge means **paying twice** unless your product explicitly models that.

## 5. HTTP surface

- **402** + `Content-Type: application/json` body following the **problem payment required** pattern (referencing the MPP docs for field names such as `challengeId`).
- **Extensions object** `handcash` (vendor namespace): `{ fulfillment: 'connect' | 'hosted_pay', paymentRequestUrl?: string, paymentRequestId?: string }` so clients know how to proceed without scraping HTML.

## 6. Security (non-negotiable)

- **Challenge secret:** HMAC-SHA256 binds `challengeId` + canonical resource identity; receipt JWT or header must verify with the same secret.
- **Idempotency:** Creation of payment requests and Connect debits must carry **idempotency keys** (your gateway generates; pass through to Cloud where supported).
- **Replay:** Receipts are **single-use** or short TTL per `challengeId`.

## 7. Package layout (`handcash-mpp`)

| Path | Responsibility |
|------|----------------|
| `src/domain/*` | Types + lifecycle enums — no I/O. |
| `src/domain/instruments.ts` | BSV/MNEE + **USD** pricing; **Cloud-correct** payment-request + Connect bodies; MNEE paymail guard. |
| `src/crypto/binding.ts` | Challenge IDs + HMAC binding. |
| `src/http/payment-required.ts` | 402 JSON + `Response` helpers (Web Fetch API). |
| `src/http/gate.ts` | Receipt JWT verification + optional replay guard + `runMachinePaidHandler`. |
| `src/adapters/hosted-pay.ts` | **Real** `POST /v3/paymentRequests/` via the app-scoped Hey API client. |
| `src/adapters/payment-request-url.ts` | Normalizes legacy `pay.handcash.io/{id}` URLs to `handcash.io/payment-request/{id}?sid=…` for hosted checkout. |
| `src/adapters/connect-pay.ts` | **Real** `Connect.pay`. |
| `src/receipts/jwt.ts` | HS256 receipt JWT (`jose`). |
| `src/receipts/replay-guard.ts` | In-process `jti` replay window. |
| `src/webhooks/payment-request.ts` | Payment-request completion body + **`appSecret`** verification. |
| `src/idempotency/memory-store.ts` | In-process idempotency helper. |
| `src/orchestrate/*` | Opinionated one-shots (402+hosted pay, Connect+receipt). |
| `src/index.ts` | Public exports. |

---

*This architecture is intentionally small: **precision over surface area**. Every new file must justify itself against section 1.*
