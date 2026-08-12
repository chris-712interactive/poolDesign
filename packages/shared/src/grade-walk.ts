/**
 * Convert a linear grade walk (distance + relative drop) into GradeSample points.
 * Phone AR / manual capture posts distance+drop; CAD places samples along a bearing.
 */

import type { GradeSample, PointMm } from "./design-model";

export type GradeWalkPoint = {
  /** Distance from walk origin along the transect (mm). */
  distanceMm: number;
  /**
   * Existing grade relative to start/FFE.
   * Positive = below FFE (drop); negative = above FFE (rise).
   */
  dropMm: number;
};

export type GradeWalkImportInput = {
  /** Plan-space origin (typically back of house / FFE reference). */
  origin: PointMm;
  /**
   * Walk direction in plan degrees.
   * 0° = +X, 90° = +Y (same convention as other CAD rotations).
   */
  bearingDeg: number;
  points: GradeWalkPoint[];
  /** Optional id prefix for generated samples. */
  idPrefix?: string;
};

export function bearingToUnitVector(bearingDeg: number): PointMm {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

export function pointAlongBearing(
  origin: PointMm,
  bearingDeg: number,
  distanceMm: number,
): PointMm {
  const u = bearingToUnitVector(bearingDeg);
  return {
    x: origin.x + u.x * distanceMm,
    y: origin.y + u.y * distanceMm,
  };
}

/** Build GradeSample[] from a transect walk. Skips non-finite / negative distances. */
export function gradeWalkToSamples(input: GradeWalkImportInput): GradeSample[] {
  const prefix = input.idPrefix ?? "ar_grade";
  const samples: GradeSample[] = [];
  const sorted = [...input.points].sort((a, b) => a.distanceMm - b.distanceMm);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (!Number.isFinite(p.distanceMm) || p.distanceMm < 0) continue;
    if (!Number.isFinite(p.dropMm)) continue;
    samples.push({
      id: `${prefix}_${i}_${Math.round(p.distanceMm)}`,
      position: pointAlongBearing(input.origin, input.bearingDeg, p.distanceMm),
      dropMm: p.dropMm,
      rotationDeg: input.bearingDeg,
    });
  }
  return samples;
}

/**
 * Merge imported samples into an existing list.
 * When replaceExisting is true, removes prior samples whose id starts with idPrefix.
 */
export function mergeGradeWalkSamples(opts: {
  existing: GradeSample[];
  imported: GradeSample[];
  replaceExisting?: boolean;
  idPrefix?: string;
}): GradeSample[] {
  const prefix = opts.idPrefix ?? "ar_grade";
  const base = opts.replaceExisting
    ? opts.existing.filter((s) => !s.id.startsWith(prefix))
    : opts.existing;
  return [...base, ...opts.imported];
}
