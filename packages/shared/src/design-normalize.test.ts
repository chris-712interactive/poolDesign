import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DESIGN_DOCUMENT_VERSION,
  normalizeDesignDocument,
  parseDesignDocument,
} from "./design-normalize";
import type { DesignDocument } from "./design-model";
import { DEFAULT_POOL_WALL_THICKNESS_MM } from "./design-model";

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
    assert.ok(next.layers.some((l) => l.id === "survey"));
    assert.ok(next.layers.some((l) => l.id === "grade"));
    assert.ok(next.layers.some((l) => l.id === "property"));
    assert.ok(next.layers.some((l) => l.id === "easement"));
    assert.equal(
      next.layers.some((l) => l.id === "site"),
      false,
    );
    assert.equal(next.surveyUnderlay, undefined);
    assert.deepEqual(next.fences, []);
    assert.deepEqual(next.siteLines, []);
    assert.deepEqual(next.presentationCameras, []);
    assert.equal(next.northDeg, 0);
  });

  it("splits a legacy site layer into property and easement", () => {
    const next = normalizeDesignDocument({
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [{ id: "site", name: "site", visible: false }],
      poolBodies: [],
      plumbingRuns: [],
    } as unknown as DesignDocument);
    const property = next.layers.find((l) => l.id === "property");
    const easement = next.layers.find((l) => l.id === "easement");
    assert.equal(property?.visible, false);
    assert.equal(easement?.visible, false);
    assert.equal(
      next.layers.some((l) => l.id === "site"),
      false,
    );
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
    assert.equal(next.buildings[0].exteriorSidingId, "stucco");
  });

  it("normalizes house siding and trims per-story exteriors", () => {
    const raw = {
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [],
      poolBodies: [],
      buildings: [
        {
          id: "b2",
          name: "House",
          outline: [
            { x: 0, y: 0 },
            { x: 5000, y: 0 },
            { x: 5000, y: 5000 },
            { x: 0, y: 5000 },
          ],
          stories: 2,
          exteriorSidingId: "brick",
          storyExteriors: [
            { exteriorSidingId: "stucco" },
            { exteriorSidingId: "lap", exteriorFinishId: "house_navy" },
            { exteriorSidingId: "shake" },
          ],
        },
      ],
      plumbingRuns: [],
    } as unknown as DesignDocument;

    const next = normalizeDesignDocument(raw);
    const house = next.buildings[0];
    assert.equal(house.stories, 2);
    assert.equal(house.exteriorSidingId, "brick");
    assert.equal(house.storyExteriors?.length, 2);
    assert.equal(house.storyExteriors?.[0].exteriorSidingId, "stucco");
    assert.equal(house.storyExteriors?.[1].exteriorSidingId, "lap");
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
    assert.equal(pool.wallThicknessMm, DEFAULT_POOL_WALL_THICKNESS_MM);
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

describe("flower beds", () => {
  it("normalizes tilled and raised beds and drops invalid outlines", () => {
    const raw = {
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [],
      poolBodies: [],
      patios: [],
      flowerBeds: [
        {
          id: "bed_1",
          name: "  ",
          style: "tilled",
          outline: [
            { x: 0, y: 0 },
            { x: 2000, y: 0 },
            { x: 2000, y: 1500 },
            { x: 0, y: 1500 },
          ],
        },
        {
          id: "bed_2",
          name: "Herb box",
          style: "raised",
          heightMm: 9999,
          wallFinish: "brick",
          outline: [
            { x: 0, y: 0 },
            { x: 1200, y: 0 },
            { x: 1200, y: 800 },
            { x: 0, y: 800 },
          ],
        },
        { id: "skip", name: "too small", style: "tilled", outline: [{ x: 0, y: 0 }] },
      ],
      buildings: [],
      patioCovers: [],
      features: [],
      objects: [],
      plumbingRuns: [],
    } as unknown as DesignDocument;

    const next = normalizeDesignDocument(raw);
    assert.equal(next.flowerBeds?.length, 2);
    assert.equal(next.flowerBeds?.[0].style, "tilled");
    assert.equal(next.flowerBeds?.[0].name, "Flower bed");
    assert.equal(next.flowerBeds?.[0].heightMm, undefined);
    assert.equal(next.flowerBeds?.[1].style, "raised");
    assert.equal(next.flowerBeds?.[1].wallFinish, "timber");
    assert.ok((next.flowerBeds?.[1].heightMm ?? 0) <= 914.4);
    assert.ok((next.flowerBeds?.[1].heightMm ?? 0) >= 152.4);
  });
});

describe("grade samples", () => {
  it("gives duplicate ids unique values so each mark is independently selectable", () => {
    const raw = {
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [],
      poolBodies: [],
      patios: [],
      buildings: [],
      patioCovers: [],
      features: [],
      objects: [],
      plumbingRuns: [],
      gradeSamples: [
        { id: "ar_grade_0_3048", position: { x: 0, y: 0 }, dropMm: 304.8 },
        { id: "ar_grade_0_3048", position: { x: 4000, y: 0 }, dropMm: 304.8 },
        { id: "grade_ok", position: { x: 8000, y: 0 }, dropMm: 150 },
      ],
    } as unknown as DesignDocument;

    const next = normalizeDesignDocument(raw);
    const ids = (next.gradeSamples ?? []).map((s) => s.id);
    assert.equal(ids.length, 3);
    assert.equal(new Set(ids).size, 3);
    assert.equal(ids.includes("grade_ok"), true);
    assert.equal(ids.filter((id) => id === "ar_grade_0_3048").length, 1);
  });
});

describe("presentation cameras", () => {
  it("sorts, names, and reindexes cameras", () => {
    const raw = {
      version: 1,
      designLevel: "residential",
      unitSystem: "imperial",
      layers: [],
      poolBodies: [],
      patios: [],
      buildings: [],
      patioCovers: [],
      features: [],
      objects: [],
      plumbingRuns: [],
      presentationCameras: [
        {
          id: "cam_b",
          name: "  ",
          position: { x: 1000, y: 0 },
          rotationDeg: 400,
          sortIndex: 5,
        },
        {
          id: "cam_a",
          name: "Lanai",
          position: { x: 0, y: 0 },
          rotationDeg: -90,
          sortIndex: 1,
          lookDistanceMm: 50,
        },
        { id: "skip" },
      ],
    } as unknown as DesignDocument;

    const next = normalizeDesignDocument(raw);
    assert.equal(next.presentationCameras?.length, 2);
    assert.equal(next.presentationCameras?.[0].id, "cam_a");
    assert.equal(next.presentationCameras?.[0].name, "Lanai");
    assert.equal(next.presentationCameras?.[0].sortIndex, 0);
    assert.equal(next.presentationCameras?.[0].rotationDeg, 270);
    assert.ok((next.presentationCameras?.[0].lookDistanceMm ?? 0) >= 3048);
    assert.equal(next.presentationCameras?.[1].id, "cam_b");
    assert.equal(next.presentationCameras?.[1].name, "Camera 2");
    assert.equal(next.presentationCameras?.[1].sortIndex, 1);
    assert.equal(next.presentationCameras?.[1].rotationDeg, 40);
  });
});
