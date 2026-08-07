import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultFabricFinishId,
  defaultFrameFinishId,
  furnitureFinishRoles,
  getFurnitureFinish,
  isFurnitureFinishId,
} from "./furniture-finishes";

describe("furniture finishes", () => {
  it("assigns frame + fabric roles to dining and lounge", () => {
    assert.deepEqual(furnitureFinishRoles("dining_table_rect"), {
      frame: true,
      fabric: true,
      canopy: false,
    });
    assert.deepEqual(furnitureFinishRoles("lounge_chair"), {
      frame: true,
      fabric: true,
      canopy: false,
    });
    assert.deepEqual(furnitureFinishRoles("umbrella"), {
      frame: false,
      fabric: false,
      canopy: true,
    });
    assert.deepEqual(furnitureFinishRoles("person_scale"), {
      frame: false,
      fabric: false,
      canopy: false,
    });
  });

  it("resolves defaults and known ids", () => {
    assert.ok(isFurnitureFinishId("wood_teak"));
    assert.equal(getFurnitureFinish("fabric_navy").kind, "fabric");
    assert.equal(defaultFrameFinishId("sofa_outdoor"), "wood_teak");
    assert.equal(defaultFabricFinishId("umbrella"), "canvas_sand");
  });
});
