import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyDesignDocument } from "./design-model";
import { buildTakeoff, takeoffLineKey } from "./takeoff";

const FT = 304.8;

function rect(w: number, d: number) {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ];
}

describe("buildTakeoff", () => {
  it("excludes furniture from the estimate", () => {
    const design = emptyDesignDocument("residential");
    design.poolBodies = [
      {
        id: "p1",
        name: "Pool",
        outline: rect(20 * FT, 40 * FT),
        depthShallowMm: 3 * FT,
        depthDeepMm: 8 * FT,
        kind: "pool",
      },
    ];
    design.objects = [
      {
        id: "o1",
        catalogItemId: "lounge_chair",
        name: "Lounge chair",
        position: { x: 0, y: 0 },
        rotationDeg: 0,
        layerId: "furniture",
        widthMm: 2 * FT,
        depthMm: 6 * FT,
      },
      {
        id: "o2",
        catalogItemId: "dining_table_rect",
        name: "Dining set",
        position: { x: 1000, y: 1000 },
        rotationDeg: 0,
        layerId: "furniture",
        widthMm: 6 * FT,
        depthMm: 3.5 * FT,
      },
      {
        id: "o3",
        catalogItemId: "planter",
        name: "Planter",
        position: { x: 2000, y: 0 },
        rotationDeg: 0,
        layerId: "furniture",
        widthMm: 2 * FT,
        depthMm: 2 * FT,
      },
    ];

    const takeoff = buildTakeoff(design, "imperial");
    assert.ok(!takeoff.lines.some((l) => l.catalogItemId === "lounge_chair"));
    assert.ok(
      !takeoff.lines.some((l) => l.catalogItemId === "dining_table_rect"),
    );
    assert.ok(takeoff.lines.some((l) => l.catalogItemId === "planter"));
  });

  it("honors removed auto lines and custom adds", () => {
    const design = emptyDesignDocument("residential");
    design.poolBodies = [
      {
        id: "p1",
        name: "Pool",
        outline: rect(20 * FT, 40 * FT),
        depthShallowMm: 3 * FT,
        depthDeepMm: 8 * FT,
        kind: "pool",
      },
    ];
    const base = buildTakeoff(design, "imperial");
    const labor = base.lines.find((l) => l.catalogItemId === "labor_install");
    assert.ok(labor);

    design.estimate = {
      removedLineKeys: [labor!.lineKey],
      customLines: [
        {
          id: "c1",
          name: "Permits",
          category: "other",
          unit: "ea",
          quantity: 1,
          unitPriceCents: 50000,
        },
      ],
    };

    const next = buildTakeoff(design, "imperial");
    assert.ok(!next.lines.some((l) => l.catalogItemId === "labor_install"));
    assert.ok(next.removedLines.some((l) => l.catalogItemId === "labor_install"));
    const custom = next.lines.find((l) => l.lineKey === "custom:c1");
    assert.ok(custom);
    assert.equal(custom!.totalCents, 50000);
    assert.equal(custom!.custom, true);
  });

  it("builds a stable line key from catalog id and note", () => {
    assert.equal(takeoffLineKey("coping"), "coping");
    assert.equal(
      takeoffLineKey("plaster_interior", "Pool"),
      "plaster_interior::Pool",
    );
  });
});
