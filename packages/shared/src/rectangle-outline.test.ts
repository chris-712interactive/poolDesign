import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRectangularOutline,
  rectangleFrame,
  resizeRectangleOutline,
} from "./spa-defaults";
import { offsetClosedOutlineEdge } from "./design-model";

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

describe("offsetClosedOutlineEdge", () => {
  it("pulls a rectangle side without shearing", () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 8000, y: 0 },
      { x: 8000, y: 4000 },
      { x: 0, y: 4000 },
    ];
    // Right edge, drag right + some along-edge noise
    const next = offsetClosedOutlineEdge(outline, 1, { x: 1000, y: 400 });
    assert.equal(next[0].x, 0);
    assert.equal(next[0].y, 0);
    assert.equal(next[1].x, 9000);
    assert.equal(next[1].y, 0);
    assert.equal(next[2].x, 9000);
    assert.equal(next[2].y, 4000);
    assert.equal(next[3].x, 0);
    assert.equal(next[3].y, 4000);
  });

  it("lengthens only the dragged side of an L-ish quad", () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2000 },
      { x: 0, y: 2000 },
    ];
    const next = offsetClosedOutlineEdge(outline, 2, { x: 0, y: 500 });
    assert.equal(next[2].y, 2500);
    assert.equal(next[3].y, 2500);
    assert.equal(next[0].y, 0);
    assert.equal(next[1].y, 0);
  });
});
