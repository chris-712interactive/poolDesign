import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PatioCover, PlacedObject, PoolFeature } from "./design-model";
import {
  isCoverAccessoryId,
  isSunshelfLayoutId,
  isUmbrellaSleeveId,
  objectLibraryForLevel,
} from "./object-library";
import {
  resolvePlacePosition,
  snapToPatioCover,
  snapToSunshelf,
  snapUmbrellaToSleeve,
} from "./place-snap";

function rect(x0: number, y0: number, x1: number, y1: number) {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

describe("cover / sunshelf placement", () => {
  it("exposes new items in the residential library", () => {
    const ids = objectLibraryForLevel("residential").map((i) => i.id);
    for (const id of [
      "cover_fan",
      "cover_light",
      "sunshelf_chaise",
      "sunshelf_table",
      "umbrella_sleeve",
    ]) {
      assert.ok(ids.includes(id), `missing ${id}`);
    }
    assert.equal(isCoverAccessoryId("cover_fan"), true);
    assert.equal(isSunshelfLayoutId("sunshelf_chaise"), true);
    assert.equal(isUmbrellaSleeveId("umbrella_sleeve"), true);
    assert.equal(isCoverAccessoryId("lounge_chair"), false);
  });

  it("snaps a fan onto a patio cover", () => {
    const covers: PatioCover[] = [
      {
        id: "c1",
        name: "Pergola",
        kind: "pergola",
        outline: rect(0, 0, 4000, 3000),
      },
    ];
    const inside = snapToPatioCover(covers, { x: 1200, y: 900 });
    assert.ok(inside);
    assert.equal(inside!.coverId, "c1");
    assert.equal(inside!.position.x, 1200);

    const near = snapToPatioCover(covers, { x: -200, y: 1500 });
    assert.ok(near);
    assert.ok(near!.position.x > 0);

    const far = snapToPatioCover(covers, { x: 20000, y: 20000 });
    assert.equal(far, null);
  });

  it("snaps a pole holder onto a sunshelf", () => {
    const features: PoolFeature[] = [
      {
        id: "s1",
        kind: "sunshelf",
        name: "Sunshelf",
        outline: rect(0, 0, 2500, 1800),
      },
    ];
    const inside = snapToSunshelf(features, { x: 800, y: 400 });
    assert.ok(inside);
    assert.equal(inside!.featureId, "s1");

    const miss = snapToSunshelf(features, { x: 9000, y: 9000 });
    assert.equal(miss, null);
  });

  it("seats an umbrella in a nearby pole holder", () => {
    const objects: PlacedObject[] = [
      {
        id: "sleeve",
        catalogItemId: "umbrella_sleeve",
        name: "Sleeve",
        position: { x: 1000, y: 500 },
        rotationDeg: 0,
        layerId: "furniture",
        widthMm: 150,
        depthMm: 150,
      },
    ];
    const hit = snapUmbrellaToSleeve(objects, { x: 1120, y: 540 });
    assert.deepEqual(hit, { x: 1000, y: 500 });
    const miss = snapUmbrellaToSleeve(objects, { x: 4000, y: 4000 });
    assert.equal(miss, null);

    const seated = resolvePlacePosition("umbrella", { x: 1100, y: 500 }, {
      objects,
    });
    assert.deepEqual(seated, { x: 1000, y: 500 });
  });
});
