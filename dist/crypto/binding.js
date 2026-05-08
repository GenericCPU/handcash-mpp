import { createHmac, randomBytes } from "node:crypto";
const CHALLENGE_PREFIX = "hcpm_";
/**
 * Cryptographically strong challenge id (opaque to clients).
 */
export function createChallengeId() {
    return `${CHALLENGE_PREFIX}${randomBytes(24).toString("base64url")}`;
}
/**
 * Server-side binding token: proves this server issued `challengeId` for `resource`.
 * Use inside signed receipts or secondary storage keys — never expose the HMAC secret to clients.
 */
export function hmacBindChallenge(serverSecret, challengeId, resourceMethod, resourcePath) {
    const payload = `${challengeId}\n${resourceMethod.toUpperCase()}\n${resourcePath}`;
    return createHmac("sha256", serverSecret).update(payload).digest("base64url");
}
//# sourceMappingURL=binding.js.map