# HandCash MPP demo

> **Note:** This is an unofficial, open-source demo project and is not affiliated with or endorsed by HandCash.

Small runnable app (lives under **`examples/`** in this repo) that shows **`@handcash/mpp`** end to end. The browser UI is static assets in **`public/`** (`index.html`, `demo.js`, `demo.css`); **`src/server.ts`** is mostly JSON routes and webhooks.

1. **`GET /`** — demo page (static HTML + JS).
2. **`GET /api/premium`** — returns **402** + HandCash Pay artifact (or **200** with a valid **`x-handcash-receipt`** JWT). The gate uses **`MemoryJwtReplayGuard`** (replay TTL in code).
3. **`POST /webhooks/payment`** — HandCash Cloud calls this after **hosted** payment; the demo verifies **`appSecret`** and mints the receipt JWT.
4. **`GET /api/receipt?paymentRequestId=…`** — poll until the receipt is ready (**hosted** path).
5. **`GET /api/connect-auth-url`** — JSON with HandCash Connect authorization URL (popup flow).
6. **`POST /api/connect-pay`** — body `{ "authToken", "challengeId" }`; runs **`connectPayAndIssueReceipt`** and returns **`receiptJwt`** (no webhook for that path).
7. **`GET /connect/callback`** — Connect redirect target; **`postMessage`** to the opener with **`authToken`** (popup flow).
8. **`POST /demo/complete`** — local-only substitute when HandCash cannot reach your laptop (see below). **Disabled when `NODE_ENV=production`** unless you set **`ALLOW_DEMO_COMPLETE=1`** (unsafe for real money; do not enable on public hosts).

Open **http://localhost:3456/** and use the on-page flow. Prefer **either** hosted pay **or** Connect for a given 402 — completing both pays twice.

## Setup

Keep secrets in **`.env`** only (gitignored). Commit **`.env.example`** updates without real credentials.

```bash
cd handcash-mpp/examples/handcash-mpp-demo
cp .env.example .env
# Edit .env — see .env.example (required vs optional). Set DEMO_COMPLETE_SECRET if you use POST /demo/complete locally.
npm install
npm start
```

**Headless agent:** see **[AGENTS.md](./AGENTS.md)**. `npm run agent` waits for payment + webhook; `npm run agent:challenge` dumps the **402** JSON once (good for Cursor); `npm run agent:premium` with **`MPP_RECEIPT_JWT`** dumps the unlocked **200** JSON once.

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
| `NODE_ENV` | Set to **`production`** only for hardened deploys; see **`ALLOW_DEMO_COMPLETE`** below. |
| `ALLOW_DEMO_COMPLETE` | Set to **`1`** to re-enable **`POST /demo/complete`** under **`NODE_ENV=production`** (discouraged). |
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
