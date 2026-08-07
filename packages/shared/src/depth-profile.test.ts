import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoolBody } from "./design-model";
import {
  addDepthBreak,
  depthMmAtPlanPoint,
  depthMmAtT,
  depthProfileForBody,
  depthTAtPlanPoint,
  flipDepthEnds,
  materializeDepthStations,
  normalizeDepthStations,
  removeDepthBreak,
} from "./depth-profile";

const rectPool = (
  shallow: number,
  deep: number,
  stations?: PoolBody["depthStations"],
): PoolBody => ({
  id: "p1",
  name: "Pool",
  kind: "pool",
  outline: [
    { x: 0, y: 0 },
    { x: 10000, y: 0 },
    { x: 10000, y: 4000 },
    { x: 0, y: 4000 },
  ],
  depthShallowMm: shallow,
  depthDeepMm: deep,
  depthStations: stations,
});

describe("depth-profile", () => {
  it("falls back to shallow/deep along the long axis", () => {
    const body = rectPool(900, 2400);
    const profile = depthProfileForBody(body);
    assert.equal(profile.stations.length, 2);
    assert.ok(Math.abs(profile.axis.x) > 0.9);
    const shallowEnd = depthMmAtPlanPoint(body, { x: 0, y: 2000 });
    const deepEnd = depthMmAtPlanPoint(body, { x: 10000, y: 2000 });
    assert.ok(Math.abs(shallowEnd - 900) < 1);
    assert.ok(Math.abs(deepEnd - 2400) < 1);
  });

  it("smooth mid-point is between endpoints (not linear average)", () => {
    const stations = normalizeDepthStations(
      [
        { id: "a", t: 0, depthMm: 1000 },
        { id: "b", t: 1, depthMm: 2000, transition: "smooth" },
      ],
      1000,
      2000,
    );
    const mid = depthMmAtT(stations, 0.5);
    // smoothstep(0.5) = 0.5 → same as linear at midpoint
    assert.ok(Math.abs(mid - 1500) < 1);
    const q = depthMmAtT(stations, 0.25);
    // smoothstep(0.25) = 0.15625 → 1000 + 1000*0.15625 = 1156.25
    assert.ok(q < 1250);
    assert.ok(q > 1100);
  });

  it("drop-off holds previous depth until the station", () => {
    const stations = normalizeDepthStations(
      [
        { id: "a", t: 0, depthMm: 1000 },
        { id: "b", t: 0.5, depthMm: 2000, transition: "dropoff" },
        { id: "c", t: 1, depthMm: 2000, transition: "smooth" },
      ],
      1000,
      2000,
    );
    assert.ok(Math.abs(depthMmAtT(stations, 0.49) - 1000) < 1);
    assert.ok(Math.abs(depthMmAtT(stations, 0.5) - 2000) < 1);
    assert.ok(Math.abs(depthMmAtT(stations, 0.75) - 2000) < 1);
  });

  it("three-station break changes depth in the middle band", () => {
    const body = rectPool(900, 2400, [
      { id: "a", t: 0, depthMm: 900 },
      { id: "b", t: 0.4, depthMm: 1200, transition: "smooth" },
      { id: "c", t: 1, depthMm: 2400, transition: "smooth" },
    ]);
    const d = depthMmAtPlanPoint(body, { x: 4000, y: 2000 });
    assert.ok(d > 900);
    assert.ok(d < 2400);
  });

  it("materialize / add / remove break and flip ends", () => {
    let body = materializeDepthStations(rectPool(900, 2400));
    assert.equal(body.depthStations?.length, 2);
    body = addDepthBreak(body, 0);
    assert.equal(body.depthStations?.length, 3);
    const midId = body.depthStations![1].id;
    body = removeDepthBreak(body, midId);
    assert.equal(body.depthStations?.length, 2);

    const before = depthMmAtPlanPoint(body, { x: 0, y: 2000 });
    body = flipDepthEnds(body);
    const after = depthMmAtPlanPoint(body, { x: 0, y: 2000 });
    assert.ok(Math.abs(before - 900) < 1);
    assert.ok(Math.abs(after - 2400) < 1);
  });

  it("depthTAtPlanPoint clamps to 0..1", () => {
    const profile = depthProfileForBody(rectPool(900, 2400));
    const t0 = depthTAtPlanPoint(
      { x: -1000, y: 0 },
      profile.originMm,
      profile.axis,
      profile.axisLengthMm,
    );
    const t1 = depthTAtPlanPoint(
      { x: 20000, y: 0 },
      profile.originMm,
      profile.axis,
      profile.axisLengthMm,
    );
    assert.equal(t0, 0);
    assert.equal(t1, 1);
  });
});
