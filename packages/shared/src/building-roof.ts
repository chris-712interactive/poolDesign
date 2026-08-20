/**
 * House roof: 2D roof lines → pitched 3D planes.
 *
 * Each eave edge defines a supporting plane at the given pitch. Height is
 * the lower envelope of those planes (the straight-skeleton roof), so
 * faces stay planar. User peak ridges and hip/valley lines split the
 * eave into those faces; gable walls (a peak that meets a wall mid-span)
 * are omitted from the envelope so the ridge can run to the rake.
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
const GABLE_EDGE_HIT_MM = 500;
const DENSIFY_MM = 2200;
const RIDGE_STEP_MM = 1800;
const SNAP_MM = 90;
const ON_EDGE_MM = 40;
const GABLE_SAMPLE_MM = 380;
const GABLE_MIN_MM = 80;
const MIN_TRI_AREA2_MM = 400;

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
        const h = heightFromEavePlanes(p, ring, gables, pitch12);
        if (h > 1) samples.push(h);
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
  return Math.max(400, mid);
}

function signedInwardDistToLine(
  p: PointMm,
  a: PointMm,
  b: PointMm,
  sign: number,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return Infinity;
  const left = (dx * (p.y - a.y) - dy * (p.x - a.x)) / len;
  return sign >= 0 ? left : -left;
}

function heightFromEavePlanes(
  p: PointMm,
  ring: PointMm[],
  skip: boolean[] | undefined,
  pitch12: number,
): number {
  if (ring.length < 2) return 0;
  const sign = planSignedAreaMm2(ring) >= 0 ? 1 : -1;
  const slope = clampRoofPitch12(pitch12) / 12;
  let h = Infinity;
  for (let i = 0; i < ring.length; i++) {
    if (skip?.[i]) continue;
    const d = signedInwardDistToLine(
      p,
      ring[i]!,
      ring[(i + 1) % ring.length]!,
      sign,
    );
    if (!Number.isFinite(d) || d < -2) continue;
    h = Math.min(h, slope * Math.max(0, d));
  }
  return Number.isFinite(h) ? Math.max(0, h) : 0;
}

function heightFromSupport(
  p: PointMm,
  a: PointMm,
  b: PointMm,
  sign: number,
  pitch12: number,
): number {
  const d = signedInwardDistToLine(p, a, b, sign);
  if (!Number.isFinite(d)) return 0;
  return Math.max(0, (clampRoofPitch12(pitch12) / 12) * d);
}

function faceCentroid(pts: PointMm[]): PointMm {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(1, pts.length);
  return { x: x / n, y: y / n };
}

function eaveEdgeIndexFor(
  p: PointMm,
  q: PointMm,
  eave: PointMm[],
): number {
  for (let e = 0; e < eave.length; e++) {
    const a = eave[e]!;
    const b = eave[(e + 1) % eave.length]!;
    const hp = projectOnSeg(p, a, b);
    const hq = projectOnSeg(q, a, b);
    if (hp.dist < SNAP_MM && hq.dist < SNAP_MM) return e;
  }
  return -1;
}

function angNormPi(rad: number): number {
  let a = rad % Math.PI;
  if (a < 0) a += Math.PI;
  return a;
}

function distinctNonGableEaveRuns(
  facePts: PointMm[],
  eave: PointMm[],
  gableSkip?: boolean[],
): number {
  const angs: number[] = [];
  for (let i = 0; i < facePts.length; i++) {
    const p = facePts[i]!;
    const q = facePts[(i + 1) % facePts.length]!;
    const e = eaveEdgeIndexFor(p, q, eave);
    if (e < 0 || gableSkip?.[e]) continue;
    const a = eave[e]!;
    const b = eave[(e + 1) % eave.length]!;
    const ang = angNormPi(Math.atan2(b.y - a.y, b.x - a.x));
    if (
      angs.some(
        (x) => Math.abs(x - ang) < 0.22 || Math.abs(x - ang) > Math.PI - 0.22,
      )
    ) {
      continue;
    }
    angs.push(ang);
  }
  return angs.length;
}

/** Supporting eave of a roof face: the plane that is lowest at the face center. */
function faceSupportingEave(
  facePts: PointMm[],
  eave: PointMm[],
  sign: number,
  pitch12: number,
  gableSkip?: boolean[],
): { a: PointMm; b: PointMm } | null {
  if (facePts.length < 2 || eave.length < 2) return null;
  const c = faceCentroid(facePts);
  let bestH = Infinity;
  let best: { a: PointMm; b: PointMm } | null = null;
  for (let i = 0; i < facePts.length; i++) {
    const p = facePts[i]!;
    const q = facePts[(i + 1) % facePts.length]!;
    const e = eaveEdgeIndexFor(p, q, eave);
    if (e < 0 || gableSkip?.[e]) continue;
    const a = eave[e]!;
    const b = eave[(e + 1) % eave.length]!;
    const h = heightFromSupport(c, a, b, sign, pitch12);
    if (h < bestH) {
      bestH = h;
      best = { a, b };
    }
  }
  return best;
}

function dirsParallel(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (la < 1e-6 || lb < 1e-6) return false;
  return Math.abs(ax * bx + ay * by) / (la * lb) > 0.86;
}

function peakSegmentAt(
  p: PointMm,
  peaks: RoofRidge[],
): { a: PointMm; b: PointMm } | null {
  let best: { a: PointMm; b: PointMm } | null = null;
  let bestD = 220;
  for (const ridge of peaks) {
    for (let i = 1; i < ridge.points.length; i++) {
      const a = ridge.points[i - 1]!;
      const b = ridge.points[i]!;
      const d = distPointToSegmentMm(p, a, b);
      if (d < bestD) {
        bestD = d;
        best = { a, b };
      }
    }
  }
  return best;
}

function nearestPeakEnd(p: PointMm, peaks: RoofRidge[]): PointMm | null {
  let best: PointMm | null = null;
  let bestD = Infinity;
  for (const ridge of peaks) {
    if (ridge.points.length < 2) continue;
    for (const q of [ridge.points[0]!, ridge.points[ridge.points.length - 1]!]) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
  }
  if (!best || bestD < 400 || bestD > 25000) return null;
  return best;
}

function parallelEaveHeightsAt(
  p: PointMm,
  dirx: number,
  diry: number,
  eave: PointMm[],
  sign: number,
  pitch12: number,
  gableSkip?: boolean[],
): number[] {
  const ranked: Array<{ h: number; len: number }> = [];
  for (let i = 0; i < eave.length; i++) {
    if (gableSkip?.[i]) continue;
    const a = eave[i]!;
    const b = eave[(i + 1) % eave.length]!;
    if (!dirsParallel(b.x - a.x, b.y - a.y, dirx, diry)) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 800) continue;
    ranked.push({
      h: heightFromSupport(p, a, b, sign, pitch12),
      len,
    });
  }
  ranked.sort((x, y) => y.len - x.len);
  return ranked.slice(0, 2).map((r) => r.h);
}

function envelopeAtParallelEaves(
  p: PointMm,
  dirx: number,
  diry: number,
  eave: PointMm[],
  sign: number,
  pitch12: number,
  gableSkip?: boolean[],
): number {
  const hs = parallelEaveHeightsAt(
    p,
    dirx,
    diry,
    eave,
    sign,
    pitch12,
    gableSkip,
  );
  if (hs.length >= 2) return Math.max(hs[0]!, hs[1]!);
  return hs[0] ?? 0;
}

/** One height for the whole peak run so the ridge cannot sag or slope. */
function levelHeightForPeak(
  ridge: RoofRidge,
  eave: PointMm[],
  sign: number,
  pitch12: number,
  gableSkip?: boolean[],
): number {
  const a = ridge.points[0]!;
  const b = ridge.points[ridge.points.length - 1]!;
  const dirx = b.x - a.x;
  const diry = b.y - a.y;
  const samples = [
    a,
    { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    b,
  ];
  let h = 0;
  for (const p of samples) {
    h = Math.max(
      h,
      envelopeAtParallelEaves(p, dirx, diry, eave, sign, pitch12, gableSkip),
    );
  }
  return h;
}

function applyLevelPeakHeights(
  vertices: RoofVertexMm[],
  peaks: RoofRidge[],
  eave: PointMm[],
  sign: number,
  pitch12: number,
  gableSkip?: boolean[],
) {
  if (peaks.length === 0) return;
  const levels = peaks.map((ridge) => ({
    ridge,
    h: levelHeightForPeak(ridge, eave, sign, pitch12, gableSkip),
  }));
  for (const v of vertices) {
    let h: number | null = null;
    for (const { ridge, h: peakH } of levels) {
      if (peakH < 80) continue;
      if (distToRidgesMm(v, [ridge]) > 220) continue;
      h = h == null ? peakH : Math.max(h, peakH);
    }
    if (h != null) v.hMm = h;
  }
}

function heightFromIncidentPlanes(
  p: PointMm,
  planes: Array<{ a: PointMm; b: PointMm }>,
  sign: number,
  pitch12: number,
  peaks: RoofRidge[],
  eave: PointMm[],
  gableSkip?: boolean[],
): number {
  const onPeak = peakSegmentAt(p, peaks);
  const scored = planes.map((sup) => ({
    h: heightFromSupport(p, sup.a, sup.b, sign, pitch12),
    aligned: onPeak
      ? dirsParallel(
          sup.b.x - sup.a.x,
          sup.b.y - sup.a.y,
          onPeak.b.x - onPeak.a.x,
          onPeak.b.y - onPeak.a.y,
        )
      : false,
  }));
  let h: number;
  if (onPeak) {
    const aligned = scored.filter((s) => s.aligned);
    const pick = aligned.length > 0 ? aligned : scored;
    h = pick.reduce((m, s) => Math.max(m, s.h), 0);
  } else {
    h = scored.reduce((m, s) => Math.min(m, s.h), Infinity);
  }
  if (!Number.isFinite(h)) {
    h = heightFromEavePlanes(p, eave, gableSkip, pitch12);
  }
  if (!onPeak && onNonGableEave(p, eave, gableSkip)) h = 0;
  return Math.max(0, h);
}

function onNonGableEave(
  p: PointMm,
  eave: PointMm[],
  gableSkip?: boolean[],
): boolean {
  for (let i = 0; i < eave.length; i++) {
    if (gableSkip?.[i]) continue;
    if (
      distPointToSegmentMm(p, eave[i]!, eave[(i + 1) % eave.length]!) < SNAP_MM
    ) {
      return true;
    }
  }
  return false;
}

function pointInOrOnPolygon(p: PointMm, ring: PointMm[]): boolean {
  if (pointInPolygon(p, ring)) return true;
  for (let i = 0; i < ring.length; i++) {
    if (distPointToSegmentMm(p, ring[i]!, ring[(i + 1) % ring.length]!) < 50) {
      return true;
    }
  }
  return false;
}

export function roofHeightMm(
  p: PointMm,
  ridges: RoofRidge[],
  pitch12: number,
  _riseMm: number,
  eave: PointMm[] = [],
  gableEdges?: boolean[],
): number {
  const ring = eave.length >= 3 ? ringOf(eave) : [];
  if (ring.length < 2) return 0;
  const peaks = peakRidges(ridges, ring);
  const skip = gableEdges ?? gableEdgeMask(ring, peaks);
  const lines = snapRidgesToEave(
    [...ridges, ...completeRoofLines(ring, ridges, peaks)],
    ring,
    0,
  );
  const meshPeaks = peakRidges(lines, ring);
  const sign = planSignedAreaMm2(ring) >= 0 ? 1 : -1;
  for (const ridge of meshPeaks) {
    if (distToRidgesMm(p, [ridge]) > 220) continue;
    const h = levelHeightForPeak(ridge, ring, sign, pitch12, skip);
    if (h > 80) return h;
  }
  const graph = buildRoofGraph(ring, lines);
  if (graph) {
    const sign = planSignedAreaMm2(ring) >= 0 ? 1 : -1;
    const planes: Array<{ a: PointMm; b: PointMm }> = [];
    for (const face of graph.faces) {
      const pts = face.map((i) => graph.verts[i]!);
      if (!pointInOrOnPolygon(p, pts)) continue;
      if (distinctNonGableEaveRuns(pts, ring, skip) >= 2) continue;
      const sup = faceSupportingEave(pts, ring, sign, pitch12, skip);
      if (sup) planes.push(sup);
    }
    if (planes.length > 0) {
      return heightFromIncidentPlanes(p, planes, sign, pitch12, peaks, ring, skip);
    }
  }
  return heightFromEavePlanes(p, ring, skip, pitch12);
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
    const area2 = Math.abs(cross2(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y));
    if (area2 < MIN_TRI_AREA2_MM) continue;
    next.push(mesh.tris[t]!, mesh.tris[t + 1]!, mesh.tris[t + 2]!);
  }
  mesh.tris = next;
}

function inCircumcircle(
  p: PointMm,
  a: PointMm,
  b: PointMm,
  c: PointMm,
): boolean {
  const adx = a.x - p.x;
  const ady = a.y - p.y;
  const bdx = b.x - p.x;
  const bdy = b.y - p.y;
  const cdx = c.x - p.x;
  const cdy = c.y - p.y;
  const det =
    (adx * adx + ady * ady) * (bdx * cdy - cdx * bdy) +
    (bdx * bdx + bdy * bdy) * (cdx * ady - adx * cdy) +
    (cdx * cdx + cdy * cdy) * (adx * bdy - bdx * ady);
  return det * Math.sign(cross2(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y)) > 0;
}

function delaunayIndices(pts: PointMm[]): number[] {
  const n = pts.length;
  if (n < 3) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const span = Math.max(maxX - minX, maxY - minY, 1) * 10;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const all: PointMm[] = [
    ...pts,
    { x: cx, y: cy - 2 * span },
    { x: cx - 2 * span, y: cy + span },
    { x: cx + 2 * span, y: cy + span },
  ];
  type Tri = { a: number; b: number; c: number };
  let tris: Tri[] = [{ a: n, b: n + 1, c: n + 2 }];
  for (let i = 0; i < n; i++) {
    const p = all[i]!;
    const bad: Tri[] = [];
    const keep: Tri[] = [];
    for (const t of tris) {
      if (inCircumcircle(p, all[t.a]!, all[t.b]!, all[t.c]!)) bad.push(t);
      else keep.push(t);
    }
    const edges: Array<[number, number]> = [];
    const pushEdge = (u: number, v: number) => {
      const ix = edges.findIndex((e) => e[0] === v && e[1] === u);
      if (ix >= 0) edges.splice(ix, 1);
      else edges.push([u, v]);
    };
    for (const t of bad) {
      pushEdge(t.a, t.b);
      pushEdge(t.b, t.c);
      pushEdge(t.c, t.a);
    }
    tris = keep;
    for (const [u, v] of edges) {
      if (Math.abs(cross2(all[v]!.x - all[u]!.x, all[v]!.y - all[u]!.y, p.x - all[u]!.x, p.y - all[u]!.y)) < 1e-4) {
        continue;
      }
      tris.push({ a: u, b: v, c: i });
    }
  }
  const out: number[] = [];
  for (const t of tris) {
    if (t.a >= n || t.b >= n || t.c >= n) continue;
    out.push(t.a, t.b, t.c);
  }
  return out;
}

function keepInsidePolygon(mesh: RoofMesh2, ring: PointMm[]) {
  const next: number[] = [];
  for (let t = 0; t < mesh.tris.length; t += 3) {
    const ia = mesh.tris[t]!;
    const ib = mesh.tris[t + 1]!;
    const ic = mesh.tris[t + 2]!;
    const a = mesh.verts[ia]!;
    const b = mesh.verts[ib]!;
    const c = mesh.verts[ic]!;
    const area2 = Math.abs(cross2(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y));
    if (area2 < MIN_TRI_AREA2_MM) continue;
    const mid = {
      x: (a.x + b.x + c.x) / 3,
      y: (a.y + b.y + c.y) / 3,
    };
    if (!pointInPolygon(mid, ring)) continue;
    next.push(ia, ib, ic);
  }
  mesh.tris = next;
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

function eaveWithRoofHits(eave: PointMm[], ridges: RoofRidge[]): PointMm[] {
  const hits: PointMm[][] = eave.map(() => []);
  for (const ridge of ridges) {
    for (const p of ridge.points) {
      const near = closestOnRing(p, eave);
      if (near.dist < GABLE_EDGE_HIT_MM && near.t > 0.04 && near.t < 0.96) {
        hits[near.edge]!.push(near.q);
      }
    }
  }
  const out: PointMm[] = [];
  for (let i = 0; i < eave.length; i++) {
    out.push({ x: eave[i]!.x, y: eave[i]!.y });
    const a = eave[i]!;
    const b = eave[(i + 1) % eave.length]!;
    const extra = hits[i]!.slice().sort((p, q) => {
      const tp = projectOnSeg(p, a, b).t;
      const tq = projectOnSeg(q, a, b).t;
      return tp - tq;
    });
    let last = a;
    for (const q of extra) {
      if (Math.hypot(q.x - last.x, q.y - last.y) < SNAP_MM) continue;
      if (Math.hypot(q.x - b.x, q.y - b.y) < SNAP_MM) continue;
      out.push({ x: q.x, y: q.y });
      last = q;
    }
  }
  return out.length >= 3 ? out : eave;
}

function userCornerHasTrace(c: PointMm, ridges: RoofRidge[]): boolean {
  for (const ridge of ridges) {
    for (const p of ridge.points) {
      if (Math.hypot(p.x - c.x, p.y - c.y) < CORNER_HIT_MM) return true;
    }
  }
  return false;
}

function segmentOnEave(a: PointMm, b: PointMm, eave: PointMm[]): boolean {
  const ha = closestOnRing(a, eave);
  const hb = closestOnRing(b, eave);
  if (ha.dist > 90 || hb.dist > 90) return false;
  return ha.edge === hb.edge;
}

function segmentCoveredByRidges(
  a: PointMm,
  b: PointMm,
  ridges: RoofRidge[],
): boolean {
  for (const ridge of ridges) {
    for (let i = 1; i < ridge.points.length; i++) {
      const p = ridge.points[i - 1]!;
      const q = ridge.points[i]!;
      if (
        distPointToSegmentMm(a, p, q) < 140 &&
        distPointToSegmentMm(b, p, q) < 140
      ) {
        return true;
      }
    }
  }
  return false;
}

function snapRidgesToEave(
  ridges: RoofRidge[],
  eave: PointMm[],
  overhangMm: number,
): RoofRidge[] {
  const tol = Math.max(640, overhangMm + 360);
  return ridges.map((ridge) => ({
    ...ridge,
    points: ridge.points.map((p) => {
      let bestV: PointMm | null = null;
      let bestD = tol;
      for (const v of eave) {
        const d = Math.hypot(p.x - v.x, p.y - v.y);
        if (d < bestD) {
          bestD = d;
          bestV = v;
        }
      }
      if (bestV && bestD < tol) return { x: bestV.x, y: bestV.y };
      const on = closestOnRing(p, eave);
      if (on.dist < tol) return { x: on.q.x, y: on.q.y };
      return { x: p.x, y: p.y };
    }),
  }));
}

function autoHipRidges(
  eave: PointMm[],
  peaks: RoofRidge[],
  existing: RoofRidge[],
): RoofRidge[] {
  if (peaks.length === 0 || eave.length < 3) return [];
  const sign = planSignedAreaMm2(eave) >= 0 ? 1 : -1;
  const ends: PointMm[] = [];
  for (const ridge of peaks) {
    if (ridge.points.length < 2) continue;
    ends.push(ridge.points[0]!, ridge.points[ridge.points.length - 1]!);
  }
  const hips: RoofRidge[] = [];
  for (let i = 0; i < eave.length; i++) {
    if (vertexTurnSign(eave, i) * sign < -1e-4) continue;
    const c = eave[i]!;
    if (userCornerHasTrace(c, existing)) continue;
    let best: PointMm | null = null;
    let bestD = Infinity;
    for (const p of ends) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best || bestD < 400 || bestD > 25000) continue;
    const mid = { x: (c.x + best.x) / 2, y: (c.y + best.y) / 2 };
    if (!pointInPolygon(mid, eave)) continue;
    const onEave = closestOnRing(best, eave);
    if (onEave.dist < 80 && onEave.edge === i) continue;
    if (onEave.dist < 80 && onEave.edge === (i - 1 + eave.length) % eave.length) {
      continue;
    }
    if (segmentOnEave(c, best, eave)) continue;
    if (segmentCoveredByRidges(c, best, [...existing, ...hips])) continue;
    hips.push({
      id: `auto_hip_${i}`,
      points: [
        { x: c.x, y: c.y },
        { x: best.x, y: best.y },
      ],
    });
  }
  return hips;
}

function peakJunctionPoints(peaks: RoofRidge[]): PointMm[] {
  const segs: Array<{ a: PointMm; b: PointMm }> = [];
  for (const ridge of peaks) {
    for (let i = 1; i < ridge.points.length; i++) {
      segs.push({ a: ridge.points[i - 1]!, b: ridge.points[i]! });
    }
  }
  const out: PointMm[] = [];
  const push = (p: PointMm) => {
    if (out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < SNAP_MM)) return;
    out.push({ x: p.x, y: p.y });
  };
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i]!;
      const o = segs[j]!;
      const cross = segSegHit(s.a, s.b, o.a, o.b);
      if (cross) push(cross);
      for (const p of [o.a, o.b]) {
        const hit = projectOnSeg(p, s.a, s.b);
        if (hit.dist < ON_EDGE_MM && hit.t > 0.02 && hit.t < 0.98) push(hit.q);
      }
      for (const p of [s.a, s.b]) {
        const hit = projectOnSeg(p, o.a, o.b);
        if (hit.dist < ON_EDGE_MM && hit.t > 0.02 && hit.t < 0.98) push(hit.q);
      }
    }
  }
  return out;
}

function autoValleyRidges(
  eave: PointMm[],
  peaks: RoofRidge[],
  existing: RoofRidge[],
): RoofRidge[] {
  if (peaks.length === 0 || eave.length < 3) return [];
  const sign = planSignedAreaMm2(eave) >= 0 ? 1 : -1;
  const junctions = peakJunctionPoints(peaks);
  const valleys: RoofRidge[] = [];
  for (let i = 0; i < eave.length; i++) {
    if (vertexTurnSign(eave, i) * sign >= -1e-4) continue;
    const c = eave[i]!;
    if (userCornerHasTrace(c, existing)) continue;
    let target: PointMm | null = null;
    let bestD = Infinity;
    for (const j of junctions) {
      const d = Math.hypot(j.x - c.x, j.y - c.y);
      const mid = { x: (c.x + j.x) / 2, y: (c.y + j.y) / 2 };
      if (d < 400 || d > 25000 || !pointInPolygon(mid, eave)) continue;
      if (d < bestD) {
        bestD = d;
        target = j;
      }
    }
    if (!target) {
      const end = nearestPeakEnd(c, peaks);
      if (end) target = end;
    }
    if (!target) continue;
    const mid = { x: (c.x + target.x) / 2, y: (c.y + target.y) / 2 };
    if (!pointInPolygon(mid, eave)) continue;
    if (segmentOnEave(c, target, eave)) continue;
    if (segmentCoveredByRidges(c, target, [...existing, ...valleys])) continue;
    valleys.push({
      id: `auto_valley_${i}`,
      points: [
        { x: c.x, y: c.y },
        { x: target.x, y: target.y },
      ],
    });
  }
  return valleys;
}

function completeRoofLines(
  eave: PointMm[],
  ridges: RoofRidge[],
  peaks: RoofRidge[],
): RoofRidge[] {
  const hips = autoHipRidges(eave, peaks, ridges);
  const valleys = autoValleyRidges(eave, peaks, [...ridges, ...hips]);
  return [...hips, ...valleys];
}

type RoofSeg = { a: PointMm; b: PointMm };

function uniqueAlongSeg(a: PointMm, b: PointMm, pts: PointMm[]): PointMm[] {
  const ranked = pts
    .map((p) => ({ p, t: projectOnSeg(p, a, b).t }))
    .sort((x, y) => x.t - y.t);
  const out: PointMm[] = [];
  for (const { p } of ranked) {
    const last = out[out.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < SNAP_MM) continue;
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

function planarizeSegments(segs: RoofSeg[]): RoofSeg[] {
  const pointsOn = segs.map((s) => [s.a, s.b]);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    for (let j = 0; j < segs.length; j++) {
      if (i === j) continue;
      const o = segs[j]!;
      for (const p of [o.a, o.b]) {
        const hit = projectOnSeg(p, s.a, s.b);
        if (hit.dist < ON_EDGE_MM && hit.t > 0.02 && hit.t < 0.98) {
          pointsOn[i]!.push(hit.q);
        }
      }
      if (j <= i) continue;
      const cross = segSegHit(s.a, s.b, o.a, o.b);
      if (cross) {
        pointsOn[i]!.push(cross);
        pointsOn[j]!.push(cross);
      }
    }
  }
  const out: RoofSeg[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    const pts = uniqueAlongSeg(s.a, s.b, pointsOn[i]!);
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1]!;
      const b = pts[k]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) < SNAP_MM) continue;
      out.push({ a, b });
    }
  }
  return out;
}

function addGraphVert(verts: PointMm[], p: PointMm): number {
  const hit = snapVert(verts, p);
  if (hit >= 0) return hit;
  verts.push({ x: p.x, y: p.y });
  return verts.length - 1;
}

function addGraphEdge(
  adj: Map<number, number[]>,
  a: number,
  b: number,
) {
  if (a === b) return;
  const add = (u: number, v: number) => {
    const list = adj.get(u) ?? [];
    if (!list.includes(v)) list.push(v);
    adj.set(u, list);
  };
  add(a, b);
  add(b, a);
}

function nextFaceNeighbor(
  verts: PointMm[],
  adj: Map<number, number[]>,
  prev: number,
  cur: number,
): number {
  const nbrs = adj.get(cur) ?? [];
  if (nbrs.length === 0) return prev;
  const incoming = Math.atan2(
    verts[prev]!.y - verts[cur]!.y,
    verts[prev]!.x - verts[cur]!.x,
  );
  let best = nbrs[0]!;
  let bestAng = Infinity;
  for (const n of nbrs) {
    if (n === prev && nbrs.length > 1) continue;
    const outgoing = Math.atan2(
      verts[n]!.y - verts[cur]!.y,
      verts[n]!.x - verts[cur]!.x,
    );
    let ang = outgoing - incoming;
    while (ang <= 1e-8) ang += Math.PI * 2;
    while (ang > Math.PI * 2) ang -= Math.PI * 2;
    if (ang < bestAng) {
      bestAng = ang;
      best = n;
    }
  }
  return best;
}

function extractRoofFaces(
  verts: PointMm[],
  adj: Map<number, number[]>,
): number[][] {
  const used = new Set<string>();
  const dirKey = (a: number, b: number) => `${a}>${b}`;
  const faces: number[][] = [];
  for (const [start, nbrs] of adj) {
    for (const first of nbrs) {
      if (used.has(dirKey(start, first))) continue;
      const face: number[] = [start];
      let prev = start;
      let cur = first;
      used.add(dirKey(prev, cur));
      let guard = 0;
      while (cur !== start && guard++ < verts.length + 4) {
        face.push(cur);
        const nxt = nextFaceNeighbor(verts, adj, prev, cur);
        if (nxt == null || nxt === cur) break;
        if (used.has(dirKey(cur, nxt))) break;
        used.add(dirKey(cur, nxt));
        prev = cur;
        cur = nxt;
      }
      if (cur === start && face.length >= 3) faces.push(face);
    }
  }
  if (faces.length <= 1) return faces;
  let skip = 0;
  let best = 0;
  for (let i = 0; i < faces.length; i++) {
    const pts = faces[i]!.map((k) => verts[k]!);
    const a = Math.abs(planSignedAreaMm2(pts));
    if (a > best) {
      best = a;
      skip = i;
    }
  }
  return faces.filter((_, i) => i !== skip);
}

function buildRoofGraph(
  eave: PointMm[],
  ridges: RoofRidge[],
): { verts: PointMm[]; faces: number[][] } | null {
  const ring = eaveWithRoofHits(eave, ridges);
  const segs: RoofSeg[] = [];
  for (let i = 0; i < ring.length; i++) {
    segs.push({ a: ring[i]!, b: ring[(i + 1) % ring.length]! });
  }
  for (const ridge of ridges) {
    for (let i = 1; i < ridge.points.length; i++) {
      segs.push({ a: ridge.points[i - 1]!, b: ridge.points[i]! });
    }
  }
  const verts: PointMm[] = [];
  const adj = new Map<number, number[]>();
  for (const seg of planarizeSegments(segs)) {
    const ia = addGraphVert(verts, seg.a);
    const ib = addGraphVert(verts, seg.b);
    addGraphEdge(adj, ia, ib);
  }
  const faces = extractRoofFaces(verts, adj);
  if (faces.length === 0) return null;
  const eaveArea = Math.abs(planSignedAreaMm2(ring));
  let faceArea = 0;
  for (const face of faces) {
    if (face.length < 3) continue;
    faceArea += Math.abs(planSignedAreaMm2(face.map((i) => verts[i]!)));
  }
  if (eaveArea > 1 && faceArea < eaveArea * 0.82) return null;
  return { verts, faces };
}

const MIN_FACE_AREA_MM2 = 25000;

function emitPlanarFaces(
  eave: PointMm[],
  graph: { verts: PointMm[]; faces: number[][] },
  pitch12: number,
  gableSkip: boolean[] | undefined,
  peaks: RoofRidge[],
): { vertices: RoofVertexMm[]; indices: number[] } {
  const sign = planSignedAreaMm2(eave) >= 0 ? 1 : -1;
  const supports: Array<{ a: PointMm; b: PointMm } | null> = [];
  const keep: boolean[] = [];
  for (const face of graph.faces) {
    if (face.length < 3) {
      keep.push(false);
      supports.push(null);
      continue;
    }
    const pts = face.map((i) => graph.verts[i]!);
    const area = Math.abs(planSignedAreaMm2(pts));
    if (
      area < MIN_FACE_AREA_MM2 ||
      distinctNonGableEaveRuns(pts, eave, gableSkip) >= 2
    ) {
      keep.push(false);
      supports.push(null);
      continue;
    }
    keep.push(true);
    supports.push(faceSupportingEave(pts, eave, sign, pitch12, gableSkip));
  }

  const incident: number[][] = graph.verts.map(() => []);
  for (let fi = 0; fi < graph.faces.length; fi++) {
    if (!keep[fi]) continue;
    const seen = new Set<number>();
    for (const i of graph.faces[fi]!) {
      if (seen.has(i)) continue;
      seen.add(i);
      incident[i]!.push(fi);
    }
  }

  const vertices: RoofVertexMm[] = graph.verts.map((p, i) => {
    const planes: Array<{ a: PointMm; b: PointMm }> = [];
    for (const fi of incident[i]!) {
      const sup = supports[fi];
      if (sup) planes.push(sup);
    }
    return {
      x: p.x,
      y: p.y,
      hMm: heightFromIncidentPlanes(
        p,
        planes,
        sign,
        pitch12,
        peaks,
        eave,
        gableSkip,
      ),
    };
  });

  const indices: number[] = [];
  for (let fi = 0; fi < graph.faces.length; fi++) {
    if (!keep[fi]) continue;
    const face = graph.faces[fi]!;
    const pts = face.map((i) => graph.verts[i]!);
    const local = earClip(pts);
    for (let t = 0; t < local.length; t += 3) {
      indices.push(face[local[t]!]!, face[local[t + 1]!]!, face[local[t + 2]!]!);
    }
  }
  applyLevelPeakHeights(vertices, peaks, eave, sign, pitch12, gableSkip);
  return { vertices, indices };
}

/**
 * Split the eave into planar roof faces using peak / hip lines, then lift
 * each face by its supporting eave plane.
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
  const allLines = snapRidgesToEave(
    [...ridges, ...completeRoofLines(eave, ridges, peaks)],
    eave,
    overhangMm,
  );
  const meshPeaks = peakRidges(allLines, eave);

  const graph = buildRoofGraph(eave, allLines);
  let vertices: RoofVertexMm[] = [];
  let indices: number[] = [];
  if (graph) {
    const emitted = emitPlanarFaces(eave, graph, pitch12, gablesSkip, meshPeaks);
    vertices = emitted.vertices;
    indices = emitted.indices;
  }
  if (indices.length < 3) {
    const verts: PointMm[] = [];
    for (const p of densifyRing(eave, DENSIFY_MM)) {
      if (snapVert(verts, p) >= 0) continue;
      verts.push({ x: p.x, y: p.y });
    }
    const roofChains: number[][] = [];
    for (const ridge of allLines) {
      if (ridge.points.length < 2) continue;
      const chain: number[] = [];
      for (const p of densifyOpen(ridge.points, RIDGE_STEP_MM)) {
        const hit = snapVert(verts, p);
        if (hit >= 0) {
          chain.push(hit);
          continue;
        }
        chain.push(verts.length);
        verts.push({ x: p.x, y: p.y });
      }
      if (chain.length >= 2) roofChains.push(chain);
    }
    const mesh: RoofMesh2 = { verts, tris: delaunayIndices(verts) };
    keepInsidePolygon(mesh, eave);
    for (const chain of roofChains) {
      for (let i = 1; i < chain.length; i++) {
        constrainEdge(mesh, chain[i - 1]!, chain[i]!);
      }
    }
    keepInsidePolygon(mesh, eave);
    dropTinyTris(mesh);
    const sign = planSignedAreaMm2(eave) >= 0 ? 1 : -1;
    const triSup: Array<{ a: PointMm; b: PointMm } | null> = [];
    for (let t = 0; t < mesh.tris.length; t += 3) {
      const pts = [
        mesh.verts[mesh.tris[t]!]!,
        mesh.verts[mesh.tris[t + 1]!]!,
        mesh.verts[mesh.tris[t + 2]!]!,
      ];
      triSup.push(faceSupportingEave(pts, eave, sign, pitch12, gablesSkip));
    }
    const inc: Array<Array<{ a: PointMm; b: PointMm }>> = mesh.verts.map(
      () => [],
    );
    for (let t = 0; t < mesh.tris.length; t += 3) {
      const sup = triSup[t / 3];
      if (!sup) continue;
      for (let k = 0; k < 3; k++) inc[mesh.tris[t + k]!]!.push(sup);
    }
    vertices = mesh.verts.map((p, i) => ({
      x: p.x,
      y: p.y,
      hMm: heightFromIncidentPlanes(
        p,
        inc[i]!,
        sign,
        pitch12,
        meshPeaks,
        eave,
        gablesSkip,
      ),
    }));
    indices = mesh.tris.slice();
  }
  if (indices.length < 3) return empty;
  applyLevelPeakHeights(
    vertices,
    meshPeaks,
    eave,
    planSignedAreaMm2(eave) >= 0 ? 1 : -1,
    pitch12,
    gablesSkip,
  );

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
      samples.push({
        p,
        h: heightFromEavePlanes(p, footprint, footSkip, pitch12),
      });
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
