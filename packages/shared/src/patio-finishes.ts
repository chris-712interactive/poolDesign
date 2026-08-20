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
  /**
   * Chamfered unit edge. Rectified porcelain / sawn tile is `false`
   * (square edge, hairline joint, no grout dip).
   */
  beveled?: boolean;
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
  modular: "French pattern",
  travertine: "Travertine (French)",
  bluestone: "Bluestone",
  porcelain: "Porcelain 24×24",
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
    description: "Nominal 4″ × 8″ concrete/clay brick paver",
  },
  {
    id: "paver_running_brick_burgundy",
    name: "Running bond — burgundy",
    category: "paver",
    pattern: "running_bond",
    colorName: "Burgundy",
    color: rgb(110, 48, 52),
    accent: rgb(100, 92, 88),
    description: "Nominal 4″ × 8″ paver",
  },
  {
    id: "paver_running_buff",
    name: "Running bond — buff",
    category: "paver",
    pattern: "running_bond",
    colorName: "Buff",
    color: rgb(186, 160, 118),
    accent: rgb(130, 120, 108),
    description: "Nominal 4″ × 8″ paver",
  },
  {
    id: "paver_herringbone_charcoal",
    name: "Herringbone — charcoal",
    category: "paver",
    pattern: "herringbone",
    colorName: "Charcoal",
    color: rgb(78, 80, 86),
    accent: rgb(55, 56, 60),
    description: "4″ × 8″ brick herringbone",
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
    description: "4″ × 8″ basketweave",
  },
  {
    id: "paver_stack_gray",
    name: "Stack bond — gray 16×16",
    category: "paver",
    pattern: "stack_bond",
    colorName: "Gray",
    color: rgb(150, 152, 156),
    accent: rgb(110, 112, 116),
    description: "16″ × 16″ stack-bond patio pavers",
  },
  {
    id: "paver_stack_charcoal",
    name: "Stack bond — charcoal 16×16",
    category: "paver",
    pattern: "stack_bond",
    colorName: "Charcoal",
    color: rgb(72, 74, 80),
    accent: rgb(48, 50, 54),
  },
  {
    id: "paver_modular_tan",
    name: "French pattern — tan",
    category: "paver",
    pattern: "modular",
    colorName: "Tan",
    color: rgb(180, 156, 124),
    accent: rgb(125, 112, 96),
    description:
      "French/Versailles set: 8×8, 8×16, 16×16, 16×24 (16″ module)",
  },
  {
    id: "paver_modular_silver",
    name: "French pattern — silver grey",
    category: "paver",
    pattern: "modular",
    colorName: "Silver",
    color: rgb(176, 180, 184),
    accent: rgb(118, 122, 126),
    description:
      "Cool silver/grey French pattern — light silver, mid grey, blue-grey mottling",
  },
  {
    id: "paver_modular_ivory",
    name: "French pattern — ivory",
    category: "paver",
    pattern: "modular",
    colorName: "Ivory",
    color: rgb(220, 214, 202),
    accent: rgb(168, 162, 150),
    description: "Ivory/cream French pattern travertine-style blend",
  },

  // —— Natural / porcelain ——
  {
    id: "stone_travertine_ivory",
    name: "Travertine French — ivory",
    category: "stone",
    pattern: "travertine",
    colorName: "Ivory",
    color: rgb(222, 214, 196),
    accent: rgb(168, 158, 140),
    description: "Tumbled ivory travertine French pattern (8×8–16×24)",
  },
  {
    id: "stone_travertine_walnut",
    name: "Travertine French — walnut",
    category: "stone",
    pattern: "travertine",
    colorName: "Walnut",
    color: rgb(148, 118, 92),
    accent: rgb(110, 88, 68),
  },
  {
    id: "stone_travertine_silver",
    name: "Travertine French — silver",
    category: "stone",
    pattern: "travertine",
    colorName: "Silver",
    color: rgb(186, 190, 194),
    accent: rgb(120, 124, 128),
    description:
      "Silver travertine French pattern — silver, cool grey, charcoal joint",
  },
  {
    id: "stone_bluestone",
    name: "Bluestone — 24×24",
    category: "stone",
    pattern: "bluestone",
    colorName: "Natural",
    color: rgb(98, 108, 120),
    accent: rgb(70, 78, 88),
    description: "Full-range bluestone ~24″ squares",
  },
  {
    id: "stone_porcelain_light",
    name: "Porcelain paver — light 24×24",
    category: "stone",
    pattern: "porcelain",
    colorName: "Light",
    color: rgb(210, 208, 200),
    accent: rgb(160, 158, 152),
    description: "Large-format 24″ × 24″ porcelain paver",
    beveled: false,
  },
  {
    id: "stone_porcelain_dark",
    name: "Porcelain paver — dark 24×24",
    category: "stone",
    pattern: "porcelain",
    colorName: "Dark",
    color: rgb(70, 72, 76),
    accent: rgb(48, 50, 54),
    beveled: false,
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

/** Chamfered paver/stone edge. Rectified porcelain is square. */
export function patioFinishBeveled(finish: PatioFinish): boolean {
  if (finish.beveled === false) return false;
  if (finish.beveled === true) return true;
  return finish.pattern !== "porcelain";
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
