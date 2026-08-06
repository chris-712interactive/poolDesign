import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DESIGN_DOCUMENT_VERSION,
  normalizeDesignDocument,
  parseDesignDocument,
} from "./design-normalize";
import type { DesignDocument } from "./design-model";

describe("normalizeDesignDocument", () => {
  it("fills missing arrays and layers", () => {
    const raw = {
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [{ id: "pool", name: "pool", visible: true }],
      poolBodies: [],
      plumbingRuns: [],
    } as unknown as DesignDocument;

    const next = normalizeDesignDocument(raw);
    assert.equal(next.version, DESIGN_DOCUMENT_VERSION);
    assert.deepEqual(next.objects, []);
    assert.deepEqual(next.features, []);
    assert.deepEqual(next.buildings, []);
    assert.deepEqual(next.patioCovers, []);
    assert.ok(next.layers.some((l) => l.id === "features"));
    assert.ok(next.layers.some((l) => l.id === "equipment"));
    assert.ok(next.layers.some((l) => l.id === "house"));
    assert.ok(next.layers.some((l) => l.id === "covers"));
  });

  it("defaults spa wall/shell and opening sizes", () => {
    const raw = {
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [],
      poolBodies: [
        {
          id: "spa_1",
          name: "Spa",
          kind: "spa",
          outline: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
            { x: 1000, y: 1000 },
            { x: 0, y: 1000 },
          ],
          depthShallowMm: 900,
          depthDeepMm: 900,
        },
      ],
      buildings: [
        {
          id: "b1",
          name: "House",
          outline: [
            { x: 0, y: 0 },
            { x: 5000, y: 0 },
            { x: 5000, y: 5000 },
            { x: 0, y: 5000 },
          ],
          heightMm: 3000,
          stories: 0,
          openings: [
            {
              id: "o1",
              kind: "door",
              edgeIndex: 0,
              t: 0.5,
              widthMm: 0,
              heightMm: 0,
            },
          ],
        },
      ],
      plumbingRuns: [],
    } as unknown as DesignDocument;

    const next = normalizeDesignDocument(raw);
    const spa = next.poolBodies[0];
    assert.ok((spa.wallThicknessMm ?? 0) > 0);
    assert.ok((spa.shellHeightMm ?? 0) > 0);
    const opening = next.buildings[0].openings![0];
    assert.ok(opening.widthMm > 0);
    assert.ok(opening.heightMm > 0);
    assert.equal(next.buildings[0].stories, 1);
  });
});

describe("parseDesignDocument", () => {
  it("returns empty design for invalid JSON", () => {
    const next = parseDesignDocument("not-json", "residential", "imperial");
    assert.equal(next.version, 1);
    assert.deepEqual(next.poolBodies, []);
    assert.deepEqual(next.plumbingRuns, []);
  });

  it("normalizes valid stored JSON", () => {
    const json = JSON.stringify({
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [{ id: "pool", name: "pool", visible: true }],
      poolBodies: [],
      plumbingRuns: [{ id: "r1", name: "Run", circuit: "suction", points: [], pipeDiameterMm: 50 }],
    });
    const next = parseDesignDocument(json, "residential", "metric");
    assert.equal(next.unitSystem, "metric");
    assert.equal(next.plumbingRuns.length, 1);
    assert.ok(next.layers.some((l) => l.id === "house"));
  });
});
