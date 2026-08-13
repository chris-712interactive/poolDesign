import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MM_PER_INCH } from "./units";
import {
  gateOutwardNormal,
  poolGateHingeHeightsMm,
  poolGateLatchSpec,
  POOL_GATE_LATCH_MIN_HEIGHT_MM,
  POOL_GATE_LATCH_TOP_SETDOWN_MM,
} from "./pool-gate-hardware";

describe("pool gate hardware", () => {
  it("puts a 54″ latch on the outside of a 6′ gate", () => {
    const spec = poolGateLatchSpec(72 * MM_PER_INCH);
    assert.equal(spec.face, "outside");
    assert.ok(Math.abs(spec.heightMm - POOL_GATE_LATCH_MIN_HEIGHT_MM) < 1e-6);
  });

  it("puts a short-gate latch on the pool side, 3″ below the top", () => {
    const h = 48 * MM_PER_INCH;
    const spec = poolGateLatchSpec(h);
    assert.equal(spec.face, "pool");
    assert.ok(Math.abs(spec.heightMm - (h - POOL_GATE_LATCH_TOP_SETDOWN_MM)) < 1e-6);
  });

  it("uses two hinges on a 4′ leaf and three on a 6′ leaf", () => {
    const short = poolGateHingeHeightsMm(48 * MM_PER_INCH);
    assert.equal(short.length, 2);
    const tall = poolGateHingeHeightsMm(72 * MM_PER_INCH);
    assert.equal(tall.length, 3);
    assert.ok(tall[0] < tall[1] && tall[1] < tall[2]);
  });

  it("points the outward normal away from the pool", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 3000, y: 0 };
    // Pool sits in +Y; outward should be −Y (away).
    const n = gateOutwardNormal(a, b, [{ x: 1500, y: 4000 }]);
    assert.ok(n.y < 0);
    assert.ok(Math.abs(n.x) < 1e-6);
  });
});
