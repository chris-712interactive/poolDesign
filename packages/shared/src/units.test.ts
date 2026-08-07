import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DOOR_HEIGHT_MM,
  DEFAULT_DOOR_WIDTH_MM,
  DEFAULT_SLIDING_DOOR_WIDTH_MM,
  DEFAULT_WINDOW_HEIGHT_MM,
  DEFAULT_WINDOW_WIDTH_MM,
} from "./design-model";
import { formatLength, parseLengthToMm } from "./units";

describe("parseLengthToMm", () => {
  it("round-trips formatLength architectural strings", () => {
    for (const mm of [
      DEFAULT_DOOR_WIDTH_MM,
      DEFAULT_DOOR_HEIGHT_MM,
      DEFAULT_SLIDING_DOOR_WIDTH_MM,
      DEFAULT_WINDOW_WIDTH_MM,
      DEFAULT_WINDOW_HEIGHT_MM,
      1524,
      2032,
      914.4,
    ]) {
      const formatted = formatLength(mm, "imperial");
      const parsed = parseLengthToMm(formatted, "imperial");
      assert.ok(parsed != null, `failed to parse ${formatted}`);
      assert.ok(
        Math.abs(parsed! - mm) < 0.6,
        `${formatted} → ${parsed} (expected ${mm})`,
      );
    }
  });

  it("parses 6'-8\" as six feet eight inches (not 6' − 8\")", () => {
    const mm = parseLengthToMm(`6'-8"`, "imperial");
    assert.ok(mm != null);
    assert.ok(Math.abs(mm! - 2032) < 0.5);
  });

  it("accepts common alternate forms", () => {
    assert.ok(Math.abs(parseLengthToMm(`3'`, "imperial")! - 914.4) < 0.5);
    assert.ok(Math.abs(parseLengthToMm(`36"`, "imperial")! - 914.4) < 0.5);
    assert.ok(Math.abs(parseLengthToMm(`3' 0"`, "imperial")! - 914.4) < 0.5);
    assert.ok(Math.abs(parseLengthToMm(`6ft 8in`, "imperial")! - 2032) < 0.5);
    assert.ok(Math.abs(parseLengthToMm(`36`, "imperial")! - 914.4) < 0.5);
    assert.ok(Math.abs(parseLengthToMm(`2.032m`, "metric")! - 2032) < 0.5);
    assert.ok(Math.abs(parseLengthToMm(`2032mm`, "metric")! - 2032) < 0.5);
  });

  it("parses fractions", () => {
    const mm = parseLengthToMm(`6'-8 1/2"`, "imperial");
    assert.ok(mm != null);
    assert.ok(Math.abs(mm! - (6 * 12 + 8.5) * 25.4) < 0.5);
    assert.ok(Math.abs(parseLengthToMm(`3/4"`, "imperial")! - 0.75 * 25.4) < 0.2);
  });
});
