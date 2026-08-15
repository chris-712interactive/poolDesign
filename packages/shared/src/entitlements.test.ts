import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companyHasEntitlement,
  entitlementsForCompany,
  planDisplayName,
  planTierForKey,
} from "./entitlements";
import {
  gradeWalkToSamples,
  mergeGradeWalkSamples,
  pointAlongBearing,
} from "./grade-walk";
import { takeoffToCsv } from "./quote-docs";
import type { TakeoffResult } from "./takeoff";

describe("entitlements", () => {
  it("maps starter→sales and pro→builder", () => {
    assert.equal(planTierForKey("starter"), "sales");
    assert.equal(planTierForKey("pro"), "builder");
    assert.equal(planDisplayName("starter"), "Sales");
  });

  it("gives builder features while the local trial is active", () => {
    const e = entitlementsForCompany({
      planKey: "starter",
      subscriptionStatus: "trialing",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    assert.equal(e.pdfQuote, true);
    assert.equal(e.permitPacket, true);
  });

  it("gates sales plan when active", () => {
    assert.equal(
      companyHasEntitlement(
        { planKey: "starter", subscriptionStatus: "active" },
        "pdfQuote",
      ),
      false,
    );
    assert.equal(
      companyHasEntitlement(
        { planKey: "pro", subscriptionStatus: "active" },
        "pdfQuote",
      ),
      true,
    );
  });
});

describe("grade-walk", () => {
  it("places samples along bearing", () => {
    const origin = { x: 0, y: 0 };
    const p = pointAlongBearing(origin, 0, 3048); // 10 ft drawing-up
    assert.ok(Math.abs(p.x) < 1e-6);
    assert.ok(Math.abs(p.y + 3048) < 1e-6);

    const samples = gradeWalkToSamples({
      origin,
      bearingDeg: 90,
      points: [
        { distanceMm: 0, dropMm: 0 },
        { distanceMm: 3048, dropMm: 457.2 },
      ],
    });
    assert.equal(samples.length, 2);
    assert.ok(Math.abs(samples[1].position.x + 3048) < 1e-6);
    assert.ok(Math.abs(samples[1].position.y) < 1e-6);
    assert.equal(samples[1].rotationDeg, 90);
    assert.equal(samples[1].dropMm, 457.2);
  });

  it("maps heading 30° to 11 o'clock and 150° to 7 o'clock", () => {
    const origin = { x: 0, y: 0 };
    const at30 = pointAlongBearing(origin, 30, 1000);
    const at150 = pointAlongBearing(origin, 150, 1000);
    // 0° = up (−Y); 30° = up-left; 150° = down-left.
    assert.ok(Math.abs(at30.x + 500) < 1);
    assert.ok(Math.abs(at30.y + 866.025) < 1);
    assert.ok(Math.abs(at150.x + 500) < 1);
    assert.ok(Math.abs(at150.y - 866.025) < 1);
  });

  it("places a walk from a signed plan origin (house corner in −X/−Y)", () => {
    const origin = { x: -1.48 * 304.8, y: -37.61 * 304.8 };
    const samples = gradeWalkToSamples({
      origin,
      bearingDeg: 150,
      points: [{ distanceMm: 0, dropMm: 0 }],
    });
    assert.equal(samples.length, 1);
    assert.ok(Math.abs(samples[0].position.x - origin.x) < 1e-6);
    assert.ok(Math.abs(samples[0].position.y - origin.y) < 1e-6);
    assert.equal(samples[0].rotationDeg, 150);
  });

  it("replaces prior ar_grade samples when requested", () => {
    const existing = [
      { id: "grade_manual", position: { x: 1, y: 1 }, dropMm: 100 },
      { id: "ar_grade_0_0", position: { x: 0, y: 0 }, dropMm: 0 },
    ];
    const imported = [
      { id: "ar_grade_0_10", position: { x: 10, y: 0 }, dropMm: 50 },
    ];
    const merged = mergeGradeWalkSamples({
      existing,
      imported,
      replaceExisting: true,
    });
    assert.equal(merged.length, 2);
    assert.equal(merged[0].id, "grade_manual");
    assert.equal(merged[1].id, "ar_grade_0_10");
  });
});

describe("quote-docs", () => {
  it("emits csv header and rows", () => {
    const takeoff: TakeoffResult = {
      lines: [
        {
          catalogItemId: "gunite",
          name: "Gunite",
          category: "structure",
          unit: "sf",
          quantity: 10,
          unitPriceCents: 1500,
          totalCents: 15000,
          lineKey: "gunite",
        },
      ],
      removedLines: [],
      subtotalCents: 15000,
      generatedAt: new Date().toISOString(),
    };
    const csv = takeoffToCsv(takeoff);
    assert.match(csv, /^Item,Category/);
    assert.match(csv, /Gunite/);
    assert.match(csv, /150\.00/);
  });
});
