import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyDesignDocument,
  type DesignDocument,
  type PlacedObject,
  type PoolBody,
} from "./design-model";
import {
  attachFixturePlumbing,
  buildPadManifoldRuns,
  rebuildBodyPlumbing,
  syncPlumbingAfterObjectRemoved,
} from "./plumbing-route";

const FT = 304.8;

function rect(x: number, y: number, w: number, h: number) {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function baseDesign(): DesignDocument {
  const body: PoolBody = {
    id: "pool_1",
    name: "Pool 1",
    kind: "pool",
    outline: rect(0, 0, 20 * FT, 40 * FT),
    depthShallowMm: 914,
    depthDeepMm: 2438,
  };
  const pad: PlacedObject = {
    id: "pad_1",
    catalogItemId: "equip_pad",
    name: "Equipment pad",
    position: { x: 30 * FT, y: 20 * FT },
    rotationDeg: 0,
    layerId: "equipment",
    widthMm: 8 * FT,
    depthMm: 6 * FT,
  };
  return {
    ...emptyDesignDocument("residential"),
    poolBodies: [body],
    objects: [pad],
  };
}

describe("rebuildBodyPlumbing", () => {
  it("creates suction/return when a pad exists", () => {
    const next = rebuildBodyPlumbing(baseDesign(), "pool_1");
    const bodyRuns = next.plumbingRuns.filter((r) => r.parentBodyId === "pool_1");
    assert.equal(bodyRuns.some((r) => r.circuit === "suction"), true);
    assert.equal(bodyRuns.some((r) => r.circuit === "return"), true);
  });

  it("routes bubblers onto a feature circuit", () => {
    let design = baseDesign();
    design = {
      ...design,
      objects: [
        ...design.objects,
        {
          id: "bub_1",
          catalogItemId: "pool_bubbler",
          name: "Bubbler",
          position: { x: 5 * FT, y: 10 * FT },
          rotationDeg: 0,
          layerId: "features",
          widthMm: 100,
          depthMm: 100,
          parentBodyId: "pool_1",
        },
      ],
    };
    design = attachFixturePlumbing(design, {
      bodyId: "pool_1",
      position: { x: 5 * FT, y: 10 * FT },
      catalogItemId: "pool_bubbler",
    });
    const feat = design.plumbingRuns.find(
      (r) => r.parentBodyId === "pool_1" && r.circuit === "other",
    );
    assert.ok(feat);
    const last = feat!.points[feat!.points.length - 1];
    assert.ok(Math.hypot(last.x - 5 * FT, last.y - 10 * FT) < 1);
  });

  it("preserves manual runs without parentBodyId", () => {
    let design = baseDesign();
    design = {
      ...design,
      plumbingRuns: [
        {
          id: "manual_1",
          name: "Manual trench",
          circuit: "other",
          points: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
          ],
          pipeDiameterMm: 50.8,
        },
      ],
    };
    design = rebuildBodyPlumbing(design, "pool_1");
    assert.ok(design.plumbingRuns.some((r) => r.id === "manual_1"));
  });

  it("drops body feature plumbing when bubbler is removed", () => {
    let design = baseDesign();
    const bubbler: PlacedObject = {
      id: "bub_1",
      catalogItemId: "pool_bubbler",
      name: "Bubbler",
      position: { x: 5 * FT, y: 10 * FT },
      rotationDeg: 0,
      layerId: "features",
      widthMm: 100,
      depthMm: 100,
      parentBodyId: "pool_1",
    };
    design = {
      ...design,
      objects: [...design.objects, bubbler],
    };
    design = rebuildBodyPlumbing(design, "pool_1");
    assert.ok(
      design.plumbingRuns.some(
        (r) => r.parentBodyId === "pool_1" && r.circuit === "other",
      ),
    );

    design = {
      ...design,
      objects: design.objects.filter((o) => o.id !== "bub_1"),
    };
    design = syncPlumbingAfterObjectRemoved(design, bubbler);
    assert.equal(
      design.plumbingRuns.some(
        (r) => r.parentBodyId === "pool_1" && r.circuit === "other",
      ),
      false,
    );
    // Pad still present → suction/return remain
    assert.equal(
      design.plumbingRuns.some(
        (r) => r.parentBodyId === "pool_1" && r.circuit === "suction",
      ),
      true,
    );
  });

  it("clears body plumbing when pad is removed and no fixtures remain", () => {
    let design = baseDesign();
    design = rebuildBodyPlumbing(design, "pool_1");
    assert.ok(design.plumbingRuns.length > 0);
    const pad = design.objects.find((o) => o.id === "pad_1")!;
    design = {
      ...design,
      objects: design.objects.filter((o) => o.id !== "pad_1"),
    };
    design = syncPlumbingAfterObjectRemoved(design, pad);
    assert.equal(
      design.plumbingRuns.filter((r) => r.parentBodyId === "pool_1").length,
      0,
    );
  });
});

describe("pad manifold", () => {
  function equip(
    id: string,
    catalogItemId: string,
    x: number,
    y: number,
    opts?: Partial<PlacedObject>,
  ): PlacedObject {
    return {
      id,
      catalogItemId,
      name: catalogItemId,
      position: { x, y },
      rotationDeg: 0,
      layerId: "equipment",
      widthMm: 600,
      depthMm: 400,
      heightMm: 500,
      ...opts,
    };
  }

  it("builds risers and pump→filter→heater→salt hops regardless of placement order", () => {
    let design = baseDesign();
    // Place out of hydraulic order and scrambled positions
    design = {
      ...design,
      objects: [
        ...design.objects,
        equip("salt_1", "salt_chlorinator", 34 * FT, 18 * FT, {
          widthMm: 508,
          depthMm: 280,
          heightMm: 380,
        }),
        equip("heater_1", "heater_gas", 28 * FT, 24 * FT, {
          widthMm: 1016,
          depthMm: 762,
          heightMm: 1168,
        }),
        equip("pump_1", "pump_variable_speed", 32 * FT, 22 * FT, {
          widthMm: 762,
          depthMm: 432,
          heightMm: 508,
        }),
        equip("filter_1", "filter_cartridge", 36 * FT, 26 * FT, {
          widthMm: 559,
          depthMm: 559,
          heightMm: 1143,
        }),
      ],
    };
    design = rebuildBodyPlumbing(design, "pool_1");

    const padRuns = design.plumbingRuns.filter((r) => r.padLocal);
    assert.equal(padRuns.length, 5); // suction riser + 3 hops + return riser
    assert.ok(padRuns.some((r) => /suction riser/i.test(r.name)));
    assert.ok(padRuns.some((r) => /pump/i.test(r.name) && /filter/i.test(r.name)));
    assert.ok(padRuns.some((r) => /filter/i.test(r.name) && /heater/i.test(r.name)));
    assert.ok(padRuns.some((r) => /heater/i.test(r.name) && /salt/i.test(r.name)));
    assert.ok(padRuns.some((r) => /return riser/i.test(r.name)));

    for (const r of padRuns) {
      assert.ok(r.elevationsMm);
      assert.equal(r.elevationsMm!.length, r.points.length);
      // Every pad run should rise above grade at least once
      assert.ok(r.elevationsMm!.some((e) => e > 0));
      assert.ok(r.elevationsMm!.some((e) => e < 0));
    }

    const hops = buildPadManifoldRuns(design);
    assert.equal(hops.length, 5);
  });

  it("rebuilds pad manifold when equipment moves", () => {
    let design = baseDesign();
    design = {
      ...design,
      objects: [
        ...design.objects,
        equip("pump_1", "pump_variable_speed", 32 * FT, 22 * FT),
      ],
    };
    design = rebuildBodyPlumbing(design, "pool_1");
    const before = design.plumbingRuns.find((r) => r.padLocal && r.circuit === "suction")!;
    const endBefore = before.points[before.points.length - 1];

    design = {
      ...design,
      objects: design.objects.map((o) =>
        o.id === "pump_1"
          ? { ...o, position: { x: 40 * FT, y: 10 * FT } }
          : o,
      ),
    };
    design = rebuildBodyPlumbing(design, "pool_1");
    const after = design.plumbingRuns.find((r) => r.padLocal && r.circuit === "suction")!;
    const endAfter = after.points[after.points.length - 1];
    assert.ok(Math.hypot(endAfter.x - endBefore.x, endAfter.y - endBefore.y) > FT);
  });

  it("clears padLocal runs when all flow equipment is removed", () => {
    let design = baseDesign();
    const pump = equip("pump_1", "pump_variable_speed", 32 * FT, 22 * FT);
    design = { ...design, objects: [...design.objects, pump] };
    design = rebuildBodyPlumbing(design, "pool_1");
    assert.ok(design.plumbingRuns.some((r) => r.padLocal));

    design = {
      ...design,
      objects: design.objects.filter((o) => o.id !== "pump_1"),
    };
    design = syncPlumbingAfterObjectRemoved(design, pump);
    assert.equal(design.plumbingRuns.some((r) => r.padLocal), false);
  });
});
