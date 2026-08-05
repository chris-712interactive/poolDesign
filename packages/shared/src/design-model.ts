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
  catalogItemId: string;
  name: string;
  position: PointMm;
  rotationDeg: number;
  layerId: DesignLayerId;
};

export type PlumbingRun = {
  id: string;
  name: string;
  circuit: "suction" | "return" | "gas" | "other";
  /** Polyline vertices in mm */
  points: PointMm[];
  pipeDiameterMm?: number;
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
};

export function emptyDesignDocument(
  designLevel: DesignLevel,
  unitSystem: UnitSystem = "imperial",
  layerNames: string[] = ["pool", "patio", "plumbing", "furniture", "notes"],
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
