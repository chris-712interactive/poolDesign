/**
 * Infinity-edge hydraulic sizing — PE-oriented water-in-transit design.
 *
 * Methods (industry / civil references used by watershape engineers):
 * - Weir flow: Francis formula (James B. Francis), watershape form
 *   q = 36·L·h^1.5 − 0.3·n·h^2.5  (GPM; L ft; h inches; n end contractions)
 *   See Gutai / Peterson, WaterShapes “Over the Edge” (2006).
 * - Surge / catch basin: ≥ 2″ of main-pool surface area (Skip Phillips /
 *   Steve Gutai water-in-transit protocol) plus trough operating volume check.
 * - Plumbing: target velocities (Genesis) — suction ≤ 4.5 fps, return ≤ 6.5 fps.
 * - Friction: Hazen–Williams for Schedule-40 PVC (C = 150).
 *
 * This gets as close as software can to stamped PE practice for a typical
 * residential vanishing-edge layout, but it is still a design aid: a licensed
 * PE must verify site elevations, edge tolerance, fittings, and pump curves.
 */

import {
  polygonAreaMm2,
  type InfinityEdgeStyle,
  type PoolBody,
  waterBodyKind,
} from "./design-model";
import { MM_PER_FOOT, MM_PER_INCH } from "./units";
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

/** CFS → GPM. */
export const GPM_PER_CFS = 448.831;

/** Hazen–Williams C for new Schedule-40 PVC. */
export const PVC_HW_C = 150;

/**
 * Design nappe (head over crest) defaults by visual style (inches).
 * Sheet ≈ classic vanishing edge; scuppers need more head through openings;
 * sheer aims for a thicker unbroken curtain.
 */
export const DEFAULT_DESIGN_HEAD_IN: Record<InfinityEdgeStyle, number> = {
  sheet: 0.25,
  scuppers: 0.5,
  sheer: 1.0,
};

/** Skip Phillips / Gutai recommended surge: 2″ of pool surface. */
export const DEFAULT_SURGE_DISPLACEMENT_IN = 2;

/** Genesis vanishing-edge suction velocity target (fps). */
export const SUCTION_VELOCITY_FPS = 4.5;

/** Genesis vanishing-edge return velocity target (fps). */
export const RETURN_VELOCITY_FPS = 6.5;

/** Contingency on design flow for pump selection (Francis ≈2% + system). */
export const EDGE_PUMP_MARGIN = 1.1;

/** Nominal PVC IDs (inches) considered for auto pipe pick. */
export const PVC_NOMINAL_IDS_IN = [1.5, 2, 2.5, 3, 4, 6] as const;

/** @deprecated Prefer Francis design head; kept for older call sites. */
export const GPM_PER_LF_BY_STYLE: Record<InfinityEdgeStyle, number> = {
  sheet: 4.5,
  scuppers: 8,
  sheer: 16,
};

/** @deprecated Surge is now 2″ of surface (see DEFAULT_SURGE_DISPLACEMENT_IN). */
export const SURGE_GAL_PER_SF =
  (DEFAULT_SURGE_DISPLACEMENT_IN / 12) * GAL_PER_CU_FT;

/** Soft floor when surface surge is tiny (gal). */
export const MIN_SURGE_GAL = 300;

export type InfinityHydraulics = {
  weirLf: number;
  /** Design nappe over the crest (inches). */
  designHeadIn: number;
  /** End contractions used in Francis (0 = suppressed, 2 = vanishing). */
  endContractions: number;
  /** Francis weir flow (GPM). */
  edgeFlowGpm: number;
  /** Francis flow per linear foot (GPM/lf). */
  gpmPerLf: number;
  /** Flow used for pump / pipe sizing (override or Francis). */
  designFlowGpm: number;
  /** Catch trough operating volume from geometry (gal). */
  troughVolumeGal: number;
  /** Gross trough shell capacity to full depth (gal). */
  troughShellCapacityGal: number;
  /** Surge demand from N″ of pool surface (gal). */
  displacementSurgeGal: number;
  /** Authorable / default surge displacement (inches). */
  surgeDisplacementIn: number;
  /**
   * Recommended net surge / collection capacity (gal).
   * max(surface surge, trough operating vol, MIN_SURGE_GAL) unless overridden.
   */
  recommendedSurgeGal: number;
  /** True when trough operating volume is below recommended surge. */
  troughShortfall: boolean;
  /** Gallons short if troughShortfall. */
  troughShortfallGal: number;
  /** Recommended edge/return pump capacity (GPM). */
  edgePumpGpm: number;
  /** Estimated total dynamic head (ft of water). */
  estimatedTdhFt: number;
  /** Static lift component of TDH (ft). */
  staticLiftFt: number;
  /** Friction + fittings component of TDH (ft). */
  frictionHeadFt: number;
  /** Recommended suction pipe nominal ID (in). */
  suctionPipeIdIn: number;
  /** Recommended return pipe nominal ID (in). */
  returnPipeIdIn: number;
  /** Velocity in recommended suction pipe at design flow (fps). */
  suctionVelocityFps: number;
  /** Velocity in recommended return pipe at design flow (fps). */
  returnVelocityFps: number;
  /** Assumed / authorable pipe run used for friction (ft). */
  pipeRunFt: number;
  poolSurfaceSf: number;
  style: InfinityEdgeStyle;
  flowOverridden: boolean;
  surgeOverridden: boolean;
  /** Human-readable method notes for the inspector. */
  methodNotes: string[];
};

function mmToLf(mm: number): number {
  return mm / MM_PER_FOOT;
}

function mmToIn(mm: number): number {
  return mm / MM_PER_INCH;
}

function poolSurfaceSf(pool: PoolBody): number {
  const wall = poolWallThicknessMm(pool);
  const inside = insideOutlineFromOutside(pool.outline, wall);
  const areaMm2 = polygonAreaMm2(inside.length >= 3 ? inside : pool.outline);
  return areaMm2 / (MM_PER_FOOT * MM_PER_FOOT);
}

/**
 * Francis weir formula (watershape units).
 * q = 36·L·h^1.5 − 0.3·n·h^2.5
 */
export function francisWeirGpm(
  lengthFt: number,
  headIn: number,
  endContractions = 2,
): number {
  const L = Math.max(0, lengthFt);
  const h = Math.max(0, headIn);
  const n = Math.max(0, endContractions);
  if (L <= 0 || h <= 0) return 0;
  const q = 36 * L * h ** 1.5 - 0.3 * n * h ** 2.5;
  return Math.max(0, q);
}

/** Gallons for `inches` of water over `surfaceSf`. */
export function surfaceDisplacementGal(
  surfaceSf: number,
  inches: number,
): number {
  return Math.max(0, surfaceSf) * (Math.max(0, inches) / 12) * GAL_PER_CU_FT;
}

/**
 * Hazen–Williams friction loss for PVC (ft of head).
 * hf = 0.2083 · (100/C)^1.852 · L · Q^1.852 / d^4.8655
 */
export function hazenWilliamsHeadFt(opts: {
  flowGpm: number;
  lengthFt: number;
  diameterIn: number;
  c?: number;
}): number {
  const Q = Math.max(0, opts.flowGpm);
  const L = Math.max(0, opts.lengthFt);
  const d = Math.max(0.1, opts.diameterIn);
  const C = opts.c ?? PVC_HW_C;
  if (Q <= 0 || L <= 0) return 0;
  return (
    0.2083 * (100 / C) ** 1.852 * L * Q ** 1.852 / d ** 4.8655
  );
}

/** Flow velocity in a circular pipe (fps). Q_gpm, d_inches. */
export function pipeVelocityFps(flowGpm: number, diameterIn: number): number {
  const d = Math.max(0.1, diameterIn);
  const areaFt2 = Math.PI * (d / 24) ** 2;
  const cfs = Math.max(0, flowGpm) / GPM_PER_CFS;
  return cfs / areaFt2;
}

/** Smallest nominal PVC ID that keeps velocity ≤ maxFps at flowGpm. */
export function recommendPipeIdIn(
  flowGpm: number,
  maxVelocityFps: number,
  candidates: readonly number[] = PVC_NOMINAL_IDS_IN,
): number {
  for (const d of candidates) {
    if (pipeVelocityFps(flowGpm, d) <= maxVelocityFps + 1e-6) return d;
  }
  return candidates[candidates.length - 1];
}

export function defaultDesignHeadIn(
  style: InfinityEdgeStyle,
  overrideIn?: number,
): number {
  if (overrideIn != null && Number.isFinite(overrideIn) && overrideIn > 0) {
    return overrideIn;
  }
  return DEFAULT_DESIGN_HEAD_IN[style];
}

/**
 * Francis flow for resolved weirs. Scuppers sum per-opening weirs (each n=2);
 * sheet/sheer treat the full span as one weir.
 */
export function francisFlowForEdges(
  edges: ResolvedInfinityEdge[],
  headIn: number,
  style: InfinityEdgeStyle,
  endContractions: number,
): { totalGpm: number; weirLf: number } {
  let weirLf = 0;
  let totalGpm = 0;
  for (const e of edges) {
    const lf = mmToLf(e.widthMm);
    weirLf += lf;
    if (style === "scuppers" && e.openings.length > 1) {
      for (const o of e.openings) {
        const openLf = mmToLf(
          Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y),
        );
        totalGpm += francisWeirGpm(openLf, headIn, 2);
      }
    } else {
      totalGpm += francisWeirGpm(lf, headIn, endContractions);
    }
  }
  return { totalGpm, weirLf };
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
  const headIn = defaultDesignHeadIn(style, cfg.designHeadIn);
  const endContractions =
    cfg.endContractions === 0
      ? 0
      : cfg.endContractions != null && Number.isFinite(cfg.endContractions)
        ? Math.max(0, Math.round(cfg.endContractions))
        : 2;

  const trough = defaultInfinityTrough(cfg.trough);
  let troughVolumeGal = 0;
  let troughShellCapacityGal = 0;
  for (const e of resolved) {
    const lf = mmToLf(e.widthMm);
    const troughWFt = mmToLf(e.troughWidthMm);
    troughVolumeGal +=
      lf * troughWFt * mmToLf(e.troughWaterDepthMm) * GAL_PER_CU_FT;
    troughShellCapacityGal +=
      lf * troughWFt * mmToLf(e.troughDepthMm) * GAL_PER_CU_FT;
  }
  if (!Number.isFinite(troughVolumeGal) || troughVolumeGal < 0) {
    const { weirLf: lf } = francisFlowForEdges(
      resolved,
      headIn,
      style,
      endContractions,
    );
    troughVolumeGal =
      lf * mmToLf(trough.widthMm) * mmToLf(trough.waterDepthMm) * GAL_PER_CU_FT;
    troughShellCapacityGal =
      lf * mmToLf(trough.widthMm) * mmToLf(trough.depthMm) * GAL_PER_CU_FT;
  }

  const { totalGpm: calculatedFlowGpm, weirLf } = francisFlowForEdges(
    resolved,
    headIn,
    style,
    endContractions,
  );
  const gpmPerLf = weirLf > 0 ? calculatedFlowGpm / weirLf : 0;

  const flowOverridden =
    cfg.flowGpmOverride != null &&
    Number.isFinite(cfg.flowGpmOverride) &&
    cfg.flowGpmOverride > 0;
  const designFlowGpm = flowOverridden
    ? (cfg.flowGpmOverride as number)
    : calculatedFlowGpm;

  const surfaceSf = poolSurfaceSf(pool);
  const surgeDisplacementIn =
    cfg.surgeDisplacementIn != null &&
    Number.isFinite(cfg.surgeDisplacementIn) &&
    cfg.surgeDisplacementIn > 0
      ? cfg.surgeDisplacementIn
      : DEFAULT_SURGE_DISPLACEMENT_IN;
  const displacementSurgeGal = surfaceDisplacementGal(
    surfaceSf,
    surgeDisplacementIn,
  );

  const surgeOverridden =
    cfg.surgeGalOverride != null &&
    Number.isFinite(cfg.surgeGalOverride) &&
    cfg.surgeGalOverride > 0;
  const recommendedSurgeGal = surgeOverridden
    ? (cfg.surgeGalOverride as number)
    : Math.max(troughVolumeGal, displacementSurgeGal, MIN_SURGE_GAL);

  const troughShortfallGal = Math.max(
    0,
    recommendedSurgeGal - troughVolumeGal,
  );
  const troughShortfall = troughShortfallGal > 1;

  const designFlowGpmRounded = round1(designFlowGpm);
  const edgePumpGpm = Math.ceil(designFlowGpmRounded * EDGE_PUMP_MARGIN);

  // Static lift: trough operating water surface → pool waterline.
  // Default ≈ freeboard in trough + weir above trough water.
  const defaultStaticLiftMm =
    Math.max(50, trough.depthMm - trough.waterDepthMm) + 150;
  const staticLiftMm =
    cfg.staticLiftMm != null &&
    Number.isFinite(cfg.staticLiftMm) &&
    cfg.staticLiftMm >= 0
      ? cfg.staticLiftMm
      : defaultStaticLiftMm;
  const staticLiftFt = mmToLf(staticLiftMm);

  const pipeRunFt =
    cfg.pipeRunMm != null &&
    Number.isFinite(cfg.pipeRunMm) &&
    cfg.pipeRunMm > 0
      ? mmToLf(cfg.pipeRunMm)
      : 60;

  const suctionPipeIdIn =
    cfg.suctionPipeIdIn != null &&
    Number.isFinite(cfg.suctionPipeIdIn) &&
    cfg.suctionPipeIdIn > 0
      ? cfg.suctionPipeIdIn
      : recommendPipeIdIn(designFlowGpm, SUCTION_VELOCITY_FPS);
  const returnPipeIdIn =
    cfg.returnPipeIdIn != null &&
    Number.isFinite(cfg.returnPipeIdIn) &&
    cfg.returnPipeIdIn > 0
      ? cfg.returnPipeIdIn
      : recommendPipeIdIn(designFlowGpm, RETURN_VELOCITY_FPS);

  // Split run: ~40% suction, ~60% return; fittings ≈ 50% of straight friction.
  const suctionLen = pipeRunFt * 0.4;
  const returnLen = pipeRunFt * 0.6;
  const frictionStraight =
    hazenWilliamsHeadFt({
      flowGpm: designFlowGpm,
      lengthFt: suctionLen,
      diameterIn: suctionPipeIdIn,
    }) +
    hazenWilliamsHeadFt({
      flowGpm: designFlowGpm,
      lengthFt: returnLen,
      diameterIn: returnPipeIdIn,
    });
  const frictionHeadFt = frictionStraight * 1.5;
  const estimatedTdhFt = staticLiftFt + frictionHeadFt;

  const suctionVelocityFps = pipeVelocityFps(designFlowGpm, suctionPipeIdIn);
  const returnVelocityFps = pipeVelocityFps(designFlowGpm, returnPipeIdIn);

  const methodNotes = [
    `Francis weir: q = 36·L·h^1.5 − 0.3·n·h^2.5 (L=${weirLf.toFixed(1)} ft, h=${headIn}" , n=${endContractions})`,
    `Surge protocol: ${surgeDisplacementIn}″ × pool surface (${surfaceSf.toFixed(0)} sf) per Phillips/Gutai water-in-transit`,
    `Pipe targets: suction ≤ ${SUCTION_VELOCITY_FPS} fps, return ≤ ${RETURN_VELOCITY_FPS} fps (Genesis)`,
    `TDH ≈ static ${staticLiftFt.toFixed(1)} ft + friction/fittings ${frictionHeadFt.toFixed(1)} ft (Hazen–Williams C=${PVC_HW_C})`,
    `Pump select ≥ ${edgePumpGpm} GPM @ ~${estimatedTdhFt.toFixed(1)} ft TDH; verify on manufacturer curve`,
    `PE stamp still required for site elevations, edge tolerance (±1/8″), and final fittings schedule`,
  ];

  return {
    weirLf: round2(weirLf),
    designHeadIn: round3(headIn),
    endContractions,
    edgeFlowGpm: round1(calculatedFlowGpm),
    gpmPerLf: round2(gpmPerLf),
    designFlowGpm: designFlowGpmRounded,
    troughVolumeGal: round1(troughVolumeGal),
    troughShellCapacityGal: round1(troughShellCapacityGal),
    displacementSurgeGal: round1(displacementSurgeGal),
    surgeDisplacementIn: round2(surgeDisplacementIn),
    recommendedSurgeGal: round1(recommendedSurgeGal),
    troughShortfall,
    troughShortfallGal: round1(troughShortfallGal),
    edgePumpGpm,
    estimatedTdhFt: round1(estimatedTdhFt),
    staticLiftFt: round1(staticLiftFt),
    frictionHeadFt: round1(frictionHeadFt),
    suctionPipeIdIn,
    returnPipeIdIn,
    suctionVelocityFps: round2(suctionVelocityFps),
    returnVelocityFps: round2(returnVelocityFps),
    pipeRunFt: round1(pipeRunFt),
    poolSurfaceSf: round1(surfaceSf),
    style,
    flowOverridden,
    surgeOverridden,
    methodNotes,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Total trough LF for takeoff (sum of enabled weir widths). */
export function infinityTroughLf(pool: PoolBody): number {
  const edges = resolveInfinityEdges(pool);
  if (!edges.length) return 0;
  return edges.reduce((sum, e) => sum + mmToLf(e.widthMm), 0);
}
