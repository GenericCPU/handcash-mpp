# HandCash MPP demo

> **Note:** This is an unofficial, open-source demo project and is not affiliated with or endorsed by HandCash.

Small runnable app (lives under **`examples/`** in this repo) that shows **`@handcash/mpp`** end to end:

1. **`GET /api/premium`** — returns **402** + HandCash Pay artifact (or **200** with a valid **`x-handcash-receipt`** JWT). The gate uses **`MemoryJwtReplayGuard`** (replay TTL in code).
2. **`POST /webhooks/payment`** — HandCash Cloud calls this after **hosted** payment; the demo verifies **`appSecret`** and mints the receipt JWT.
3. **`GET /api/receipt?paymentRequestId=…`** — poll until the receipt is ready (**hosted** path).
4. **`GET /api/connect-auth-url`** — JSON with HandCash Connect authorization URL (popup flow).
5. **`POST /api/connect-pay`** — body `{ "authToken", "challengeId" }`; runs **`connectPayAndIssueReceipt`** and returns **`receiptJwt`** (no webhook for that path).
6. **`GET /connect/callback`** — Connect redirect target; **`postMessage`** to the opener with **`authToken`** (popup flow).
7. **`POST /demo/complete`** — local-only substitute when HandCash cannot reach your laptop (see below).

Open **http://localhost:3456/** and use the on-page flow. Prefer **either** hosted pay **or** Connect for a given 402 — completing both pays twice.

## Setup

Keep secrets in **`.env`** only (gitignored). Commit **`.env.example`** updates without real credentials.

```bash
cd handcash-mpp/examples/handcash-mpp-demo
cp .env.example .env
# Edit .env — required: HANDCASH_APP_ID, HANDCASH_APP_SECRET, DEMO_RECEIVER_HANDLE,
# MPP_RECEIPT_SECRET, MPP_SERVER_SECRET, DEMO_COMPLETE_SECRET
npm install
npm start
```

## Environment

| Variable | Purpose |
|----------|---------|
| `HANDCASH_APP_ID` / `HANDCASH_APP_SECRET` | Connect app credentials |
| `DEMO_RECEIVER_HANDLE` | Handle that receives the **$0.05 USD** demo payment |
| `MPP_RECEIPT_SECRET` | HS256 secret for receipt JWTs (long random string) |
| `MPP_SERVER_SECRET` | HMAC secret for challenge binding in 402 body |
| `PUBLIC_BASE_URL` | Must be reachable by HandCash for webhooks (e.g. ngrok URL + path base). Defaults to `http://localhost:3456` (won’t work for real webhooks unless tunneled). |
| `PAY_REDIRECT_URL` | Optional. Where HandCash redirects the browser after **hosted** pay (default `{PUBLIC_BASE_URL}/mpp/return`). Use your tunnel URL in dev when redirects are allowlisted. |
| `CONNECT_CALLBACK_URL` | Optional. Where the browser lands after **Connect** authorization (default `{PUBLIC_BASE_URL}/connect/callback`). Must match the authorization success URL in the HandCash dashboard. For Connect.pay, the Connect app needs the **Payment** permission. |
| `DEMO_COMPLETE_SECRET` | Header `x-demo-complete-secret` for **`POST /demo/complete`** |
| `PORT` | HTTP port (default `3456`) |

## Local webhook workaround

If you do **not** expose `PUBLIC_BASE_URL` to the internet, complete **hosted** payment in HandCash, copy **`paymentRequestId`** from the 402 JSON, then:

```bash
curl -s -X POST "http://localhost:3456/demo/complete" \
  -H "Content-Type: application/json" \
  -H "x-demo-complete-secret: YOUR_DEMO_COMPLETE_SECRET" \
  -d '{"paymentRequestId":"PASTE_ID_HERE"}'
```

Then poll **`/api/receipt`** and retry **`/api/premium`** with the receipt header.

## Dependency

This demo depends on **`@handcash/mpp`** via **`file:../..`** (the package root of this repository). To run against a published version instead, replace that entry in `package.json`, for example:

`"@handcash/mpp": "github:GenericCPU/handcash-mpp#main"`
