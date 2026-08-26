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
   * Walk direction in plan degrees — same convention as grade-sample
   * `rotationDeg` / the rotation handle (0° = drawing-up, −Y).
   */
  bearingDeg: number;
  points: GradeWalkPoint[];
  /** Optional id prefix for generated samples. */
  idPrefix?: string;
};

/** Unit vector for a CAD grade heading. 0° = drawing-up (−Y), 90° = −X. */
export function bearingToUnitVector(bearingDeg: number): PointMm {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: -Math.sin(rad), y: -Math.cos(rad) };
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
  const used = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (!Number.isFinite(p.distanceMm) || p.distanceMm < 0) continue;
    if (!Number.isFinite(p.dropMm)) continue;
    samples.push({
      id: uniqueGradeSampleId(prefix, used),
      position: pointAlongBearing(input.origin, input.bearingDeg, p.distanceMm),
      dropMm: p.dropMm,
      rotationDeg: input.bearingDeg,
    });
  }
  return samples;
}

function uniqueGradeSampleId(prefix: string, used: Set<string>): string {
  let id: string;
  do {
    id = `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  } while (used.has(id));
  used.add(id);
  return id;
}

/**
 * Merge imported samples into an existing list.
 * When replaceExisting is true, removes prior samples whose id starts with idPrefix.
 * Imported ids that collide with remaining samples are reassigned so each
 * grade mark stays independently selectable.
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
  const used = new Set(base.map((s) => s.id));
  const imported = opts.imported.map((s) => {
    if (s.id && !used.has(s.id)) {
      used.add(s.id);
      return s;
    }
    return { ...s, id: uniqueGradeSampleId(prefix, used) };
  });
  return [...base, ...imported];
}
