import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DINING_CHAIR_CLEARANCE_MM,
  diningChairSlotsMm,
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

  it("places rect chairs on long sides and both ends", () => {
    const slots = diningChairSlotsMm("rect", 6 * 304.8, 3.5 * 304.8);
    const onTop = slots.filter((s) => s.yMm > 0 && Math.abs(s.xMm) < 6 * 304.8);
    const onBottom = slots.filter(
      (s) => s.yMm < 0 && Math.abs(s.xMm) < 6 * 304.8,
    );
    const onRight = slots.filter((s) => s.xMm > 0 && Math.abs(s.yMm) < 2 * 304.8);
    const onLeft = slots.filter((s) => s.xMm < 0 && Math.abs(s.yMm) < 2 * 304.8);
    // Long sides
    assert.ok(onTop.length >= 2, `expected side chairs, got ${onTop.length}`);
    assert.ok(onBottom.length >= 2);
    // Ends
    assert.ok(onRight.length >= 1, "expected right end chair");
    assert.ok(onLeft.length >= 1, "expected left end chair");
    assert.ok(slots.length >= 6);
  });

  it("places round chairs in a full orbit", () => {
    const slots = diningChairSlotsMm("round", 5 * 304.8, 5 * 304.8);
    assert.equal(slots.length, 4);
    const angles = slots.map((s) => Math.atan2(s.xMm, s.yMm));
    // Spread around the circle (not clustered on one side)
    const span = Math.max(...angles) - Math.min(...angles);
    assert.ok(span > Math.PI);
  });
});
