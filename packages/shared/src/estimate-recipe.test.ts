import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyDesignDocument } from "./design-model";
import { DEFAULT_POOL_WALL_THICKNESS_MM } from "./design-model";
import {
  applyEstimateRecipe,
  defaultEstimateRecipe,
  parseEstimateRecipe,
} from "./estimate-recipe";
import { collectPlanQuantities } from "./plan-quantities";
import { buildTakeoff } from "./takeoff";

const FT = 304.8;

function rect(w: number, d: number, x = 0, y = 0) {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + d },
    { x, y: y + d },
  ];
}

describe("plan quantities & estimate recipe", () => {
  it("collects bench perimeter, paver net, and plumbing circuits", () => {
    const design = emptyDesignDocument("residential");
    design.poolBodies = [
      {
        id: "p1",
        name: "Pool 1",
        kind: "pool",
        outline: rect(16 * FT, 32 * FT),
        depthShallowMm: 914,
        depthDeepMm: 2438,
        wallThicknessMm: DEFAULT_POOL_WALL_THICKNESS_MM,
      },
    ];
    design.patios = [
      {
        id: "pat1",
        name: "Main deck",
        outline: rect(20 * FT, 40 * FT, -2 * FT, -4 * FT),
        materialId: "paver_herringbone_charcoal",
      },
    ];
    design.plumbingRuns = [
      {
        id: "r1",
        name: "Skimmer suction",
        circuit: "suction",
        points: [
          { x: 0, y: 0 },
          { x: 10 * FT, y: 0 },
        ],
      },
    ];
    design.features = [
      {
        id: "b1",
        kind: "bench",
        name: "Spa bench A",
        poolBodyId: "p1",
        outline: rect(8 * FT, 1.5 * FT, 2 * FT, 2 * FT),
      },
    ];

    const qty = collectPlanQuantities(design);
    assert.ok(qty.patio_paving_net_sf < qty.patio_gross_sf);
    assert.ok(qty.patio_paver_sf > 0);
    assert.ok(Math.abs(qty.plumbing_suction_lf - 10) < 0.01);
    assert.ok(qty.bench_perimeter_lf > qty.bench_longest_lf);
    assert.ok(qty.gunite_shell_sf > 0);
  });

  it("fills a custom recipe line from paver SF and seat perimeter", () => {
    const design = emptyDesignDocument("residential");
    design.poolBodies = [
      {
        id: "p1",
        name: "Pool 1",
        kind: "pool",
        outline: rect(16 * FT, 32 * FT),
        depthShallowMm: 914,
        depthDeepMm: 2438,
        wallThicknessMm: DEFAULT_POOL_WALL_THICKNESS_MM,
      },
    ];
    design.patios = [
      {
        id: "pat1",
        name: "Main deck",
        outline: rect(20 * FT, 40 * FT, -2 * FT, -4 * FT),
        materialId: "paver_herringbone_charcoal",
      },
    ];
    design.features = [
      {
        id: "b1",
        kind: "bench",
        name: "Seat",
        poolBodyId: "p1",
        outline: rect(8 * FT, 1.5 * FT, 2 * FT, 2 * FT),
      },
    ];

    const lines = applyEstimateRecipe(design, {
      version: 1,
      lines: [
        {
          id: "pavers",
          name: "Paver deck",
          category: "hardscape",
          unit: "sf",
          quantitySourceId: "patio_paver_sf",
          multiplier: 1.08,
          unitPriceCents: 1850,
          enabled: true,
        },
        {
          id: "seats",
          name: "Spa seat tile",
          category: "finish",
          unit: "lf",
          quantitySourceId: "bench_perimeter_lf",
          multiplier: 1,
          unitPriceCents: 4200,
          enabled: true,
        },
        {
          id: "permit",
          name: "Permit fee",
          category: "other",
          unit: "ea",
          quantitySourceId: "manual",
          multiplier: 1,
          manualQuantity: 1,
          unitPriceCents: 45000,
          enabled: true,
        },
      ],
    });

    const pavers = lines.find((l) => l.catalogItemId === "recipe:pavers")!;
    const seats = lines.find((l) => l.catalogItemId === "recipe:seats")!;
    const permit = lines.find((l) => l.catalogItemId === "recipe:permit")!;
    assert.ok(pavers.quantity > 0);
    assert.equal(pavers.unitPriceCents, 1850);
    assert.ok(seats.quantity > 0);
    assert.equal(permit.quantity, 1);
    assert.equal(permit.totalCents, 45000);
  });

  it("uses a saved recipe instead of the built-in takeoff mapping", () => {
    const design = emptyDesignDocument("residential");
    design.poolBodies = [
      {
        id: "p1",
        name: "Pool 1",
        kind: "pool",
        outline: rect(16 * FT, 32 * FT),
        depthShallowMm: 914,
        depthDeepMm: 2438,
        wallThicknessMm: DEFAULT_POOL_WALL_THICKNESS_MM,
      },
    ];
    const recipe = {
      version: 1 as const,
      lines: [
        {
          id: "only",
          name: "Gunite only",
          category: "structure" as const,
          unit: "sf" as const,
          quantitySourceId: "gunite_shell_sf",
          multiplier: 1,
          unitPriceCents: 999,
          enabled: true,
        },
      ],
    };
    const takeoff = buildTakeoff(design, "imperial", undefined, recipe);
    assert.equal(takeoff.lines.length, 1);
    assert.equal(takeoff.lines[0].name, "Gunite only");
  });

  it("parses recipe JSON and rejects junk", () => {
    const recipe = defaultEstimateRecipe("residential");
    const parsed = parseEstimateRecipe(JSON.stringify(recipe));
    assert.ok(parsed);
    assert.ok(parsed.lines.some((l) => l.catalogItemId === "gunite_shotcrete"));
    assert.equal(parseEstimateRecipe("nope"), null);
    assert.equal(parseEstimateRecipe("{}"), null);
  });
});
