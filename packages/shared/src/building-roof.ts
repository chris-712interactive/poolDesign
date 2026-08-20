/**
 * House roof: 2D peak lines → pitched 3D planes.
 *
 * The mesh is a constrained triangulation of the eave polygon with the
 * peak ridges as edges. Ridge vertices sit at full rise; eaves sit at 0;
 * gable rakes tent from the corners up to the ridge. Each triangle is a
 * plane, so hips, ridges, and valleys read as sharp creases — not a
 * smooth distance-field bowl.
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
const CORNER_HIT_MM = 550;
const GABLE_EDGE_HIT_MM = 900;
const DENSIFY_MM = 1100;
const RIDGE_STEP_MM = 800;
const SNAP_MM = 70;
const ON_EDGE_MM = 40;
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

function vertexTurnSign(ring: PointMm[], i: number): number {
  const n = ring.length;
  const prev = ring[(i - 1 + n) % n]!;
  const cur = ring[i]!;
  const next = ring[(i + 1) % n]!;
  return (
    (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x)
  );
}

/** Hip / eave traces land on convex corners, not gable mid-edges or L-valleys. */
function isNearConvexCorner(p: PointMm, ring: PointMm[]): boolean {
  if (ring.length < 3) return false;
  const polySign = planSignedAreaMm2(ring) >= 0 ? 1 : -1;
  let bestI = -1;
  let bestD = CORNER_HIT_MM;
  for (let i = 0; i < ring.length; i++) {
    const v = ring[i]!;
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  if (bestI < 0) return false;
  if (vertexTurnSign(ring, bestI) * polySign < -1e-4) return false;
  const n = ring.length;
  const prev = ring[(bestI - 1 + n) % n]!;
  const cur = ring[bestI]!;
  const next = ring[(bestI + 1) % n]!;
  const minLen = Math.min(
    Math.hypot(cur.x - prev.x, cur.y - prev.y),
    Math.hypot(next.x - cur.x, next.y - cur.y),
  );
  const zone = Math.min(CORNER_HIT_MM, Math.max(120, minLen * 0.22));
  return bestD < zone;
}

function distToEdgesMm(
  p: PointMm,
  ring: PointMm[],
  skip?: boolean[],
): number {
  if (ring.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    if (skip?.[i]) continue;
    const d = distPointToSegmentMm(p, ring[i], ring[(i + 1) % ring.length]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Peak ridges only. A segment that lands on a footprint *corner* is a hip
 * (or an eave the user traced) and must not sit at full rise — that is what
 * caved the roof faces in.
 */
export function peakRidges(ridges: RoofRidge[], outline: PointMm[]): RoofRidge[] {
  const ring = ringOf(outline);
  if (ring.length < 3) return ridges;
  const out: RoofRidge[] = [];
  for (const ridge of ridges) {
    const points: PointMm[] = [];
    for (const p of ridge.points) {
      if (points.length === 0) {
        points.push(p);
        continue;
      }
      const prev = points[points.length - 1]!;
      const aCorner = isNearConvexCorner(prev, ring);
      const bCorner = isNearConvexCorner(p, ring);
      if (aCorner || bCorner) continue;
      points.push(p);
    }
    if (points.length >= 2) out.push({ ...ridge, points });
  }
  return out.length ? out : ridges;
}

/** Edges a peak ridge meets — those become gable walls, not eaves. */
export function gableEdgeMask(
  ring: PointMm[],
  ridges: RoofRidge[],
): boolean[] {
  const skip = ring.map(() => false);
  if (ring.length < 2 || ridges.length === 0) return skip;
  for (const ridge of ridges) {
    for (const p of [ridge.points[0], ridge.points[ridge.points.length - 1]]) {
      if (!p) continue;
      if (isNearConvexCorner(p, ring)) continue;
      let best = -1;
      let bestD = GABLE_EDGE_HIT_MM;
      for (let i = 0; i < ring.length; i++) {
        const d = distPointToSegmentMm(
          p,
          ring[i],
          ring[(i + 1) % ring.length],
        );
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best >= 0) skip[best] = true;
    }
  }
  return skip;
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
  const peaks = peakRidges(ridges, ring);
  const gables = gableEdgeMask(ring, peaks);
  const samples: number[] = [];
  for (const ridge of peaks) {
    for (let i = 1; i < ridge.points.length; i++) {
      const a = ridge.points[i - 1]!;
      const b = ridge.points[i]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(2, Math.round(len / 600));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const dE = distToEdgesMm(p, ring, gables);
        if (Number.isFinite(dE)) samples.push(dE);
      }
    }
  }
  if (samples.length === 0) {
    const b = outlineBounds(ring.length ? ring : outline);
    const half = Math.max(b.width, b.height) * 0.5;
    return (clampRoofPitch12(pitch12) / 12) * half;
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
  eave: PointMm[] = [],
  gableEdges?: boolean[],
): number {
  const ring = eave.length >= 3 ? ringOf(eave) : [];
  const peaks = ring.length ? peakRidges(ridges, ring) : ridges;
  const skip = gableEdges ?? (ring.length ? gableEdgeMask(ring, peaks) : undefined);
  const dR = distToRidgesMm(p, peaks);
  const dE = ring.length ? distToEdgesMm(p, ring, skip) : Infinity;
  if (!Number.isFinite(dR) && !Number.isFinite(dE)) return 0;
  const denom = dE + dR;
  if (denom < 8) return dR <= dE ? riseMm : 0;
  if (!Number.isFinite(dE)) {
    const run = 12 / Math.max(2, pitch12);
    return Math.max(0, riseMm - dR / run);
  }
  return Math.max(0, riseMm * (dE / denom));
}

function eaveOutline(outline: PointMm[], overhangMm: number): PointMm[] {
  const ring = ringOf(outline);
  if (overhangMm < 8) return ring;
  const offset = offsetClosedOutline(ring, overhangMm);
  return offset.length >= 3 ? offset : ring;
}

function densifyRing(ring: PointMm[], stepMm: number): PointMm[] {
  const out: PointMm[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    out.push({ x: a.x, y: a.y });
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.floor(len / stepMm));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out.length >= 3 ? out : ring.map((p) => ({ x: p.x, y: p.y }));
}

function orientSign(ring: PointMm[]): number {
  const a = planSignedAreaMm2(ring);
  return a >= 0 ? 1 : -1;
}

function isConvexEar(
  prev: PointMm,
  cur: PointMm,
  next: PointMm,
  sign: number,
): boolean {
  const cross =
    (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
  return cross * sign >= -1e-4;
}

function pointInTri(p: PointMm, a: PointMm, b: PointMm, c: PointMm): boolean {
  const s = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
    (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = s(p.x, p.y, a.x, a.y, b.x, b.y);
  const d2 = s(p.x, p.y, b.x, b.y, c.x, c.y);
  const d3 = s(p.x, p.y, c.x, c.y, a.x, a.y);
  const hasNeg = d1 < -1e-4 || d2 < -1e-4 || d3 < -1e-4;
  const hasPos = d1 > 1e-4 || d2 > 1e-4 || d3 > 1e-4;
  return !(hasNeg && hasPos);
}

function earClip(pts: PointMm[]): number[] {
  const n0 = pts.length;
  if (n0 < 3) return [];
  const sign = orientSign(pts);
  const idx = pts.map((_, i) => i);
  const indices: number[] = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n0 * n0 + 8) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i - 1 + idx.length) % idx.length]!;
      const i1 = idx[i]!;
      const i2 = idx[(i + 1) % idx.length]!;
      const a = pts[i0]!;
      const b = pts[i1]!;
      const c = pts[i2]!;
      if (!isConvexEar(a, b, c, sign)) continue;
      let empty = true;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (pointInTri(pts[j]!, a, b, c)) {
          empty = false;
          break;
        }
      }
      if (!empty) continue;
      indices.push(i0, i1, i2);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) indices.push(idx[0]!, idx[1]!, idx[2]!);
  else if (idx.length > 3) {
    for (let i = 1; i < idx.length - 1; i++) {
      indices.push(idx[0]!, idx[i]!, idx[i + 1]!);
    }
  }
  return indices;
}

function cross2(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function densifyOpen(points: PointMm[], stepMm: number): PointMm[] {
  if (points.length < 2) return points.map((p) => ({ x: p.x, y: p.y }));
  const out: PointMm[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    out.push({ x: a.x, y: a.y });
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / stepMm));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  const last = points[points.length - 1]!;
  out.push({ x: last.x, y: last.y });
  return out;
}

function projectOnSeg(
  p: PointMm,
  a: PointMm,
  b: PointMm,
): { t: number; q: PointMm; dist: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 < 1e-6
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const q = { x: a.x + t * dx, y: a.y + t * dy };
  return { t, q, dist: Math.hypot(p.x - q.x, p.y - q.y) };
}

function closestOnRing(
  p: PointMm,
  ring: PointMm[],
): { dist: number; edge: number; t: number; q: PointMm } {
  let best = {
    dist: Infinity,
    edge: 0,
    t: 0,
    q: { x: p.x, y: p.y },
  };
  for (let i = 0; i < ring.length; i++) {
    const hit = projectOnSeg(p, ring[i]!, ring[(i + 1) % ring.length]!);
    if (hit.dist < best.dist) {
      best = { dist: hit.dist, edge: i, t: hit.t, q: hit.q };
    }
  }
  return best;
}

/**
 * Gable ridges run to the wall on plan; extend them to the eave so the
 * rake overhangs. Hip ridges (short of the walls) stay put.
 */
function extendPeaksToEaves(
  peaks: RoofRidge[],
  eave: PointMm[],
): RoofRidge[] {
  return peaks.map((ridge) => {
    if (ridge.points.length < 2) return ridge;
    const pts = ridge.points.map((p) => ({ x: p.x, y: p.y }));
    const snapEnd = (idx: number) => {
      const p = pts[idx]!;
      if (isNearConvexCorner(p, eave)) return;
      const near = closestOnRing(p, eave);
      if (near.dist < GABLE_EDGE_HIT_MM && !isNearConvexCorner(near.q, eave)) {
        pts[idx] = near.q;
      }
    };
    snapEnd(0);
    snapEnd(pts.length - 1);
    return { ...ridge, points: pts };
  });
}

function gableRakeHeightMm(
  p: PointMm,
  a: PointMm,
  b: PointMm,
  peaks: RoofRidge[],
  riseMm: number,
): number {
  const { t } = projectOnSeg(p, a, b);
  let tPeak = 0.5;
  let best = Infinity;
  for (const ridge of peaks) {
    for (const ep of [ridge.points[0], ridge.points[ridge.points.length - 1]]) {
      if (!ep) continue;
      const hit = projectOnSeg(ep, a, b);
      if (hit.dist < best) {
        best = hit.dist;
        tPeak = hit.t;
      }
    }
  }
  const span = Math.max(tPeak, 1 - tPeak, 0.08);
  return Math.max(0, riseMm * (1 - Math.abs(t - tPeak) / span));
}

function segSegHit(
  a: PointMm,
  b: PointMm,
  c: PointMm,
  d: PointMm,
): PointMm | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const det = cross2(rx, ry, sx, sy);
  if (Math.abs(det) < 1e-8) return null;
  const qx = c.x - a.x;
  const qy = c.y - a.y;
  const t = cross2(qx, qy, sx, sy) / det;
  const u = cross2(qx, qy, rx, ry) / det;
  if (t < 0.02 || t > 0.98 || u < 0.02 || u > 0.98) return null;
  return { x: a.x + t * rx, y: a.y + t * ry };
}

function pointOnSeg(p: PointMm, a: PointMm, b: PointMm, tol: number): boolean {
  return projectOnSeg(p, a, b).dist < tol;
}

type RoofMesh2 = { verts: PointMm[]; tris: number[] };

function hasEdge(tris: number[], a: number, b: number): boolean {
  for (let t = 0; t < tris.length; t += 3) {
    const i0 = tris[t]!;
    const i1 = tris[t + 1]!;
    const i2 = tris[t + 2]!;
    if (
      (i0 === a && i1 === b) ||
      (i1 === a && i2 === b) ||
      (i2 === a && i0 === b) ||
      (i0 === b && i1 === a) ||
      (i1 === b && i2 === a) ||
      (i2 === b && i0 === a)
    ) {
      return true;
    }
  }
  return false;
}

function snapVert(verts: PointMm[], p: PointMm, tol = SNAP_MM): number {
  let best = -1;
  let bestD = tol;
  for (let i = 0; i < verts.length; i++) {
    const d = Math.hypot(verts[i]!.x - p.x, verts[i]!.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function replaceTri(tris: number[], t: number, next: number[]): number[] {
  return tris.slice(0, t).concat(next, tris.slice(t + 3));
}

function splitEdge(mesh: RoofMesh2, ia: number, ib: number, p: PointMm): number {
  const existing = snapVert(mesh.verts, p, SNAP_MM * 0.5);
  const ip = existing >= 0 ? existing : mesh.verts.length;
  if (existing < 0) mesh.verts.push({ x: p.x, y: p.y });
  const next: number[] = [];
  for (let t = 0; t < mesh.tris.length; t += 3) {
    const i0 = mesh.tris[t]!;
    const i1 = mesh.tris[t + 1]!;
    const i2 = mesh.tris[t + 2]!;
    const e01 = (i0 === ia && i1 === ib) || (i0 === ib && i1 === ia);
    const e12 = (i1 === ia && i2 === ib) || (i1 === ib && i2 === ia);
    const e20 = (i2 === ia && i0 === ib) || (i2 === ib && i0 === ia);
    if (!e01 && !e12 && !e20) {
      next.push(i0, i1, i2);
      continue;
    }
    if (e01) next.push(i0, ip, i2, ip, i1, i2);
    else if (e12) next.push(i0, i1, ip, i0, ip, i2);
    else next.push(i0, i1, ip, ip, i1, i2);
  }
  mesh.tris = next;
  return ip;
}

function insertPoint(mesh: RoofMesh2, p: PointMm): number {
  const snap = snapVert(mesh.verts, p);
  if (snap >= 0) return snap;
  for (let t = 0; t < mesh.tris.length; t += 3) {
    const ia = mesh.tris[t]!;
    const ib = mesh.tris[t + 1]!;
    const ic = mesh.tris[t + 2]!;
    const a = mesh.verts[ia]!;
    const b = mesh.verts[ib]!;
    const c = mesh.verts[ic]!;
    const ab = projectOnSeg(p, a, b);
    const bc = projectOnSeg(p, b, c);
    const ca = projectOnSeg(p, c, a);
    if (ab.dist < ON_EDGE_MM && ab.t > 0.02 && ab.t < 0.98) {
      return splitEdge(mesh, ia, ib, ab.q);
    }
    if (bc.dist < ON_EDGE_MM && bc.t > 0.02 && bc.t < 0.98) {
      return splitEdge(mesh, ib, ic, bc.q);
    }
    if (ca.dist < ON_EDGE_MM && ca.t > 0.02 && ca.t < 0.98) {
      return splitEdge(mesh, ic, ia, ca.q);
    }
    if (pointInTri(p, a, b, c)) {
      const ip = mesh.verts.length;
      mesh.verts.push({ x: p.x, y: p.y });
      mesh.tris = replaceTri(mesh.tris, t, [ia, ib, ip, ib, ic, ip, ic, ia, ip]);
      return ip;
    }
  }
  return -1;
}

function trianglesCrossingSeg(
  mesh: RoofMesh2,
  ia: number,
  ib: number,
): number[] {
  const a = mesh.verts[ia]!;
  const b = mesh.verts[ib]!;
  const hit: number[] = [];
  for (let t = 0; t < mesh.tris.length; t += 3) {
    const i0 = mesh.tris[t]!;
    const i1 = mesh.tris[t + 1]!;
    const i2 = mesh.tris[t + 2]!;
    if (
      (i0 === ia || i1 === ia || i2 === ia) &&
      (i0 === ib || i1 === ib || i2 === ib)
    ) {
      continue;
    }
    const p0 = mesh.verts[i0]!;
    const p1 = mesh.verts[i1]!;
    const p2 = mesh.verts[i2]!;
    if (
      !!segSegHit(a, b, p0, p1) ||
      !!segSegHit(a, b, p1, p2) ||
      !!segSegHit(a, b, p2, p0)
    ) {
      hit.push(t);
      continue;
    }
    const interiorOnSeg = (i: number, p: PointMm) =>
      i !== ia && i !== ib && pointOnSeg(p, a, b, ON_EDGE_MM);
    if (interiorOnSeg(i0, p0) || interiorOnSeg(i1, p1) || interiorOnSeg(i2, p2)) {
      hit.push(t);
    }
  }
  return hit;
}

function earClipIndexed(ids: number[], verts: PointMm[]): number[] {
  if (ids.length < 3) return [];
  const local = ids.map((i) => verts[i]!);
  return earClip(local).map((k) => ids[k]!);
}

function fillCavity(
  mesh: RoofMesh2,
  crossed: number[],
  ia: number,
  ib: number,
): boolean {
  const drop = new Set(crossed);
  const edgeKey = (u: number, v: number) => (u < v ? `${u}:${v}` : `${v}:${u}`);
  const counts = new Map<string, number>();
  const directed: Array<[number, number]> = [];
  const bump = (u: number, v: number) => {
    const k = edgeKey(u, v);
    counts.set(k, (counts.get(k) ?? 0) + 1);
    directed.push([u, v]);
  };
  for (const t of crossed) {
    bump(mesh.tris[t]!, mesh.tris[t + 1]!);
    bump(mesh.tris[t + 1]!, mesh.tris[t + 2]!);
    bump(mesh.tris[t + 2]!, mesh.tris[t]!);
  }
  const nbrs = new Map<number, number[]>();
  const addNbr = (u: number, v: number) => {
    const list = nbrs.get(u) ?? [];
    if (!list.includes(v)) list.push(v);
    nbrs.set(u, list);
  };
  for (const [u, v] of directed) {
    if ((counts.get(edgeKey(u, v)) ?? 0) !== 1) continue;
    addNbr(u, v);
    addNbr(v, u);
  }
  const walk = (from: number, to: number, first: number): number[] => {
    const chain = [from, first];
    let prev = from;
    let cur = first;
    let guard = 0;
    while (cur !== to && guard++ < mesh.verts.length + 4) {
      const next = (nbrs.get(cur) ?? []).find((n) => n !== prev);
      if (next == null) break;
      chain.push(next);
      prev = cur;
      cur = next;
    }
    return chain;
  };
  const startNbrs = nbrs.get(ia) ?? [];
  const added: number[] = [];
  if (startNbrs.length >= 1) {
    const left = walk(ia, ib, startNbrs[0]!);
    if (left[left.length - 1] === ib && left.length >= 3) {
      added.push(...earClipIndexed(left, mesh.verts));
    }
  }
  if (startNbrs.length >= 2) {
    const right = walk(ia, ib, startNbrs[1]!);
    if (right[right.length - 1] === ib && right.length >= 3) {
      added.push(...earClipIndexed(right, mesh.verts));
    }
  }
  if (added.length < 3) return false;
  const keep: number[] = [];
  for (let t = 0; t < mesh.tris.length; t += 3) {
    if (drop.has(t)) continue;
    keep.push(mesh.tris[t]!, mesh.tris[t + 1]!, mesh.tris[t + 2]!);
  }
  mesh.tris = keep.concat(added);
  return true;
}

function constrainEdge(mesh: RoofMesh2, ia: number, ib: number, depth = 0) {
  if (ia === ib || depth > 14) return;
  if (hasEdge(mesh.tris, ia, ib)) return;
  const a = mesh.verts[ia]!;
  const b = mesh.verts[ib]!;
  for (let t = 0; t < mesh.tris.length; t += 3) {
    const ids = [mesh.tris[t]!, mesh.tris[t + 1]!, mesh.tris[t + 2]!];
    for (let e = 0; e < 3; e++) {
      const u = ids[e]!;
      const v = ids[(e + 1) % 3]!;
      if (u === ia || u === ib || v === ia || v === ib) continue;
      const hit = segSegHit(a, b, mesh.verts[u]!, mesh.verts[v]!);
      if (!hit) continue;
      const ip = splitEdge(mesh, u, v, hit);
      constrainEdge(mesh, ia, ip, depth + 1);
      constrainEdge(mesh, ip, ib, depth + 1);
      return;
    }
  }
  for (let k = 0; k < mesh.verts.length; k++) {
    if (k === ia || k === ib) continue;
    const hit = projectOnSeg(mesh.verts[k]!, a, b);
    if (hit.dist < ON_EDGE_MM && hit.t > 0.02 && hit.t < 0.98) {
      constrainEdge(mesh, ia, k, depth + 1);
      constrainEdge(mesh, k, ib, depth + 1);
      return;
    }
  }
  const crossed = trianglesCrossingSeg(mesh, ia, ib);
  if (crossed.length > 0 && fillCavity(mesh, crossed, ia, ib)) {
    if (hasEdge(mesh.tris, ia, ib)) return;
  }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const im = insertPoint(mesh, mid);
  if (im >= 0 && im !== ia && im !== ib) {
    constrainEdge(mesh, ia, im, depth + 1);
    constrainEdge(mesh, im, ib, depth + 1);
  }
}

function dropTinyTris(mesh: RoofMesh2) {
  const next: number[] = [];
  for (let t = 0; t < mesh.tris.length; t += 3) {
    const a = mesh.verts[mesh.tris[t]!]!;
    const b = mesh.verts[mesh.tris[t + 1]!]!;
    const c = mesh.verts[mesh.tris[t + 2]!]!;
    const area = Math.abs(cross2(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y));
    if (area < 20) continue;
    next.push(mesh.tris[t]!, mesh.tris[t + 1]!, mesh.tris[t + 2]!);
  }
  mesh.tris = next;
}

/**
 * Triangulate the eave polygon with peak ridges as constrained edges,
 * then lift: ridges at full rise, eaves at 0, gable rakes in between.
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
  const peaks0 = peakRidges(ridges, eave);
  const peaks = extendPeaksToEaves(peaks0, eave);
  const gablesSkip = gableEdgeMask(eave, peaks);
  const riseMm = estimateRoofRiseMm(eave, peaks, pitch12);

  const ring = densifyRing(eave, DENSIFY_MM);
  const clipped = earClip(ring);
  if (clipped.length < 3) return empty;
  const mesh: RoofMesh2 = {
    verts: ring.map((p) => ({ x: p.x, y: p.y })),
    tris: clipped.slice(),
  };
  const ridgeIds = new Set<number>();
  for (const ridge of peaks) {
    const chain: number[] = [];
    for (const p of densifyOpen(ridge.points, RIDGE_STEP_MM)) {
      const id = insertPoint(mesh, p);
      if (id >= 0) {
        chain.push(id);
        ridgeIds.add(id);
      }
    }
    for (let i = 1; i < chain.length; i++) {
      constrainEdge(mesh, chain[i - 1]!, chain[i]!);
      ridgeIds.add(chain[i - 1]!);
      ridgeIds.add(chain[i]!);
    }
  }
  dropTinyTris(mesh);

  const nearRidge = (p: PointMm) => distToRidgesMm(p, peaks) < 80;
  const eaveHeight = (p: PointMm) => {
    let bestI = -1;
    let bestD = 120;
    for (let i = 0; i < eave.length; i++) {
      const d = distPointToSegmentMm(p, eave[i]!, eave[(i + 1) % eave.length]!);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    if (bestI < 0) return 0;
    if (!gablesSkip[bestI]) return 0;
    return gableRakeHeightMm(
      p,
      eave[bestI]!,
      eave[(bestI + 1) % eave.length]!,
      peaks,
      riseMm,
    );
  };
  const vertices: RoofVertexMm[] = mesh.verts.map((p, i) => ({
    x: p.x,
    y: p.y,
    hMm: ridgeIds.has(i) || nearRidge(p) ? riseMm : eaveHeight(p),
  }));
  const indices = mesh.tris.slice();
  const area = planSignedAreaMm2(eave);
  if (area >= 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const t = indices[i + 1]!;
      indices[i + 1] = indices[i + 2]!;
      indices[i + 2] = t;
    }
  }

  const footprint = ringOf(outline);
  const footSkip = gableEdgeMask(footprint, peaks);
  const gableStrips: RoofTessellation["gables"] = [];
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i]!;
    const bpt = footprint[(i + 1) % footprint.length]!;
    const len = Math.hypot(bpt.x - a.x, bpt.y - a.y);
    if (len < 80) continue;
    if (!footSkip[i]) continue;
    const n = Math.max(2, Math.ceil(len / GABLE_SAMPLE_MM));
    const samples: Array<{ p: PointMm; h: number }> = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const p = { x: a.x + (bpt.x - a.x) * t, y: a.y + (bpt.y - a.y) * t };
      const h = nearRidge(p)
        ? riseMm
        : gableRakeHeightMm(p, a, bpt, peaks, riseMm);
      samples.push({ p, h });
    }
    const maxH = samples.reduce((m, s) => Math.max(m, s.h), 0);
    if (maxH < GABLE_MIN_MM) continue;
    for (let k = 0; k < samples.length - 1; k++) {
      const s0 = samples[k]!;
      const s1 = samples[k + 1]!;
      if (s0.h < 12 && s1.h < 12) continue;
      gableStrips.push({
        a: s0.p,
        b: s1.p,
        haMm: s0.h,
        hbMm: s1.h,
      });
    }
  }

  return { vertices, indices, gables: gableStrips, riseMm };
}

/** Barycentric height on the tessellated roof, or null if `p` is outside. */
export function sampleRoofMeshHeightMm(
  mesh: RoofTessellation,
  p: PointMm,
): number | null {
  const v = mesh.vertices;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = v[mesh.indices[t]!]!;
    const b = v[mesh.indices[t + 1]!]!;
    const c = v[mesh.indices[t + 2]!]!;
    if (!pointInTri(p, a, b, c)) continue;
    const area = cross2(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y);
    if (Math.abs(area) < 1e-4) continue;
    const w0 = cross2(b.x - p.x, b.y - p.y, c.x - p.x, c.y - p.y) / area;
    const w1 = cross2(c.x - p.x, c.y - p.y, a.x - p.x, a.y - p.y) / area;
    const w2 = 1 - w0 - w1;
    return w0 * a.hMm + w1 * b.hMm + w2 * c.hMm;
  }
  return null;
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
