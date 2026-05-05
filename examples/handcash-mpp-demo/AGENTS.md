# Agent notes (Cursor / automation)

The demo must be running (`npm start` in this directory). Default base URL is `http://localhost:3456`; override with **`MPP_DEMO_URL`**.

## Fetch the 402 challenge (one shot, stdout = JSON)

Use this when you only need machine-readable payment instructions (no waiting for webhooks).

```bash
MPP_DEMO_URL=http://localhost:3456 npm run agent:challenge
```

Stdout is the full **402** body (`challengeId`, `handcash.paymentRequestUrl`, `payAmountUsd`, etc.). Errors go to stderr; exit `1` if not 402.

## Fetch unlocked premium data (one shot, needs receipt JWT)

After payment (or `POST /demo/complete`), you have a **`receiptJwt`**. Then:

```bash
MPP_DEMO_URL=http://localhost:3456 MPP_RECEIPT_JWT='<paste-jwt>' npm run agent:premium
```

Or:

```bash
npm run agent:premium -- --receipt '<paste-jwt>'
```

Stdout is the **200** JSON from `GET /api/premium`. Exit non-zero if missing JWT or not 200.

## Full interactive loop (human pays in browser, agent polls)

```bash
npm run agent
```

Polls `/api/receipt` until the webhook fires (requires **`PUBLIC_BASE_URL`** reachable by HandCash, or use **`POST /demo/complete`** locally).

## Curl equivalents (no Node)

Challenge:

```bash
curl -sS -D - http://localhost:3456/api/premium -H 'Accept: application/json' | tail -n +1
```

Premium with receipt:

```bash
curl -sS http://localhost:3456/api/premium -H 'Accept: application/json' -H 'x-handcash-receipt: <jwt>'
```
