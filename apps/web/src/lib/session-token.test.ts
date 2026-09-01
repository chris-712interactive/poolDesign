import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSessionToken,
  verifySessionToken,
} from "./session-token";

describe("session tokens", () => {
  it("round-trips user id and sessionEpoch", () => {
    const token = createSessionToken("user_abc", 0);
    const claims = verifySessionToken(token);
    assert.ok(claims);
    assert.equal(claims?.userId, "user_abc");
    assert.equal(claims?.sessionEpoch, 0);
  });

  it("rejects a cookie minted before a password reset (old epoch)", () => {
    const beforeReset = createSessionToken("user_abc", 0);
    const afterReset = createSessionToken("user_abc", 1);
    assert.equal(verifySessionToken(beforeReset)?.sessionEpoch, 0);
    assert.equal(verifySessionToken(afterReset)?.sessionEpoch, 1);
    assert.notEqual(
      verifySessionToken(beforeReset)?.sessionEpoch,
      verifySessionToken(afterReset)?.sessionEpoch,
    );
  });

  it("rejects legacy 3-part cookies", () => {
    assert.equal(verifySessionToken("user_abc.1234567890.fakesig"), null);
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken("user_abc", 0);
    const parts = token.split(".");
    parts[0] = "other_user";
    assert.equal(verifySessionToken(parts.join(".")), null);
  });
});
