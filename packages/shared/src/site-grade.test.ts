import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GradeSample, PatioRegion } from "./design-model";
import {
  analyzePatioGrade,
  existingGradeDropMm,
  fillHeightUnderSlabMm,
  mm3ToCy,
} from "./site-grade";

const FT = 304.8;

function rect(w: number, d: number): PatioRegion {
  return {
    id: "patio_1",
    name: "Patio",
    outline: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: d },
      { x: 0, y: d },
    ],
    gradeStrategy: "both",
  };
}

describe("site-grade", () => {
  it("IDW interpolates between two samples", () => {
    const samples: GradeSample[] = [
      { id: "a", position: { x: 0, y: 0 }, dropMm: 0 },
      { id: "b", position: { x: 30 * FT, y: 0 }, dropMm: 2 * FT },
    ];
    const mid = existingGradeDropMm({ x: 15 * FT, y: 0 }, samples);
    assert.ok(Math.abs(mid - FT) < 5);
    assert.equal(existingGradeDropMm({ x: 0, y: 0 }, samples), 0);
  });

  it("fill height starts below slab thickness", () => {
    assert.equal(fillHeightUnderSlabMm(50), 0);
    assert.equal(fillHeightUnderSlabMm(100), 0);
    assert.ok(fillHeightUnderSlabMm(700) > 500);
  });

  it("analyzes fill and retaining for a sloping patio", () => {
    const patio = rect(20 * FT, 30 * FT);
    const samples: GradeSample[] = [
      { id: "near", position: { x: 10 * FT, y: 0 }, dropMm: 0 },
      { id: "far", position: { x: 10 * FT, y: 30 * FT }, dropMm: 2 * FT },
    ];
    const analysis = analyzePatioGrade(patio, samples, {
      retainingTriggerMm: 457.2,
    });
    assert.ok(analysis.fillVolumeCy > 0);
    assert.ok(mm3ToCy(analysis.fillVolumeMm3) > 0);
    assert.ok(analysis.retainingLengthMm > 0);
    assert.ok(analysis.maxFillHeightMm > 0);
  });

  it("respects fill-only strategy", () => {
    const patio = { ...rect(20 * FT, 30 * FT), gradeStrategy: "fill" as const };
    const samples: GradeSample[] = [
      { id: "far", position: { x: 10 * FT, y: 30 * FT }, dropMm: 3 * FT },
    ];
    const analysis = analyzePatioGrade(patio, samples);
    assert.ok(analysis.fillVolumeCy > 0);
    assert.equal(analysis.retainingSegments.length, 0);
  });

  it("respects retaining-only strategy", () => {
    const patio = {
      ...rect(20 * FT, 30 * FT),
      gradeStrategy: "retaining" as const,
    };
    const samples: GradeSample[] = [
      { id: "far", position: { x: 10 * FT, y: 30 * FT }, dropMm: 3 * FT },
    ];
    const analysis = analyzePatioGrade(patio, samples);
    assert.equal(analysis.fillVolumeCy, 0);
    assert.ok(analysis.retainingLengthMm > 0);
  });
});
