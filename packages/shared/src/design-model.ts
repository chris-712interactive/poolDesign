import type { DesignLevel } from "./design-level";
import type { UnitSystem } from "./units";

export type PointMm = { x: number; y: number };

export type DesignLayerId = string;

export type PoolBody = {
  id: string;
  name: string;
  /** Closed polygon in mm */
  outline: PointMm[];
  depthShallowMm: number;
  depthDeepMm: number;
};

export type PatioRegion = {
  id: string;
  name: string;
  outline: PointMm[];
  materialId?: string;
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
  /** Footprint snapshot at placement (mm) */
  widthMm: number;
  depthMm: number;
};

export type PlumbingRun = {
  id: string;
  name: string;
  circuit: "suction" | "return" | "gas" | "other";
  /** Polyline vertices in mm */
  points: PointMm[];
  pipeDiameterMm?: number;
};

export type PoolFeatureKind = "steps" | "bench";

/** In-pool features (steps, benches) drawn as closed polygons */
export type PoolFeature = {
  id: string;
  kind: PoolFeatureKind;
  name: string;
  outline: PointMm[];
  /** Optional link to a pool body */
  poolBodyId?: string;
  /** Step risers (steps only) */
  riserCount?: number;
};

export type DesignDocument = {
  version: 1;
  designLevel: DesignLevel;
  /** Display preference when project was last saved (designer override still applies in UI) */
  unitSystem: UnitSystem;
  layers: { id: string; name: string; visible: boolean }[];
  poolBodies: PoolBody[];
  patios: PatioRegion[];
  objects: PlacedObject[];
  plumbingRuns: PlumbingRun[];
  features: PoolFeature[];
};

export function emptyDesignDocument(
  designLevel: DesignLevel,
  unitSystem: UnitSystem = "imperial",
  layerNames: string[] = [
    "pool",
    "patio",
    "plumbing",
    "furniture",
    "features",
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
    objects: [],
    plumbingRuns: [],
    features: [],
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

/** Default residential-ish depths: 3' shallow / 8' deep */
export const DEFAULT_POOL_SHALLOW_MM = 914.4;
export const DEFAULT_POOL_DEEP_MM = 2438.4;

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

/** Axis-aligned footprint corners for a placed object (ignores rotation). */
export function objectFootprintAxis(obj: PlacedObject): PointMm[] {
  const hw = obj.widthMm / 2;
  const hd = obj.depthMm / 2;
  return [
    { x: obj.position.x - hw, y: obj.position.y - hd },
    { x: obj.position.x + hw, y: obj.position.y - hd },
    { x: obj.position.x + hw, y: obj.position.y + hd },
    { x: obj.position.x - hw, y: obj.position.y + hd },
  ];
}

/** Rotated footprint corners around object center. */
export function objectFootprint(obj: PlacedObject): PointMm[] {
  const hw = obj.widthMm / 2;
  const hd = obj.depthMm / 2;
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
      id: "pool",
      title: "Draw the pool",
      done: design.poolBodies.length > 0,
      hint: "Use Pool rect for a quick start",
    },
    {
      id: "features",
      title: "Add steps or a bench",
      done: features.some((f) => f.kind === "steps" || f.kind === "bench"),
      hint: "Use Steps / Bench tools",
    },
    {
      id: "patio",
      title: "Add patio / deck",
      done: design.patios.length > 0,
      hint: "Trace the surround with Patio",
    },
    {
      id: "plumbing",
      title: "Draw plumbing runs",
      done: design.plumbingRuns.length > 0,
      hint: "Plumbing tool with Ortho on",
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
