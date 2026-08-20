import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autoGableRidgePoints,
  distToRidgesMm,
  estimateRoofRiseMm,
  resolvedBuildingRoof,
  roofHeightMm,
  tessellatePitchedRoof,
} from "./building-roof";
import type { PointMm } from "./design-model";

function rect(w: number, h: number): PointMm[] {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

describe("building roof", () => {
  it("auto gable ridge runs the long axis to the gable walls", () => {
    const outline = rect(12000, 8000);
    const ridge = autoGableRidgePoints(outline);
    assert.equal(ridge.length, 2);
    const len = Math.hypot(ridge[1].x - ridge[0].x, ridge[1].y - ridge[0].y);
    assert.ok(len > 10000, `ridge length ${len}`);
    const midY = (ridge[0].y + ridge[1].y) / 2;
    assert.ok(Math.abs(midY - 4000) < 200, `ridge should be centered, y=${midY}`);
  });

  it("height is max at the ridge and ~0 at the eaves", () => {
    const outline = rect(12000, 8000);
    const ridges = [
      {
        id: "r1",
        points: [
          { x: 0, y: 4000 },
          { x: 12000, y: 4000 },
        ],
      },
    ];
    const pitch12 = 6;
    const rise = estimateRoofRiseMm(outline, ridges, pitch12);
    const atRidge = roofHeightMm({ x: 6000, y: 4000 }, ridges, pitch12, rise);
    const atEave = roofHeightMm({ x: 6000, y: 0 }, ridges, pitch12, rise);
    const atGablePeak = roofHeightMm({ x: 0, y: 4000 }, ridges, pitch12, rise);
    assert.ok(atRidge > 1500, `ridge height ${atRidge}`);
    assert.ok(atEave < 80, `eave height ${atEave}`);
    assert.ok(atGablePeak > 1500, `gable peak ${atGablePeak}`);
    assert.ok(Math.abs(atRidge - rise) < 1);
  });

  it("a short ridge hips down at the gable end", () => {
    const outline = rect(12000, 8000);
    const ridges = [
      {
        id: "r1",
        points: [
          { x: 4000, y: 4000 },
          { x: 8000, y: 4000 },
        ],
      },
    ];
    const pitch12 = 6;
    const rise = estimateRoofRiseMm(outline, ridges, pitch12);
    const atEnd = roofHeightMm({ x: 0, y: 4000 }, ridges, pitch12, rise);
    const atRidge = roofHeightMm({ x: 6000, y: 4000 }, ridges, pitch12, rise);
    assert.ok(atRidge > 1500);
    assert.ok(atEnd < atRidge * 0.35, `hip end ${atEnd} vs ridge ${atRidge}`);
  });

  it("tessellates a pitched roof covering the centroid", () => {
    const outline = rect(10000, 7000);
    const ridges = [
      {
        id: "r1",
        points: autoGableRidgePoints(outline),
      },
    ];
    const mesh = tessellatePitchedRoof(outline, ridges, 6, 280);
    assert.ok(mesh.vertices.length > 20);
    assert.ok(mesh.indices.length >= 3);
    assert.ok(mesh.riseMm > 500);
    const peak = mesh.vertices.reduce((m, v) => Math.max(m, v.hMm), 0);
    assert.ok(peak > 500);
    assert.ok(mesh.gables.length > 0, "gable infill along the ends");
  });

  it("resolved pitched roof auto-fills a gable ridge", () => {
    const roof = resolvedBuildingRoof({
      outline: rect(9000, 6000),
      roof: { style: "pitched", pitch12: 8 },
    });
    assert.equal(roof.style, "pitched");
    assert.equal(roof.pitch12, 8);
    assert.equal(roof.ridges.length, 1);
    assert.ok(distToRidgesMm({ x: 4500, y: 3000 }, roof.ridges) < 250);
  });

  it("flat roofs stay flat even without ridges", () => {
    const roof = resolvedBuildingRoof({
      outline: rect(9000, 6000),
      roof: { style: "flat" },
    });
    assert.equal(roof.style, "flat");
    assert.equal(roof.ridges.length, 0);
  });
});
