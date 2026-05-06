import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertMinMppSecretLength, DEFAULT_MIN_MPP_SECRET_LENGTH } from "../crypto/secrets.js";

describe("assertMinMppSecretLength", () => {
  it("accepts long enough secrets", () => {
    assertMinMppSecretLength("x", "a".repeat(DEFAULT_MIN_MPP_SECRET_LENGTH));
  });

  it("rejects short secrets", () => {
    assert.throws(() => assertMinMppSecretLength("x", "short"), /at least 32/);
  });
});
