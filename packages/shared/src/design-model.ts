import type { CatalogCategory, CatalogUnit } from "./catalog";
import type { DesignLevel } from "./design-level";
import { objectPlanSizeMm } from "./object-library";
import type { UnitSystem } from "./units";

export type PointMm = { x: number; y: number };

export type DesignLayerId = string;

export type WaterBodyKind = "pool" | "spa";

/** How the pool floor arrives at a depth station from the previous one. */
export type DepthTransition = "smooth" | "dropoff";

/** Depth break along the pool's shallow→deep axis. */
export type DepthStation = {
  id: string;
  /** 0–1 along the depth axis (0 = shallow-axis start). */
  t: number;
  depthMm: number;
  /** Default: smooth curved transition. */
  transition?: DepthTransition;
};

export type PoolBody = {
  id: string;
  name: string;
  /**
   * Closed polygon in mm.
   * Outside/shell dimension for pools and spas; inside waterline is
   * derived via wallThicknessMm.
   */
  outline: PointMm[];
  depthShallowMm: number;
  depthDeepMm: number;
  /** Defaults to pool when missing (older documents) */
  kind?: WaterBodyKind;
  /**
   * Shell / wall thickness (mm). Outside outline insets by this for the
   * waterline (pools and spas).
   */
  wallThicknessMm?: number;
  /**
   * Spa shell height above the finished patio/deck surface (mm).
   * Authorable to any ≥ 0 value (0 = rim flush with patio, not below it).
   */
  shellHeightMm?: number;
  /**
   * Authorable depth profile (≥2 stations). When omitted, shallow/deep +
   * default long-axis are used.
   */
  depthStations?: DepthStation[];
  /** Unit direction of the depth axis in plan (shallow → deep). */
  depthAxis?: PointMm;
  /**
   * Spa → pool spillover weir (only for kind spa). Defaults on when the spa
   * shares a wall with a pool; set enabled: false to disable.
   */
  spillover?: SpaSpillover;
  /**
   * Pool vanishing / infinity edge + catch trough (kind pool only).
   * Authorable per outline edge; disabled by default until edges are enabled.
   */
  infinityEdge?: InfinityEdge;
  /**
   * Waterline tile finish id from the waterline tile library.
   * Visual only — takeoff still uses catalog `waterline_tile` LF.
   */
  waterlineTileId?: string;
};

/** Visual style of the spa→pool cascade. */
export type SpaSpilloverStyle = "sheet" | "scuppers" | "sheer";

export const SPA_SPILLOVER_STYLES: SpaSpilloverStyle[] = [
  "sheet",
  "scuppers",
  "sheer",
];

/** Authorable weir on one pool-facing spa edge. */
export type SpaSpilloverWeir = {
  edgeIndex: number;
  /** When false, this edge is not spilling (still a candidate on plan). */
  enabled?: boolean;
  widthMm?: number;
  offsetMm?: number;
};

/** Authorable spa spillover into an attached pool. */
export type SpaSpillover = {
  enabled: boolean;
  /** Target pool body id; validated against geometric join */
  targetPoolId?: string;
  /**
   * Per-edge weirs on pool-facing edges. When omitted, every intersecting
   * edge gets a default weir (editable on the 2D plan).
   */
  weirs?: SpaSpilloverWeir[];
  /** @deprecated Prefer `weirs[]` — migrated on normalize */
  edgeIndex?: number;
  /** @deprecated Prefer `weirs[]` */
  widthMm?: number;
  /** @deprecated Prefer `weirs[]` */
  offsetMm?: number;
  /** Notch depth below spa rim (mm) — shared across weirs */
  notchDepthMm?: number;
  style?: SpaSpilloverStyle;
  /** Scuppers only: number of openings (2–8) */
  scupperCount?: number;
  /** Scuppers only: clear gap between openings (mm) */
  scupperGapMm?: number;
};

export function isSpaSpilloverStyle(v: unknown): v is SpaSpilloverStyle {
  return v === "sheet" || v === "scuppers" || v === "sheer";
}

/** Visual style of a pool vanishing / infinity weir. */
export type InfinityEdgeStyle = "sheet" | "scuppers" | "sheer";

export const INFINITY_EDGE_STYLES: InfinityEdgeStyle[] = [
  "sheet",
  "scuppers",
  "sheer",
];

export function isInfinityEdgeStyle(v: unknown): v is InfinityEdgeStyle {
  return v === "sheet" || v === "scuppers" || v === "sheer";
}

/** Authorable weir on one pool outline edge that spills into a catch trough. */
export type InfinityEdgeWeir = {
  edgeIndex: number;
  /** When false, this edge is not spilling (still listed as a candidate). */
  enabled?: boolean;
  widthMm?: number;
  offsetMm?: number;
};

/** Catch / surge trough dimensions outside the vanishing edge. */
export type InfinityTrough = {
  /** Outward width from the outer shell face (default ~24″). */
  widthMm?: number;
  /** Vertical depth of the catch basin (default ~30″). */
  depthMm?: number;
  /** Design water depth in the trough used for surge volume (default ~18″). */
  waterDepthMm?: number;
};

/** Authorable pool infinity / vanishing edge into a catch trough. */
export type InfinityEdge = {
  enabled: boolean;
  /** Per-edge weirs. When omitted/empty, no edges spill until the user enables some. */
  weirs?: InfinityEdgeWeir[];
  /** Notch depth below pool rim (mm) — shared across weirs. */
  notchDepthMm?: number;
  style?: InfinityEdgeStyle;
  trough?: InfinityTrough;
  /** Scuppers only: number of openings (2–8). */
  scupperCount?: number;
  /** Scuppers only: clear gap between openings (mm). */
  scupperGapMm?: number;
  /**
   * Design nappe / head over the weir crest (inches).
   * Drives Francis weir flow. Defaults by style (sheet ¼″, scuppers ½″, sheer 1″).
   */
  designHeadIn?: number;
  /**
   * Francis end contractions. Vanishing edges typically use 2; suppressed /
   * slot-style full-width weirs use 0.
   */
  endContractions?: number;
  /**
   * Surge displacement depth over the main pool surface (inches).
   * Phillips/Gutai water-in-transit protocol defaults to 2″.
   */
  surgeDisplacementIn?: number;
  /** Static lift from trough water surface to pool returns (mm). */
  staticLiftMm?: number;
  /** One-way equivalent pipe run for friction estimate (mm). */
  pipeRunMm?: number;
  /** Authorable suction pipe nominal ID (inches). */
  suctionPipeIdIn?: number;
  /** Authorable return pipe nominal ID (inches). */
  returnPipeIdIn?: number;
  /** Optional override for edge flow readout (GPM). */
  flowGpmOverride?: number;
  /** Optional override for recommended surge volume (gal). */
  surgeGalOverride?: number;
};

/** How a patio handles existing grade fall-away relative to house FFE. */
export type PatioGradeStrategy = "fill" | "retaining" | "both";

export type PatioRegion = {
  id: string;
  name: string;
  outline: PointMm[];
  materialId?: string;
  /**
   * Site-grade remediation under / at this patio.
   * Defaults to "both" (fill + retaining where triggered).
   */
  gradeStrategy?: PatioGradeStrategy;
};

/**
 * Spot elevation on the property relative to house FFE (patio top datum).
 * `dropMm > 0` = existing grade below FFE; `dropMm < 0` = rise above FFE.
 */
export type GradeSample = {
  id: string;
  position: PointMm;
  dropMm: number;
  /** Plan orientation of the drop/rise arrow (degrees). */
  rotationDeg?: number;
};

export type DesignGradeOptions = {
  /**
   * Drop (mm) above which retaining is assumed when strategy includes it.
   * Default 457.2 mm (18″).
   */
  retainingTriggerMm?: number;
};

/** Default retaining trigger: 18″ of drop. */
export const DEFAULT_RETAINING_TRIGGER_MM = 457.2;

export type PatioCoverKind = "pergola" | "roof";

/** Post + footing under a patio cover / pergola */
export type CoverSupport = {
  id: string;
  /** Plan center of the post / footing */
  position: PointMm;
  /** Post square size (mm). Defaults to 6×6. */
  postSizeMm?: number;
  /** Footing square size (mm). Defaults to 16×16. */
  footingSizeMm?: number;
};

/** Shade structure over a patio / deck (pergola or solid roof) */
export type PatioCover = {
  id: string;
  name: string;
  kind: PatioCoverKind;
  /** Closed footprint polygon in mm */
  outline: PointMm[];
  /** Optional link to the patio it covers */
  patioId?: string;
  /** Structure height above deck (mm) */
  heightMm?: number;
  /** Structural posts + footings (movable after placement) */
  supports?: CoverSupport[];
};

/** Typical pergola post height ~8' */
export const DEFAULT_PERGOLA_HEIGHT_MM = 2438.4;
/** Typical patio roof height ~9' */
export const DEFAULT_PATIO_ROOF_HEIGHT_MM = 2743.2;

export type BuildingKind = "house" | "garage" | "accessory" | "commercial";

export type BuildingOpeningKind = "door" | "sliding_door" | "window";

/** Door / sliding door / window on a building wall edge */
export type BuildingOpening = {
  id: string;
  kind: BuildingOpeningKind;
  /** Edge from outline[edgeIndex] → outline[(edgeIndex + 1) % n] */
  edgeIndex: number;
  /** Center of opening along the edge, 0..1 */
  t: number;
  widthMm: number;
  /** Rough opening height (elevation / schedule) */
  heightMm: number;
  /**
   * 1-based story the opening sits on (1 = ground floor).
   * Defaults to 1 when missing. Clamped to the building's story count.
   */
  story?: number;
  /**
   * Bottom of the opening above that story's finished floor (mm).
   * Windows default to ~36″; doors / sliders default to 0 (on the floor).
   */
  sillAboveFloorMm?: number;
};

/** Standard exterior door 36″ × 80″ */
export const DEFAULT_DOOR_WIDTH_MM = 914.4;
export const DEFAULT_DOOR_HEIGHT_MM = 2032;
/** 6′ patio sliding door × 80″ */
export const DEFAULT_SLIDING_DOOR_WIDTH_MM = 1828.8;
export const DEFAULT_SLIDING_DOOR_HEIGHT_MM = 2032;
/** Typical window 36″ × 48″ */
export const DEFAULT_WINDOW_WIDTH_MM = 914.4;
export const DEFAULT_WINDOW_HEIGHT_MM = 1219.2;

export function defaultOpeningSize(kind: BuildingOpeningKind): {
  widthMm: number;
  heightMm: number;
} {
  if (kind === "sliding_door") {
    return {
      widthMm: DEFAULT_SLIDING_DOOR_WIDTH_MM,
      heightMm: DEFAULT_SLIDING_DOOR_HEIGHT_MM,
    };
  }
  if (kind === "window") {
    return {
      widthMm: DEFAULT_WINDOW_WIDTH_MM,
      heightMm: DEFAULT_WINDOW_HEIGHT_MM,
    };
  }
  return { widthMm: DEFAULT_DOOR_WIDTH_MM, heightMm: DEFAULT_DOOR_HEIGHT_MM };
}

export function openingKindLabel(kind: BuildingOpeningKind): string {
  if (kind === "sliding_door") return "Sliding door";
  if (kind === "window") return "Window";
  return "Door";
}

/** Keep opening center on the edge so width fits within the wall segment. */
export function clampOpeningT(
  edgeLengthMm: number,
  widthMm: number,
  t: number,
): number {
  if (edgeLengthMm <= 1e-6) return 0.5;
  if (widthMm >= edgeLengthMm) return 0.5;
  const half = widthMm / 2 / edgeLengthMm;
  return Math.min(1 - half, Math.max(half, t));
}

/** Structure footprint (house / building) — optional but common for residential */
export type Building = {
  id: string;
  name: string;
  /** Closed footprint polygon in mm */
  outline: PointMm[];
  /** Above-grade stories (1, 2, 3+). Defaults to 1 when missing. */
  stories: number;
  /**
   * Clear floor-to-ceiling height per story (mm).
   * Defaults to 8′ (`DEFAULT_CEILING_HEIGHT_MM`) when missing.
   */
  ceilingHeightMm?: number;
  kind?: BuildingKind;
  /**
   * Exterior wall finish id from `HOUSE_EXTERIOR_FINISHES`, or `"custom"`.
   * Defaults to white when missing.
   */
  exteriorFinishId?: string;
  /**
   * Custom exterior RGB (0–255). Used when `exteriorFinishId` is `"custom"`.
   */
  exteriorColor?: { r: number; g: number; b: number };
  /** Doors and windows on wall edges */
  openings?: BuildingOpening[];
};

export type PlacedObject = {
  id: string;
  /** References OBJECT_LIBRARY id */
  catalogItemId: string;
  name: string;
  /** Center of footprint */
  position: PointMm;
  rotationDeg: number;
  layerId: DesignLayerId;
  /**
   * Footprint snapshot at placement (mm).
   * For dining sets this is the **tabletop** size; plan footprint adds chair clearance.
   */
  widthMm: number;
  depthMm: number;
  /** Vertical size for 3D (mm). Filled from catalog when missing. */
  heightMm?: number;
  /** Optional link to a pool/spa body (spa package equipment) */
  parentBodyId?: string;
  /** Wood / frame finish id (see furniture-finishes). */
  frameFinishId?: string;
  /**
   * Cushion / sling / canopy finish id.
   * Umbrellas use this for canopy canvas.
   */
  fabricFinishId?: string;
  /**
   * Bubbler option: niche LED under the fountain (affects estimate).
   * Only meaningful for spa_bubbler / pool_bubbler.
   */
  hasLedLight?: boolean;
  /** Scale figure sex — only for `person_scale`. */
  personSex?: "female" | "male";
  /** Scale figure outfit id — only for `person_scale`. */
  personOutfitId?: string;
};

export type PlumbingRun = {
  id: string;
  name: string;
  circuit: "suction" | "return" | "gas" | "other";
  /** Polyline vertices in mm */
  points: PointMm[];
  /**
   * Optional elevation of each point above grade (mm). Parallel to `points`.
   * Negative = buried trench; positive = riser / equipment port height.
   * When omitted, 3D treats the whole run as buried.
   */
  elevationsMm?: number[];
  pipeDiameterMm?: number;
  /** Optional link to a pool/spa body (auto spa plumbing) */
  parentBodyId?: string;
  /** Optional link to pad equipment (pump / pad) this run serves */
  equipmentObjectId?: string;
  /**
   * Auto-built pad manifold (risers + pump→filter→heater→salt).
   * Rebuilt when pad equipment moves; not tied to a water body.
   */
  padLocal?: boolean;
};

/** Property fence material / style. */
export type FenceKind =
  | "aluminum"
  | "wood"
  | "vinyl"
  | "wrought_iron"
  | "chain_link"
  | "glass";

export const FENCE_KINDS: FenceKind[] = [
  "aluminum",
  "wood",
  "vinyl",
  "wrought_iron",
  "chain_link",
  "glass",
];

/** Gate style placed as an opening on a fence run. */
export type GateKind = "swing" | "double_swing" | "sliding";

export const GATE_KINDS: GateKind[] = ["swing", "double_swing", "sliding"];

/** Typical residential fence height 6′ */
export const DEFAULT_FENCE_HEIGHT_MM = 1828.8;
/** Glass pool barriers are often ~5′ */
export const DEFAULT_GLASS_FENCE_HEIGHT_MM = 1524;
/** Plan / 3D panel thickness */
export const FENCE_THICKNESS_MM = 50;

/** Single pedestrian gate ~36″ */
export const DEFAULT_GATE_WIDTH_MM = 914.4;
/** Double swing / driveway-style ~10′ */
export const DEFAULT_DOUBLE_GATE_WIDTH_MM = 3048;
/** Sliding gate ~12′ */
export const DEFAULT_SLIDING_GATE_WIDTH_MM = 3657.6;

export type FenceGate = {
  id: string;
  kind: GateKind;
  /** Segment: points[edgeIndex] → points[edgeIndex + 1] (open polyline). */
  edgeIndex: number;
  /** Center of gate along the edge, 0..1 */
  t: number;
  widthMm: number;
  /** Gate leaf height; defaults to fence height when omitted. */
  heightMm?: number;
  /** Optional color override (otherwise inherits fence finish). */
  finishId?: string;
};

/** Open polyline fence run along a property / yard line. */
export type FenceRun = {
  id: string;
  name: string;
  kind: FenceKind;
  /** Open polyline vertices in mm */
  points: PointMm[];
  /** Height above grade (mm). Defaults by kind when omitted. */
  heightMm?: number;
  /** Color / stain / powder-coat finish id (see fence-finishes). */
  finishId?: string;
  gates?: FenceGate[];
};

export function fenceKindLabel(kind: FenceKind): string {
  if (kind === "wrought_iron") return "Wrought iron";
  if (kind === "chain_link") return "Chain link";
  if (kind === "aluminum") return "Aluminum";
  if (kind === "vinyl") return "Vinyl";
  if (kind === "glass") return "Glass";
  return "Wood";
}

export function gateKindLabel(kind: GateKind): string {
  if (kind === "double_swing") return "Double swing";
  if (kind === "sliding") return "Sliding";
  return "Swing";
}

export function defaultFenceHeightMm(kind: FenceKind): number {
  return kind === "glass"
    ? DEFAULT_GLASS_FENCE_HEIGHT_MM
    : DEFAULT_FENCE_HEIGHT_MM;
}

export function defaultGateSize(kind: GateKind): {
  widthMm: number;
  heightMm: number;
} {
  if (kind === "double_swing") {
    return {
      widthMm: DEFAULT_DOUBLE_GATE_WIDTH_MM,
      heightMm: DEFAULT_FENCE_HEIGHT_MM,
    };
  }
  if (kind === "sliding") {
    return {
      widthMm: DEFAULT_SLIDING_GATE_WIDTH_MM,
      heightMm: DEFAULT_FENCE_HEIGHT_MM,
    };
  }
  return {
    widthMm: DEFAULT_GATE_WIDTH_MM,
    heightMm: DEFAULT_FENCE_HEIGHT_MM,
  };
}

export function isFenceKind(value: unknown): value is FenceKind {
  return (
    typeof value === "string" && (FENCE_KINDS as string[]).includes(value)
  );
}

export function isGateKind(value: unknown): value is GateKind {
  return typeof value === "string" && (GATE_KINDS as string[]).includes(value);
}

/**
 * Gate endpoints on an open fence polyline (same math as building openings,
 * but edges are not closed).
 */
export function gateEndpoints(
  points: PointMm[],
  gate: Pick<FenceGate, "edgeIndex" | "t" | "widthMm">,
): {
  a: PointMm;
  b: PointMm;
  center: PointMm;
  edgeA: PointMm;
  edgeB: PointMm;
} | null {
  if (points.length < 2) return null;
  const maxEdge = points.length - 2;
  const edgeIndex = Math.min(maxEdge, Math.max(0, gate.edgeIndex | 0));
  const edgeA = points[edgeIndex];
  const edgeB = points[edgeIndex + 1];
  const edgeLen = segmentLengthMm(edgeA, edgeB);
  if (edgeLen < 1e-6) return null;
  const t = clampOpeningT(edgeLen, gate.widthMm, gate.t);
  const half = Math.min(gate.widthMm / 2, edgeLen / 2);
  const ux = (edgeB.x - edgeA.x) / edgeLen;
  const uy = (edgeB.y - edgeA.y) / edgeLen;
  const center = {
    x: edgeA.x + (edgeB.x - edgeA.x) * t,
    y: edgeA.y + (edgeB.y - edgeA.y) * t,
  };
  return {
    edgeA,
    edgeB,
    center,
    a: { x: center.x - ux * half, y: center.y - uy * half },
    b: { x: center.x + ux * half, y: center.y + uy * half },
  };
}

/** Fence LF for takeoff: path length minus gate openings. */
export function fenceBillableLengthMm(fence: FenceRun): number {
  const total = polylineLengthMm(fence.points);
  const gates = fence.gates ?? [];
  let openings = 0;
  for (const g of gates) {
    openings += Math.max(0, g.widthMm);
  }
  return Math.max(0, total - openings);
}

export type PoolFeatureKind = "steps" | "bench" | "sunshelf";

/** Typical sunshelf / tanning ledge water depth ~9″ */
export const DEFAULT_SUNSHELF_DEPTH_MM = 228.6;

/** In-pool features (steps, benches, sunshelf) drawn as closed polygons */
export type PoolFeature = {
  id: string;
  kind: PoolFeatureKind;
  name: string;
  outline: PointMm[];
  /** Optional link to a pool body */
  poolBodyId?: string;
  /** Step risers (steps only) */
  riserCount?: number;
  /** Water depth on the ledge (sunshelf only) */
  depthMm?: number;
  /**
   * When false, hide waterline tile on steps / sunshelf.
   * Default (undefined) = show, matching the parent pool finish.
   */
  waterlineTiles?: boolean;
  /**
   * Optional waterline tile finish override for steps / sunshelf.
   * When omitted, inherits the parent pool's waterlineTileId.
   */
  waterlineTileId?: string;
  /**
   * Nosing band width on the tread / shelf top (mm).
   * How far the tile strip runs inward from the edge. Default ~6″.
   */
  waterlineNosingBandMm?: number;
};

/** User-authored estimate line (not derived from geometry). */
export type EstimateCustomLine = {
  id: string;
  name: string;
  category: CatalogCategory | "other";
  unit: CatalogUnit;
  quantity: number;
  /** Sell price in USD cents */
  unitPriceCents: number;
  note?: string;
};

/**
 * Estimate adjustments persisted with the design.
 * Auto takeoff is recomputed; these filter/add on top.
 */
export type DesignEstimate = {
  /** Stable keys of auto-generated lines the user removed */
  removedLineKeys?: string[];
  customLines?: EstimateCustomLine[];
};

export type DesignDocument = {
  version: 1;
  designLevel: DesignLevel;
  /** Display preference when project was last saved (designer override still applies in UI) */
  unitSystem: UnitSystem;
  layers: { id: string; name: string; visible: boolean }[];
  poolBodies: PoolBody[];
  patios: PatioRegion[];
  buildings: Building[];
  patioCovers: PatioCover[];
  objects: PlacedObject[];
  plumbingRuns: PlumbingRun[];
  features: PoolFeature[];
  /** Property fence runs with optional gates */
  fences?: FenceRun[];
  /** Optional BOM edits (removed auto lines + custom adds) */
  estimate?: DesignEstimate;
  /** Spot elevations relative to house FFE */
  gradeSamples?: GradeSample[];
  gradeOptions?: DesignGradeOptions;
  /**
   * True north relative to the 2D plan, in degrees clockwise from drawing-up.
   * 0 = north is up on the sheet (default). Rotates the north arrow only —
   * the CAD geometry is not rotated.
   */
  northDeg?: number;
  /** Calibrated site-survey image underlay for tracing (2D plan). */
  surveyUnderlay?: SurveyUnderlay;
};

/** Raster survey / site plan placed in CAD millimeters. */
export type SurveyUnderlay = {
  /** http(s) Blob URL, or a short data URL in local-only setups. */
  imageUrl: string;
  pixelWidth: number;
  pixelHeight: number;
  /** Plan width of the full bitmap (mm). Height follows pixel aspect. */
  widthMm: number;
  heightMm: number;
  /** Plan position of the bitmap's top-left corner (pre-rotation). */
  origin: PointMm;
  /** Clockwise degrees in plan space (Y down), about `origin`. */
  rotationDeg: number;
  /** 0..1 */
  opacity: number;
  /** When true, the underlay cannot be dragged. */
  locked?: boolean;
  /** True after a two-point known-length calibration. */
  calibrated?: boolean;
};

export function emptyDesignDocument(
  designLevel: DesignLevel,
  unitSystem: UnitSystem = "imperial",
  layerNames: string[] = [
    "house",
    "pool",
    "patio",
    "covers",
    "fence",
    "plumbing",
    "furniture",
    "features",
    "equipment",
    "notes",
    "survey",
  ],
): DesignDocument {
  return {
    version: 1,
    designLevel,
    unitSystem,
    layers: layerNames.map((name) => ({
      id: name,
      name,
      visible: true,
    })),
    poolBodies: [],
    patios: [],
    buildings: [],
    patioCovers: [],
    objects: [],
    plumbingRuns: [],
    features: [],
    fences: [],
    estimate: { removedLineKeys: [], customLines: [] },
    gradeSamples: [],
    gradeOptions: { retainingTriggerMm: DEFAULT_RETAINING_TRIGGER_MM },
    northDeg: 0,
  };
}

/** Wrap a north bearing into 0..360 (0 = drawing-up). */
export function normalizeNorthDeg(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
}

/** Euclidean segment length in mm */
export function segmentLengthMm(a: PointMm, b: PointMm): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/**
 * Offset one edge of a closed outline along its perpendicular.
 * Both endpoints move by the same amount so the edge stays parallel
 * (a rectangle stays a rectangle; adjacent sides only change length).
 */
export function offsetClosedOutlineEdge(
  outline: PointMm[],
  edgeIndex: number,
  delta: PointMm,
): PointMm[] {
  if (outline.length < 2) return outline;
  const n = outline.length;
  const i = ((edgeIndex % n) + n) % n;
  const j = (i + 1) % n;
  const a = outline[i];
  const b = outline[j];
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len = Math.hypot(ex, ey);
  if (len < 1e-6) return outline;
  const nx = -ey / len;
  const ny = ex / len;
  const along = delta.x * nx + delta.y * ny;
  if (Math.abs(along) < 1e-9) return outline;
  const mx = nx * along;
  const my = ny * along;
  return outline.map((p, idx) =>
    idx === i || idx === j ? { x: p.x + mx, y: p.y + my } : p,
  );
}

/** Total polyline length in mm */
export function polylineLengthMm(points: PointMm[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += segmentLengthMm(points[i - 1], points[i]);
  }
  return total;
}

/** Closed polygon perimeter in mm */
export function polygonPerimeterMm(points: PointMm[]): number {
  if (points.length < 2) return 0;
  return (
    polylineLengthMm(points) +
    segmentLengthMm(points[points.length - 1], points[0])
  );
}

/** Polygon area in mm² (shoelace). Absolute value. */
export function polygonAreaMm2(points: PointMm[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Point-in-polygon (ray cast). Boundary points may be either side. */
export function pointInPolygon(point: PointMm, polygon: PointMm[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distPointToSegmentMm(p: PointMm, a: PointMm, b: PointMm): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return segmentLengthMm(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
  );
  return segmentLengthMm(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Distance from point to nearest edge of a closed polygon. */
export function distToPolygonBoundaryMm(
  point: PointMm,
  polygon: PointMm[],
): number {
  if (polygon.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const d = distPointToSegmentMm(
      point,
      polygon[i],
      polygon[(i + 1) % polygon.length],
    );
    if (d < best) best = d;
  }
  return best;
}

/**
 * Length of colinear overlap between two segments (mm).
 * Used to find the shared wall where a spa attaches to a pool.
 */
export function segmentColinearOverlapMm(
  a1: PointMm,
  a2: PointMm,
  b1: PointMm,
  b2: PointMm,
  tolMm = 50,
): number {
  const ax = a2.x - a1.x;
  const ay = a2.y - a1.y;
  const lenA = Math.hypot(ax, ay);
  if (lenA < 1e-6) return 0;
  const ux = ax / lenA;
  const uy = ay / lenA;
  const bx = b2.x - b1.x;
  const by = b2.y - b1.y;
  const lenB = Math.hypot(bx, by);
  if (lenB < 1e-6) return 0;
  const vx = bx / lenB;
  const vy = by / lenB;
  // Parallel (allow ~3°)
  if (Math.abs(ux * vy - uy * vx) > 0.05) return 0;
  const lineDist = (p: PointMm) =>
    Math.abs(ux * (p.y - a1.y) - uy * (p.x - a1.x));
  if (lineDist(b1) > tolMm || lineDist(b2) > tolMm) return 0;
  const proj = (p: PointMm) => (p.x - a1.x) * ux + (p.y - a1.y) * uy;
  let bMin = proj(b1);
  let bMax = proj(b2);
  if (bMin > bMax) {
    const tmp = bMin;
    bMin = bMax;
    bMax = tmp;
  }
  const left = Math.max(0, bMin);
  const right = Math.min(lenA, bMax);
  return Math.max(0, right - left);
}

/**
 * Shared boundary length between two closed polygons (mm):
 * colinear overlapping edges + edges of each poly that lie inside the other.
 * Pairwise: exposed perimeter ≈ P(A)+P(B) − 2×shared.
 */
export function sharedBoundaryLengthMm(
  polyA: PointMm[],
  polyB: PointMm[],
  tolMm = 50,
): number {
  if (polyA.length < 2 || polyB.length < 2) return 0;

  let colinear = 0;
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      colinear += segmentColinearOverlapMm(
        a1,
        a2,
        polyB[j],
        polyB[(j + 1) % polyB.length],
        tolMm,
      );
    }
  }

  /** Edges whose midpoint is clearly inside the other body (not on the shared wall). */
  const interiorEdgeLength = (poly: PointMm[], other: PointMm[]): number => {
    let total = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const len = segmentLengthMm(a, b);
      if (len < 1e-6) continue;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (
        pointInPolygon(mid, other) &&
        distToPolygonBoundaryMm(mid, other) > tolMm
      ) {
        total += len;
      }
    }
    return total;
  };

  return (
    colinear +
    interiorEdgeLength(polyA, polyB) +
    interiorEdgeLength(polyB, polyA)
  );
}

/**
 * Sum of body perimeters minus shared walls (each shared length removed from both).
 * Use for coping / waterline when pools and spas attach or overlap.
 */
export function exposedWaterPerimeterMm(outlines: PointMm[][]): number {
  let peri = 0;
  for (const outline of outlines) {
    peri += polygonPerimeterMm(outline);
  }
  let shared = 0;
  for (let i = 0; i < outlines.length; i++) {
    for (let j = i + 1; j < outlines.length; j++) {
      shared += sharedBoundaryLengthMm(outlines[i], outlines[j]);
    }
  }
  return Math.max(0, peri - 2 * shared);
}

/**
 * Approximate intersection area of two polygons via grid sampling (mm²).
 * Good enough for takeoff when a spa footprint overlaps a pool.
 */
export function approximateIntersectionAreaMm2(
  polyA: PointMm[],
  polyB: PointMm[],
  stepMm = 152.4,
): number {
  if (polyA.length < 3 || polyB.length < 3) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of [...polyA, ...polyB]) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  // Tighten to bbox intersection
  let aMinX = Infinity;
  let aMinY = Infinity;
  let aMaxX = -Infinity;
  let aMaxY = -Infinity;
  for (const p of polyA) {
    aMinX = Math.min(aMinX, p.x);
    aMinY = Math.min(aMinY, p.y);
    aMaxX = Math.max(aMaxX, p.x);
    aMaxY = Math.max(aMaxY, p.y);
  }
  let bMinX = Infinity;
  let bMinY = Infinity;
  let bMaxX = -Infinity;
  let bMaxY = -Infinity;
  for (const p of polyB) {
    bMinX = Math.min(bMinX, p.x);
    bMinY = Math.min(bMinY, p.y);
    bMaxX = Math.max(bMaxX, p.x);
    bMaxY = Math.max(bMaxY, p.y);
  }
  minX = Math.max(aMinX, bMinX);
  minY = Math.max(aMinY, bMinY);
  maxX = Math.min(aMaxX, bMaxX);
  maxY = Math.min(aMaxY, bMaxY);
  if (maxX <= minX || maxY <= minY) return 0;

  const step = Math.max(50, stepMm);
  let hits = 0;
  let samples = 0;
  for (let x = minX + step / 2; x < maxX; x += step) {
    for (let y = minY + step / 2; y < maxY; y += step) {
      samples += 1;
      const p = { x, y };
      if (pointInPolygon(p, polyA) && pointInPolygon(p, polyB)) hits += 1;
    }
  }
  if (samples === 0) return 0;
  return hits * step * step;
}

/** Default residential-ish depths: 3' shallow / 8' deep */
export const DEFAULT_POOL_SHALLOW_MM = 914.4;
export const DEFAULT_POOL_DEEP_MM = 2438.4;
/** Typical gunite pool wall ~8" */
export const DEFAULT_POOL_WALL_THICKNESS_MM = 200;
/** Typical spa sitting depth ~3'6" */
export const DEFAULT_SPA_DEPTH_MM = 1066.8;
/** Typical gunite/shell wall thickness ~6" */
export const DEFAULT_SPA_WALL_THICKNESS_MM = 152.4;
/** Typical raised spa shell height above deck ~18" */
export const DEFAULT_SPA_SHELL_HEIGHT_MM = 457.2;

export function waterBodyKind(body: PoolBody): WaterBodyKind {
  return body.kind ?? "pool";
}

export function axisAlignedRect(
  a: PointMm,
  b: PointMm,
): PointMm[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/**
 * Rectangle from three clicks: A→B is one side, C sets the perpendicular depth.
 * Works for axis-aligned or rotated boxes.
 */
export function rectFromThreePoints(
  a: PointMm,
  b: PointMm,
  c: PointMm,
): PointMm[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return axisAlignedRect(a, c);
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const dist = (c.x - a.x) * px + (c.y - a.y) * py;
  return [
    a,
    b,
    { x: b.x + px * dist, y: b.y + py * dist },
    { x: a.x + px * dist, y: a.y + py * dist },
  ];
}

/** Point on the side of AB toward `sideHint`, at perpendicular distance `depthMm`. */
export function pointAtRectDepth(
  a: PointMm,
  b: PointMm,
  sideHint: PointMm,
  depthMm: number,
): PointMm {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: a.x, y: a.y + depthMm };
  const px = -dy / len;
  const py = dx / len;
  const sign =
    (sideHint.x - a.x) * px + (sideHint.y - a.y) * py >= 0 ? 1 : -1;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return {
    x: mid.x + px * sign * depthMm,
    y: mid.y + py * sign * depthMm,
  };
}

/** Axis-aligned footprint corners for a placed object (ignores rotation). */
export function objectFootprintAxis(obj: PlacedObject): PointMm[] {
  const { widthMm, depthMm } = objectPlanSizeMm(obj);
  const hw = widthMm / 2;
  const hd = depthMm / 2;
  return [
    { x: obj.position.x - hw, y: obj.position.y - hd },
    { x: obj.position.x + hw, y: obj.position.y - hd },
    { x: obj.position.x + hw, y: obj.position.y + hd },
    { x: obj.position.x - hw, y: obj.position.y + hd },
  ];
}

/** Rotated footprint corners around object center. */
export function objectFootprint(obj: PlacedObject): PointMm[] {
  const { widthMm, depthMm } = objectPlanSizeMm(obj);
  const hw = widthMm / 2;
  const hd = depthMm / 2;
  const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners: PointMm[] = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];
  return corners.map((c) => ({
    x: obj.position.x + c.x * cos - c.y * sin,
    y: obj.position.y + c.x * sin + c.y * cos,
  }));
}

export type DesignGuideStep = {
  id: string;
  title: string;
  done: boolean;
  hint: string;
};

/** Simple guided checklist for designers building out a job */
export function designGuideSteps(design: DesignDocument): DesignGuideStep[] {
  const features = design.features ?? [];
  const fences = design.fences ?? [];
  const objects = design.objects ?? [];
  const furnitureOnly = objects.filter(
    (o) =>
      ![
        "equip_pad",
        "pump_variable_speed",
        "filter_cartridge",
        "heater_gas",
        "salt_chlorinator",
        "spa_drain",
        "pool_drain",
        "pool_skimmer",
        "pool_return",
        "spa_bubbler",
        "pool_bubbler",
        "spa_jet",
        "light_standard",
        "light_color",
      ].includes(o.catalogItemId),
  );
  const hasPoolPackage = objects.some(
    (o) =>
      o.catalogItemId === "pool_drain" ||
      o.catalogItemId === "pool_skimmer" ||
      o.catalogItemId === "pool_return",
  );
  return [
    {
      id: "house",
      title: "Draw the house (optional)",
      done: (design.buildings ?? []).length > 0,
      hint: "House rect/poly — set stories in Properties (1, 2, 3+)",
    },
    {
      id: "openings",
      title: "Add doors & windows",
      done: (design.buildings ?? []).some((b) => (b.openings ?? []).length > 0),
      hint: "Opening tool — click a house wall; set width/height in Properties",
    },
    {
      id: "pool",
      title: "Draw the pool or spa",
      done: design.poolBodies.length > 0,
      hint:
        "Pool/Spa rect — pools auto-add drains, skimmers, returns, lights & steps; spas auto-add benches/jets",
    },
    {
      id: "fixtures",
      title: "Confirm water fixtures",
      done: hasPoolPackage || objects.some((o) => o.catalogItemId === "spa_drain"),
      hint: "Package fixtures land automatically — adjust on plan as needed",
    },
    {
      id: "features",
      title: "Add steps, bench, or sunshelf",
      done: features.some(
        (f) =>
          f.kind === "steps" || f.kind === "bench" || f.kind === "sunshelf",
      ),
      hint: "Use Steps, Bench, or Sunshelf tools (pools include entry steps)",
    },
    {
      id: "patio",
      title: "Add patio / deck",
      done: design.patios.length > 0,
      hint: "Trace the surround with Patio",
    },
    {
      id: "fence",
      title: "Add barrier fence & gate",
      done: fences.length > 0 && fences.some((f) => (f.gates ?? []).length > 0),
      hint: "Fence tool + gate — aim for 48″+ enclosure (ISPSC-style soft check)",
    },
    {
      id: "covers",
      title: "Add pergola or patio roof",
      done: (design.patioCovers ?? []).length > 0,
      hint: "Cover rect — Pergola or Roof over the patio",
    },
    {
      id: "equipment",
      title: "Place pad equipment",
      done: objects.some((o) =>
        [
          "equip_pad",
          "pump_variable_speed",
          "filter_cartridge",
          "heater_gas",
          "salt_chlorinator",
        ].includes(o.catalogItemId),
      ),
      hint: "Library → Pad equipment (pump, filter, heater)",
    },
    {
      id: "plumbing",
      title: "Plumbing to equipment",
      done: design.plumbingRuns.some((r) => !!r.equipmentObjectId),
      hint: "Auto-routes when a pool/spa is added after pad equipment",
    },
    {
      id: "furniture",
      title: "Place furniture / amenities",
      done: furnitureOnly.length > 0,
      hint: "Library tool — lounge chairs, tables, etc.",
    },
    {
      id: "estimate",
      title: "Review the estimate",
      done: false,
      hint: "Open Estimate / BOM — check gallons, excavation, hydraulics notes",
    },
  ];
}
