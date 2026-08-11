import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyDesignDocument } from "./design-model";
import {
  applyPoolPackage,
  buildPoolPackage,
  layoutPoolContents,
} from "./pool-defaults";

const FT = 304.8;

function rect(w: number, d: number) {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ];
}

describe("pool package", () => {
  it("places dual drains, skimmers, returns, lights, and steps", () => {
    const pkg = buildPoolPackage(rect(20 * FT, 40 * FT), 1);
    assert.equal(pkg.body.kind, "pool");
    assert.ok((pkg.body.depthStations?.length ?? 0) >= 2);

    const drains = pkg.objects.filter((o) => o.catalogItemId === "pool_drain");
    const skimmers = pkg.objects.filter(
      (o) => o.catalogItemId === "pool_skimmer",
    );
    const returns = pkg.objects.filter(
      (o) => o.catalogItemId === "pool_return",
    );
    const lights = pkg.objects.filter((o) =>
      o.catalogItemId.startsWith("light_"),
    );
    assert.equal(drains.length, 2);
    assert.equal(skimmers.length, 2);
    assert.equal(returns.length, 4);
    assert.equal(lights.length, 2);
    assert.ok(pkg.features.some((f) => f.kind === "steps"));
    assert.ok(pkg.plumbingRuns.length >= 2);
  });

  it("merges into a design document", () => {
    const design = emptyDesignDocument("residential");
    const pkg = buildPoolPackage(rect(16 * FT, 32 * FT), 1, undefined, design);
    const next = applyPoolPackage(design, pkg);
    assert.equal(next.poolBodies.length, 1);
    assert.ok((next.objects ?? []).length >= 8);
    assert.ok((next.features ?? []).some((f) => f.kind === "steps"));
  });

  it("layouts contents for a square footprint", () => {
    const contents = layoutPoolContents(
      "p1",
      "Pool 1",
      rect(20 * FT, 20 * FT),
      200,
    );
    assert.ok(contents.objects.some((o) => o.catalogItemId === "pool_drain"));
  });
});
