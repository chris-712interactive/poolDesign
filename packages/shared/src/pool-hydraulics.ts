/**
 * Main pool filtration hydraulics — turnover, pipe velocity, pump/filter sizing.
 *
 * Residential ISPSC/APSP practice targets roughly a 6–8 hour turnover for
 * private pools (we default to 6 h). Pipe velocity targets mirror Genesis /
 * ISPSC guidance used for the infinity-edge module.
 */

import type { DesignDocument, PoolBody } from "./design-model";
import { waterBodyKind, polylineLengthMm } from "./design-model";
import { waterVolumeGal } from "./depth-profile";
import {
  EDGE_PUMP_MARGIN,
  PVC_HW_C,
  RETURN_VELOCITY_FPS,
  SUCTION_VELOCITY_FPS,
  hazenWilliamsHeadFt,
  pipeVelocityFps,
  recommendPipeIdIn,
} from "./infinity-hydraulics";
import { MM_PER_FOOT } from "./units";

/** Residential private-pool turnover target (hours). */
export const DEFAULT_TURNOVER_HOURS = 6;

/** Cartridge filter loading (GPM per ft² of media) — typical manufacturer. */
export const CARTRIDGE_GPM_PER_SF = 1.0;

/** Minimum filter area (ft²). */
export const MIN_FILTER_SF = 100;

export type PoolHydraulics = {
  volumeGal: number;
  turnoverHours: number;
  filtrationGpm: number;
  designPumpGpm: number;
  recommendedFilterSf: number;
  suctionPipeIdIn: number;
  returnPipeIdIn: number;
  suctionVelocityFps: number;
  returnVelocityFps: number;
  estimatedTdhFt: number;
  staticLiftFt: number;
  frictionHeadFt: number;
  pipeRunFt: number;
  suctionPipeLf: number;
  returnPipeLf: number;
  velocityOk: boolean;
  methodNotes: string[];
};

function bodyPlumbingLf(
  design: DesignDocument | undefined,
  bodyId: string,
): { suctionLf: number; returnLf: number } {
  const runs = (design?.plumbingRuns ?? []).filter(
    (r) => r.parentBodyId === bodyId,
  );
  let suctionLf = 0;
  let returnLf = 0;
  for (const r of runs) {
    const lf = polylineLengthMm(r.points) / MM_PER_FOOT;
    if (r.circuit === "suction") suctionLf += lf;
    else if (r.circuit === "return") returnLf += lf;
  }
  return { suctionLf, returnLf };
}

/**
 * Filtration hydraulics for one pool (or spa) body.
 */
export function computePoolHydraulics(
  body: PoolBody,
  design?: DesignDocument,
  opts?: { turnoverHours?: number; staticLiftFt?: number },
): PoolHydraulics | null {
  if (body.outline.length < 3) return null;

  const volumeGal = waterVolumeGal(body);
  if (volumeGal < 50) return null;

  const turnoverHours =
    opts?.turnoverHours != null &&
    Number.isFinite(opts.turnoverHours) &&
    opts.turnoverHours > 0
      ? opts.turnoverHours
      : DEFAULT_TURNOVER_HOURS;

  const filtrationGpm = volumeGal / (turnoverHours * 60);
  const designPumpGpm = Math.ceil(filtrationGpm * EDGE_PUMP_MARGIN);
  const recommendedFilterSf = Math.max(
    MIN_FILTER_SF,
    Math.ceil(filtrationGpm / CARTRIDGE_GPM_PER_SF),
  );

  const { suctionLf, returnLf } = bodyPlumbingLf(design, body.id);
  const pipeRunFt = Math.max(40, suctionLf + returnLf);

  const suctionPipeIdIn = recommendPipeIdIn(
    designPumpGpm,
    SUCTION_VELOCITY_FPS,
  );
  const returnPipeIdIn = recommendPipeIdIn(
    designPumpGpm,
    RETURN_VELOCITY_FPS,
  );

  const suctionLen = Math.max(suctionLf, pipeRunFt * 0.4);
  const returnLen = Math.max(returnLf, pipeRunFt * 0.6);
  const frictionStraight =
    hazenWilliamsHeadFt({
      flowGpm: designPumpGpm,
      lengthFt: suctionLen,
      diameterIn: suctionPipeIdIn,
      c: PVC_HW_C,
    }) +
    hazenWilliamsHeadFt({
      flowGpm: designPumpGpm,
      lengthFt: returnLen,
      diameterIn: returnPipeIdIn,
      c: PVC_HW_C,
    });
  const frictionHeadFt = frictionStraight * 1.5;
  const staticLiftFt =
    opts?.staticLiftFt != null && Number.isFinite(opts.staticLiftFt)
      ? Math.max(0, opts.staticLiftFt)
      : waterBodyKind(body) === "spa"
        ? 3
        : 2;
  const estimatedTdhFt = staticLiftFt + frictionHeadFt;

  const suctionVelocityFps = pipeVelocityFps(designPumpGpm, suctionPipeIdIn);
  const returnVelocityFps = pipeVelocityFps(designPumpGpm, returnPipeIdIn);
  const velocityOk =
    suctionVelocityFps <= SUCTION_VELOCITY_FPS + 0.05 &&
    returnVelocityFps <= RETURN_VELOCITY_FPS + 0.05;

  return {
    volumeGal: Math.round(volumeGal),
    turnoverHours,
    filtrationGpm: Math.round(filtrationGpm * 10) / 10,
    designPumpGpm,
    recommendedFilterSf,
    suctionPipeIdIn,
    returnPipeIdIn,
    suctionVelocityFps: Math.round(suctionVelocityFps * 100) / 100,
    returnVelocityFps: Math.round(returnVelocityFps * 100) / 100,
    estimatedTdhFt: Math.round(estimatedTdhFt * 10) / 10,
    staticLiftFt: Math.round(staticLiftFt * 10) / 10,
    frictionHeadFt: Math.round(frictionHeadFt * 10) / 10,
    pipeRunFt: Math.round(pipeRunFt * 10) / 10,
    suctionPipeLf: Math.round(suctionLf * 10) / 10,
    returnPipeLf: Math.round(returnLf * 10) / 10,
    velocityOk,
    methodNotes: [
      `Volume ≈ ${Math.round(volumeGal)} gal from depth-profile grid`,
      `Filtration GPM = volume ÷ (${turnoverHours} h × 60) for residential turnover`,
      `Pump ≥ ${designPumpGpm} GPM @ ~${(staticLiftFt + frictionHeadFt).toFixed(1)} ft TDH (Hazen–Williams C=${PVC_HW_C})`,
      `Cartridge filter ≥ ${recommendedFilterSf} ft² @ ${CARTRIDGE_GPM_PER_SF} GPM/ft²`,
      `Pipe targets: suction ≤ ${SUCTION_VELOCITY_FPS} fps, return ≤ ${RETURN_VELOCITY_FPS} fps`,
      `Verify on manufacturer pump/filter curves; PE stamp for commercial / AHJ`,
    ],
  };
}

/** Aggregate hydraulics across all pools (and spas) on a design. */
export function computeDesignHydraulics(design: DesignDocument): {
  bodies: Array<{ body: PoolBody; hydro: PoolHydraulics }>;
  totalVolumeGal: number;
  totalFiltrationGpm: number;
} {
  const bodies: Array<{ body: PoolBody; hydro: PoolHydraulics }> = [];
  let totalVolumeGal = 0;
  let totalFiltrationGpm = 0;
  for (const body of design.poolBodies) {
    const hydro = computePoolHydraulics(body, design);
    if (!hydro) continue;
    bodies.push({ body, hydro });
    totalVolumeGal += hydro.volumeGal;
    totalFiltrationGpm += hydro.filtrationGpm;
  }
  return {
    bodies,
    totalVolumeGal: Math.round(totalVolumeGal),
    totalFiltrationGpm: Math.round(totalFiltrationGpm * 10) / 10,
  };
}
