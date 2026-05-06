import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getInstance } from "@handcash/sdk";
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
  clearSessionAfterConnect,
  getSessionForChallenge,
  getSessionForPaymentRequest,
  registerPremiumSession,
  setHostedReceipt,
  type PremiumSession,
} from "./state.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

const PREMIUM_RESOURCE = { method: "GET", path: "/api/premium" } as const;
const DEMO_USD_PRICE = 0.05;

const sdk = getInstance({ appId: config.appId, appSecret: config.appSecret });
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

function sendPublic(res: ServerResponse, file: string, headers: Record<string, string>): void {
  try {
    res.writeHead(200, headers);
    res.end(readFileSync(join(publicDir, file)));
  } catch {
    res.writeHead(404).end("not found");
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
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

async function issueReceiptForPayment(paymentRequestId: string, body: PaymentRequestCompletedWebhookBody): Promise<void> {
  const row = getSessionForPaymentRequest(paymentRequestId);
  if (!row || row.receiptJwt) return;
  const jwt = await issueReceiptJwt(
    config.receiptSecret,
    {
      challengeId: row.challengeId,
      resourceMethod: row.resource.method,
      resourcePath: row.resource.path,
      transactionId: body.transactionId,
      paymentRequestId,
    },
    3600,
  );
  setHostedReceipt(paymentRequestId, jwt);
}

async function handlePremium(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

  const session: PremiumSession = {
    challengeId: issued.challengeId,
    paymentRequestId,
    resource: PREMIUM_RESOURCE,
  };
  registerPremiumSession(session);

  const enriched = { ...parsed, payAmountUsd: DEMO_USD_PRICE, payAmountCurrency: "USD" };
  res.writeHead(402, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(enriched));
}

async function handleWebhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
  await issueReceiptForPayment((body as PaymentRequestCompletedWebhookBody).paymentRequestId, body as PaymentRequestCompletedWebhookBody);
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ok");
}

async function handleDemoComplete(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
  if (!getSessionForPaymentRequest(pid)) {
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

async function handleConnectPay(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

  const row = getSessionForChallenge(challengeId);
  if (!row) {
    json(res, 404, {
      error:
        "No pending challenge for this challengeId. GET /api/premium (402) first, then pay before hosted settlement clears Connect.",
    });
    return;
  }

  const accountClient = sdk.getAccountClient(authToken);
  type PayClient = Parameters<typeof connectPayAndIssueReceipt>[0]["client"];
  const result = await connectPayAndIssueReceipt({
    client: accountClient as unknown as PayClient,
    charge: demoCharge(),
    receiptSecret: config.receiptSecret,
    resource: row.resource,
    challengeId,
    receiptTtlSeconds: 3600,
  });

  if ("error" in result) {
    json(res, 400, { ok: false, error: result.error });
    return;
  }

  clearSessionAfterConnect(challengeId);
  json(res, 200, {
    ok: true,
    receiptJwt: result.receiptJwt,
    transactionId: result.transactionId,
    fulfillment: "connect",
  });
}

function handleReceiptPoll(req: IncomingMessage, res: ServerResponse): void {
  const host = req.headers.host ?? `localhost:${config.port}`;
  const url = new URL(req.url ?? "/", `http://${host}`);
  const pid = url.searchParams.get("paymentRequestId")?.trim();
  if (!pid) {
    json(res, 400, { error: "paymentRequestId query required" });
    return;
  }
  const jwt = getSessionForPaymentRequest(pid)?.receiptJwt;
  if (!jwt) {
    json(res, 404, { ready: false });
    return;
  }
  json(res, 200, { ready: true, receiptJwt: jwt });
}

createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? `localhost:${config.port}`;
    const url = new URL(req.url ?? "/", `http://${host}`);
    const path = url.pathname;
    const method = req.method ?? "GET";

    if (method === "GET" && path === "/") {
      sendPublic(res, "index.html", { "Content-Type": "text/html; charset=utf-8" });
      return;
    }
    if (method === "GET" && path === "/demo.css") {
      sendPublic(res, "demo.css", { "Content-Type": "text/css; charset=utf-8" });
      return;
    }
    if (method === "GET" && path === "/demo.js") {
      sendPublic(res, "demo.js", { "Content-Type": "text/javascript; charset=utf-8" });
      return;
    }
    if (method === "GET" && path === "/hc-pay-mark.png") {
      sendPublic(res, "hc-pay-mark.png", {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      });
      return;
    }
    if (method === "GET" && path === "/mpp/return") {
      sendPublic(res, "mpp-return.html", { "Content-Type": "text/html; charset=utf-8" });
      return;
    }
    if (method === "GET" && path === "/connect/callback") {
      sendPublic(res, "connect-callback.html", { "Content-Type": "text/html; charset=utf-8" });
      return;
    }

    if (method === "GET" && path === "/api/connect-auth-url") {
      json(res, 200, { url: sdk.getRedirectionUrl({ redirectionUrl: config.connectCallbackUrl }) });
      return;
    }

    if (method === "GET" && path === "/api/premium") {
      await handlePremium(req, res);
      return;
    }

    if (method === "POST" && path === "/webhooks/payment") {
      await handleWebhook(req, res);
      return;
    }

    if (method === "POST" && path === "/demo/complete") {
      if (!config.demoCompleteEndpointEnabled) {
        res.writeHead(404).end("not found");
        return;
      }
      await handleDemoComplete(req, res);
      return;
    }

    if (method === "GET" && path === "/api/receipt") {
      handleReceiptPoll(req, res);
      return;
    }

    if (method === "POST" && path === "/api/connect-pay") {
      await handleConnectPay(req, res);
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
