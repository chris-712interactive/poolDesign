/**
 * House exterior wall colors — presets + optional custom RGB.
 * Stored on Building.exteriorFinishId / Building.exteriorColor.
 */

export type HouseExteriorColor = { r: number; g: number; b: number };

export type HouseExteriorFinish = {
  id: string;
  name: string;
  /** Short swatch label in the picker. */
  colorName: string;
  color: HouseExteriorColor;
  description?: string;
};

/** Sentinel id when the user picks a freeform RGB color. */
export const HOUSE_EXTERIOR_CUSTOM_ID = "custom";

export const DEFAULT_HOUSE_EXTERIOR_FINISH_ID = "house_white";

const rgb = (r: number, g: number, b: number): HouseExteriorColor => ({
  r,
  g,
  b,
});

/** ~20 common exterior house paints (stucco / siding / masonry). */
export const HOUSE_EXTERIOR_FINISHES: HouseExteriorFinish[] = [
  {
    id: "house_white",
    name: "White",
    colorName: "White",
    color: rgb(245, 244, 240),
    description: "Clean bright white",
  },
  {
    id: "house_ivory",
    name: "Ivory",
    colorName: "Ivory",
    color: rgb(236, 228, 210),
  },
  {
    id: "house_cream",
    name: "Cream",
    colorName: "Cream",
    color: rgb(232, 218, 186),
  },
  {
    id: "house_beige",
    name: "Beige",
    colorName: "Beige",
    color: rgb(210, 192, 162),
  },
  {
    id: "house_sand",
    name: "Sand",
    colorName: "Sand",
    color: rgb(198, 178, 148),
  },
  {
    id: "house_taupe",
    name: "Taupe",
    colorName: "Taupe",
    color: rgb(168, 152, 136),
  },
  {
    id: "house_light_gray",
    name: "Light gray",
    colorName: "Lt gray",
    color: rgb(196, 198, 200),
  },
  {
    id: "house_medium_gray",
    name: "Medium gray",
    colorName: "Gray",
    color: rgb(148, 150, 152),
  },
  {
    id: "house_charcoal",
    name: "Charcoal",
    colorName: "Charcoal",
    color: rgb(72, 74, 78),
  },
  {
    id: "house_soft_sage",
    name: "Soft sage",
    colorName: "Soft sage",
    color: rgb(178, 188, 168),
  },
  {
    id: "house_sage",
    name: "Sage",
    colorName: "Sage",
    color: rgb(128, 148, 118),
  },
  {
    id: "house_forest",
    name: "Forest green",
    colorName: "Forest",
    color: rgb(58, 86, 64),
  },
  {
    id: "house_soft_blue",
    name: "Soft blue",
    colorName: "Soft blue",
    color: rgb(168, 186, 200),
  },
  {
    id: "house_slate_blue",
    name: "Slate blue",
    colorName: "Slate",
    color: rgb(98, 118, 138),
  },
  {
    id: "house_navy",
    name: "Navy",
    colorName: "Navy",
    color: rgb(42, 58, 86),
  },
  {
    id: "house_buttercream",
    name: "Buttercream",
    colorName: "Butter",
    color: rgb(236, 214, 150),
  },
  {
    id: "house_terracotta",
    name: "Terracotta",
    colorName: "Terra",
    color: rgb(176, 98, 72),
  },
  {
    id: "house_clay",
    name: "Clay",
    colorName: "Clay",
    color: rgb(168, 118, 98),
  },
  {
    id: "house_blush",
    name: "Blush",
    colorName: "Blush",
    color: rgb(214, 186, 178),
  },
  {
    id: "house_espresso",
    name: "Espresso",
    colorName: "Espresso",
    color: rgb(62, 46, 36),
  },
];

const BY_ID = new Map(HOUSE_EXTERIOR_FINISHES.map((f) => [f.id, f]));

export function isHouseExteriorFinishId(
  id: string | undefined | null,
): id is string {
  return typeof id === "string" && BY_ID.has(id);
}

export function isHouseExteriorCustomId(
  id: string | undefined | null,
): boolean {
  return id === HOUSE_EXTERIOR_CUSTOM_ID;
}

export function getHouseExteriorFinish(id: string): HouseExteriorFinish {
  return BY_ID.get(id) ?? getHouseExteriorFinish(DEFAULT_HOUSE_EXTERIOR_FINISH_ID);
}

export function clampHouseExteriorChannel(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(255, Math.max(0, Math.round(n)));
}

export function clampHouseExteriorColor(
  color: Partial<HouseExteriorColor> | null | undefined,
  fallback: HouseExteriorColor = getHouseExteriorFinish(
    DEFAULT_HOUSE_EXTERIOR_FINISH_ID,
  ).color,
): HouseExteriorColor {
  if (!color) return { ...fallback };
  return {
    r: clampHouseExteriorChannel(
      typeof color.r === "number" ? color.r : fallback.r,
    ),
    g: clampHouseExteriorChannel(
      typeof color.g === "number" ? color.g : fallback.g,
    ),
    b: clampHouseExteriorChannel(
      typeof color.b === "number" ? color.b : fallback.b,
    ),
  };
}

export function resolveHouseExteriorFinishId(
  finishId?: string | null,
): string {
  if (isHouseExteriorCustomId(finishId)) return HOUSE_EXTERIOR_CUSTOM_ID;
  if (isHouseExteriorFinishId(finishId)) return finishId;
  return DEFAULT_HOUSE_EXTERIOR_FINISH_ID;
}

/** Effective exterior RGB for a building (preset or custom). */
export function resolveHouseExteriorColor(
  finishId?: string | null,
  customColor?: Partial<HouseExteriorColor> | null,
): HouseExteriorColor {
  const id = resolveHouseExteriorFinishId(finishId);
  if (id === HOUSE_EXTERIOR_CUSTOM_ID) {
    return clampHouseExteriorColor(customColor);
  }
  return { ...getHouseExteriorFinish(id).color };
}

export function houseExteriorCssColor(color: HouseExteriorColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export function houseExteriorHex(color: HouseExteriorColor): string {
  const h = (n: number) =>
    clampHouseExteriorChannel(n).toString(16).padStart(2, "0");
  return `#${h(color.r)}${h(color.g)}${h(color.b)}`;
}

export function houseExteriorColorFromHex(
  hex: string,
): HouseExteriorColor | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

/** Semi-transparent fill for 2D plan preview. */
export function houseExteriorPlanFill(color: HouseExteriorColor): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, 0.42)`;
}

export function houseExteriorPlanStroke(
  color: HouseExteriorColor,
  selected: boolean,
): string {
  if (selected) {
    return houseExteriorHex({
      r: Math.max(0, color.r - 40),
      g: Math.max(0, color.g - 40),
      b: Math.max(0, color.b - 40),
    });
  }
  return houseExteriorHex({
    r: Math.max(0, color.r - 28),
    g: Math.max(0, color.g - 28),
    b: Math.max(0, color.b - 28),
  });
}
