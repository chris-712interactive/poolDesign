import type { DesignLevel } from "./design-level";

export type CatalogUnit = "ea" | "lf" | "sf" | "sy" | "hr" | "m" | "m2";

export type CatalogCategory =
  | "structure"
  | "finish"
  | "hardscape"
  | "plumbing"
  | "equipment"
  | "labor";

export type CatalogItem = {
  id: string;
  name: string;
  category: CatalogCategory;
  unit: CatalogUnit;
  /** Sell price in USD cents */
  unitPriceCents: number;
  /** Which design levels this item applies to */
  levels: DesignLevel[];
  description?: string;
};

/** Starter residential-focused catalog (commercial/water park expand later) */
export const DEFAULT_CATALOG: CatalogItem[] = [
  {
    id: "plaster_interior",
    name: "Interior plaster / pebble",
    category: "finish",
    unit: "sf",
    unitPriceCents: 1200,
    levels: ["residential", "commercial", "water_park"],
    description: "Pool interior surface based on water surface area",
  },
  {
    id: "waterline_tile",
    name: "Waterline tile",
    category: "finish",
    unit: "lf",
    unitPriceCents: 2800,
    levels: ["residential", "commercial", "water_park"],
  },
  {
    id: "coping",
    name: "Coping",
    category: "structure",
    unit: "lf",
    unitPriceCents: 4500,
    levels: ["residential", "commercial", "water_park"],
  },
  {
    id: "patio_concrete",
    name: "Concrete patio / deck",
    category: "hardscape",
    unit: "sf",
    unitPriceCents: 1400,
    levels: ["residential", "commercial", "water_park"],
  },
  {
    id: "pipe_pvc_schedule40",
    name: "PVC Schedule 40 pipe",
    category: "plumbing",
    unit: "lf",
    unitPriceCents: 450,
    levels: ["residential", "commercial", "water_park"],
  },
  {
    id: "equip_pad_kit",
    name: "Equipment pad & basic kit",
    category: "equipment",
    unit: "ea",
    unitPriceCents: 450000,
    levels: ["residential"],
    description: "Pump, filter, and pad allowance per pool body",
  },
  {
    id: "equip_commercial_kit",
    name: "Commercial filtration package",
    category: "equipment",
    unit: "ea",
    unitPriceCents: 1850000,
    levels: ["commercial", "water_park"],
  },
  {
    id: "labor_install",
    name: "Installation labor",
    category: "labor",
    unit: "hr",
    unitPriceCents: 8500,
    levels: ["residential", "commercial", "water_park"],
  },
];

export function catalogForLevel(level: DesignLevel): CatalogItem[] {
  return DEFAULT_CATALOG.filter((item) => item.levels.includes(level));
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
