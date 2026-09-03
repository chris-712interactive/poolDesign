export type DesignLevel = "residential" | "commercial" | "water_park";

export const DESIGN_LEVELS: DesignLevel[] = [
  "residential",
  "commercial",
  "water_park",
];

export function isDesignLevel(value: string): value is DesignLevel {
  return (DESIGN_LEVELS as readonly string[]).includes(value);
}

/** Company DB list, filtered for public create-project (commercial / water park off by default). */
export function publicDesignLevels(
  companyLevels: readonly string[],
  flags: { commercial?: boolean; waterPark?: boolean } = {},
): DesignLevel[] {
  const allowed = companyLevels.filter(isDesignLevel).filter((level) => {
    if (level === "commercial") return flags.commercial === true;
    if (level === "water_park") return flags.waterPark === true;
    return true;
  });
  return allowed.length > 0 ? allowed : ["residential"];
}

export const DESIGN_LEVEL_LABELS: Record<DesignLevel, string> = {
  residential: "Residential",
  commercial: "Commercial",
  water_park: "Water park",
};

export const DESIGN_LEVEL_DESCRIPTIONS: Record<DesignLevel, string> = {
  residential:
    "Single-family pools and spas, patio lifestyle features, homeowner proposals.",
  commercial:
    "Hotels, HOAs, apartments, and clubs — commercial equipment and owner/operator workflows.",
  water_park:
    "Multi-body complexes and attractions — high-capacity systems and park-operator workflows.",
};

export type DesignLevelConfig = {
  level: DesignLevel;
  clientLabel: string;
  defaultLayers: string[];
};

/** Short labels for the Layers panel (fallback: title-case the id). */
export const LAYER_LABELS: Record<string, string> = {
  house: "House",
  building: "Building",
  pool: "Pool",
  pools: "Pools",
  features: "Features",
  patio: "Patio",
  deck: "Deck",
  covers: "Covers",
  furniture: "Furniture",
  amenities: "Amenities",
  plumbing: "Plumbing",
  equipment: "Equipment",
  notes: "Notes",
  fence: "Fence",
  survey: "Survey",
  property: "Property",
  easement: "Easements",
  site: "Lot lines",
  grade: "Grade points",
  accessibility: "Access",
  attractions: "Attractions",
  guest_flow: "Guest flow",
  mechanical: "Mechanical",
  theming: "Theming",
};

export function layerDisplayName(layer: { id: string; name: string }): string {
  return (
    LAYER_LABELS[layer.id] ??
    LAYER_LABELS[layer.name] ??
    layer.name.replace(/_/g, " ")
  );
}

export const DESIGN_LEVEL_CONFIG: Record<DesignLevel, DesignLevelConfig> = {
  residential: {
    level: "residential",
    clientLabel: "Homeowner",
    defaultLayers: [
      "house",
      "pool",
      "features",
      "patio",
      "covers",
      "furniture",
      "plumbing",
      "equipment",
      "fence",
      "property",
      "easement",
      "grade",
      "notes",
    ],
  },
  commercial: {
    level: "commercial",
    clientLabel: "Owner / operator",
    defaultLayers: [
      "building",
      "pool",
      "features",
      "deck",
      "covers",
      "amenities",
      "plumbing",
      "equipment",
      "fence",
      "property",
      "easement",
      "grade",
      "accessibility",
      "notes",
    ],
  },
  water_park: {
    level: "water_park",
    clientLabel: "Park operator",
    defaultLayers: [
      "building",
      "attractions",
      "pools",
      "features",
      "guest_flow",
      "mechanical",
      "plumbing",
      "fence",
      "property",
      "easement",
      "grade",
      "theming",
      "notes",
    ],
  },
};
