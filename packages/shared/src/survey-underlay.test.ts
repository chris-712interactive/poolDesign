import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MM_PER_FOOT } from "./units";
import {
  calibrateSurveyUnderlay,
  createSurveyUnderlay,
  parseSurveyKnownLengthToMm,
  pointInSurveyUnderlay,
  rotateSurveyUnderlay,
  surveyMmPerPixel,
  surveyUnderlayCenter,
} from "./survey-underlay";

describe("survey underlay calibration", () => {
  it("scales so a clicked span matches the known survey dimension", () => {
    const underlay = createSurveyUnderlay({
      imageUrl: "https://example.com/plat.png",
      pixelWidth: 2000,
      pixelHeight: 1000,
    });
    // Default width 80′. Click 1/4 of the way across the top edge.
    const a = { x: 0, y: 0 };
    const b = { x: underlay.widthMm / 4, y: 0 };
    const known = 20 * MM_PER_FOOT;
    const next = calibrateSurveyUnderlay(underlay, a, b, known);
    assert.equal(next.calibrated, true);
    assert.ok(Math.abs(next.widthMm - 80 * MM_PER_FOOT) < 1);
    assert.ok(Math.abs(surveyMmPerPixel(next) * 500 - known) < 1);
  });

  it("keeps aspect ratio after calibration", () => {
    const underlay = createSurveyUnderlay({
      imageUrl: "https://example.com/plat.png",
      pixelWidth: 1000,
      pixelHeight: 500,
    });
    const next = calibrateSurveyUnderlay(
      underlay,
      { x: 0, y: 0 },
      { x: underlay.widthMm, y: 0 },
      100 * MM_PER_FOOT,
    );
    assert.ok(Math.abs(next.widthMm / next.heightMm - 2) < 1e-6);
  });

  it("hit-tests the rotated sheet", () => {
    const underlay = createSurveyUnderlay({
      imageUrl: "https://example.com/plat.png",
      pixelWidth: 100,
      pixelHeight: 100,
    });
    assert.equal(pointInSurveyUnderlay(underlay, { x: 10, y: 10 }), true);
    assert.equal(
      pointInSurveyUnderlay(underlay, { x: -50, y: -50 }),
      false,
    );
    const turned = rotateSurveyUnderlay(underlay, 90);
    const c = surveyUnderlayCenter(underlay);
    const c2 = surveyUnderlayCenter(turned);
    assert.ok(Math.abs(c.x - c2.x) < 1e-6);
    assert.ok(Math.abs(c.y - c2.y) < 1e-6);
  });

  it("reads survey callouts as feet, including prime quotes", () => {
    const fiftyFeet = 50 * MM_PER_FOOT;
    assert.ok(
      Math.abs(parseSurveyKnownLengthToMm("50", "imperial")! - fiftyFeet) < 0.5,
    );
    assert.ok(
      Math.abs(parseSurveyKnownLengthToMm("50'", "imperial")! - fiftyFeet) < 0.5,
    );
    assert.ok(
      Math.abs(parseSurveyKnownLengthToMm("50′", "imperial")! - fiftyFeet) < 0.5,
    );
    assert.ok(
      Math.abs(parseSurveyKnownLengthToMm("15.24", "metric")! - 15240) < 0.5,
    );
  });
});
