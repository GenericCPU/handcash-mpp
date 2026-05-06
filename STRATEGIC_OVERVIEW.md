# Machine payments and HandCash MPP: strategic context

This document describes **what HandCash-oriented machine payments are**, how they sit in the **global shift toward HTTP-native, retry-based paid APIs**, and why **[Stripe’s Machine Payments Protocol (MPP) documentation and tooling](https://docs.stripe.com/payments/machine/mpp)** matters for **positioning** `@handcash/mpp`—not as a footnote, but as **market proof** that the interaction model you are building is aligned with where the industry is heading.

For implementation detail, see [README.md](./README.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. Executive summary

**Machine payments** treat a protected HTTP resource like a vending machine: the client asks for the resource; if unpaid, the server returns **HTTP 402 Payment Required** with a **structured challenge**; the payer (human, app, or agent) **settles** through a payment rail; the client **retries the same request** carrying a **credential or receipt**; the server returns **200** and the payload.

That loop is **protocol-shaped**, not checkout-page-shaped. It is the right contract for **APIs, agents, automation, and microservices**, because status codes and JSON bodies are **machine-parseable**, **cacheable as policy**, and **composable** across intermediaries.

**Stripe’s MPP productization**—documenting the 402 lifecycle, tying it to **[MPP (Machine Payments Protocol)](https://mpp.dev/)**, shipping **[`mppx`](https://www.npmjs.com/package/mppx)** patterns and **shared payment tokens (SPTs)** for cards and wallets, plus a **crypto deposit** path via **PaymentIntents**—is a **market-making** event. It tells operators, startups, and platform teams that **“pay per API call” is a first-class integration style**, not a hack.

**`@handcash/mpp`** is the **same application lifecycle** specialized for **HandCash Cloud on Bitcoin SV (BSV)**: HandCash Pay (hosted payment requests), Connect (programmatic wallet pay), **verified webhooks**, and **cryptographically bound receipt JWTs**. It does **not** compete with Stripe on aggregate card coverage or Stripe’s global acquiring stack. It **wins product–market fit** where the **economic and technical thesis** favors **native BSV settlement**, **HandCash identity and wallets**, **high fan-out splits**, and **HTTP-gated resources** without forcing every payer through traditional card rails.

---

## 2. The bigger picture: three layers

Understanding “where MPP fits” is easier if you separate **three layers** that are often conflated.

### 2.1 Interaction layer (protocol and HTTP semantics)

This is **how** clients and servers negotiate payment **without** embedding a human checkout DOM in the loop.

- **Unpaid access attempt** → **402** + **problem document** (typed JSON, often with a `challengeId` and extensions that name payment methods).
- **Settlement** happens on a rail (card, wallet, chain, etc.), possibly out of band.
- **Retry** of the **original** request with a **credential** (token, receipt, signed header).
- **Success** → **200** + resource, with a **receipt** the client can retain for audit or reuse according to policy.

This layer is **rail-agnostic**. It is what **[mpp.dev](https://mpp.dev/)** describes at the conceptual level and what Stripe’s docs explicitly anchor when they describe **MPP payments**.

### 2.2 Settlement layer (who moves money)

This is **which network or acquirer** actually clears value: Stripe PaymentIntents and SPTs, ACH-style flows elsewhere, **on-chain** transfers, **HandCash Cloud** debits and payment requests, etc.

The settlement layer determines **regulatory footprint**, **currency and corridor**, **latency**, **dispute model**, and **fee structure**. It does **not** replace the interaction layer; it **backs** the challenge described in the 402.

### 2.3 Trust and fulfillment layer (your server)

This is **your** entitlement logic: **binding** challenges to resources, **verifying** webhooks and signatures, **issuing** receipts, **idempotency**, **replay protection**, and **mapping payment IDs to unlocked content**.

**`@handcash/mpp`** concentrates on layers **1** and **3** with adapters into HandCash for layer **2**.

---

## 3. Why the “402 meta” is real—and why Stripe matters

Historically, **HTTP 402** was reserved but underused. Payment on the web collapsed into **redirects to hosted checkouts** and **session cookies** after card entry. That model still dominates human e-commerce—but it **does not compose** cleanly for:

- **Autonomous agents** that need a **deterministic** state machine (try → 402 → pay → retry).
- **API products** priced **per call**, **per byte**, or **per feature flag**.
- **B2B automation** where the payer is another service or workflow engine.

When Stripe publishes **first-party guides** that say: respond with **402**, use **MPP**, retry with **credentials**, attach **receipts**, and wire **PaymentIntents** or **SPTs**, they are doing more than documenting a feature. They are:

1. **Training the ecosystem** that **machine-readable payment negotiation** belongs at the **HTTP layer**.
2. **Lowering coordination cost** between buyers and builders (shared vocabulary: challenge, credential, receipt).
3. **Surfacing agentic commerce** explicitly—e.g. spend flows and **`link-cli`** in their docs—so **AI-mediated purchases** have a **structured**, **bank-grade** path on their rails.

Whether or not every startup adopts Stripe’s stack, **the interaction pattern they champion becomes the default mental model** for “how paid APIs should behave.” That directly benefits **any** implementation—including HandCash—that speaks **402 + structured challenge + retry + receipt**.

---

## 4. What Stripe’s MPP surface emphasizes (significance)

The following points summarize **what Stripe’s public MPP documentation is actually selling and standardizing**, which is useful for comparison and messaging. (Always treat product and availability details as **Stripe’s**; verify in their docs and dashboard for your account.)

### 4.1 Explicit alignment with MPP and `mppx`

Stripe frames **MPP** as the **protocol for internet payments** in this context and shows **server middleware** patterns using **`mppx/server`** (`Mppx.create`, `stripe.charge`, `tempo.charge`, etc.). That **legitimizes** the idea that **middleware** around **402** is a **normal** integration style, not a niche experiment.

### 4.2 Two settlement modes under one interaction model

Stripe’s MPP docs describe:

- **Fiat-oriented machine pay** via **shared payment tokens (SPTs)** and **`PaymentIntent`**, suited to **cards, Link, and broader method support** where enabled.
- **Crypto-oriented machine pay** via **deposit-style crypto PaymentIntents** and on-chain settlement semantics (their docs reference networks such as **Tempo** and stablecoin-oriented flows for machine payments).

Both still adhere to the **same narrative arc**: guard the endpoint, return **402**, complete settlement on their rails, retry with proof, return content **with receipt**.

### 4.3 Problem documents and predictable client behavior

Their examples show **typed JSON** responses (including **`challengeId`**) consistent with **machine parsing**. That reinforces **interop**: agents and SDKs can be taught once how to react to **402**.

### 4.4 Agent-native ergonomics

References to **`link-cli`**, spend requests, and **`mpp pay`** illustrate Stripe’s bet that **credentials** will flow through **agents and CLIs**, not only browsers. That is **direct tailwind** for any vendor pitching **HTTP-native paywalls** to **developer tools and automation**.

### 4.5 Operational caveats as market segmentation

Stripe documents **enablement**, **sandbox vs live**, **preview API versions** for certain crypto flows, and **geographic or eligibility constraints** for businesses and payment methods. Those constraints **segment the market**: large pools of merchants fit Stripe; others need **different settlement**, **different jurisdictions**, or **different economics**—opening space for alternatives.

---

## 5. What `@handcash/mpp` is, precisely

**`@handcash/mpp`** is an **open-source TypeScript library** that implements **HandCash-flavored machine payments**:

| Concern | What the package provides |
|--------|---------------------------|
| **402 responses** | Helpers to build **problem payment required** bodies and `Response` objects. |
| **Challenges** | `challengeId` generation and **HMAC binding** of challenges to **resource identity** (method/path). |
| **Hosted HandCash Pay** | Creation of **payment requests** via HandCash Cloud (**`POST /v3/paymentRequests/`**) and normalization of checkout URLs. |
| **Connect** | **`Connect.pay`** adapter for wallet-authorized spends using the official **`@handcash/sdk`**. |
| **Receipts** | **JWT-based receipts** (HS256 via `jose`) verifying entitlement to retry the **same** resource. |
| **HTTP gate** | Middleware-style helpers to **read** receipt headers, **evaluate** gates, and **run** paid handlers. |
| **Webhooks** | **Verification** helpers for payment-request completion payloads using your **app secret**. |
| **Money modeling** | **`ChargeSpec`** with **USD-priced** receivers, **BSV vs MNEE** instrument rules matching Cloud validators, and **multi-receiver splits** forwarded faithfully to Cloud. |

It is **intentionally not** a second payment network client for cards or Stripe. Its **system boundary** for value movement is **HandCash Cloud** (see ARCHITECTURE principles: *HandCash SDK is the only BSV rail*).

---

## 6. Same lifecycle, different settlement: mapping HandCash to the abstract MPP arc

For positioning conversations, map terms like this:

| Abstract MPP-style phase | HandCash MPP realization |
|--------------------------|---------------------------|
| Guard resource | Your route calls **`evaluateMachinePaymentGate`** / **`runMachinePaidHandler`** or **`issuePaymentRequiredWithHostedPay`**. |
| **402** + challenge | **`paymentRequiredResponse`** + **`createChallengeId`** + **`hmacBindChallenge`** + **`handcash`** extension (`hosted_pay` or `connect`). |
| Present payment instructions | **Hosted:** `paymentRequestUrl` / QR from Cloud. **Connect:** client obtains **`authToken`**, server calls **`Connect.pay`**. |
| Settlement | **HandCash Cloud** clears **BSV** or **MNEE** instrument flows per your **`ChargeSpec`**. |
| Proof / retry | Client retries with **`x-handcash-receipt`** or **`Authorization: Bearer`** carrying **`issueReceiptJwt`** output (after webhook or inline Connect success). |
| Fulfillment | Handler returns **200** + resource; optional replay guard via **`MemoryJwtReplayGuard`** or shared store. |

This mapping makes clear that **`@handcash/mpp` is not “an alternative philosophy”** to MPP—it is a **specialization of the same lifecycle** onto **HandCash’s** payment and identity stack.

---

## 7. Compare and contrast: Stripe’s MPP vs HandCash MPP (for product–market fit)

The goal here is **not** to minimize Stripe. It is to **sharpen** where **HandCash + `@handcash/mpp`** wins **for builders who have already bought into the 402 meta** but **do not fit** or **do not want** Stripe’s settlement layer for a given product.

### 7.1 What Stripe optimizes for

- **Unified commercial story** across **cards, wallets, and crypto machine pay** under one brand and dashboard.
- **Agentic commerce** investment (**SPTs**, profiles, **`mppx`**, CLI flows) aimed at **mass-market** developers and **US-forward** merchant enablement.
- **Ecosystem gravity**: documentation depth, samples, compliance framing, and **payment method breadth** where available.

**Implication:** For a **default** “add machine payments to my Node endpoint” pitch in **traditional merchant markets**, Stripe will often be the **baseline** comparison. That is **good**: it means **your category is real**.

### 7.2 What HandCash MPP optimizes for

- **Native BSV economics and HandCash wallets**—settlement through **HandCash Cloud** rather than Stripe’s acquiring and PaymentIntent lifecycle.
- **High fan-out splits** in **one** payment request or Connect debit (HandCash-oriented marketplace and royalty shapes); the package **forwards** receiver arrays and documents Cloud-side rules (see ARCHITECTURE).
- **Two fulfillment modes** that map to **real HandCash UX**: **cold-start hosted pay** vs **repeat / in-session Connect**.
- **Receipt and binding model** you **control** on your server (JWT binding to **resource + challenge**), aligned with **MPP-style retry** without depending on Stripe’s credential types.

**Implication:** HandCash MPP is **strongest** when the **product thesis** is already **BSV / HandCash**, or when **fee structure, speed, splits, or wallet graph** outperform card rails **for that niche**. The **402 interaction** is how you **join the same conversational table** as Stripe MPP **without** pretending to replicate their **global card graph**.

### 7.3 Nuance table (high level)

| Dimension | Stripe MPP (as publicly documented) | `@handcash/mpp` |
|-----------|-------------------------------------|------------------|
| **Primary settlement** | Stripe rails: **SPT + PaymentIntent**, **crypto deposit PaymentIntents**, etc. | **HandCash Cloud** (payment requests + Connect pay) |
| **Payer UX anchors** | Link, cards, crypto deposit flows per their guides | HandCash Pay URLs/QR; Connect-authorized spends |
| **402 / challenge / retry** | First-class in docs and **`mppx`** patterns | First-class via this package’s HTTP helpers + receipts |
| **Agent tooling** | **`link-cli`**, **`mpp pay`**, SPT spend requests | Any HTTP client; demo includes **agent-style** HTTP scripts; receipts are **standard JWT headers** |
| **Geography / eligibility** | Documented Stripe and method constraints | **Your** HandCash and BSV footprint; not Substitute for Stripe’s US-oriented enablement tables |
| **Where comparisons flatter HandCash** | Niche BSV apps, HandCash-first games/marketplaces, **split-heavy** payouts, **HTTP-gated** resources for **already-crypto** audiences | Same |
| **Where comparisons flatter Stripe** | Broad **card** acceptance, **mainstream** merchant services, **unified** fiat + regulated stablecoin/crypto product bundling | Honest positioning: **not** a card acquirer |

Use this table in **sales and technical** conversations: acknowledge Stripe’s **category creation**, then **narrow** to the **HandCash-shaped wedge**.

---

## 8. Messaging: owning the wedge without fighting the wrong war

### 8.1 Lead with the shared meta

- **“Machine payments are becoming HTTP-native: 402, challenge, pay, retry, receipt.”**
- **“Stripe just made that mainstream for their rails—we implement the **same lifecycle** for **HandCash / BSV**.”**

That framing **borrows legitimacy** instead of debating it.

### 8.2 Then differentiate on settlement and community

- **HandCash-native money movement** (payment requests + Connect).
- **Splits and fan-out** as a **first-class** merchant story.
- **Open-source gateway** you can embed in **your** API boundary (see SECURITY and production notes in README).

### 8.3 Avoid strawman arguments

Claiming “we replace Stripe” globally is **not** credible and **weakens** trust. Claiming “we give **HandCash builders** the **same architectural runway** Stripe opened for **their** merchants” **is** credible and **specific**.

---

## 9. Strategic implications (holistic)

1. **Category tailwind:** Stripe MPP increases **budget and attention** for **402-shaped APIs**. `@handcash/mpp` should be positioned as **the fastest honest path** for **HandCash-backed** implementations—not as a rejection of MPP.

2. **Education ROI:** Explain **MPP interaction** once; explain **HandCash settlement** once. Your docs already separate **lifecycle** from **instruments** (BSV vs MNEE); keep that separation in **external** narratives too.

3. **Partnerships:** Anything that teaches agents “handle **402**” (CLI tools, proxies, gateways) is **alignment**. Prefer **interop at the HTTP layer** over bespoke SDK lock-in.

4. **Risk clarity:** Machine payments shift **fraud and abuse** patterns toward **automated** probing. Double down on **webhook verification**, **idempotency**, and **replay guards**—areas this package surfaces explicitly.

---

## 10. References (external)

- [Machine Payments Protocol (mpp.dev)](https://mpp.dev/)
- [Stripe: MPP payments](https://docs.stripe.com/payments/machine/mpp)
- [Stripe: Shared payment tokens (concept)](https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens.md)
- HandCash Cloud / SDK documentation (official HandCash properties)
- This repository: [README.md](./README.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md)

---

*This document explains positioning and industry context for the `@handcash/mpp` package. Payment products involve regulation, geography, and contractual terms; treat operational decisions as requiring your own legal and compliance review.*
