import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyDesignDocument, type DesignDocument } from "./design-model";
import {
  buildPermitPacket,
  buildPermitPacketHtml,
  buildPlanOutlineSvg,
  buildSectionSvg,
} from "./permit-packet";

const FT = 304.8;

function rect(x: number, y: number, w: number, h: number) {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function houseAndPool(): DesignDocument {
  const design = emptyDesignDocument("residential", "imperial");
  design.buildings = [
    {
      id: "b1",
      name: "House",
      kind: "house",
      stories: 1,
      outline: rect(0, 0, 40 * FT, 28 * FT),
      openings: [
        {
          id: "d1",
          kind: "door",
          edgeIndex: 2,
          t: 0.5,
          widthMm: 914,
          heightMm: 2032,
        },
      ],
    },
  ];
  design.poolBodies = [
    {
      id: "p1",
      name: "Pool",
      kind: "pool",
      outline: rect(8 * FT, 48 * FT, 20 * FT, 40 * FT),
      depthShallowMm: 3 * FT,
      depthDeepMm: 8 * FT,
    },
  ];
  design.patios = [
    {
      id: "pat1",
      name: "Patio",
      outline: rect(4 * FT, 28 * FT, 28 * FT, 64 * FT),
    },
  ];
  design.objects = [
    {
      id: "pad1",
      catalogItemId: "equip_pad",
      name: "Equipment pad",
      position: { x: 36 * FT, y: 68 * FT },
      rotationDeg: 0,
      layerId: "equipment",
      widthMm: 8 * FT,
      depthMm: 6 * FT,
    },
  ];
  design.features = [
    {
      id: "st1",
      kind: "steps",
      name: "Steps",
      outline: rect(10 * FT, 48 * FT, 6 * FT, 4 * FT),
    },
  ];
  design.fences = [
    {
      id: "f1",
      name: "Yard",
      kind: "wood",
      points: [
        { x: -4 * FT, y: -4 * FT },
        { x: 48 * FT, y: -4 * FT },
        { x: 48 * FT, y: 96 * FT },
        { x: -4 * FT, y: 96 * FT },
        { x: -4 * FT, y: -4 * FT },
      ],
      gates: [
        {
          id: "g1",
          kind: "swing",
          edgeIndex: 1,
          t: 0.4,
          widthMm: 4 * FT,
        },
      ],
    },
  ];
  return design;
}

describe("permit packet site plan", () => {
  it("empty design has a placeholder, not invented geometry", () => {
    const design = emptyDesignDocument("residential");
    const svg = buildPlanOutlineSvg(design);
    assert.match(svg, /No geometry yet/);
    const section = buildSectionSvg(design);
    assert.match(section, /No pool\/spa for section/);
    const packet = buildPermitPacket(design);
    assert.equal(packet.bodies.length, 0);
    assert.match(packet.disclaimer, /DRAFT FOR PROFESSIONAL REVIEW/);
  });

  it("house + pool drawing includes labels, scale, north, and draft banner", () => {
    const design = houseAndPool();
    const svg = buildPlanOutlineSvg(design, "imperial");
    assert.match(svg, /POOL/);
    assert.match(svg, /HOUSE/);
    assert.match(svg, /PATIO/);
    assert.match(svg, /EQUIP\. PAD/);
    assert.match(svg, /STEPS/);
    assert.match(svg, /GATE/);
    assert.match(svg, /GRAPHIC SCALE/);
    assert.match(svg, />N</);
    assert.match(svg, /DRAFT SITE PLAN/);
    assert.match(svg, /CLR/);
    assert.doesNotMatch(svg, />PROPERTY LINE</);
  });

  it("section sheet is A–A from the depth profile", () => {
    const design = houseAndPool();
    const svg = buildSectionSvg(design, "imperial");
    assert.match(svg, /SECTION A/);
    assert.match(svg, /SHALLOW/);
    assert.match(svg, /DEEP/);
    assert.match(svg, /WL/);
  });

  it("HTML packet is three sheets with title block and disclaimer", () => {
    const design = houseAndPool();
    const packet = buildPermitPacket(design, "imperial");
    assert.ok(packet.sectionSvg.includes("SECTION A"));
    assert.ok(packet.planOutlineSvg.includes("POOL"));
    const html = buildPermitPacketHtml(
      {
        companyName: "Kendig Pools",
        projectName: "Oak Street",
        clientName: "Taylor",
        address: "12 Oak St",
      },
      packet,
    );
    assert.match(html, /sheet 1 of 3/);
    assert.match(html, /sheet 2 of 3/);
    assert.match(html, /sheet 3 of 3/);
    assert.match(html, /NOT FOR PERMIT/);
    assert.match(html, /Kendig Pools/);
    assert.match(html, /Property lines and utilities are not in this model/);
  });
});
