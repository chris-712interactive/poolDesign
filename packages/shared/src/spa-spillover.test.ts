import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoolBody } from "./design-model";
import {
  listSpaSpilloverEdges,
  resolveSpaSpillover,
  splitScupperOpenings,
  wallSegmentsMinusIntervals,
} from "./spa-spillover";

const FT = 304.8;
const IN = 25.4;

const rect = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number }[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function poolBody(
  id: string,
  outline: { x: number; y: number }[],
): PoolBody {
  return {
    id,
    name: id,
    kind: "pool",
    outline,
    depthShallowMm: 914,
    depthDeepMm: 2438,
  };
}

function spaBody(
  id: string,
  outline: { x: number; y: number }[],
  spillover?: PoolBody["spillover"],
): PoolBody {
  return {
    id,
    name: id,
    kind: "spa",
    outline,
    depthShallowMm: 1066.8,
    depthDeepMm: 1066.8,
    shellHeightMm: 457.2,
    spillover,
  };
}

describe("spa spillover", () => {
  it("defaults on along the longest shared edge when attached", () => {
    const pool = poolBody("pool_1", rect(0, 0, 20 * FT, 40 * FT));
    // Spa attached to right side of pool
    const spa = spaBody("spa_1", rect(20 * FT, 10 * FT, 28 * FT, 20 * FT));
    const edges = listSpaSpilloverEdges(spa, [pool]);
    assert.ok(edges.length >= 1);
    assert.ok(edges[0].overlapLenMm >= 8 * FT);

    const resolved = resolveSpaSpillover(spa, [pool]);
    assert.ok(resolved);
    assert.equal(resolved!.poolId, "pool_1");
    assert.equal(resolved!.style, "sheet");
    assert.equal(resolved!.openings.length, 1);
    assert.ok(resolved!.widthMm >= 24 * IN);
    assert.ok(resolved!.notchDepthMm > 0);
  });

  it("returns null when spillover is disabled", () => {
    const pool = poolBody("pool_1", rect(0, 0, 20 * FT, 40 * FT));
    const spa = spaBody("spa_1", rect(20 * FT, 10 * FT, 28 * FT, 20 * FT), {
      enabled: false,
    });
    assert.equal(resolveSpaSpillover(spa, [pool]), null);
  });

  it("returns null when spa does not join a pool", () => {
    const pool = poolBody("pool_1", rect(0, 0, 20 * FT, 40 * FT));
    const spa = spaBody("spa_1", rect(50 * FT, 50 * FT, 58 * FT, 60 * FT));
    assert.equal(resolveSpaSpillover(spa, [pool]), null);
  });

  it("clamps weir width into the shared overlap", () => {
    const pool = poolBody("pool_1", rect(0, 0, 20 * FT, 40 * FT));
    const spa = spaBody("spa_1", rect(20 * FT, 10 * FT, 28 * FT, 20 * FT), {
      enabled: true,
      widthMm: 100 * FT,
    });
    const resolved = resolveSpaSpillover(spa, [pool]);
    assert.ok(resolved);
    assert.ok(resolved!.widthMm <= resolved!.overlapT1 - resolved!.overlapT0 + 1);
  });

  it("splits scuppers into N openings", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 3000, y: 0 };
    const openings = splitScupperOpenings(a, b, 3, 4 * IN);
    assert.equal(openings.length, 3);
    for (const o of openings) {
      assert.ok(Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) > 100);
    }
  });

  it("expands scupper style on resolve", () => {
    const pool = poolBody("pool_1", rect(0, 0, 20 * FT, 40 * FT));
    const spa = spaBody("spa_1", rect(20 * FT, 10 * FT, 28 * FT, 20 * FT), {
      enabled: true,
      style: "scuppers",
      scupperCount: 4,
      widthMm: 8 * FT,
    });
    const resolved = resolveSpaSpillover(spa, [pool]);
    assert.ok(resolved);
    assert.equal(resolved!.style, "scuppers");
    assert.equal(resolved!.openings.length, 4);
  });

  it("notches wall segments around omit intervals", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1000, y: 0 };
    const keep = wallSegmentsMinusIntervals(a, b, [[300, 700]]);
    assert.equal(keep.length, 2);
    assert.ok(keep[0].b.x <= 310);
    assert.ok(keep[1].a.x >= 690);
  });
});
