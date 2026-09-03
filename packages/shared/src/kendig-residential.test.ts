import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kendigResidentialDesign } from "./kendig-residential";
import { getPlaceableItem } from "./object-library";
import { buildTakeoff } from "./takeoff";

describe("kendigResidentialDesign", () => {
  const design = kendigResidentialDesign();

  it("is a complete residential backyard", () => {
    assert.equal(design.designLevel, "residential");
    assert.ok(design.poolBodies.some((b) => b.kind === "pool"));
    assert.ok(design.poolBodies.some((b) => b.kind === "spa"));
    assert.ok(design.patios.length >= 1);
    assert.ok(design.fences && design.fences.length >= 1);
    assert.ok(design.buildings.some((b) => b.kind === "house"));
    assert.ok(design.objects.some((o) => o.catalogItemId === "equip_pad"));
    assert.ok(design.objects.some((o) => o.catalogItemId === "sabal_palmetto"));
    assert.ok(design.poolBodies[0]?.waterlineTileId);
    assert.ok(design.patios[0]?.materialId);
  });

  it("only places catalog objects that exist", () => {
    for (const obj of design.objects) {
      assert.ok(getPlaceableItem(obj.catalogItemId), obj.catalogItemId);
    }
  });

  it("produces a takeoff with billed structure lines", () => {
    const takeoff = buildTakeoff(design);
    assert.ok(takeoff.lines.some((line) => line.lineKey.startsWith("gunite")));
    assert.ok(takeoff.lines.length > 3);
  });
});
