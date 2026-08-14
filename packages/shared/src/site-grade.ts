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

/** Least-squares plane z = ax + by + c. Null when shots are collinear / piled up. */
function fitDropPlane(
  shots: GradeShot[],
): { a: number; b: number; c: number } | null {
  if (shots.length < 3) return null;
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (const s of shots) {
    mx += s.x;
    my += s.y;
    mz += s.z;
  }
  mx /= shots.length;
  my /= shots.length;
  mz /= shots.length;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  let xz = 0;
  let yz = 0;
  for (const s of shots) {
    const dx = s.x - mx;
    const dy = s.y - my;
    const dz = s.z - mz;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
    xz += dx * dz;
    yz += dy * dz;
  }
  const det = xx * yy - xy * xy;
  const tr = xx + yy;
  const disc = Math.sqrt(Math.max(0, tr * tr - 4 * det));
  const eigMin = (tr - disc) / 2;
  // Nearly collinear (grade walk): interpolating along the transect is more
  // stable than a plane that can invent a steep cross-slope.
  if (eigMin < shots.length * 600 * 600 || Math.abs(det) < 1e-6) return null;
  const a = (yy * xz - xy * yz) / det;
  const b = (xx * yz - xy * xz) / det;
  return { a, b, c: mz - a * mx - b * my };
}

/**
 * Interpolate drop along the longest sample axis (grade-walk transect).
 * Cross-slope is level — a fence parallel to the walk does not bob.
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
 * Uses a fitted slope when shots spread in 2D; otherwise interpolates along
 * the walk axis so a fence does not bob between individual shots.
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
  const shots = gradeShots(samples);
  if (!shots.length) return 0;
  const plane = fitDropPlane(shots);
  if (plane) return plane.a * point.x + plane.b * point.y + plane.c;
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
