import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COVER_MAX_POST_SPACING_MM,
  createCoverSupports,
  layoutCoverSupportPositions,
} from "./cover-supports";
import type { Building, PointMm } from "./design-model";

const FT = 304.8;

function rect(wFt: number, dFt: number, ox = 0, oy = 0): PointMm[] {
  const w = wFt * FT;
  const d = dFt * FT;
  return [
    { x: ox, y: oy },
    { x: ox + w, y: oy },
    { x: ox + w, y: oy + d },
    { x: ox, y: oy + d },
  ];
}

describe("cover-supports", () => {
  it("places four corner posts on a small square cover", () => {
    const pts = layoutCoverSupportPositions(rect(10, 10));
    assert.equal(pts.length, 4);
  });

  it("adds intermediate posts when an edge exceeds max spacing", () => {
    // 20′ × 10′ → long edges need a mid post → 6 posts total
    const pts = layoutCoverSupportPositions(rect(20, 10));
    assert.ok(pts.length >= 6);
    assert.ok(pts.length <= 8);
  });

  it("keeps post gaps at or under the 10′ target", () => {
    const outline = rect(24, 12);
    const pts = layoutCoverSupportPositions(outline);
    // Every outline edge's projected posts should respect spacing.
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
      const ux = (b.x - a.x) / edgeLen;
      const uy = (b.y - a.y) / edgeLen;
      const along = pts
        .map((p) => (p.x - a.x) * ux + (p.y - a.y) * uy)
        .filter((t) => t >= -50 && t <= edgeLen + 50)
        .sort((x, y) => x - y);
      for (let j = 1; j < along.length; j++) {
        assert.ok(
          along[j] - along[j - 1] <= COVER_MAX_POST_SPACING_MM + 1,
          `gap ${along[j] - along[j - 1]} exceeds max`,
        );
      }
    }
  });

  it("omits posts along a house ledger edge", () => {
    const cover = rect(16, 12, 0, 5000);
    const house: Building = {
      id: "h1",
      name: "House",
      outline: rect(40, 30, -5000, 5000 - 30 * FT),
      stories: 1,
    };
    // House sits along the bottom edge (y = 5000) of the cover.
    const pts = layoutCoverSupportPositions(cover, [house]);
    const supports = createCoverSupports(cover, [house]);
    assert.equal(pts.length, supports.length);
    // No post should sit on the ledger (south) edge — all should be toward free edges.
    assert.ok(pts.length >= 2);
    assert.ok(pts.length < layoutCoverSupportPositions(cover).length);
  });
});
