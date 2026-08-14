import type { ReactNode } from "react";

export { ToolTooltip } from "@/components/ToolTooltip";

export type DrawToolId =
  | "select"
  | "house_rect"
  | "house_poly"
  | "opening"
  | "pool_rect"
  | "pool_poly"
  | "steps"
  | "bench"
  | "sunshelf"
  | "patio_rect"
  | "patio"
  | "grade_point"
  | "property_line"
  | "easement"
  | "cover_rect"
  | "fence"
  | "gate"
  | "plumbing"
  | "place"
  | "measure"
  | "survey_calibrate";

export type PadEquipToolId =
  | "equip_pad"
  | "equip_pump"
  | "equip_filter"
  | "equip_heater"
  | "equip_salt";

export type ToolId = DrawToolId | PadEquipToolId;

export type ToolRealm = "land" | "water" | "house";

export type ToolGroupId =
  | "pad"
  | "furniture"
  | "patio"
  | "site"
  | "cover"
  | "fence"
  | "pool"
  | "spa"
  | "plumbing"
  | "house"
  | "openings";

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ children }: { children: ReactNode }) {
  return <svg {...iconProps}>{children}</svg>;
}

export const TOOL_REALMS: { id: ToolRealm; label: string }[] = [
  { id: "land", label: "Land" },
  { id: "water", label: "Water" },
  { id: "house", label: "House" },
];

export const TOOL_GROUPS: {
  id: ToolGroupId;
  realm: ToolRealm;
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    id: "pad",
    realm: "land",
    label: "Equipment pad",
    hint: "Concrete pad with standard pump, filter, heater, and salt kit",
    icon: (
      <Svg>
        <rect x="3" y="6" width="18" height="12" rx="1.5" />
        <path d="M6 10h4M6 14h7" />
      </Svg>
    ),
  },
  {
    id: "furniture",
    realm: "land",
    label: "Furniture & yard",
    hint: "Lounge furniture, fire pit, planters, and similar",
    icon: (
      <Svg>
        <path d="M5 11h14v7H5zM7 11V8a5 5 0 0 1 10 0v3" />
      </Svg>
    ),
  },
  {
    id: "patio",
    realm: "land",
    label: "Patio / deck",
    hint: "Concrete patio or deck surround",
    icon: (
      <Svg>
        <path d="M4 18V8l8-3 8 3v10" />
        <path d="M4 12h16" />
      </Svg>
    ),
  },
  {
    id: "site",
    realm: "land",
    label: "Lot lines",
    hint: "Trace property lines and easements from the survey",
    icon: (
      <Svg>
        <path d="M5 5h14v14H5z" />
        <path d="M5 12h14M12 5v14" strokeDasharray="3 2" />
      </Svg>
    ),
  },
  {
    id: "cover",
    realm: "land",
    label: "Pergola / roof",
    hint: "Shade structures over the patio",
    icon: (
      <Svg>
        <path d="M4 10h16" />
        <path d="M6 10v10M18 10v10" />
        <path d="M6 14h12M6 17h12" />
        <path d="M4 7l8-3 8 3" />
      </Svg>
    ),
  },
  {
    id: "fence",
    realm: "land",
    label: "Fence & gates",
    hint: "Property fence runs and gates",
    icon: (
      <Svg>
        <path d="M4 6v14M9 6v14M14 6v14M19 6v14" />
        <path d="M4 8h15M4 18h15" />
      </Svg>
    ),
  },
  {
    id: "pool",
    realm: "water",
    label: "Pool",
    hint: "Pool shape, steps, bench, sunshelf, and fixtures",
    icon: (
      <Svg>
        <rect x="4" y="7" width="16" height="10" rx="1.5" />
        <path d="M8 10h8M8 14h5" />
      </Svg>
    ),
  },
  {
    id: "spa",
    realm: "water",
    label: "Spa",
    hint: "Spa shell and spa fixtures",
    icon: (
      <Svg>
        <rect x="6" y="8" width="12" height="9" rx="1.5" />
        <path d="M9 11h6M9 14h4" />
      </Svg>
    ),
  },
  {
    id: "plumbing",
    realm: "water",
    label: "Plumbing",
    hint: "Manual plumbing runs",
    icon: (
      <Svg>
        <path d="M5 19V9h6v4h4V5h4" />
      </Svg>
    ),
  },
  {
    id: "house",
    realm: "house",
    label: "House footprint",
    hint: "Draw the house / building outline",
    icon: (
      <Svg>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </Svg>
    ),
  },
  {
    id: "openings",
    realm: "house",
    label: "Doors & windows",
    hint: "Place openings on house walls",
    icon: (
      <Svg>
        <path d="M6 20V6h8v14" />
        <path d="M10 12h1" />
        <rect x="15" y="7" width="5" height="7" rx="0.5" />
      </Svg>
    ),
  },
];

/** Icons / labels for draw tools (used by palette children + tooltips). */
export const TOOL_META: {
  id: DrawToolId;
  label: string;
  icon: ReactNode;
}[] = [
  {
    id: "select",
    label: "Select / edit",
    icon: (
      <Svg>
        <path d="M4 4l7 16 2-7 7-2z" />
      </Svg>
    ),
  },
  {
    id: "house_rect",
    label: "House rectangle",
    icon: (
      <Svg>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </Svg>
    ),
  },
  {
    id: "house_poly",
    label: "House polygon",
    icon: (
      <Svg>
        <path d="M4 12l5-6 7 3 4 7H4z" />
        <path d="M10 20v-5h3v5" />
      </Svg>
    ),
  },
  {
    id: "opening",
    label: "Door / window",
    icon: (
      <Svg>
        <path d="M6 20V6h8v14" />
        <path d="M10 12h1" />
        <rect x="15" y="7" width="5" height="7" rx="0.5" />
      </Svg>
    ),
  },
  {
    id: "pool_rect",
    label: "Pool / spa rectangle",
    icon: (
      <Svg>
        <rect x="4" y="7" width="16" height="10" rx="1.5" />
        <path d="M8 10h8M8 14h5" />
      </Svg>
    ),
  },
  {
    id: "pool_poly",
    label: "Pool / spa polygon",
    icon: (
      <Svg>
        <path d="M5 16L9 6l6 3 4 8z" />
      </Svg>
    ),
  },
  {
    id: "steps",
    label: "Steps",
    icon: (
      <Svg>
        <path d="M4 18h5v-4h5V10h6V6" />
      </Svg>
    ),
  },
  {
    id: "bench",
    label: "Bench",
    icon: (
      <Svg>
        <path d="M4 14h16M6 14v4M18 14v4M5 10h14v4H5z" />
      </Svg>
    ),
  },
  {
    id: "sunshelf",
    label: "Sunshelf",
    icon: (
      <Svg>
        <rect x="4" y="8" width="16" height="10" rx="1" />
        <path d="M4 14h16" />
        <path d="M7 11h2M11 11h2M15 11h2" />
      </Svg>
    ),
  },
  {
    id: "patio_rect",
    label: "Patio rectangle",
    icon: (
      <Svg>
        <rect x="4" y="7" width="16" height="10" rx="1.5" />
        <path d="M4 17h16" />
      </Svg>
    ),
  },
  {
    id: "patio",
    label: "Patio polygon",
    icon: (
      <Svg>
        <path d="M4 18V8l8-3 8 3v10" />
        <path d="M4 12h16" />
      </Svg>
    ),
  },
  {
    id: "grade_point",
    label: "Grade point",
    icon: (
      <Svg>
        <path d="M12 3v14" />
        <path d="M8 13l4 4 4-4" />
        <circle cx="12" cy="5" r="2" />
      </Svg>
    ),
  },
  {
    id: "property_line",
    label: "Property line",
    icon: (
      <Svg>
        <rect x="5" y="5" width="14" height="14" rx="1" strokeDasharray="3 2" />
      </Svg>
    ),
  },
  {
    id: "easement",
    label: "Easement",
    icon: (
      <Svg>
        <path d="M4 16L16 4" strokeDasharray="3 2" />
        <path d="M8 20L20 8" strokeDasharray="3 2" />
        <path d="M4 20h.01M20 4h.01" />
      </Svg>
    ),
  },
  {
    id: "cover_rect",
    label: "Pergola / patio roof",
    icon: (
      <Svg>
        <path d="M4 10h16" />
        <path d="M6 10v10M18 10v10" />
        <path d="M6 14h12M6 17h12" />
        <path d="M4 7l8-3 8 3" />
      </Svg>
    ),
  },
  {
    id: "fence",
    label: "Fence",
    icon: (
      <Svg>
        <path d="M4 6v14M9 6v14M14 6v14M19 6v14" />
        <path d="M4 8h15M4 18h15" />
      </Svg>
    ),
  },
  {
    id: "gate",
    label: "Gate",
    icon: (
      <Svg>
        <path d="M5 20V6h8v14" />
        <path d="M9 12h1" />
        <path d="M15 8l4 4-4 4" />
      </Svg>
    ),
  },
  {
    id: "plumbing",
    label: "Plumbing",
    icon: (
      <Svg>
        <path d="M5 19V9h6v4h4V5h4" />
      </Svg>
    ),
  },
  {
    id: "place",
    label: "Furniture",
    icon: (
      <Svg>
        <path d="M5 11h14v7H5zM7 11V8a5 5 0 0 1 10 0v3" />
      </Svg>
    ),
  },
  {
    id: "measure",
    label: "Measure",
    icon: (
      <Svg>
        <path d="M4 18L18 4M8 18h.01M12 14h.01M16 10h.01" />
      </Svg>
    ),
  },
  {
    id: "survey_calibrate",
    label: "Calibrate survey",
    icon: (
      <Svg>
        <rect x="4" y="5" width="16" height="14" rx="1.5" />
        <path d="M7 15h10M7 12h4" />
      </Svg>
    ),
  },
];

export function toolMeta(id: DrawToolId) {
  return TOOL_META.find((t) => t.id === id)!;
}

/** Pad equipment — first-class tools (click to place). */
export const PAD_EQUIP_TOOLS: {
  id: PadEquipToolId;
  catalogItemId: string;
  label: string;
  icon: ReactNode;
}[] = [
  {
    id: "equip_pad",
    catalogItemId: "equip_pad",
    label: "Equipment pad",
    icon: (
      <Svg>
        <rect x="3" y="6" width="18" height="12" rx="1.5" />
        <path d="M6 10h4M6 14h7" />
      </Svg>
    ),
  },
  {
    id: "equip_pump",
    catalogItemId: "pump_variable_speed",
    label: "Variable-speed pump",
    icon: (
      <Svg>
        <circle cx="12" cy="12" r="5.5" />
        <path d="M12 8.5v7M9.5 12h5" />
        <path d="M17 10h3v4h-3" />
      </Svg>
    ),
  },
  {
    id: "equip_filter",
    catalogItemId: "filter_cartridge",
    label: "Cartridge filter",
    icon: (
      <Svg>
        <path d="M8 4h8v4l-1 12H9L8 8V4z" />
        <path d="M10 10h4M10 14h4" />
      </Svg>
    ),
  },
  {
    id: "equip_heater",
    catalogItemId: "heater_gas",
    label: "Gas heater",
    icon: (
      <Svg>
        <rect x="5" y="8" width="14" height="11" rx="1.5" />
        <path d="M9 8V5.5a3 3 0 0 1 6 0V8" />
        <path d="M9 13h6" />
      </Svg>
    ),
  },
  {
    id: "equip_salt",
    catalogItemId: "salt_chlorinator",
    label: "Salt chlorinator",
    icon: (
      <Svg>
        <rect x="7" y="5" width="10" height="14" rx="2" />
        <path d="M10 9h4M10 12h4M10 15h4" />
      </Svg>
    ),
  },
];

export function catalogIdForPadTool(tool: PadEquipToolId): string {
  return PAD_EQUIP_TOOLS.find((t) => t.id === tool)!.catalogItemId;
}

export function isPadEquipTool(tool: string): tool is PadEquipToolId {
  return PAD_EQUIP_TOOLS.some((t) => t.id === tool);
}

/** Infer which addon group a tool belongs to (for keeping the group open). */
export function toolGroupForTool(
  tool: ToolId,
  waterKind: "pool" | "spa",
  placeCatalogId: string | null,
): ToolGroupId | null {
  if (isPadEquipTool(tool)) return "pad";
  if (tool === "patio" || tool === "patio_rect" || tool === "grade_point")
    return "patio";
  if (tool === "property_line" || tool === "easement") return "site";
  if (tool === "cover_rect") return "cover";
  if (tool === "fence" || tool === "gate") return "fence";
  if (tool === "plumbing") return "plumbing";
  if (tool === "house_rect" || tool === "house_poly") return "house";
  if (tool === "opening") return "openings";
  if (tool === "steps" || tool === "bench" || tool === "sunshelf") return "pool";
  if (tool === "pool_rect" || tool === "pool_poly") {
    return waterKind === "spa" ? "spa" : "pool";
  }
  if (tool === "place") {
    if (!placeCatalogId) return "furniture";
    if (placeCatalogId === "cover_fan" || placeCatalogId === "cover_light") {
      return "cover";
    }
    if (
      placeCatalogId === "sunshelf_chaise" ||
      placeCatalogId === "sunshelf_table" ||
      placeCatalogId === "umbrella_sleeve"
    ) {
      return "pool";
    }
    if (
      placeCatalogId === "spa_bubbler" ||
      placeCatalogId === "spa_jet" ||
      placeCatalogId === "spa_drain"
    ) {
      return "spa";
    }
    if (placeCatalogId === "pool_bubbler") return "pool";
    // Lights appear under both Pool and Spa — don't force a group switch.
    if (
      placeCatalogId === "light_standard" ||
      placeCatalogId === "light_color"
    ) {
      return null;
    }
    return "furniture";
  }
  return null;
}

export function realmForGroup(group: ToolGroupId): ToolRealm {
  return TOOL_GROUPS.find((g) => g.id === group)!.realm;
}

export const ACTION_ICONS = {
  ortho: (
    <Svg>
      <path d="M4 12h16M12 4v16" />
    </Svg>
  ),
  angle: (
    <Svg>
      <path d="M5 19V5l14 14" />
      <path d="M5 19h10" />
    </Svg>
  ),
  undo: (
    <Svg>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a5 5 0 0 1 0 10h-3" />
    </Svg>
  ),
  redo: (
    <Svg>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a5 5 0 0 0 0 10h3" />
    </Svg>
  ),
  reset: (
    <Svg>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </Svg>
  ),
  rotate: (
    <Svg>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </Svg>
  ),
  zoom: (
    <Svg>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M15 15l5 5M8.5 10.5h4M10.5 8.5v4" />
    </Svg>
  ),
};
