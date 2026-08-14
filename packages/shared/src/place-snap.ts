import {
  pointInPolygon,
  segmentLengthMm,
  type PatioCover,
  type PlacedObject,
  type PointMm,
  type PoolFeature,
} from "./design-model";
import { flattenClosedOutline } from "./outline-arcs";
import {
  isCoverAccessoryId,
  isSunshelfLayoutId,
  isUmbrellaSleeveId,
} from "./object-library";
import { outlineBounds } from "./spa-defaults";

function snapIntoOutline(
  point: PointMm,
  outline: PointMm[],
  maxDistMm: number,
  insetMm = 180,
): PointMm | null {
  const ring = flattenClosedOutline(outline);
  if (!ring || ring.length < 3) return null;
  if (pointInPolygon(point, ring)) return point;

  const { cx, cy } = outlineBounds(ring);
  let best: {
    dist: number;
    proj: PointMm;
    nx: number;
    ny: number;
  } | null = null;

  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
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

    const ex = (b.x - a.x) / edgeLen;
    const ey = (b.y - a.y) / edgeLen;
    let nx = -ey;
    let ny = ex;
    if (nx * (cx - proj.x) + ny * (cy - proj.y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    if (!best || dist < best.dist) best = { dist, proj, nx, ny };
  }
  if (!best) return null;
  return {
    x: best.proj.x + best.nx * insetMm,
    y: best.proj.y + best.ny * insetMm,
  };
}

export function snapToPatioCover(
  covers: PatioCover[] | undefined,
  point: PointMm,
  maxDistMm = 1500,
): { coverId: string; position: PointMm } | null {
  let best: { coverId: string; position: PointMm; dist: number } | null = null;
  for (const cover of covers ?? []) {
    if (cover.outline.length < 3) continue;
    const inside = pointInPolygon(point, cover.outline);
    const snapped = snapIntoOutline(point, cover.outline, maxDistMm);
    if (!snapped) continue;
    const dist = inside ? 0 : segmentLengthMm(point, snapped);
    if (!best || dist < best.dist) {
      best = { coverId: cover.id, position: snapped, dist };
    }
  }
  return best
    ? { coverId: best.coverId, position: best.position }
    : null;
}

export function snapToSunshelf(
  features: PoolFeature[] | undefined,
  point: PointMm,
  maxDistMm = 800,
): { featureId: string; position: PointMm } | null {
  let best: { featureId: string; position: PointMm; dist: number } | null =
    null;
  for (const feature of features ?? []) {
    if (feature.kind !== "sunshelf" || feature.outline.length < 3) continue;
    const inside = pointInPolygon(point, feature.outline);
    const snapped = snapIntoOutline(point, feature.outline, maxDistMm);
    if (!snapped) continue;
    const dist = inside ? 0 : segmentLengthMm(point, snapped);
    if (!best || dist < best.dist) {
      best = { featureId: feature.id, position: snapped, dist };
    }
  }
  return best
    ? { featureId: best.featureId, position: best.position }
    : null;
}

/** Snap an umbrella onto the nearest sunshelf pole holder. */
export function snapUmbrellaToSleeve(
  objects: PlacedObject[] | undefined,
  point: PointMm,
  maxDistMm = 450,
): PointMm | null {
  let best: { d: number; p: PointMm } | null = null;
  for (const obj of objects ?? []) {
    if (!isUmbrellaSleeveId(obj.catalogItemId)) continue;
    const d = segmentLengthMm(point, obj.position);
    if (d > maxDistMm) continue;
    if (!best || d < best.d) best = { d, p: obj.position };
  }
  return best?.p ?? null;
}

/**
 * Resolve a click/drag point for cover accessories, sunshelf items, and
 * umbrellas that should seat in a pole holder.
 */
export function resolvePlacePosition(
  catalogItemId: string,
  point: PointMm,
  opts: {
    covers?: PatioCover[];
    features?: PoolFeature[];
    objects?: PlacedObject[];
  },
): PointMm {
  if (catalogItemId === "umbrella") {
    const sleeve = snapUmbrellaToSleeve(opts.objects, point);
    if (sleeve) return sleeve;
  }
  if (isCoverAccessoryId(catalogItemId)) {
    return snapToPatioCover(opts.covers, point)?.position ?? point;
  }
  if (isSunshelfLayoutId(catalogItemId)) {
    return snapToSunshelf(opts.features, point)?.position ?? point;
  }
  return point;
}
