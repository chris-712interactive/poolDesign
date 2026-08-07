/**
 * Authorable patio / deck surface finishes for 2D properties + 3D preview.
 * Stored on PatioRegion.materialId.
 */

export type PatioFinishCategory = "concrete" | "paver" | "stone";

export type PatioFinishPattern =
  | "broomed"
  | "smooth"
  | "exposed_aggregate"
  | "stamped_ashlar"
  | "stamped_cobble"
  | "stamped_plank"
  | "running_bond"
  | "herringbone"
  | "basketweave"
  | "stack_bond"
  | "modular"
  | "travertine"
  | "bluestone"
  | "porcelain"
  | "coral";

export type PatioFinishColor = { r: number; g: number; b: number };

export type PatioFinish = {
  id: string;
  name: string;
  category: PatioFinishCategory;
  pattern: PatioFinishPattern;
  /** Short color label for the picker (e.g. "Light", "Buff"). */
  colorName: string;
  /** Primary surface color. */
  color: PatioFinishColor;
  /** Grout / joint / secondary tone. */
  accent: PatioFinishColor;
  description?: string;
};

export const DEFAULT_PATIO_FINISH_ID = "concrete_broomed_medium";

export const PATIO_FINISH_CATEGORIES: PatioFinishCategory[] = [
  "concrete",
  "paver",
  "stone",
];

export const PATIO_FINISH_CATEGORY_LABELS: Record<PatioFinishCategory, string> =
  {
    concrete: "Concrete",
    paver: "Pavers",
    stone: "Stone & porcelain",
  };

export const PATIO_FINISH_PATTERN_LABELS: Record<PatioFinishPattern, string> = {
  broomed: "Broomed",
  smooth: "Smooth trowel",
  exposed_aggregate: "Exposed aggregate",
  stamped_ashlar: "Stamped ashlar",
  stamped_cobble: "Stamped cobble",
  stamped_plank: "Stamped plank",
  running_bond: "Running bond",
  herringbone: "Herringbone",
  basketweave: "Basketweave",
  stack_bond: "Stack bond",
  modular: "Modular mix",
  travertine: "Travertine",
  bluestone: "Bluestone",
  porcelain: "Porcelain",
  coral: "Coral / keystone",
};

const rgb = (r: number, g: number, b: number): PatioFinishColor => ({
  r,
  g,
  b,
});

export const PATIO_FINISHES: PatioFinish[] = [
  // —— Concrete ——
  {
    id: "concrete_broomed_light",
    name: "Broomed concrete — light",
    category: "concrete",
    pattern: "broomed",
    colorName: "Light",
    color: rgb(198, 192, 182),
    accent: rgb(170, 162, 150),
    description: "Light gray broomed finish",
  },
  {
    id: "concrete_broomed_medium",
    name: "Broomed concrete — medium",
    category: "concrete",
    pattern: "broomed",
    colorName: "Medium",
    color: rgb(168, 158, 144),
    accent: rgb(140, 128, 112),
    description: "Standard residential deck concrete",
  },
  {
    id: "concrete_broomed_charcoal",
    name: "Broomed concrete — charcoal",
    category: "concrete",
    pattern: "broomed",
    colorName: "Charcoal",
    color: rgb(92, 92, 96),
    accent: rgb(70, 70, 74),
  },
  {
    id: "concrete_smooth",
    name: "Smooth troweled concrete",
    category: "concrete",
    pattern: "smooth",
    colorName: "Natural",
    color: rgb(186, 180, 172),
    accent: rgb(160, 154, 146),
  },
  {
    id: "concrete_exposed_aggregate",
    name: "Exposed aggregate",
    category: "concrete",
    pattern: "exposed_aggregate",
    colorName: "Natural",
    color: rgb(150, 142, 128),
    accent: rgb(110, 105, 95),
  },
  {
    id: "concrete_stamped_ashlar",
    name: "Stamped — ashlar slate",
    category: "concrete",
    pattern: "stamped_ashlar",
    colorName: "Slate",
    color: rgb(142, 138, 132),
    accent: rgb(100, 96, 90),
  },
  {
    id: "concrete_stamped_cobble",
    name: "Stamped — cobblestone",
    category: "concrete",
    pattern: "stamped_cobble",
    colorName: "Tan",
    color: rgb(158, 140, 120),
    accent: rgb(110, 95, 80),
  },
  {
    id: "concrete_stamped_plank",
    name: "Stamped — wood plank",
    category: "concrete",
    pattern: "stamped_plank",
    colorName: "Wood",
    color: rgb(148, 118, 88),
    accent: rgb(100, 78, 58),
  },

  // —— Pavers — patterns / colors ——
  {
    id: "paver_running_brick_red",
    name: "Running bond — clay brick red",
    category: "paver",
    pattern: "running_bond",
    colorName: "Brick red",
    color: rgb(158, 72, 58),
    accent: rgb(120, 110, 100),
  },
  {
    id: "paver_running_brick_burgundy",
    name: "Running bond — burgundy",
    category: "paver",
    pattern: "running_bond",
    colorName: "Burgundy",
    color: rgb(110, 48, 52),
    accent: rgb(100, 92, 88),
  },
  {
    id: "paver_running_buff",
    name: "Running bond — buff",
    category: "paver",
    pattern: "running_bond",
    colorName: "Buff",
    color: rgb(186, 160, 118),
    accent: rgb(130, 120, 108),
  },
  {
    id: "paver_herringbone_charcoal",
    name: "Herringbone — charcoal",
    category: "paver",
    pattern: "herringbone",
    colorName: "Charcoal",
    color: rgb(78, 80, 86),
    accent: rgb(55, 56, 60),
  },
  {
    id: "paver_herringbone_tan",
    name: "Herringbone — tan",
    category: "paver",
    pattern: "herringbone",
    colorName: "Tan",
    color: rgb(176, 152, 120),
    accent: rgb(120, 108, 92),
  },
  {
    id: "paver_herringbone_gray",
    name: "Herringbone — gray",
    category: "paver",
    pattern: "herringbone",
    colorName: "Gray",
    color: rgb(140, 142, 146),
    accent: rgb(100, 102, 106),
  },
  {
    id: "paver_basketweave_sandstone",
    name: "Basketweave — sandstone",
    category: "paver",
    pattern: "basketweave",
    colorName: "Sandstone",
    color: rgb(188, 164, 128),
    accent: rgb(130, 118, 100),
  },
  {
    id: "paver_stack_gray",
    name: "Stack bond — gray",
    category: "paver",
    pattern: "stack_bond",
    colorName: "Gray",
    color: rgb(150, 152, 156),
    accent: rgb(110, 112, 116),
  },
  {
    id: "paver_stack_charcoal",
    name: "Stack bond — charcoal",
    category: "paver",
    pattern: "stack_bond",
    colorName: "Charcoal",
    color: rgb(72, 74, 80),
    accent: rgb(48, 50, 54),
  },
  {
    id: "paver_modular_tan",
    name: "Modular mix — tan",
    category: "paver",
    pattern: "modular",
    colorName: "Tan",
    color: rgb(180, 156, 124),
    accent: rgb(125, 112, 96),
  },

  // —— Natural / porcelain ——
  {
    id: "stone_travertine_ivory",
    name: "Travertine — ivory",
    category: "stone",
    pattern: "travertine",
    colorName: "Ivory",
    color: rgb(220, 210, 190),
    accent: rgb(180, 168, 148),
  },
  {
    id: "stone_travertine_walnut",
    name: "Travertine — walnut",
    category: "stone",
    pattern: "travertine",
    colorName: "Walnut",
    color: rgb(148, 118, 92),
    accent: rgb(110, 88, 68),
  },
  {
    id: "stone_travertine_silver",
    name: "Travertine — silver",
    category: "stone",
    pattern: "travertine",
    colorName: "Silver",
    color: rgb(176, 178, 180),
    accent: rgb(140, 142, 144),
  },
  {
    id: "stone_bluestone",
    name: "Bluestone",
    category: "stone",
    pattern: "bluestone",
    colorName: "Natural",
    color: rgb(98, 108, 120),
    accent: rgb(70, 78, 88),
  },
  {
    id: "stone_porcelain_light",
    name: "Porcelain paver — light",
    category: "stone",
    pattern: "porcelain",
    colorName: "Light",
    color: rgb(210, 208, 200),
    accent: rgb(160, 158, 152),
  },
  {
    id: "stone_porcelain_dark",
    name: "Porcelain paver — dark",
    category: "stone",
    pattern: "porcelain",
    colorName: "Dark",
    color: rgb(70, 72, 76),
    accent: rgb(48, 50, 54),
  },
  {
    id: "stone_coral",
    name: "Coral / keystone",
    category: "stone",
    pattern: "coral",
    colorName: "Natural",
    color: rgb(210, 198, 176),
    accent: rgb(170, 158, 138),
  },
];

const BY_ID = new Map(PATIO_FINISHES.map((f) => [f.id, f]));

export function getPatioFinish(id: string | undefined | null): PatioFinish {
  if (id && BY_ID.has(id)) return BY_ID.get(id)!;
  return BY_ID.get(DEFAULT_PATIO_FINISH_ID)!;
}

export function isPatioFinishId(id: string): boolean {
  return BY_ID.has(id);
}

export function patioFinishesByCategory(
  category: PatioFinishCategory,
): PatioFinish[] {
  return PATIO_FINISHES.filter((f) => f.category === category);
}

/** Distinct patterns available in a category, catalog order. */
export function patioPatternsInCategory(
  category: PatioFinishCategory,
): PatioFinishPattern[] {
  const seen = new Set<PatioFinishPattern>();
  const patterns: PatioFinishPattern[] = [];
  for (const f of PATIO_FINISHES) {
    if (f.category !== category || seen.has(f.pattern)) continue;
    seen.add(f.pattern);
    patterns.push(f.pattern);
  }
  return patterns;
}

export function patioFinishesForPattern(
  category: PatioFinishCategory,
  pattern: PatioFinishPattern,
): PatioFinish[] {
  return PATIO_FINISHES.filter(
    (f) => f.category === category && f.pattern === pattern,
  );
}

/** Pick a finish when category/pattern changes, preferring a color name match. */
export function resolvePatioFinish(opts: {
  category: PatioFinishCategory;
  pattern?: PatioFinishPattern;
  colorName?: string;
}): PatioFinish {
  const patterns = patioPatternsInCategory(opts.category);
  const pattern =
    opts.pattern && patterns.includes(opts.pattern)
      ? opts.pattern
      : patterns[0];
  const colors = patioFinishesForPattern(opts.category, pattern);
  if (opts.colorName) {
    const match = colors.find((f) => f.colorName === opts.colorName);
    if (match) return match;
  }
  return colors[0] ?? getPatioFinish(DEFAULT_PATIO_FINISH_ID);
}

export function patioFinishCssColor(c: PatioFinishColor): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}
