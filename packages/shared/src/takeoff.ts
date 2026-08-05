import { catalogForLevel, type CatalogItem, type CatalogUnit } from "./catalog";
import type { DesignDocument } from "./design-model";
import {
  polygonAreaMm2,
  polygonPerimeterMm,
  polylineLengthMm,
} from "./design-model";
import type { UnitSystem } from "./units";
import { mmToInches } from "./units";

export type TakeoffLine = {
  catalogItemId: string;
  name: string;
  category: CatalogItem["category"];
  unit: CatalogUnit;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  note?: string;
};

export type TakeoffResult = {
  lines: TakeoffLine[];
  subtotalCents: number;
  generatedAt: string;
};

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

  const poolAreaMm2 = design.poolBodies.reduce(
    (sum, p) => sum + polygonAreaMm2(p.outline),
    0,
  );
  const poolPerimeterMm = design.poolBodies.reduce(
    (sum, p) => sum + polygonPerimeterMm(p.outline),
    0,
  );
  const patioAreaMm2 = design.patios.reduce(
    (sum, p) => sum + polygonAreaMm2(p.outline),
    0,
  );
  const pipeMm = design.plumbingRuns.reduce(
    (sum, r) => sum + polylineLengthMm(r.points),
    0,
  );
  const poolCount = design.poolBodies.length;

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
      }
    }

    quantity = roundQty(quantity, unit === "ea" || unit === "hr" ? 1 : 2);
    lines.push({
      catalogItemId,
      name: item.name,
      category: item.category,
      unit,
      quantity,
      unitPriceCents,
      totalCents: Math.round(quantity * unitPriceCents),
      note,
    });
  }

  push("plaster_interior", mm2ToSf(poolAreaMm2), "sf", "Pool water surface area");
  push("waterline_tile", mmToLf(poolPerimeterMm), "lf", "Pool perimeter");
  push("coping", mmToLf(poolPerimeterMm), "lf", "Pool perimeter");
  push("patio_concrete", mm2ToSf(patioAreaMm2), "sf", "Patio / deck area");
  push(
    "pipe_pvc_schedule40",
    mmToLf(pipeMm),
    "lf",
    "Sum of plumbing run lengths",
  );

  if (design.designLevel === "residential") {
    push("equip_pad_kit", poolCount, "ea", "One kit per pool body");
  } else {
    push("equip_commercial_kit", poolCount, "ea", "One package per pool body");
  }

  const laborHrs =
    mm2ToSf(poolAreaMm2) * 0.08 +
    mm2ToSf(patioAreaMm2) * 0.03 +
    mmToLf(pipeMm) * 0.15 +
    poolCount * 24 +
    avgDepthIn * 0.5;
  push("labor_install", roundQty(laborHrs, 1), "hr", "Estimated install hours");

  return {
    lines,
    subtotalCents: lines.reduce((s, l) => s + l.totalCents, 0),
    generatedAt: new Date().toISOString(),
  };
}

export function formatQuantity(qty: number, unit: CatalogUnit): string {
  const q =
    unit === "ea" || unit === "hr"
      ? qty.toFixed(qty % 1 === 0 ? 0 : 1)
      : qty.toFixed(2);
  return `${q} ${unit}`;
}
