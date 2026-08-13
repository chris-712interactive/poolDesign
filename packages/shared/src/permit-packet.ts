/**
 * Draft permit packet assembly — advisory plan sheets, not PE-stamped drawings.
 */

import {
  analyzeBarrierCompliance,
  type BarrierReport,
} from "./barrier-checks";
import type { Building, DesignDocument, PointMm } from "./design-model";
import {
  fenceKindLabel,
  objectFootprint,
  pointInPolygon,
  polygonAreaMm2,
  polygonPerimeterMm,
  waterBodyKind,
} from "./design-model";
import {
  excavationVolumeCy,
  depthProfileForBody,
  maxDepthMmFromProfile,
  waterVolumeGal,
} from "./depth-profile";
import { computePoolHydraulics } from "./pool-hydraulics";
import { isPadEquipment } from "./plumbing-route";
import { outlineBounds } from "./spa-defaults";
import { formatLength, mmToFeet, MM_PER_FOOT, type UnitSystem } from "./units";

export type PermitPacketBodySummary = {
  id: string;
  kind: string;
  name: string;
  areaSf: number;
  perimeterLf: number;
  maxDepthFt: number;
  shallowFt: number;
  volumeGal: number;
  excavationCy: number;
};

export type PermitPacket = {
  disclaimer: string;
  generatedAt: string;
  barrier: BarrierReport;
  bodies: PermitPacketBodySummary[];
  hydraulicsNotes: string[];
  buildingCount: number;
  patioCount: number;
  fenceRunCount: number;
  gradeSampleCount: number;
  planOutlineSvg: string;
  sectionSvg: string;
};

export const PERMIT_DRAFT_DISCLAIMER =
  "DRAFT FOR PROFESSIONAL REVIEW ONLY — Not an engineered, stamped, or " +
  "jurisdiction-approved permit set. A licensed PE / drafting professional must " +
  "review setbacks, utilities, structural details, and local AHJ requirements " +
  "before submission.";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function collectPlanPoints(design: DesignDocument): PointMm[] {
  const pts: PointMm[] = [];
  for (const b of design.buildings) pts.push(...b.outline);
  for (const p of design.poolBodies) pts.push(...p.outline);
  for (const p of design.patios) pts.push(...p.outline);
  for (const c of design.patioCovers ?? []) pts.push(...c.outline);
  for (const f of design.fences ?? []) pts.push(...f.points);
  for (const g of design.gradeSamples ?? []) pts.push(g.position);
  for (const feat of design.features ?? []) pts.push(...feat.outline);
  for (const obj of design.objects ?? []) pts.push(...objectFootprint(obj));
  return pts;
}

type Frame = {
  ox: number;
  oy: number;
  scale: number;
};

function toSvg(p: PointMm, f: Frame): { x: number; y: number } {
  return {
    x: (p.x - f.ox) * f.scale,
    y: (p.y - f.oy) * f.scale,
  };
}

function pathD(outline: PointMm[], f: Frame, close: boolean): string {
  if (outline.length < 2) return "";
  const d = outline
    .map((p, i) => {
      const s = toSvg(p, f);
      return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
    })
    .join(" ");
  return close ? `${d} Z` : d;
}

function buildingLabel(b: Building): string {
  if (b.kind === "garage") return "GARAGE";
  if (b.kind === "accessory") return "ACCESSORY";
  if (b.kind === "commercial") return "BUILDING";
  const n = (b.name || "HOUSE").trim();
  return n.toUpperCase() || "HOUSE";
}

function niceScaleMm(approxMm: number, unit: UnitSystem): number {
  if (unit === "metric") {
    const m = Math.max(1, approxMm / 1000);
    const nice = [1, 2, 5, 10, 20, 25, 50, 100];
    return (nice.find((n) => n >= m * 0.65) ?? 100) * 1000;
  }
  const ft = Math.max(1, approxMm / MM_PER_FOOT);
  const nice = [5, 10, 20, 25, 30, 40, 50, 100];
  return (nice.find((n) => n >= ft * 0.65) ?? 100) * MM_PER_FOOT;
}

function aabbGap(
  a: ReturnType<typeof outlineBounds>,
  b: ReturnType<typeof outlineBounds>,
): {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  dist: number;
} | null {
  const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  if (b.minX >= a.maxX - 1 && overlapY > 50) {
    const y = (Math.max(a.minY, b.minY) + Math.min(a.maxY, b.maxY)) / 2;
    return { ax: a.maxX, ay: y, bx: b.minX, by: y, dist: b.minX - a.maxX };
  }
  if (a.minX >= b.maxX - 1 && overlapY > 50) {
    const y = (Math.max(a.minY, b.minY) + Math.min(a.maxY, b.maxY)) / 2;
    return { ax: a.minX, ay: y, bx: b.maxX, by: y, dist: a.minX - b.maxX };
  }
  if (b.minY >= a.maxY - 1 && overlapX > 50) {
    const x = (Math.max(a.minX, b.minX) + Math.min(a.maxX, b.maxX)) / 2;
    return { ax: x, ay: a.maxY, bx: x, by: b.minY, dist: b.minY - a.maxY };
  }
  if (a.minY >= b.maxY - 1 && overlapX > 50) {
    const x = (Math.max(a.minX, b.minX) + Math.min(a.maxX, b.maxX)) / 2;
    return { ax: x, ay: a.minY, bx: x, by: b.maxY, dist: a.minY - b.maxY };
  }
  return null;
}

function dimLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy * 5;
  const py = ux * 5;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return `<g class="dim" fill="#152018" stroke="#152018">
    <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-width="0.8"/>
    <line x1="${(x1 - px).toFixed(1)}" y1="${(y1 - py).toFixed(1)}" x2="${(x1 + px).toFixed(1)}" y2="${(y1 + py).toFixed(1)}" stroke-width="0.8"/>
    <line x1="${(x2 - px).toFixed(1)}" y1="${(y2 - py).toFixed(1)}" x2="${(x2 + px).toFixed(1)}" y2="${(y2 + py).toFixed(1)}" stroke-width="0.8"/>
    <text x="${(mx + px * 1.6).toFixed(1)}" y="${(my + py * 1.6).toFixed(1)}" font-size="10" font-family="ui-monospace, Menlo, monospace" stroke="none" text-anchor="middle">${esc(label)}</text>
  </g>`;
}

function labelAnchor(outline: PointMm[], avoid: PointMm[][]): PointMm {
  const bb = outlineBounds(outline);
  const candidates: PointMm[] = [
    { x: bb.cx, y: bb.cy },
    { x: bb.cx, y: bb.minY + bb.height * 0.18 },
    { x: bb.cx, y: bb.maxY - bb.height * 0.18 },
    { x: bb.minX + bb.width * 0.22, y: bb.cy },
    { x: bb.maxX - bb.width * 0.22, y: bb.cy },
    { x: bb.minX + bb.width * 0.22, y: bb.minY + bb.height * 0.18 },
    { x: bb.maxX - bb.width * 0.22, y: bb.minY + bb.height * 0.18 },
  ];
  for (const p of candidates) {
    if (!pointInPolygon(p, outline)) continue;
    if (avoid.some((poly) => pointInPolygon(p, poly))) continue;
    return p;
  }
  return { x: bb.cx, y: bb.cy };
}

function centroidText(
  outline: PointMm[],
  f: Frame,
  label: string,
  opts: {
    size?: number;
    fill?: string;
    dy?: number;
    weight?: number;
    at?: PointMm;
  } = {},
): string {
  const bb = outlineBounds(outline);
  const p = opts.at ?? { x: bb.cx, y: bb.cy };
  const c = toSvg(p, f);
  const size = opts.size ?? 12;
  const fill = opts.fill ?? "#152018";
  const dy = opts.dy ?? 0;
  const weight = opts.weight ?? 700;
  return `<text x="${c.x.toFixed(1)}" y="${(c.y + dy).toFixed(1)}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="ui-sans-serif, system-ui">${esc(label)}</text>`;
}

/** Draft site plan: labels, dimensions, scale bar, north, pad, features. */
export function buildPlanOutlineSvg(
  design: DesignDocument,
  unitSystem: UnitSystem = design.unitSystem,
  size = 1000,
): string {
  const pts = collectPlanPoints(design);
  const height = Math.round(size * 0.78);
  if (pts.length < 2) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}"><text x="24" y="40" fill="#666">No geometry yet</text></svg>`;
  }
  const b = outlineBounds(pts);
  const margin = 88;
  const w = Math.max(1, b.width);
  const h = Math.max(1, b.height);
  const scale = Math.min(
    (size - margin * 2) / w,
    (height - margin * 2 - 36) / h,
  );
  const f: Frame = {
    ox: b.minX - margin / scale,
    oy: b.minY - margin / scale,
    scale,
  };

  const layers: string[] = [
    `<defs>
      <pattern id="patioHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#c4b8a8" stroke-width="1"/>
      </pattern>
      <pattern id="padHatch" width="6" height="6" patternUnits="userSpaceOnUse">
        <path d="M0 0L6 6M6 0L0 6" stroke="#6a6258" stroke-width="0.7"/>
      </pattern>
    </defs>`,
  ];

  for (const patio of design.patios) {
    const d = pathD(patio.outline, f, true);
    if (!d) continue;
    layers.push(
      `<path d="${d}" fill="#f0e6d6" stroke="#6e6358" stroke-width="1.1"/>`,
    );
    layers.push(
      `<path d="${d}" fill="url(#patioHatch)" stroke="none" opacity="0.45"/>`,
    );
    layers.push(
      centroidText(patio.outline, f, "PATIO", {
        size: 11,
        fill: "#5a5048",
        at: labelAnchor(
          patio.outline,
          design.poolBodies.map((body) => body.outline),
        ),
      }),
    );
  }

  for (const building of design.buildings) {
    const d = pathD(building.outline, f, true);
    if (!d) continue;
    layers.push(
      `<path d="${d}" fill="#d8e0e8" stroke="#2c3a44" stroke-width="1.6"/>`,
    );
    const n = building.outline.length;
    for (const op of building.openings ?? []) {
      if (op.kind === "window") continue;
      const a = building.outline[op.edgeIndex];
      const b2 = building.outline[(op.edgeIndex + 1) % n];
      if (!a || !b2) continue;
      const x = a.x + (b2.x - a.x) * op.t;
      const y = a.y + (b2.y - a.y) * op.t;
      const s = toSvg({ x, y }, f);
      layers.push(
        `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="3.2" fill="#fff" stroke="#2c3a44" stroke-width="1.2"/>`,
      );
    }
    layers.push(
      centroidText(building.outline, f, buildingLabel(building), {
        size: 12,
        fill: "#1e2a32",
      }),
    );
  }

  for (const body of design.poolBodies) {
    const d = pathD(body.outline, f, true);
    if (!d) continue;
    const spa = waterBodyKind(body) === "spa";
    layers.push(
      `<path d="${d}" fill="${spa ? "#8fc4dc" : "#4a9ec7"}" stroke="#163d52" stroke-width="1.6"/>`,
    );
    const tag = spa ? "SPA" : "POOL";
    const extra =
      body.name && body.name.toUpperCase() !== tag ? ` ${body.name}` : "";
    layers.push(
      centroidText(body.outline, f, `${tag}${extra}`, {
        size: 13,
        fill: "#072230",
      }),
    );
    const bb = outlineBounds(body.outline);
    const c = toSvg({ x: bb.cx, y: bb.cy }, f);
    layers.push(
      `<text x="${c.x.toFixed(1)}" y="${(c.y + 14).toFixed(1)}" text-anchor="middle" font-size="9" fill="#072230" font-family="ui-monospace, Menlo, monospace">${esc(formatLength(bb.width, unitSystem))} × ${esc(formatLength(bb.height, unitSystem))}</text>`,
    );

    const p0 = toSvg({ x: bb.minX, y: bb.maxY + 18 / scale }, f);
    const p1 = toSvg({ x: bb.maxX, y: bb.maxY + 18 / scale }, f);
    layers.push(
      dimLine(p0.x, p0.y, p1.x, p1.y, formatLength(bb.width, unitSystem)),
    );
    const q0 = toSvg({ x: bb.maxX + 18 / scale, y: bb.minY }, f);
    const q1 = toSvg({ x: bb.maxX + 18 / scale, y: bb.maxY }, f);
    layers.push(
      dimLine(q0.x, q0.y, q1.x, q1.y, formatLength(bb.height, unitSystem)),
    );

    try {
      const profile = depthProfileForBody(body);
      const ax = profile.axis;
      const o = profile.originMm;
      const len = profile.axisLengthMm;
      const a = { x: o.x, y: o.y };
      const z = { x: o.x + ax.x * len, y: o.y + ax.y * len };
      const sa = toSvg(a, f);
      const sz = toSvg(z, f);
      layers.push(
        `<line x1="${sa.x.toFixed(1)}" y1="${sa.y.toFixed(1)}" x2="${sz.x.toFixed(1)}" y2="${sz.y.toFixed(1)}" stroke="#8a1c1c" stroke-width="1.1" stroke-dasharray="6 3"/>`,
      );
      layers.push(
        `<text x="${sa.x.toFixed(1)}" y="${(sa.y - 6).toFixed(1)}" font-size="9" font-weight="700" fill="#8a1c1c" font-family="ui-sans-serif, system-ui">A</text>`,
      );
      layers.push(
        `<text x="${sz.x.toFixed(1)}" y="${(sz.y - 6).toFixed(1)}" font-size="9" font-weight="700" fill="#8a1c1c" font-family="ui-sans-serif, system-ui">A</text>`,
      );
      layers.push(
        `<text x="${sa.x.toFixed(1)}" y="${(sa.y + 14).toFixed(1)}" font-size="8" fill="#8a1c1c" font-family="ui-monospace, Menlo, monospace">${esc(formatLength(body.depthShallowMm, unitSystem))}</text>`,
      );
      layers.push(
        `<text x="${sz.x.toFixed(1)}" y="${(sz.y + 14).toFixed(1)}" font-size="8" fill="#8a1c1c" font-family="ui-monospace, Menlo, monospace">${esc(formatLength(maxDepthMmFromProfile(body), unitSystem))}</text>`,
      );
    } catch {
      // no section cut
    }
  }

  for (const feat of design.features ?? []) {
    const d = pathD(feat.outline, f, true);
    if (!d) continue;
    layers.push(
      `<path d="${d}" fill="#c5dce8" stroke="#2a5a70" stroke-width="1" stroke-dasharray="3 2"/>`,
    );
    const tag =
      feat.kind === "steps"
        ? "STEPS"
        : feat.kind === "bench"
          ? "BENCH"
          : "SUNSHELF";
    layers.push(
      centroidText(feat.outline, f, tag, { size: 8, fill: "#1e4a5c" }),
    );
  }

  for (const cover of design.patioCovers ?? []) {
    const d = pathD(cover.outline, f, true);
    if (!d) continue;
    layers.push(
      `<path d="${d}" fill="none" stroke="#5c4a32" stroke-width="1.2" stroke-dasharray="5 3"/>`,
    );
    layers.push(
      centroidText(cover.outline, f, (cover.kind || "cover").toUpperCase(), {
        size: 9,
        fill: "#5c4a32",
        dy: 12,
        weight: 600,
      }),
    );
  }

  for (const obj of design.objects ?? []) {
    const fp = objectFootprint(obj);
    const d = pathD(fp, f, true);
    if (!d) continue;
    if (obj.catalogItemId === "equip_pad") {
      layers.push(
        `<path d="${d}" fill="url(#padHatch)" stroke="#3a342e" stroke-width="1.4"/>`,
      );
      const s = toSvg(obj.position, f);
      layers.push(
        `<text x="${s.x.toFixed(1)}" y="${s.y.toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#2a2420" font-family="ui-sans-serif, system-ui">EQUIP. PAD</text>`,
      );
    } else if (isPadEquipment(obj)) {
      layers.push(
        `<path d="${d}" fill="#cfc8be" stroke="#3a342e" stroke-width="0.9"/>`,
      );
    }
  }

  for (const fence of design.fences ?? []) {
    const d = pathD(fence.points, f, false);
    if (d) {
      layers.push(
        `<path d="${d}" fill="none" stroke="#1c2a22" stroke-width="2"/>`,
      );
    }
    for (const gate of fence.gates ?? []) {
      const a = fence.points[gate.edgeIndex];
      const b2 = fence.points[gate.edgeIndex + 1];
      if (!a || !b2) continue;
      const x = a.x + (b2.x - a.x) * gate.t;
      const y = a.y + (b2.y - a.y) * gate.t;
      const s = toSvg({ x, y }, f);
      layers.push(
        `<rect x="${(s.x - 5).toFixed(1)}" y="${(s.y - 5).toFixed(1)}" width="10" height="10" fill="#fff" stroke="#1c2a22" stroke-width="1.3"/>`,
      );
      layers.push(
        `<text x="${(s.x + 8).toFixed(1)}" y="${(s.y + 3).toFixed(1)}" font-size="8" font-weight="700" fill="#1c2a22" font-family="ui-sans-serif, system-ui">GATE</text>`,
      );
    }
    if (fence.points.length >= 2) {
      const mid = fence.points[Math.floor(fence.points.length / 2)];
      const s = toSvg(mid, f);
      layers.push(
        `<text x="${s.x.toFixed(1)}" y="${(s.y - 8).toFixed(1)}" text-anchor="middle" font-size="8" fill="#1c2a22" font-family="ui-sans-serif, system-ui">${esc(fenceKindLabel(fence.kind).toUpperCase())} FENCE</text>`,
      );
    }
  }

  for (const sample of (design.gradeSamples ?? []).slice(0, 16)) {
    const s = toSvg(sample.position, f);
    layers.push(
      `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="2.4" fill="#3d5a2c" stroke="#152018" stroke-width="0.6"/>`,
    );
    layers.push(
      `<text x="${(s.x + 6).toFixed(1)}" y="${(s.y - 4).toFixed(1)}" font-size="7" fill="#3d5a2c" font-family="ui-monospace, Menlo, monospace">${esc(formatLength(sample.dropMm, unitSystem))}</text>`,
    );
  }

  const house = design.buildings[0];
  const pool =
    design.poolBodies.find((body) => waterBodyKind(body) !== "spa") ??
    design.poolBodies[0];
  if (house && pool) {
    const gap = aabbGap(
      outlineBounds(house.outline),
      outlineBounds(pool.outline),
    );
    if (gap && gap.dist > 50) {
      const a = toSvg({ x: gap.ax, y: gap.ay }, f);
      const z = toSvg({ x: gap.bx, y: gap.by }, f);
      layers.push(
        dimLine(a.x, a.y, z.x, z.y, `${formatLength(gap.dist, unitSystem)} CLR`),
      );
    }
  }

  const barMm = niceScaleMm(120 / scale, unitSystem);
  const barPx = barMm * scale;
  const bx = 24;
  const by = height - 28;
  const barX2 = bx + barPx;
  const barMid = bx + barPx / 2;
  layers.push(`<g class="scale">
    <line x1="${bx}" y1="${by}" x2="${barX2.toFixed(1)}" y2="${by}" stroke="#152018" stroke-width="2"/>
    <line x1="${bx}" y1="${by - 6}" x2="${bx}" y2="${by + 6}" stroke="#152018" stroke-width="2"/>
    <line x1="${barX2.toFixed(1)}" y1="${by - 6}" x2="${barX2.toFixed(1)}" y2="${by + 6}" stroke="#152018" stroke-width="2"/>
    <text x="${barMid.toFixed(1)}" y="${by - 10}" text-anchor="middle" font-size="10" font-family="ui-monospace, Menlo, monospace" fill="#152018">${esc(formatLength(barMm, unitSystem))}</text>
    <text x="${bx}" y="${by + 16}" font-size="8" fill="#5a6a60" font-family="ui-sans-serif, system-ui">GRAPHIC SCALE</text>
  </g>`);

  const nx = size - 52;
  const ny = 36;
  layers.push(`<g class="north">
    <polygon points="${nx},${ny - 16} ${nx - 7},${ny + 10} ${nx},${ny + 4} ${nx + 7},${ny + 10}" fill="#152018"/>
    <text x="${nx}" y="${ny + 24}" text-anchor="middle" font-size="11" font-weight="700" font-family="ui-sans-serif, system-ui" fill="#152018">N</text>
  </g>`);

  layers.push(
    `<text x="24" y="22" font-size="9" fill="#8a1c1c" font-family="ui-sans-serif, system-ui" font-weight="700">DRAFT SITE PLAN — NOT FOR CONSTRUCTION / PERMIT SUBMITTAL</text>`,
  );
  layers.push(
    `<text x="24" y="36" font-size="8" fill="#5a6a60" font-family="ui-sans-serif, system-ui">N = drawing up (matches 2D plan). Confirm true north, property lines, and utilities with survey. A–A = pool section.</text>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 ${size} ${height}" style="background:#f7f4ee">${layers.join("")}</svg>`;
}

/** Longitudinal pool section from the authored depth profile (sheet A–A). */
export function buildSectionSvg(
  design: DesignDocument,
  unitSystem: UnitSystem = design.unitSystem,
  width = 1000,
): string {
  const body =
    design.poolBodies.find((b) => waterBodyKind(b) !== "spa") ??
    design.poolBodies[0];
  const height = 280;
  if (!body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="24" y="40" fill="#666">No pool/spa for section</text></svg>`;
  }
  const profile = depthProfileForBody(body);
  const stations = profile.stations;
  const maxD = Math.max(
    maxDepthMmFromProfile(body),
    ...stations.map((s) => s.depthMm),
    900,
  );
  const padL = 72;
  const padR = 36;
  const padT = 36;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const waterY = padT + 8;
  const pts = stations.map((s) => {
    const x = padL + s.t * plotW;
    const y = waterY + (s.depthMm / maxD) * (plotH - 16);
    return { x, y, s };
  });
  const floor = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const x0 = pts[0]?.x ?? padL;
  const x1 = pts[pts.length - 1]?.x ?? padL + plotW;
  const y0 = pts[0]?.y ?? waterY + 40;
  const y1 = pts[pts.length - 1]?.y ?? waterY + 80;
  const waterFill = `M${x0.toFixed(1)} ${waterY} L${x1.toFixed(1)} ${waterY} L${x1.toFixed(1)} ${y1.toFixed(1)} ${[...pts]
    .reverse()
    .map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ")} Z`;

  const labels = pts.map((p) => {
    const d = formatLength(p.s.depthMm, unitSystem);
    return `<text x="${p.x.toFixed(1)}" y="${(p.y + 14).toFixed(1)}" text-anchor="middle" font-size="9" font-family="ui-monospace, Menlo, monospace" fill="#152018">${esc(d)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#f7f4ee">
    <text x="24" y="20" font-size="11" font-weight="700" font-family="ui-sans-serif, system-ui" fill="#8a1c1c">SECTION A–A — ${esc(waterBodyKind(body) === "spa" ? "SPA" : "POOL")} (draft)</text>
    <path d="${waterFill}" fill="#9ecfe3" opacity="0.85"/>
    <line x1="${x0.toFixed(1)}" y1="${waterY}" x2="${x1.toFixed(1)}" y2="${waterY}" stroke="#1e5f7a" stroke-width="1.4"/>
    <path d="${floor}" fill="none" stroke="#3a342e" stroke-width="2"/>
    <line x1="${x0.toFixed(1)}" y1="${waterY}" x2="${x0.toFixed(1)}" y2="${y0.toFixed(1)}" stroke="#3a342e" stroke-width="2"/>
    <line x1="${x1.toFixed(1)}" y1="${waterY}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#3a342e" stroke-width="2"/>
    <text x="${x0.toFixed(1)}" y="${waterY - 6}" font-size="8" fill="#1e5f7a" font-family="ui-sans-serif, system-ui">WL</text>
    <text x="${x0.toFixed(1)}" y="${height - 12}" font-size="9" font-family="ui-sans-serif, system-ui" fill="#5a6a60">SHALLOW</text>
    <text x="${x1.toFixed(1)}" y="${height - 12}" text-anchor="end" font-size="9" font-family="ui-sans-serif, system-ui" fill="#5a6a60">DEEP</text>
    ${labels.join("")}
    <text x="${width / 2}" y="${height - 12}" text-anchor="middle" font-size="8" fill="#5a6a60" font-family="ui-monospace, Menlo, monospace">Length ${esc(formatLength(profile.axisLengthMm, unitSystem))} · max depth ${esc(formatLength(maxD, unitSystem))}</text>
  </svg>`;
}

export function buildPermitPacket(
  design: DesignDocument,
  unitSystem: UnitSystem = design.unitSystem,
): PermitPacket {
  const bodies: PermitPacketBodySummary[] = design.poolBodies.map((body) => {
    const areaMm2 = polygonAreaMm2(body.outline);
    const perimMm = polygonPerimeterMm(body.outline);
    return {
      id: body.id,
      kind: waterBodyKind(body),
      name: body.name,
      areaSf: areaMm2 / 92903.04,
      perimeterLf: perimMm / 304.8,
      maxDepthFt: mmToFeet(maxDepthMmFromProfile(body)),
      shallowFt: mmToFeet(body.depthShallowMm),
      volumeGal: waterVolumeGal(body),
      excavationCy: excavationVolumeCy(body),
    };
  });

  const hydraulicsNotes: string[] = [];
  for (const body of design.poolBodies) {
    if (waterBodyKind(body) === "spa") continue;
    try {
      const h = computePoolHydraulics(body, design);
      if (h) {
        hydraulicsNotes.push(
          `${body.name || body.id}: ~${h.volumeGal.toFixed(0)} gal @ ${h.turnoverHours}h turnover → ${h.designPumpGpm.toFixed(0)} GPM design; ${h.methodNotes.slice(0, 2).join("; ")}`,
        );
      }
    } catch {
      // advisory only
    }
  }

  return {
    disclaimer: PERMIT_DRAFT_DISCLAIMER,
    generatedAt: new Date().toISOString(),
    barrier: analyzeBarrierCompliance(design),
    bodies,
    hydraulicsNotes,
    buildingCount: design.buildings.length,
    patioCount: design.patios.length,
    fenceRunCount: (design.fences ?? []).length,
    gradeSampleCount: (design.gradeSamples ?? []).length,
    planOutlineSvg: buildPlanOutlineSvg(design, unitSystem),
    sectionSvg: buildSectionSvg(design, unitSystem),
  };
}

export type PermitDocMeta = {
  companyName: string;
  projectName: string;
  clientName?: string | null;
  address?: string | null;
};

export function buildPermitPacketHtml(
  meta: PermitDocMeta,
  packet: PermitPacket,
): string {
  const bodyRows = packet.bodies
    .map(
      (b) => `<tr>
  <td>${esc(b.kind)}${b.name ? ` — ${esc(b.name)}` : ""}</td>
  <td>${b.areaSf.toFixed(1)} sf</td>
  <td>${b.perimeterLf.toFixed(1)} lf</td>
  <td>${b.shallowFt.toFixed(2)} / ${b.maxDepthFt.toFixed(2)} ft</td>
  <td>${b.volumeGal.toFixed(0)} gal</td>
  <td>${b.excavationCy.toFixed(1)} cy</td>
</tr>`,
    )
    .join("\n");

  const findings = packet.barrier.findings
    .map(
      (f) =>
        `<li><strong>[${esc(f.severity)}]</strong> ${esc(f.message)}</li>`,
    )
    .join("\n");

  const hydro = packet.hydraulicsNotes
    .map((n) => `<li>${esc(n)}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Draft permit packet — ${esc(meta.projectName)}</title>
  <style>
    body { font-family: Georgia, serif; margin: 0; color: #152018; background: #e6e6e6; }
    .sheet { max-width: 1100px; margin: 0 auto 1.25rem; padding: 1.1rem 1.25rem 1.35rem; background: #fff; page-break-after: always; }
    h1, h2 { font-family: "Fraunces", Georgia, serif; margin: 0.2rem 0 0.55rem; }
    h1 { font-size: 1.45rem; }
    .banner { background: #fff3cd; border: 1px solid #e0c35a; padding: 0.65rem 0.85rem; font-size: 0.82rem; margin-bottom: 0.75rem; }
    .muted { color: #5a6a60; }
    .titleblock { display: grid; grid-template-columns: 1fr auto; gap: 0.75rem; align-items: end; border-bottom: 2px solid #152018; padding-bottom: 0.55rem; margin-bottom: 0.75rem; }
    .stamp { border: 2px solid #8a1c1c; color: #8a1c1c; font-weight: 700; font-size: 0.78rem; letter-spacing: 0.06em; padding: 0.35rem 0.55rem; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0 1rem; }
    th, td { text-align: left; padding: 0.45rem; border-bottom: 1px solid #d5ddd7; font-size: 0.9rem; }
    .plan { border: 1px solid #b7c0ba; background: #f7f4ee; }
    .plan svg { display: block; width: 100%; height: auto; }
    .legend { font-size: 0.78rem; color: #5a6a60; margin: 0.4rem 0 0; }
    @media print {
      body { background: #fff; }
      .sheet { box-shadow: none; margin: 0; max-width: none; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <p class="no-print muted">Print → Save as PDF for a multi-page draft packet.</p>
    <div class="banner"><strong>Advisory draft</strong> — ${esc(packet.disclaimer)}</div>
    <div class="titleblock">
      <div>
        <h1>Site plan — sheet 1 of 3</h1>
        <p style="margin:0"><strong>${esc(meta.companyName)}</strong></p>
        <p style="margin:0.15rem 0 0">${esc(meta.projectName)}</p>
        <p class="muted" style="margin:0.15rem 0 0">${[meta.clientName, meta.address].filter(Boolean).map(String).map(esc).join(" · ") || "—"}</p>
      </div>
      <div class="stamp">DRAFT<br/>NOT FOR PERMIT</div>
    </div>
    <div class="plan">${packet.planOutlineSvg}</div>
    <p class="legend">Hatch = patio · dashed roof/pergola · hatched rectangle = equipment pad · square on fence = gate · A–A = section on sheet 2. Property lines and utilities are not in this model.</p>
    <p class="muted" style="margin:0.35rem 0 0; font-size:0.78rem">Generated ${esc(new Date(packet.generatedAt).toLocaleString())}</p>
  </div>

  <div class="sheet">
    <div class="titleblock">
      <div>
        <h1>Section &amp; quantities — sheet 2 of 3</h1>
        <p class="muted" style="margin:0">${esc(meta.projectName)}</p>
      </div>
      <div class="stamp">DRAFT</div>
    </div>
    <div class="plan">${packet.sectionSvg}</div>
    <h2>Water body summary</h2>
    <table>
      <thead>
        <tr>
          <th>Body</th><th>Area</th><th>Perimeter</th><th>Shallow / max</th><th>Volume</th><th>Excavation</th>
        </tr>
      </thead>
      <tbody>${bodyRows || `<tr><td colspan="6" class="muted">No pools/spas</td></tr>`}</tbody>
    </table>
    <p class="muted">Counts — buildings: ${packet.buildingCount}, patios: ${packet.patioCount},
      fence runs: ${packet.fenceRunCount}, grade samples: ${packet.gradeSampleCount}</p>
    <h2>Hydraulics notes (advisory)</h2>
    <ul>${hydro || "<li class='muted'>No notes</li>"}</ul>
  </div>

  <div class="sheet">
    <div class="titleblock">
      <div>
        <h1>Barrier checklist — sheet 3 of 3</h1>
        <p class="muted" style="margin:0">ISPSC-style soft checks — confirm with AHJ</p>
      </div>
      <div class="stamp">DRAFT</div>
    </div>
    <p class="muted">Overall: ${packet.barrier.ok ? "No blocking findings" : "Review warnings below"}</p>
    <ul>${findings || "<li class='muted'>No findings</li>"}</ul>
    <div class="banner" style="margin-top:1.5rem">${esc(packet.disclaimer)}</div>
  </div>
</body>
</html>`;
}
