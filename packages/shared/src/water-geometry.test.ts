import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POOL_WATER_FREEBOARD_MM,
  aabbDifferenceRects,
  aabbDifferenceRing,
  aabbUnionRing,
  clipOutlineByAabbs,
  mergePitHoles,
  openWallSegments,
  shouldOmitPoolWallEdge,
  segmentHitsFootprint,
  spaBelowDeckMm,
  spaNeedsDeckPit,
  subtractAabbHoles,
  unionTouchingAabbRings,
  waterBodiesConnected,
} from "./water-geometry";
import { outlineBounds } from "./spa-defaults";
import type { PoolBody } from "./design-model";
import { polygonAreaMm2 } from "./design-model";

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

describe("water-geometry", () => {
  it("uses a 6″ recommended freeboard", () => {
    assert.equal(POOL_WATER_FREEBOARD_MM, 152.4);
  });

  it("detects spa pit when shell height < total depth", () => {
    const spa: PoolBody = {
      id: "s",
      name: "Spa",
      kind: "spa",
      outline: rect(0, 0, 2000, 2000),
      depthShallowMm: 1066.8,
      depthDeepMm: 1066.8,
      shellHeightMm: 457.2,
    };
    assert.equal(spaNeedsDeckPit(spa), true);
    assert.ok(spaBelowDeckMm(spa) > 500);
    spa.shellHeightMm = 1200;
    assert.equal(spaNeedsDeckPit(spa), false);
  });

  it("subtracts an overlapping spa from a pool as rectangles", () => {
    const pool = rect(0, 0, 8000, 4000);
    const spa = rect(6000, 1000, 9000, 3000);
    const parts = aabbDifferenceRects(pool, spa);
    assert.ok(parts.length >= 2);
    const area = parts.reduce((s, p) => s + polygonAreaMm2(p), 0);
    // Pool 32e6 minus overlap 2e6 * 2e6 wait: overlap is 2000x2000 = 4e6
    assert.ok(Math.abs(area - (32_000_000 - 4_000_000)) < 1e5);
  });

  it("clips a rectangular pool to one polygon wrapping a corner spa", () => {
    const pool = rect(0, 0, 8000, 4000);
    const spa = rect(5500, 2500, 9000, 5000); // overlaps top-right corner
    const ring = aabbDifferenceRing(pool, spa);
    assert.ok(ring);
    assert.ok(ring!.length >= 6, `expected L polygon, got ${ring!.length} pts`);
    assert.ok(ring!.length <= 8);
    const area = polygonAreaMm2(ring!);
    const expected = 32_000_000 - 2500 * 1500; // overlap 2500×1500
    assert.ok(Math.abs(area - expected) < 1e5, `area ${area} vs ${expected}`);
    const clipped = clipOutlineByAabbs(pool, [spa]);
    assert.equal(clipped.length, ring!.length);
  });

  it("clips a slightly skewed pool so a spa still punches through", () => {
    const pool = [
      { x: 0, y: 2 },
      { x: 8000, y: 0 },
      { x: 8000, y: 4002 },
      { x: 2, y: 4000 },
    ];
    const spa = rect(5500, 2500, 9000, 5000);
    const ring = aabbDifferenceRing(pool, spa);
    assert.ok(ring);
    assert.ok(ring!.length >= 6, `expected notched polygon, got ${ring!.length}`);
    const area = polygonAreaMm2(ring!);
    assert.ok(area < polygonAreaMm2(pool) * 0.95);
  });

  it("merges overlapping pit holes into one AABB ring", () => {
    const pool = rect(0, 0, 8000, 4000);
    const spa = rect(7000, 1000, 9500, 3000);
    assert.ok(waterBodiesConnected(pool, spa));
    const merged = mergePitHoles([pool, spa]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].length, 4);
    // Bounding box of pool∪spa
    assert.ok(polygonAreaMm2(merged[0]) >= polygonAreaMm2(pool));
    assert.ok(polygonAreaMm2(merged[0]) >= 8000 * 4000);
  });

  it("builds an L union when spa attaches above pool", () => {
    const pool = rect(0, 0, 8000, 4000);
    const spa = rect(2000, 4000, 4000, 6000);
    const ring = aabbUnionRing(pool, spa);
    assert.ok(ring.length >= 6);
    assert.ok(polygonAreaMm2(ring) > polygonAreaMm2(pool));
  });

  it("unions overlapping patio slabs so the seam is filled", () => {
    const a = rect(0, 0, 8000, 6000);
    const b = rect(7900, 0, 16000, 6000);
    const unions = unionTouchingAabbRings([a, b], 80);
    assert.equal(unions.length, 1);
    const bb = outlineBounds(unions[0]);
    assert.equal(bb.minX, 0);
    assert.equal(bb.maxX, 16000);
    assert.equal(bb.minY, 0);
    assert.equal(bb.maxY, 6000);
  });

  it("unions patio slabs that nearly touch but do not overlap", () => {
    const a = rect(0, 0, 8000, 6000);
    const b = rect(8100, 0, 16000, 6000);
    const unions = unionTouchingAabbRings([a, b], 200);
    assert.equal(unions.length, 1);
    assert.equal(unionTouchingAabbRings([a, b], 50).length, 2);
  });

  it("subtracts multiple holes from a patio slab", () => {
    const patio = rect(0, 0, 12000, 8000);
    const pool = rect(2000, 2000, 8000, 6000);
    const regions = subtractAabbHoles(patio, [pool]);
    assert.ok(regions.length >= 3);
    const area = regions.reduce((s, r) => s + polygonAreaMm2(r), 0);
    assert.ok(Math.abs(area - (96_000_000 - 24_000_000)) < 1e5);
  });

  it("punches skewed patio outlines via bounding box", () => {
    // Hand-drawn deck: left edge not perfectly vertical (fails isAxisAlignedRect).
    const skewed = [
      { x: 554, y: 13589 },
      { x: 10934, y: 13589 },
      { x: 10934, y: 18584 },
      { x: 546, y: 18584 },
    ];
    const pool = rect(1818, 14074, 9650, 17789);
    const spa = rect(7510, 13192, 9947, 15335);
    const regions = subtractAabbHoles(skewed, [pool, spa]);
    assert.ok(regions.length >= 2);
    const area = regions.reduce((s, r) => s + polygonAreaMm2(r), 0);
    assert.ok(area < polygonAreaMm2(skewed) * 0.95);
  });

  it("keeps patio in the empty corner beside an attached spa", () => {
    const patio = rect(0, 12000, 12000, 19000);
    const pool = rect(1800, 14000, 9600, 17800);
    const spa = rect(7500, 13200, 9900, 15300);
    // Separate footprints preserve the L-gap; a union AABB would erase it.
    const separate = subtractAabbHoles(patio, [pool, spa]);
    const merged = subtractAabbHoles(patio, mergePitHoles([pool, spa]));
    const sepArea = separate.reduce((s, r) => s + polygonAreaMm2(r), 0);
    const mergedArea = merged.reduce((s, r) => s + polygonAreaMm2(r), 0);
    assert.ok(sepArea > mergedArea + 1_000_000);
    // Probe a point left of spa / above pool — should stay deck with separate pits.
    const probe = { x: 5000, y: 13600 };
    const kept = separate.some((r) => {
      const xs = r.map((p) => p.x);
      const ys = r.map((p) => p.y);
      return (
        probe.x >= Math.min(...xs) &&
        probe.x <= Math.max(...xs) &&
        probe.y >= Math.min(...ys) &&
        probe.y <= Math.max(...ys)
      );
    });
    assert.equal(kept, true);
  });

  it("omits pool wall edges that open into a spa", () => {
    const spa = rect(7000, 0, 9000, 4000);
    // Vertical edge through spa interior
    assert.equal(
      shouldOmitPoolWallEdge({ x: 8000, y: 0 }, { x: 8000, y: 4000 }, spa),
      true,
    );
    // Shared wall (pool right edge fully shared with spa left)
    assert.equal(
      shouldOmitPoolWallEdge({ x: 7000, y: 0 }, { x: 7000, y: 4000 }, spa),
      true,
    );
    // Bottom edge only partially colinear — keep it
    assert.equal(
      shouldOmitPoolWallEdge({ x: 0, y: 0 }, { x: 8000, y: 0 }, spa),
      false,
    );
  });

  it("detects a pool outer wall that only partly crosses a spa", () => {
    const spa = rect(7000, 0, 11000, 8000);
    // Full pool long edge: midpoint is still outside the spa.
    assert.equal(
      segmentHitsFootprint(
        { x: 0, y: 2000 },
        { x: 8000, y: 2000 },
        spa,
        0,
      ),
      true,
    );
    // Leftover west of the spa only touches the spa AABB at an endpoint.
    assert.equal(
      segmentHitsFootprint(
        { x: 0, y: 2000 },
        { x: 7000, y: 2000 },
        spa,
        0,
      ),
      false,
    );
  });

  it("opens a pool outer wall that continues through an overlapping spa", () => {
    // Pool 0–8000 × 0–5000, spa overlapping the right end at x=7000–11000.
    // The pool's right outer wall at x=8000 cuts through the spa interior.
    const spa = rect(7000, 2000, 11000, 6000);
    const segs = openWallSegments(
      { x: 8000, y: 0 },
      { x: 8000, y: 5000 },
      [spa],
    );
    assert.equal(segs.length, 1);
    const y0 = Math.min(segs[0].a.y, segs[0].b.y);
    const y1 = Math.max(segs[0].a.y, segs[0].b.y);
    assert.ok(y0 < 100);
    assert.ok(y1 <= 2120);
    assert.equal(
      shouldOmitPoolWallEdge(
        { x: 8000, y: 2000 },
        { x: 8000, y: 5000 },
        spa,
      ),
      true,
    );
  });

  it("splits spa edges so only the pool join opens", () => {
    const pool = rect(0, 4000, 8000, 8000);
    // Spa straddles the pool's top edge
    const spaLeft = { x: 6000, y: 2000 };
    const spaLeftBottom = { x: 6000, y: 6000 };
    const segs = openWallSegments(spaLeft, spaLeftBottom, [pool]);
    assert.equal(segs.length, 1);
    assert.ok(segs[0].a.y < 4100);
    assert.ok(segs[0].b.y <= 4100);
  });
});
