/**
 * House roof: 2D ridges → pitched 3D height field.
 *
 * Height at a plan point is a tent off the nearest ridge segment:
 *   h = max(0, rise − (pitch12/12) · distToRidge)
 *
 * A ridge that runs to the gable walls makes a classic two-plane gable.
 * A ridge that stops short of the ends reads as a hip.
 */

import type { PointMm } from "./design-model";
import { flattenClosedOutline, outlineHasArcs } from "./outline-arcs";
import { pointInPolygon } from "./design-model";
import {
  clampRoofOverhangMm,
  clampRoofPitch12,
  DEFAULT_ROOF_OVERHANG_MM,
  DEFAULT_ROOF_MATERIAL_ID,
  isRoofMaterialId,
  resolveRoofColor,
  type RoofColor,
  type RoofMaterialId,
} from "./roof-finishes";
import { offsetClosedOutline, planSignedAreaMm2 } from "./scene3d";
import { outlineBounds, rectangleFrame } from "./spa-defaults";

export type RoofStyle = "flat" | "pitched";

export type RoofRidge = {
  id: string;
  /** Open polyline in plan mm (usually two points). */
  points: PointMm[];
};

export type BuildingRoof = {
  style?: RoofStyle;
  /** Rise over run as n in n/12. Default 6. */
  pitch12?: number;
  /** Eave overhang beyond the walls (mm). Default 280. */
  overhangMm?: number;
  ridges?: RoofRidge[];
  /** Catalog material id (shingle, tile, metal, …). */
  finishId?: string;
  /** Tint override; falls back to the material default. */
  color?: RoofColor;
};

export type ResolvedBuildingRoof = {
  style: RoofStyle;
  pitch12: number;
  overhangMm: number;
  ridges: RoofRidge[];
  finishId: RoofMaterialId;
  color: RoofColor;
};

export type RoofVertexMm = {
  x: number;
  y: number;
  /** Height above the wall plate (mm). */
  hMm: number;
};

export type RoofTessellation = {
  vertices: RoofVertexMm[];
  indices: number[];
  /** Vertical gable infill above the plate, along footprint walls. */
  gables: Array<{
    a: PointMm;
    b: PointMm;
    haMm: number;
    hbMm: number;
  }>;
  riseMm: number;
};

const RIDGE_LEN_MIN_MM = 200;
const GRID_STEP_MM = 420;
const GABLE_SAMPLE_MM = 380;
const GABLE_MIN_MM = 80;

function ringOf(outline: PointMm[]): PointMm[] {
  const src = outlineHasArcs(outline)
    ? flattenClosedOutline(outline)
    : outline;
  if (src.length < 3) return src.map((p) => ({ x: p.x, y: p.y }));
  const first = src[0];
  const last = src[src.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) < 1) {
    return src.slice(0, -1).map((p) => ({ x: p.x, y: p.y }));
  }
  return src.map((p) => ({ x: p.x, y: p.y }));
}

export function distPointToSegmentMm(
  p: PointMm,
  a: PointMm,
  b: PointMm,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToRidgesMm(p: PointMm, ridges: RoofRidge[]): number {
  let best = Infinity;
  for (const ridge of ridges) {
    const pts = ridge.points;
    for (let i = 1; i < pts.length; i++) {
      const d = distPointToSegmentMm(p, pts[i - 1], pts[i]);
      if (d < best) best = d;
    }
  }
  return best;
}

function centroidOf(ring: PointMm[]): PointMm {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(1, ring.length);
  return { x: x / n, y: y / n };
}

/** Longest chord through the house along `axis`, used for an auto gable ridge. */
export function clipLineToPolygon(
  origin: PointMm,
  axis: PointMm,
  outline: PointMm[],
): PointMm[] | null {
  const ring = ringOf(outline);
  const len = Math.hypot(axis.x, axis.y);
  if (len < 1e-6 || ring.length < 3) return null;
  const ux = axis.x / len;
  const uy = axis.y / len;
  const b = outlineBounds(ring);
  const span = Math.hypot(b.width, b.height) + 2000;
  const step = 80;
  let tMin = Infinity;
  let tMax = -Infinity;
  for (let t = -span; t <= span; t += step) {
    const p = { x: origin.x + ux * t, y: origin.y + uy * t };
    if (pointInPolygon(p, ring)) {
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
    }
  }
  if (!Number.isFinite(tMin) || tMax - tMin < RIDGE_LEN_MIN_MM) return null;
  return [
    { x: origin.x + ux * tMin, y: origin.y + uy * tMin },
    { x: origin.x + ux * tMax, y: origin.y + uy * tMax },
  ];
}

/** Centered gable ridge along the long axis of the footprint. */
export function autoGableRidgePoints(outline: PointMm[]): PointMm[] {
  const ring = ringOf(outline);
  if (ring.length < 3) return [];
  const frame = rectangleFrame(ring);
  let axis: PointMm;
  let origin: PointMm;
  if (frame) {
    origin = frame.center;
    axis =
      frame.lengthMm >= frame.widthMm ? frame.axisLength : frame.axisWidth;
  } else {
    const b = outlineBounds(ring);
    origin = { x: b.cx, y: b.cy };
    axis = b.width >= b.height ? { x: 1, y: 0 } : { x: 0, y: 1 };
  }
  return (
    clipLineToPolygon(origin, axis, ring) ??
    (() => {
      const c = centroidOf(ring);
      const b = outlineBounds(ring);
      const long = Math.max(b.width, b.height);
      const ux = axis.x;
      const uy = axis.y;
      const alen = Math.hypot(ux, uy) || 1;
      const h = (long * 0.45) / alen;
      return [
        { x: c.x - ux * h, y: c.y - uy * h },
        { x: c.x + ux * h, y: c.y + uy * h },
      ];
    })()
  );
}

export function isRoofStyle(v: unknown): v is RoofStyle {
  return v === "flat" || v === "pitched";
}

export function normalizeRoofRidges(
  ridges: RoofRidge[] | undefined,
): RoofRidge[] {
  if (!Array.isArray(ridges)) return [];
  const out: RoofRidge[] = [];
  for (const ridge of ridges) {
    if (!ridge || typeof ridge !== "object") continue;
    const points = (ridge.points ?? [])
      .filter(
        (p) =>
          p &&
          Number.isFinite(p.x) &&
          Number.isFinite(p.y),
      )
      .map((p) => ({ x: p.x, y: p.y }));
    if (points.length < 2) continue;
    const len = points.reduce((acc, p, i) => {
      if (i === 0) return 0;
      return acc + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    }, 0);
    if (len < RIDGE_LEN_MIN_MM) continue;
    out.push({
      id:
        typeof ridge.id === "string" && ridge.id.length > 0
          ? ridge.id
          : `ridge_${out.length + 1}`,
      points,
    });
  }
  return out;
}

export function resolvedBuildingRoof(building: {
  outline: PointMm[];
  roof?: BuildingRoof | null;
}): ResolvedBuildingRoof {
  const roof = building.roof ?? {};
  const style: RoofStyle = isRoofStyle(roof.style) ? roof.style : "flat";
  const pitch12 = clampRoofPitch12(roof.pitch12);
  const overhangMm = clampRoofOverhangMm(roof.overhangMm);
  const finishId = isRoofMaterialId(roof.finishId)
    ? roof.finishId
    : style === "flat"
      ? "membrane"
      : DEFAULT_ROOF_MATERIAL_ID;
  const color = resolveRoofColor(finishId, roof.color);
  let ridges = normalizeRoofRidges(roof.ridges);
  if (style === "pitched" && ridges.length === 0) {
    const pts = autoGableRidgePoints(building.outline);
    if (pts.length >= 2) {
      ridges = [{ id: "ridge_auto", points: pts }];
    }
  }
  return { style, pitch12, overhangMm, ridges, finishId, color };
}

export function estimateRoofRiseMm(
  outline: PointMm[],
  ridges: RoofRidge[],
  pitch12: number,
): number {
  const ring = ringOf(outline);
  if (ring.length < 3 || ridges.length === 0) {
    const b = outlineBounds(ring.length ? ring : outline);
    const half = Math.max(b.width, b.height) * 0.5;
    return (clampRoofPitch12(pitch12) / 12) * half;
  }
  const samples: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / 500));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      samples.push(distToRidgesMm(p, ridges));
    }
  }
  samples.sort((a, b) => a - b);
  const mid = samples[Math.floor(samples.length / 2)] ?? 3000;
  return (clampRoofPitch12(pitch12) / 12) * Math.max(400, mid);
}

export function roofHeightMm(
  p: PointMm,
  ridges: RoofRidge[],
  pitch12: number,
  riseMm: number,
): number {
  if (ridges.length === 0) return 0;
  const d = distToRidgesMm(p, ridges);
  const run = 12 / Math.max(2, pitch12);
  return Math.max(0, riseMm - d / run);
}

function eaveOutline(outline: PointMm[], overhangMm: number): PointMm[] {
  const ring = ringOf(outline);
  if (overhangMm < 8) return ring;
  const offset = offsetClosedOutline(ring, overhangMm);
  return offset.length >= 3 ? offset : ring;
}

function addVertex(
  list: RoofVertexMm[],
  map: Map<string, number>,
  p: PointMm,
  hMm: number,
): number {
  const key = `${Math.round(p.x)}:${Math.round(p.y)}`;
  const hit = map.get(key);
  if (hit != null) {
    if (hMm > list[hit].hMm) list[hit].hMm = hMm;
    return hit;
  }
  const i = list.length;
  list.push({ x: p.x, y: p.y, hMm });
  map.set(key, i);
  return i;
}

/**
 * Tessellate the eave polygon on a plan grid and lift vertices by ridge distance.
 */
export function tessellatePitchedRoof(
  outline: PointMm[],
  ridges: RoofRidge[],
  pitch12: number,
  overhangMm = DEFAULT_ROOF_OVERHANG_MM,
): RoofTessellation {
  const empty: RoofTessellation = {
    vertices: [],
    indices: [],
    gables: [],
    riseMm: 0,
  };
  const eave = eaveOutline(outline, overhangMm);
  if (eave.length < 3 || ridges.length === 0) return empty;
  const riseMm = estimateRoofRiseMm(eave, ridges, pitch12);
  const bb = outlineBounds(eave);
  const pad = 20;
  const x0 = bb.minX - pad;
  const y0 = bb.minY - pad;
  const x1 = bb.maxX + pad;
  const y1 = bb.maxY + pad;
  const cols = Math.max(2, Math.ceil((x1 - x0) / GRID_STEP_MM) + 1);
  const rows = Math.max(2, Math.ceil((y1 - y0) / GRID_STEP_MM) + 1);
  const stepX = (x1 - x0) / (cols - 1);
  const stepY = (y1 - y0) / (rows - 1);

  const vertices: RoofVertexMm[] = [];
  const map = new Map<string, number>();
  const grid: number[][] = [];
  const inside: boolean[][] = [];
  for (let j = 0; j < rows; j++) {
    grid[j] = [];
    inside[j] = [];
    for (let i = 0; i < cols; i++) {
      const p = { x: x0 + i * stepX, y: y0 + j * stepY };
      const on = pointInPolygon(p, eave);
      inside[j][i] = on;
      const h = on ? roofHeightMm(p, ridges, pitch12, riseMm) : 0;
      grid[j][i] = addVertex(vertices, map, p, h);
    }
  }

  const indices: number[] = [];
  const pushTri = (a: number, b: number, c: number, flip: boolean) => {
    if (a === b || b === c || c === a) return;
    if (flip) indices.push(a, c, b);
    else indices.push(a, b, c);
  };
  const area = planSignedAreaMm2(eave);
  const flip = area >= 0;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const c00 = inside[j][i];
      const c10 = inside[j][i + 1];
      const c01 = inside[j + 1][i];
      const c11 = inside[j + 1][i + 1];
      const count = (c00 ? 1 : 0) + (c10 ? 1 : 0) + (c01 ? 1 : 0) + (c11 ? 1 : 0);
      if (count < 3) continue;
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i];
      const d = grid[j + 1][i + 1];
      if (count === 4) {
        pushTri(a, b, c, flip);
        pushTri(b, d, c, flip);
      } else {
        if (c00 && c10 && c01) pushTri(a, b, c, flip);
        if (c10 && c11 && c01) pushTri(b, d, c, flip);
        if (c00 && c10 && c11) pushTri(a, b, d, flip);
        if (c00 && c11 && c01) pushTri(a, d, c, flip);
      }
    }
  }

  const footprint = ringOf(outline);
  const gables: RoofTessellation["gables"] = [];
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i];
    const bpt = footprint[(i + 1) % footprint.length];
    const len = Math.hypot(bpt.x - a.x, bpt.y - a.y);
    if (len < 80) continue;
    const n = Math.max(2, Math.ceil(len / GABLE_SAMPLE_MM));
    const samples: Array<{ p: PointMm; h: number }> = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const p = { x: a.x + (bpt.x - a.x) * t, y: a.y + (bpt.y - a.y) * t };
      samples.push({
        p,
        h: roofHeightMm(p, ridges, pitch12, riseMm),
      });
    }
    const maxH = samples.reduce((m, s) => Math.max(m, s.h), 0);
    if (maxH < GABLE_MIN_MM) continue;
    for (let k = 0; k < samples.length - 1; k++) {
      const s0 = samples[k];
      const s1 = samples[k + 1];
      if (s0.h < 12 && s1.h < 12) continue;
      gables.push({
        a: s0.p,
        b: s1.p,
        haMm: s0.h,
        hbMm: s1.h,
      });
    }
  }

  return { vertices, indices, gables, riseMm };
}

export function withBuildingRoof<T extends { roof?: BuildingRoof | null }>(
  building: T,
  patch: Partial<BuildingRoof>,
): T {
  const prev = building.roof ?? {};
  return {
    ...building,
    roof: {
      ...prev,
      ...patch,
    },
  };
}
