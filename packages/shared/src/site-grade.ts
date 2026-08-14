import {
  DEFAULT_RETAINING_TRIGGER_MM,
  pointInPolygon,
  polygonAreaMm2,
  segmentLengthMm,
  type DesignGradeOptions,
  type GradeSample,
  type PatioGradeStrategy,
  type PatioRegion,
  type PointMm,
} from "./design-model";
import { PATIO_SLAB_THICKNESS_MM } from "./scene3d";

const MM3_PER_CY = 764_554_857.984; // cubic mm per cubic yard

export type RetainingSegment = {
  a: PointMm;
  b: PointMm;
  lengthMm: number;
  /** Drop at edge midpoint (mm below FFE) */
  dropMm: number;
};

export type PatioGradeAnalysis = {
  patioId: string;
  strategy: PatioGradeStrategy;
  /** Fill volume under patio to slab bottom (mm³); 0 if strategy excludes fill */
  fillVolumeMm3: number;
  fillVolumeCy: number;
  avgFillHeightMm: number;
  maxFillHeightMm: number;
  retainingSegments: RetainingSegment[];
  retainingLengthMm: number;
};

type GradeShot = { x: number; y: number; z: number };
type GradeTri = { a: number; b: number; c: number };

type GradeSurface = {
  shots: GradeShot[];
  tris: GradeTri[];
};

const gradeSurfaceCache = new WeakMap<GradeSample[], GradeSurface>();

function gradeShots(samples: GradeSample[]): GradeShot[] {
  const out: GradeShot[] = [];
  for (const s of samples) {
    const hit = out.find(
      (p) => Math.hypot(p.x - s.position.x, p.y - s.position.y) < 1,
    );
    if (hit) {
      hit.z = (hit.z + s.dropMm) / 2;
      continue;
    }
    out.push({ x: s.position.x, y: s.position.y, z: s.dropMm });
  }
  return out;
}

function triArea2(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function inCircumcircle(
  p: GradeShot,
  a: GradeShot,
  b: GradeShot,
  c: GradeShot,
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
  return det * Math.sign(triArea2(a, b, c)) > 0;
}

/** Delaunay triangles among shots. Empty when all shots are collinear. */
function delaunayTris(shots: GradeShot[]): GradeTri[] {
  if (shots.length < 3) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of shots) {
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
  }
  const span = Math.max(maxX - minX, maxY - minY, 1) * 10;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const n = shots.length;
  const pts: GradeShot[] = [
    ...shots,
    { x: cx, y: cy - 2 * span, z: 0 },
    { x: cx - 2 * span, y: cy + span, z: 0 },
    { x: cx + 2 * span, y: cy + span, z: 0 },
  ];
  let tris: GradeTri[] = [{ a: n, b: n + 1, c: n + 2 }];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const bad: GradeTri[] = [];
    const keep: GradeTri[] = [];
    for (const t of tris) {
      if (inCircumcircle(p, pts[t.a], pts[t.b], pts[t.c])) bad.push(t);
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
      if (Math.abs(triArea2(pts[u], pts[v], p)) < 1e-6) continue;
      tris.push({ a: u, b: v, c: i });
    }
  }
  return tris.filter((t) => t.a < n && t.b < n && t.c < n);
}

function barycentric(
  p: PointMm,
  a: GradeShot,
  b: GradeShot,
  c: GradeShot,
): { w1: number; w2: number; w3: number } | null {
  const den = triArea2(a, b, c);
  if (Math.abs(den) < 1e-6) return null;
  const w1 = triArea2(p, b, c) / den;
  const w2 = triArea2(a, p, c) / den;
  const w3 = 1 - w1 - w2;
  return { w1, w2, w3 };
}

function lerpOnSegment(
  p: PointMm,
  a: GradeShot,
  b: GradeShot,
): { d2: number; z: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t =
    len2 < 1e-12
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
  const qx = a.x + t * vx;
  const qy = a.y + t * vy;
  const dx = p.x - qx;
  const dy = p.y - qy;
  return { d2: dx * dx + dy * dy, z: a.z + t * (b.z - a.z) };
}

function hullEdges(tris: GradeTri[]): Array<[number, number]> {
  const counts = new Map<string, { u: number; v: number; n: number }>();
  const add = (u: number, v: number) => {
    const key = u < v ? `${u}:${v}` : `${v}:${u}`;
    const e = counts.get(key);
    if (e) e.n += 1;
    else counts.set(key, { u, v, n: 1 });
  };
  for (const t of tris) {
    add(t.a, t.b);
    add(t.b, t.c);
    add(t.c, t.a);
  }
  return [...counts.values()]
    .filter((e) => e.n === 1)
    .map((e) => [e.u, e.v]);
}

function interpolateTin(
  point: PointMm,
  shots: GradeShot[],
  tris: GradeTri[],
): number | null {
  if (!tris.length) return null;
  for (const t of tris) {
    const bary = barycentric(point, shots[t.a], shots[t.b], shots[t.c]);
    if (!bary) continue;
    if (bary.w1 >= -1e-7 && bary.w2 >= -1e-7 && bary.w3 >= -1e-7) {
      return (
        bary.w1 * shots[t.a].z + bary.w2 * shots[t.b].z + bary.w3 * shots[t.c].z
      );
    }
  }
  let best: { d2: number; z: number } | null = null;
  for (const [u, v] of hullEdges(tris)) {
    const hit = lerpOnSegment(point, shots[u], shots[v]);
    if (!best || hit.d2 < best.d2) best = hit;
  }
  return best?.z ?? null;
}

function gradeSurface(samples: GradeSample[]): GradeSurface {
  const cached = gradeSurfaceCache.get(samples);
  if (cached) return cached;
  const shots = gradeShots(samples);
  const built = { shots, tris: delaunayTris(shots) };
  gradeSurfaceCache.set(samples, built);
  return built;
}

/**
 * Interpolate drop along the longest sample axis (grade-walk transect).
 * Used when shots are collinear so a TIN cannot be formed.
 */
function interpolateAlongSampleAxis(
  point: PointMm,
  shots: GradeShot[],
): number | null {
  if (!shots.length) return null;
  if (shots.length === 1) return shots[0].z;
  let i0 = 0;
  let i1 = 1;
  let best = -1;
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const d = Math.hypot(shots[j].x - shots[i].x, shots[j].y - shots[i].y);
      if (d > best) {
        best = d;
        i0 = i;
        i1 = j;
      }
    }
  }
  if (best < 10) return shots[0].z;
  const ox = shots[i0].x;
  const oy = shots[i0].y;
  const ux = (shots[i1].x - ox) / best;
  const uy = (shots[i1].y - oy) / best;
  const keyed = shots
    .map((s) => ({
      t: (s.x - ox) * ux + (s.y - oy) * uy,
      z: s.z,
    }))
    .sort((a, b) => a.t - b.t);
  const t = (point.x - ox) * ux + (point.y - oy) * uy;
  if (t <= keyed[0].t) return keyed[0].z;
  const last = keyed[keyed.length - 1];
  if (t >= last.t) return last.z;
  for (let i = 1; i < keyed.length; i++) {
    if (t <= keyed[i].t) {
      const a = keyed[i - 1];
      const b = keyed[i];
      const span = b.t - a.t;
      if (span < 1e-6) return b.z;
      return a.z + (b.z - a.z) * ((t - a.t) / span);
    }
  }
  return last.z;
}

/**
 * Existing-grade drop at a plan point (mm below FFE).
 * Piecewise-linear on a TIN of the shots so walks from the house keep their
 * slope; a fence along equal-drop hull edges stays level (no IDW bobbing).
 */
export function existingGradeDropMm(
  point: PointMm,
  samples: GradeSample[],
  _power = 2,
): number {
  if (!samples.length) return 0;
  for (const s of samples) {
    if (Math.hypot(point.x - s.position.x, point.y - s.position.y) < 1e-3) {
      return s.dropMm;
    }
  }
  const { shots, tris } = gradeSurface(samples);
  if (!shots.length) return 0;
  const tin = interpolateTin(point, shots, tris);
  if (tin != null) return tin;
  return interpolateAlongSampleAxis(point, shots) ?? 0;
}

function patioBounds(outline: PointMm[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of outline) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Height of compacted fill needed under the slab to reach FFE.
 * Existing grade is `dropMm` below FFE; slab bottom is PATIO_SLAB_THICKNESS below FFE.
 */
export function fillHeightUnderSlabMm(dropMm: number): number {
  if (dropMm <= PATIO_SLAB_THICKNESS_MM) return 0;
  return dropMm - PATIO_SLAB_THICKNESS_MM;
}

export function mm3ToCy(mm3: number): number {
  return mm3 / MM3_PER_CY;
}

export function resolveGradeStrategy(
  strategy: PatioGradeStrategy | undefined,
): PatioGradeStrategy {
  return strategy === "fill" || strategy === "retaining" || strategy === "both"
    ? strategy
    : "both";
}

export function retainingTriggerMm(options?: DesignGradeOptions): number {
  const t = options?.retainingTriggerMm;
  return typeof t === "number" && t > 0 ? t : DEFAULT_RETAINING_TRIGGER_MM;
}

/**
 * Sample a patio footprint on a grid and integrate fill volume;
 * scan perimeter for retaining segments.
 */
export function analyzePatioGrade(
  patio: PatioRegion,
  samples: GradeSample[],
  options?: DesignGradeOptions,
  gridStepMm = 600,
): PatioGradeAnalysis {
  const strategy = resolveGradeStrategy(patio.gradeStrategy);
  const trigger = retainingTriggerMm(options);
  const outline = patio.outline ?? [];

  let fillVolumeMm3 = 0;
  let avgFillHeightMm = 0;
  let maxFillHeightMm = 0;
  const retainingSegments: RetainingSegment[] = [];

  if (outline.length >= 3 && samples.length > 0) {
    const includeFill = strategy === "fill" || strategy === "both";
    const includeWall = strategy === "retaining" || strategy === "both";

    if (includeFill) {
      const { minX, maxX, minY, maxY } = patioBounds(outline);
      const step = Math.max(200, gridStepMm);
      let heightSum = 0;
      let cellCount = 0;
      for (let x = minX + step / 2; x < maxX; x += step) {
        for (let y = minY + step / 2; y < maxY; y += step) {
          const p = { x, y };
          if (!pointInPolygon(p, outline)) continue;
          const drop = existingGradeDropMm(p, samples);
          const h = fillHeightUnderSlabMm(drop);
          if (h <= 0) continue;
          fillVolumeMm3 += h * step * step;
          heightSum += h;
          cellCount += 1;
          if (h > maxFillHeightMm) maxFillHeightMm = h;
        }
      }
      avgFillHeightMm = cellCount > 0 ? heightSum / cellCount : 0;

      // Scale volume to actual polygon area vs sampled cells to reduce grid bias.
      if (cellCount > 0) {
        const sampledArea = cellCount * step * step;
        const trueArea = polygonAreaMm2(outline);
        if (sampledArea > 0 && trueArea > 0) {
          fillVolumeMm3 *= trueArea / sampledArea;
        }
      }
    }

    if (includeWall) {
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i];
        const b = outline[(i + 1) % outline.length];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const drop = existingGradeDropMm(mid, samples);
        if (drop >= trigger) {
          const lengthMm = segmentLengthMm(a, b);
          retainingSegments.push({ a, b, lengthMm, dropMm: drop });
        }
      }
    }
  }

  const retainingLengthMm = retainingSegments.reduce(
    (s, e) => s + e.lengthMm,
    0,
  );

  return {
    patioId: patio.id,
    strategy,
    fillVolumeMm3,
    fillVolumeCy: mm3ToCy(fillVolumeMm3),
    avgFillHeightMm,
    maxFillHeightMm,
    retainingSegments,
    retainingLengthMm,
  };
}

export function analyzeDesignGrade(
  patios: PatioRegion[],
  samples: GradeSample[],
  options?: DesignGradeOptions,
): PatioGradeAnalysis[] {
  return (patios ?? []).map((p) => analyzePatioGrade(p, samples, options));
}

export function totalFillCy(analyses: PatioGradeAnalysis[]): number {
  return analyses.reduce((s, a) => s + a.fillVolumeCy, 0);
}

export function totalRetainingLf(analyses: PatioGradeAnalysis[]): number {
  const mm = analyses.reduce((s, a) => s + a.retainingLengthMm, 0);
  return mm / 304.8;
}
