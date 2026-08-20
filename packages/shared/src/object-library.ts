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
  /** Default vertical size for 3D (mm) */
  heightMm: number;
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
  "pool_drain",
  "pool_skimmer",
  "pool_return",
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

export function isBubblerId(id: string): boolean {
  return id === "spa_bubbler" || id === "pool_bubbler";
}

export function isPoolFixtureId(id: string): boolean {
  return (
    id === "pool_drain" ||
    id === "pool_skimmer" ||
    id === "pool_return" ||
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

/** Adult scale figure height: 5′8″ (1727.2 mm). */
export const SCALE_PERSON_HEIGHT_MM = 5 * FT + 8 * IN;
/** Shoulder breadth ≈ 18″ for a standing adult. */
export const SCALE_PERSON_WIDTH_MM = 18 * IN;
/** Front-to-back chest / stance depth ≈ 12″. */
export const SCALE_PERSON_DEPTH_MM = 12 * IN;

export const OBJECT_LIBRARY: PlaceableItem[] = [
  {
    id: "equip_pad",
    name: "Equipment pad",
    category: "equipment",
    widthMm: 8 * FT,
    depthMm: 4 * FT,
    heightMm: 150,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 125000,
  },
  {
    id: "pump_variable_speed",
    name: "Variable-speed pump",
    category: "equipment",
    /** ~IntelliFlo footprint: 30″ L × 17″ W × 20″ H */
    widthMm: 762,
    depthMm: 432,
    heightMm: 508,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 185000,
  },
  {
    id: "filter_cartridge",
    name: "Cartridge filter",
    category: "equipment",
    /** ~Clean & Clear Plus: 22″ × 22″ × 45″ */
    widthMm: 559,
    depthMm: 559,
    heightMm: 1143,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 95000,
  },
  {
    id: "heater_gas",
    name: "Gas heater",
    category: "equipment",
    /** ~MasterTemp / ETi cabinet: 40″ × 30″ × 46″ */
    widthMm: 1016,
    depthMm: 762,
    heightMm: 1168,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 320000,
  },
  {
    id: "salt_chlorinator",
    name: "Salt chlorinator cell",
    category: "equipment",
    /** ~IntelliChlor cell + head */
    widthMm: 508,
    depthMm: 280,
    heightMm: 380,
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
    heightMm: 80,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 18500,
  },
  {
    id: "pool_drain",
    name: "Pool main drain (VGBA)",
    category: "equipment",
    widthMm: 12 * IN,
    depthMm: 12 * IN,
    heightMm: 80,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 22500,
    description:
      "ANSI/APSP-16 compliant floor suction outlet — install in pairs",
  },
  {
    id: "pool_skimmer",
    name: "Pool skimmer",
    category: "equipment",
    widthMm: 14 * IN,
    depthMm: 18 * IN,
    heightMm: 200,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 28500,
    description: "Wall skimmer throat at operating waterline",
  },
  {
    id: "pool_return",
    name: "Pool return inlet",
    category: "equipment",
    widthMm: 5 * IN,
    depthMm: 5 * IN,
    heightMm: 80,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 6500,
    description: "Wall return / inlet fitting",
  },
  {
    id: "spa_bubbler",
    name: "Spa bubbler",
    category: "equipment",
    widthMm: 6 * IN,
    depthMm: 6 * IN,
    heightMm: 120,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 27500,
    description:
      "Floor bubbler fountain (~9–12″ plume). Optional niche LED is a separate line.",
  },
  {
    id: "pool_bubbler",
    name: "Sunshelf / pool bubbler",
    category: "equipment",
    widthMm: 6 * IN,
    depthMm: 6 * IN,
    heightMm: 120,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 32500,
    description:
      "Deck-level bubbler for sunshelf / tanning ledge (~9–12″ plume). Optional niche LED is a separate line.",
  },
  {
    id: "spa_jet",
    name: "Spa jet",
    category: "equipment",
    widthMm: 5 * IN,
    depthMm: 5 * IN,
    heightMm: 100,
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
    heightMm: 80,
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
    heightMm: 80,
    layerId: "equipment",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 78500,
    description: "RGB / color-changing underwater LED light",
  },
  {
    id: "person_scale",
    name: "Person (scale figure)",
    category: "furniture",
    widthMm: SCALE_PERSON_WIDTH_MM,
    depthMm: SCALE_PERSON_DEPTH_MM,
    heightMm: SCALE_PERSON_HEIGHT_MM,
    layerId: "furniture",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 0,
    description:
      "Standing adult for scale — set height, sex, and outfit in Properties. Not billed.",
  },
  {
    id: "lounge_chair",
    name: "Lounge chair",
    category: "furniture",
    widthMm: 2.2 * FT,
    depthMm: 6.5 * FT,
    heightMm: 900,
    layerId: "furniture",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 45000,
  },
  {
    id: "dining_table_rect",
    name: "Dining set (rectangular)",
    category: "furniture",
    /** Tabletop width — plan footprint adds chair clearance. */
    widthMm: 6 * FT,
    /** Tabletop depth */
    depthMm: 3.5 * FT,
    heightMm: 750,
    layerId: "furniture",
    levels: ["residential", "commercial"],
    unitPriceCents: 185000,
    description:
      "Sized by tabletop; chairs add ~22″ clearance on each side of the plan footprint.",
  },
  {
    id: "dining_table_round",
    name: "Dining set (round)",
    category: "furniture",
    /** Tabletop diameter (width = depth). */
    widthMm: 5 * FT,
    depthMm: 5 * FT,
    heightMm: 750,
    layerId: "furniture",
    levels: ["residential", "commercial"],
    unitPriceCents: 185000,
    description:
      "Sized by tabletop diameter; chairs add ~22″ clearance around the plan footprint.",
  },
  /**
   * Legacy id — still recognized for older designs; prefer rect/round.
   * Kept so getPlaceableItem / normalize can resolve height defaults.
   */
  {
    id: "dining_table_set",
    name: "Dining set (round)",
    category: "furniture",
    widthMm: 5 * FT,
    depthMm: 5 * FT,
    heightMm: 750,
    layerId: "furniture",
    levels: [],
    unitPriceCents: 185000,
  },
  {
    id: "sofa_outdoor",
    name: "Outdoor sofa",
    category: "furniture",
    widthMm: 7 * FT,
    depthMm: 3 * FT,
    heightMm: 850,
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
    heightMm: 2400,
    layerId: "furniture",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 65000,
    description:
      "8′ canopy. Place on deck, or snap into a sunshelf pole holder to sit in the water.",
  },
  {
    id: "sunshelf_chaise",
    name: "Sunshelf chaise",
    category: "furniture",
    /** Low in-water chaise — typical tanning-ledge lounge. */
    widthMm: 2 * FT,
    depthMm: 5.5 * FT,
    heightMm: 14 * IN,
    layerId: "furniture",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 38000,
    description:
      "Low-profile chaise for a tanning ledge. Sits on the sunshelf, not the deck.",
  },
  {
    id: "sunshelf_table",
    name: "Sunshelf drink table",
    category: "furniture",
    widthMm: 16 * IN,
    depthMm: 16 * IN,
    heightMm: 12 * IN,
    layerId: "furniture",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 12000,
    description: "Small side table for a sunshelf / tanning ledge.",
  },
  {
    id: "umbrella_sleeve",
    name: "Sunshelf pole holder",
    category: "hardscape",
    widthMm: 6 * IN,
    depthMm: 6 * IN,
    heightMm: 8 * IN,
    layerId: "furniture",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 22500,
    description:
      "Sleeve set into a tanning ledge so a market umbrella stands in the water.",
  },
  {
    id: "cover_fan",
    name: "Patio ceiling fan",
    category: "amenity",
    widthMm: 52 * IN,
    depthMm: 52 * IN,
    heightMm: 14 * IN,
    layerId: "furniture",
    levels: ["residential", "commercial"],
    unitPriceCents: 48500,
    description: "Hangs from a patio roof or pergola underside.",
  },
  {
    id: "cover_light",
    name: "Patio roof light",
    category: "amenity",
    widthMm: 8 * IN,
    depthMm: 8 * IN,
    heightMm: 10 * IN,
    layerId: "furniture",
    levels: ["residential", "commercial"],
    unitPriceCents: 16500,
    description: "Hanging lantern for a patio roof or pergola.",
  },
  {
    id: "fire_pit",
    name: "Fire pit",
    category: "amenity",
    widthMm: 4 * FT,
    depthMm: 4 * FT,
    heightMm: 450,
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
    heightMm: 500,
    layerId: "furniture",
    levels: ["residential", "commercial", "water_park"],
    unitPriceCents: 18000,
  },
  {
    id: "trellis",
    name: "Flowering trellis",
    category: "hardscape",
    widthMm: 6 * FT,
    depthMm: 10 * IN,
    heightMm: 7 * FT,
    layerId: "furniture",
    levels: ["residential", "commercial"],
    unitPriceCents: 85000,
    description:
      "Freestanding lattice panel. Place anywhere, rotate to face, pick a Florida vine in Properties.",
  },
  {
    id: "trellis_arbor",
    name: "Flowering arbor",
    category: "hardscape",
    widthMm: 5 * FT,
    depthMm: 3 * FT,
    heightMm: 8 * FT,
    layerId: "furniture",
    levels: ["residential", "commercial"],
    unitPriceCents: 185000,
    description:
      "Walk-through arbor with vines on both sides. Place anywhere on the plan.",
  },
  {
    id: "outdoor_kitchen",
    name: "Outdoor kitchen run",
    category: "amenity",
    widthMm: 10 * FT,
    depthMm: 3 * FT,
    heightMm: 1100,
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
    heightMm: 2700,
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
    heightMm: 4500,
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

/** Chair pull-out clearance added on each side of a dining tabletop. */
export const DINING_CHAIR_CLEARANCE_MM = 22 * IN;

/** Ceiling fan / light hung from a patio roof or pergola. */
export const COVER_ACCESSORY_IDS = ["cover_fan", "cover_light"] as const;

export function isCoverAccessoryId(id: string): boolean {
  return (COVER_ACCESSORY_IDS as readonly string[]).includes(id);
}

/** Layout items that prefer a sunshelf / tanning ledge. */
export const SUNSHELF_LAYOUT_IDS = [
  "sunshelf_chaise",
  "sunshelf_table",
  "umbrella_sleeve",
] as const;

export function isSunshelfLayoutId(id: string): boolean {
  return (SUNSHELF_LAYOUT_IDS as readonly string[]).includes(id);
}

export function isUmbrellaSleeveId(id: string): boolean {
  return id === "umbrella_sleeve";
}

export function isDiningSetId(id: string): boolean {
  return (
    id === "dining_table_set" ||
    id === "dining_table_rect" ||
    id === "dining_table_round"
  );
}

export function diningTableShape(id: string): "rect" | "round" {
  return id === "dining_table_rect" ? "rect" : "round";
}

export function diningSetCatalogId(shape: "rect" | "round"): string {
  return shape === "rect" ? "dining_table_rect" : "dining_table_round";
}

/** Overall plan/3D footprint including chairs around the tabletop. */
export function diningOverallFootprintMm(
  tableWidthMm: number,
  tableDepthMm: number,
  shape: "rect" | "round" = "rect",
): { widthMm: number; depthMm: number } {
  const pad = DINING_CHAIR_CLEARANCE_MM * 2;
  if (shape === "round") {
    const dia = Math.max(tableWidthMm, tableDepthMm);
    return { widthMm: dia + pad, depthMm: dia + pad };
  }
  return {
    widthMm: tableWidthMm + pad,
    depthMm: tableDepthMm + pad,
  };
}

/** Chair placement in table-local mm: +X along width, +Y along depth. */
export type DiningChairSlotMm = {
  xMm: number;
  yMm: number;
  /** Yaw so the seat faces the table center (0 = facing +Y). */
  yawRad: number;
};

/**
 * Chairs all the way around the table — long sides and ends for rect,
 * evenly spaced orbit for round.
 */
export function diningChairSlotsMm(
  shape: "rect" | "round",
  tableWidthMm: number,
  tableDepthMm: number,
): DiningChairSlotMm[] {
  const clear = DINING_CHAIR_CLEARANCE_MM;
  /** Distance from tabletop edge to chair center. */
  const pullOut = clear * 0.48;
  /** Target spacing between chair centers along an edge. */
  const pitch = 26 * IN;
  /** Keep chairs this far from corners so sides/ends don't collide. */
  const cornerPad = 14 * IN;

  if (shape === "round") {
    const dia = Math.max(tableWidthMm, tableDepthMm);
    const n =
      dia >= 7 * FT ? 8 : dia >= 5.5 * FT ? 6 : dia >= 4 * FT ? 4 : 2;
    const orbit = dia / 2 + pullOut;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return {
        xMm: Math.sin(a) * orbit,
        yMm: Math.cos(a) * orbit,
        yawRad: a + Math.PI,
      };
    });
  }

  const slots: DiningChairSlotMm[] = [];
  const halfW = tableWidthMm / 2;
  const halfD = tableDepthMm / 2;
  const sideY = halfD + pullOut;
  const endX = halfW + pullOut;

  const countAlong = (edgeLen: number) => {
    const usable = Math.max(0, edgeLen - cornerPad * 2);
    return Math.max(1, Math.round(usable / pitch) || 1);
  };

  // Long sides (±Y): chairs facing the table
  const nSide = countAlong(tableWidthMm);
  for (let i = 0; i < nSide; i++) {
    const t = nSide === 1 ? 0.5 : i / (nSide - 1);
    const span = Math.max(0, tableWidthMm - cornerPad * 2);
    const x = -span / 2 + t * span;
    slots.push({ xMm: x, yMm: sideY, yawRad: Math.PI });
    slots.push({ xMm: x, yMm: -sideY, yawRad: 0 });
  }

  // Ends (±X): at least one chair per end when the end is wide enough
  const nEnd = countAlong(tableDepthMm);
  if (tableDepthMm >= 28 * IN || tableWidthMm >= 4 * FT) {
    for (let i = 0; i < nEnd; i++) {
      const t = nEnd === 1 ? 0.5 : i / (nEnd - 1);
      const span = Math.max(0, tableDepthMm - cornerPad * 2);
      const y = nEnd === 1 ? 0 : -span / 2 + t * span;
      slots.push({ xMm: endX, yMm: y, yawRad: -Math.PI / 2 });
      slots.push({ xMm: -endX, yMm: y, yawRad: Math.PI / 2 });
    }
  }

  return slots;
}

/**
 * Plan / hit-test size for a placed object.
 * Dining sets store tabletop size; footprint includes chair clearance.
 */
export function objectPlanSizeMm(obj: {
  catalogItemId: string;
  widthMm: number;
  depthMm: number;
}): { widthMm: number; depthMm: number } {
  if (isDiningSetId(obj.catalogItemId)) {
    return diningOverallFootprintMm(
      obj.widthMm,
      obj.depthMm,
      diningTableShape(obj.catalogItemId),
    );
  }
  return { widthMm: obj.widthMm, depthMm: obj.depthMm };
}
