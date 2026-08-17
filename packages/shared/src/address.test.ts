import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAddressLine,
  locationLabel,
  normalizeAddress,
  rollupJobMarkets,
} from "./address";

describe("address", () => {
  it("formats a US line and normalizes state names", () => {
    const n = normalizeAddress({
      street: " 123 Palm Ave ",
      city: "Tampa",
      state: "Florida",
      postalCode: "33602",
      country: "US",
    });
    assert.equal(n.state, "FL");
    assert.equal(
      formatAddressLine(n),
      "123 Palm Ave, Tampa, FL 33602",
    );
  });

  it("omits US from the line and keeps other countries", () => {
    assert.equal(
      formatAddressLine({ city: "Austin", state: "TX" }),
      "Austin, TX",
    );
    assert.equal(
      formatAddressLine({ city: "Cancun", state: "QR", country: "MX" }),
      "Cancun, QR, MX",
    );
  });

  it("rolls jobs up by state then city", () => {
    const report = rollupJobMarkets([
      { city: "Tampa", state: "FL" },
      { city: "Tampa", state: "FL" },
      { city: "Orlando", state: "FL" },
      { city: "Austin", state: "TX" },
      { city: null, state: null },
    ]);
    assert.equal(report.total, 5);
    assert.equal(report.unlabeled, 1);
    assert.equal(report.byState[0]?.state, "FL");
    assert.equal(report.byState[0]?.count, 3);
    assert.equal(report.byState[0]?.cities[0]?.city, "Tampa");
    assert.equal(report.byState[0]?.cities[0]?.count, 2);
    assert.equal(locationLabel({ city: "Tampa", state: "FL" }), "Tampa, FL");
  });
});
