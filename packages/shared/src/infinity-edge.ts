/**
 * Pool infinity / vanishing edge resolution.
 * Authorable per outline edge; spills outward into a catch trough.
 */

import {
  pointInPolygon,
  segmentLengthMm,
  type InfinityEdge,
  type InfinityEdgeStyle,
  type InfinityEdgeWeir,
  type InfinityTrough,
  type PointMm,
  type PoolBody,
  waterBodyKind,
} from "./design-model";
import { openRing } from "./water-geometry";
import {
  projectPointToEdgeTMm,
  splitScupperOpenings,
  weirParamsFromSpan,
} from "./spa-spillover";

const IN = 25.4;
const MIN_EDGE_MM = 24 * IN;
const DEFAULT_NOTCH_MM = 1.5 * IN;
const DEFAULT_SCUPPER_COUNT = 3;
const DEFAULT_SCUPPER_GAP_MM = 4 * IN;
const DEFAULT_WIDTH_FRAC = 1;
const MIN_WEIR_WIDTH_MM = 24 * IN;
const DEFAULT_TROUGH_WIDTH_MM = 24 * IN;
const DEFAULT_TROUGH_DEPTH_MM = 30 * IN;
const DEFAULT_TROUGH_WATER_DEPTH_MM = 18 * IN;
const FACE_PROBE_MM = 80;

export type InfinityEdgeCandidate = {
  edgeIndex: number;
  edgeA: PointMm;
  edgeB: PointMm;
  edgeLenMm: number;
  /** Unit outward normal (away from pool interior). */
  nx: number;
  ny: number;
};

export type InfinityOpening = {
  a: PointMm;
  b: PointMm;
};

export type ResolvedInfinityEdge = {
  poolId: string;
  edgeIndex: number;
  style: InfinityEdgeStyle;
  /** Full pool-outline edge this weir sits on. */
  edgeA: PointMm;
  edgeB: PointMm;
  a: PointMm;
  b: PointMm;
  widthMm: number;
  notchDepthMm: number;
  openings: InfinityOpening[];
  /** Full edge span used for clamping (0…edgeLen). */
  overlapT0: number;
  overlapT1: number;
  /** Outward unit normal. */
  nx: number;
  ny: number;
  /** Outer trough face endpoints (plan), offset by trough width. */
  troughOuterA: PointMm;
  troughOuterB: PointMm;
  troughWidthMm: number;
  troughDepthMm: number;
  troughWaterDepthMm: number;
};

export function defaultInfinityTrough(
  trough?: InfinityTrough,
): Required<InfinityTrough> {
  return {
    widthMm:
      trough?.widthMm != null && Number.isFinite(trough.widthMm)
        ? Math.max(100, trough.widthMm)
        : DEFAULT_TROUGH_WIDTH_MM,
    depthMm:
      trough?.depthMm != null && Number.isFinite(trough.depthMm)
        ? Math.max(150, trough.depthMm)
        : DEFAULT_TROUGH_DEPTH_MM,
    waterDepthMm:
      trough?.waterDepthMm != null && Number.isFinite(trough.waterDepthMm)
        ? Math.max(50, trough.waterDepthMm)
        : DEFAULT_TROUGH_WATER_DEPTH_MM,
  };
}

function edgePoint(a: PointMm, b: PointMm, tMm: number): PointMm {
  const len = segmentLengthMm(a, b) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return { x: a.x + ux * tMm, y: a.y + uy * tMm };
}

/** Unit outward normal for a pool outline edge. */
export function poolEdgeOutwardNormal(
  edgeA: PointMm,
  edgeB: PointMm,
  poolRing: PointMm[],
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
  if (!pointInPolygon(inward, poolRing)) {
    nx = -nx;
    ny = -ny;
  }
  return { nx, ny, ux, uy, len };
}

/**
 * All outline edges long enough to host a vanishing weir.
 */
export function listInfinityEdgeCandidates(
  pool: PoolBody,
): InfinityEdgeCandidate[] {
  if (waterBodyKind(pool) !== "pool") return [];
  const ring = openRing(pool.outline);
  if (ring.length < 3) return [];

  const out: InfinityEdgeCandidate[] = [];
  for (let i = 0; i < ring.length; i++) {
    const edgeA = ring[i];
    const edgeB = ring[(i + 1) % ring.length];
    const { nx, ny, len } = poolEdgeOutwardNormal(edgeA, edgeB, ring);
    if (len < MIN_EDGE_MM) continue;
    out.push({
      edgeIndex: i,
      edgeA,
      edgeB,
      edgeLenMm: len,
      nx,
      ny,
    });
  }
  return out;
}

function defaultWidthMm(edgeLenMm: number): number {
  return Math.min(
    edgeLenMm,
    Math.max(MIN_WEIR_WIDTH_MM, edgeLenMm * DEFAULT_WIDTH_FRAC),
  );
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

/**
 * Active weir configs: explicit weirs[], else none enabled (user must opt in).
 */
export function infinityWeirConfigs(
  pool: PoolBody,
  candidates: InfinityEdgeCandidate[],
): {
  edgeIndex: number;
  enabled: boolean;
  widthMm?: number;
  offsetMm?: number;
}[] {
  const cfg = pool.infinityEdge;
  if (cfg?.weirs?.length) {
    return cfg.weirs.map((w) => ({
      edgeIndex: w.edgeIndex,
      enabled: w.enabled === true,
      widthMm: w.widthMm,
      offsetMm: w.offsetMm,
    }));
  }
  // Default: candidates listed but none spilling until the user enables some.
  return candidates.map((c) => ({
    edgeIndex: c.edgeIndex,
    enabled: false,
  }));
}

function resolveOneWeir(
  pool: PoolBody,
  edge: InfinityEdgeCandidate,
  weir: { widthMm?: number; offsetMm?: number },
  cfg: InfinityEdge | undefined,
): ResolvedInfinityEdge | null {
  const widthRaw =
    weir.widthMm != null && Number.isFinite(weir.widthMm)
      ? weir.widthMm
      : defaultWidthMm(edge.edgeLenMm);
  const offsetMm =
    weir.offsetMm != null && Number.isFinite(weir.offsetMm) ? weir.offsetMm : 0;
  const span = clampWeirSpan(0, edge.edgeLenMm, widthRaw, offsetMm);
  if (!span) return null;

  const a = edgePoint(edge.edgeA, edge.edgeB, span.t0);
  const b = edgePoint(edge.edgeA, edge.edgeB, span.t1);
  const style: InfinityEdgeStyle =
    cfg?.style === "scuppers" || cfg?.style === "sheer" ? cfg.style : "sheet";
  const notchDepthMm = Math.max(
    5,
    cfg?.notchDepthMm != null && Number.isFinite(cfg.notchDepthMm)
      ? cfg.notchDepthMm
      : DEFAULT_NOTCH_MM,
  );
  const trough = defaultInfinityTrough(cfg?.trough);

  let openings: InfinityOpening[];
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
    poolId: pool.id,
    edgeIndex: edge.edgeIndex,
    style,
    edgeA: edge.edgeA,
    edgeB: edge.edgeB,
    a,
    b,
    widthMm: span.t1 - span.t0,
    notchDepthMm,
    openings,
    overlapT0: 0,
    overlapT1: edge.edgeLenMm,
    nx: edge.nx,
    ny: edge.ny,
    troughOuterA: {
      x: a.x + edge.nx * trough.widthMm,
      y: a.y + edge.ny * trough.widthMm,
    },
    troughOuterB: {
      x: b.x + edge.nx * trough.widthMm,
      y: b.y + edge.ny * trough.widthMm,
    },
    troughWidthMm: trough.widthMm,
    troughDepthMm: trough.depthMm,
    troughWaterDepthMm: trough.waterDepthMm,
  };
}

/**
 * Resolve all enabled infinity weirs for a pool.
 * Adjacent enabled weirs that share a corner are stretched to that vertex.
 */
export function resolveInfinityEdges(pool: PoolBody): ResolvedInfinityEdge[] {
  if (waterBodyKind(pool) !== "pool") return [];
  const cfg = pool.infinityEdge;
  if (!cfg || cfg.enabled !== true) return [];

  const candidates = listInfinityEdgeCandidates(pool);
  if (!candidates.length) return [];

  const weirs = infinityWeirConfigs(pool, candidates);
  const out: ResolvedInfinityEdge[] = [];
  for (const w of weirs) {
    if (w.enabled === false) continue;
    const edge = candidates.find((c) => c.edgeIndex === w.edgeIndex);
    if (!edge) continue;
    const resolved = resolveOneWeir(pool, edge, w, cfg);
    if (resolved) out.push(resolved);
  }
  return extendAdjacentWeirsToSharedCorners(pool, candidates, out, cfg);
}

function extendAdjacentWeirsToSharedCorners(
  pool: PoolBody,
  candidates: InfinityEdgeCandidate[],
  resolved: ResolvedInfinityEdge[],
  cfg: InfinityEdge | undefined,
): ResolvedInfinityEdge[] {
  if (resolved.length < 2) return resolved;

  const ring = openRing(pool.outline);
  const n = ring.length;
  if (n < 3) return resolved;

  const byEdge = new Map(candidates.map((c) => [c.edgeIndex, c]));
  const stretch = new Map<
    number,
    { toStart: boolean; toEnd: boolean; corner: PointMm }
  >();
  const flag = (
    idx: number,
    which: "toStart" | "toEnd",
    corner: PointMm,
  ) => {
    let f = stretch.get(idx);
    if (!f) {
      f = { toStart: false, toEnd: false, corner };
      stretch.set(idx, f);
    }
    f[which] = true;
    f.corner = corner;
  };

  for (let a = 0; a < resolved.length; a++) {
    for (let b = a + 1; b < resolved.length; b++) {
      const ra = resolved[a];
      const rb = resolved[b];
      if ((ra.edgeIndex + 1) % n === rb.edgeIndex) {
        flag(ra.edgeIndex, "toEnd", ring[rb.edgeIndex]);
        flag(rb.edgeIndex, "toStart", ring[rb.edgeIndex]);
      } else if ((rb.edgeIndex + 1) % n === ra.edgeIndex) {
        flag(rb.edgeIndex, "toEnd", ring[ra.edgeIndex]);
        flag(ra.edgeIndex, "toStart", ring[ra.edgeIndex]);
      }
    }
  }

  if (!stretch.size) return resolved;

  return resolved.map((r) => {
    const f = stretch.get(r.edgeIndex);
    if (!f || (!f.toStart && !f.toEnd)) return r;
    const edge = byEdge.get(r.edgeIndex);
    if (!edge) return r;

    const len = edge.edgeLenMm || 1;
    const ux = (edge.edgeB.x - edge.edgeA.x) / len;
    const uy = (edge.edgeB.y - edge.edgeA.y) / len;
    const proj = (p: PointMm) =>
      (p.x - edge.edgeA.x) * ux + (p.y - edge.edgeA.y) * uy;

    let t0 = Math.min(proj(r.a), proj(r.b));
    let t1 = Math.max(proj(r.a), proj(r.b));
    const tCorner = Math.max(0, Math.min(len, proj(f.corner)));
    if (f.toStart) t0 = Math.min(t0, tCorner, 0);
    if (f.toEnd) t1 = Math.max(t1, tCorner, len);
    t0 = Math.max(0, Math.min(t0, len - 50));
    t1 = Math.min(len, Math.max(t1, t0 + 50));
    if (t1 - t0 < 50) return r;

    const params = weirParamsFromSpan(0, len, t0, t1);
    return resolveOneWeir(pool, edge, params, cfg) ?? r;
  });
}

/** Longest resolved weir (convenience for simple readouts). */
export function resolveInfinityEdge(
  pool: PoolBody,
): ResolvedInfinityEdge | null {
  const all = resolveInfinityEdges(pool);
  if (!all.length) return null;
  return all.reduce((best, r) => (r.widthMm > best.widthMm ? r : best), all[0]);
}

/** Patch one weir on a pool infinity-edge config. */
export function patchInfinityEdgeWeir(
  pool: PoolBody,
  edgeIndex: number,
  patch: Partial<InfinityEdgeWeir>,
): InfinityEdge {
  const candidates = listInfinityEdgeCandidates(pool);
  const base = infinityWeirConfigs(pool, candidates);
  const nextWeirs = candidates.map((c) => {
    const prev = base.find((w) => w.edgeIndex === c.edgeIndex);
    const row: InfinityEdgeWeir = {
      edgeIndex: c.edgeIndex,
      enabled: prev?.enabled === true,
      widthMm: prev?.widthMm,
      offsetMm: prev?.offsetMm,
    };
    if (c.edgeIndex === edgeIndex) {
      return { ...row, ...patch, edgeIndex };
    }
    return row;
  });
  if (!candidates.some((c) => c.edgeIndex === edgeIndex)) {
    nextWeirs.push({
      edgeIndex,
      enabled: true,
      ...patch,
    });
  }
  const prev = pool.infinityEdge ?? { enabled: true };
  return {
    ...prev,
    enabled: prev.enabled !== false,
    weirs: nextWeirs,
  };
}

/**
 * Update weir span from a dragged endpoint or body slide.
 */
export function infinityWeirFromDrag(
  candidate: InfinityEdgeCandidate,
  current: ResolvedInfinityEdge,
  handle: "start" | "end" | "body",
  point: PointMm,
): { widthMm: number; offsetMm: number } {
  const t = projectPointToEdgeTMm(candidate.edgeA, candidate.edgeB, point);
  const curT0 = projectPointToEdgeTMm(
    candidate.edgeA,
    candidate.edgeB,
    current.a,
  );
  const curT1 = projectPointToEdgeTMm(
    candidate.edgeA,
    candidate.edgeB,
    current.b,
  );
  let t0 = Math.min(curT0, curT1);
  let t1 = Math.max(curT0, curT1);
  const width = t1 - t0;

  if (handle === "start") {
    t0 = Math.min(t, t1 - 50);
  } else if (handle === "end") {
    t1 = Math.max(t, t0 + 50);
  } else {
    t0 = t - width / 2;
    t1 = t + width / 2;
  }

  const clamped = clampWeirSpan(
    0,
    candidate.edgeLenMm,
    Math.max(50, t1 - t0),
    (t0 + t1) / 2 - candidate.edgeLenMm / 2,
  );
  if (!clamped) {
    return weirParamsFromSpan(0, candidate.edgeLenMm, t0, t1);
  }
  return weirParamsFromSpan(
    0,
    candidate.edgeLenMm,
    clamped.t0,
    clamped.t1,
  );
}

/** Omit intervals (along pool edge) for each weir opening. */
export function infinityOmitIntervals(
  resolved: ResolvedInfinityEdge,
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

/** Outer trough face spanning the full pool edge (not just the 85% opening). */
export function infinityTroughOuterSpan(resolved: ResolvedInfinityEdge): {
  a: PointMm;
  b: PointMm;
} {
  const a = resolved.edgeA ?? resolved.a;
  const b = resolved.edgeB ?? resolved.b;
  return {
    a: {
      x: a.x + resolved.nx * resolved.troughWidthMm,
      y: a.y + resolved.ny * resolved.troughWidthMm,
    },
    b: {
      x: b.x + resolved.nx * resolved.troughWidthMm,
      y: b.y + resolved.ny * resolved.troughWidthMm,
    },
  };
}

/** Plan polygon for one trough (weir face → outer face), corner to corner. */
export function infinityTroughPolygon(
  resolved: ResolvedInfinityEdge,
): PointMm[] {
  const a = resolved.edgeA ?? resolved.a;
  const b = resolved.edgeB ?? resolved.b;
  const outer = infinityTroughOuterSpan(resolved);
  return [a, b, outer.b, outer.a];
}

/**
 * Hole to punch deck/fill where the catch trough sits.
 * Width is the trough only (not the whole vanishing-side yard). A modest
 * along-pad clears side-deck returns; huge pads left leftover walls.
 */
export function infinityDeckCutPolygon(
  resolved: ResolvedInfinityEdge,
  insetMm = 40,
): PointMm[] {
  const inset = Math.max(40, Math.min(100, insetMm));
  const outPad = 40;
  const alongPad = 3000;
  const a0 = resolved.edgeA ?? resolved.a;
  const b0 = resolved.edgeB ?? resolved.b;
  const len = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
  const ux = (b0.x - a0.x) / len;
  const uy = (b0.y - a0.y) / len;
  const a = { x: a0.x - ux * alongPad, y: a0.y - uy * alongPad };
  const b = { x: b0.x + ux * alongPad, y: b0.y + uy * alongPad };
  return [
    {
      x: a.x - resolved.nx * inset,
      y: a.y - resolved.ny * inset,
    },
    {
      x: b.x - resolved.nx * inset,
      y: b.y - resolved.ny * inset,
    },
    {
      x: b.x + resolved.nx * (resolved.troughWidthMm + outPad),
      y: b.y + resolved.ny * (resolved.troughWidthMm + outPad),
    },
    {
      x: a.x + resolved.nx * (resolved.troughWidthMm + outPad),
      y: a.y + resolved.ny * (resolved.troughWidthMm + outPad),
    },
  ];
}
