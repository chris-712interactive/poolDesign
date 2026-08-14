import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  arcApex,
  arcFromBulge,
  arcLengthMm,
  bulgeFromPoint,
  flattenClosedOutline,
  flattenEdge,
} from "./outline-arcs";
import { pointInPolygon, polygonAreaMm2, polygonPerimeterMm } from "./design-model";

describe("outline arcs (DXF bulge)", () => {
  it("bulge 1 on a diameter is a semicircle", () => {
    const a = { x: 0, y: 0, bulge: 1 };
    const b = { x: 2000, y: 0 };
    const apex = arcApex(a, b, 1)!;
    assert.ok(Math.abs(apex.x - 1000) < 1e-6);
    assert.ok(Math.abs(apex.y - 1000) < 1e-6);
    const arc = arcFromBulge(a, b, 1)!;
    assert.ok(Math.abs(arc.r - 1000) < 1e-4);
    assert.ok(Math.abs(Math.abs(arc.sweep) - Math.PI) < 1e-6);
    assert.ok(Math.abs(arcLengthMm(a, b, 1) - Math.PI * 1000) < 1e-3);
    assert.ok(Math.abs(bulgeFromPoint(a, b, apex) - 1) < 1e-6);
  });

  it("negative bulge mirrors to the opposite side", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 2000, y: 0 };
    const apex = arcApex(a, b, -1)!;
    assert.ok(Math.abs(apex.y - -1000) < 1e-6);
    assert.ok(Math.abs(bulgeFromPoint(a, b, apex) - -1) < 1e-6);
  });

  it("dragging onto the chord clears bulge", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4000, y: 0 };
    assert.equal(bulgeFromPoint(a, b, { x: 2000, y: 0 }), 0);
    assert.equal(bulgeFromPoint(a, b, { x: 2000, y: 0.4 }), 0);
  });

  it("flattenClosedOutline tessellates bulged edges and keeps corners", () => {
    const outline = [
      { x: 0, y: 0, bulge: 1 },
      { x: 2000, y: 0 },
      { x: 2000, y: 2000 },
      { x: 0, y: 2000 },
    ];
    const flat = flattenClosedOutline(outline, 150);
    assert.ok(flat.length > 8);
    assert.ok(Math.abs(flat[0].x) < 1e-6 && Math.abs(flat[0].y) < 1e-6);
    const apex = flat.find(
      (p) => Math.abs(p.x - 1000) < 80 && Math.abs(p.y - 1000) < 80,
    );
    assert.ok(apex, "tessellation should pass near the semicircle apex");
    assert.equal(
      flattenEdge(outline[1], outline[2]).length,
      2,
      "straight edges stay two points",
    );
  });

  it("point-in-polygon and area follow the arc, not the chord", () => {
    // Thin strip below the chord so a +Y semicircle is clearly extra area.
    const outline = [
      { x: 0, y: 0, bulge: 1 },
      { x: 2000, y: 0 },
      { x: 2000, y: -100 },
      { x: 0, y: -100 },
    ];
    assert.equal(pointInPolygon({ x: 1000, y: 500 }, outline), true);
    assert.equal(pointInPolygon({ x: 1000, y: -500 }, outline), false);
    const area = polygonAreaMm2(outline);
    const strip = 2000 * 100;
    const semicircle = (Math.PI * 1000 * 1000) / 2;
    assert.ok(area > strip + semicircle * 0.9);
    assert.ok(area < strip + semicircle * 1.1);
    const peri = polygonPerimeterMm(outline);
    assert.ok(Math.abs(peri - (Math.PI * 1000 + 2200)) < 1);
  });
});
