import "dotenv/config";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const publicBaseUrl = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3456").replace(/\/$/, "");

/** Where HandCash sends the browser after pay; must be reachable and usually allowlisted on the Connect app. */
const payRedirectUrl =
  process.env.PAY_REDIRECT_URL?.trim() || `${publicBaseUrl}/mpp/return`;

/** Where HandCash redirects after user authorizes Connect (must match Connect app settings in dashboard). */
const connectCallbackUrl =
  process.env.CONNECT_CALLBACK_URL?.trim() || `${publicBaseUrl}/connect/callback`;

export const config = {
  port: Number(process.env.PORT) || 3456,
  appId: requireEnv("HANDCASH_APP_ID"),
  appSecret: requireEnv("HANDCASH_APP_SECRET"),
  receiverHandle: requireEnv("DEMO_RECEIVER_HANDLE"),
  receiptSecret: requireEnv("MPP_RECEIPT_SECRET"),
  serverSecret: requireEnv("MPP_SERVER_SECRET"),
  publicBaseUrl,
  payRedirectUrl,
  connectCallbackUrl,
  demoCompleteSecret: process.env.DEMO_COMPLETE_SECRET?.trim() || "",
};
