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

  it("hip roof with corner hips has no corner spikes", () => {
    const outline = rect(12000, 8000);
    const ridges = [
      {
        id: "peak",
        points: [
          { x: 4000, y: 4000 },
          { x: 8000, y: 4000 },
        ],
      },
      { id: "hip1", points: [{ x: 4000, y: 4000 }, { x: 0, y: 0 }] },
      { id: "hip2", points: [{ x: 4000, y: 4000 }, { x: 0, y: 8000 }] },
      { id: "hip3", points: [{ x: 8000, y: 4000 }, { x: 12000, y: 0 }] },
      { id: "hip4", points: [{ x: 8000, y: 4000 }, { x: 12000, y: 8000 }] },
    ];
    const mesh = tessellatePitchedRoof(outline, ridges, 6, 280);
    assert.ok(mesh.indices.length >= 3);
    const ridgeH = sampleRoofMeshHeightMm(mesh, { x: 6000, y: 4000 });
    assert.ok(ridgeH != null && ridgeH > 1500, `ridge ${ridgeH}`);
    const cornerH = sampleRoofMeshHeightMm(mesh, { x: 250, y: 250 });
    assert.ok(
      cornerH != null && cornerH < ridgeH! * 0.25,
      `corner spike ${cornerH} vs ridge ${ridgeH}`,
    );
    const corners = [
      { x: 0, y: 0 },
      { x: 12000, y: 0 },
      { x: 12000, y: 8000 },
      { x: 0, y: 8000 },
    ];
    for (const v of mesh.vertices) {
      const dc = Math.min(
        ...corners.map((c) => Math.hypot(v.x - c.x, v.y - c.y)),
      );
      if (dc < 450) {
        assert.ok(
          v.hMm < 400,
          `vertex near corner (${v.x},${v.y}) height ${v.hMm}`,
        );
      }
    }
    const left = sampleRoofMeshHeightMm(mesh, { x: 4000, y: 4000 });
    const mid = sampleRoofMeshHeightMm(mesh, { x: 6000, y: 4000 });
    const right = sampleRoofMeshHeightMm(mesh, { x: 8000, y: 4000 });
    assert.ok(left != null && right != null && mid != null);
    assert.ok(
      Math.abs(left! - mid!) < 80 && Math.abs(right! - mid!) < 80,
      `ridge should stay level, L=${left} M=${mid} R=${right}`,
    );
    const onRidge = mesh.vertices.filter(
      (v) =>
        Math.abs(v.y - 4000) < 220 &&
        v.x > 3800 &&
        v.x < 8200 &&
        v.hMm > 400,
    );
    if (onRidge.length >= 2) {
      const hs = onRidge.map((v) => v.hMm);
      const span = Math.max(...hs) - Math.min(...hs);
      assert.ok(span < 40, `ridge not even: ${Math.min(...hs)}..${Math.max(...hs)}`);
    }
    const slope = 6 / 12;
    const oh = 280;
    for (let x = 1800; x <= 10200; x += 1400) {
      for (let y = 500; y <= 3500; y += 1000) {
        const env = Math.min(
          slope * (y + oh),
          slope * (8000 + oh - y),
          slope * (x + oh),
          slope * (12000 + oh - x),
        );
        const h = sampleRoofMeshHeightMm(mesh, { x, y });
        assert.ok(h != null, `mesh hole at ${x},${y}`);
        assert.ok(
          Math.abs(h! - env) < 70,
          `front/side bulge at (${x},${y}): mesh ${h!.toFixed(0)} vs plane ${env.toFixed(0)}`,
        );
      }
    }
    const xyH = new Map<string, number>();
    for (const v of mesh.vertices) {
      const k = `${Math.round(v.x / 10) * 10},${Math.round(v.y / 10) * 10}`;
      const prev = xyH.get(k);
      if (prev != null) {
        assert.ok(
          Math.abs(prev - v.hMm) < 20,
          `split ridge at ${k}: ${prev} vs ${v.hMm}`,
        );
      } else xyH.set(k, v.hMm);
    }
  });

  it("notched hip roof keeps the main ridge high and the notch low", () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 12000, y: 0 },
      { x: 12000, y: 5000 },
      { x: 8000, y: 5000 },
      { x: 8000, y: 8000 },
      { x: 0, y: 8000 },
    ];
    const ridges = [
      {
        id: "peak",
        points: [
          { x: 3500, y: 4000 },
          { x: 8500, y: 4000 },
        ],
      },
      { id: "hip1", points: [{ x: 3500, y: 4000 }, { x: 0, y: 0 }] },
      { id: "hip2", points: [{ x: 3500, y: 4000 }, { x: 0, y: 8000 }] },
      { id: "hip3", points: [{ x: 8500, y: 4000 }, { x: 12000, y: 0 }] },
      { id: "hip4", points: [{ x: 8500, y: 4000 }, { x: 8000, y: 8000 }] },
      {
        id: "porch",
        points: [
          { x: 9500, y: 6500 },
          { x: 11000, y: 6500 },
        ],
      },
    ];
    const mesh = tessellatePitchedRoof(outline, ridges, 6, 280);
    assert.ok(mesh.indices.length >= 3);
    const main = sampleRoofMeshHeightMm(mesh, { x: 5000, y: 4000 });
    const porch = sampleRoofMeshHeightMm(mesh, { x: 10000, y: 6500 });
    assert.ok(main != null && main > 1200, `main ridge ${main}`);
    if (porch != null) {
      assert.ok(porch < main! * 0.85, `porch as high as main: ${porch} vs ${main}`);
    }
    const along = [3500, 5000, 6500, 8500].map((x) =>
      sampleRoofMeshHeightMm(mesh, { x, y: 4000 }),
    );
    const ridgeMax = along.reduce((m, h) => Math.max(m, h ?? 0), 0);
    for (let i = 0; i < along.length; i++) {
      const h = along[i];
      assert.ok(
        h != null && h > ridgeMax * 0.9,
        `ridge trough at x=${[3500, 5000, 6500, 8500][i]}: ${h} vs ${ridgeMax}`,
      );
    }
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

  it("a line drawn on the eave is not lifted into a ridge", () => {
    const outline = rect(12000, 8000);
    const ridges = [
      {
        id: "peak",
        points: [
          { x: 4000, y: 4000 },
          { x: 8000, y: 4000 },
        ],
      },
      { id: "hip1", points: [{ x: 4000, y: 4000 }, { x: 0, y: 0 }] },
      { id: "hip2", points: [{ x: 4000, y: 4000 }, { x: 0, y: 8000 }] },
      { id: "hip3", points: [{ x: 8000, y: 4000 }, { x: 12000, y: 0 }] },
      { id: "hip4", points: [{ x: 8000, y: 4000 }, { x: 12000, y: 8000 }] },
      {
        id: "eave_trace",
        points: [
          { x: 2000, y: 8000 },
          { x: 6000, y: 8000 },
        ],
      },
    ];
    const peaks = peakRidges(ridges, outline);
    assert.ok(
      peaks.every((r) => r.id !== "eave_trace"),
      "eave trace treated as a peak",
    );
    const mesh = tessellatePitchedRoof(outline, ridges, 6, 280);
    const ridgeH = sampleRoofMeshHeightMm(mesh, { x: 6000, y: 4000 });
    const eaveH = sampleRoofMeshHeightMm(mesh, { x: 4000, y: 7800 });
    assert.ok(ridgeH != null && ridgeH > 1500, `ridge ${ridgeH}`);
    if (eaveH != null) {
      assert.ok(
        eaveH < ridgeH! * 0.35,
        `eave line inverted into a ridge: ${eaveH} vs ${ridgeH}`,
      );
    }
  });

  it("a T of two peak ridges stays high, not a valley", () => {
    const outline = rect(12000, 8000);
    const ridges = [
      {
        id: "main",
        points: [
          { x: 4000, y: 4000 },
          { x: 8000, y: 4000 },
        ],
      },
      {
        id: "stub",
        points: [
          { x: 4000, y: 4000 },
          { x: 4000, y: 6200 },
        ],
      },
      { id: "hip1", points: [{ x: 4000, y: 4000 }, { x: 0, y: 0 }] },
      { id: "hip2", points: [{ x: 4000, y: 6200 }, { x: 0, y: 8000 }] },
      { id: "hip3", points: [{ x: 8000, y: 4000 }, { x: 12000, y: 0 }] },
      { id: "hip4", points: [{ x: 8000, y: 4000 }, { x: 12000, y: 8000 }] },
    ];
    const mesh = tessellatePitchedRoof(outline, ridges, 6, 280);
    const main = sampleRoofMeshHeightMm(mesh, { x: 6000, y: 4000 });
    const stub = sampleRoofMeshHeightMm(mesh, { x: 4000, y: 5100 });
    const atEave = sampleRoofMeshHeightMm(mesh, { x: 6000, y: 200 });
    assert.ok(main != null && main > 1500, `main ridge ${main}`);
    assert.ok(
      stub != null && stub > main! * 0.75,
      `vertical ridge became a trough: ${stub} vs main ${main}`,
    );
    if (atEave != null) {
      assert.ok(atEave < main! * 0.3, `eave ${atEave} vs ridge ${main}`);
    }
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
    assert.ok(mesh.vertices.length >= 6);
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
    assert.ok(mesh.vertices.length >= 6);
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
    const left = sampleRoofMeshHeightMm(mesh, { x: 200, y: 3500 });
    const right = sampleRoofMeshHeightMm(mesh, { x: 9800, y: 3500 });
    assert.ok(
      left != null && right != null && Math.abs(left! - right!) < 80,
      `gable ridge should stay level, L=${left} R=${right}`,
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
