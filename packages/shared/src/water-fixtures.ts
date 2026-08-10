import { segmentLengthMm, type PointMm, type PoolBody } from "./design-model";
import { outlineBounds, spaWallThicknessMm } from "./spa-defaults";
import { isBubblerId } from "./object-library";

/** Match scene3d POOL_WALL_THICKNESS_MM — kept local to avoid a circular import. */
const POOL_WALL_THICKNESS_MM = 200;

/** Wall-mounted in-water fixtures (jets, niche lights) — snap to shell. */
export function isWallWaterFixtureId(id: string): boolean {
  return id === "spa_jet" || id.startsWith("light_");
}

export function isFloorWaterFixtureId(id: string): boolean {
  return isBubblerId(id) || id === "spa_drain";
}

export type WallFixtureSnap = {
  position: PointMm;
  /** Plan degrees: 0 = +X; fixture local +Z faces this bearing (into the water). */
  rotationDeg: number;
  bodyId: string;
  distMm: number;
};

/**
 * Snap a wall fixture to the nearest pool/spa shell, on the water side of the
 * wall, facing straight into the vessel (inward wall normal — not toward the
 * centroid, which would spin the light as it slides along a wall).
 */
export function snapWaterWallFixture(
  bodies: PoolBody[],
  point: PointMm,
  maxDistMm = 1800,
): WallFixtureSnap | null {
  let best: WallFixtureSnap | null = null;

  for (const body of bodies) {
    const outline = body.outline;
    if (!outline || outline.length < 3) continue;
    const wallMm =
      (body.kind ?? "pool") === "spa"
        ? spaWallThicknessMm(body)
        : (body.wallThicknessMm ?? POOL_WALL_THICKNESS_MM);
    // Sit just proud of the interior plaster face.
    const insetMm = wallMm + 35;
    const { cx, cy } = outlineBounds(outline);

    for (let i = 0; i < outline.length; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      const edgeLen = segmentLengthMm(a, b);
      if (edgeLen < 1e-6) continue;
      const tRaw =
        ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) /
        (edgeLen * edgeLen);
      const t = Math.min(1, Math.max(0, tRaw));
      const proj = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
      const dist = segmentLengthMm(point, proj);
      if (dist > maxDistMm) continue;

      // Inward unit normal for this edge (toward the body interior).
      const ex = (b.x - a.x) / edgeLen;
      const ey = (b.y - a.y) / edgeLen;
      let nx = -ey;
      let ny = ex;
      if (nx * (cx - proj.x) + ny * (cy - proj.y) < 0) {
        nx = -nx;
        ny = -ny;
      }

      const position = {
        x: proj.x + nx * insetMm,
        y: proj.y + ny * insetMm,
      };
      // Local +Z faces into the water, perpendicular to the wall.
      const rotationDeg = (Math.atan2(ny, nx) * 180) / Math.PI;

      if (!best || dist < best.distMm) {
        best = {
          position,
          rotationDeg,
          bodyId: body.id,
          distMm: dist,
        };
      }
    }
  }

  return best;
}
