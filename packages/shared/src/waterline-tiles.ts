/**
 * Authorable pool/spa waterline tile finishes for 2D pickers + 3D preview.
 * Stored on PoolBody.waterlineTileId. Takeoff still uses catalog `waterline_tile` LF.
 *
 * Sizes / styles follow common US residential practice:
 * - 6″ × 6″ porcelain (classic single-course waterline)
 * - ~¾″–1″ glass mosaic blends (Oceanside / AIM style)
 * - 2″ × 2″ ceramic mosaic
 * - 2″ × 6″ brick / subway accents
 */

export type WaterlineTileCategory =
  | "porcelain_6x6"
  | "glass_mosaic"
  | "ceramic_mosaic"
  | "brick";

export type WaterlineTilePattern =
  | "grid"
  | "mosaic"
  | "mosaic_offset"
  | "blend_band"
  | "running_bond";

export type WaterlineTileColor = { r: number; g: number; b: number };

export type WaterlineTile = {
  id: string;
  name: string;
  category: WaterlineTileCategory;
  pattern: WaterlineTilePattern;
  colorName: string;
  /** Primary / dominant tile color. */
  color: WaterlineTileColor;
  /** Grout or secondary tone. */
  accent: WaterlineTileColor;
  /** Extra mosaic chip colors for blends (optional). */
  blend?: WaterlineTileColor[];
  /** Iridescent / glossy glass look. */
  iridescent?: boolean;
  description?: string;
};

export const DEFAULT_WATERLINE_TILE_ID = "wl_glass_caribbean_blue";

export const WATERLINE_TILE_CATEGORIES: WaterlineTileCategory[] = [
  "porcelain_6x6",
  "glass_mosaic",
  "ceramic_mosaic",
  "brick",
];

export const WATERLINE_TILE_CATEGORY_LABELS: Record<
  WaterlineTileCategory,
  string
> = {
  porcelain_6x6: "6×6 porcelain",
  glass_mosaic: "Glass mosaic",
  ceramic_mosaic: "Ceramic mosaic",
  brick: "Brick / subway",
};

export const WATERLINE_TILE_PATTERN_LABELS: Record<
  WaterlineTilePattern,
  string
> = {
  grid: "Straight set",
  mosaic: "Mosaic",
  mosaic_offset: "Offset mosaic",
  blend_band: "Blend band",
  running_bond: "Running bond",
};

const rgb = (r: number, g: number, b: number): WaterlineTileColor => ({
  r,
  g,
  b,
});

export const WATERLINE_TILES: WaterlineTile[] = [
  // —— 6×6 porcelain (classic waterline course) ——
  {
    id: "wl_porcelain_gloss_white",
    name: "6×6 porcelain — gloss white",
    category: "porcelain_6x6",
    pattern: "grid",
    colorName: "Gloss white",
    color: rgb(242, 246, 248),
    accent: rgb(200, 206, 210),
    description: "Classic single-course 6″ × 6″ glazed porcelain",
  },
  {
    id: "wl_porcelain_ivory",
    name: "6×6 porcelain — ivory",
    category: "porcelain_6x6",
    pattern: "grid",
    colorName: "Ivory",
    color: rgb(236, 228, 210),
    accent: rgb(190, 180, 160),
  },
  {
    id: "wl_porcelain_soft_grey",
    name: "6×6 porcelain — soft grey",
    category: "porcelain_6x6",
    pattern: "grid",
    colorName: "Soft grey",
    color: rgb(186, 192, 198),
    accent: rgb(140, 146, 152),
  },
  {
    id: "wl_porcelain_charcoal",
    name: "6×6 porcelain — charcoal",
    category: "porcelain_6x6",
    pattern: "grid",
    colorName: "Charcoal",
    color: rgb(72, 78, 86),
    accent: rgb(48, 52, 58),
  },
  {
    id: "wl_porcelain_sky_blue",
    name: "6×6 porcelain — sky blue",
    category: "porcelain_6x6",
    pattern: "grid",
    colorName: "Sky blue",
    color: rgb(140, 190, 220),
    accent: rgb(110, 150, 175),
  },
  {
    id: "wl_porcelain_navy",
    name: "6×6 porcelain — navy",
    category: "porcelain_6x6",
    pattern: "grid",
    colorName: "Navy",
    color: rgb(36, 68, 118),
    accent: rgb(28, 48, 82),
  },
  {
    id: "wl_porcelain_teal",
    name: "6×6 porcelain — teal",
    category: "porcelain_6x6",
    pattern: "grid",
    colorName: "Teal",
    color: rgb(42, 140, 148),
    accent: rgb(32, 100, 108),
  },
  {
    id: "wl_porcelain_aqua",
    name: "6×6 porcelain — aqua",
    category: "porcelain_6x6",
    pattern: "grid",
    colorName: "Aqua",
    color: rgb(110, 198, 198),
    accent: rgb(80, 150, 150),
  },
  {
    id: "wl_porcelain_sand",
    name: "6×6 porcelain — sand",
    category: "porcelain_6x6",
    pattern: "grid",
    colorName: "Sand",
    color: rgb(214, 196, 160),
    accent: rgb(170, 150, 120),
  },
  {
    id: "wl_porcelain_black",
    name: "6×6 porcelain — black",
    category: "porcelain_6x6",
    pattern: "grid",
    colorName: "Black",
    color: rgb(28, 30, 34),
    accent: rgb(55, 58, 62),
  },

  // —— Glass mosaic blends (¾″–1″ chips) ——
  {
    id: "wl_glass_caribbean_blue",
    name: "Glass mosaic — Caribbean blue",
    category: "glass_mosaic",
    pattern: "mosaic",
    colorName: "Caribbean blue",
    color: rgb(48, 158, 198),
    accent: rgb(210, 220, 224),
    blend: [
      rgb(72, 180, 210),
      rgb(36, 130, 175),
      rgb(120, 210, 230),
      rgb(55, 150, 185),
      rgb(90, 200, 220),
    ],
    iridescent: true,
    description: "Popular iridescent Caribbean / aqua glass blend",
  },
  {
    id: "wl_glass_cobalt",
    name: "Glass mosaic — cobalt",
    category: "glass_mosaic",
    pattern: "mosaic",
    colorName: "Cobalt",
    color: rgb(28, 72, 168),
    accent: rgb(200, 210, 220),
    blend: [
      rgb(40, 90, 190),
      rgb(20, 55, 140),
      rgb(70, 120, 210),
      rgb(35, 80, 175),
      rgb(55, 100, 200),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_indigo",
    name: "Glass mosaic — indigo deep",
    category: "glass_mosaic",
    pattern: "mosaic",
    colorName: "Indigo",
    color: rgb(40, 48, 120),
    accent: rgb(190, 195, 205),
    blend: [
      rgb(55, 60, 140),
      rgb(30, 35, 95),
      rgb(70, 80, 160),
      rgb(45, 55, 130),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_turquoise",
    name: "Glass mosaic — turquoise",
    category: "glass_mosaic",
    pattern: "mosaic",
    colorName: "Turquoise",
    color: rgb(32, 170, 168),
    accent: rgb(205, 215, 218),
    blend: [
      rgb(50, 190, 185),
      rgb(20, 145, 148),
      rgb(80, 210, 200),
      rgb(40, 175, 172),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_seafoam",
    name: "Glass mosaic — seafoam",
    category: "glass_mosaic",
    pattern: "mosaic_offset",
    colorName: "Seafoam",
    color: rgb(140, 200, 185),
    accent: rgb(210, 218, 214),
    blend: [
      rgb(160, 215, 200),
      rgb(110, 180, 165),
      rgb(185, 225, 215),
      rgb(130, 195, 178),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_ocean_mist",
    name: "Glass mosaic — ocean mist",
    category: "glass_mosaic",
    pattern: "blend_band",
    colorName: "Ocean mist",
    color: rgb(150, 185, 205),
    accent: rgb(215, 220, 222),
    blend: [
      rgb(175, 205, 220),
      rgb(120, 160, 185),
      rgb(200, 220, 230),
      rgb(95, 140, 170),
      rgb(160, 190, 210),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_tide",
    name: "Glass mosaic — tide",
    category: "glass_mosaic",
    pattern: "mosaic",
    colorName: "Tide",
    color: rgb(90, 150, 175),
    accent: rgb(205, 212, 216),
    blend: [
      rgb(110, 170, 190),
      rgb(70, 130, 155),
      rgb(140, 190, 205),
      rgb(85, 145, 170),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_bondi",
    name: "Glass mosaic — Bondi blue",
    category: "glass_mosaic",
    pattern: "mosaic_offset",
    colorName: "Bondi blue",
    color: rgb(55, 140, 195),
    accent: rgb(208, 216, 220),
    blend: [
      rgb(75, 160, 210),
      rgb(40, 115, 170),
      rgb(100, 180, 220),
      rgb(60, 145, 190),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_jade",
    name: "Glass mosaic — jade",
    category: "glass_mosaic",
    pattern: "mosaic",
    colorName: "Jade",
    color: rgb(55, 140, 120),
    accent: rgb(200, 210, 205),
    blend: [
      rgb(75, 160, 140),
      rgb(40, 115, 100),
      rgb(100, 180, 155),
      rgb(60, 145, 125),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_clear_ice",
    name: "Glass mosaic — clear ice",
    category: "glass_mosaic",
    pattern: "mosaic",
    colorName: "Clear ice",
    color: rgb(220, 232, 238),
    accent: rgb(185, 195, 200),
    blend: [
      rgb(235, 242, 246),
      rgb(200, 215, 225),
      rgb(245, 248, 250),
      rgb(190, 210, 220),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_platinum",
    name: "Glass mosaic — platinum",
    category: "glass_mosaic",
    pattern: "mosaic",
    colorName: "Platinum",
    color: rgb(180, 186, 192),
    accent: rgb(150, 155, 160),
    blend: [
      rgb(200, 205, 210),
      rgb(160, 165, 172),
      rgb(215, 218, 222),
      rgb(145, 150, 158),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_champagne",
    name: "Glass mosaic — champagne",
    category: "glass_mosaic",
    pattern: "blend_band",
    colorName: "Champagne",
    color: rgb(220, 205, 170),
    accent: rgb(185, 175, 150),
    blend: [
      rgb(235, 220, 185),
      rgb(200, 185, 150),
      rgb(245, 235, 205),
      rgb(190, 170, 135),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_sandbar",
    name: "Glass mosaic — sandbar",
    category: "glass_mosaic",
    pattern: "mosaic_offset",
    colorName: "Sandbar",
    color: rgb(210, 190, 155),
    accent: rgb(175, 160, 135),
    blend: [
      rgb(225, 205, 170),
      rgb(190, 170, 140),
      rgb(235, 220, 190),
      rgb(175, 155, 125),
    ],
    iridescent: false,
  },
  {
    id: "wl_glass_storm",
    name: "Glass mosaic — storm",
    category: "glass_mosaic",
    pattern: "blend_band",
    colorName: "Storm",
    color: rgb(120, 130, 140),
    accent: rgb(175, 180, 185),
    blend: [
      rgb(150, 158, 165),
      rgb(95, 105, 115),
      rgb(180, 186, 190),
      rgb(70, 78, 88),
      rgb(130, 140, 148),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_black_pearl",
    name: "Glass mosaic — black pearl",
    category: "glass_mosaic",
    pattern: "mosaic",
    colorName: "Black pearl",
    color: rgb(35, 40, 48),
    accent: rgb(90, 95, 100),
    blend: [
      rgb(50, 55, 65),
      rgb(25, 28, 34),
      rgb(70, 75, 85),
      rgb(40, 45, 55),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_sunset",
    name: "Glass mosaic — sunset coral",
    category: "glass_mosaic",
    pattern: "blend_band",
    colorName: "Sunset coral",
    color: rgb(220, 130, 110),
    accent: rgb(200, 185, 175),
    blend: [
      rgb(235, 155, 120),
      rgb(200, 100, 95),
      rgb(245, 185, 140),
      rgb(180, 85, 90),
      rgb(230, 160, 130),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_amethyst",
    name: "Glass mosaic — amethyst",
    category: "glass_mosaic",
    pattern: "mosaic",
    colorName: "Amethyst",
    color: rgb(110, 80, 150),
    accent: rgb(195, 190, 205),
    blend: [
      rgb(130, 95, 170),
      rgb(90, 60, 130),
      rgb(155, 120, 185),
      rgb(100, 75, 145),
    ],
    iridescent: true,
  },
  {
    id: "wl_glass_cypress",
    name: "Glass mosaic — cypress bay",
    category: "glass_mosaic",
    pattern: "mosaic_offset",
    colorName: "Cypress bay",
    color: rgb(70, 120, 105),
    accent: rgb(185, 195, 188),
    blend: [
      rgb(90, 145, 125),
      rgb(55, 100, 88),
      rgb(120, 165, 145),
      rgb(75, 130, 110),
    ],
    iridescent: true,
  },

  // —— Ceramic / porcelain mosaic 2×2 ——
  {
    id: "wl_ceramic_blue_blend",
    name: "Ceramic mosaic — blue blend",
    category: "ceramic_mosaic",
    pattern: "mosaic",
    colorName: "Blue blend",
    color: rgb(95, 145, 185),
    accent: rgb(195, 200, 205),
    blend: [
      rgb(120, 165, 200),
      rgb(70, 120, 160),
      rgb(145, 185, 215),
      rgb(90, 140, 180),
    ],
  },
  {
    id: "wl_ceramic_mediterranean",
    name: "Ceramic mosaic — Mediterranean cobalt",
    category: "ceramic_mosaic",
    pattern: "mosaic_offset",
    colorName: "Mediterranean",
    color: rgb(45, 95, 165),
    accent: rgb(210, 205, 190),
    blend: [
      rgb(60, 115, 185),
      rgb(35, 75, 140),
      rgb(90, 140, 195),
      rgb(220, 210, 185),
    ],
    description: "Decorative cobalt + sand ceramic mosaic",
  },
  {
    id: "wl_ceramic_wave_blue",
    name: "Ceramic mosaic — wave blue",
    category: "ceramic_mosaic",
    pattern: "blend_band",
    colorName: "Wave blue",
    color: rgb(80, 150, 195),
    accent: rgb(200, 208, 212),
    blend: [
      rgb(110, 175, 210),
      rgb(55, 120, 165),
      rgb(150, 195, 220),
      rgb(70, 140, 180),
    ],
  },
  {
    id: "wl_ceramic_stone_grey",
    name: "Ceramic mosaic — stone grey",
    category: "ceramic_mosaic",
    pattern: "mosaic",
    colorName: "Stone grey",
    color: rgb(150, 152, 156),
    accent: rgb(120, 122, 126),
    blend: [
      rgb(170, 172, 176),
      rgb(130, 132, 136),
      rgb(185, 186, 188),
      rgb(115, 118, 122),
    ],
  },
  {
    id: "wl_ceramic_terra",
    name: "Ceramic mosaic — terra cotta",
    category: "ceramic_mosaic",
    pattern: "mosaic_offset",
    colorName: "Terra cotta",
    color: rgb(180, 110, 85),
    accent: rgb(195, 180, 165),
    blend: [
      rgb(200, 130, 100),
      rgb(155, 90, 70),
      rgb(215, 150, 120),
      rgb(170, 100, 80),
    ],
  },

  // —— Brick / subway 2×6 accents ——
  {
    id: "wl_brick_white",
    name: "Subway — gloss white",
    category: "brick",
    pattern: "running_bond",
    colorName: "Gloss white",
    color: rgb(240, 244, 246),
    accent: rgb(195, 200, 205),
    description: "2″ × 6″ glazed subway running bond",
  },
  {
    id: "wl_brick_sky",
    name: "Subway — sky blue",
    category: "brick",
    pattern: "running_bond",
    colorName: "Sky blue",
    color: rgb(145, 190, 215),
    accent: rgb(115, 150, 170),
  },
  {
    id: "wl_brick_navy",
    name: "Subway — navy",
    category: "brick",
    pattern: "running_bond",
    colorName: "Navy",
    color: rgb(40, 70, 120),
    accent: rgb(30, 50, 85),
  },
  {
    id: "wl_brick_teal",
    name: "Subway — teal",
    category: "brick",
    pattern: "running_bond",
    colorName: "Teal",
    color: rgb(45, 135, 140),
    accent: rgb(35, 100, 105),
  },
  {
    id: "wl_brick_sand",
    name: "Subway — sand",
    category: "brick",
    pattern: "running_bond",
    colorName: "Sand",
    color: rgb(210, 192, 160),
    accent: rgb(165, 148, 120),
  },
  {
    id: "wl_brick_charcoal",
    name: "Subway — charcoal",
    category: "brick",
    pattern: "running_bond",
    colorName: "Charcoal",
    color: rgb(70, 74, 80),
    accent: rgb(48, 50, 54),
  },
];

const BY_ID = new Map(WATERLINE_TILES.map((t) => [t.id, t]));

export function getWaterlineTile(id: string | undefined | null): WaterlineTile {
  if (id && BY_ID.has(id)) return BY_ID.get(id)!;
  return BY_ID.get(DEFAULT_WATERLINE_TILE_ID)!;
}

export function isWaterlineTileId(id: string): boolean {
  return BY_ID.has(id);
}

export function waterlineTilesByCategory(
  category: WaterlineTileCategory,
): WaterlineTile[] {
  return WATERLINE_TILES.filter((t) => t.category === category);
}

export function waterlinePatternsInCategory(
  category: WaterlineTileCategory,
): WaterlineTilePattern[] {
  const seen = new Set<WaterlineTilePattern>();
  const patterns: WaterlineTilePattern[] = [];
  for (const t of WATERLINE_TILES) {
    if (t.category !== category || seen.has(t.pattern)) continue;
    seen.add(t.pattern);
    patterns.push(t.pattern);
  }
  return patterns;
}

export function waterlineTilesForPattern(
  category: WaterlineTileCategory,
  pattern: WaterlineTilePattern,
): WaterlineTile[] {
  return WATERLINE_TILES.filter(
    (t) => t.category === category && t.pattern === pattern,
  );
}

export function resolveWaterlineTile(opts: {
  category: WaterlineTileCategory;
  pattern?: WaterlineTilePattern;
  colorName?: string;
}): WaterlineTile {
  const patterns = waterlinePatternsInCategory(opts.category);
  const pattern =
    opts.pattern && patterns.includes(opts.pattern)
      ? opts.pattern
      : patterns[0];
  const colors = waterlineTilesForPattern(opts.category, pattern);
  if (opts.colorName) {
    const match = colors.find((c) => c.colorName === opts.colorName);
    if (match) return match;
  }
  return colors[0] ?? getWaterlineTile(DEFAULT_WATERLINE_TILE_ID);
}

export function waterlineTileCssColor(c: WaterlineTileColor): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}

/** Default nosing band width on steps / sunshelf (~6″). */
export const DEFAULT_WATERLINE_NOSING_BAND_MM = 152.4;
/** Practical authorable range for tread / shelf edge bands. */
export const MIN_WATERLINE_NOSING_BAND_MM = 25.4; // 1″
export const MAX_WATERLINE_NOSING_BAND_MM = 457.2; // 18″

/** Resolve and clamp a feature nosing band width (mm). */
export function waterlineNosingBandMm(
  bandMm: number | undefined | null,
): number {
  if (bandMm == null || !Number.isFinite(bandMm)) {
    return DEFAULT_WATERLINE_NOSING_BAND_MM;
  }
  return Math.min(
    MAX_WATERLINE_NOSING_BAND_MM,
    Math.max(MIN_WATERLINE_NOSING_BAND_MM, bandMm),
  );
}
