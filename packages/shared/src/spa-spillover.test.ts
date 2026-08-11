import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoolBody } from "./design-model";
import {
  listSpaSpilloverEdges,
  patchSpaSpilloverWeir,
  resolveSpaSpillover,
  resolveSpaSpillovers,
  spilloverWeirFromDrag,
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

  it("lists every pool-intersecting spa edge as a candidate", () => {
    // Corner inset: left + bottom spa edges both intersect the pool.
    const pool = poolBody("pool_1", rect(0, 0, 8000, 4000));
    const spa = spaBody("spa_1", rect(5500, 2500, 9000, 5000));
    const edges = listSpaSpilloverEdges(spa, [pool]);
    assert.ok(
      edges.length >= 2,
      `expected ≥2 candidates, got ${edges.length}`,
    );
    const indexes = new Set(edges.map((e) => e.edgeIndex));
    assert.equal(indexes.size, edges.length);
  });

  it("defaults to a weir on every intersecting edge", () => {
    const pool = poolBody("pool_1", rect(0, 0, 8000, 4000));
    const spa = spaBody("spa_1", rect(5500, 2500, 9000, 5000));
    const edges = listSpaSpilloverEdges(spa, [pool]);
    const resolved = resolveSpaSpillovers(spa, [pool]);
    assert.equal(resolved.length, edges.length);
  });

  it("updates weir width when dragging an endpoint", () => {
    const pool = poolBody("pool_1", rect(0, 0, 20 * FT, 40 * FT));
    const spa = spaBody("spa_1", rect(20 * FT, 10 * FT, 28 * FT, 20 * FT));
    const edges = listSpaSpilloverEdges(spa, [pool]);
    const before = resolveSpaSpillovers(spa, [pool])[0];
    assert.ok(before);
    const edge = edges.find((e) => e.edgeIndex === before.edgeIndex)!;
    const params = spilloverWeirFromDrag(edge, before, "end", {
      x: (before.a.x + before.b.x) / 2,
      y: (before.a.y + before.b.y) / 2,
    });
    assert.ok(params.widthMm < before.widthMm);
    const patched = patchSpaSpilloverWeir(spa, [pool], before.edgeIndex, params);
    const after = resolveSpaSpillovers(
      { ...spa, spillover: patched },
      [pool],
    ).find((r) => r.edgeIndex === before.edgeIndex)!;
    assert.ok(after.widthMm < before.widthMm);
  });

  it("finds weir edges when spa is inset into the pool corner", () => {
    // Same geometry as the L-wrap 3D join: spa overlaps pool corner.
    const pool = poolBody("pool_1", rect(0, 0, 8000, 4000));
    const spa = spaBody("spa_1", rect(5500, 2500, 9000, 5000));
    const edges = listSpaSpilloverEdges(spa, [pool]);
    assert.ok(edges.length >= 1, "expected pool-facing spa edges");
    const resolved = resolveSpaSpillover(spa, [pool]);
    assert.ok(resolved);
    assert.ok(resolved!.widthMm >= 24 * IN);
  });

  it("finds weir edges when spa overlaps a pool long side", () => {
    const pool = poolBody("pool_1", rect(0, 0, 20 * FT, 40 * FT));
    // Spa overlaps into the pool along the right side (not merely touching).
    const spa = spaBody(
      "spa_1",
      rect(18 * FT, 12 * FT, 26 * FT, 22 * FT),
    );
    const edges = listSpaSpilloverEdges(spa, [pool]);
    assert.ok(edges.length >= 1);
    assert.ok(resolveSpaSpillover(spa, [pool]));
  });

  it("skips deck-facing edges that only share the pool coping", () => {
    // Spa inset into the pool corner with its right edge colinear with the
    // pool's outer right edge — that side faces the patio, not water.
    const pool = poolBody("pool_1", rect(0, 0, 8000, 4000));
    const spa = spaBody("spa_1", rect(5500, 2500, 8000, 5000));
    const edges = listSpaSpilloverEdges(spa, [pool]);
    assert.ok(edges.length >= 1, "expected pool-facing weirs");

    const rightEdge = edges.find((e) => {
      const midX = (e.edgeA.x + e.edgeB.x) / 2;
      return Math.abs(midX - 8000) < 1;
    });
    assert.equal(
      rightEdge,
      undefined,
      "deck-facing spa edge on pool coping must not get a weir",
    );

    for (const e of edges) {
      const mid = {
        x: (e.edgeA.x + e.edgeB.x) / 2,
        y: (e.edgeA.y + e.edgeB.y) / 2,
      };
      // Remaining candidates should be the inward (left/bottom) faces.
      assert.ok(
        mid.x < 8000 - 50 || mid.y < 4000 - 50,
        `unexpected edge mid ${mid.x},${mid.y}`,
      );
    }
  });

  it("extends adjacent weirs to the shared corner", () => {
    const pool = poolBody("pool_1", rect(0, 0, 8000, 4000));
    const spa = spaBody("spa_1", rect(5500, 2500, 9000, 5000));
    const resolved = resolveSpaSpillovers(spa, [pool]);
    assert.ok(resolved.length >= 2, "expected ≥2 weirs on corner inset");

    const spaRing = spa.outline;
    // Find a pair of adjacent edge indexes among resolved weirs.
    const indexes = resolved.map((r) => r.edgeIndex).sort((a, b) => a - b);
    let pair: [number, number] | null = null;
    for (const i of indexes) {
      const next = (i + 1) % spaRing.length;
      if (indexes.includes(next)) {
        pair = [i, next];
        break;
      }
    }
    assert.ok(pair, "expected two adjacent weir edges");
    const [i0, i1] = pair!;
    const r0 = resolved.find((r) => r.edgeIndex === i0)!;
    const r1 = resolved.find((r) => r.edgeIndex === i1)!;
    const shared = spaRing[(i0 + 1) % spaRing.length];

    const near = (p: { x: number; y: number }, q: { x: number; y: number }) =>
      Math.hypot(p.x - q.x, p.y - q.y) < 80;

    assert.ok(
      near(r0.a, shared) || near(r0.b, shared),
      "first weir should reach the shared corner",
    );
    assert.ok(
      near(r1.a, shared) || near(r1.b, shared),
      "second weir should reach the shared corner",
    );
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
