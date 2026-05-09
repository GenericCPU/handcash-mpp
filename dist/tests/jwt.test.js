import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { issueReceiptJwt, verifyReceiptJwt } from "../receipts/jwt.js";
import { MemoryJwtReplayGuard } from "../receipts/replay-guard.js";
import { evaluateMachinePaymentGate } from "../http/gate.js";
describe("receipt jwt", () => {
    it("round-trips and binds resource", async () => {
        const secret = "test-secret-at-least-32-chars-long!!";
        const jwt = await issueReceiptJwt(secret, {
            challengeId: "hcpm_1",
            resourceMethod: "GET",
            resourcePath: "/api/paid",
            transactionId: "tx_1",
        }, 3600);
        const v = await verifyReceiptJwt(secret, jwt);
        assert.ok(v);
        assert.equal(v.challengeId, "hcpm_1");
        assert.equal(v.resourcePath, "/api/paid");
    });
    it("replay guard blocks second use", async () => {
        const secret = "another-test-secret-32-characters-min";
        const jwt = await issueReceiptJwt(secret, { challengeId: "c", resourceMethod: "POST", resourcePath: "/x" }, 3600);
        const guard = new MemoryJwtReplayGuard();
        const req = new Request("https://example.com/x", {
            headers: { "x-handcash-receipt": jwt },
            method: "POST",
        });
        const g1 = await evaluateMachinePaymentGate(req, {
            receiptSecret: secret,
            resource: { method: "POST", path: "/x" },
            replayGuard: guard,
            replayTtlMs: 60_000,
        });
        assert.equal(g1.ok, true);
        const g2 = await evaluateMachinePaymentGate(req, {
            receiptSecret: secret,
            resource: { method: "POST", path: "/x" },
            replayGuard: guard,
            replayTtlMs: 60_000,
        });
        assert.equal(g2.ok, false);
        assert.equal(g2.reason, "replay");
    });
});
//# sourceMappingURL=jwt.test.js.map