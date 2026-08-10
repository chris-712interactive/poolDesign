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
  obstaclesFromDesign,
  routeOrthoAvoiding,
  syncPlumbingAfterObjectRemoved,
  TRENCH_ELEV_MM,
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
    }
    // Ground risers dive into the trench; equipment hops stay above grade.
    const risers = padRuns.filter((r) => /riser/i.test(r.name));
    const hops = padRuns.filter((r) => !/riser/i.test(r.name));
    assert.ok(risers.length >= 2);
    for (const r of risers) {
      assert.ok(r.elevationsMm!.some((e) => e > 0));
      assert.ok(r.elevationsMm!.some((e) => e < 0));
    }
    for (const r of hops) {
      assert.ok(r.elevationsMm!.every((e) => e > 0));
    }

    const built = buildPadManifoldRuns(design);
    assert.equal(built.length, 5);
  });

  it("drops suction/return at the pad front toward the pool", () => {
    let design = baseDesign();
    // Pool is left of pad (pad at 30ft, pool 0–20ft) → front should face −X.
    design = {
      ...design,
      objects: [
        ...design.objects,
        equip("pump_1", "pump_variable_speed", 32 * FT, 22 * FT),
        equip("filter_1", "filter_cartridge", 34 * FT, 22 * FT),
      ],
    };
    const runs = buildPadManifoldRuns(design);
    const suction = runs.find((r) => /suction riser/i.test(r.name));
    const ret = runs.find((r) => /return riser/i.test(r.name));
    assert.ok(suction && ret);

    const padX = 30 * FT;
    // Trench end of suction is the first point; return drops at the last point.
    const suctionStub = suction!.points[0];
    const returnStub = ret!.points[ret!.points.length - 1];
    assert.ok(
      suctionStub.x < padX,
      `suction stub should be on pool side of pad (got x=${suctionStub.x})`,
    );
    assert.ok(
      returnStub.x < padX,
      `return stub should be on pool side of pad (got x=${returnStub.x})`,
    );

    // Drop happens at the stub (last/first point at trench elev), after a
    // surface run that reaches the pad front (chase elev > 0 near the stub).
    const sElev = suction!.elevationsMm!;
    const rElev = ret!.elevationsMm!;
    assert.equal(sElev[0], TRENCH_ELEV_MM);
    assert.equal(rElev[rElev.length - 1], TRENCH_ELEV_MM);
    assert.ok(sElev.some((e) => e > 0));
    assert.ok(rElev.some((e) => e > 0));
    // Immediately before/after the trench point should still be above grade
    // (overhang off the front edge), not a mid-pad drop.
    assert.ok(sElev[1]! > 0);
    assert.ok(rElev[rElev.length - 2]! > 0);
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

describe("routeOrthoAvoiding obstacles", () => {
  function boxHits(
    path: { x: number; y: number }[],
    box: { minX: number; minY: number; maxX: number; maxY: number },
  ): boolean {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      const horizontal = Math.abs(a.y - b.y) < 1;
      if (horizontal) {
        if (
          a.y >= box.minY &&
          a.y <= box.maxY &&
          maxX >= box.minX &&
          minX <= box.maxX
        ) {
          return true;
        }
      } else if (
        a.x >= box.minX &&
        a.x <= box.maxX &&
        maxY >= box.minY &&
        minY <= box.maxY
      ) {
        return true;
      }
    }
    return false;
  }

  it("never routes under a house when a clear path exists", () => {
    const house = {
      outline: rect(25 * FT, 5 * FT, 20 * FT, 25 * FT),
      priority: "hard" as const,
    };
    const from = { x: 10 * FT, y: 15 * FT };
    const to = { x: 55 * FT, y: 15 * FT };
    const path = routeOrthoAvoiding(from, to, [house]);
    const box = {
      minX: 25 * FT,
      minY: 5 * FT,
      maxX: 45 * FT,
      maxY: 30 * FT,
    };
    assert.equal(boxHits(path, box), false);
  });

  it("auto body trenches go around house and patio deck", () => {
    let design: DesignDocument = {
      ...emptyDesignDocument("residential"),
      poolBodies: [
        {
          id: "p1",
          name: "Pool",
          kind: "pool",
          outline: rect(10 * FT, 25 * FT, 20 * FT, 30 * FT),
          depthShallowMm: 900,
          depthDeepMm: 1800,
        },
      ],
      buildings: [
        {
          id: "h1",
          name: "House",
          outline: rect(5 * FT, 0, 30 * FT, 20 * FT),
          stories: 1,
        },
      ],
      patios: [
        {
          id: "pat1",
          name: "Patio",
          outline: rect(8 * FT, 18 * FT, 24 * FT, 40 * FT),
        },
      ],
      objects: [
        {
          id: "pad",
          catalogItemId: "equip_pad",
          name: "Pad",
          position: { x: 45 * FT, y: 8 * FT },
          rotationDeg: 0,
          layerId: "equipment",
          widthMm: 8 * FT,
          depthMm: 4 * FT,
        },
        {
          id: "pump",
          catalogItemId: "pump_variable_speed",
          name: "Pump",
          position: { x: 45 * FT, y: 8 * FT },
          rotationDeg: 0,
          layerId: "equipment",
          widthMm: 600,
          depthMm: 400,
          heightMm: 500,
        },
      ],
    };
    design = rebuildBodyPlumbing(design, "p1");
    const CLEAR = FT;
    const blocked = obstaclesFromDesign(design).map((o) => {
      const xs = o.outline.map((p) => p.x);
      const ys = o.outline.map((p) => p.y);
      return {
        minX: Math.min(...xs) - CLEAR,
        maxX: Math.max(...xs) + CLEAR,
        minY: Math.min(...ys) - CLEAR,
        maxY: Math.max(...ys) + CLEAR,
      };
    });
    for (const r of design.plumbingRuns.filter((x) => !x.padLocal)) {
      for (const box of blocked) {
        assert.equal(
          boxHits(r.points, box),
          false,
          `${r.circuit} should not cross blocked obstacle`,
        );
      }
    }
  });
});
