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
    assert.ok(next.layers.some((l) => l.id === "fence"));
    assert.deepEqual(next.fences, []);
    assert.equal(next.northDeg, 0);
  });

  it("wraps true-north bearing into 0..360", () => {
    const raw = {
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [],
      poolBodies: [],
      plumbingRuns: [],
      northDeg: -90,
    } as unknown as DesignDocument;
    assert.equal(normalizeDesignDocument(raw).northDeg, 270);
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
    assert.equal(next.buildings[0].ceilingHeightMm, 2438.4);
  });

  it("defaults pool wall thickness", () => {
    const raw = {
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [],
      poolBodies: [
        {
          id: "pool1",
          name: "Pool 1",
          kind: "pool",
          outline: [
            { x: 0, y: 0 },
            { x: 10000, y: 0 },
            { x: 10000, y: 5000 },
            { x: 0, y: 5000 },
          ],
          depthShallowMm: 900,
          depthDeepMm: 2400,
        },
      ],
      patios: [],
      buildings: [],
      patioCovers: [],
      features: [],
      objects: [],
      plumbingRuns: [],
    } as unknown as DesignDocument;

    const next = normalizeDesignDocument(raw);
    const pool = next.poolBodies[0];
    assert.equal(pool.wallThicknessMm, 200);
  });

  it("clamps spa spillover fields", () => {
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
          spillover: {
            enabled: true,
            style: "scuppers",
            scupperCount: 99,
            edgeIndex: 0,
            widthMm: -10,
            notchDepthMm: 1,
            scupperGapMm: 1,
          },
        },
      ],
      plumbingRuns: [],
    } as unknown as DesignDocument;

    const next = normalizeDesignDocument(raw);
    const s = next.poolBodies[0].spillover!;
    assert.equal(s.enabled, true);
    assert.equal(s.style, "scuppers");
    assert.equal(s.scupperCount, 8);
    assert.ok(s.weirs?.length);
    assert.ok((s.weirs![0].widthMm ?? 0) >= 50);
    assert.ok((s.notchDepthMm ?? 0) >= 5);
    assert.ok((s.scupperGapMm ?? 0) >= 10);
  });

  it("clamps pool infinity-edge fields", () => {
    const raw = {
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [],
      poolBodies: [
        {
          id: "pool_1",
          name: "Pool",
          kind: "pool",
          outline: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 12000 },
            { x: 0, y: 12000 },
          ],
          depthShallowMm: 900,
          depthDeepMm: 2400,
          infinityEdge: {
            enabled: true,
            style: "sheer",
            scupperCount: 99,
            notchDepthMm: 1,
            scupperGapMm: 1,
            weirs: [{ edgeIndex: 0, enabled: true, widthMm: -5 }],
            trough: { widthMm: 10, depthMm: 20, waterDepthMm: 5 },
            flowGpmOverride: -10,
            surgeGalOverride: 999999,
          },
        },
      ],
      plumbingRuns: [],
    } as unknown as DesignDocument;

    const next = normalizeDesignDocument(raw);
    const ie = next.poolBodies[0].infinityEdge!;
    assert.equal(ie.enabled, true);
    assert.equal(ie.style, "sheer");
    assert.equal(ie.scupperCount, 8);
    assert.ok(ie.weirs?.length);
    assert.ok((ie.weirs![0].widthMm ?? 0) >= 50);
    assert.ok((ie.notchDepthMm ?? 0) >= 5);
    assert.ok((ie.trough?.widthMm ?? 0) >= 100);
    assert.equal(ie.flowGpmOverride, 0);
    assert.ok((ie.surgeGalOverride ?? 0) <= 50_000);
    assert.equal(next.poolBodies[0].spillover, undefined);
  });

  it("drops infinity edge on spas and spillover on pools", () => {
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
          infinityEdge: { enabled: true, weirs: [{ edgeIndex: 0 }] },
          spillover: { enabled: true },
        },
      ],
      plumbingRuns: [],
    } as unknown as DesignDocument;

    const next = normalizeDesignDocument(raw);
    assert.equal(next.poolBodies[0].infinityEdge, undefined);
    assert.ok(next.poolBodies[0].spillover);
  });

  it("migrates legacy dining_table_set to round tabletop sizing", () => {
    const FT = 304.8;
    const raw = {
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [],
      poolBodies: [],
      objects: [
        {
          id: "d1",
          catalogItemId: "dining_table_set",
          name: "Dining table set",
          position: { x: 0, y: 0 },
          rotationDeg: 0,
          layerId: "furniture",
          widthMm: 6 * FT,
          depthMm: 6 * FT,
        },
      ],
      plumbingRuns: [],
    } as unknown as DesignDocument;

    const next = normalizeDesignDocument(raw);
    const obj = next.objects[0];
    assert.equal(obj.catalogItemId, "dining_table_round");
    assert.ok(obj.widthMm < 6 * FT);
    assert.equal(obj.widthMm, obj.depthMm);
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
