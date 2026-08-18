import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MM_PER_FOOT } from "./units";
import {
  alignSurveyUnderlayToAxis,
  axisAlignDeltaDeg,
  calibrateSurveyUnderlay,
  createSurveyUnderlay,
  parseSurveyKnownLengthToMm,
  pointInSurveyUnderlay,
  rotateSurveyUnderlay,
  squareSurveyUnderlayToImageLine,
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

  it("snaps a world line to the nearest CAD axis", () => {
    assert.ok(Math.abs(axisAlignDeltaDeg(4) + 4) < 1e-6);
    assert.ok(Math.abs(axisAlignDeltaDeg(88) - 2) < 1e-6);

    const underlay = createSurveyUnderlay({
      imageUrl: "https://example.com/plat.png",
      pixelWidth: 1000,
      pixelHeight: 800,
    });
    const a = { x: 0, y: 0 };
    const b = { x: 1000, y: 80 };
    const next = alignSurveyUnderlayToAxis(underlay, a, b);
    const worldB = {
      x:
        Math.cos((next.rotationDeg * Math.PI) / 180) * 1000 -
        Math.sin((next.rotationDeg * Math.PI) / 180) * 80,
      y:
        Math.sin((next.rotationDeg * Math.PI) / 180) * 1000 +
        Math.cos((next.rotationDeg * Math.PI) / 180) * 80,
    };
    const worldDeg = (Math.atan2(worldB.y, worldB.x) * 180) / Math.PI;
    assert.ok(Math.abs(axisAlignDeltaDeg(worldDeg)) < 0.15);
    assert.ok(Math.abs(next.rotationDeg) > 0.5);
  });

  it("squares a bitmap line onto the grid", () => {
    const underlay = createSurveyUnderlay({
      imageUrl: "https://example.com/plat.png",
      pixelWidth: 400,
      pixelHeight: 400,
    });
    const next = squareSurveyUnderlayToImageLine(underlay, 6);
    assert.ok(Math.abs(axisAlignDeltaDeg(next.rotationDeg + 6)) < 0.15);
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
