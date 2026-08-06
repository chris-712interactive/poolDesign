import type { DesignLevel } from "./design-level";

export type CatalogUnit =
  | "ea"
  | "lf"
  | "sf"
  | "sy"
  | "hr"
  | "lb"
  | "kg"
  | "m"
  | "m2";

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
    id: "gunite_shotcrete",
    name: "Gunite / shotcrete shell",
    category: "structure",
    unit: "sf",
    unitPriceCents: 1400,
    levels: ["residential", "commercial", "water_park"],
    description:
      "Structural shell: floor + walls (shared pool/spa openings deducted)",
  },
  {
    id: "rebar_steel",
    name: "Rebar / steel reinforcement",
    category: "structure",
    unit: "lb",
    unitPriceCents: 220,
    levels: ["residential", "commercial", "water_park"],
    description: "Shell reinforcing steel allowance from shell surface area",
  },
  {
    id: "footing_bond_beam",
    name: "Bond beam / pool footing",
    category: "structure",
    unit: "lf",
    unitPriceCents: 3500,
    levels: ["residential", "commercial", "water_park"],
    description: "Continuous bond beam along exposed pool/spa perimeter",
  },
  {
    id: "footing_spa",
    name: "Spa / raised shell footing",
    category: "structure",
    unit: "lf",
    unitPriceCents: 3200,
    levels: ["residential", "commercial", "water_park"],
    description: "Thickened edge footing for spa shell perimeter",
  },
  {
    id: "footing_post",
    name: "Post footing",
    category: "structure",
    unit: "ea",
    unitPriceCents: 17500,
    levels: ["residential", "commercial", "water_park"],
    description: "Concrete pier footing for pergola / patio cover posts",
  },
  {
    id: "plaster_interior",
    name: "Interior plaster / pebble",
    category: "finish",
    unit: "sf",
    unitPriceCents: 1200,
    levels: ["residential", "commercial", "water_park"],
    description: "Interior finish coat based on water surface area (not gunite)",
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
    id: "pergola_structure",
    name: "Pergola structure",
    category: "hardscape",
    unit: "sf",
    unitPriceCents: 4500,
    levels: ["residential", "commercial", "water_park"],
    description: "Open-lattice pergola footprint area",
  },
  {
    id: "patio_cover_roof",
    name: "Patio cover / solid roof",
    category: "hardscape",
    unit: "sf",
    unitPriceCents: 3800,
    levels: ["residential", "commercial", "water_park"],
    description: "Solid patio roof or shade cover footprint area",
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
  {
    id: "steps_assembly",
    name: "Pool steps assembly",
    category: "structure",
    unit: "ea",
    unitPriceCents: 280000,
    levels: ["residential", "commercial", "water_park"],
  },
  {
    id: "bench_assembly",
    name: "In-pool bench",
    category: "structure",
    unit: "lf",
    unitPriceCents: 9500,
    levels: ["residential", "commercial", "water_park"],
    description: "Bench length based on longest side of bench outline",
  },
  {
    id: "sunshelf_assembly",
    name: "Sunshelf / tanning ledge",
    category: "structure",
    unit: "sf",
    unitPriceCents: 3200,
    levels: ["residential", "commercial", "water_park"],
    description: "Shallow ledge footprint area inside the pool",
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
