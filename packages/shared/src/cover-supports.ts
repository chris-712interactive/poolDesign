/**
 * Patio cover / pergola post & footing layout.
 *
 * Defaults follow common residential patio-cover guides (municipal handouts):
 * - Beam/post spacing typically 8′–12′; we target 10′ o.c. (fits 4×8 / 4×10 tables)
 * - Posts: 6×6 (4×4 is code minimum; 6×6 is the usual residential size)
 * - Footings: 16×16 square piers (mid-range for ~100 sf tributary; 12–24″ in tables)
 * - Edges against a house use a ledger — posts are omitted within the attach tolerance
 */

import {
  pointInPolygon,
  segmentLengthMm,
  type Building,
  type CoverSupport,
  type PointMm,
} from "./design-model";
import { outlineBounds } from "./spa-defaults";

/** Max on-center spacing between posts (~10′). */
export const COVER_MAX_POST_SPACING_MM = 3048;
/** Default post cross-section (6×6). */
export const COVER_POST_SIZE_MM = 152.4;
/** Default square footing (16×16). */
export const COVER_FOOTING_SIZE_MM = 406.4;
/** Inset posts from the roof edge toward the center (~9″). */
export const COVER_POST_EDGE_INSET_MM = 228.6;
/** Treat as ledger-attached when within this distance of a building. */
export const COVER_LEDGER_ATTACH_TOLERANCE_MM = 900;

export type { CoverSupport };

function openRing(outline: PointMm[]): PointMm[] {
  if (outline.length < 3) return outline.slice();
  const first = outline[0];
  const last = outline[outline.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) < 1) {
    return outline.slice(0, -1);
  }
  return outline.slice();
}

function distPointToSegment(
  p: PointMm,
  a: PointMm,
  b: PointMm,
): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.min(1, Math.max(0, t));
  const qx = a.x + abx * t;
  const qy = a.y + aby * t;
  return Math.hypot(p.x - qx, p.y - qy);
}

function nearBuilding(
  p: PointMm,
  buildings: Building[],
  tolMm: number,
): boolean {
  for (const b of buildings) {
    const ring = openRing(b.outline);
    if (ring.length < 3) continue;
    if (pointInPolygon(p, ring)) return true;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const c = ring[(i + 1) % ring.length];
      if (distPointToSegment(p, a, c) <= tolMm) return true;
    }
  }
  return false;
}

function dedupePoints(points: PointMm[], tolMm: number): PointMm[] {
  const out: PointMm[] = [];
  for (const p of points) {
    if (out.some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= tolMm)) continue;
    out.push(p);
  }
  return out;
}

function insetToward(
  p: PointMm,
  target: PointMm,
  insetMm: number,
): PointMm {
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const inset = Math.min(insetMm, d * 0.45);
  return { x: p.x + (dx / d) * inset, y: p.y + (dy / d) * inset };
}

/**
 * Plan positions for posts under a cover footprint.
 * Corners + intermediates so spacing ≤ {@link COVER_MAX_POST_SPACING_MM};
 * candidates near a building wall are dropped (ledger attachment).
 */
export function layoutCoverSupportPositions(
  outline: PointMm[],
  buildings: Building[] = [],
): PointMm[] {
  const ring = openRing(outline);
  if (ring.length < 3) return [];
  const bb = outlineBounds(ring);
  const centroid = { x: bb.cx, y: bb.cy };
  const candidates: PointMm[] = [];

  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = segmentLengthMm(a, b);
    if (len < 50) continue;
    const spans = Math.max(1, Math.ceil(len / COVER_MAX_POST_SPACING_MM));
    for (let s = 0; s <= spans; s++) {
      const t = s / spans;
      const p = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
      candidates.push(insetToward(p, centroid, COVER_POST_EDGE_INSET_MM));
    }
  }

  const unique = dedupePoints(candidates, 80);
  const free = unique.filter(
    (p) => !nearBuilding(p, buildings, COVER_LEDGER_ATTACH_TOLERANCE_MM),
  );
  // Detached (or filtering removed everything): keep full perimeter set.
  return free.length >= 2 ? free : unique;
}

export function createCoverSupports(
  outline: PointMm[],
  buildings: Building[] = [],
  idForIndex: (i: number, p: PointMm) => string = (i) => `sup_${i}`,
): CoverSupport[] {
  return layoutCoverSupportPositions(outline, buildings).map((position, i) => ({
    id: idForIndex(i, position),
    position,
    postSizeMm: COVER_POST_SIZE_MM,
    footingSizeMm: COVER_FOOTING_SIZE_MM,
  }));
}

export function coverSupportPostSizeMm(s: CoverSupport): number {
  return s.postSizeMm && s.postSizeMm > 0 ? s.postSizeMm : COVER_POST_SIZE_MM;
}

export function coverSupportFootingSizeMm(s: CoverSupport): number {
  return s.footingSizeMm && s.footingSizeMm > 0
    ? s.footingSizeMm
    : COVER_FOOTING_SIZE_MM;
}
