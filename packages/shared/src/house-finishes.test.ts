import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_HOUSE_EXTERIOR_FINISH_ID,
  HOUSE_EXTERIOR_CUSTOM_ID,
  HOUSE_EXTERIOR_FINISHES,
  DEFAULT_HOUSE_SIDING_ID,
  clampHouseExteriorColor,
  houseExteriorColorFromHex,
  houseExteriorHex,
  isHouseExteriorFinishId,
  resolveBuildingStoryExterior,
  resolveHouseExteriorColor,
  resolveHouseExteriorFinishId,
  resolveHouseSidingId,
  trimStoryExteriors,
} from "./house-finishes";

describe("house exterior finishes", () => {
  it("ships about twenty named presets", () => {
    assert.ok(HOUSE_EXTERIOR_FINISHES.length >= 18);
    assert.ok(HOUSE_EXTERIOR_FINISHES.length <= 24);
    assert.ok(isHouseExteriorFinishId(DEFAULT_HOUSE_EXTERIOR_FINISH_ID));
  });

  it("resolves presets and custom RGB", () => {
    assert.equal(
      resolveHouseExteriorFinishId(undefined),
      DEFAULT_HOUSE_EXTERIOR_FINISH_ID,
    );
    assert.equal(
      resolveHouseExteriorFinishId(HOUSE_EXTERIOR_CUSTOM_ID),
      HOUSE_EXTERIOR_CUSTOM_ID,
    );
    const navy = resolveHouseExteriorColor("house_navy");
    assert.equal(houseExteriorHex(navy), "#2a3a56");
    const custom = resolveHouseExteriorColor("custom", { r: 10, g: 20, b: 30 });
    assert.deepEqual(custom, { r: 10, g: 20, b: 30 });
  });

  it("clamps channels and parses hex", () => {
    assert.deepEqual(clampHouseExteriorColor({ r: 300, g: -4, b: 12.6 }), {
      r: 255,
      g: 0,
      b: 13,
    });
    assert.deepEqual(houseExteriorColorFromHex("#ff8800"), {
      r: 255,
      g: 136,
      b: 0,
    });
    assert.equal(houseExteriorColorFromHex("nope"), null);
  });

  it("resolves siding and per-story overrides", () => {
    assert.equal(resolveHouseSidingId(undefined), DEFAULT_HOUSE_SIDING_ID);
    assert.equal(resolveHouseSidingId("brick"), "brick");
    assert.equal(resolveHouseSidingId("vinyl"), DEFAULT_HOUSE_SIDING_ID);
    const twoStory = {
      stories: 2,
      exteriorFinishId: "house_white",
      exteriorSidingId: "stucco",
      storyExteriors: [
        {},
        { exteriorSidingId: "lap", exteriorFinishId: "house_navy" },
      ],
    };
    const ground = resolveBuildingStoryExterior(twoStory, 1);
    assert.equal(ground.sidingId, "stucco");
    assert.equal(ground.finishId, "house_white");
    const upper = resolveBuildingStoryExterior(twoStory, 2);
    assert.equal(upper.sidingId, "lap");
    assert.equal(upper.finishId, "house_navy");
    const trimmed = trimStoryExteriors(
      [{ exteriorSidingId: "brick" }, { exteriorSidingId: "lap" }, { exteriorSidingId: "shake" }],
      2,
    );
    assert.equal(trimmed?.length, 2);
    assert.equal(trimmed?.[1].exteriorSidingId, "lap");
  });
});
