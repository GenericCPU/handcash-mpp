/**
 * HTTP agent for the MPP demo.
 *
 * Modes:
 *   (default)     GET /api/premium → 402 → poll /api/receipt → retry with x-handcash-receipt (waits for you to pay)
 *   challenge     One-shot: print 402 JSON to stdout (for agents / Cursor)
 *   premium       One-shot: GET /api/premium with receipt (MPP_RECEIPT_JWT or --receipt <jwt>)
 *
 * Env: MPP_DEMO_URL (default http://localhost:3456), MPP_RECEIPT_JWT (for premium mode)
 *
 * Exit: 0 ok | 1 protocol | 2 poll timeout | 3 retry not 200
 */
const BASE = (process.env.MPP_DEMO_URL ?? "http://localhost:3456").replace(/\/$/, "");
const POLL_MS = 2000;
const MAX_WAIT_MS = 5 * 60 * 1000;

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${String(s).padStart(2, "0")}s`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatAmount(usd: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(usd);
  } catch {
    return `${usd} ${currency}`;
  }
}

function parseArgs(argv: string[]): { mode: string; receiptJwt?: string } {
  const rest = argv.slice(2);
  let mode = "wait";
  let receiptJwt: string | undefined;
  if (rest.length > 0 && !rest[0].startsWith("--")) {
    mode = rest[0];
  }
  const ix = rest.indexOf("--receipt");
  if (ix >= 0 && rest[ix + 1]) receiptJwt = rest[ix + 1];
  return { mode, receiptJwt };
}

type Challenge402 = {
  challengeId?: string;
  handcash?: {
    paymentRequestId?: string;
    paymentRequestUrl?: string;
    paymentRequestQrCodeUrl?: string;
  };
  payAmountUsd?: number;
  payAmountCurrency?: string;
};

type ReceiptPoll = { ready?: boolean; receiptJwt?: string; error?: string };

const premiumUrl = `${BASE}/api/premium`;

async function cmdChallenge(): Promise<void> {
  const r1 = await fetch(premiumUrl, { headers: { Accept: "application/json" } });
  const text1 = await r1.text();
  let body1: Challenge402;
  try {
    body1 = JSON.parse(text1) as Challenge402;
  } catch {
    console.error("Expected JSON from GET /api/premium, got:", text1.slice(0, 200));
    process.exit(1);
  }
  if (r1.status !== 402) {
    console.error(`Expected HTTP 402, got ${r1.status}`);
    console.error(JSON.stringify(body1, null, 2));
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(body1, null, 2)}\n`);
  process.exit(0);
}

async function cmdPremium(receiptFromArg?: string): Promise<void> {
  const jwt = (receiptFromArg ?? process.env.MPP_RECEIPT_JWT)?.trim();
  if (!jwt) {
    console.error("Missing receipt JWT. Set MPP_RECEIPT_JWT or pass --receipt <jwt>");
    process.exit(1);
  }
  const r2 = await fetch(premiumUrl, {
    headers: {
      Accept: "application/json",
      "x-handcash-receipt": jwt,
    },
  });
  const text2 = await r2.text();
  let body2: unknown;
  try {
    body2 = JSON.parse(text2) as unknown;
  } catch {
    console.error("Response was not JSON:", text2.slice(0, 200));
    process.exit(3);
  }
  if (r2.status !== 200) {
    console.error(`Expected HTTP 200, got ${r2.status}`);
    console.error(JSON.stringify(body2, null, 2));
    process.exit(3);
  }
  process.stdout.write(`${JSON.stringify(body2, null, 2)}\n`);
  process.exit(0);
}

async function cmdWait(): Promise<void> {
  const r1 = await fetch(premiumUrl, { headers: { Accept: "application/json" } });
  const text1 = await r1.text();
  let body1: Challenge402;
  try {
    body1 = JSON.parse(text1) as Challenge402;
  } catch {
    console.error("Expected JSON from GET /api/premium, got:", text1.slice(0, 200));
    process.exit(1);
  }

  if (r1.status !== 402) {
    console.error(`Expected HTTP 402 from GET /api/premium, got ${r1.status}`);
    console.error(JSON.stringify(body1, null, 2));
    process.exit(1);
  }

  const pid = body1.handcash?.paymentRequestId?.trim();
  const payUrl = body1.handcash?.paymentRequestUrl?.trim();
  const qrUrl = body1.handcash?.paymentRequestQrCodeUrl?.trim();
  const cid = typeof body1.challengeId === "string" ? body1.challengeId : "";
  const cur = typeof body1.payAmountCurrency === "string" && body1.payAmountCurrency ? body1.payAmountCurrency : "USD";
  const amt =
    typeof body1.payAmountUsd === "number" && !Number.isNaN(body1.payAmountUsd) ? body1.payAmountUsd : null;

  if (!pid) {
    console.error("402 body missing handcash.paymentRequestId");
    process.exit(1);
  }

  const priceLabel = amt != null ? formatAmount(amt, cur) : "the listed amount";

  console.log("");
  console.log(`Pay ${priceLabel} to unlock GET /api/premium`);
  console.log(`  open:    ${payUrl ?? "(missing paymentRequestUrl)"}`);
  if (qrUrl) console.log(`  qr:      ${qrUrl}`);
  console.log(`  pid:     ${pid}`);
  console.log(`  cid:     ${cid || "—"}`);
  console.log("");
  console.log("Waiting for webhook (complete payment in HandCash)…");
  console.log("If PUBLIC_BASE_URL is not reachable from HandCash, use POST /demo/complete or a tunnel.");
  console.log("");

  const receiptUrl = `${BASE}/api/receipt?paymentRequestId=${encodeURIComponent(pid)}`;
  const started = Date.now();
  let receiptJwt: string | undefined;

  while (Date.now() - started < MAX_WAIT_MS) {
    const elapsed = Date.now() - started;
    const pr = await fetch(receiptUrl, { headers: { Accept: "application/json" } });
    const pt = await pr.text();
    let pj: ReceiptPoll;
    try {
      pj = JSON.parse(pt) as ReceiptPoll;
    } catch {
      console.error(`[t=${fmtDuration(elapsed)}] receipt poll: non-JSON (${pr.status})`, pt.slice(0, 120));
      process.exit(1);
    }
    if (!pr.ok && pr.status !== 404) {
      console.error(`[t=${fmtDuration(elapsed)}] receipt poll HTTP ${pr.status}`, JSON.stringify(pj));
      process.exit(1);
    }
    if (pj.ready && typeof pj.receiptJwt === "string" && pj.receiptJwt) {
      receiptJwt = pj.receiptJwt;
      console.log(`[t=${fmtDuration(elapsed)}] receipt ready`);
      break;
    }
    console.log(`[t=${fmtDuration(elapsed)}] not ready`);
    await sleep(POLL_MS);
  }

  if (!receiptJwt) {
    console.error("");
    console.error("Timed out waiting for receipt (5m). Check webhook URL / tunnel, or POST /demo/complete.");
    process.exit(2);
  }

  const r2 = await fetch(premiumUrl, {
    headers: {
      Accept: "application/json",
      "x-handcash-receipt": receiptJwt,
    },
  });
  const text2 = await r2.text();
  let body2: unknown;
  try {
    body2 = JSON.parse(text2) as unknown;
  } catch {
    console.error("Retry response was not JSON:", text2.slice(0, 200));
    process.exit(3);
  }

  if (r2.status !== 200) {
    console.error(`Expected HTTP 200 on retry, got ${r2.status}`);
    console.error(JSON.stringify(body2, null, 2));
    process.exit(3);
  }

  console.log("");
  console.log("Unlocked GET /api/premium:");
  console.log(JSON.stringify(body2, null, 2));
  process.exit(0);
}

async function main(): Promise<void> {
  const { mode, receiptJwt } = parseArgs(process.argv);
  if (mode === "challenge") await cmdChallenge();
  else if (mode === "premium") await cmdPremium(receiptJwt);
  else if (mode === "wait" || mode === "") await cmdWait();
  else {
    console.error(`Unknown mode "${mode}". Use: challenge | premium [--receipt <jwt>] | (default wait loop)`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
