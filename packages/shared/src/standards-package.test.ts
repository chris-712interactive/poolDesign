import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoolBody } from "./design-model";
import { materializeDepthStations } from "./depth-profile";
import {
  excavationVolumeCy,
  waterVolumeGal,
  wetInteriorSurfaceMm2,
} from "./depth-profile";
import {
  computePoolHydraulics,
  DEFAULT_TURNOVER_HOURS,
} from "./pool-hydraulics";
import { analyzeBarrierCompliance } from "./barrier-checks";
import { emptyDesignDocument } from "./design-model";

const FT = 304.8;
const IN = 25.4;

function rectPool(wFt: number, dFt: number): PoolBody {
  return materializeDepthStations({
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
  });
}

describe("volume / excavation", () => {
  it("computes gallons between shallow and deep estimates", () => {
    const pool = rectPool(20, 40);
    const gal = waterVolumeGal(pool);
    // Rough bounds: surface ~700 sf × 3–8 ft
    assert.ok(gal > 10_000, `gal=${gal}`);
    assert.ok(gal < 80_000, `gal=${gal}`);
    assert.ok(excavationVolumeCy(pool) > 50);
    assert.ok(wetInteriorSurfaceMm2(pool) > 0);
  });
});

describe("pool hydraulics", () => {
  it("sizes filtration from volume and 6 h turnover", () => {
    const pool = rectPool(20, 40);
    const h = computePoolHydraulics(pool)!;
    assert.ok(h.volumeGal > 0);
    assert.equal(h.turnoverHours, DEFAULT_TURNOVER_HOURS);
    assert.ok(
      Math.abs(h.filtrationGpm - h.volumeGal / (DEFAULT_TURNOVER_HOURS * 60)) <
        1,
    );
    assert.ok(h.designPumpGpm >= h.filtrationGpm);
    assert.ok(h.recommendedFilterSf >= 100);
    assert.ok(h.suctionPipeIdIn >= 1.5);
    assert.ok(h.methodNotes.length >= 4);
  });
});

describe("barrier checks", () => {
  it("warns when pool has no fence", () => {
    const design = emptyDesignDocument("residential");
    design.poolBodies = [rectPool(20, 40)];
    const report = analyzeBarrierCompliance(design);
    assert.equal(report.hasFence, false);
    assert.ok(report.findings.some((f) => f.id === "missing_fence"));
    assert.equal(report.ok, false);
  });

  it("ok when closed fence with gate encloses the pool", () => {
    const design = emptyDesignDocument("residential");
    design.poolBodies = [rectPool(20, 40)];
    const pad = 5 * FT;
    design.fences = [
      {
        id: "f1",
        name: "Barrier",
        kind: "aluminum",
        heightMm: 60 * IN,
        points: [
          { x: -pad, y: -pad },
          { x: 20 * FT + pad, y: -pad },
          { x: 20 * FT + pad, y: 40 * FT + pad },
          { x: -pad, y: 40 * FT + pad },
          { x: -pad, y: -pad },
        ],
        gates: [
          {
            id: "g1",
            kind: "swing",
            edgeIndex: 0,
            t: 0.5,
            widthMm: 36 * IN,
          },
        ],
      },
    ];
    const report = analyzeBarrierCompliance(design);
    assert.equal(report.hasFence, true);
    assert.equal(report.hasGate, true);
    assert.ok(report.findings.some((f) => f.id === "enclosed"));
    assert.equal(report.ok, true);
  });
});
