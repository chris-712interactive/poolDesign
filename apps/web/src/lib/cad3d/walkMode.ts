import type { DesignDocument, PointMm } from "@pool-design/shared";
import {
  outlineBounds,
  planToWorldXZ,
  pointInPolygon,
  waterBodyKind,
} from "@pool-design/shared";

/** Standing eye height (m) for first-person walkthrough. */
export const WALK_EYE_HEIGHT_M = 1.62;

export type WalkSpawnPose = {
  position: [number, number, number];
  lookAt: [number, number, number];
  /** True when spawned inside a building footprint. */
  fromBuilding: boolean;
};

function openRing(outline: PointMm[]): PointMm[] {
  if (outline.length < 2) return outline;
  const a = outline[0];
  const b = outline[outline.length - 1];
  if (Math.hypot(a.x - b.x, a.y - b.y) < 1) return outline.slice(0, -1);
  return outline;
}

function lookTargetPlan(design: DesignDocument): PointMm {
  const pools = (design.poolBodies ?? []).filter(
    (b) => b.outline.length >= 3 && waterBodyKind(b) !== "spa",
  );
  if (pools[0]) {
    const bb = outlineBounds(pools[0].outline);
    return { x: bb.cx, y: bb.cy };
  }
  const spa = (design.poolBodies ?? []).find((b) => b.outline.length >= 3);
  if (spa) {
    const bb = outlineBounds(spa.outline);
    return { x: bb.cx, y: bb.cy };
  }
  const patio = (design.patios ?? []).find((p) => p.outline.length >= 3);
  if (patio) {
    const bb = outlineBounds(patio.outline);
    return { x: bb.cx, y: bb.cy };
  }
  const building = (design.buildings ?? []).find((b) => b.outline.length >= 3);
  if (building) {
    const bb = outlineBounds(building.outline);
    return { x: bb.cx, y: bb.cy + bb.height * 0.6 };
  }
  return { x: 0, y: 0 };
}

/**
 * Yard-facing wall of the house: stand just inside and look out toward the pool.
 * Falls back to patio / poolside if there is no building.
 */
export function walkSpawnPose(design: DesignDocument): WalkSpawnPose {
  const lookPlan = lookTargetPlan(design);
  const lookWorld = planToWorldXZ(lookPlan);
  const lookAt: [number, number, number] = [
    lookWorld.x,
    WALK_EYE_HEIGHT_M - 0.12,
    lookWorld.z,
  ];

  const building = (design.buildings ?? []).find((b) => b.outline.length >= 3);
  if (!building) {
    // Poolside / patio: stand back from the look target, facing it.
    const patio = (design.patios ?? []).find((p) => p.outline.length >= 3);
    if (patio) {
      const bb = outlineBounds(patio.outline);
      // Prefer the patio point farthest from the look target (approach from the house side).
      const corners: PointMm[] = [
        { x: bb.minX, y: bb.minY },
        { x: bb.maxX, y: bb.minY },
        { x: bb.maxX, y: bb.maxY },
        { x: bb.minX, y: bb.maxY },
      ];
      let best = corners[0];
      let bestD = -1;
      for (const c of corners) {
        const d = Math.hypot(c.x - lookPlan.x, c.y - lookPlan.y);
        if (d > bestD) {
          bestD = d;
          best = c;
        }
      }
      const w = planToWorldXZ(best);
      return {
        position: [w.x, WALK_EYE_HEIGHT_M, w.z],
        lookAt,
        fromBuilding: false,
      };
    }
    const back = planToWorldXZ({
      x: lookPlan.x + 6000,
      y: lookPlan.y + 4500,
    });
    return {
      position: [back.x, WALK_EYE_HEIGHT_M, back.z],
      lookAt,
      fromBuilding: false,
    };
  }

  const ring = openRing(building.outline);
  const bb = outlineBounds(ring);

  // Prefer standing just inside a yard-facing door/window looking out.
  let openingSpawn: PointMm | null = null;
  for (const opening of building.openings ?? []) {
    const n = ring.length;
    if (n < 2) break;
    const ei = ((opening.edgeIndex % n) + n) % n;
    const a = ring[ei];
    const b = ring[(ei + 1) % n];
    const edgeLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t = Math.min(0.92, Math.max(0.08, opening.t));
    const mid = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
    let nx = -(b.y - a.y) / edgeLen;
    let ny = (b.x - a.x) / edgeLen;
    const toCenterX = bb.cx - mid.x;
    const toCenterY = bb.cy - mid.y;
    if (nx * toCenterX + ny * toCenterY > 0) {
      nx = -nx;
      ny = -ny;
    }
    const toLookX = lookPlan.x - mid.x;
    const toLookY = lookPlan.y - mid.y;
    if (nx * toLookX + ny * toLookY <= 0) continue; // not yard-facing
    const candidate = {
      x: mid.x - nx * 900,
      y: mid.y - ny * 900,
    };
    if (pointInPolygon(candidate, ring)) {
      openingSpawn = candidate;
      if (opening.kind === "door") break; // doors preferred for walking out
    }
  }

  // Yard-facing edge: midpoint closest to the pool / look target.
  let bestMid: PointMm | null = null;
  let bestNx = 0;
  let bestNy = 0;
  let bestScore = Infinity;

  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const elen = Math.hypot(ex, ey) || 1;
    let nx = -ey / elen;
    let ny = ex / elen;
    const toCenterX = bb.cx - mid.x;
    const toCenterY = bb.cy - mid.y;
    if (nx * toCenterX + ny * toCenterY > 0) {
      nx = -nx;
      ny = -ny;
    }
    const toLookX = lookPlan.x - mid.x;
    const toLookY = lookPlan.y - mid.y;
    const towardYard = nx * toLookX + ny * toLookY;
    if (towardYard <= 0) continue;
    const dist = Math.hypot(toLookX, toLookY);
    const score = dist - towardYard * 0.15;
    if (score < bestScore) {
      bestScore = score;
      bestMid = mid;
      bestNx = nx;
      bestNy = ny;
    }
  }

  let spawnPlan: PointMm;
  if (openingSpawn) {
    spawnPlan = openingSpawn;
  } else if (bestMid) {
    const insetMm = 1100;
    spawnPlan = {
      x: bestMid.x - bestNx * insetMm,
      y: bestMid.y - bestNy * insetMm,
    };
    if (!pointInPolygon(spawnPlan, ring)) {
      spawnPlan = { x: bb.cx, y: bb.cy };
    }
  } else {
    spawnPlan = { x: bb.cx, y: bb.cy };
  }

  // Nudge toward the yard so we're clearly looking out a window / door wall.
  const toLook = Math.hypot(lookPlan.x - spawnPlan.x, lookPlan.y - spawnPlan.y) || 1;
  spawnPlan = {
    x: spawnPlan.x + ((lookPlan.x - spawnPlan.x) / toLook) * 400,
    y: spawnPlan.y + ((lookPlan.y - spawnPlan.y) / toLook) * 400,
  };
  if (!pointInPolygon(spawnPlan, ring)) {
    spawnPlan = { x: bb.cx, y: bb.cy };
  }

  const spawnWorld = planToWorldXZ(spawnPlan);
  return {
    position: [spawnWorld.x, WALK_EYE_HEIGHT_M, spawnWorld.z],
    lookAt,
    fromBuilding: true,
  };
}

/** Soft world bounds so you can't wander infinitely off-site. */
export function walkBounds(
  center: { x: number; z: number },
  groundSize: number,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const half = Math.max(20, groundSize * 0.65);
  return {
    minX: center.x - half,
    maxX: center.x + half,
    minZ: center.z - half,
    maxZ: center.z + half,
  };
}
