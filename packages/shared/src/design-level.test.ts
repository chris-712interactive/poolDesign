import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicDesignLevels } from "./design-level";

describe("publicDesignLevels", () => {
  it("keeps residential and hides commercial / water park by default", () => {
    assert.deepEqual(
      publicDesignLevels(["residential", "commercial", "water_park"]),
      ["residential"],
    );
  });

  it("can re-enable unfinished levels with flags", () => {
    assert.deepEqual(
      publicDesignLevels(["residential", "commercial", "water_park"], {
        commercial: true,
        waterPark: true,
      }),
      ["residential", "commercial", "water_park"],
    );
  });
});
