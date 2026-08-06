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
