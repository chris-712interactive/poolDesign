import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyDesignDocument } from "./design-model";
import {
  DEFAULT_CEILING_HEIGHT_MM,
  FLOOR_STRUCTURE_THICKNESS_MM,
  STORY_HEIGHT_MM,
  WINDOW_SILL_ABOVE_FLOOR_MM,
  buildingHeightMm,
  clampOpeningStory,
  defaultObjectHeightMm,
  designBoundsMm,
  mmToMeters,
  openingSillMm,
  planToWorldXZ,
  poolAverageDepthMm,
  resolveCeilingHeightMm,
  storyFloorElevationMm,
  sunWorldDir,
} from "./scene3d";

describe("scene3d helpers", () => {
  it("converts mm to meters", () => {
    assert.equal(mmToMeters(1000), 1);
    assert.equal(mmToMeters(304.8), 0.3048);
  });

  it("maps plan to world with X mirrored (left/right matches 2D)", () => {
    const p = planToWorldXZ({ x: 2000, y: 1000 });
    assert.equal(p.x, -2);
    assert.equal(p.z, -1);
  });

  it("places noon sun in the south and sunset in the west relative to site north", () => {
    const north = sunWorldDir(0, 0, 0);
    assert.ok(Math.abs(north.x) < 1e-9);
    assert.ok(Math.abs(north.z - 1) < 1e-9);

    const east = sunWorldDir(90, 0, 0);
    assert.ok(Math.abs(east.x + 1) < 1e-9);
    assert.ok(Math.abs(east.z) < 1e-9);

    const south = sunWorldDir(180, 0, 0);
    assert.ok(Math.abs(south.x) < 1e-9);
    assert.ok(Math.abs(south.z + 1) < 1e-9);

    const west = sunWorldDir(270, 0, 0);
    assert.ok(Math.abs(west.x - 1) < 1e-9);
    assert.ok(Math.abs(west.z) < 1e-9);

    // 90° clockwise from drawing-up → true north is plan-right → 3D −X
    const northAt90 = sunWorldDir(0, 0, 90);
    assert.ok(Math.abs(northAt90.x + 1) < 1e-9);
    assert.ok(Math.abs(northAt90.z) < 1e-9);

    const noonAt90 = sunWorldDir(180, 50, 90);
    assert.ok(noonAt90.x > 0.4, "noon is south of a plan-right north");
    assert.ok(noonAt90.y > 0.7);
  });

  it("computes building height from stories and ceiling height", () => {
    assert.equal(resolveCeilingHeightMm(undefined), DEFAULT_CEILING_HEIGHT_MM);
    assert.equal(STORY_HEIGHT_MM, DEFAULT_CEILING_HEIGHT_MM);
    assert.equal(buildingHeightMm(1), DEFAULT_CEILING_HEIGHT_MM);
    assert.equal(
      buildingHeightMm(2),
      2 * DEFAULT_CEILING_HEIGHT_MM + FLOOR_STRUCTURE_THICKNESS_MM,
    );
    assert.equal(buildingHeightMm(0), DEFAULT_CEILING_HEIGHT_MM);
    assert.equal(
      buildingHeightMm(2, 3048),
      2 * 3048 + FLOOR_STRUCTURE_THICKNESS_MM,
    );
  });

  it("places openings on the chosen story sill", () => {
    assert.equal(clampOpeningStory(5, 2), 2);
    assert.equal(clampOpeningStory(undefined, 3), 1);
    assert.equal(openingSillMm("door", 1, 2), 0);
    assert.equal(openingSillMm("window", 1, 2), WINDOW_SILL_ABOVE_FLOOR_MM);
    assert.equal(
      storyFloorElevationMm(2, 2),
      DEFAULT_CEILING_HEIGHT_MM + FLOOR_STRUCTURE_THICKNESS_MM,
    );
    assert.equal(
      openingSillMm("window", 2, 2),
      DEFAULT_CEILING_HEIGHT_MM +
        FLOOR_STRUCTURE_THICKNESS_MM +
        WINDOW_SILL_ABOVE_FLOOR_MM,
    );
    assert.equal(
      openingSillMm("door", 2, 2),
      DEFAULT_CEILING_HEIGHT_MM + FLOOR_STRUCTURE_THICKNESS_MM,
    );
    assert.equal(openingSillMm("window", 1, 2, 600), 600);
    assert.equal(
      openingSillMm("window", 2, 2, 600),
      DEFAULT_CEILING_HEIGHT_MM + FLOOR_STRUCTURE_THICKNESS_MM + 600,
    );
  });

  it("averages pool depths", () => {
    assert.equal(
      poolAverageDepthMm({
        id: "p",
        name: "P",
        outline: [],
        depthShallowMm: 1000,
        depthDeepMm: 2000,
      }),
      1500,
    );
  });

  it("returns default object heights by category", () => {
    assert.ok(defaultObjectHeightMm("equip_pad") < 300);
    assert.ok(defaultObjectHeightMm("heater_gas") >= 1000);
    assert.ok(defaultObjectHeightMm("pool_bubbler") < 200);
    // 5′8″ = 1727.2 mm
    assert.equal(defaultObjectHeightMm("person_scale"), 1727.2);
  });

  it("computes design bounds from footprints", () => {
    const design = {
      ...emptyDesignDocument("residential"),
      poolBodies: [
        {
          id: "p1",
          name: "Pool",
          outline: [
            { x: 0, y: 0 },
            { x: 10000, y: 0 },
            { x: 10000, y: 5000 },
            { x: 0, y: 5000 },
          ],
          depthShallowMm: 900,
          depthDeepMm: 2400,
        },
      ],
    };
    const b = designBoundsMm(design);
    assert.equal(b.minX, 0);
    assert.equal(b.maxX, 10000);
    assert.equal(b.cx, 5000);
    assert.equal(b.cy, 2500);
  });
});
