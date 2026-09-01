import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  forgotAcknowledged,
  hashResetToken,
  inspectResetToken,
  newResetToken,
} from "./password-reset-token";

describe("reset tokens", () => {
  it("stores a hash, not the raw token", () => {
    const token = newResetToken();
    const hash = hashResetToken(token);
    assert.notEqual(hash, token);
    assert.equal(hashResetToken(token), hash);
    assert.notEqual(hashResetToken("other"), hash);
  });

  it("treats unknown, used, and expired tokens as failures (HTTP 400)", () => {
    const now = new Date("2026-09-01T15:00:00.000Z");
    assert.equal(inspectResetToken(null, now), "missing");
    assert.equal(
      inspectResetToken(
        { usedAt: now, expiresAt: new Date("2026-09-01T16:00:00.000Z") },
        now,
      ),
      "used",
    );
    assert.equal(
      inspectResetToken(
        {
          usedAt: null,
          expiresAt: new Date("2026-09-01T14:59:59.000Z"),
        },
        now,
      ),
      "expired",
    );
    assert.equal(
      inspectResetToken(
        {
          usedAt: null,
          expiresAt: new Date("2026-09-01T16:00:00.000Z"),
        },
        now,
      ),
      "ok",
    );
  });

  it("unknown email still 200 (same public body as a known address)", () => {
    assert.deepEqual(forgotAcknowledged(), { ok: true });
  });
});
