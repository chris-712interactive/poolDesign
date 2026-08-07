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
   * For spas this is the outside/shell dimension; inside waterline is
   * derived via wallThicknessMm.
   */
  outline: PointMm[];
  depthShallowMm: number;
  depthDeepMm: number;
  /** Defaults to pool when missing (older documents) */
  kind?: WaterBodyKind;
  /** Spa shell / wall thickness (mm). Outside outline insets by this for waterline. */
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
  kind?: BuildingKind;
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
};

export type PlumbingRun = {
  id: string;
  name: string;
  circuit: "suction" | "return" | "gas" | "other";
  /** Polyline vertices in mm */
  points: PointMm[];
  pipeDiameterMm?: number;
  /** Optional link to a pool/spa body (auto spa plumbing) */
  parentBodyId?: string;
  /** Optional link to pad equipment (pump / pad) this run serves */
  equipmentObjectId?: string;
};

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
  /** Optional BOM edits (removed auto lines + custom adds) */
  estimate?: DesignEstimate;
  /** Spot elevations relative to house FFE */
  gradeSamples?: GradeSample[];
  gradeOptions?: DesignGradeOptions;
};

export function emptyDesignDocument(
  designLevel: DesignLevel,
  unitSystem: UnitSystem = "imperial",
  layerNames: string[] = [
    "house",
    "pool",
    "patio",
    "covers",
    "plumbing",
    "furniture",
    "features",
    "equipment",
    "notes",
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
    estimate: { removedLineKeys: [], customLines: [] },
    gradeSamples: [],
    gradeOptions: { retainingTriggerMm: DEFAULT_RETAINING_TRIGGER_MM },
  };
}

/** Euclidean segment length in mm */
export function segmentLengthMm(a: PointMm, b: PointMm): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
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
      hint: "Use Pool/Spa rect — spas auto-add benches, jets, and plumbing",
    },
    {
      id: "features",
      title: "Add steps, bench, or sunshelf",
      done: features.some(
        (f) =>
          f.kind === "steps" || f.kind === "bench" || f.kind === "sunshelf",
      ),
      hint: "Use Steps, Bench, or Sunshelf tools inside the pool",
    },
    {
      id: "patio",
      title: "Add patio / deck",
      done: design.patios.length > 0,
      hint: "Trace the surround with Patio",
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
      done: (design.objects ?? []).some((o) =>
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
      done: (design.objects ?? []).length > 0,
      hint: "Library tool — click to place",
    },
    {
      id: "estimate",
      title: "Review the estimate",
      done: false,
      hint: "Open Estimate / BOM when ready",
    },
  ];
}
