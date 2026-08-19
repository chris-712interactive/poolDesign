import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoolBody } from "./design-model";
import {
  infinityDeckCutPolygon,
  infinityTroughPolygon,
  infinityWeirFromDrag,
  listInfinityEdgeCandidates,
  patchInfinityEdgeWeir,
  resolveInfinityEdge,
  resolveInfinityEdges,
} from "./infinity-edge";

const FT = 304.8;
const IN = 25.4;

function rectPool(
  wFt: number,
  dFt: number,
  infinityEdge?: PoolBody["infinityEdge"],
): PoolBody {
  return {
    id: "p1",
    name: "Pool",
    kind: "pool",
    outline: [
      { x: 0, y: 0 },
      { x: wFt * FT, y: 0 },
      { x: wFt * FT, y: dFt * FT },
      { x: 0, y: dFt * FT },
    ],
    depthShallowMm: 3 * FT,
    depthDeepMm: 8 * FT,
    wallThicknessMm: 8 * IN,
    infinityEdge,
  };
}

describe("infinity edge", () => {
  it("lists outline edges as candidates", () => {
    const pool = rectPool(20, 40);
    const edges = listInfinityEdgeCandidates(pool);
    assert.equal(edges.length, 4);
  });

  it("returns no resolved weirs when disabled or none enabled", () => {
    assert.equal(resolveInfinityEdges(rectPool(20, 40)).length, 0);
    assert.equal(
      resolveInfinityEdges(
        rectPool(20, 40, { enabled: false, weirs: [{ edgeIndex: 0 }] }),
      ).length,
      0,
    );
    assert.equal(
      resolveInfinityEdges(
        rectPool(20, 40, {
          enabled: true,
          weirs: [{ edgeIndex: 0, enabled: false }],
        }),
      ).length,
      0,
    );
  });

  it("resolves an enabled edge with trough offset outward", () => {
    const pool = rectPool(20, 40, {
      enabled: true,
      weirs: [{ edgeIndex: 0, enabled: true }],
      trough: { widthMm: 24 * IN },
    });
    const resolved = resolveInfinityEdges(pool);
    assert.equal(resolved.length, 1);
    const e = resolved[0];
    assert.ok(e.widthMm > 10 * FT);
    // Edge 0 runs +X at y=0; outward should be -Y for CCW rect.
    assert.ok(e.ny < -0.5, `expected outward -Y, got ny=${e.ny}`);
    assert.ok(e.troughOuterA.y < e.a.y);
    const poly = infinityTroughPolygon(e);
    assert.equal(poly.length, 4);
  });

  it("clamps weir width into the edge", () => {
    const pool = rectPool(20, 40, {
      enabled: true,
      weirs: [{ edgeIndex: 1, enabled: true, widthMm: 100 * FT }],
    });
    const resolved = resolveInfinityEdge(pool);
    assert.ok(resolved);
    assert.ok(resolved!.widthMm <= 40 * FT + 1);
  });

  it("updates weir width when dragging an endpoint", () => {
    const pool = rectPool(20, 40, {
      enabled: true,
      weirs: [{ edgeIndex: 0, enabled: true }],
    });
    const candidates = listInfinityEdgeCandidates(pool);
    const before = resolveInfinityEdges(pool)[0];
    const edge = candidates.find((c) => c.edgeIndex === 0)!;
    const params = infinityWeirFromDrag(edge, before, "end", {
      x: before.a.x + 8 * FT,
      y: before.a.y,
    });
    const patched = patchInfinityEdgeWeir(pool, 0, {
      enabled: true,
      ...params,
    });
    const after = resolveInfinityEdges({ ...pool, infinityEdge: patched })[0];
    assert.ok(after.widthMm < before.widthMm);
  });

  it("extends adjacent weirs to the shared corner", () => {
    const pool = rectPool(20, 40, {
      enabled: true,
      weirs: [
        { edgeIndex: 0, enabled: true, widthMm: 8 * FT, offsetMm: -4 * FT },
        { edgeIndex: 1, enabled: true, widthMm: 8 * FT, offsetMm: -12 * FT },
      ],
    });
    const resolved = resolveInfinityEdges(pool);
    assert.equal(resolved.length, 2);
    // After corner stretch, weirs should meet near the shared vertex.
    const ends: { x: number; y: number }[] = [];
    for (const r of resolved) {
      ends.push(r.a, r.b);
    }
    let minDist = Infinity;
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const d = Math.hypot(ends[i].x - ends[j].x, ends[i].y - ends[j].y);
        if (d < minDist) minDist = d;
      }
    }
    assert.ok(minDist < 50, `adjacent weirs should nearly meet, d=${minDist}`);
  });

  it("ignores spas", () => {
    const spa: PoolBody = {
      ...rectPool(10, 10, {
        enabled: true,
        weirs: [{ edgeIndex: 0, enabled: true }],
      }),
      kind: "spa",
      id: "s1",
      name: "Spa",
    };
    assert.equal(listInfinityEdgeCandidates(spa).length, 0);
    assert.equal(resolveInfinityEdges(spa).length, 0);
  });

  it("deck cut extends inward through the wall and out past the trough", () => {
    const pool = rectPool(20, 40, {
      enabled: true,
      weirs: [{ edgeIndex: 0, enabled: true }],
      trough: { widthMm: 24 * IN },
    });
    const edge = resolveInfinityEdges(pool)[0];
    const cut = infinityDeckCutPolygon(edge, 8 * IN);
    assert.equal(cut.length, 4);
    const ys = cut.map((p) => p.y);
    assert.ok(Math.max(...ys) > edge.a.y, "inset into the pool");
    assert.ok(Math.min(...ys) < edge.troughOuterA.y, "pad past trough");
    const cutSpan = Math.hypot(cut[1].x - cut[0].x, cut[1].y - cut[0].y);
    const edgeSpan = Math.hypot(
      edge.edgeB.x - edge.edgeA.x,
      edge.edgeB.y - edge.edgeA.y,
    );
    assert.ok(
      cutSpan > edgeSpan,
      "deck cut extends past the pool corners",
    );
  });
});
