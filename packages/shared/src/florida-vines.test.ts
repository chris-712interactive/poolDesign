import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_VINE_ID,
  FLORIDA_VINES,
  clampTrellisHeightMm,
  defaultTrellisHeightMm,
  defaultVineId,
  getFloridaVine,
  isTrellisId,
  resolveVineId,
  vineBloomShape,
  vinesInGroup,
} from "./florida-vines";

describe("florida vines", () => {
  it("has unique ids and every group is populated", () => {
    const ids = new Set(FLORIDA_VINES.map((v) => v.id));
    assert.equal(ids.size, FLORIDA_VINES.length);
    assert.ok(FLORIDA_VINES.length >= 30);
    assert.ok(vinesInGroup("bougainvillea").length >= 4);
    assert.ok(vinesInGroup("native").some((v) => v.native));
    assert.ok(getFloridaVine(DEFAULT_VINE_ID).id === DEFAULT_VINE_ID);
  });

  it("resolves unknown ids to the default bougainvillea", () => {
    assert.equal(resolveVineId(undefined), DEFAULT_VINE_ID);
    assert.equal(resolveVineId("not_a_vine"), DEFAULT_VINE_ID);
    assert.equal(resolveVineId("maypop"), "maypop");
  });

  it("defaults a vine only on trellis catalog items", () => {
    assert.equal(isTrellisId("trellis"), true);
    assert.equal(isTrellisId("trellis_arbor"), true);
    assert.equal(isTrellisId("planter"), false);
    assert.equal(defaultVineId("trellis"), DEFAULT_VINE_ID);
    assert.equal(defaultVineId("lounge_chair"), undefined);
  });

  it("clamps trellis height to a 3′–12′ range", () => {
    assert.equal(defaultTrellisHeightMm("trellis"), 7 * 304.8);
    assert.equal(defaultTrellisHeightMm("trellis_arbor"), 8 * 304.8);
    assert.equal(clampTrellisHeightMm(undefined, "trellis"), 7 * 304.8);
    assert.equal(clampTrellisHeightMm(2 * 304.8, "trellis"), 3 * 304.8);
    assert.equal(clampTrellisHeightMm(20 * 304.8, "trellis_arbor"), 12 * 304.8);
    assert.ok(
      Math.abs(clampTrellisHeightMm(8 * 304.8, "trellis") - 8 * 304.8) < 1e-6,
    );
  });

  it("picks a bloom shape that matches the vine", () => {
    assert.equal(vineBloomShape(getFloridaVine("bougainvillea_magenta")), "bract");
    assert.equal(vineBloomShape(getFloridaVine("confederate_jasmine")), "star");
    assert.equal(vineBloomShape(getFloridaVine("mandevilla_pink")), "trumpet");
    assert.equal(vineBloomShape(getFloridaVine("maypop")), "passion");
    assert.equal(vineBloomShape(getFloridaVine("creeping_fig")), "none");
  });
});
