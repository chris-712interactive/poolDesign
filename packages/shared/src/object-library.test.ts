import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DINING_CHAIR_CLEARANCE_MM,
  diningOverallFootprintMm,
  diningTableShape,
  isDiningSetId,
  objectLibraryForLevel,
  objectPlanSizeMm,
} from "./object-library";

describe("dining set sizing", () => {
  it("exposes rect and round dining in the residential library", () => {
    const ids = objectLibraryForLevel("residential").map((i) => i.id);
    assert.ok(ids.includes("dining_table_rect"));
    assert.ok(ids.includes("dining_table_round"));
    assert.ok(!ids.includes("dining_table_set"));
  });

  it("adds chair clearance around the tabletop", () => {
    const tableW = 1828.8; // 6'
    const tableD = 1066.8; // 3.5'
    const overall = diningOverallFootprintMm(tableW, tableD, "rect");
    assert.equal(overall.widthMm, tableW + DINING_CHAIR_CLEARANCE_MM * 2);
    assert.equal(overall.depthMm, tableD + DINING_CHAIR_CLEARANCE_MM * 2);

    const round = diningOverallFootprintMm(1524, 1524, "round");
    assert.equal(round.widthMm, 1524 + DINING_CHAIR_CLEARANCE_MM * 2);
    assert.equal(round.depthMm, round.widthMm);
  });

  it("objectPlanSizeMm expands dining and leaves others alone", () => {
    const dining = objectPlanSizeMm({
      catalogItemId: "dining_table_rect",
      widthMm: 1800,
      depthMm: 1000,
    });
    assert.ok(dining.widthMm > 1800);
    assert.ok(dining.depthMm > 1000);

    const lounge = objectPlanSizeMm({
      catalogItemId: "lounge_chair",
      widthMm: 700,
      depthMm: 2000,
    });
    assert.equal(lounge.widthMm, 700);
    assert.equal(lounge.depthMm, 2000);
  });

  it("recognizes dining ids and shapes", () => {
    assert.equal(isDiningSetId("dining_table_rect"), true);
    assert.equal(diningTableShape("dining_table_rect"), "rect");
    assert.equal(diningTableShape("dining_table_round"), "round");
    assert.equal(diningTableShape("dining_table_set"), "round");
  });
});
