import type { DesignLevel } from "./design-level";

export type PlaceableCategory =
  | "furniture"
  | "hardscape"
  | "amenity"
  | "attraction"
  | "equipment";

export type PlaceableItem = {
  id: string;
  name: string;
  category: PlaceableCategory;
  /** Footprint width (X) in mm */
  widthMm: number;
  /** Footprint depth (Y) in mm */
  depthMm: number;
  /** Default layer id in the design document */
  layerId: string;
  levels: DesignLevel[];
  /** Sell price in USD cents (ea) */
  unitPriceCents: number;
  description?: string;
};

/** In-water fixtures placed on pool / spa (not pad equipment). */
export const WATER_FIXTURE_IDS = [
  "spa_drain",
  "spa_bubbler",
  "pool_bubbler",
  "spa_jet",
  "light_standard",
  "light_color",
] as const;

export type WaterFixtureId = (typeof WATER_FIXTURE_IDS)[number];

export function isWaterFixtureId(id: string): boolean {
  return (WATER_FIXTURE_IDS as readonly string[]).includes(id);
}

export function isPoolFixtureId(id: string): boolean {
  return (
    id === "pool_bubbler" ||
    id === "light_standard" ||
    id === "light_color"
  );
}

export function isSpaFixtureId(id: string): boolean {
  return (
    id === "spa_drain" ||
    id === "spa_bubbler" ||
    id === "spa_jet" ||
    id === "light_standard" ||
    id === "light_color"
  );
}

const FT = 304.8;
const IN = 25.4;

export const OBJECT_LIBRARY: PlaceableItem[] = [
  {
    id: "equip_pad",
    name: "Equipment pad",
    category: "equipment",
    widthMm: 8 * FT,
    depthMm: 4 * FT,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 125000,
  },
  {
    id: "pump_variable_speed",
    name: "Variable-speed pump",
    category: "equipment",
    widthMm: 2.5 * FT,
    depthMm: 2 * FT,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 185000,
  },
  {
    id: "filter_cartridge",
    name: "Cartridge filter",
    category: "equipment",
    widthMm: 2 * FT,
    depthMm: 2 * FT,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 95000,
  },
  {
    id: "heater_gas",
    name: "Gas heater",
    category: "equipment",
    widthMm: 3 * FT,
    depthMm: 2.5 * FT,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 320000,
  },
  {
    id: "salt_chlorinator",
    name: "Salt chlorinator cell",
    category: "equipment",
    widthMm: 1.5 * FT,
    depthMm: 1 * FT,
    layerId: "equipment",
    levels: ["residential", "commercial"],
    unitPriceCents: 140000,
  },
  {
    id: "spa_drain",
    name: "Spa main drain",
    category: "equipment",
    widthMm: 10 * IN,
    depthMm: 10 * IN,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 18500,
  },
  {
    id: "spa_bubbler",
    name: "Spa bubbler",
    category: "equipment",
    widthMm: 6 * IN,
    depthMm: 6 * IN,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 27500,
  },
  {
    id: "pool_bubbler",
    name: "Sunshelf / pool bubbler",
    category: "equipment",
    widthMm: 6 * IN,
    depthMm: 6 * IN,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 32500,
    description: "Deck-level bubbler for sunshelf / tanning ledge",
  },
  {
    id: "spa_jet",
    name: "Spa jet",
    category: "equipment",
    widthMm: 5 * IN,
    depthMm: 5 * IN,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 14500,
  },
  {
    id: "light_standard",
    name: "Standard pool/spa light",
    category: "equipment",
    widthMm: 8 * IN,
    depthMm: 8 * IN,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 45000,
    description: "White / fixed-color underwater niche light",
  },
  {
    id: "light_color",
    name: "Color-changing LED light",
    category: "equipment",
    widthMm: 8 * IN,
    depthMm: 8 * IN,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 78500,
    description: "RGB / color-changing underwater LED light",
  },
  {
    id: "lounge_chair",
    name: "Lounge chair",
    category: "furniture",
    widthMm: 2.2 * FT,
    depthMm: 6.5 * FT,
    layerId: "furniture",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 45000,
  },
  {
    id: "dining_table_set",
    name: "Dining table set",
    category: "furniture",
    widthMm: 6 * FT,
    depthMm: 6 * FT,
    layerId: "furniture",
    levels: ["residential", "commercial"],
    unitPriceCents: 185000,
  },
  {
    id: "sofa_outdoor",
    name: "Outdoor sofa",
    category: "furniture",
    widthMm: 7 * FT,
    depthMm: 3 * FT,
    layerId: "furniture",
    levels: ["residential", "commercial"],
    unitPriceCents: 220000,
  },
  {
    id: "umbrella",
    name: "Market umbrella",
    category: "furniture",
    widthMm: 8 * FT,
    depthMm: 8 * FT,
    layerId: "furniture",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 65000,
  },
  {
    id: "fire_pit",
    name: "Fire pit",
    category: "amenity",
    widthMm: 4 * FT,
    depthMm: 4 * FT,
    layerId: "furniture",
    levels: ["residential", "commercial"],
    unitPriceCents: 350000,
  },
  {
    id: "planter",
    name: "Planter",
    category: "hardscape",
    widthMm: 2 * FT,
    depthMm: 2 * FT,
    layerId: "furniture",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 18000,
  },
  {
    id: "outdoor_kitchen",
    name: "Outdoor kitchen run",
    category: "amenity",
    widthMm: 10 * FT,
    depthMm: 3 * FT,
    layerId: "amenities",
    levels: ["residential", "commercial"],
    unitPriceCents: 1250000,
  },
  {
    id: "cabana",
    name: "Cabana",
    category: "amenity",
    widthMm: 10 * FT,
    depthMm: 10 * FT,
    layerId: "amenities",
    levels: ["commercial", "water_park"],
    unitPriceCents: 850000,
  },
  {
    id: "slide_attraction",
    name: "Slide attraction (placeholder)",
    category: "attraction",
    widthMm: 20 * FT,
    depthMm: 40 * FT,
    layerId: "attractions",
    levels: ["water_park"],
    unitPriceCents: 25000000,
  },
];

export function objectLibraryForLevel(level: DesignLevel): PlaceableItem[] {
  return OBJECT_LIBRARY.filter((item) => item.levels.includes(level));
}

export function getPlaceableItem(id: string): PlaceableItem | undefined {
  return OBJECT_LIBRARY.find((item) => item.id === id);
}
