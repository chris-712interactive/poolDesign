import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_POOL_WALL_THICKNESS_MM,
  emptyDesignDocument,
} from "./design-model";
import {
  buildMeasurementsHtml,
  buildPlanMeasurements,
  formatPlanMeasurement,
} from "./plan-measurements";

const FT = 304.8;

function rect(w: number, d: number, x = 0, y = 0) {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + d },
    { x, y: y + d },
  ];
}

describe("plan measurements", () => {
  it("lists pool, patio, plumbing, and bench quantities", () => {
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

    const groups = buildPlanMeasurements(design);
    const titles = groups.map((g) => g.title);
    assert.ok(titles.some((t) => t.startsWith("Pool ·")));
    assert.ok(titles.some((t) => t.startsWith("Patio ·")));
    assert.ok(titles.includes("Plumbing"));
    assert.ok(titles.includes("Patio totals by finish"));

    const pool = groups.find((g) => g.id === "body-p1")!;
    const labels = pool.rows.map((r) => r.label);
    assert.ok(labels.includes("Outside width"));
    assert.ok(labels.includes("Inside width (waterline)"));
    assert.ok(labels.includes("Outside perimeter"));
    assert.ok(labels.includes("Spa bench A perimeter"));
    assert.ok(labels.includes("Spa bench A longest side"));

    const patio = groups.find((g) => g.id === "patio-pat1")!;
    const gross = patio.rows.find((r) => r.id === "pat1-gross")!;
    const net = patio.rows.find((r) => r.id === "pat1-net")!;
    assert.ok(net.quantity < gross.quantity);
    assert.ok(net.label.toLowerCase().includes("paver"));

    const plumbing = groups.find((g) => g.id === "plumbing")!;
    const suction = plumbing.rows.find((r) => r.id === "r1-l")!;
    assert.ok(Math.abs(suction.quantity - 10 * FT) < 1);
    assert.equal(
      formatPlanMeasurement(suction, "imperial").includes("10"),
      true,
    );
  });

  it("returns nothing useful on an empty design", () => {
    const groups = buildPlanMeasurements(emptyDesignDocument("residential"));
    assert.equal(groups.length, 0);
  });

  it("renders a printable measurements sheet", () => {
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
    const html = buildMeasurementsHtml(
      {
        companyName: "Acme Pools",
        projectName: "Smith Residence",
        address: "12 Palm Ave",
      },
      buildPlanMeasurements(design, "imperial"),
      "imperial",
    );
    assert.ok(html.includes("Smith Residence"));
    assert.ok(html.includes("Pool · Pool 1"));
    assert.ok(html.includes("Outside perimeter"));
    assert.ok(html.includes("Save as PDF"));
  });
});
