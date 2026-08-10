/**
 * Spa → pool spillover weir resolution.
 * Defaults on when a spa shares a wall with a pool; authorable via SpaSpillover.
 */

import {
  pointInPolygon,
  segmentLengthMm,
  type PointMm,
  type PoolBody,
  type SpaSpillover,
  type SpaSpilloverStyle,
  type SpaSpilloverWeir,
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
/** Probe distance outside the spa shell to test "faces pool". */
const FACE_PROBE_MM = 80;

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

/** Unit outward normal for a spa edge (points away from spa interior). */
function spaEdgeOutwardNormal(
  edgeA: PointMm,
  edgeB: PointMm,
  spaRing: PointMm[],
): { nx: number; ny: number; ux: number; uy: number; len: number } {
  const len = segmentLengthMm(edgeA, edgeB) || 1;
  const ux = (edgeB.x - edgeA.x) / len;
  const uy = (edgeB.y - edgeA.y) / len;
  let nx = -uy;
  let ny = ux;
  const mid = {
    x: (edgeA.x + edgeB.x) / 2,
    y: (edgeA.y + edgeB.y) / 2,
  };
  const inward = {
    x: mid.x - nx * (FACE_PROBE_MM * 0.5),
    y: mid.y - ny * (FACE_PROBE_MM * 0.5),
  };
  if (!pointInPolygon(inward, spaRing)) {
    nx = -nx;
    ny = -ny;
  }
  return { nx, ny, ux, uy, len };
}

/**
 * Interval along a spa edge that intersects the pool: faces into pool water,
 * lies inside the pool footprint, or is colinear with a pool edge.
 * Returns the span from the first to last intersecting sample on that edge.
 */
function spaEdgePoolIntersectInterval(
  edgeA: PointMm,
  edgeB: PointMm,
  spaRing: PointMm[],
  poolOutline: PointMm[],
): [number, number] | null {
  const { nx, ny, ux, uy, len } = spaEdgeOutwardNormal(edgeA, edgeB, spaRing);
  if (len < MIN_OVERLAP_MM) return null;

  const n = Math.max(12, Math.ceil(len / 50));
  let tMin = Infinity;
  let tMax = -Infinity;
  let hits = 0;

  for (let s = 0; s <= n; s++) {
    const t = (s / n) * len;
    const p = { x: edgeA.x + ux * t, y: edgeA.y + uy * t };
    const probeOut = {
      x: p.x + nx * FACE_PROBE_MM,
      y: p.y + ny * FACE_PROBE_MM,
    };
    const intersects =
      pointInPolygon(probeOut, poolOutline) || pointInPolygon(p, poolOutline);
    if (intersects) {
      hits += 1;
      tMin = Math.min(tMin, t);
      tMax = Math.max(tMax, t);
    }
  }

  // Need a meaningful run (not a single corner sample).
  if (hits < 2 || !Number.isFinite(tMin) || tMax - tMin < MIN_OVERLAP_MM) {
    return null;
  }
  // Pad slightly toward edge ends so short sampling doesn't shrink the weir.
  const pad = len / n;
  return [Math.max(0, tMin - pad), Math.min(len, tMax + pad)];
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

    // 1) Classic: spa edge colinear with a pool outline edge (touching join).
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

    // 2) Any spa edge that intersects / faces the pool (inset & overlapping joins).
    const face = spaEdgePoolIntersectInterval(
      edgeA,
      edgeB,
      spaRing,
      pool.outline,
    );
    if (face && (!best || face[1] - face[0] > best[1] - best[0])) {
      best = face;
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

/**
 * All spillover edge candidates for a spa against the given pools.
 * Every spa outline edge that intersects a pool is included (sorted longest first).
 */
export function listSpaSpilloverEdges(
  spa: PoolBody,
  pools: PoolBody[],
): SharedSpilloverEdge[] {
  const attached = pools.filter(
    (p) =>
      waterBodyKind(p) === "pool" &&
      waterBodiesConnected(spa.outline, p.outline),
  );
  const byKey = new Map<string, SharedSpilloverEdge>();
  for (const pool of attached) {
    for (const edge of sharedSpilloverEdges(spa.outline, pool)) {
      const key = `${edge.poolId}:${edge.edgeIndex}`;
      const prev = byKey.get(key);
      if (!prev || edge.overlapLenMm > prev.overlapLenMm) {
        byKey.set(key, edge);
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.overlapLenMm - a.overlapLenMm);
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

/** Project a plan point onto an edge; returns distance along edge from edgeA (mm). */
export function projectPointToEdgeTMm(
  edgeA: PointMm,
  edgeB: PointMm,
  point: PointMm,
): number {
  const len = segmentLengthMm(edgeA, edgeB) || 1;
  const ux = (edgeB.x - edgeA.x) / len;
  const uy = (edgeB.y - edgeA.y) / len;
  return (point.x - edgeA.x) * ux + (point.y - edgeA.y) * uy;
}

/** Convert a weir span [t0,t1] on an overlap into width + offset from overlap mid. */
export function weirParamsFromSpan(
  overlapT0: number,
  overlapT1: number,
  t0: number,
  t1: number,
): { widthMm: number; offsetMm: number } {
  const lo = Math.min(t0, t1);
  const hi = Math.max(t0, t1);
  const mid = (overlapT0 + overlapT1) / 2;
  const widthMm = Math.max(50, hi - lo);
  const center = (lo + hi) / 2;
  return { widthMm, offsetMm: center - mid };
}

function clampWeirSpan(
  overlapT0: number,
  overlapT1: number,
  widthMm: number,
  offsetMm: number,
): { t0: number; t1: number } | null {
  const mid = (overlapT0 + overlapT1) / 2;
  const width = Math.min(overlapT1 - overlapT0, Math.max(50, widthMm));
  let t0 = mid + offsetMm - width / 2;
  let t1 = mid + offsetMm + width / 2;
  if (t0 < overlapT0) {
    const d = overlapT0 - t0;
    t0 += d;
    t1 += d;
  }
  if (t1 > overlapT1) {
    const d = t1 - overlapT1;
    t0 -= d;
    t1 -= d;
  }
  t0 = Math.max(overlapT0, t0);
  t1 = Math.min(overlapT1, t1);
  if (t1 - t0 < 50) return null;
  return { t0, t1 };
}

function resolveOneWeir(
  spa: PoolBody,
  edge: SharedSpilloverEdge,
  weir: { widthMm?: number; offsetMm?: number },
  cfg: SpaSpillover | undefined,
): ResolvedSpaSpillover | null {
  const widthRaw =
    weir.widthMm != null && Number.isFinite(weir.widthMm)
      ? weir.widthMm
      : defaultWidthMm(edge.overlapLenMm);
  const offsetMm =
    weir.offsetMm != null && Number.isFinite(weir.offsetMm) ? weir.offsetMm : 0;
  const span = clampWeirSpan(
    edge.overlapT0,
    edge.overlapT1,
    widthRaw,
    offsetMm,
  );
  if (!span) return null;

  const a = edgePoint(edge.edgeA, edge.edgeB, span.t0);
  const b = edgePoint(edge.edgeA, edge.edgeB, span.t1);
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
    widthMm: span.t1 - span.t0,
    notchDepthMm,
    openings,
    overlapT0: edge.overlapT0,
    overlapT1: edge.overlapT1,
  };
}

/**
 * Active weir configs for a spa: explicit `weirs[]`, else legacy single-edge
 * fields, else one default weir per pool-intersecting edge.
 */
export function spilloverWeirConfigs(
  spa: PoolBody,
  candidates: SharedSpilloverEdge[],
): { edgeIndex: number; enabled: boolean; widthMm?: number; offsetMm?: number }[] {
  const cfg = spa.spillover;
  if (cfg?.weirs?.length) {
    return cfg.weirs.map((w) => ({
      edgeIndex: w.edgeIndex,
      enabled: w.enabled !== false,
      widthMm: w.widthMm,
      offsetMm: w.offsetMm,
    }));
  }
  if (cfg?.edgeIndex != null) {
    return [
      {
        edgeIndex: cfg.edgeIndex,
        enabled: true,
        widthMm: cfg.widthMm,
        offsetMm: cfg.offsetMm,
      },
    ];
  }
  // Default: every intersecting edge is an editable weir.
  return candidates.map((c) => ({
    edgeIndex: c.edgeIndex,
    enabled: true,
  }));
}

/**
 * Resolve all active spa→pool weirs (one per enabled pool-facing edge).
 */
export function resolveSpaSpillovers(
  spa: PoolBody,
  pools: PoolBody[],
): ResolvedSpaSpillover[] {
  if (waterBodyKind(spa) !== "spa") return [];
  const cfg = spa.spillover;
  if (cfg?.enabled === false) return [];

  let edges = listSpaSpilloverEdges(spa, pools);
  if (!edges.length) return [];

  if (cfg?.targetPoolId) {
    const filtered = edges.filter((e) => e.poolId === cfg.targetPoolId);
    if (filtered.length) edges = filtered;
  }

  const weirs = spilloverWeirConfigs(spa, edges);
  const out: ResolvedSpaSpillover[] = [];
  for (const w of weirs) {
    if (w.enabled === false) continue;
    const edge = edges.find((e) => e.edgeIndex === w.edgeIndex);
    if (!edge) continue;
    const resolved = resolveOneWeir(spa, edge, w, cfg);
    if (resolved) out.push(resolved);
  }
  return out;
}

/**
 * Resolve authorable spillover into a concrete weir + openings.
 * @deprecated Prefer {@link resolveSpaSpillovers}; returns the longest weir.
 */
export function resolveSpaSpillover(
  spa: PoolBody,
  pools: PoolBody[],
): ResolvedSpaSpillover | null {
  const all = resolveSpaSpillovers(spa, pools);
  if (!all.length) return null;
  return all.reduce((best, r) => (r.widthMm > best.widthMm ? r : best), all[0]);
}

/** Patch one weir on a spa spillover config (creates weirs[] from defaults). */
export function patchSpaSpilloverWeir(
  spa: PoolBody,
  pools: PoolBody[],
  edgeIndex: number,
  patch: Partial<SpaSpilloverWeir>,
): SpaSpillover {
  const candidates = listSpaSpilloverEdges(spa, pools);
  const base = spilloverWeirConfigs(spa, candidates);
  const nextWeirs = candidates.map((c) => {
    const prev = base.find((w) => w.edgeIndex === c.edgeIndex);
    const row: SpaSpilloverWeir = {
      edgeIndex: c.edgeIndex,
      enabled: prev?.enabled !== false,
      widthMm: prev?.widthMm,
      offsetMm: prev?.offsetMm,
    };
    if (c.edgeIndex === edgeIndex) {
      return { ...row, ...patch, edgeIndex };
    }
    return row;
  });
  // Include an edge that isn't currently a candidate only if explicitly patched
  if (!candidates.some((c) => c.edgeIndex === edgeIndex)) {
    nextWeirs.push({
      edgeIndex,
      enabled: true,
      ...patch,
    });
  }
  const prev = spa.spillover ?? { enabled: true };
  return {
    ...prev,
    enabled: prev.enabled !== false,
    weirs: nextWeirs,
    // Clear legacy single-edge fields once weirs are authoritative
    edgeIndex: undefined,
    widthMm: undefined,
    offsetMm: undefined,
  };
}

/**
 * Update weir span from a dragged endpoint or body slide.
 * `handle`: which end is dragged, or "body" to slide keeping width.
 */
export function spilloverWeirFromDrag(
  candidate: SharedSpilloverEdge,
  current: ResolvedSpaSpillover,
  handle: "start" | "end" | "body",
  point: PointMm,
): { widthMm: number; offsetMm: number } {
  const t = projectPointToEdgeTMm(candidate.edgeA, candidate.edgeB, point);
  const curT0 = projectPointToEdgeTMm(candidate.edgeA, candidate.edgeB, current.a);
  const curT1 = projectPointToEdgeTMm(candidate.edgeA, candidate.edgeB, current.b);
  let t0 = Math.min(curT0, curT1);
  let t1 = Math.max(curT0, curT1);
  const width = t1 - t0;

  if (handle === "start") {
    t0 = Math.min(t, t1 - 50);
  } else if (handle === "end") {
    t1 = Math.max(t, t0 + 50);
  } else {
    const center = t;
    t0 = center - width / 2;
    t1 = center + width / 2;
  }

  const clamped = clampWeirSpan(
    candidate.overlapT0,
    candidate.overlapT1,
    t1 - t0,
    (t0 + t1) / 2 - (candidate.overlapT0 + candidate.overlapT1) / 2,
  );
  if (!clamped) {
    return weirParamsFromSpan(
      candidate.overlapT0,
      candidate.overlapT1,
      curT0,
      curT1,
    );
  }
  return weirParamsFromSpan(
    candidate.overlapT0,
    candidate.overlapT1,
    clamped.t0,
    clamped.t1,
  );
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
