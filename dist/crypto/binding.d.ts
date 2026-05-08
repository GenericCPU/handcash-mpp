/**
 * Cryptographically strong challenge id (opaque to clients).
 */
export declare function createChallengeId(): string;
/**
 * Server-side binding token: proves this server issued `challengeId` for `resource`.
 * Use inside signed receipts or secondary storage keys — never expose the HMAC secret to clients.
 */
export declare function hmacBindChallenge(serverSecret: string, challengeId: string, resourceMethod: string, resourcePath: string): string;
//# sourceMappingURL=binding.d.ts.map