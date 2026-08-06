export type DesignLevel = "residential" | "commercial" | "water_park";

export const DESIGN_LEVELS: DesignLevel[] = [
  "residential",
  "commercial",
  "water_park",
];

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
      "theming",
      "notes",
    ],
  },
};
