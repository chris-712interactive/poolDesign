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

  it("keeps a fence offset from a walk level where shots share the same drop", () => {
    const samples: GradeSample[] = [
      { id: "house", position: { x: 0, y: 0 }, dropMm: 0 },
      { id: "a", position: { x: 0, y: 20 * FT }, dropMm: 2.5 * FT },
      { id: "b", position: { x: 0, y: 40 * FT }, dropMm: 2.5 * FT },
    ];
    const ys = [20 * FT, 25 * FT, 30 * FT, 35 * FT, 40 * FT];
    for (const y of ys) {
      const drop = existingGradeDropMm({ x: 15 * FT, y }, samples);
      assert.ok(
        Math.abs(drop - 2.5 * FT) < 5,
        `offset fence at y=${y} should stay at 2.5', got ${drop}`,
      );
    }
  });

  it("fits a plane when shots actually spread in 2D", () => {
    const samples: GradeSample[] = [
      { id: "a", position: { x: 0, y: 0 }, dropMm: 0 },
      { id: "b", position: { x: 20 * FT, y: 0 }, dropMm: 0 },
      { id: "c", position: { x: 0, y: 20 * FT }, dropMm: 2 * FT },
    ];
    const p = existingGradeDropMm({ x: 10 * FT, y: 10 * FT }, samples);
    assert.ok(Math.abs(p - FT) < 10);
  });

  it("keeps radial walks from the house sloping (not a flat average)", () => {
    const far = 30 * FT;
    const drop = 2.5 * FT;
    const samples: GradeSample[] = [
      { id: "house", position: { x: 0, y: 0 }, dropMm: 0 },
      { id: "n", position: { x: 0, y: -far }, dropMm: drop },
      { id: "e", position: { x: far, y: 0 }, dropMm: drop },
      { id: "s", position: { x: 0, y: far }, dropMm: drop },
      { id: "w", position: { x: -far, y: 0 }, dropMm: drop },
    ];
    const midN = existingGradeDropMm({ x: 0, y: -15 * FT }, samples);
    assert.ok(
      Math.abs(midN - 1.25 * FT) < 20,
      `halfway north should be ~1.25', got ${midN}`,
    );
    const nearHouse = existingGradeDropMm({ x: 0, y: -3 * FT }, samples);
    assert.ok(nearHouse < 0.4 * FT, `near house should be small, got ${nearHouse}`);
    const atFence = existingGradeDropMm({ x: far, y: far * 0.2 }, samples);
    assert.ok(
      atFence > 2 * FT,
      `past the far shots should stay near 2.5', got ${atFence}`,
    );
  });

  it("does not extrude a downhill walk across the rest of the lot", () => {
    const samples: GradeSample[] = [
      { id: "house", position: { x: 0, y: 0 }, dropMm: 0 },
      { id: "a", position: { x: 10 * FT, y: 0 }, dropMm: FT },
      { id: "b", position: { x: 20 * FT, y: 0 }, dropMm: 2 * FT },
      { id: "c", position: { x: 30 * FT, y: 0 }, dropMm: 3 * FT },
    ];
    const along = existingGradeDropMm({ x: 15 * FT, y: 0 }, samples);
    assert.ok(
      Math.abs(along - 1.5 * FT) < 20,
      `along the walk should stay ~1.5', got ${along}`,
    );
    const beside = existingGradeDropMm({ x: 15 * FT, y: 8 * FT }, samples);
    assert.ok(
      Math.abs(beside - 1.5 * FT) < 40,
      `a nearby side yard should follow the walk, got ${beside}`,
    );
    const farSide = existingGradeDropMm({ x: 15 * FT, y: -60 * FT }, samples);
    assert.ok(
      Math.abs(farSide) < 0.4 * FT,
      `the far side of the house should stay near FFE, got ${farSide}`,
    );
  });

  it("does not let one side's walk span a triangle through the house", () => {
    const samples: GradeSample[] = [
      { id: "left0", position: { x: -2 * FT, y: 0 }, dropMm: 0 },
      { id: "left1", position: { x: -20 * FT, y: 0 }, dropMm: 3 * FT },
      { id: "right", position: { x: 40 * FT, y: 5 * FT }, dropMm: 0.5 * FT },
    ];
    const rightYard = existingGradeDropMm({ x: 38 * FT, y: 5 * FT }, samples);
    assert.ok(
      Math.abs(rightYard - 0.5 * FT) < 80,
      `right-side shot should keep its own grade, got ${rightYard}`,
    );
    const throughHouse = existingGradeDropMm({ x: 10 * FT, y: 2 * FT }, samples);
    assert.ok(
      Math.abs(throughHouse) < 1.2 * FT,
      `empty yard through the house should not inherit the left drop, got ${throughHouse}`,
    );
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

  it("honors per-edge wall / fill / open overrides", () => {
    const patio = {
      ...rect(20 * FT, 30 * FT),
      gradeStrategy: "both" as const,
      edgeGrades: [
        { edgeIndex: 0, grade: "none" as const },
        { edgeIndex: 1, grade: "fill" as const },
        { edgeIndex: 2, grade: "retaining" as const },
      ],
    };
    const samples: GradeSample[] = [
      { id: "far", position: { x: 10 * FT, y: 30 * FT }, dropMm: 3 * FT },
    ];
    const analysis = analyzePatioGrade(patio, samples);
    const byEdge = new Map(analysis.resolvedEdges.map((e) => [e.edgeIndex, e]));
    assert.equal(byEdge.get(0)?.grade, "none");
    assert.equal(byEdge.get(1)?.grade, "fill");
    assert.equal(byEdge.get(2)?.grade, "retaining");
    assert.ok(
      !analysis.retainingSegments.some((s) => s.edgeIndex === 0),
      "open edge has no wall",
    );
    assert.ok(
      !analysis.retainingSegments.some((s) => s.edgeIndex === 1),
      "fill edge has no wall",
    );
    assert.ok(analysis.retainingSegments.some((s) => s.edgeIndex === 2));
    assert.ok(analysis.includeFill);
  });
});
