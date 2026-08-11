import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoolBody } from "./design-model";
import {
  computeInfinityHydraulics,
  EDGE_PUMP_MARGIN,
  GPM_PER_LF_BY_STYLE,
  infinityTroughLf,
  MIN_SURGE_GAL,
  SURGE_GAL_PER_SF,
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

  it("sizes flow, trough, surge, and pump from weir length", () => {
    const weirFt = 20;
    const troughW = 2; // ft
    const troughWater = 1.5; // ft
    const pool = rectPool(20, 40, {
      enabled: true,
      style: "sheet",
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
    assert.ok(Math.abs(h!.weirLf - weirFt) < 0.2);
    assert.ok(
      Math.abs(h!.edgeFlowGpm - weirFt * GPM_PER_LF_BY_STYLE.sheet) < 2,
    );
    const expectedTrough =
      weirFt * troughW * troughWater * 7.48052;
    assert.ok(Math.abs(h!.troughVolumeGal - expectedTrough) < 5);
    assert.ok(h!.displacementSurgeGal > 0);
    assert.ok(
      h!.recommendedSurgeGal >=
        Math.max(h!.troughVolumeGal, h!.displacementSurgeGal, MIN_SURGE_GAL) -
          1,
    );
    assert.equal(
      h!.edgePumpGpm,
      Math.ceil(h!.designFlowGpm * EDGE_PUMP_MARGIN),
    );
    assert.ok(Math.abs(infinityTroughLf(pool) - weirFt) < 0.2);
  });

  it("uses sheer GPM/lf and honors overrides", () => {
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
    assert.ok(h!.edgeFlowGpm > 0);
    assert.equal(h!.designFlowGpm, 250);
    assert.equal(h!.recommendedSurgeGal, 900);
    assert.equal(h!.edgePumpGpm, Math.ceil(250 * EDGE_PUMP_MARGIN));
    assert.equal(h!.flowOverridden, true);
    assert.equal(h!.surgeOverridden, true);
  });

  it("scales displacement surge with pool surface", () => {
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
    assert.ok(large.displacementSurgeGal > small.displacementSurgeGal);
    assert.ok(large.poolSurfaceSf * SURGE_GAL_PER_SF > 100);
  });
});
