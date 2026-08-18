import {
  catalogForLevel,
  type CatalogCategory,
  type CatalogItem,
  type CatalogUnit,
} from "./catalog";
import type { DesignLevel } from "./design-level";
import type { DesignDocument } from "./design-model";
import {
  collectPlanQuantities,
  quantitySourceById,
  type QuantitySourceDef,
} from "./plan-quantities";
import type { UnitSystem } from "./units";

type RecipeTakeoffLine = {
  catalogItemId: string;
  name: string;
  category: CatalogCategory | "other";
  unit: CatalogUnit;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  note?: string;
  lineKey: string;
};

export type EstimateRecipeLine = {
  id: string;
  name: string;
  category: CatalogCategory | "other";
  unit: CatalogUnit;
  /** QUANTITY_SOURCES id, or `manual`. */
  quantitySourceId: string;
  /** qty = source × multiplier. Use 1.08 for 8% waste, 2 for lb/sf, etc. */
  multiplier: number;
  unitPriceCents: number;
  enabled: boolean;
  /** When set, company price-book overrides still apply. */
  catalogItemId?: string;
  /** Used when quantitySourceId is `manual`. */
  manualQuantity?: number;
  note?: string;
};

export type EstimateRecipe = {
  version: 1;
  lines: EstimateRecipeLine[];
};

const MAX_LINES = 120;
const RECIPE_CATEGORIES = new Set<EstimateRecipeLine["category"]>([
  "structure",
  "finish",
  "hardscape",
  "plumbing",
  "equipment",
  "labor",
  "other",
]);
const RECIPE_UNITS = new Set<CatalogUnit>([
  "ea",
  "lf",
  "sf",
  "sy",
  "cy",
  "gal",
  "hr",
  "lb",
  "kg",
  "m",
  "m2",
  "m3",
]);

function roundQty(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function convertForUnitSystem(
  quantity: number,
  unit: CatalogUnit,
  unitPriceCents: number,
  unitSystem: UnitSystem,
): { quantity: number; unit: CatalogUnit; unitPriceCents: number } {
  if (unitSystem !== "metric") {
    return { quantity, unit, unitPriceCents };
  }
  if (unit === "lf") {
    return {
      quantity: quantity * 0.3048,
      unit: "m",
      unitPriceCents: Math.round(unitPriceCents / 0.3048),
    };
  }
  if (unit === "sf") {
    return {
      quantity: quantity * 0.092903,
      unit: "m2",
      unitPriceCents: Math.round(unitPriceCents / 0.092903),
    };
  }
  if (unit === "lb") {
    return {
      quantity: quantity * 0.453592,
      unit: "kg",
      unitPriceCents: Math.round(unitPriceCents / 0.453592),
    };
  }
  if (unit === "cy") {
    return {
      quantity: quantity * 0.764555,
      unit: "m3",
      unitPriceCents: Math.round(unitPriceCents / 0.764555),
    };
  }
  return { quantity, unit, unitPriceCents };
}

type DefaultBind = {
  catalogItemId: string;
  quantitySourceId: string;
  multiplier?: number;
  note?: string;
  idSuffix?: string;
};

const DEFAULT_BINDS: DefaultBind[] = [
  {
    catalogItemId: "gunite_shotcrete",
    quantitySourceId: "gunite_shell_sf",
    note: "Floor + walls @ max profile depth (shared openings deducted)",
  },
  {
    catalogItemId: "excavation_pool",
    quantitySourceId: "excavation_cy",
    note: "Outside footprint × max depth + 6″ overdig/working space",
  },
  {
    catalogItemId: "water_volume",
    quantitySourceId: "water_volume_gal",
    note: "Depth-profile integrated gallonage",
  },
  {
    catalogItemId: "rebar_steel",
    quantitySourceId: "gunite_shell_sf",
    multiplier: 2,
    note: "2 lb/sf of gunite shell",
  },
  {
    catalogItemId: "footing_bond_beam",
    quantitySourceId: "exposed_water_perimeter_lf",
    note: "Exposed pool/spa perimeter (shared walls deducted)",
  },
  {
    catalogItemId: "footing_spa",
    quantitySourceId: "spa_outside_perimeter_lf",
    note: "Spa shell perimeter footing",
  },
  {
    catalogItemId: "footing_post",
    quantitySourceId: "cover_post_count",
    note: "Post footings from cover support layout",
  },
  {
    catalogItemId: "plaster_interior",
    quantitySourceId: "pool_wet_sf",
    note: "Pool wet surface (floor + walls)",
    idSuffix: "pool",
  },
  {
    catalogItemId: "plaster_interior",
    quantitySourceId: "spa_wet_sf",
    note: "Spa wet surface (floor + walls)",
    idSuffix: "spa",
  },
  {
    catalogItemId: "waterline_tile",
    quantitySourceId: "exposed_water_perimeter_lf",
    note: "Exposed pool/spa perimeter (shared walls deducted)",
  },
  {
    catalogItemId: "coping",
    quantitySourceId: "exposed_water_perimeter_lf",
    note: "Exposed pool/spa perimeter (shared walls deducted)",
  },
  {
    catalogItemId: "patio_concrete",
    quantitySourceId: "patio_gross_sf",
    note: "Patio / deck area",
  },
  {
    catalogItemId: "fill_dirt",
    quantitySourceId: "patio_fill_cy",
    note: "Compacted fill under patio to house FFE",
  },
  {
    catalogItemId: "retaining_wall",
    quantitySourceId: "retaining_lf",
    note: "Patio edges where grade drop exceeds threshold",
  },
  {
    catalogItemId: "fence_aluminum",
    quantitySourceId: "fence_aluminum_lf",
    note: "Fence length (gate openings deducted)",
  },
  {
    catalogItemId: "fence_wood",
    quantitySourceId: "fence_wood_lf",
    note: "Fence length (gate openings deducted)",
  },
  {
    catalogItemId: "fence_vinyl",
    quantitySourceId: "fence_vinyl_lf",
    note: "Fence length (gate openings deducted)",
  },
  {
    catalogItemId: "fence_wrought_iron",
    quantitySourceId: "fence_wrought_iron_lf",
    note: "Fence length (gate openings deducted)",
  },
  {
    catalogItemId: "fence_chain_link",
    quantitySourceId: "fence_chain_link_lf",
    note: "Fence length (gate openings deducted)",
  },
  {
    catalogItemId: "fence_glass",
    quantitySourceId: "fence_glass_lf",
    note: "Fence length (gate openings deducted)",
  },
  {
    catalogItemId: "gate_swing",
    quantitySourceId: "gate_swing_count",
    note: "Fence gate",
  },
  {
    catalogItemId: "gate_double_swing",
    quantitySourceId: "gate_double_swing_count",
    note: "Fence gate",
  },
  {
    catalogItemId: "gate_sliding",
    quantitySourceId: "gate_sliding_count",
    note: "Fence gate",
  },
  {
    catalogItemId: "pergola_structure",
    quantitySourceId: "pergola_sf",
    note: "Pergola footprint",
  },
  {
    catalogItemId: "patio_cover_roof",
    quantitySourceId: "patio_roof_sf",
    note: "Patio roof footprint",
  },
  {
    catalogItemId: "pipe_pvc_schedule40",
    quantitySourceId: "plumbing_lf",
    note: "Sum of plumbing run lengths",
  },
  {
    catalogItemId: "equip_pad_kit",
    quantitySourceId: "residential_equip_kit_count",
    note: "One kit per pool/spa unless pad equipment is placed",
  },
  {
    catalogItemId: "equip_commercial_kit",
    quantitySourceId: "commercial_equip_kit_count",
    note: "One package per water body",
  },
  {
    catalogItemId: "infinity_trough",
    quantitySourceId: "infinity_trough_lf",
  },
  {
    catalogItemId: "equip_edge_pump",
    quantitySourceId: "infinity_edge_pool_count",
    note: "One edge pump per infinity-edge pool",
  },
  {
    catalogItemId: "labor_install",
    quantitySourceId: "labor_install_hr",
    note: "Estimated install hours",
  },
  {
    catalogItemId: "steps_assembly",
    quantitySourceId: "steps_count",
    note: "One assembly per steps feature",
  },
  {
    catalogItemId: "bench_assembly",
    quantitySourceId: "bench_longest_lf",
    note: "Longest side of each bench",
  },
  {
    catalogItemId: "sunshelf_assembly",
    quantitySourceId: "sunshelf_sf",
    note: "Sunshelf / tanning ledge footprint",
  },
  {
    catalogItemId: "bubbler_led",
    quantitySourceId: "bubbler_led_count",
    note: "Optional LED under bubbler fountain",
  },
];

function lineFromCatalog(
  item: CatalogItem,
  bind: DefaultBind,
): EstimateRecipeLine {
  return {
    id: bind.idSuffix ? `cat:${item.id}:${bind.idSuffix}` : `cat:${item.id}`,
    name: item.name,
    category: item.category,
    unit: item.unit,
    quantitySourceId: bind.quantitySourceId,
    multiplier: bind.multiplier ?? 1,
    unitPriceCents: item.unitPriceCents,
    enabled: true,
    catalogItemId: item.id,
    note: bind.note,
  };
}

/** PoolShape default recipe for a design level (matches the built-in takeoff). */
export function defaultEstimateRecipe(
  level: DesignLevel = "residential",
  catalog: CatalogItem[] = catalogForLevel(level),
): EstimateRecipe {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const lines: EstimateRecipeLine[] = [];
  for (const bind of DEFAULT_BINDS) {
    const item = byId.get(bind.catalogItemId);
    if (!item) continue;
    lines.push(lineFromCatalog(item, bind));
  }
  return { version: 1, lines };
}

export function newEstimateRecipeLine(): EstimateRecipeLine {
  return {
    id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: "New line",
    category: "hardscape",
    unit: "sf",
    quantitySourceId: "patio_paving_net_sf",
    multiplier: 1,
    unitPriceCents: 0,
    enabled: true,
  };
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeLine(raw: unknown): EstimateRecipeLine | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const name = String(row.name ?? "").trim();
  if (!id || !name) return null;
  const category = RECIPE_CATEGORIES.has(
    row.category as EstimateRecipeLine["category"],
  )
    ? (row.category as EstimateRecipeLine["category"])
    : "other";
  const unit = RECIPE_UNITS.has(row.unit as CatalogUnit)
    ? (row.unit as CatalogUnit)
    : "ea";
  const quantitySourceId =
    String(row.quantitySourceId ?? "manual").trim() || "manual";
  if (quantitySourceId !== "manual" && !quantitySourceById(quantitySourceId)) {
    return null;
  }
  const multiplier = Math.min(
    1000,
    Math.max(0, asFiniteNumber(row.multiplier, 1)),
  );
  const unitPriceCents = Math.max(
    0,
    Math.round(asFiniteNumber(row.unitPriceCents, 0)),
  );
  const catalogItemId =
    typeof row.catalogItemId === "string" && row.catalogItemId.trim()
      ? row.catalogItemId.trim()
      : undefined;
  const manualQuantity =
    row.manualQuantity == null
      ? undefined
      : Math.max(0, asFiniteNumber(row.manualQuantity, 0));
  const note =
    typeof row.note === "string" && row.note.trim()
      ? row.note.trim()
      : undefined;
  return {
    id: id.slice(0, 80),
    name: name.slice(0, 120),
    category,
    unit,
    quantitySourceId,
    multiplier,
    unitPriceCents,
    enabled: row.enabled !== false,
    catalogItemId,
    manualQuantity,
    note,
  };
}

export function parseEstimateRecipe(
  json: string | null | undefined,
): EstimateRecipe | null {
  if (!json || !json.trim()) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rawLines = (parsed as { lines?: unknown }).lines;
    if (!Array.isArray(rawLines)) return null;
    const lines = rawLines
      .slice(0, MAX_LINES)
      .map(sanitizeLine)
      .filter((l): l is EstimateRecipeLine => l != null);
    if (lines.length === 0) return null;
    return { version: 1, lines };
  } catch {
    return null;
  }
}

export function serializeEstimateRecipe(recipe: EstimateRecipe): string {
  const lines = recipe.lines
    .slice(0, MAX_LINES)
    .map(sanitizeLine)
    .filter((l): l is EstimateRecipeLine => l != null);
  return JSON.stringify({ version: 1, lines });
}

function recipeLineKey(line: EstimateRecipeLine): string {
  if (line.catalogItemId && line.note) {
    return `${line.catalogItemId}::${line.note}`;
  }
  if (line.catalogItemId) return line.catalogItemId;
  return `recipe:${line.id}`;
}

function sourceNote(
  line: EstimateRecipeLine,
  source: QuantitySourceDef | undefined,
): string | undefined {
  const bits: string[] = [];
  if (line.note) bits.push(line.note);
  if (source && line.quantitySourceId !== "manual") {
    if (!line.note) {
      bits.push(
        line.multiplier !== 1
          ? `${source.label} × ${line.multiplier}`
          : source.label,
      );
    } else if (line.multiplier !== 1) {
      bits.push(`× ${line.multiplier}`);
    }
  }
  return bits.length ? bits.join(" · ") : undefined;
}

/**
 * Turn a company recipe + plan quantities into takeoff lines.
 * Zero-qty lines are omitted. Catalog unit prices overlay recipe prices
 * when the line still points at a catalog item.
 */
export function applyEstimateRecipe(
  design: DesignDocument,
  recipe: EstimateRecipe,
  catalog: CatalogItem[] = catalogForLevel(design.designLevel),
  unitSystem: UnitSystem = design.unitSystem,
): RecipeTakeoffLine[] {
  const qty = collectPlanQuantities(design);
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const lines: RecipeTakeoffLine[] = [];

  for (const line of recipe.lines) {
    if (!line.enabled) continue;
    const source = quantitySourceById(line.quantitySourceId);
    const catalogItem = line.catalogItemId
      ? byId.get(line.catalogItemId)
      : undefined;
    let rawQty =
      line.quantitySourceId === "manual"
        ? (line.manualQuantity ?? line.multiplier ?? 0)
        : (qty[line.quantitySourceId] ?? 0);
    if (line.quantitySourceId !== "manual") {
      rawQty *= line.multiplier > 0 ? line.multiplier : 0;
    }
    if (!(rawQty > 0)) continue;

    const unitPriceCents = line.unitPriceCents;
    const converted = convertForUnitSystem(
      rawQty,
      line.unit,
      unitPriceCents,
      unitSystem,
    );
    const quantity = roundQty(
      converted.quantity,
      converted.unit === "ea" ||
        converted.unit === "hr" ||
        converted.unit === "lb" ||
        converted.unit === "kg" ||
        converted.unit === "gal"
        ? 1
        : 2,
    );
    if (!(quantity > 0)) continue;
    const name = line.name || catalogItem?.name || "Line";
    lines.push({
      catalogItemId: line.catalogItemId ?? `recipe:${line.id}`,
      name,
      category: line.category,
      unit: converted.unit,
      quantity,
      unitPriceCents: converted.unitPriceCents,
      totalCents: Math.round(quantity * converted.unitPriceCents),
      note: sourceNote(line, source),
      lineKey: recipeLineKey(line),
    });
  }

  return lines;
}
