import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoolBody } from "./design-model";
import {
  isWallWaterFixtureId,
  snapWaterWallFixture,
} from "./water-fixtures";

const FT = 304.8;

function rectBody(id: string, w: number, d: number): PoolBody {
  return {
    id,
    name: id,
    kind: "pool",
    outline: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: d },
      { x: 0, y: d },
    ],
    depthShallowMm: 3 * FT,
    depthDeepMm: 8 * FT,
    wallThicknessMm: 200,
  };
}

describe("water wall fixtures", () => {
  it("recognizes wall-mounted fixture ids", () => {
    assert.equal(isWallWaterFixtureId("light_standard"), true);
    assert.equal(isWallWaterFixtureId("light_color"), true);
    assert.equal(isWallWaterFixtureId("spa_jet"), true);
    assert.equal(isWallWaterFixtureId("pool_skimmer"), true);
    assert.equal(isWallWaterFixtureId("pool_return"), true);
    assert.equal(isWallWaterFixtureId("pool_bubbler"), false);
  });

  it("snaps a light to the near pool wall facing inward (wall normal)", () => {
    const pool = rectBody("p1", 20 * FT, 40 * FT);
    // Click just outside the left wall mid-length.
    const snap = snapWaterWallFixture(
      [pool],
      { x: -100, y: 20 * FT },
      2000,
    );
    assert.ok(snap);
    assert.equal(snap!.bodyId, "p1");
    // On water side of left wall (x > 0), near wall thickness inset.
    assert.ok(snap!.position.x > 200 && snap!.position.x < 400);
    assert.ok(Math.abs(snap!.position.y - 20 * FT) < 1);
    // Faces into the pool (+X), perpendicular to the left wall.
    assert.ok(Math.abs(snap!.rotationDeg) < 5 || Math.abs(snap!.rotationDeg - 0) < 5);
  });

  it("keeps the same orientation when sliding along a straight wall", () => {
    const pool = rectBody("p1", 20 * FT, 40 * FT);
    const a = snapWaterWallFixture([pool], { x: -50, y: 10 * FT }, 2000);
    const b = snapWaterWallFixture([pool], { x: -50, y: 30 * FT }, 2000);
    assert.ok(a && b);
    assert.ok(Math.abs(a!.rotationDeg - b!.rotationDeg) < 0.01);
    // Still on the left wall, facing +X.
    assert.ok(Math.abs(a!.rotationDeg) < 5);
  });

  it("preserves wall-normal orientation after a pure pool translation", () => {
    const pool = rectBody("p1", 20 * FT, 40 * FT);
    const before = snapWaterWallFixture([pool], { x: -50, y: 12 * FT }, 2000);
    assert.ok(before);
    const dx = 1500;
    const dy = -800;
    const moved: PoolBody = {
      ...pool,
      outline: pool.outline.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
    const after = snapWaterWallFixture(
      [moved],
      { x: before!.position.x + dx, y: before!.position.y + dy },
      2000,
    );
    assert.ok(after);
    assert.ok(Math.abs(after!.rotationDeg - before!.rotationDeg) < 0.01);
  });
});
