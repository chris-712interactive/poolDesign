import type { CatalogUnit } from "./catalog";
import type { DesignDocument, PointMm, PoolBody } from "./design-model";
import {
  approximateIntersectionAreaMm2,
  exposedWaterPerimeterMm,
  fenceBillableLengthMm,
  polygonAreaMm2,
  polygonPerimeterMm,
  polylineLengthMm,
  segmentLengthMm,
  sharedBoundaryLengthMm,
} from "./design-model";
import { getPlaceableItem, isBubblerId } from "./object-library";
import { isPadEquipmentId } from "./plumbing-route";
import { getPatioFinish, type PatioFinishCategory } from "./patio-finishes";
import {
  analyzeDesignGrade,
  totalFillCy,
  totalRetainingLf,
} from "./site-grade";
import {
  poolWallThicknessMm,
  spaShellHeightMm,
  spaWallThicknessMm,
} from "./spa-defaults";
import { insetClosedOutline } from "./scene3d";
import {
  excavationVolumeCy,
  maxDepthMmFromProfile,
  waterVolumeGal,
  wetInteriorSurfaceMm2,
} from "./depth-profile";
import { infinityTroughLf } from "./infinity-hydraulics";
import { resolveInfinityEdges } from "./infinity-edge";
import { mmToInches } from "./units";

const MM2_PER_SF = 92903.04;
const MM_PER_LF = 304.8;
const POST_FOOTINGS_PER_COVER = 4;

function mm2ToSf(mm2: number): number {
  return mm2 / MM2_PER_SF;
}

function mmToLf(mm: number): number {
  return mm / MM_PER_LF;
}

function longestEdgeMm(outline: PointMm[]): number {
  if (outline.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < outline.length; i++) {
    max = Math.max(
      max,
      segmentLengthMm(outline[i], outline[(i + 1) % outline.length]),
    );
  }
  return max;
}

function patioNetAreaMm2(patioOutline: PointMm[], holes: PointMm[][]): number {
  const gross = polygonAreaMm2(patioOutline);
  let punched = 0;
  for (const hole of holes) {
    punched += approximateIntersectionAreaMm2(patioOutline, hole);
  }
  return Math.max(0, gross - punched);
}

export type QuantitySourceDef = {
  id: string;
  label: string;
  group: string;
  unit: CatalogUnit;
  hint?: string;
};

/**
 * Named plan quantities a company recipe can bind to.
 * Values are always imperial catalog units (sf, lf, cy, gal, ea, hr, lb).
 */
export const QUANTITY_SOURCES: QuantitySourceDef[] = [
  {
    id: "manual",
    label: "Manual quantity",
    group: "Job",
    unit: "ea",
    hint: "Not from the plan — enter the quantity on the line",
  },
  {
    id: "gunite_shell_sf",
    label: "Gunite shell (floor + walls)",
    group: "Pool & spa",
    unit: "sf",
  },
  {
    id: "excavation_cy",
    label: "Excavation",
    group: "Pool & spa",
    unit: "cy",
  },
  {
    id: "water_volume_gal",
    label: "Water volume",
    group: "Pool & spa",
    unit: "gal",
  },
  {
    id: "pool_water_sf",
    label: "Pool water surface",
    group: "Pool & spa",
    unit: "sf",
  },
  {
    id: "spa_water_sf",
    label: "Spa water surface",
    group: "Pool & spa",
    unit: "sf",
  },
  {
    id: "pool_wet_sf",
    label: "Pool wet interior (floor + walls)",
    group: "Pool & spa",
    unit: "sf",
  },
  {
    id: "spa_wet_sf",
    label: "Spa wet interior (floor + walls)",
    group: "Pool & spa",
    unit: "sf",
  },
  {
    id: "exposed_water_perimeter_lf",
    label: "Exposed pool/spa perimeter",
    group: "Pool & spa",
    unit: "lf",
    hint: "Shared pool↔spa walls deducted — coping, waterline, bond beam",
  },
  {
    id: "spa_outside_perimeter_lf",
    label: "Spa outside perimeter",
    group: "Pool & spa",
    unit: "lf",
  },
  { id: "pool_count", label: "Pool count", group: "Pool & spa", unit: "ea" },
  { id: "spa_count", label: "Spa count", group: "Pool & spa", unit: "ea" },
  {
    id: "body_count",
    label: "Pool + spa count",
    group: "Pool & spa",
    unit: "ea",
  },
  {
    id: "bench_longest_lf",
    label: "Bench longest side",
    group: "Features",
    unit: "lf",
  },
  {
    id: "bench_perimeter_lf",
    label: "Bench / spa seat perimeter",
    group: "Features",
    unit: "lf",
    hint: "Full outline of each bench — typical seat-tile takeoff",
  },
  { id: "steps_count", label: "Steps assemblies", group: "Features", unit: "ea" },
  {
    id: "sunshelf_sf",
    label: "Sunshelf / tanning ledge",
    group: "Features",
    unit: "sf",
  },
  {
    id: "patio_gross_sf",
    label: "Patio gross area (including water)",
    group: "Patio",
    unit: "sf",
  },
  {
    id: "patio_paving_net_sf",
    label: "Patio paving (net of water holes)",
    group: "Patio",
    unit: "sf",
  },
  {
    id: "patio_paver_sf",
    label: "Paver paving (net)",
    group: "Patio",
    unit: "sf",
  },
  {
    id: "patio_concrete_sf",
    label: "Concrete paving (net)",
    group: "Patio",
    unit: "sf",
  },
  {
    id: "patio_stone_sf",
    label: "Stone paving (net)",
    group: "Patio",
    unit: "sf",
  },
  {
    id: "patio_perimeter_lf",
    label: "Patio perimeter",
    group: "Patio",
    unit: "lf",
  },
  { id: "patio_fill_cy", label: "Patio fill", group: "Patio", unit: "cy" },
  {
    id: "retaining_lf",
    label: "Retaining length",
    group: "Patio",
    unit: "lf",
  },
  {
    id: "plumbing_lf",
    label: "All plumbing",
    group: "Plumbing",
    unit: "lf",
  },
  {
    id: "plumbing_suction_lf",
    label: "Suction plumbing",
    group: "Plumbing",
    unit: "lf",
  },
  {
    id: "plumbing_return_lf",
    label: "Return plumbing",
    group: "Plumbing",
    unit: "lf",
  },
  {
    id: "plumbing_gas_lf",
    label: "Gas plumbing",
    group: "Plumbing",
    unit: "lf",
  },
  { id: "fence_lf", label: "Fence total (less gates)", group: "Fence", unit: "lf" },
  { id: "fence_aluminum_lf", label: "Aluminum fence", group: "Fence", unit: "lf" },
  { id: "fence_wood_lf", label: "Wood fence", group: "Fence", unit: "lf" },
  { id: "fence_vinyl_lf", label: "Vinyl fence", group: "Fence", unit: "lf" },
  {
    id: "fence_wrought_iron_lf",
    label: "Wrought iron fence",
    group: "Fence",
    unit: "lf",
  },
  {
    id: "fence_chain_link_lf",
    label: "Chain link fence",
    group: "Fence",
    unit: "lf",
  },
  { id: "fence_glass_lf", label: "Glass fence", group: "Fence", unit: "lf" },
  { id: "gate_swing_count", label: "Swing gates", group: "Fence", unit: "ea" },
  {
    id: "gate_double_swing_count",
    label: "Double swing gates",
    group: "Fence",
    unit: "ea",
  },
  { id: "gate_sliding_count", label: "Sliding gates", group: "Fence", unit: "ea" },
  { id: "pergola_sf", label: "Pergola footprint", group: "Covers", unit: "sf" },
  {
    id: "patio_roof_sf",
    label: "Patio roof footprint",
    group: "Covers",
    unit: "sf",
  },
  {
    id: "cover_post_count",
    label: "Cover post footings",
    group: "Covers",
    unit: "ea",
  },
  {
    id: "infinity_trough_lf",
    label: "Infinity-edge trough",
    group: "Equipment",
    unit: "lf",
  },
  {
    id: "infinity_edge_pool_count",
    label: "Infinity-edge pools",
    group: "Equipment",
    unit: "ea",
  },
  {
    id: "residential_equip_kit_count",
    label: "Residential equipment kits",
    group: "Equipment",
    unit: "ea",
    hint: "One per pool/spa unless pad equipment is placed",
  },
  {
    id: "commercial_equip_kit_count",
    label: "Commercial filtration packages",
    group: "Equipment",
    unit: "ea",
  },
  {
    id: "bubbler_led_count",
    label: "Bubbler niche LEDs",
    group: "Equipment",
    unit: "ea",
  },
  {
    id: "labor_install_hr",
    label: "Install labor (PoolShape allowance)",
    group: "Labor",
    unit: "hr",
  },
];

const SOURCE_BY_ID = new Map(QUANTITY_SOURCES.map((s) => [s.id, s]));

export function quantitySourceById(id: string): QuantitySourceDef | undefined {
  return SOURCE_BY_ID.get(id);
}

function guniteShellMm2(design: DesignDocument): number {
  const pools = design.poolBodies.filter((p) => (p.kind ?? "pool") !== "spa");
  const spas = design.poolBodies.filter((p) => (p.kind ?? "pool") === "spa");
  let shellMm2 = 0;
  for (const pool of pools) {
    const depth = maxDepthMmFromProfile(pool);
    shellMm2 +=
      polygonAreaMm2(pool.outline) + polygonPerimeterMm(pool.outline) * depth;
  }
  for (const spa of spas) {
    const depth = maxDepthMmFromProfile(spa);
    const inside = insetClosedOutline(spa.outline, spaWallThicknessMm(spa));
    shellMm2 += polygonAreaMm2(inside) + polygonPerimeterMm(inside) * depth;
    const raise = spaShellHeightMm(spa);
    if (raise > 0) {
      shellMm2 += polygonPerimeterMm(spa.outline) * raise;
    }
  }
  for (const pool of pools) {
    for (const spa of spas) {
      const shared = sharedBoundaryLengthMm(pool.outline, spa.outline);
      if (shared <= 0) continue;
      shellMm2 -= shared * maxDepthMmFromProfile(pool);
      shellMm2 -= shared * maxDepthMmFromProfile(spa);
    }
  }
  return Math.max(0, shellMm2);
}

function wetSurfaces(design: DesignDocument): {
  poolWaterMm2: number;
  spaWaterMm2: number;
  poolWetMm2: number;
  spaWetMm2: number;
} {
  const pools = design.poolBodies.filter((p) => (p.kind ?? "pool") !== "spa");
  const spas = design.poolBodies.filter((p) => (p.kind ?? "pool") === "spa");
  const spaInsides: PointMm[][] = spas.map((p) =>
    insetClosedOutline(p.outline, spaWallThicknessMm(p)),
  );
  const poolInsides: PointMm[][] = pools.map((p) =>
    insetClosedOutline(p.outline, poolWallThicknessMm(p)),
  );
  let poolWaterMm2 = poolInsides.reduce(
    (sum, outline) => sum + polygonAreaMm2(outline),
    0,
  );
  const spaWaterMm2 = spaInsides.reduce(
    (sum, outline) => sum + polygonAreaMm2(outline),
    0,
  );
  let plasterOverlapMm2 = 0;
  for (const poolInside of poolInsides) {
    for (const spaInside of spaInsides) {
      plasterOverlapMm2 += approximateIntersectionAreaMm2(
        poolInside,
        spaInside,
      );
    }
  }
  if (plasterOverlapMm2 > 0) {
    poolWaterMm2 = Math.max(0, poolWaterMm2 - plasterOverlapMm2);
  }
  let poolWetMm2 = 0;
  for (const pool of pools) poolWetMm2 += wetInteriorSurfaceMm2(pool);
  let spaWetMm2 = 0;
  for (const spa of spas) spaWetMm2 += wetInteriorSurfaceMm2(spa);
  if (plasterOverlapMm2 > 0 && poolWaterMm2 + plasterOverlapMm2 > 0) {
    const origPoolWater = poolWaterMm2 + plasterOverlapMm2;
    const ratio = Math.min(1, plasterOverlapMm2 / origPoolWater);
    poolWetMm2 = Math.max(0, poolWetMm2 * (1 - ratio * 0.35));
  }
  return { poolWaterMm2, spaWaterMm2, poolWetMm2, spaWetMm2 };
}

function laborInstallHours(design: DesignDocument): number {
  const pools = design.poolBodies.filter((p) => (p.kind ?? "pool") !== "spa");
  const spas = design.poolBodies.filter((p) => (p.kind ?? "pool") === "spa");
  const wet = wetSurfaces(design);
  const waterPerimeterMm = exposedWaterPerimeterMm(
    design.poolBodies.map((p) => p.outline),
  );
  const spaFootingMm = spas.reduce(
    (sum, spa) => sum + polygonPerimeterMm(spa.outline),
    0,
  );
  const patioAreaMm2 = (design.patios ?? []).reduce(
    (sum, p) => sum + polygonAreaMm2(p.outline),
    0,
  );
  const pipeMm = (design.plumbingRuns ?? []).reduce(
    (sum, r) => sum + polylineLengthMm(r.points),
    0,
  );
  const coverPostCount = (design.patioCovers ?? []).reduce((sum, c) => {
    const n = (c.supports ?? []).length;
    return sum + (n > 0 ? n : POST_FOOTINGS_PER_COVER);
  }, 0);
  const fences = design.fences ?? [];
  let fenceLfTotal = 0;
  let gateCount = 0;
  for (const fence of fences) {
    fenceLfTotal += mmToLf(fenceBillableLengthMm(fence));
    gateCount += (fence.gates ?? []).length;
  }
  const features = design.features ?? [];
  const stepsCount = features.filter((f) => f.kind === "steps").length;
  const benchLf = features
    .filter((f) => f.kind === "bench")
    .reduce((sum, f) => sum + mmToLf(longestEdgeMm(f.outline)), 0);
  const sunshelfAreaMm2 = features
    .filter((f) => f.kind === "sunshelf")
    .reduce((sum, f) => sum + polygonAreaMm2(f.outline), 0);
  const billableObjectCount = (design.objects ?? []).filter((o) => {
    const item = getPlaceableItem(o.catalogItemId);
    if (!item) return false;
    if (item.category === "furniture" || item.category === "landscaping") {
      return false;
    }
    if (item.unitPriceCents <= 0 || o.catalogItemId === "person_scale") {
      return false;
    }
    return true;
  }).length;
  const bubblerLedCount = (design.objects ?? []).filter(
    (o) => isBubblerId(o.catalogItemId) && o.hasLedLight,
  ).length;
  const avgDepthIn =
    design.poolBodies.length === 0
      ? 0
      : design.poolBodies.reduce(
          (sum, p: PoolBody) =>
            sum + mmToInches((p.depthShallowMm + p.depthDeepMm) / 2),
          0,
        ) / design.poolBodies.length;
  const shellSf = mm2ToSf(guniteShellMm2(design));
  return (
    shellSf * 0.12 +
    mm2ToSf(wet.poolWaterMm2) * 0.08 +
    mm2ToSf(wet.spaWaterMm2) * 0.12 +
    mm2ToSf(patioAreaMm2) * 0.03 +
    mmToLf(pipeMm) * 0.15 +
    mmToLf(waterPerimeterMm) * 0.2 +
    mmToLf(spaFootingMm) * 0.15 +
    coverPostCount * 1.5 +
    fenceLfTotal * 0.35 +
    gateCount * 1.5 +
    pools.length * 24 +
    spas.length * 16 +
    avgDepthIn * 0.5 +
    billableObjectCount * 0.5 +
    bubblerLedCount * 0.35 +
    stepsCount * 4 +
    benchLf * 0.4 +
    mm2ToSf(sunshelfAreaMm2) * 0.15
  );
}

/** Imperial catalog-unit quantities keyed by QUANTITY_SOURCES id. */
export function collectPlanQuantities(
  design: DesignDocument,
): Record<string, number> {
  const pools = design.poolBodies.filter((p) => (p.kind ?? "pool") !== "spa");
  const spas = design.poolBodies.filter((p) => (p.kind ?? "pool") === "spa");
  const wet = wetSurfaces(design);
  const holes = design.poolBodies.map((b) => b.outline);
  const qty: Record<string, number> = {};

  qty.gunite_shell_sf = mm2ToSf(guniteShellMm2(design));
  let excavCy = 0;
  let totalGal = 0;
  for (const body of design.poolBodies) {
    excavCy += excavationVolumeCy(body);
    totalGal += waterVolumeGal(body);
  }
  qty.excavation_cy = excavCy;
  qty.water_volume_gal = totalGal;
  qty.pool_water_sf = mm2ToSf(wet.poolWaterMm2);
  qty.spa_water_sf = mm2ToSf(wet.spaWaterMm2);
  qty.pool_wet_sf = mm2ToSf(wet.poolWetMm2);
  qty.spa_wet_sf = mm2ToSf(wet.spaWetMm2);
  qty.exposed_water_perimeter_lf = mmToLf(
    exposedWaterPerimeterMm(design.poolBodies.map((p) => p.outline)),
  );
  qty.spa_outside_perimeter_lf = mmToLf(
    spas.reduce((sum, spa) => sum + polygonPerimeterMm(spa.outline), 0),
  );
  qty.pool_count = pools.length;
  qty.spa_count = spas.length;
  qty.body_count = design.poolBodies.length;

  const features = design.features ?? [];
  qty.bench_longest_lf = features
    .filter((f) => f.kind === "bench")
    .reduce((sum, f) => sum + mmToLf(longestEdgeMm(f.outline)), 0);
  qty.bench_perimeter_lf = features
    .filter((f) => f.kind === "bench")
    .reduce((sum, f) => sum + mmToLf(polygonPerimeterMm(f.outline)), 0);
  qty.steps_count = features.filter((f) => f.kind === "steps").length;
  qty.sunshelf_sf = mm2ToSf(
    features
      .filter((f) => f.kind === "sunshelf")
      .reduce((sum, f) => sum + polygonAreaMm2(f.outline), 0),
  );

  let patioGross = 0;
  let patioNet = 0;
  let patioPerimeter = 0;
  const patioByFinish: Record<PatioFinishCategory, number> = {
    concrete: 0,
    paver: 0,
    stone: 0,
  };
  for (const patio of design.patios ?? []) {
    patioGross += polygonAreaMm2(patio.outline);
    const net = patioNetAreaMm2(patio.outline, holes);
    patioNet += net;
    patioPerimeter += polygonPerimeterMm(patio.outline);
    patioByFinish[getPatioFinish(patio.materialId).category] += net;
  }
  qty.patio_gross_sf = mm2ToSf(patioGross);
  qty.patio_paving_net_sf = mm2ToSf(patioNet);
  qty.patio_paver_sf = mm2ToSf(patioByFinish.paver);
  qty.patio_concrete_sf = mm2ToSf(patioByFinish.concrete);
  qty.patio_stone_sf = mm2ToSf(patioByFinish.stone);
  qty.patio_perimeter_lf = mmToLf(patioPerimeter);

  const gradeAnalyses = analyzeDesignGrade(
    design.patios ?? [],
    design.gradeSamples ?? [],
    design.gradeOptions,
  );
  qty.patio_fill_cy = totalFillCy(gradeAnalyses);
  qty.retaining_lf = totalRetainingLf(gradeAnalyses);

  let pipeAll = 0;
  let pipeSuction = 0;
  let pipeReturn = 0;
  let pipeGas = 0;
  for (const run of design.plumbingRuns ?? []) {
    const len = polylineLengthMm(run.points);
    pipeAll += len;
    if (run.circuit === "suction") pipeSuction += len;
    else if (run.circuit === "return") pipeReturn += len;
    else if (run.circuit === "gas") pipeGas += len;
  }
  qty.plumbing_lf = mmToLf(pipeAll);
  qty.plumbing_suction_lf = mmToLf(pipeSuction);
  qty.plumbing_return_lf = mmToLf(pipeReturn);
  qty.plumbing_gas_lf = mmToLf(pipeGas);

  qty.fence_aluminum_lf = 0;
  qty.fence_wood_lf = 0;
  qty.fence_vinyl_lf = 0;
  qty.fence_wrought_iron_lf = 0;
  qty.fence_chain_link_lf = 0;
  qty.fence_glass_lf = 0;
  qty.gate_swing_count = 0;
  qty.gate_double_swing_count = 0;
  qty.gate_sliding_count = 0;
  let fenceTotal = 0;
  for (const fence of design.fences ?? []) {
    const lf = mmToLf(fenceBillableLengthMm(fence));
    fenceTotal += lf;
    const key = `fence_${fence.kind}_lf`;
    qty[key] = (qty[key] ?? 0) + lf;
    for (const gate of fence.gates ?? []) {
      const gkey = `gate_${gate.kind}_count`;
      qty[gkey] = (qty[gkey] ?? 0) + 1;
    }
  }
  qty.fence_lf = fenceTotal;

  const covers = design.patioCovers ?? [];
  qty.pergola_sf = mm2ToSf(
    covers
      .filter((c) => c.kind === "pergola")
      .reduce((sum, c) => sum + polygonAreaMm2(c.outline), 0),
  );
  qty.patio_roof_sf = mm2ToSf(
    covers
      .filter((c) => c.kind === "roof")
      .reduce((sum, c) => sum + polygonAreaMm2(c.outline), 0),
  );
  qty.cover_post_count = covers.reduce((sum, c) => {
    const n = (c.supports ?? []).length;
    return sum + (n > 0 ? n : POST_FOOTINGS_PER_COVER);
  }, 0);

  let troughLf = 0;
  let edgePools = 0;
  for (const pool of pools) {
    const edges = resolveInfinityEdges(pool);
    if (!edges.length) continue;
    troughLf += infinityTroughLf(pool);
    edgePools += 1;
  }
  qty.infinity_trough_lf = troughLf;
  qty.infinity_edge_pool_count = edgePools;

  const placedPadEquip = (design.objects ?? []).filter((o) =>
    isPadEquipmentId(o.catalogItemId),
  );
  const kits = placedPadEquip.length === 0;
  qty.residential_equip_kit_count =
    kits && design.designLevel === "residential"
      ? pools.length + spas.length
      : 0;
  qty.commercial_equip_kit_count =
    kits && design.designLevel !== "residential" ? design.poolBodies.length : 0;
  qty.bubbler_led_count = (design.objects ?? []).filter(
    (o) => isBubblerId(o.catalogItemId) && o.hasLedLight,
  ).length;
  qty.labor_install_hr = laborInstallHours(design);

  return qty;
}
