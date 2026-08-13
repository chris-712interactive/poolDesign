/**
 * ISPSC-style pool barrier gate hardware placement (advisory).
 * Heights are measured from the bottom of the gate leaf.
 *
 * - Self-closing hinges / springs on the outside face (away from water).
 * - Latch ≥ 54″ from the gate bottom may sit on the outside;
 *   shorter gates use a pool-side release 3″ below the top.
 */

import type { PointMm } from "./design-model";
import { MM_PER_INCH } from "./units";

/** ISPSC 305.3.3 — exterior-reachable latch minimum. */
export const POOL_GATE_LATCH_MIN_HEIGHT_MM = 54 * MM_PER_INCH;
/** ISPSC 305.3.3 — pool-side latch setdown from the top of the gate. */
export const POOL_GATE_LATCH_TOP_SETDOWN_MM = 3 * MM_PER_INCH;
/** Typical TruClose / barrel-hinge inset from leaf ends. */
export const POOL_GATE_HINGE_INSET_MM = 8 * MM_PER_INCH;
/** Third hinge when the leaf is at least this tall. */
export const POOL_GATE_THIRD_HINGE_MIN_HEIGHT_MM = 60 * MM_PER_INCH;
/** Typical under-gate clearance (~2″). */
export const POOL_GATE_GROUND_CLEARANCE_MM = 2 * MM_PER_INCH;

export type PoolGateLatchFace = "outside" | "pool";

export type PoolGateLatchSpec = {
  /** Center of the release mechanism above the gate bottom (mm). */
  heightMm: number;
  face: PoolGateLatchFace;
};

export function polygonCentroid(points: PointMm[]): PointMm | null {
  if (!points.length) return null;
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/**
 * Unit plan normal on the gate line that points away from the nearest water
 * body. Falls back to left-of-a→b when no water is present.
 */
export function gateOutwardNormal(
  a: PointMm,
  b: PointMm,
  waterCentroids: PointMm[],
): PointMm {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: -1 };
  const ux = dx / len;
  const uy = dy / len;
  let nx = -uy;
  let ny = ux;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (waterCentroids.length) {
    let nearest = waterCentroids[0];
    let best = Infinity;
    for (const c of waterCentroids) {
      const d = Math.hypot(c.x - mid.x, c.y - mid.y);
      if (d < best) {
        best = d;
        nearest = c;
      }
    }
    const toWaterX = nearest.x - mid.x;
    const toWaterY = nearest.y - mid.y;
    if (toWaterX * nx + toWaterY * ny > 0) {
      nx = -nx;
      ny = -ny;
    }
  }
  return { x: nx, y: ny };
}

export function poolGateLatchSpec(gateHeightMm: number): PoolGateLatchSpec {
  const h = Math.max(1, gateHeightMm);
  if (h >= POOL_GATE_LATCH_MIN_HEIGHT_MM + POOL_GATE_LATCH_TOP_SETDOWN_MM) {
    return {
      heightMm: POOL_GATE_LATCH_MIN_HEIGHT_MM,
      face: "outside",
    };
  }
  return {
    heightMm: Math.max(
      POOL_GATE_HINGE_INSET_MM,
      h - POOL_GATE_LATCH_TOP_SETDOWN_MM,
    ),
    face: "pool",
  };
}

/** Vertical centers of self-closing hinges / springs along the hinge stile. */
export function poolGateHingeHeightsMm(gateHeightMm: number): number[] {
  const h = Math.max(POOL_GATE_HINGE_INSET_MM * 2 + 1, gateHeightMm);
  const bot = POOL_GATE_HINGE_INSET_MM;
  const top = h - POOL_GATE_HINGE_INSET_MM;
  if (h >= POOL_GATE_THIRD_HINGE_MIN_HEIGHT_MM) {
    return [bot, h / 2, top];
  }
  return [bot, top];
}
