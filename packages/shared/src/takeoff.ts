import { catalogForLevel, type CatalogItem, type CatalogUnit } from "./catalog";
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
  type FenceKind,
  type GateKind,
} from "./design-model";
import { getPlaceableItem, isBubblerId } from "./object-library";
import { isPadEquipmentId } from "./plumbing-route";
import {
  analyzeDesignGrade,
  totalFillCy,
  totalRetainingLf,
} from "./site-grade";
import {
  insideOutlineFromOutside,
  poolWallThicknessMm,
  spaShellHeightMm,
  spaWallThicknessMm,
} from "./spa-defaults";
import type { UnitSystem } from "./units";
import { mmToInches } from "./units";

/** Typical #3/#4 shell reinforcing allowance (lb per sf of shell surface) */
const REBAR_LB_PER_SF_SHELL = 2;
/** Corner posts assumed per patio cover / pergola */
const POST_FOOTINGS_PER_COVER = 4;

function avgBodyDepthMm(body: PoolBody): number {
  return (body.depthShallowMm + body.depthDeepMm) / 2;
}

export type TakeoffLine = {
  catalogItemId: string;
  name: string;
  category:
    | CatalogItem["category"]
    | "furniture"
    | "amenity"
    | "attraction"
    | "other";
  unit: CatalogUnit;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  note?: string;
  /**
   * Stable identity for exclude/restore. Auto lines use catalogId + note;
   * custom lines use `custom:<id>`.
   */
  lineKey: string;
  /** True when the line was added by the user (not derived from geometry). */
  custom?: boolean;
};

export type TakeoffResult = {
  lines: TakeoffLine[];
  /** Auto-generated lines currently hidden via design.estimate.removedLineKeys */
  removedLines: TakeoffLine[];
  subtotalCents: number;
  generatedAt: string;
};

/** Stable key for an auto-generated takeoff line. */
export function takeoffLineKey(catalogItemId: string, note?: string): string {
  return note ? `${catalogItemId}::${note}` : catalogItemId;
}

const MM2_PER_SF = 92903.04;
const MM_PER_LF = 304.8;

function mm2ToSf(mm2: number): number {
  return mm2 / MM2_PER_SF;
}

function mmToLf(mm: number): number {
  return mm / MM_PER_LF;
}

function roundQty(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Derive a material / labor takeoff from the design document.
 * Length/area quantities follow the designer unit system; prices remain USD.
 */
export function buildTakeoff(
  design: DesignDocument,
  unitSystem: UnitSystem = design.unitSystem,
  catalog: CatalogItem[] = catalogForLevel(design.designLevel),
): TakeoffResult {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const lines: TakeoffLine[] = [];

  const pools = design.poolBodies.filter((p) => (p.kind ?? "pool") !== "spa");
  const spas = design.poolBodies.filter((p) => (p.kind ?? "pool") === "spa");
  const spaInsides: PointMm[][] = spas.map((p) =>
    insideOutlineFromOutside(p.outline, spaWallThicknessMm(p)),
  );
  const poolInsides: PointMm[][] = pools.map((p) =>
    insideOutlineFromOutside(p.outline, poolWallThicknessMm(p)),
  );
  let poolAreaMm2 = poolInsides.reduce(
    (sum, outline) => sum + polygonAreaMm2(outline),
    0,
  );
  let spaAreaMm2 = spaInsides.reduce(
    (sum, outline) => sum + polygonAreaMm2(outline),
    0,
  );
  // When a spa waterline overlaps a pool waterline, don't double-count plaster.
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
    // Remove overlap from pool plaster (spa keeps its water surface).
    poolAreaMm2 = Math.max(0, poolAreaMm2 - plasterOverlapMm2);
  }
  // Coping / waterline: full perimeters minus shared / attached walls.
  const waterOutlines = design.poolBodies.map((p) => p.outline);
  const waterPerimeterMm = exposedWaterPerimeterMm(waterOutlines);
  const patioAreaMm2 = design.patios.reduce(
    (sum, p) => sum + polygonAreaMm2(p.outline),
    0,
  );
  const pipeMm = design.plumbingRuns.reduce(
    (sum, r) => sum + polylineLengthMm(r.points),
    0,
  );
  const poolCount = pools.length;
  const spaCount = spas.length;
  const bodyCount = design.poolBodies.length;

  const avgDepthIn =
    design.poolBodies.length === 0
      ? 0
      : design.poolBodies.reduce(
          (sum, p) =>
            sum + mmToInches((p.depthShallowMm + p.depthDeepMm) / 2),
          0,
        ) / design.poolBodies.length;

  function push(
    catalogItemId: string,
    qtyBase: number,
    baseUnit: CatalogUnit,
    note?: string,
  ) {
    const item = byId.get(catalogItemId);
    if (!item || qtyBase <= 0) return;

    let quantity = qtyBase;
    let unit: CatalogUnit = baseUnit;
    let unitPriceCents = item.unitPriceCents;

    if (unitSystem === "metric") {
      if (baseUnit === "lf") {
        quantity = qtyBase * 0.3048;
        unit = "m";
        unitPriceCents = Math.round(item.unitPriceCents / 0.3048);
      } else if (baseUnit === "sf") {
        quantity = qtyBase * 0.092903;
        unit = "m2";
        unitPriceCents = Math.round(item.unitPriceCents / 0.092903);
      } else if (baseUnit === "lb") {
        quantity = qtyBase * 0.453592;
        unit = "kg";
        unitPriceCents = Math.round(item.unitPriceCents / 0.453592);
      } else if (baseUnit === "cy") {
        quantity = qtyBase * 0.764555;
        unit = "m3";
        unitPriceCents = Math.round(item.unitPriceCents / 0.764555);
      }
    }

    quantity = roundQty(
      quantity,
      unit === "ea" || unit === "hr" || unit === "lb" || unit === "kg" ? 1 : 2,
    );
    lines.push({
      catalogItemId,
      name: item.name,
      category: item.category,
      unit,
      quantity,
      unitPriceCents,
      totalCents: Math.round(quantity * unitPriceCents),
      note,
      lineKey: takeoffLineKey(catalogItemId, note),
    });
  }

  // Gunite / shotcrete: floor + walls; open shared pool↔spa walls deducted.
  let shellMm2 = 0;
  for (const pool of pools) {
    const depth = avgBodyDepthMm(pool);
    shellMm2 +=
      polygonAreaMm2(pool.outline) +
      polygonPerimeterMm(pool.outline) * depth;
  }
  for (let i = 0; i < spas.length; i++) {
    const spa = spas[i];
    const depth = avgBodyDepthMm(spa);
    const inside = spaInsides[i];
    shellMm2 +=
      polygonAreaMm2(inside) + polygonPerimeterMm(inside) * depth;
    // Raised spa exterior face above deck
    const raise = spaShellHeightMm(spa);
    if (raise > 0) {
      shellMm2 += polygonPerimeterMm(spa.outline) * raise;
    }
  }
  for (const pool of pools) {
    for (const spa of spas) {
      const shared = sharedBoundaryLengthMm(pool.outline, spa.outline);
      if (shared <= 0) continue;
      shellMm2 -= shared * avgBodyDepthMm(pool);
      shellMm2 -= shared * avgBodyDepthMm(spa);
    }
  }
  shellMm2 = Math.max(0, shellMm2);
  const shellSf = mm2ToSf(shellMm2);

  push(
    "gunite_shotcrete",
    shellSf,
    "sf",
    "Floor + walls (shared openings & overlap deducted)",
  );
  push(
    "rebar_steel",
    shellSf * REBAR_LB_PER_SF_SHELL,
    "lb",
    `${REBAR_LB_PER_SF_SHELL} lb/sf of gunite shell`,
  );
  push(
    "footing_bond_beam",
    mmToLf(waterPerimeterMm),
    "lf",
    "Exposed pool/spa perimeter (shared walls deducted)",
  );
  const spaFootingMm = spas.reduce(
    (sum, spa) => sum + polygonPerimeterMm(spa.outline),
    0,
  );
  push(
    "footing_spa",
    mmToLf(spaFootingMm),
    "lf",
    "Spa shell perimeter footing",
  );
  const coverCount = (design.patioCovers ?? []).length;
  push(
    "footing_post",
    coverCount * POST_FOOTINGS_PER_COVER,
    "ea",
    `${POST_FOOTINGS_PER_COVER} post footings per pergola/roof`,
  );

  push(
    "plaster_interior",
    mm2ToSf(poolAreaMm2),
    "sf",
    plasterOverlapMm2 > 0
      ? "Pool water surface (overlap with spa deducted)"
      : "Pool water surface area",
  );
  push("plaster_interior", mm2ToSf(spaAreaMm2), "sf", "Spa water surface area");
  push(
    "waterline_tile",
    mmToLf(waterPerimeterMm),
    "lf",
    "Exposed pool/spa perimeter (shared walls deducted)",
  );
  push(
    "coping",
    mmToLf(waterPerimeterMm),
    "lf",
    "Exposed pool/spa perimeter (shared walls deducted)",
  );
  push("patio_concrete", mm2ToSf(patioAreaMm2), "sf", "Patio / deck area");

  const gradeAnalyses = analyzeDesignGrade(
    design.patios ?? [],
    design.gradeSamples ?? [],
    design.gradeOptions,
  );
  const fillCy = totalFillCy(gradeAnalyses);
  const retainingLf = totalRetainingLf(gradeAnalyses);
  push(
    "fill_dirt",
    fillCy,
    "cy",
    "Compacted fill under patio to house FFE",
  );
  push(
    "retaining_wall",
    retainingLf,
    "lf",
    "Patio edges where grade drop exceeds threshold",
  );

  const covers = design.patioCovers ?? [];
  const pergolaAreaMm2 = covers
    .filter((c) => c.kind === "pergola")
    .reduce((sum, c) => sum + polygonAreaMm2(c.outline), 0);
  const roofAreaMm2 = covers
    .filter((c) => c.kind === "roof")
    .reduce((sum, c) => sum + polygonAreaMm2(c.outline), 0);
  push("pergola_structure", mm2ToSf(pergolaAreaMm2), "sf", "Pergola footprint");
  push("patio_cover_roof", mm2ToSf(roofAreaMm2), "sf", "Patio roof footprint");

  const fences = design.fences ?? [];
  const fenceLfByKind = new Map<FenceKind, number>();
  const gateCountByKind = new Map<GateKind, number>();
  let fenceLfTotal = 0;
  for (const fence of fences) {
    const lf = mmToLf(fenceBillableLengthMm(fence));
    fenceLfTotal += lf;
    fenceLfByKind.set(fence.kind, (fenceLfByKind.get(fence.kind) ?? 0) + lf);
    for (const gate of fence.gates ?? []) {
      gateCountByKind.set(
        gate.kind,
        (gateCountByKind.get(gate.kind) ?? 0) + 1,
      );
    }
  }
  for (const [kind, lf] of fenceLfByKind) {
    push(`fence_${kind}`, lf, "lf", "Fence length (gate openings deducted)");
  }
  for (const [kind, count] of gateCountByKind) {
    push(`gate_${kind}`, count, "ea", "Fence gate");
  }

  push(
    "pipe_pvc_schedule40",
    mmToLf(pipeMm),
    "lf",
    "Sum of plumbing run lengths",
  );

  const placedPadEquip = (design.objects ?? []).filter((o) =>
    isPadEquipmentId(o.catalogItemId),
  );
  // Prefer discrete pad equipment on the plan over a generic kit allowance.
  if (placedPadEquip.length === 0) {
    if (design.designLevel === "residential") {
      push("equip_pad_kit", poolCount, "ea", "One kit per pool");
      push("equip_pad_kit", spaCount, "ea", "One kit per spa");
    } else {
      push(
        "equip_commercial_kit",
        bodyCount,
        "ea",
        "One package per water body",
      );
    }
  }

  const features = design.features ?? [];
  const stepsCount = features.filter((f) => f.kind === "steps").length;
  const benchLf = features
    .filter((f) => f.kind === "bench")
    .reduce((sum, f) => {
      if (f.outline.length < 2) return sum;
      let longest = 0;
      for (let i = 0; i < f.outline.length; i++) {
        const len = segmentLengthMm(
          f.outline[i],
          f.outline[(i + 1) % f.outline.length],
        );
        if (len > longest) longest = len;
      }
      return sum + mmToLf(longest);
    }, 0);
  const sunshelfAreaMm2 = features
    .filter((f) => f.kind === "sunshelf")
    .reduce((sum, f) => sum + polygonAreaMm2(f.outline), 0);
  push("steps_assembly", stepsCount, "ea", "One assembly per steps feature");
  push("bench_assembly", benchLf, "lf", "Longest side of each bench");
  push(
    "sunshelf_assembly",
    mm2ToSf(sunshelfAreaMm2),
    "sf",
    "Sunshelf / tanning ledge footprint",
  );

  // House doors/windows are plan annotation only — not outdoor project scope.

  // Furniture / scale figures are layout aids — do not inflate install labor.
  const billableObjectCount = (design.objects ?? []).filter((o) => {
    const item = getPlaceableItem(o.catalogItemId);
    if (!item) return false;
    if (item.category === "furniture") return false;
    if (item.unitPriceCents <= 0 || o.catalogItemId === "person_scale") {
      return false;
    }
    return true;
  }).length;

  const bubblerLedCount = (design.objects ?? []).filter(
    (o) => isBubblerId(o.catalogItemId) && o.hasLedLight,
  ).length;

  const laborHrs =
    shellSf * 0.12 +
    mm2ToSf(poolAreaMm2) * 0.08 +
    mm2ToSf(spaAreaMm2) * 0.12 +
    mm2ToSf(patioAreaMm2) * 0.03 +
    mmToLf(pipeMm) * 0.15 +
    mmToLf(waterPerimeterMm) * 0.2 +
    mmToLf(spaFootingMm) * 0.15 +
    coverCount * POST_FOOTINGS_PER_COVER * 1.5 +
    fenceLfTotal * 0.35 +
    [...gateCountByKind.values()].reduce((s, n) => s + n, 0) * 1.5 +
    poolCount * 24 +
    spaCount * 16 +
    avgDepthIn * 0.5 +
    billableObjectCount * 0.5 +
    bubblerLedCount * 0.35 +
    stepsCount * 4 +
    benchLf * 0.4 +
    mm2ToSf(sunshelfAreaMm2) * 0.15;
  push("labor_install", roundQty(laborHrs, 1), "hr", "Estimated install hours");

  // Group placed library objects (furniture is layout-only — not sold/billed).
  const objectCounts = new Map<string, number>();
  for (const obj of design.objects ?? []) {
    objectCounts.set(
      obj.catalogItemId,
      (objectCounts.get(obj.catalogItemId) ?? 0) + 1,
    );
  }
  for (const [catalogItemId, count] of objectCounts) {
    const item = getPlaceableItem(catalogItemId);
    if (!item) continue;
    if (item.category === "furniture") continue;
    // Skip free scale / reference items (e.g. person for scale).
    if (item.unitPriceCents <= 0 || catalogItemId === "person_scale") continue;
    const category: TakeoffLine["category"] =
      item.category === "hardscape" ? "hardscape" : item.category;
    const note = "Placed from object library";
    lines.push({
      catalogItemId,
      name: item.name,
      category,
      unit: "ea",
      quantity: count,
      unitPriceCents: item.unitPriceCents,
      totalCents: count * item.unitPriceCents,
      note,
      lineKey: takeoffLineKey(catalogItemId, note),
    });
  }

  // Optional niche LEDs under bubbler fountains.
  if (bubblerLedCount > 0) {
    push(
      "bubbler_led",
      bubblerLedCount,
      "ea",
      "Optional LED under bubbler fountain",
    );
  }

  const removedKeys = new Set(design.estimate?.removedLineKeys ?? []);
  const removedLines = lines.filter((l) => removedKeys.has(l.lineKey));
  let visible = lines.filter((l) => !removedKeys.has(l.lineKey));

  for (const custom of design.estimate?.customLines ?? []) {
    if (custom.quantity <= 0) continue;
    visible.push({
      catalogItemId: `custom:${custom.id}`,
      name: custom.name,
      category: custom.category,
      unit: custom.unit,
      quantity: custom.quantity,
      unitPriceCents: custom.unitPriceCents,
      totalCents: Math.round(custom.quantity * custom.unitPriceCents),
      note: custom.note,
      lineKey: `custom:${custom.id}`,
      custom: true,
    });
  }

  return {
    lines: visible,
    removedLines,
    subtotalCents: visible.reduce((s, l) => s + l.totalCents, 0),
    generatedAt: new Date().toISOString(),
  };
}

export function formatQuantity(qty: number, unit: CatalogUnit): string {
  const q =
    unit === "ea" || unit === "hr" || unit === "lb" || unit === "kg"
      ? qty.toFixed(qty % 1 === 0 ? 0 : 1)
      : qty.toFixed(2);
  return `${q} ${unit}`;
}
