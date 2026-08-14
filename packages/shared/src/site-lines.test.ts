import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MM_PER_FOOT } from "./units";
import {
  createSiteLine,
  normalizeSiteLines,
  siteLineLengthMm,
  siteLineSegments,
  pointNearSiteLine,
} from "./site-lines";

describe("site lines", () => {
  it("closes a property loop for length and hit-testing", () => {
    const line = createSiteLine({
      id: "pl1",
      kind: "property",
      points: [
        { x: 0, y: 0 },
        { x: 10 * MM_PER_FOOT, y: 0 },
        { x: 10 * MM_PER_FOOT, y: 10 * MM_PER_FOOT },
        { x: 0, y: 10 * MM_PER_FOOT },
      ],
      index: 1,
      closed: true,
    });
    assert.equal(siteLineSegments(line).length, 4);
    assert.ok(Math.abs(siteLineLengthMm(line) - 40 * MM_PER_FOOT) < 1);
    assert.equal(pointNearSiteLine(line, { x: 0, y: 5 * MM_PER_FOOT }, 50), true);
    assert.equal(pointNearSiteLine(line, { x: 50 * MM_PER_FOOT, y: 50 * MM_PER_FOOT }, 50), false);
  });

  it("keeps easements open unless marked closed", () => {
    const raw = [
      {
        id: "e1",
        name: "Utility",
        kind: "easement" as const,
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        widthMm: 10 * MM_PER_FOOT,
      },
    ];
    const next = normalizeSiteLines(raw);
    assert.equal(next[0].closed, false);
    assert.ok(Math.abs((next[0].widthMm ?? 0) - 10 * MM_PER_FOOT) < 1);
    assert.equal(siteLineSegments(next[0]).length, 1);
  });
});
