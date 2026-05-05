import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();
const ISSUER = "handcash-mpp";
const AUDIENCE = "handcash-machine-payment";

export type VerifiedReceipt = {
  challengeId: string;
  resourceMethod: string;
  resourcePath: string;
  transactionId?: string;
  paymentRequestId?: string;
  jti: string;
};

function secretKey(secret: string) {
  return encoder.encode(secret);
}

/**
 * HS256 receipt JWT — present on retries (e.g. `Authorization: Bearer <jwt>` or custom header).
 */
export async function issueReceiptJwt(
  secret: string,
  input: {
    challengeId: string;
    resourceMethod: string;
    resourcePath: string;
    transactionId?: string;
    paymentRequestId?: string;
  },
  ttlSeconds: number,
): Promise<string> {
  const jwt = await new SignJWT({
    ch: input.challengeId,
    m: input.resourceMethod,
    p: input.resourcePath,
    ...(input.transactionId ? { tid: input.transactionId } : {}),
    ...(input.paymentRequestId ? { pr: input.paymentRequestId } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .setJti(randomUUID())
    .sign(secretKey(secret));

  return jwt;
}

/**
 * Verifies JWT signature, issuer, audience, and expiry. Returns **null** if invalid or expired.
 */
export async function verifyReceiptJwt(secret: string, token: string): Promise<VerifiedReceipt | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });

    const ch = payload.ch;
    const m = payload.m;
    const p = payload.p;
    const jti = payload.jti;
    if (typeof ch !== "string" || typeof m !== "string" || typeof p !== "string" || typeof jti !== "string") {
      return null;
    }

    return {
      challengeId: ch,
      resourceMethod: m,
      resourcePath: p,
      transactionId: typeof payload.tid === "string" ? payload.tid : undefined,
      paymentRequestId: typeof payload.pr === "string" ? payload.pr : undefined,
      jti,
    };
  } catch {
    return null;
  }
}
