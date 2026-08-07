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

/**
 * Inverse-distance-weighted existing-grade drop at a plan point.
 * Returns 0 when there are no samples.
 */
export function existingGradeDropMm(
  point: PointMm,
  samples: GradeSample[],
  power = 2,
): number {
  if (!samples.length) return 0;
  let wSum = 0;
  let vSum = 0;
  for (const s of samples) {
    const d = Math.hypot(point.x - s.position.x, point.y - s.position.y);
    if (d < 1e-3) return s.dropMm;
    const w = 1 / d ** power;
    wSum += w;
    vSum += w * s.dropMm;
  }
  return wSum > 0 ? vSum / wSum : 0;
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
