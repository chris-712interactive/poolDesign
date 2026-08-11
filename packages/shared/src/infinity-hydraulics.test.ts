import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoolBody } from "./design-model";
import {
  computeInfinityHydraulics,
  DEFAULT_DESIGN_HEAD_IN,
  DEFAULT_SURGE_DISPLACEMENT_IN,
  EDGE_PUMP_MARGIN,
  francisWeirGpm,
  hazenWilliamsHeadFt,
  infinityTroughLf,
  pipeVelocityFps,
  recommendPipeIdIn,
  SUCTION_VELOCITY_FPS,
  surfaceDisplacementGal,
} from "./infinity-hydraulics";

const FT = 304.8;
const IN = 25.4;

function rectPool(
  wFt: number,
  dFt: number,
  infinityEdge?: PoolBody["infinityEdge"],
): PoolBody {
  return {
    id: "p1",
    name: "Pool",
    kind: "pool",
    outline: [
      { x: 0, y: 0 },
      { x: wFt * FT, y: 0 },
      { x: wFt * FT, y: dFt * FT },
      { x: 0, y: dFt * FT },
    ],
    depthShallowMm: 3 * FT,
    depthDeepMm: 8 * FT,
    wallThicknessMm: 8 * IN,
    infinityEdge,
  };
}

describe("Francis weir formula", () => {
  it("matches ~4.5 GPM/lf at ¼″ head with end contractions", () => {
    const q = francisWeirGpm(1, 0.25, 2);
    assert.ok(Math.abs(q - 4.5) < 0.05, `got ${q}`);
  });

  it("scales with length and head", () => {
    const q20 = francisWeirGpm(20, 0.25, 2);
    const q1 = francisWeirGpm(1, 0.25, 2);
    assert.ok(Math.abs(q20 - q1 * 20) < 0.5);
    const qHalf = francisWeirGpm(10, 0.5, 2);
    const qQuarter = francisWeirGpm(10, 0.25, 2);
    assert.ok(qHalf > qQuarter * 2.5);
  });

  it("reproduces Gutai waterfall example (~179 GPM)", () => {
    // 5 ft weir, 1″ head, n=2 → ~179 GPM
    const q = francisWeirGpm(5, 1, 2);
    assert.ok(Math.abs(q - 179) < 2, `got ${q}`);
  });
});

describe("pipe / Hazen–Williams helpers", () => {
  it("recommends larger pipe for higher flow at suction velocity", () => {
    const small = recommendPipeIdIn(40, SUCTION_VELOCITY_FPS);
    const large = recommendPipeIdIn(200, SUCTION_VELOCITY_FPS);
    assert.ok(large >= small);
    assert.ok(pipeVelocityFps(200, large) <= SUCTION_VELOCITY_FPS + 0.05);
  });

  it("increases friction with flow and length", () => {
    const a = hazenWilliamsHeadFt({
      flowGpm: 100,
      lengthFt: 50,
      diameterIn: 2,
    });
    const b = hazenWilliamsHeadFt({
      flowGpm: 200,
      lengthFt: 50,
      diameterIn: 2,
    });
    const c = hazenWilliamsHeadFt({
      flowGpm: 100,
      lengthFt: 100,
      diameterIn: 2,
    });
    assert.ok(b > a);
    assert.ok(c > a);
  });
});

describe("infinity hydraulics", () => {
  it("returns null when no weirs are enabled", () => {
    assert.equal(computeInfinityHydraulics(rectPool(20, 40)), null);
    assert.equal(
      computeInfinityHydraulics(
        rectPool(20, 40, { enabled: true, weirs: [] }),
      ),
      null,
    );
  });

  it("sizes Francis flow, 2″ surge, trough, TDH, and pump", () => {
    const weirFt = 20;
    const troughW = 2;
    const troughWater = 1.5;
    const pool = rectPool(20, 40, {
      enabled: true,
      style: "sheet",
      designHeadIn: 0.25,
      endContractions: 2,
      weirs: [
        {
          edgeIndex: 0,
          enabled: true,
          widthMm: weirFt * FT,
          offsetMm: 0,
        },
      ],
      trough: {
        widthMm: troughW * FT,
        depthMm: 30 * IN,
        waterDepthMm: troughWater * FT,
      },
    });

    const h = computeInfinityHydraulics(pool);
    assert.ok(h);
    assert.equal(h!.designHeadIn, DEFAULT_DESIGN_HEAD_IN.sheet);
    assert.equal(h!.surgeDisplacementIn, DEFAULT_SURGE_DISPLACEMENT_IN);
    assert.ok(Math.abs(h!.weirLf - weirFt) < 0.2);
    const expectedFrancis = francisWeirGpm(weirFt, 0.25, 2);
    assert.ok(Math.abs(h!.edgeFlowGpm - expectedFrancis) < 1);
    const expectedTrough = weirFt * troughW * troughWater * 7.48052;
    assert.ok(Math.abs(h!.troughVolumeGal - expectedTrough) < 5);
    const expectedSurge = surfaceDisplacementGal(
      h!.poolSurfaceSf,
      DEFAULT_SURGE_DISPLACEMENT_IN,
    );
    assert.ok(Math.abs(h!.displacementSurgeGal - expectedSurge) < 2);
    assert.ok(h!.recommendedSurgeGal >= h!.displacementSurgeGal - 1);
    assert.equal(
      h!.edgePumpGpm,
      Math.ceil(h!.designFlowGpm * EDGE_PUMP_MARGIN),
    );
    assert.ok(h!.estimatedTdhFt > h!.staticLiftFt);
    assert.ok(h!.suctionPipeIdIn >= 1.5);
    assert.ok(h!.methodNotes.length >= 4);
    assert.ok(Math.abs(infinityTroughLf(pool) - weirFt) < 0.2);
  });

  it("uses sheer default head and honors overrides", () => {
    const pool = rectPool(16, 32, {
      enabled: true,
      style: "sheer",
      weirs: [{ edgeIndex: 2, enabled: true, widthMm: 16 * FT }],
      flowGpmOverride: 250,
      surgeGalOverride: 900,
    });
    const h = computeInfinityHydraulics(pool);
    assert.ok(h);
    assert.equal(h!.style, "sheer");
    assert.equal(h!.designHeadIn, DEFAULT_DESIGN_HEAD_IN.sheer);
    assert.ok(h!.edgeFlowGpm > 0);
    assert.equal(h!.designFlowGpm, 250);
    assert.equal(h!.recommendedSurgeGal, 900);
    assert.equal(h!.edgePumpGpm, Math.ceil(250 * EDGE_PUMP_MARGIN));
    assert.equal(h!.flowOverridden, true);
    assert.equal(h!.surgeOverridden, true);
  });

  it("flags trough shortfall when operating volume < 2″ surge", () => {
    // Tiny trough vs large pool surface.
    const pool = rectPool(30, 60, {
      enabled: true,
      style: "sheet",
      weirs: [{ edgeIndex: 0, enabled: true, widthMm: 10 * FT }],
      trough: {
        widthMm: 12 * IN,
        depthMm: 18 * IN,
        waterDepthMm: 6 * IN,
      },
    });
    const h = computeInfinityHydraulics(pool)!;
    assert.ok(h.troughShortfall, "expected trough shortfall flag");
    assert.ok(h.troughShortfallGal > 50);
  });

  it("scales displacement surge with pool surface at 2″", () => {
    const small = computeInfinityHydraulics(
      rectPool(10, 20, {
        enabled: true,
        weirs: [{ edgeIndex: 0, enabled: true }],
      }),
    )!;
    const large = computeInfinityHydraulics(
      rectPool(30, 60, {
        enabled: true,
        weirs: [{ edgeIndex: 0, enabled: true }],
      }),
    )!;
    assert.ok(large.displacementSurgeGal > small.displacementSurgeGal * 2);
    assert.ok(
      Math.abs(
        large.displacementSurgeGal -
          surfaceDisplacementGal(large.poolSurfaceSf, 2),
      ) < 2,
    );
  });
});
