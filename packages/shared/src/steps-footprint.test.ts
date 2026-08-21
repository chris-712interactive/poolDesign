import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyStepsStandardFootprint,
  DEFAULT_STEP_WIDTH_MM,
  STANDARD_STEP_TREAD_MM,
  stepsRunMm,
  stepsTreadOutline,
  stepsRunSignTowardPool,
} from "./scene3d";
import { rectangleFrame } from "./spa-defaults";

describe("steps footprint", () => {
  it("sizes run from riser count and keeps a minimum width", () => {
    const drawn = [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 500 },
      { x: 0, y: 500 },
    ];
    const outline = applyStepsStandardFootprint(drawn, 4);
    const frame = rectangleFrame(outline)!;
    const run = stepsRunMm(4);
    assert.equal(run, 4 * STANDARD_STEP_TREAD_MM);
    assert.ok(Math.max(frame.widthMm, frame.lengthMm) >= DEFAULT_STEP_WIDTH_MM - 1);
    assert.ok(
      Math.abs(Math.min(frame.widthMm, frame.lengthMm) - run) < 1,
    );
  });

  it("orients the lowest tread toward the pool interior", () => {
    const steps = applyStepsStandardFootprint(
      [
        { x: 0, y: 0 },
        { x: 2000, y: 0 },
        { x: 2000, y: 1200 },
        { x: 0, y: 1200 },
      ],
      3,
    );
    const pool = [
      { x: 4000, y: -2000 },
      { x: 12000, y: -2000 },
      { x: 12000, y: 4000 },
      { x: 4000, y: 4000 },
    ];
    const n = 3;
    const sign = stepsRunSignTowardPool(steps, n, pool);
    const top = stepsTreadOutline(steps, 0, n, sign);
    const bottom = stepsTreadOutline(steps, n - 1, n, sign);
    const cTop = {
      x: top.reduce((s, p) => s + p.x, 0) / 4,
      y: top.reduce((s, p) => s + p.y, 0) / 4,
    };
    const cBot = {
      x: bottom.reduce((s, p) => s + p.x, 0) / 4,
      y: bottom.reduce((s, p) => s + p.y, 0) / 4,
    };
    const poolC = { x: 8000, y: 1000 };
    const dTop = Math.hypot(cTop.x - poolC.x, cTop.y - poolC.y);
    const dBot = Math.hypot(cBot.x - poolC.x, cBot.y - poolC.y);
    assert.ok(dBot < dTop, `bottom ${dBot} should be closer to pool than top ${dTop}`);
  });

  it("splits into one tread strip per riser", () => {
    const outline = applyStepsStandardFootprint(
      [
        { x: 0, y: 0 },
        { x: 2000, y: 0 },
        { x: 2000, y: 2000 },
        { x: 0, y: 2000 },
      ],
      3,
    );
    const t0 = stepsTreadOutline(outline, 0, 3);
    const t2 = stepsTreadOutline(outline, 2, 3);
    assert.equal(t0.length, 4);
    assert.equal(t2.length, 4);
    // Top and bottom treads should not share the same centroid
    const c0 = {
      x: t0.reduce((s, p) => s + p.x, 0) / 4,
      y: t0.reduce((s, p) => s + p.y, 0) / 4,
    };
    const c2 = {
      x: t2.reduce((s, p) => s + p.x, 0) / 4,
      y: t2.reduce((s, p) => s + p.y, 0) / 4,
    };
    assert.ok(Math.hypot(c0.x - c2.x, c0.y - c2.y) > 100);
  });
});
