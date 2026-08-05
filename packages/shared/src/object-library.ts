import type { DesignLevel } from "./design-level";

export type PlaceableCategory =
  | "furniture"
  | "hardscape"
  | "amenity"
  | "attraction";

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
};

const FT = 304.8;

export const OBJECT_LIBRARY: PlaceableItem[] = [
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
