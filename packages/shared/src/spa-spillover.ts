/**
 * Spa → pool spillover weir resolution.
 * Defaults on when a spa shares a wall with a pool; authorable via SpaSpillover.
 */

import {
  segmentLengthMm,
  type PointMm,
  type PoolBody,
  type SpaSpillover,
  type SpaSpilloverStyle,
  waterBodyKind,
} from "./design-model";
import {
  colinearOverlapInterval,
  openRing,
  waterBodiesConnected,
} from "./water-geometry";

const IN = 25.4;
const MIN_OVERLAP_MM = 100;
const DEFAULT_NOTCH_MM = 1.5 * IN;
const DEFAULT_SCUPPER_COUNT = 3;
const DEFAULT_SCUPPER_GAP_MM = 4 * IN;
const DEFAULT_WIDTH_FRAC = 0.6;
const MIN_WEIR_WIDTH_MM = 24 * IN;

export type SharedSpilloverEdge = {
  poolId: string;
  edgeIndex: number;
  edgeA: PointMm;
  edgeB: PointMm;
  /** Overlap start along spa edge (mm from edgeA) */
  overlapT0: number;
  /** Overlap end along spa edge (mm from edgeA) */
  overlapT1: number;
  overlapLenMm: number;
};

export type SpilloverOpening = {
  a: PointMm;
  b: PointMm;
};

export type ResolvedSpaSpillover = {
  spaId: string;
  poolId: string;
  edgeIndex: number;
  style: SpaSpilloverStyle;
  /** Full weir span along the spa edge */
  a: PointMm;
  b: PointMm;
  widthMm: number;
  notchDepthMm: number;
  /** Openings after style expansion (sheet/sheer = 1, scuppers = N) */
  openings: SpilloverOpening[];
  /** Shared overlap used for clamping */
  overlapT0: number;
  overlapT1: number;
};

function edgePoint(a: PointMm, b: PointMm, tMm: number): PointMm {
  const len = segmentLengthMm(a, b) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return { x: a.x + ux * tMm, y: a.y + uy * tMm };
}

/** Candidate shared edges between a spa outline and a pool outline. */
export function sharedSpilloverEdges(
  spaOutline: PointMm[],
  pool: PoolBody,
  tolMm = 60,
): SharedSpilloverEdge[] {
  const spaRing = openRing(spaOutline);
  const poolRing = openRing(pool.outline);
  if (spaRing.length < 3 || poolRing.length < 3) return [];
  if (!waterBodiesConnected(spaOutline, pool.outline)) return [];

  const out: SharedSpilloverEdge[] = [];
  for (let i = 0; i < spaRing.length; i++) {
    const edgeA = spaRing[i];
    const edgeB = spaRing[(i + 1) % spaRing.length];
    const edgeLen = segmentLengthMm(edgeA, edgeB);
    if (edgeLen < MIN_OVERLAP_MM) continue;

    let best: [number, number] | null = null;
    for (let j = 0; j < poolRing.length; j++) {
      const iv = colinearOverlapInterval(
        edgeA,
        edgeB,
        poolRing[j],
        poolRing[(j + 1) % poolRing.length],
        tolMm,
      );
      if (!iv) continue;
      if (!best || iv[1] - iv[0] > best[1] - best[0]) best = iv;
    }
    if (!best) continue;
    const overlapLenMm = best[1] - best[0];
    if (overlapLenMm < MIN_OVERLAP_MM) continue;
    out.push({
      poolId: pool.id,
      edgeIndex: i,
      edgeA,
      edgeB,
      overlapT0: best[0],
      overlapT1: best[1],
      overlapLenMm,
    });
  }
  return out;
}

/** All spillover edge candidates for a spa against the given pools. */
export function listSpaSpilloverEdges(
  spa: PoolBody,
  pools: PoolBody[],
): SharedSpilloverEdge[] {
  const attached = pools.filter(
    (p) =>
      waterBodyKind(p) === "pool" &&
      waterBodiesConnected(spa.outline, p.outline),
  );
  const all: SharedSpilloverEdge[] = [];
  for (const pool of attached) {
    all.push(...sharedSpilloverEdges(spa.outline, pool));
  }
  all.sort((a, b) => b.overlapLenMm - a.overlapLenMm);
  return all;
}

/**
 * Split a weir span into scupper openings with clear gaps.
 * Falls back to a single opening if gaps don't fit.
 */
export function splitScupperOpenings(
  a: PointMm,
  b: PointMm,
  count: number,
  gapMm: number,
): SpilloverOpening[] {
  const n = Math.max(2, Math.min(8, Math.round(count)));
  const len = segmentLengthMm(a, b);
  if (len < 50) return [{ a, b }];
  const gaps = n - 1;
  const gap = Math.max(10, gapMm);
  const usable = len - gaps * gap;
  if (usable < n * 40) {
    // Too tight — single sheet fallback
    return [{ a, b }];
  }
  const openingW = usable / n;
  const out: SpilloverOpening[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    const t0 = cursor;
    const t1 = cursor + openingW;
    out.push({
      a: edgePoint(a, b, t0),
      b: edgePoint(a, b, t1),
    });
    cursor = t1 + (i < n - 1 ? gap : 0);
  }
  return out;
}

function defaultWidthMm(overlapLenMm: number): number {
  return Math.min(
    overlapLenMm,
    Math.max(MIN_WEIR_WIDTH_MM, overlapLenMm * DEFAULT_WIDTH_FRAC),
  );
}

/**
 * Resolve authorable spillover into a concrete weir + openings.
 * Returns null when disabled or the spa does not join any pool.
 * When `spillover` is omitted, defaults to enabled on the longest shared edge.
 */
export function resolveSpaSpillover(
  spa: PoolBody,
  pools: PoolBody[],
): ResolvedSpaSpillover | null {
  if (waterBodyKind(spa) !== "spa") return null;
  const cfg: SpaSpillover | undefined = spa.spillover;
  if (cfg?.enabled === false) return null;

  let edges = listSpaSpilloverEdges(spa, pools);
  if (!edges.length) return null;

  if (cfg?.targetPoolId) {
    const filtered = edges.filter((e) => e.poolId === cfg.targetPoolId);
    if (filtered.length) edges = filtered;
  }

  let edge =
    cfg?.edgeIndex != null
      ? edges.find((e) => e.edgeIndex === cfg.edgeIndex)
      : undefined;
  if (!edge) edge = edges[0];

  const mid = (edge.overlapT0 + edge.overlapT1) / 2;
  const widthRaw =
    cfg?.widthMm != null && Number.isFinite(cfg.widthMm)
      ? cfg.widthMm
      : defaultWidthMm(edge.overlapLenMm);
  const widthMm = Math.min(
    edge.overlapLenMm,
    Math.max(50, widthRaw),
  );
  const offsetMm =
    cfg?.offsetMm != null && Number.isFinite(cfg.offsetMm) ? cfg.offsetMm : 0;

  let t0 = mid + offsetMm - widthMm / 2;
  let t1 = mid + offsetMm + widthMm / 2;
  if (t0 < edge.overlapT0) {
    const d = edge.overlapT0 - t0;
    t0 += d;
    t1 += d;
  }
  if (t1 > edge.overlapT1) {
    const d = t1 - edge.overlapT1;
    t0 -= d;
    t1 -= d;
  }
  t0 = Math.max(edge.overlapT0, t0);
  t1 = Math.min(edge.overlapT1, t1);
  if (t1 - t0 < 50) return null;

  const a = edgePoint(edge.edgeA, edge.edgeB, t0);
  const b = edgePoint(edge.edgeA, edge.edgeB, t1);
  const style: SpaSpilloverStyle =
    cfg?.style === "scuppers" || cfg?.style === "sheer" ? cfg.style : "sheet";
  const notchDepthMm = Math.max(
    5,
    cfg?.notchDepthMm != null && Number.isFinite(cfg.notchDepthMm)
      ? cfg.notchDepthMm
      : DEFAULT_NOTCH_MM,
  );

  let openings: SpilloverOpening[];
  if (style === "scuppers") {
    openings = splitScupperOpenings(
      a,
      b,
      cfg?.scupperCount ?? DEFAULT_SCUPPER_COUNT,
      cfg?.scupperGapMm ?? DEFAULT_SCUPPER_GAP_MM,
    );
  } else {
    openings = [{ a, b }];
  }

  return {
    spaId: spa.id,
    poolId: edge.poolId,
    edgeIndex: edge.edgeIndex,
    style,
    a,
    b,
    widthMm: t1 - t0,
    notchDepthMm,
    openings,
    overlapT0: edge.overlapT0,
    overlapT1: edge.overlapT1,
  };
}

/**
 * Wall keep-segments after omitting intervals along an edge (mm from edgeA).
 * Used to notch the upper spa wall course for the weir.
 */
export function wallSegmentsMinusIntervals(
  edgeA: PointMm,
  edgeB: PointMm,
  omit: [number, number][],
  minKeepMm = 40,
): { a: PointMm; b: PointMm }[] {
  const len = segmentLengthMm(edgeA, edgeB);
  if (len < minKeepMm) return [];
  if (!omit.length) return [{ a: edgeA, b: edgeB }];

  const ux = (edgeB.x - edgeA.x) / len;
  const uy = (edgeB.y - edgeA.y) / len;
  const covered = omit
    .map(([t0, t1]) => {
      const lo = Math.max(0, Math.min(t0, t1));
      const hi = Math.min(len, Math.max(t0, t1));
      return [lo, hi] as [number, number];
    })
    .filter(([lo, hi]) => hi - lo > 1)
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const iv of covered) {
    const last = merged[merged.length - 1];
    if (!last || iv[0] > last[1] + 1) merged.push([iv[0], iv[1]]);
    else last[1] = Math.max(last[1], iv[1]);
  }

  const keep: { a: PointMm; b: PointMm }[] = [];
  let cursor = 0;
  for (const [c0, c1] of merged) {
    if (c0 - cursor >= minKeepMm) {
      keep.push({
        a: { x: edgeA.x + ux * cursor, y: edgeA.y + uy * cursor },
        b: { x: edgeA.x + ux * c0, y: edgeA.y + uy * c0 },
      });
    }
    cursor = c1;
  }
  if (len - cursor >= minKeepMm) {
    keep.push({
      a: { x: edgeA.x + ux * cursor, y: edgeA.y + uy * cursor },
      b: { x: edgeB.x, y: edgeB.y },
    });
  }
  return keep;
}

/** Omit intervals (along spa edge) for each weir opening. */
export function spilloverOmitIntervals(
  resolved: ResolvedSpaSpillover,
  edgeA: PointMm,
  edgeB: PointMm,
): [number, number][] {
  const len = segmentLengthMm(edgeA, edgeB) || 1;
  const ux = (edgeB.x - edgeA.x) / len;
  const uy = (edgeB.y - edgeA.y) / len;
  const proj = (p: PointMm) => (p.x - edgeA.x) * ux + (p.y - edgeA.y) * uy;
  return resolved.openings.map((o) => {
    const t0 = proj(o.a);
    const t1 = proj(o.b);
    return [Math.min(t0, t1), Math.max(t0, t1)] as [number, number];
  });
}
