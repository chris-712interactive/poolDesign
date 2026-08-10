import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PERSON_HEIGHT_FEMALE_MM,
  DEFAULT_PERSON_HEIGHT_MALE_MM,
  defaultPersonHeightMm,
  personFootprintMm,
  personPalette,
  resolvePersonHeightMm,
  resolvePersonOutfitId,
  resolvePersonSex,
} from "./person-options";

describe("person options", () => {
  it("resolves sex / outfit / height defaults", () => {
    assert.equal(resolvePersonSex(undefined), "female");
    assert.equal(resolvePersonSex("male"), "male");
    assert.equal(resolvePersonOutfitId(undefined), "swimsuit");
    assert.equal(resolvePersonOutfitId("casual"), "casual");
    assert.equal(defaultPersonHeightMm("female"), DEFAULT_PERSON_HEIGHT_FEMALE_MM);
    assert.equal(defaultPersonHeightMm("male"), DEFAULT_PERSON_HEIGHT_MALE_MM);
    assert.equal(resolvePersonHeightMm(undefined), DEFAULT_PERSON_HEIGHT_FEMALE_MM);
    assert.equal(resolvePersonHeightMm(100), 1473.2);
    assert.equal(resolvePersonHeightMm(3000), 2032);
  });

  it("scales footprint with height and sex", () => {
    const f = personFootprintMm(DEFAULT_PERSON_HEIGHT_FEMALE_MM, "female");
    const m = personFootprintMm(DEFAULT_PERSON_HEIGHT_MALE_MM, "male");
    assert.ok(m.widthMm > f.widthMm);
    assert.ok(m.depthMm > f.depthMm);
  });

  it("returns distinct swimwear palettes by sex", () => {
    const f = personPalette("female", "swimsuit");
    const m = personPalette("male", "swimsuit");
    assert.notEqual(f.top, m.bottom);
    assert.equal(m.top, m.skin);
  });
});
