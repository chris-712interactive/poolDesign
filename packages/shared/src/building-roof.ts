/**
 * House roof: 2D peak lines → pitched 3D planes.
 *
 * Height interpolates from the eaves (0) to peak ridges (rise):
 *   h = rise · dE / (dE + dR)
 *
 * That is planar on a rectangular gable. Hip lines (a segment into a
 * footprint corner) are not treated as peaks, so roof faces don't sag.
 * Walls that a ridge meets become gables and are omitted from the eave
 * distance so the peak can sit on the gable wall.
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
const DENSIFY_MM = 1400;
const SPLIT_EDGE_MM = 1800;
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

function splitLongEdges(
  pts: PointMm[],
  indices: number[],
  maxEdgeMm: number,
): { pts: PointMm[]; indices: number[] } {
  let verts = pts.map((p) => ({ x: p.x, y: p.y }));
  let tris = indices.slice();
  const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  for (let pass = 0; pass < 8; pass++) {
    const mid = new Map<string, number>();
    const next: number[] = [];
    let split = false;
    const midpoint = (ia: number, ib: number) => {
      const k = key(ia, ib);
      const hit = mid.get(k);
      if (hit != null) return hit;
      const a = verts[ia]!;
      const b = verts[ib]!;
      const i = verts.length;
      verts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      mid.set(k, i);
      return i;
    };
    for (let t = 0; t < tris.length; t += 3) {
      const ia = tris[t]!;
      const ib = tris[t + 1]!;
      const ic = tris[t + 2]!;
      const a = verts[ia]!;
      const b = verts[ib]!;
      const c = verts[ic]!;
      const ab = Math.hypot(b.x - a.x, b.y - a.y);
      const bc = Math.hypot(c.x - b.x, c.y - b.y);
      const ca = Math.hypot(a.x - c.x, a.y - c.y);
      const longAb = ab > maxEdgeMm;
      const longBc = bc > maxEdgeMm;
      const longCa = ca > maxEdgeMm;
      const n = (longAb ? 1 : 0) + (longBc ? 1 : 0) + (longCa ? 1 : 0);
      if (n === 0) {
        next.push(ia, ib, ic);
        continue;
      }
      split = true;
      if (n === 1) {
        if (longAb) {
          const m = midpoint(ia, ib);
          next.push(ia, m, ic, m, ib, ic);
        } else if (longBc) {
          const m = midpoint(ib, ic);
          next.push(ia, ib, m, ia, m, ic);
        } else {
          const m = midpoint(ic, ia);
          next.push(ia, ib, m, m, ib, ic);
        }
      } else {
        const mab = midpoint(ia, ib);
        const mbc = midpoint(ib, ic);
        const mca = midpoint(ic, ia);
        next.push(ia, mab, mca, mab, ib, mbc, mca, mbc, ic, mab, mbc, mca);
      }
    }
    tris = next;
    if (!split) break;
  }
  return { pts: verts, indices: tris };
}

function insertSteiner(
  pts: PointMm[],
  indices: number[],
  extra: PointMm[],
): { pts: PointMm[]; indices: number[] } {
  let verts = pts.map((p) => ({ x: p.x, y: p.y }));
  let tris = indices.slice();
  const ring = pts;
  for (const p of extra) {
    if (verts.some((v) => Math.hypot(v.x - p.x, v.y - p.y) < 40)) continue;
    if (!pointInPolygon(p, ring)) continue;
    let found = -1;
    for (let t = 0; t < tris.length; t += 3) {
      const a = verts[tris[t]!]!;
      const b = verts[tris[t + 1]!]!;
      const c = verts[tris[t + 2]!]!;
      if (pointInTri(p, a, b, c)) {
        found = t;
        break;
      }
    }
    if (found < 0) continue;
    const ia = tris[found]!;
    const ib = tris[found + 1]!;
    const ic = tris[found + 2]!;
    const ip = verts.length;
    verts.push({ x: p.x, y: p.y });
    const next = tris.slice(0, found).concat(tris.slice(found + 3));
    next.push(ia, ib, ip, ib, ic, ip, ic, ia, ip);
    tris = next;
  }
  return { pts: verts, indices: tris };
}

/**
 * Triangulate the eave polygon and lift vertices from eaves up to peak ridges.
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
  const peaks = peakRidges(ridges, eave);
  const gablesSkip = gableEdgeMask(eave, peaks);
  const riseMm = estimateRoofRiseMm(eave, peaks, pitch12);

  let ring = densifyRing(eave, DENSIFY_MM);
  let indices = earClip(ring);
  if (indices.length < 3) return empty;

  const steiner: PointMm[] = [];
  for (const ridge of peaks) {
    for (let i = 0; i < ridge.points.length; i++) {
      steiner.push(ridge.points[i]!);
      if (i > 0) {
        const a = ridge.points[i - 1]!;
        const b = ridge.points[i]!;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const n = Math.max(1, Math.round(len / DENSIFY_MM));
        for (let k = 1; k < n; k++) {
          const t = k / n;
          steiner.push({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
          });
        }
      }
    }
  }
  const withRidge = insertSteiner(ring, indices, steiner);
  ring = withRidge.pts;
  indices = withRidge.indices;
  const split = splitLongEdges(ring, indices, SPLIT_EDGE_MM);
  ring = split.pts;
  indices = split.indices;

  const heightAt = (p: PointMm) =>
    roofHeightMm(p, peaks, pitch12, riseMm, eave, gablesSkip);
  const vertices: RoofVertexMm[] = ring.map((p) => ({
    x: p.x,
    y: p.y,
    hMm: heightAt(p),
  }));

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
    const n = Math.max(2, Math.ceil(len / GABLE_SAMPLE_MM));
    const samples: Array<{ p: PointMm; h: number }> = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const p = { x: a.x + (bpt.x - a.x) * t, y: a.y + (bpt.y - a.y) * t };
      samples.push({ p, h: heightAt(p) });
    }
    const maxH = samples.reduce((m, s) => Math.max(m, s.h), 0);
    if (!footSkip[i] || maxH < GABLE_MIN_MM) continue;
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
