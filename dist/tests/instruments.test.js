import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertMneeReceiversHaveNoPaymail, buildConnectPayBodyFromCharge, buildCreatePaymentRequestBodyFromCharge, STANDARD_CHARGE_DENOMINATION_CURRENCY, } from "../domain/instruments.js";
const product = { name: "Test" };
const receivers = [{ destination: "alice", sendAmount: 1.5 }];
describe("instruments", () => {
    it("payment request BSV uses denominationCurrencyCode USD (Cloud rejects top-level currency)", () => {
        const body = buildCreatePaymentRequestBodyFromCharge({
            instrumentCurrencyCode: "BSV",
            receivers,
            product,
        });
        assert.equal(body.instrumentCurrencyCode, "BSV");
        assert.equal(body.denominationCurrencyCode, STANDARD_CHARGE_DENOMINATION_CURRENCY);
        assert.equal("currency" in body, false);
    });
    it("payment request BSV strips leading dollar from receiver destination", () => {
        const body = buildCreatePaymentRequestBodyFromCharge({
            instrumentCurrencyCode: "BSV",
            receivers: [{ destination: "$Alice", sendAmount: 2 }],
            product,
        });
        assert.equal(body.receivers[0]?.destination, "alice");
    });
    it("payment request MNEE omits denomination", () => {
        const body = buildCreatePaymentRequestBodyFromCharge({
            instrumentCurrencyCode: "MNEE",
            receivers,
            product,
        });
        assert.equal(body.instrumentCurrencyCode, "MNEE");
        assert.equal("denominationCurrencyCode" in body, false);
    });
    it("Connect BSV body includes USD denomination", () => {
        const body = buildConnectPayBodyFromCharge({
            instrumentCurrencyCode: "BSV",
            receivers,
            product,
        });
        assert.equal(body.denominationCurrencyCode, "USD");
    });
    it("Connect MNEE rejects paymail receivers", () => {
        assert.throws(() => buildConnectPayBodyFromCharge({
            instrumentCurrencyCode: "MNEE",
            receivers: [{ destination: "x@relayx.io", sendAmount: 1 }],
            product,
        }));
    });
    it("assertMneeReceiversHaveNoPaymail throws for paymail", () => {
        assert.throws(() => assertMneeReceiversHaveNoPaymail([{ destination: "a@b.co", sendAmount: 1 }]));
    });
});
//# sourceMappingURL=instruments.test.js.map