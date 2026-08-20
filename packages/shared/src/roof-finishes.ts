/**
 * House roof materials + tints — stored on Building.roof.
 */

export type RoofColor = { r: number; g: number; b: number };

export const ROOF_MATERIAL_IDS = [
  "shingle_3tab",
  "shingle_arch",
  "tile_clay",
  "tile_concrete",
  "metal_seam",
  "membrane",
] as const;

export type RoofMaterialId = (typeof ROOF_MATERIAL_IDS)[number];

export const DEFAULT_ROOF_MATERIAL_ID: RoofMaterialId = "shingle_arch";

export const ROOF_MATERIAL_LABELS: Record<RoofMaterialId, string> = {
  shingle_3tab: "3-tab shingle",
  shingle_arch: "Architectural shingle",
  tile_clay: "Clay tile",
  tile_concrete: "Concrete tile",
  metal_seam: "Standing-seam metal",
  membrane: "Membrane / TPO",
};

export type RoofMaterial = {
  id: RoofMaterialId;
  name: string;
  description: string;
  /** Default tint when the building does not override color. */
  color: RoofColor;
  roughness: number;
  metalness: number;
};

const rgb = (r: number, g: number, b: number): RoofColor => ({ r, g, b });

export const ROOF_MATERIALS: RoofMaterial[] = [
  {
    id: "shingle_3tab",
    name: "3-tab shingle",
    description: "Budget asphalt tabs",
    color: rgb(62, 64, 68),
    roughness: 0.92,
    metalness: 0,
  },
  {
    id: "shingle_arch",
    name: "Architectural shingle",
    description: "Dimensional asphalt laminate",
    color: rgb(58, 54, 50),
    roughness: 0.9,
    metalness: 0,
  },
  {
    id: "tile_clay",
    name: "Clay tile",
    description: "Barrel / S-tile terracotta",
    color: rgb(168, 78, 48),
    roughness: 0.78,
    metalness: 0,
  },
  {
    id: "tile_concrete",
    name: "Concrete tile",
    description: "Flat concrete roof tile",
    color: rgb(132, 118, 104),
    roughness: 0.88,
    metalness: 0,
  },
  {
    id: "metal_seam",
    name: "Standing-seam metal",
    description: "Vertical metal pans with ribs",
    color: rgb(72, 78, 84),
    roughness: 0.42,
    metalness: 0.55,
  },
  {
    id: "membrane",
    name: "Membrane / TPO",
    description: "Low-slope sheet roof",
    color: rgb(228, 228, 222),
    roughness: 0.7,
    metalness: 0.05,
  },
];

export const ROOF_COLOR_PRESETS: { id: string; name: string; color: RoofColor }[] =
  [
    { id: "charcoal", name: "Charcoal", color: rgb(54, 56, 58) },
    { id: "slate", name: "Slate", color: rgb(78, 86, 96) },
    { id: "weathered", name: "Weathered wood", color: rgb(96, 80, 64) },
    { id: "forest", name: "Forest", color: rgb(52, 72, 56) },
    { id: "terracotta", name: "Terracotta", color: rgb(168, 78, 48) },
    { id: "clay_blend", name: "Clay blend", color: rgb(176, 102, 70) },
    { id: "sand", name: "Sand", color: rgb(168, 150, 126) },
    { id: "white", name: "White", color: rgb(236, 236, 230) },
    { id: "black", name: "Black", color: rgb(36, 36, 38) },
    { id: "copper", name: "Copper", color: rgb(150, 92, 58) },
  ];

export const ROOF_CUSTOM_COLOR_ID = "custom";

export const DEFAULT_ROOF_OVERHANG_MM = 280;
export const DEFAULT_ROOF_PITCH12 = 6;

export const ROOF_PITCH_PRESETS = [4, 5, 6, 8, 10, 12] as const;

export function isRoofMaterialId(
  id: string | undefined | null,
): id is RoofMaterialId {
  return (
    typeof id === "string" &&
    (ROOF_MATERIAL_IDS as readonly string[]).includes(id)
  );
}

export function resolveRoofMaterialId(
  id?: string | null,
): RoofMaterialId {
  return isRoofMaterialId(id) ? id : DEFAULT_ROOF_MATERIAL_ID;
}

export function getRoofMaterial(id?: string | null): RoofMaterial {
  const resolved = resolveRoofMaterialId(id);
  return ROOF_MATERIALS.find((m) => m.id === resolved)!;
}

export function clampRoofChannel(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function clampRoofColor(
  color?: Partial<RoofColor> | null,
  fallback?: RoofColor,
): RoofColor {
  const base = fallback ?? getRoofMaterial().color;
  return {
    r: color && typeof color.r === "number" ? clampRoofChannel(color.r) : base.r,
    g: color && typeof color.g === "number" ? clampRoofChannel(color.g) : base.g,
    b: color && typeof color.b === "number" ? clampRoofChannel(color.b) : base.b,
  };
}

export function resolveRoofColor(
  finishId?: string | null,
  customColor?: Partial<RoofColor> | null,
): RoofColor {
  const mat = getRoofMaterial(finishId);
  if (customColor && typeof customColor.r === "number") {
    return clampRoofColor(customColor, mat.color);
  }
  return { ...mat.color };
}

export function roofColorHex(color: RoofColor): string {
  const h = (n: number) => clampRoofChannel(n).toString(16).padStart(2, "0");
  return `#${h(color.r)}${h(color.g)}${h(color.b)}`;
}

export function roofColorFromHex(hex: string): RoofColor | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

export function roofCssColor(color: RoofColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export function clampRoofPitch12(n?: number | null): number {
  if (!Number.isFinite(n ?? NaN)) return DEFAULT_ROOF_PITCH12;
  return Math.max(2, Math.min(18, Math.round(Number(n))));
}

export function clampRoofOverhangMm(n?: number | null): number {
  if (!Number.isFinite(n ?? NaN)) return DEFAULT_ROOF_OVERHANG_MM;
  return Math.max(0, Math.min(1200, Math.round(Number(n))));
}
