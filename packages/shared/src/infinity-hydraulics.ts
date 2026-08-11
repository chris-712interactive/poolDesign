/**
 * Infinity-edge hydraulic sizing: edge flow, trough volume, surge, edge pump.
 *
 * Rule-of-thumb design aids for vanishing-edge pools — not a substitute for
 * a PE hydraulic design. Constants are named so they can be tuned later.
 */

import {
  polygonAreaMm2,
  type InfinityEdgeStyle,
  type PoolBody,
  waterBodyKind,
} from "./design-model";
import { MM_PER_FOOT } from "./units";
import {
  insideOutlineFromOutside,
  poolWallThicknessMm,
} from "./spa-defaults";
import {
  defaultInfinityTrough,
  resolveInfinityEdges,
  type ResolvedInfinityEdge,
} from "./infinity-edge";

/** Gallons of water in 1 cubic foot. */
export const GAL_PER_CU_FT = 7.48052;

/** Design flow over the weir (GPM per linear foot of weir). */
export const GPM_PER_LF_BY_STYLE: Record<InfinityEdgeStyle, number> = {
  sheet: 10,
  scuppers: 8,
  sheer: 16,
};

/** Extra pump capacity above calculated edge flow. */
export const EDGE_PUMP_MARGIN = 1.15;

/**
 * Displacement surge ≈ 1″ of pool surface (gal/sf of waterline area).
 * 1 sf × 1/12 ft × 7.48052 ≈ 0.623 gal.
 */
export const SURGE_GAL_PER_SF = GAL_PER_CU_FT / 12;

/** Floor on recommended surge capacity (gal). */
export const MIN_SURGE_GAL = 300;

export type InfinityHydraulics = {
  /** Total enabled weir length (ft). */
  weirLf: number;
  /** Calculated edge overflow flow (GPM). */
  edgeFlowGpm: number;
  /** Flow used for pump sizing (override or calculated). */
  designFlowGpm: number;
  /** Catch trough operating volume from geometry (gal). */
  troughVolumeGal: number;
  /** Displacement surge from ~1″ of pool surface (gal). */
  displacementSurgeGal: number;
  /** Recommended surge / collection capacity (gal). */
  recommendedSurgeGal: number;
  /** Recommended edge/return pump capacity (GPM). */
  edgePumpGpm: number;
  /** Pool inside waterline area (sf). */
  poolSurfaceSf: number;
  /** Style used for GPM/lf. */
  style: InfinityEdgeStyle;
  /** Whether flow used an author override. */
  flowOverridden: boolean;
  /** Whether surge used an author override. */
  surgeOverridden: boolean;
};

function mmToLf(mm: number): number {
  return mm / MM_PER_FOOT;
}

function poolSurfaceSf(pool: PoolBody): number {
  const wall = poolWallThicknessMm(pool);
  const inside = insideOutlineFromOutside(pool.outline, wall);
  const areaMm2 = polygonAreaMm2(inside.length >= 3 ? inside : pool.outline);
  return areaMm2 / (MM_PER_FOOT * MM_PER_FOOT);
}

/**
 * Size infinity-edge hydraulics from resolved weirs + trough + pool area.
 */
export function computeInfinityHydraulics(
  pool: PoolBody,
  edges?: ResolvedInfinityEdge[],
): InfinityHydraulics | null {
  if (waterBodyKind(pool) !== "pool") return null;
  const cfg = pool.infinityEdge;
  if (!cfg || cfg.enabled !== true) return null;

  const resolved = edges ?? resolveInfinityEdges(pool);
  if (!resolved.length) return null;

  const style: InfinityEdgeStyle =
    cfg.style === "scuppers" || cfg.style === "sheer" ? cfg.style : "sheet";
  const gpmPerLf = GPM_PER_LF_BY_STYLE[style];

  let weirLf = 0;
  let troughVolumeGal = 0;
  for (const e of resolved) {
    const lf = mmToLf(e.widthMm);
    weirLf += lf;
    const troughWFt = mmToLf(e.troughWidthMm);
    const waterDFt = mmToLf(e.troughWaterDepthMm);
    troughVolumeGal += lf * troughWFt * waterDFt * GAL_PER_CU_FT;
  }

  // If trough dims are only on cfg (no resolved yet), still allow surface surge.
  if (!Number.isFinite(troughVolumeGal) || troughVolumeGal < 0) {
    const t = defaultInfinityTrough(cfg.trough);
    troughVolumeGal =
      weirLf * mmToLf(t.widthMm) * mmToLf(t.waterDepthMm) * GAL_PER_CU_FT;
  }

  const calculatedFlowGpm = weirLf * gpmPerLf;
  const flowOverridden =
    cfg.flowGpmOverride != null &&
    Number.isFinite(cfg.flowGpmOverride) &&
    cfg.flowGpmOverride > 0;
  const designFlowGpm = flowOverridden
    ? (cfg.flowGpmOverride as number)
    : calculatedFlowGpm;

  const surfaceSf = poolSurfaceSf(pool);
  const displacementSurgeGal = surfaceSf * SURGE_GAL_PER_SF;

  const surgeOverridden =
    cfg.surgeGalOverride != null &&
    Number.isFinite(cfg.surgeGalOverride) &&
    cfg.surgeGalOverride > 0;
  const recommendedSurgeGal = surgeOverridden
    ? (cfg.surgeGalOverride as number)
    : Math.max(troughVolumeGal, displacementSurgeGal, MIN_SURGE_GAL);

  const edgePumpGpm = Math.ceil(designFlowGpm * EDGE_PUMP_MARGIN);

  return {
    weirLf: round1(weirLf),
    edgeFlowGpm: round1(calculatedFlowGpm),
    designFlowGpm: round1(designFlowGpm),
    troughVolumeGal: round1(troughVolumeGal),
    displacementSurgeGal: round1(displacementSurgeGal),
    recommendedSurgeGal: round1(recommendedSurgeGal),
    edgePumpGpm,
    poolSurfaceSf: round1(surfaceSf),
    style,
    flowOverridden,
    surgeOverridden,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Total trough LF for takeoff (sum of enabled weir widths). */
export function infinityTroughLf(pool: PoolBody): number {
  const edges = resolveInfinityEdges(pool);
  if (!edges.length) return 0;
  return edges.reduce((sum, e) => sum + mmToLf(e.widthMm), 0);
}
