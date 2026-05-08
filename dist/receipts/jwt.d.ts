export type VerifiedReceipt = {
    challengeId: string;
    resourceMethod: string;
    resourcePath: string;
    transactionId?: string;
    paymentRequestId?: string;
    jti: string;
};
/**
 * HS256 receipt JWT — present on retries (e.g. `Authorization: Bearer <jwt>` or custom header).
 */
export declare function issueReceiptJwt(secret: string, input: {
    challengeId: string;
    resourceMethod: string;
    resourcePath: string;
    transactionId?: string;
    paymentRequestId?: string;
}, ttlSeconds: number): Promise<string>;
/**
 * Verifies JWT signature, issuer, audience, and expiry. Returns **null** if invalid or expired.
 */
export declare function verifyReceiptJwt(secret: string, token: string): Promise<VerifiedReceipt | null>;
//# sourceMappingURL=jwt.d.ts.map