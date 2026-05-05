import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Connect, getInstance } from "@handcash/sdk";
import {
  connectPayAndIssueReceipt,
  evaluateMachinePaymentGate,
  issuePaymentRequiredWithHostedPay,
  issueReceiptJwt,
  MemoryJwtReplayGuard,
  verifyPaymentRequestCompletedWebhook,
  type PaymentRequestCompletedWebhookBody,
} from "@handcash/mpp";
import { config } from "./config.js";
import {
  challengeIdToHostedPaymentRequestId,
  clearPendingForChallenge,
  pendingByPaymentRequestId,
  pendingConnectByChallengeId,
  receiptJwtByPaymentRequestId,
} from "./state.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HC_PAY_MARK_PNG = readFileSync(join(__dirname, "../public/hc-pay-mark.png"));

const PREMIUM_RESOURCE = { method: "GET", path: "/api/premium" } as const;

const sdk = getInstance({
  appId: config.appId,
  appSecret: config.appSecret,
});

const DEMO_USD_PRICE = 0.05;

/** Single in-process replay guard for receipt JWTs (see {@link MemoryJwtReplayGuard} in `@handcash/mpp`). */
const receiptReplayGuard = new MemoryJwtReplayGuard();

function demoCharge() {
  return {
    instrumentCurrencyCode: "BSV" as const,
    receivers: [{ destination: config.receiverHandle, sendAmount: DEMO_USD_PRICE }],
    product: {
      name: "HandCash MPP demo",
      description: `Machine payment demo (${DEMO_USD_PRICE} USD)`,
    },
  };
}

function handleHcPayMark(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=86400",
  });
  res.end(HC_PAY_MARK_PNG);
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function nodeRequestToWebRequest(req: IncomingMessage, url: URL): Request {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const x of v) headers.append(k, x);
    else headers.set(k, v);
  }
  return new Request(url, { method: req.method ?? "GET", headers });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function issueReceiptForPayment(
  paymentRequestId: string,
  body: PaymentRequestCompletedWebhookBody,
): Promise<void> {
  const pending = pendingByPaymentRequestId.get(paymentRequestId);
  if (!pending) return;

  const jwt = await issueReceiptJwt(
    config.receiptSecret,
    {
      challengeId: pending.challengeId,
      resourceMethod: pending.resource.method,
      resourcePath: pending.resource.path,
      transactionId: body.transactionId,
      paymentRequestId,
    },
    3600,
  );

  receiptJwtByPaymentRequestId.set(paymentRequestId, jwt);
  clearPendingForChallenge(pending.challengeId);
}

async function handlePremium(req: IncomingMessage, res: ServerResponse) {
  const host = req.headers.host ?? `localhost:${config.port}`;
  const url = new URL(req.url ?? "/", `http://${host}`);

  const gate = await evaluateMachinePaymentGate(nodeRequestToWebRequest(req, url), {
    receiptSecret: config.receiptSecret,
    resource: PREMIUM_RESOURCE,
    replayGuard: receiptReplayGuard,
    replayTtlMs: 120_000,
  });

  if (gate.ok) {
    json(res, 200, {
      ok: true,
      message: "Premium data unlocked",
      challengeId: gate.receipt.challengeId,
      transactionId: gate.receipt.transactionId ?? null,
    });
    return;
  }

  if (gate.reason !== "missing_token") {
    json(res, 401, { error: gate.reason });
    return;
  }

  const webhookUrl = `${config.publicBaseUrl}/webhooks/payment`;

  type IssueInput = Parameters<typeof issuePaymentRequiredWithHostedPay>[0];
  const issued = await issuePaymentRequiredWithHostedPay({
    client: sdk.client as unknown as IssueInput["client"],
    serverSecret: config.serverSecret,
    resource: PREMIUM_RESOURCE,
    charge: demoCharge(),
    webhookUrl,
    redirectUrl: config.payRedirectUrl,
  });

  if ("error" in issued) {
    json(res, 500, { ok: false, error: issued.error });
    return;
  }

  const raw = await issued.response.clone().text();
  let parsed: { handcash?: { paymentRequestId?: string } };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    json(res, 500, { ok: false, error: "Invalid 402 body" });
    return;
  }

  const paymentRequestId = parsed.handcash?.paymentRequestId;
  if (!paymentRequestId) {
    json(res, 500, { ok: false, error: "Missing paymentRequestId in challenge" });
    return;
  }

  pendingByPaymentRequestId.set(paymentRequestId, {
    challengeId: issued.challengeId,
    resource: PREMIUM_RESOURCE,
  });
  pendingConnectByChallengeId.set(issued.challengeId, { resource: PREMIUM_RESOURCE });
  challengeIdToHostedPaymentRequestId.set(issued.challengeId, paymentRequestId);

  const enriched402 = {
    ...parsed,
    payAmountUsd: DEMO_USD_PRICE,
    payAmountCurrency: "USD",
  };
  res.writeHead(402, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(enriched402));
}

async function handleWebhook(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  const raw = await readBody(req);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    res.writeHead(400).end("invalid json");
    return;
  }

  if (!verifyPaymentRequestCompletedWebhook(config.appSecret, body)) {
    res.writeHead(401).end("unauthorized");
    return;
  }

  const b = body as PaymentRequestCompletedWebhookBody;
  await issueReceiptForPayment(b.paymentRequestId, b);
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ok");
}

async function handleDemoComplete(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  const secret = req.headers["x-demo-complete-secret"];
  if (!config.demoCompleteSecret || secret !== config.demoCompleteSecret) {
    res.writeHead(401).end("set DEMO_COMPLETE_SECRET and matching x-demo-complete-secret header");
    return;
  }
  const raw = await readBody(req);
  let body: { paymentRequestId?: string };
  try {
    body = JSON.parse(raw) as { paymentRequestId?: string };
  } catch {
    res.writeHead(400).end("invalid json");
    return;
  }
  const pid = body.paymentRequestId?.trim();
  if (!pid) {
    res.writeHead(400).end("paymentRequestId required");
    return;
  }
  if (!pendingByPaymentRequestId.has(pid)) {
    res.writeHead(404).end("no pending payment for this id");
    return;
  }

  await issueReceiptForPayment(pid, {
    appSecret: config.appSecret,
    paymentRequestId: pid,
    paymentMethod: "demo",
    transactionId: `demo_tx_${Date.now()}`,
  });

  json(res, 200, { ok: true, paymentRequestId: pid });
}

function handleConnectAuthUrl(_req: IncomingMessage, res: ServerResponse) {
  const url = sdk.getRedirectionUrl({
    redirectionUrl: config.connectCallbackUrl,
  });
  json(res, 200, { url });
}

async function handleConnectProfile(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  const raw = await readBody(req);
  let body: { authToken?: string };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    json(res, 400, { error: "invalid json" });
    return;
  }
  const authToken = typeof body.authToken === "string" ? body.authToken.trim() : "";
  if (!authToken) {
    json(res, 400, { error: "authToken required" });
    return;
  }
  type ProfileOpts = NonNullable<Parameters<typeof Connect.getCurrentUserProfile>[0]>;
  const { data, error } = await Connect.getCurrentUserProfile({
    client: sdk.getAccountClient(authToken) as ProfileOpts["client"],
  });
  if (error) {
    const msg =
      typeof error === "object" && error !== null && "message" in error && typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Connect profile request failed";
    json(res, 400, { error: msg });
    return;
  }
  const handle = data?.publicProfile?.handle;
  if (!handle) {
    json(res, 502, { error: "No handle in profile response" });
    return;
  }
  json(res, 200, {
    handle,
    displayName: data?.publicProfile?.displayName ?? null,
  });
}

async function handleConnectPay(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  const raw = await readBody(req);
  let body: { authToken?: string; challengeId?: string };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    json(res, 400, { error: "invalid json" });
    return;
  }
  const authToken = typeof body.authToken === "string" ? body.authToken.trim() : "";
  const challengeId = typeof body.challengeId === "string" ? body.challengeId.trim() : "";
  if (!authToken || !challengeId) {
    json(res, 400, { error: "authToken and challengeId are required" });
    return;
  }
  if (!pendingConnectByChallengeId.has(challengeId)) {
    json(res, 404, {
      error:
        "No pending challenge for this challengeId. GET /api/premium first (402), then call Connect.pay before the challenge is cleared by hosted pay or another path.",
    });
    return;
  }
  const { resource } = pendingConnectByChallengeId.get(challengeId)!;
  const accountClient = sdk.getAccountClient(authToken);
  type PayClient = Parameters<typeof connectPayAndIssueReceipt>[0]["client"];
  const result = await connectPayAndIssueReceipt({
    client: accountClient as unknown as PayClient,
    charge: demoCharge(),
    receiptSecret: config.receiptSecret,
    resource,
    challengeId,
    receiptTtlSeconds: 3600,
  });
  if ("error" in result) {
    json(res, 400, { ok: false, error: result.error });
    return;
  }
  clearPendingForChallenge(challengeId);
  json(res, 200, {
    ok: true,
    receiptJwt: result.receiptJwt,
    transactionId: result.transactionId,
    fulfillment: "connect",
  });
}

function handleConnectCallback(req: IncomingMessage, res: ServerResponse) {
  const host = req.headers.host ?? `localhost:${config.port}`;
  const url = new URL(req.url ?? "/", `http://${host}`);
  const authToken = url.searchParams.get("authToken")?.trim() ?? "";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HandCash Connect</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f1419; color: #e7ecf3; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1rem; text-align: center; }
    p { margin: 0.5rem 0; max-width: 22rem; line-height: 1.5; }
    .err { color: #f87171; }
  </style>
</head>
<body>
  <div>
    <p><strong>Returning to the demo…</strong></p>
    <p id="hint"></p>
  </div>
  <script>
    (function () {
      var token = ${JSON.stringify(authToken)};
      var origin = window.location.origin;
      var hint = document.getElementById("hint");
      if (!token) {
        hint.className = "err";
        hint.textContent = "Missing authToken. Set CONNECT_CALLBACK_URL / PUBLIC_BASE_URL to this URL in the HandCash dashboard and complete authorization again.";
        return;
      }
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: "handcash-connect-auth", authToken: token }, origin);
        } catch (e) {}
        hint.textContent = "You can close this window.";
        setTimeout(function () { try { window.close(); } catch (e) {} }, 400);
      } else {
        hint.innerHTML = "Copy your auth token from the address bar, or <a href=\\"/\\" style=\\"color:#6ec3ff\\">open the demo</a> and paste it under Connect.";
      }
    })();
  </script>
</body>
</html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

/**
 * After HandCash Pay, Cloud redirects here. Notifies opener (popup flow) via postMessage
 * and sets a localStorage signal so the parent can poll if the popup was closed without opener.
 */
function handleMppReturn(_req: IncomingMessage, res: ServerResponse) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment complete</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f1419; color: #e7ecf3; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1rem; text-align: center; }
    p { margin: 0.5rem 0; max-width: 22rem; line-height: 1.5; }
  </style>
</head>
<body>
  <div>
    <p><strong>Returning to the demo…</strong></p>
    <p id="hint">You can close this window if it does not close automatically.</p>
  </div>
  <script>
    (function () {
      var key = "handcash_mpp_demo_pending";
      var pid = null;
      try {
        var raw = localStorage.getItem(key);
        if (raw) {
          var o = JSON.parse(raw);
          pid = o && o.paymentRequestId ? String(o.paymentRequestId) : null;
          localStorage.removeItem(key);
        }
      } catch (e) {}
      try {
        localStorage.setItem("handcash_mpp_demo_return_ts", String(Date.now()));
      } catch (e) {}
      var origin = window.location.origin;
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: "handcash-mpp-return", paymentRequestId: pid }, origin);
        } catch (e) {}
        setTimeout(function () {
          try { window.close(); } catch (e) {}
          var h = document.getElementById("hint");
          if (h) h.textContent = "Close this tab and return to the demo.";
        }, 400);
      } else {
        var h = document.getElementById("hint");
        if (h) h.innerHTML = "Open the demo tab and use <strong>Poll receipt</strong>, or <a href=\\"/\\" style=\\"color:#6ec3ff\\">go home</a>.";
      }
    })();
  </script>
</body>
</html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function handleReceiptPoll(req: IncomingMessage, res: ServerResponse) {
  const host = req.headers.host ?? `localhost:${config.port}`;
  const url = new URL(req.url ?? "/", `http://${host}`);
  const pid = url.searchParams.get("paymentRequestId")?.trim();
  if (!pid) {
    json(res, 400, { error: "paymentRequestId query required" });
    return;
  }
  const jwt = receiptJwtByPaymentRequestId.get(pid);
  if (!jwt) {
    json(res, 404, { ready: false });
    return;
  }
  json(res, 200, { ready: true, receiptJwt: jwt });
}

function handleHome(_req: IncomingMessage, res: ServerResponse) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MPP demo</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif;
      background: #0f1419;
      color: #e7ecf3;
      max-width: 40rem;
      margin: 2rem auto;
      padding: 0 1rem;
      line-height: 1.45;
    }
    h1 { font-size: 1.35rem; font-weight: 650; margin: 0 0 0.35rem; }
    .sub { color: #8b9bb4; font-size: 0.9rem; margin: 0 0 1.25rem; }
    section {
      background: #12181f;
      border: 1px solid #222d38;
      border-radius: 10px;
      padding: 1rem 1.1rem;
      margin-bottom: 0.85rem;
    }
    h2 { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #8b9bb4; margin: 0 0 0.65rem; }
    h3.subsec {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7c95;
      margin: 0.85rem 0 0.35rem;
    }
    h3.subsec:first-of-type { margin-top: 0; }
    .row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.5rem; }
    .row:first-of-type { margin-top: 0; }
    button, .btn-link {
      font: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      padding: 0.45rem 0.75rem;
      border-radius: 8px;
      border: 1px solid #2a3544;
      background: #232d38;
      color: #e7ecf3;
      cursor: pointer;
    }
    button:disabled { opacity: 0.45; cursor: not-allowed; }

    /* Primary HandCash Pay CTA: light pill, mark + stacked label */
    button.hc-pay-pill {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      height: 44px;
      padding: 0 20px 0 12px;
      margin: 0;
      border-radius: 9999px;
      background: #fff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow:
        0 1px 1px rgba(0, 0, 0, 0.04),
        0 2px 5px rgba(0, 0, 0, 0.04);
      color: #0a2540;
      cursor: pointer;
      font-size: inherit;
      font-weight: 500;
      transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.12s ease;
    }
    button.hc-pay-pill:hover:not(:disabled) {
      border-color: rgba(0, 0, 0, 0.12);
      box-shadow:
        0 1px 1px rgba(0, 0, 0, 0.05),
        0 4px 10px rgba(0, 0, 0, 0.07);
    }
    button.hc-pay-pill:active:not(:disabled) {
      transform: scale(0.985);
    }
    button.hc-pay-pill:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.hc-pay-pill .hc-pay-pill__mark {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      display: block;
      object-fit: contain;
      border-radius: 6px;
    }
    button.hc-pay-pill .hc-pay-pill__body {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      line-height: 1.12;
      text-align: left;
    }
    button.hc-pay-pill .hc-pay-pill__caption {
      font-size: 11px;
      font-weight: 500;
      color: #697386;
      letter-spacing: 0.015em;
    }
    button.hc-pay-pill .hc-pay-pill__value {
      font-size: 14px;
      font-weight: 600;
      color: #007a63;
      letter-spacing: -0.02em;
    }
    button.hc-pay-pill--solo {
      padding: 0 20px;
    }
    #btnConnectPayAmount {
      font-size: 15px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }
    .btn-link {
      display: inline-block;
      text-decoration: none;
      background: transparent;
      border-color: #384757;
      color: #6ec3ff;
    }
    pre {
      margin: 0.5rem 0 0;
      padding: 0.65rem 0.75rem;
      background: #1a222d;
      border: 1px solid #2a3544;
      border-radius: 8px;
      font-size: 0.75rem;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    code { font-size: 0.8em; }
    .meta { font-size: 0.8rem; color: #8b9bb4; margin: 0.4rem 0 0; }
    .ok { color: #38cb89; }
    .warn { color: #fbbf24; }
    /* Icon-only QR toggle: aligned height and surface with primary pay CTA */
    button.btn-qr-icon {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      width: 44px;
      height: 44px;
      padding: 0;
      margin: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border-radius: 9999px;
      background: #fff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow:
        0 1px 1px rgba(0, 0, 0, 0.04),
        0 2px 5px rgba(0, 0, 0, 0.04);
      color: #0a2540;
      cursor: pointer;
      transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.12s ease, background 0.15s ease;
    }
    button.btn-qr-icon:hover:not(:disabled) {
      border-color: rgba(0, 0, 0, 0.12);
      box-shadow:
        0 1px 1px rgba(0, 0, 0, 0.05),
        0 4px 10px rgba(0, 0, 0, 0.07);
    }
    button.btn-qr-icon:active:not(:disabled) {
      transform: scale(0.985);
    }
    button.btn-qr-icon:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.btn-qr-icon[aria-pressed="true"] {
      background: #f0f4f8;
      border-color: rgba(0, 0, 0, 0.14);
    }
    button.btn-qr-icon svg {
      display: block;
    }
    #qrPayWrap {
      display: none;
      margin-top: 0.65rem;
      align-items: center;
      gap: 0.75rem;
    }
    #qrPayWrap.on {
      display: flex;
    }
    #qrPayWrap img {
      width: 112px;
      height: 112px;
      border-radius: 6px;
      background: #fff;
    }
  </style>
</head>
<body>
  <h1>@handcash/mpp demo</h1>
  <p class="sub">402 → pay (HandCash Pay <strong>without</strong> user Connect, or <strong>Pay from wallet</strong> after Connect) → receipt JWT → same GET with <code>x-handcash-receipt</code>. One pay path per challenge.</p>

  <section>
    <h2>Challenge</h2>
    <div class="row">
      <button type="button" id="btnRequest">GET /api/premium</button>
    </div>
    <pre id="outRequest">—</pre>
    <p class="meta"><code>challengeId</code> <code id="challengeOut">—</code></p>
  </section>

  <section>
    <h2>Pay</h2>
    <p id="payHint" class="meta">Request a challenge first.</p>
    <h3 class="subsec">Hosted checkout</h3>
    <p class="meta" style="margin:0 0 0.5rem">No payer Connect sign-in — only your app keys on the server.</p>
    <div class="row">
      <button type="button" class="hc-pay-pill" id="btnPayHandcash" disabled aria-label="Pay with HandCash">
        <img class="hc-pay-pill__mark" src="/hc-pay-mark.png" width="28" height="28" alt="" decoding="async" />
        <span class="hc-pay-pill__body">
          <span class="hc-pay-pill__caption">Pay with</span>
          <span class="hc-pay-pill__value">HandCash</span>
        </span>
      </button>
      <button type="button" class="btn-qr-icon" id="btnQrToggle" disabled aria-label="Show hosted checkout QR code" title="Show QR code" aria-pressed="false">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22" focusable="false" aria-hidden="true"><path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm6 0h2v2h-2v-2zm4 0h4v4h-2v-2h-2v-2zm-4 4h2v2h-2v-2zm4 2v2h2v-2h-2zm2-6h2v2h-2v-2z"/></svg>
      </button>
    </div>
    <div id="qrPayWrap" aria-live="polite"><img id="payQrImg" alt="Hosted checkout QR" width="112" height="112" /></div>
    <h3 class="subsec">Wallet (Connect)</h3>
    <p class="meta" style="margin:0 0 0.5rem">Only for <strong>Pay from wallet</strong> — not for HandCash Pay above.</p>
    <div class="row">
      <button type="button" class="hc-pay-pill" id="btnConnectAuth" aria-label="Connect to HandCash">
        <img class="hc-pay-pill__mark" src="/hc-pay-mark.png" width="28" height="28" alt="" decoding="async" />
        <span class="hc-pay-pill__body">
          <span class="hc-pay-pill__caption">Connect to</span>
          <span class="hc-pay-pill__value">HandCash</span>
        </span>
      </button>
      <button type="button" class="hc-pay-pill hc-pay-pill--solo" id="btnConnectPay" disabled aria-label="Pay from your HandCash wallet">
        <span class="hc-pay-pill__body">
          <span class="hc-pay-pill__caption">Pay from wallet</span>
          <span class="hc-pay-pill__value" id="btnConnectPayAmount">—</span>
        </span>
      </button>
    </div>
    <p id="connectProfile" class="meta ok" hidden>Signed in as <strong id="connectHandle"></strong></p>
    <p id="authStatus" class="meta">Wallet: not signed in to Connect.</p>
  </section>

  <section>
    <h2>Receipt &amp; retry</h2>
    <p class="meta">Hosted: poll after webhook (no Connect). Wallet: receipt from Pay from wallet below.</p>
    <div class="row">
      <button type="button" id="btnPoll" disabled>Poll</button>
      <button type="button" id="btnRetry" disabled>GET /api/premium + receipt</button>
    </div>
    <pre id="outReceipt">—</pre>
    <pre id="outRetry">—</pre>
  </section>

  <script>
    const $ = (id) => document.getElementById(id);
    let paymentRequestId = null;
    let challengeId = null;
    let payUrl = null;
    let receiptJwt = null;
    let authToken = null;
    let payPopup = null;
    let popupWatch = null;
    let qrImageUrl = null;
    let qrPanelOpen = false;

    function stopPopupWatch() {
      if (popupWatch) { clearInterval(popupWatch); popupWatch = null; }
    }

    function setQrToggleLabels(open) {
      const el = $("btnQrToggle");
      el.setAttribute("aria-pressed", open ? "true" : "false");
      el.setAttribute("aria-label", open ? "Hide hosted checkout QR code" : "Show hosted checkout QR code");
      el.setAttribute("title", open ? "Hide QR code" : "Show QR code");
    }

    function resetQrPanel() {
      qrPanelOpen = false;
      qrImageUrl = null;
      $("qrPayWrap").classList.remove("on");
      $("payQrImg").removeAttribute("src");
      setQrToggleLabels(false);
      $("btnQrToggle").disabled = true;
    }

    function updateConnectPayAriaLabel() {
      const amt = $("btnConnectPayAmount").textContent || "—";
      const suffix = amt !== "—" ? ", " + amt : "";
      $("btnConnectPay").setAttribute("aria-label", "Pay from your HandCash wallet" + suffix);
    }

    function setConnectPayAmountFrom402(j) {
      const el = $("btnConnectPayAmount");
      const n = typeof j.payAmountUsd === "number" ? j.payAmountUsd : null;
      const cur = typeof j.payAmountCurrency === "string" && j.payAmountCurrency ? j.payAmountCurrency : "USD";
      if (n == null || Number.isNaN(n)) {
        el.textContent = "—";
      } else {
        try {
          el.textContent = new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n);
        } catch {
          el.textContent = String(n) + " " + cur;
        }
      }
      updateConnectPayAriaLabel();
    }

    function syncConnectPayButton() {
      const ready = !!(challengeId && authToken);
      $("btnConnectPay").disabled = !ready;
      updateConnectPayAriaLabel();
    }

    function syncConnectAuthChallengeGate() {
      const locked = !challengeId;
      const btn = $("btnConnectAuth");
      btn.disabled = locked;
      btn.title = locked ? "Request GET /api/premium first (402) to unlock Connect." : "";
    }

    function syncConnectHints() {
      if ($("connectProfile").hasAttribute("hidden")) return;
      if (challengeId && authToken) $("authStatus").textContent = "Pay from wallet is ready for this challenge.";
      else if (authToken) $("authStatus").textContent = "Request a challenge (GET /api/premium), then Pay from wallet.";
    }

    function setAuthStatus(msg, isErr) {
      $("authStatus").textContent = msg;
      $("authStatus").className = "meta" + (isErr ? " warn" : "");
    }

    async function loadConnectProfile() {
      if (!authToken) return;
      setAuthStatus("Loading profile…");
      const r = await fetch("/api/connect-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ authToken }),
      });
      const j = await r.json();
      if (!r.ok) {
        setAuthStatus(String(j.error || r.status), true);
        $("connectProfile").setAttribute("hidden", "");
        return;
      }
      const h = String(j.handle || "").replace(/^@/, "");
      $("connectHandle").textContent = h ? "@" + h : "—";
      $("connectProfile").removeAttribute("hidden");
      syncConnectHints();
    }

    async function pollReceiptOnce() {
      if (!paymentRequestId) return false;
      $("outReceipt").textContent = "…";
      const r = await fetch("/api/receipt?paymentRequestId=" + encodeURIComponent(paymentRequestId));
      const j = await r.json();
      $("outReceipt").textContent = JSON.stringify(j, null, 2);
      if (j.ready && j.receiptJwt) {
        receiptJwt = j.receiptJwt;
        $("btnRetry").disabled = false;
        $("payHint").textContent = "Receipt ready — retry below.";
        $("payHint").className = "meta ok";
        return true;
      }
      return false;
    }

    function openCenteredPopup(url, name) {
      const w = 520, h = 720;
      const x = Math.max(0, Math.floor((window.screen.width - w) / 2));
      const y = Math.max(0, Math.floor((window.screen.height - h) / 5));
      const features = "popup=yes,width=" + w + ",height=" + h + ",left=" + x + ",top=" + y + ",scrollbars=yes,resizable=yes";
      return window.open(url, name, features);
    }

    function openHandcashPopup(url) {
      payPopup = openCenteredPopup(url, "HandCashPay");
      if (!payPopup) {
        $("payHint").textContent = qrImageUrl
          ? "Popup blocked — tap the QR button to show a code you can scan on another device."
          : "Popup blocked — allow popups for this site to pay in a window.";
        $("payHint").className = "meta warn";
        return;
      }
      $("payHint").textContent = "Complete pay in the popup.";
      $("payHint").className = "meta";
      stopPopupWatch();
      let ticks = 0;
      popupWatch = setInterval(async () => {
        ticks++;
        if (payPopup.closed) {
          stopPopupWatch();
          await pollReceiptOnce();
          return;
        }
        if (ticks % 4 === 0) await pollReceiptOnce();
      }, 500);
    }

    window.addEventListener("message", async (ev) => {
      if (ev.origin !== window.location.origin) return;
      const d = ev.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "handcash-connect-auth" && typeof d.authToken === "string" && d.authToken) {
        authToken = d.authToken;
        await loadConnectProfile();
        syncConnectPayButton();
        syncConnectHints();
        return;
      }
      if (d.type !== "handcash-mpp-return") return;
      stopPopupWatch();
      if (d.paymentRequestId) paymentRequestId = d.paymentRequestId;
      $("btnPoll").disabled = false;
      await pollReceiptOnce();
    });

    $("btnRequest").onclick = async () => {
      $("outRequest").textContent = "…";
      resetQrPanel();
      challengeId = null;
      syncConnectAuthChallengeGate();
      $("challengeOut").textContent = "—";
      $("btnConnectPayAmount").textContent = "—";
      updateConnectPayAriaLabel();
      syncConnectPayButton();
      if (!authToken) {
        $("connectProfile").setAttribute("hidden", "");
        setAuthStatus("Wallet: not signed in to Connect.");
      } else syncConnectHints();
      const r = await fetch("/api/premium", { headers: { Accept: "application/json" } });
      const text = await r.text();
      let j; try { j = JSON.parse(text); } catch { $("outRequest").textContent = text; return; }
      $("outRequest").textContent = JSON.stringify(j, null, 2);
      if (r.status === 402 && j.handcash?.paymentRequestId) {
        paymentRequestId = j.handcash.paymentRequestId;
        challengeId = typeof j.challengeId === "string" ? j.challengeId : null;
        $("challengeOut").textContent = challengeId || "—";
        payUrl = j.handcash.paymentRequestUrl || null;
        const qrUrl = j.handcash.paymentRequestQrCodeUrl;
        qrImageUrl = typeof qrUrl === "string" && qrUrl ? qrUrl : null;
        if (qrImageUrl) {
          $("payQrImg").src = qrImageUrl;
          $("btnQrToggle").disabled = false;
        } else resetQrPanel();
        $("btnPoll").disabled = false;
        $("btnPayHandcash").disabled = !payUrl;
        $("payHint").textContent = "Use HandCash Pay or QR (no Connect), or Pay from wallet after Connect — one path only.";
        $("payHint").className = "meta";
        setConnectPayAmountFrom402(j);
        syncConnectAuthChallengeGate();
        syncConnectPayButton();
        syncConnectHints();
      }
    };

    syncConnectAuthChallengeGate();

    $("btnQrToggle").onclick = () => {
      if (!qrImageUrl) return;
      qrPanelOpen = !qrPanelOpen;
      $("qrPayWrap").classList.toggle("on", qrPanelOpen);
      setQrToggleLabels(qrPanelOpen);
    };

    $("btnPayHandcash").onclick = () => {
      if (!payUrl) return;
      openHandcashPopup(payUrl);
    };

    $("btnConnectAuth").onclick = async () => {
      if (!challengeId) return;
      setAuthStatus("…");
      const r = await fetch("/api/connect-auth-url");
      const j = await r.json();
      if (!r.ok || !j.url) {
        setAuthStatus(String(j.error || r.status), true);
        return;
      }
      const w = openCenteredPopup(j.url, "HandCashConnect");
      if (!w) {
        setAuthStatus("Popup blocked.", true);
        return;
      }
      setAuthStatus("Finish in popup…");
    };

    $("btnConnectPay").onclick = async () => {
      if (!challengeId || !authToken) return;
      $("outReceipt").textContent = "…";
      const r = await fetch("/api/connect-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ authToken, challengeId }),
      });
      const j = await r.json();
      $("outReceipt").textContent = JSON.stringify(j, null, 2);
      if (r.ok && j.receiptJwt) {
        receiptJwt = j.receiptJwt;
        $("btnRetry").disabled = false;
        $("btnPoll").disabled = true;
        $("payHint").textContent = "Receipt from Connect — retry below.";
        $("payHint").className = "meta ok";
      } else {
        $("payHint").textContent = String(j.error || "Connect.pay failed");
        $("payHint").className = "meta warn";
      }
    };

    $("btnPoll").onclick = () => { pollReceiptOnce(); };

    $("btnRetry").onclick = async () => {
      if (!receiptJwt) return;
      $("outRetry").textContent = "…";
      const r = await fetch("/api/premium", {
        headers: { Accept: "application/json", "x-handcash-receipt": receiptJwt },
      });
      const j = await r.json();
      $("outRetry").textContent = JSON.stringify(j, null, 2);
    };
  </script>
</body>
</html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? `localhost:${config.port}`;
    const url = new URL(req.url ?? "/", `http://${host}`);
    const path = url.pathname;

    if (path === "/hc-pay-mark.png" && req.method === "GET") {
      handleHcPayMark(req, res);
      return;
    }
    if (path === "/" && req.method === "GET") {
      handleHome(req, res);
      return;
    }
    if (path === "/mpp/return" && req.method === "GET") {
      handleMppReturn(req, res);
      return;
    }
    if (path === "/connect/callback" && req.method === "GET") {
      handleConnectCallback(req, res);
      return;
    }
    if (path === "/api/connect-auth-url" && req.method === "GET") {
      handleConnectAuthUrl(req, res);
      return;
    }
    if (path === "/api/connect-profile" && req.method === "POST") {
      await handleConnectProfile(req, res);
      return;
    }
    if (path === "/api/connect-pay" && req.method === "POST") {
      await handleConnectPay(req, res);
      return;
    }
    if (path === "/api/premium" && req.method === "GET") {
      await handlePremium(req, res);
      return;
    }
    if (path === "/webhooks/payment" && req.method === "POST") {
      await handleWebhook(req, res);
      return;
    }
    if (path === "/demo/complete" && req.method === "POST") {
      await handleDemoComplete(req, res);
      return;
    }
    if (path === "/api/receipt" && req.method === "GET") {
      handleReceiptPoll(req, res);
      return;
    }

    res.writeHead(404).end("not found");
  } catch (e) {
    console.error(e);
    json(res, 500, { error: e instanceof Error ? e.message : "error" });
  }
}).listen(config.port, () => {
  console.error(`HandCash MPP demo → http://localhost:${config.port}/`);
});
