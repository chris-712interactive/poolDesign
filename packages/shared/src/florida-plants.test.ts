import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPlaceableItem, objectLibraryForLevel } from "./object-library";
import {
  FLORIDA_PLANTS,
  PLANT_GROUPS,
  getFloridaPlant,
  isFloridaPlantId,
  isLandscapingCatalogId,
  plantDescription,
  plantsInGroup,
} from "./florida-plants";

describe("florida plants", () => {
  it("has unique ids and every group is populated", () => {
    const ids = new Set(FLORIDA_PLANTS.map((p) => p.id));
    assert.equal(ids.size, FLORIDA_PLANTS.length);
    assert.ok(FLORIDA_PLANTS.length >= 40);
    for (const group of PLANT_GROUPS) {
      assert.ok(plantsInGroup(group).length >= 6, group);
    }
    assert.ok(plantsInGroup("palms").some((p) => p.native));
    assert.ok(plantsInGroup("trees").some((p) => p.native));
  });

  it("includes signature Florida pool-yard species", () => {
    for (const id of [
      "sabal_palmetto",
      "royal_palm",
      "bismarck_palm",
      "live_oak",
      "gumbo_limbo",
      "hibiscus",
      "bird_of_paradise",
      "coontie",
    ]) {
      const plant = getFloridaPlant(id);
      assert.ok(plant, id);
      assert.equal(plant!.id, id);
      assert.ok(plant!.heightMm > 0);
      assert.ok(plant!.widthMm > 0);
    }
    assert.equal(getFloridaPlant("not_a_plant"), undefined);
    assert.equal(isFloridaPlantId("sabal_palmetto"), true);
    assert.equal(isFloridaPlantId("lounge_chair"), false);
  });

  it("treats plants, planters, and trellises as landscaping catalog items", () => {
    assert.equal(isLandscapingCatalogId("live_oak"), true);
    assert.equal(isLandscapingCatalogId("planter"), true);
    assert.equal(isLandscapingCatalogId("trellis"), true);
    assert.equal(isLandscapingCatalogId("trellis_arbor"), true);
    assert.equal(isLandscapingCatalogId("lounge_chair"), false);
  });

  it("registers every plant on the object library", () => {
    const residential = new Set(
      objectLibraryForLevel("residential").map((i) => i.id),
    );
    for (const plant of FLORIDA_PLANTS) {
      assert.ok(residential.has(plant.id), plant.id);
      const item = getPlaceableItem(plant.id);
      assert.equal(item?.category, "landscaping");
      assert.equal(item?.unitPriceCents, 0);
      assert.equal(item?.heightMm, plant.heightMm);
      assert.ok((item?.description ?? "").includes(plant.botanical));
    }
  });

  it("builds a botanical description", () => {
    const oak = getFloridaPlant("live_oak")!;
    const text = plantDescription(oak);
    assert.ok(text.includes("Quercus virginiana"));
    assert.ok(text.includes("Florida native"));
  });
});
