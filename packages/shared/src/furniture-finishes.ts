/**
 * Authorable outdoor furniture finishes for Properties + 3D preview.
 * Stored on PlacedObject.frameFinishId / fabricFinishId.
 */

export type FurnitureFinishKind = "wood" | "fabric" | "canvas";

export type FurnitureFinishColor = { r: number; g: number; b: number };

export type FurnitureFinish = {
  id: string;
  name: string;
  kind: FurnitureFinishKind;
  colorName: string;
  color: FurnitureFinishColor;
  /** Grain / weave secondary tone */
  accent: FurnitureFinishColor;
  description?: string;
};

export const DEFAULT_FURNITURE_FRAME_FINISH_ID = "wood_teak";
export const DEFAULT_FURNITURE_FABRIC_FINISH_ID = "fabric_sage";
export const DEFAULT_FURNITURE_CANOPY_FINISH_ID = "canvas_sand";

export const FURNITURE_FINISH_KIND_LABELS: Record<FurnitureFinishKind, string> =
  {
    wood: "Frame / wood",
    fabric: "Cushion / sling",
    canvas: "Canopy",
  };

const rgb = (r: number, g: number, b: number): FurnitureFinishColor => ({
  r,
  g,
  b,
});

export const FURNITURE_FINISHES: FurnitureFinish[] = [
  // —— Wood / frame ——
  {
    id: "wood_teak",
    name: "Teak",
    kind: "wood",
    colorName: "Teak",
    color: rgb(168, 118, 62),
    accent: rgb(120, 78, 36),
    description: "Warm outdoor teak",
  },
  {
    id: "wood_walnut",
    name: "Walnut",
    kind: "wood",
    colorName: "Walnut",
    color: rgb(92, 62, 42),
    accent: rgb(62, 40, 28),
  },
  {
    id: "wood_whitewash",
    name: "Whitewash",
    kind: "wood",
    colorName: "Whitewash",
    color: rgb(214, 204, 188),
    accent: rgb(176, 164, 146),
  },
  {
    id: "wood_charcoal",
    name: "Charcoal",
    kind: "wood",
    colorName: "Charcoal",
    color: rgb(72, 74, 78),
    accent: rgb(48, 50, 54),
  },
  {
    id: "wood_cedar",
    name: "Cedar",
    kind: "wood",
    colorName: "Cedar",
    color: rgb(186, 112, 78),
    accent: rgb(148, 78, 48),
  },
  // —— Fabric / cushion ——
  {
    id: "fabric_sage",
    name: "Sage",
    kind: "fabric",
    colorName: "Sage",
    color: rgb(88, 118, 102),
    accent: rgb(68, 96, 84),
  },
  {
    id: "fabric_navy",
    name: "Navy",
    kind: "fabric",
    colorName: "Navy",
    color: rgb(48, 72, 110),
    accent: rgb(32, 52, 86),
  },
  {
    id: "fabric_sand",
    name: "Sand",
    kind: "fabric",
    colorName: "Sand",
    color: rgb(196, 178, 148),
    accent: rgb(164, 146, 118),
  },
  {
    id: "fabric_terracotta",
    name: "Terracotta",
    kind: "fabric",
    colorName: "Terracotta",
    color: rgb(176, 96, 72),
    accent: rgb(140, 70, 52),
  },
  {
    id: "fabric_charcoal",
    name: "Charcoal",
    kind: "fabric",
    colorName: "Charcoal",
    color: rgb(70, 74, 80),
    accent: rgb(48, 52, 58),
  },
  {
    id: "fabric_white",
    name: "Off-white",
    kind: "fabric",
    colorName: "Off-white",
    color: rgb(232, 228, 218),
    accent: rgb(200, 196, 186),
  },
  // —— Umbrella canvas ——
  {
    id: "canvas_sand",
    name: "Sand canvas",
    kind: "canvas",
    colorName: "Sand",
    color: rgb(168, 148, 118),
    accent: rgb(138, 120, 92),
  },
  {
    id: "canvas_white",
    name: "White canvas",
    kind: "canvas",
    colorName: "White",
    color: rgb(236, 232, 224),
    accent: rgb(200, 196, 188),
  },
  {
    id: "canvas_navy",
    name: "Navy canvas",
    kind: "canvas",
    colorName: "Navy",
    color: rgb(52, 72, 108),
    accent: rgb(36, 52, 84),
  },
  {
    id: "canvas_charcoal",
    name: "Charcoal canvas",
    kind: "canvas",
    colorName: "Charcoal",
    color: rgb(68, 70, 76),
    accent: rgb(46, 48, 52),
  },
  {
    id: "canvas_forest",
    name: "Forest canvas",
    kind: "canvas",
    colorName: "Forest",
    color: rgb(62, 96, 78),
    accent: rgb(44, 72, 58),
  },
];

const byId = new Map(FURNITURE_FINISHES.map((f) => [f.id, f]));

export function isFurnitureFinishId(id: string | undefined | null): boolean {
  return typeof id === "string" && byId.has(id);
}

export function getFurnitureFinish(
  id: string | undefined | null,
  fallbackId: string = DEFAULT_FURNITURE_FRAME_FINISH_ID,
): FurnitureFinish {
  if (id && byId.has(id)) return byId.get(id)!;
  return byId.get(fallbackId) ?? FURNITURE_FINISHES[0];
}

export function furnitureFinishesForKind(
  kind: FurnitureFinishKind,
): FurnitureFinish[] {
  return FURNITURE_FINISHES.filter((f) => f.kind === kind);
}

export function furnitureFinishCssColor(c: FurnitureFinishColor): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

/** Which finish pickers apply to a catalog item. */
export function furnitureFinishRoles(catalogItemId: string): {
  frame: boolean;
  fabric: boolean;
  canopy: boolean;
} {
  if (
    catalogItemId === "lounge_chair" ||
    catalogItemId === "sunshelf_chaise" ||
    catalogItemId === "sofa_outdoor" ||
    catalogItemId === "dining_table_set" ||
    catalogItemId === "dining_table_rect" ||
    catalogItemId === "dining_table_round"
  ) {
    return { frame: true, fabric: true, canopy: false };
  }
  if (catalogItemId === "sunshelf_table" || catalogItemId === "cover_fan") {
    return { frame: true, fabric: false, canopy: false };
  }
  if (catalogItemId === "umbrella") {
    return { frame: false, fabric: false, canopy: true };
  }
  if (catalogItemId === "trellis" || catalogItemId === "trellis_arbor") {
    return { frame: true, fabric: false, canopy: false };
  }
  return { frame: false, fabric: false, canopy: false };
}

export function defaultFrameFinishId(catalogItemId: string): string | undefined {
  if (catalogItemId === "trellis" || catalogItemId === "trellis_arbor") {
    return "wood_cedar";
  }
  return furnitureFinishRoles(catalogItemId).frame
    ? DEFAULT_FURNITURE_FRAME_FINISH_ID
    : undefined;
}

export function defaultFabricFinishId(
  catalogItemId: string,
): string | undefined {
  const roles = furnitureFinishRoles(catalogItemId);
  if (roles.fabric) return DEFAULT_FURNITURE_FABRIC_FINISH_ID;
  if (roles.canopy) return DEFAULT_FURNITURE_CANOPY_FINISH_ID;
  return undefined;
}
