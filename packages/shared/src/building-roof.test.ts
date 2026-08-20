import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autoGableRidgePoints,
  distToRidgesMm,
  estimateRoofRiseMm,
  peakRidges,
  resolvedBuildingRoof,
  roofHeightMm,
  sampleRoofMeshHeightMm,
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

function ell(): PointMm[] {
  return [
    { x: 0, y: 0 },
    { x: 14000, y: 0 },
    { x: 14000, y: 8000 },
    { x: 8000, y: 8000 },
    { x: 8000, y: 14000 },
    { x: 0, y: 14000 },
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
    const atRidge = roofHeightMm(
      { x: 6000, y: 4000 },
      ridges,
      pitch12,
      rise,
      outline,
    );
    const atEave = roofHeightMm(
      { x: 6000, y: 0 },
      ridges,
      pitch12,
      rise,
      outline,
    );
    const atGablePeak = roofHeightMm(
      { x: 0, y: 4000 },
      ridges,
      pitch12,
      rise,
      outline,
    );
    const atFace = roofHeightMm(
      { x: 6000, y: 2000 },
      ridges,
      pitch12,
      rise,
      outline,
    );
    assert.ok(atRidge > 1500, `ridge height ${atRidge}`);
    assert.ok(atEave < 80, `eave height ${atEave}`);
    assert.ok(atGablePeak > 1500, `gable peak ${atGablePeak}`);
    assert.ok(Math.abs(atRidge - rise) < 1);
    assert.ok(atFace > rise * 0.35, `face sag ${atFace} vs rise ${rise}`);
    assert.ok(atFace < rise * 0.7, `face too high ${atFace}`);
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
    const atEnd = roofHeightMm(
      { x: 0, y: 4000 },
      ridges,
      pitch12,
      rise,
      outline,
    );
    const atRidge = roofHeightMm(
      { x: 6000, y: 4000 },
      ridges,
      pitch12,
      rise,
      outline,
    );
    const mesh = tessellatePitchedRoof(outline, ridges, pitch12, 280);
    const meshHip = sampleRoofMeshHeightMm(mesh, { x: 200, y: 4000 });
    const meshRidge = sampleRoofMeshHeightMm(mesh, { x: 6000, y: 4000 });
    assert.ok(meshRidge != null && meshRidge > 1500, `mesh ridge ${meshRidge}`);
    assert.ok(
      meshHip != null && meshHip < meshRidge * 0.4,
      `mesh hip end ${meshHip} vs ridge ${meshRidge}`,
    );
    assert.ok(atRidge > 1500);
    assert.ok(atEnd < atRidge * 0.35, `hip end ${atEnd} vs ridge ${atRidge}`);
  });

  it("hip traces to corners are not treated as peaks", () => {
    const outline = rect(12000, 8000);
    const ridges = [
      {
        id: "peak",
        points: [
          { x: 2000, y: 4000 },
          { x: 10000, y: 4000 },
        ],
      },
      { id: "hip1", points: [{ x: 2000, y: 4000 }, { x: 0, y: 0 }] },
      { id: "hip2", points: [{ x: 2000, y: 4000 }, { x: 0, y: 8000 }] },
      { id: "hip3", points: [{ x: 10000, y: 4000 }, { x: 12000, y: 0 }] },
      { id: "hip4", points: [{ x: 10000, y: 4000 }, { x: 12000, y: 8000 }] },
    ];
    const peaks = peakRidges(ridges, outline);
    assert.equal(peaks.length, 1);
    assert.equal(peaks[0]?.id, "peak");
    const pitch12 = 6;
    const rise = estimateRoofRiseMm(outline, ridges, pitch12);
    const atFace = roofHeightMm(
      { x: 6000, y: 2000 },
      ridges,
      pitch12,
      rise,
      outline,
    );
    const atRidge = roofHeightMm(
      { x: 6000, y: 4000 },
      ridges,
      pitch12,
      rise,
      outline,
    );
    assert.ok(atRidge > 1500);
    assert.ok(
      atFace > atRidge * 0.35,
      `hip traces caved the face: ${atFace} vs ridge ${atRidge}`,
    );
  });

  it("L-shape with two peak ridges does not bowl", () => {
    const outline = ell();
    const ridges = [
      {
        id: "main",
        points: [
          { x: 0, y: 4000 },
          { x: 14000, y: 4000 },
        ],
      },
      {
        id: "stub",
        points: [
          { x: 4000, y: 4000 },
          { x: 4000, y: 14000 },
        ],
      },
    ];
    const pitch12 = 6;
    const rise = estimateRoofRiseMm(outline, ridges, pitch12);
    const atMainRidge = roofHeightMm(
      { x: 7000, y: 4000 },
      ridges,
      pitch12,
      rise,
      outline,
    );
    const atMainFace = roofHeightMm(
      { x: 7000, y: 2000 },
      ridges,
      pitch12,
      rise,
      outline,
    );
    const atStubFace = roofHeightMm(
      { x: 2000, y: 11000 },
      ridges,
      pitch12,
      rise,
      outline,
    );
    assert.ok(atMainRidge > 1200, `main ridge ${atMainRidge}`);
    assert.ok(
      atMainFace > atMainRidge * 0.3,
      `L main face sag ${atMainFace} vs ${atMainRidge}`,
    );
    assert.ok(
      atStubFace > rise * 0.25,
      `L stub face sag ${atStubFace} vs rise ${rise}`,
    );
    const mesh = tessellatePitchedRoof(outline, ridges, pitch12, 280);
    assert.ok(mesh.vertices.length > 20);
    assert.ok(mesh.indices.length >= 3);
    const peak = mesh.vertices.reduce((m, v) => Math.max(m, v.hMm), 0);
    assert.ok(peak > 500);
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
    const atRidge = sampleRoofMeshHeightMm(mesh, { x: 5000, y: 3500 });
    assert.ok(
      atRidge != null && atRidge > mesh.riseMm * 0.85,
      `ridge sample ${atRidge} vs rise ${mesh.riseMm}`,
    );
    const atEave = sampleRoofMeshHeightMm(mesh, { x: 5000, y: 0 });
    assert.ok(
      atEave != null && atEave < mesh.riseMm * 0.2,
      `eave sample ${atEave}`,
    );
    const atFace = sampleRoofMeshHeightMm(mesh, { x: 5000, y: 1750 });
    assert.ok(
      atFace != null && atFace > mesh.riseMm * 0.25 && atFace < mesh.riseMm * 0.85,
      `face should slope, got ${atFace} vs rise ${mesh.riseMm}`,
    );
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
