import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRectangularOutline,
  rectangleFrame,
  resizeRectangleOutline,
} from "./spa-defaults";

describe("rectangle outline sizing", () => {
  it("detects and resizes an axis-aligned rect", () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 8000, y: 0 },
      { x: 8000, y: 4000 },
      { x: 0, y: 4000 },
    ];
    assert.equal(isRectangularOutline(outline), true);
    const frame = rectangleFrame(outline)!;
    assert.ok(Math.abs(frame.widthMm - 8000) < 1);
    assert.ok(Math.abs(frame.lengthMm - 4000) < 1);
    const next = resizeRectangleOutline(outline, 10000, 5000);
    const nf = rectangleFrame(next)!;
    assert.ok(Math.abs(nf.widthMm - 10000) < 1);
    assert.ok(Math.abs(nf.lengthMm - 5000) < 1);
    assert.ok(Math.abs(nf.center.x - 4000) < 1);
    assert.ok(Math.abs(nf.center.y - 2000) < 1);
  });

  it("preserves rotation when resizing", () => {
    // 45°-ish diamond-ish rectangle: 2000×1000 centered at origin, rotated 90°
    // Actually axis-aligned on local: from (0,0) along +Y then +X
    const outline = [
      { x: 0, y: 0 },
      { x: 0, y: 6000 },
      { x: 3000, y: 6000 },
      { x: 3000, y: 0 },
    ];
    const next = resizeRectangleOutline(outline, 8000, 4000);
    const nf = rectangleFrame(next)!;
    assert.ok(Math.abs(nf.widthMm - 8000) < 1);
    assert.ok(Math.abs(nf.lengthMm - 4000) < 1);
  });

  it("accepts slightly skewed patio outlines via AABB fallback", () => {
    const skewed = [
      { x: 554, y: 13589 },
      { x: 10934, y: 13589 },
      { x: 10934, y: 18584 },
      { x: 546, y: 18584 },
    ];
    assert.ok(rectangleFrame(skewed));
    const next = resizeRectangleOutline(skewed, 12000, 6000);
    const nf = rectangleFrame(next)!;
    assert.ok(Math.abs(nf.widthMm - 12000) < 2);
    assert.ok(Math.abs(nf.lengthMm - 6000) < 2);
  });
});
