/**
 * Pool / spa trench plumbing helpers based on common residential pad practice:
 * - Flow order: suction → pump → filter → heater → (salt) → returns
 * - Prefer ortho (H/V) runs with few elbows
 * - Never trench under houses/buildings; avoid patios unless no reasonable path
 * - Run suction & return as parallel lines (~12" apart)
 * - Suction ≥ 2"; returns ≥ 2" trunk
 */

import type {
  DesignDocument,
  PlacedObject,
  PlumbingRun,
  PointMm,
  PoolBody,
} from "./design-model";
import { waterBodyKind } from "./design-model";

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
};

function outlineBounds(outline: PointMm[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outline) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function expandBounds(b: Bounds, margin: number): Bounds {
  return {
    minX: b.minX - margin,
    minY: b.minY - margin,
    maxX: b.maxX + margin,
    maxY: b.maxY + margin,
    width: b.width + 2 * margin,
    height: b.height + 2 * margin,
    cx: b.cx,
    cy: b.cy,
  };
}

function boundsFromOutline(outline: PointMm[]): Bounds {
  return outlineBounds(outline);
}

function intersectBounds(a: Bounds, b: Bounds): Bounds | null {
  const minX = Math.max(a.minX, b.minX);
  const minY = Math.max(a.minY, b.minY);
  const maxX = Math.min(a.maxX, b.maxX);
  const maxY = Math.min(a.maxY, b.maxY);
  if (maxX - minX < 1 || maxY - minY < 1) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

/** Up to four slabs = `outer` minus `hole` (AABB difference). */
function subtractBounds(outer: Bounds, hole: Bounds): Bounds[] {
  const hit = intersectBounds(outer, hole);
  if (!hit) return [outer];
  const out: Bounds[] = [];
  const push = (minX: number, minY: number, maxX: number, maxY: number) => {
    if (maxX - minX < 50 || maxY - minY < 50) return;
    out.push({
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    });
  };
  // Left / right / bottom / top slabs around the intersection.
  push(outer.minX, outer.minY, hit.minX, outer.maxY);
  push(hit.maxX, outer.minY, outer.maxX, outer.maxY);
  push(hit.minX, outer.minY, hit.maxX, hit.minY);
  push(hit.minX, hit.maxY, hit.maxX, outer.maxY);
  return out;
}

/**
 * Punch water-body free zones out of a patio AABB so shell exits aren't
 * trapped "inside" the deck obstacle, while the surrounding deck stays blocked.
 */
function punchBounds(outer: Bounds, holes: Bounds[]): Bounds[] {
  let pieces = [outer];
  for (const hole of holes) {
    const next: Bounds[] = [];
    for (const p of pieces) next.push(...subtractBounds(p, hole));
    pieces = next;
  }
  return pieces;
}

function pointInBounds(p: PointMm, b: Bounds, margin = 0): boolean {
  return (
    p.x >= b.minX - margin &&
    p.x <= b.maxX + margin &&
    p.y >= b.minY - margin &&
    p.y <= b.maxY + margin
  );
}

const FT = 304.8;
const IN = 25.4;
/** Keep trenches outside structure footprints */
const CLEARANCE_MM = 1 * FT;
/** Extra cost for each bend in a trench route */
const BEND_PENALTY_MM = 3 * FT;

/** Best-practice pipe sizes (mm). */
export const PIPE_SUCTION_MM = 50.8; // 2"
export const PIPE_RETURN_MM = 50.8; // 2"
export const PIPE_RETURN_BRANCH_MM = 38.1; // 1.5"
export const PIPE_FEATURE_MM = 25.4; // 1"
/** Parallel suction/return separation in the trench */
export const PARALLEL_OFFSET_MM = 12 * IN;
/** Buried trench centerline depth (mm below grade) */
export const TRENCH_ELEV_MM = -420;
/** How far past the pad front edge the trench stub sits */
const STUB_OFFSET_MM = 14 * IN;
/** Chase height across the pad before the front drop (mm above grade) */
const PAD_CHASE_ELEV_MM = 120;

export const PAD_EQUIPMENT_IDS = [
  "equip_pad",
  "pump_variable_speed",
  "filter_cartridge",
  "heater_gas",
  "salt_chlorinator",
] as const;

export type PadEquipmentId = (typeof PAD_EQUIPMENT_IDS)[number];

export function isPadEquipment(obj: PlacedObject): boolean {
  return (PAD_EQUIPMENT_IDS as readonly string[]).includes(obj.catalogItemId);
}

export function isPadEquipmentId(id: string): boolean {
  return (PAD_EQUIPMENT_IDS as readonly string[]).includes(id);
}

export type RouteObstacle = {
  outline: PointMm[];
  /** hard = house/building (never under); soft = patio (avoid if possible) */
  priority: "hard" | "soft";
};

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function dist(a: PointMm, b: PointMm): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function polylineLen(pts: PointMm[]): number {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += dist(pts[i - 1], pts[i]);
  return t;
}

function bendCount(pts: PointMm[]): number {
  return Math.max(0, pts.length - 2);
}

/** Ortho segment vs expanded AABB (segments are H or V). */
function orthoSegmentHitsBox(a: PointMm, b: PointMm, box: Bounds): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const horizontal = Math.abs(a.y - b.y) < 1;
  const vertical = Math.abs(a.x - b.x) < 1;
  if (!horizontal && !vertical) {
    // Fallback for slight non-ortho: treat as bbox overlap of the segment
    return !(maxX < box.minX || minX > box.maxX || maxY < box.minY || minY > box.maxY);
  }
  if (horizontal) {
    const y = a.y;
    if (y < box.minY || y > box.maxY) return false;
    return maxX >= box.minX && minX <= box.maxX;
  }
  const x = a.x;
  if (x < box.minX || x > box.maxX) return false;
  return maxY >= box.minY && minY <= box.maxY;
}

function pathHits(
  path: PointMm[],
  boxes: Bounds[],
): number {
  let hits = 0;
  for (let i = 1; i < path.length; i++) {
    for (const box of boxes) {
      if (orthoSegmentHitsBox(path[i - 1], path[i], box)) hits += 1;
    }
  }
  return hits;
}

function scorePath(
  path: PointMm[],
  blockedBoxes: Bounds[],
): number {
  if (path.length < 2) return Infinity;
  if (pathHits(path, blockedBoxes) > 0) return Infinity;
  return polylineLen(path) + bendCount(path) * BEND_PENALTY_MM;
}

function bypassCandidates(from: PointMm, to: PointMm, box: Bounds): PointMm[][] {
  const c = CLEARANCE_MM;
  const left = box.minX - c;
  const right = box.maxX + c;
  const bottom = box.minY - c;
  const top = box.maxY + c;
  return [
    [from, { x: left, y: from.y }, { x: left, y: to.y }, to],
    [from, { x: right, y: from.y }, { x: right, y: to.y }, to],
    [from, { x: from.x, y: bottom }, { x: to.x, y: bottom }, to],
    [from, { x: from.x, y: top }, { x: to.x, y: top }, to],
    // Corner wraps
    [
      from,
      { x: left, y: from.y },
      { x: left, y: bottom },
      { x: to.x, y: bottom },
      to,
    ],
    [
      from,
      { x: right, y: from.y },
      { x: right, y: bottom },
      { x: to.x, y: bottom },
      to,
    ],
    [
      from,
      { x: left, y: from.y },
      { x: left, y: top },
      { x: to.x, y: top },
      to,
    ],
    [
      from,
      { x: right, y: from.y },
      { x: right, y: top },
      { x: to.x, y: top },
      to,
    ],
    [
      from,
      { x: from.x, y: bottom },
      { x: left, y: bottom },
      { x: left, y: to.y },
      to,
    ],
    [
      from,
      { x: from.x, y: bottom },
      { x: right, y: bottom },
      { x: right, y: to.y },
      to,
    ],
    [
      from,
      { x: from.x, y: top },
      { x: left, y: top },
      { x: left, y: to.y },
      to,
    ],
    [
      from,
      { x: from.x, y: top },
      { x: right, y: top },
      { x: right, y: to.y },
      to,
    ],
  ];
}

/** Simple L-route (no obstacle awareness). */
export function routeOrtho(from: PointMm, to: PointMm): PointMm[] {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx < 1 && dy < 1) return [from, to];
  if (dx < 1) return [from, { x: from.x, y: to.y }];
  if (dy < 1) return [from, { x: to.x, y: from.y }];

  const viaH: PointMm[] = [from, { x: to.x, y: from.y }, to];
  const viaV: PointMm[] = [from, { x: from.x, y: to.y }, to];
  return polylineLen(viaH) <= polylineLen(viaV) ? viaH : viaV;
}

/**
 * Ortho route that never crosses houses or patio deck (auto-routes only).
 * Manual plumbing runs are unchanged — designers can still draw under structures.
 */
export function routeOrthoAvoiding(
  from: PointMm,
  to: PointMm,
  obstacles: RouteObstacle[] = [],
): PointMm[] {
  if (!obstacles.length) return routeOrtho(from, to);

  // Auto-routing treats both house and patio as blocked. Patio outlines are
  // usually pre-punched around water bodies in obstaclesFromDesign.
  const blockedBoxes = obstacles.map((o) =>
    expandBounds(outlineBounds(o.outline), CLEARANCE_MM),
  );

  const candidates: PointMm[][] = [];
  const viaH: PointMm[] = [from, { x: to.x, y: from.y }, to];
  const viaV: PointMm[] = [from, { x: from.x, y: to.y }, to];
  candidates.push(viaH, viaV);
  if (Math.abs(from.x - to.x) < 1 || Math.abs(from.y - to.y) < 1) {
    candidates.push([from, to]);
  }

  for (const box of blockedBoxes) {
    candidates.push(...bypassCandidates(from, to, box));
  }

  // Route around the union of all blocked AABBs (house + deck slabs).
  if (blockedBoxes.length) {
    const union = blockedBoxes.reduce(
      (acc, b) => ({
        minX: Math.min(acc.minX, b.minX),
        minY: Math.min(acc.minY, b.minY),
        maxX: Math.max(acc.maxX, b.maxX),
        maxY: Math.max(acc.maxY, b.maxY),
        width: 0,
        height: 0,
        cx: 0,
        cy: 0,
      }),
      blockedBoxes[0],
    );
    candidates.push(
      ...bypassCandidates(from, to, expandBounds(union, CLEARANCE_MM)),
    );
    // Extra ring further out — helps when pad and pool sit on opposite sides.
    candidates.push(
      ...bypassCandidates(from, to, expandBounds(union, CLEARANCE_MM * 3)),
    );
  }

  let best: PointMm[] | null = null;
  let bestScore = Infinity;

  for (const raw of candidates) {
    const path = dedupePoints(raw);
    if (pathHits(path, blockedBoxes) > 0) continue;
    const score =
      polylineLen(path) + bendCount(path) * BEND_PENALTY_MM;
    if (score < bestScore) {
      bestScore = score;
      best = path;
    }
  }

  if (best) return best;

  // No clear candidate — still refuse to tunnel through structures.
  // Walk around the union on the longest clear side as a last resort.
  if (blockedBoxes.length) {
    const union = blockedBoxes.reduce(
      (acc, b) => ({
        minX: Math.min(acc.minX, b.minX),
        minY: Math.min(acc.minY, b.minY),
        maxX: Math.max(acc.maxX, b.maxX),
        maxY: Math.max(acc.maxY, b.maxY),
        width: 0,
        height: 0,
        cx: 0,
        cy: 0,
      }),
      blockedBoxes[0],
    );
    const ring = expandBounds(union, CLEARANCE_MM * 4);
    const ringPaths = bypassCandidates(from, to, ring);
    for (const raw of ringPaths) {
      const path = dedupePoints(raw);
      if (pathHits(path, blockedBoxes) > 0) continue;
      return path;
    }
  }

  // Absolute fallback: direct ortho (may still clip if endpoints are inside
  // blocked regions — user can edit). Prefer this over inventing nonsense.
  return routeOrtho(from, to);
}

/** Collect house + patio obstacles from the design (auto-route blockers). */
export function obstaclesFromDesign(design: DesignDocument): RouteObstacle[] {
  const hard: RouteObstacle[] = (design.buildings ?? [])
    .filter((b) => (b.outline?.length ?? 0) >= 3)
    .map((b) => ({
      outline: b.outline,
      priority: "hard" as const,
    }));

  // Patio deck is also blocked for auto-routes, but punch out water bodies so
  // shell exits aren't trapped inside the deck AABB.
  const waterHoles = (design.poolBodies ?? [])
    .filter((b) => (b.outline?.length ?? 0) >= 3)
    .map((b) => expandBounds(boundsFromOutline(b.outline), 2 * FT));

  for (const patio of design.patios ?? []) {
    if ((patio.outline?.length ?? 0) < 3) continue;
    const outer = boundsFromOutline(patio.outline);
    const pieces = waterHoles.length
      ? punchBounds(outer, waterHoles)
      : [outer];
    for (const piece of pieces) {
      hard.push({
        outline: [
          { x: piece.minX, y: piece.minY },
          { x: piece.maxX, y: piece.minY },
          { x: piece.maxX, y: piece.maxY },
          { x: piece.minX, y: piece.maxY },
        ],
        priority: "hard",
      });
    }
  }

  return hard;
}

/** Offset a polyline perpendicular to its overall from→to direction. */
export function offsetPolyline(
  points: PointMm[],
  offsetMm: number,
): PointMm[] {
  if (points.length < 2) return points;
  const a = points[0];
  const b = points[points.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * offsetMm;
  const oy = (dx / len) * offsetMm;
  return points.map((p) => ({ x: p.x + ox, y: p.y + oy }));
}

export type EquipmentConnection = {
  /** Suction arrives at the pump (or pad). */
  suctionTarget: PointMm;
  /** Filtered/heated water leaves toward the body. */
  returnOrigin: PointMm;
  /** Primary object id for linking runs (pump preferred, else pad). */
  equipmentObjectId: string;
  label: string;
};

/** Hydraulic order on the pad (suction → … → returns). */
const PAD_FLOW_ORDER = [
  "pump_variable_speed",
  "filter_cartridge",
  "heater_gas",
  "salt_chlorinator",
] as const;

type LocalXZ = { lx: number; lz: number };

/**
 * Mesh-local (lx along width / Three X, lz along depth / Three Z) → plan mm.
 * Matches CatalogObjectMesh placement: Three Y-rot by rotationDeg + planToWorldXZ mirror.
 */
export function equipmentLocalToPlan(
  obj: PlacedObject,
  lxMm: number,
  lzMm: number,
): PointMm {
  const rad = ((obj.rotationDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: obj.position.x - lxMm * cos - lzMm * sin,
    y: obj.position.y + lxMm * sin - lzMm * cos,
  };
}

/** Two union ports in mesh-local mm for a pad equipment piece. */
export function equipmentLocalPorts(obj: PlacedObject): [LocalXZ, LocalXZ] {
  const w = Math.max(100, obj.widthMm ?? 600);
  const d = Math.max(100, obj.depthMm ?? 400);
  const id = obj.catalogItemId;

  if (id === "pump_variable_speed" || id.includes("pump")) {
    return [
      { lx: -0.48 * w, lz: 0.28 * d },
      { lx: -0.48 * w, lz: -0.28 * d },
    ];
  }
  if (id === "filter_cartridge" || id.includes("filter")) {
    const r = Math.min(w, d) * 0.42;
    return [
      { lx: r * 0.95, lz: 0 },
      { lx: -r * 0.95, lz: 0 },
    ];
  }
  if (id === "heater_gas" || id.includes("heater")) {
    return [
      { lx: 0.25 * w, lz: -0.48 * d },
      { lx: -0.25 * w, lz: -0.48 * d },
    ];
  }
  if (id === "salt_chlorinator" || id.includes("salt")) {
    const half = (w * 0.72) / 2 + 40;
    return [
      { lx: half, lz: 0 },
      { lx: -half, lz: 0 },
    ];
  }
  return [
    { lx: -0.4 * w, lz: 0.3 * d },
    { lx: -0.4 * w, lz: -0.3 * d },
  ];
}

/** Port height above grade (mm) matching PadEquipmentMesh union elevations. */
export function equipmentPortElevMm(obj: PlacedObject): number {
  const h = Math.max(150, obj.heightMm ?? 500);
  const d = Math.max(100, obj.depthMm ?? 400);
  const id = obj.catalogItemId;
  if (id === "pump_variable_speed" || id.includes("pump")) {
    return Math.round(h * 0.55 * 0.35);
  }
  if (id === "filter_cartridge" || id.includes("filter")) {
    return Math.round(80 + h * 0.78 * 0.22);
  }
  if (id === "heater_gas" || id.includes("heater")) {
    return Math.round(h * 0.82 * 0.25);
  }
  if (id === "salt_chlorinator" || id.includes("salt")) {
    const cellR = Math.min(d * 0.35, h * 0.28);
    return Math.round(cellR + 80);
  }
  return Math.round(h * 0.25);
}

export type EquipmentPortPair = {
  obj: PlacedObject;
  ports: [PointMm, PointMm];
  elevMm: number;
};

export function equipmentPortPair(obj: PlacedObject): EquipmentPortPair {
  const [a, b] = equipmentLocalPorts(obj);
  return {
    obj,
    ports: [
      equipmentLocalToPlan(obj, a.lx, a.lz),
      equipmentLocalToPlan(obj, b.lx, b.lz),
    ],
    elevMm: equipmentPortElevMm(obj),
  };
}

/** Prefer the union closer to `toward` as the connection face. */
export function pickFacingPort(
  pair: EquipmentPortPair,
  toward: PointMm,
): { near: PointMm; far: PointMm } {
  const [a, b] = pair.ports;
  if (dist(a, toward) <= dist(b, toward)) return { near: a, far: b };
  return { near: b, far: a };
}

function padFlowEquipment(design: DesignDocument): PlacedObject[] {
  const equip = (design.objects ?? []).filter(isPadEquipment);
  const out: PlacedObject[] = [];
  for (const id of PAD_FLOW_ORDER) {
    const o = equip.find((e) => e.catalogItemId === id);
    if (o) out.push(o);
  }
  return out;
}

/** Ground stub outside a port, away from the equipment cluster. */
function groundStubNear(
  port: PointMm,
  awayFrom: PointMm,
  offsetMm = STUB_OFFSET_MM,
): PointMm {
  const dx = port.x - awayFrom.x;
  const dy = port.y - awayFrom.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    return { x: port.x + offsetMm, y: port.y };
  }
  return {
    x: port.x + (dx / len) * offsetMm,
    y: port.y + (dy / len) * offsetMm,
  };
}

type PadFrontFrame = {
  center: PointMm;
  /** Unit plan vector toward the pad face that exits to the yard/pool. */
  front: PointMm;
  /** Unit plan vector along that face. */
  along: PointMm;
  halfFront: number;
  halfAlong: number;
};

function unitOr(
  x: number,
  y: number,
  fallback: PointMm,
): PointMm {
  const len = Math.hypot(x, y);
  if (len < 1e-6) return fallback;
  return { x: x / len, y: y / len };
}

/** Prefer the pad face that points toward the nearest pool/spa. */
function nearestWaterDir(design: DesignDocument, from: PointMm): PointMm {
  let best: PointMm | null = null;
  let bestD = Infinity;
  for (const body of design.poolBodies ?? []) {
    if (!body.outline?.length) continue;
    const b = outlineBounds(body.outline);
    const target = { x: b.cx, y: b.cy };
    const d = dist(from, target);
    if (d < bestD) {
      bestD = d;
      best = { x: target.x - from.x, y: target.y - from.y };
    }
  }
  if (!best) return { x: -1, y: 0 };
  return unitOr(best.x, best.y, { x: -1, y: 0 });
}

function buildingBoxes(design: DesignDocument): Bounds[] {
  return (design.buildings ?? [])
    .filter((b) => (b.outline?.length ?? 0) >= 3)
    .map((b) => expandBounds(boundsFromOutline(b.outline), CLEARANCE_MM));
}

/** Score a pad face: prefer toward water, never exit into a house. */
function scorePadFrontFace(
  design: DesignDocument,
  frame: PadFrontFrame,
  toward: PointMm,
): number {
  const alignment = frame.front.x * toward.x + frame.front.y * toward.y;
  const edgeMid = {
    x: frame.center.x + frame.front.x * frame.halfFront,
    y: frame.center.y + frame.front.y * frame.halfFront,
  };
  const stub = {
    x: edgeMid.x + frame.front.x * STUB_OFFSET_MM,
    y: edgeMid.y + frame.front.y * STUB_OFFSET_MM,
  };
  for (const box of buildingBoxes(design)) {
    if (pointInBounds(stub, box) || pointInBounds(edgeMid, box)) {
      return -Infinity;
    }
  }
  return alignment;
}

/**
 * Oriented pad footprint: equip_pad slab when present, else equipment cluster.
 * Front edge faces the nearest water body so risers exit toward the yard,
 * without dumping stubs into a house.
 */
function resolvePadFrontFrame(design: DesignDocument): PadFrontFrame | null {
  const pad = (design.objects ?? []).find(
    (o) => o.catalogItemId === "equip_pad",
  );
  const chain = padFlowEquipment(design);
  if (!pad && !chain.length) return null;

  const pickBest = (candidates: PadFrontFrame[], toward: PointMm) => {
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const c of candidates) {
      const score = scorePadFrontFace(design, c, toward);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    // If every face hits a house, fall back to best alignment alone.
    if (bestScore === -Infinity) {
      for (const c of candidates) {
        const alignment = c.front.x * toward.x + c.front.y * toward.y;
        if (alignment > bestScore) {
          bestScore = alignment;
          best = c;
        }
      }
    }
    return best;
  };

  if (pad) {
    const halfW = Math.max(200, (pad.widthMm ?? 8 * FT) / 2);
    const halfD = Math.max(200, (pad.depthMm ?? 4 * FT) / 2);
    const rad = ((pad.rotationDeg ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Match equipmentLocalToPlan: local +X / +Z → plan.
    const localX = { x: -cos, y: sin };
    const localZ = { x: -sin, y: -cos };
    const toward = nearestWaterDir(design, pad.position);
    const candidates: PadFrontFrame[] = [
      {
        center: pad.position,
        front: localX,
        along: localZ,
        halfFront: halfW,
        halfAlong: halfD,
      },
      {
        center: pad.position,
        front: { x: -localX.x, y: -localX.y },
        along: localZ,
        halfFront: halfW,
        halfAlong: halfD,
      },
      {
        center: pad.position,
        front: localZ,
        along: localX,
        halfFront: halfD,
        halfAlong: halfW,
      },
      {
        center: pad.position,
        front: { x: -localZ.x, y: -localZ.y },
        along: localX,
        halfFront: halfD,
        halfAlong: halfW,
      },
    ];
    return pickBest(candidates, toward);
  }

  // No slab — AABB of flow equipment, front toward water.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of chain) {
    const hw = Math.max(100, (o.widthMm ?? 600) / 2);
    const hd = Math.max(100, (o.depthMm ?? 400) / 2);
    minX = Math.min(minX, o.position.x - hw);
    maxX = Math.max(maxX, o.position.x + hw);
    minY = Math.min(minY, o.position.y - hd);
    maxY = Math.max(maxY, o.position.y + hd);
  }
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const halfW = Math.max(200, (maxX - minX) / 2);
  const halfD = Math.max(200, (maxY - minY) / 2);
  const toward = nearestWaterDir(design, center);
  const axisX = { x: 1, y: 0 };
  const axisY = { x: 0, y: 1 };
  const candidates: PadFrontFrame[] = [
    { center, front: axisX, along: axisY, halfFront: halfW, halfAlong: halfD },
    {
      center,
      front: { x: -1, y: 0 },
      along: axisY,
      halfFront: halfW,
      halfAlong: halfD,
    },
    { center, front: axisY, along: axisX, halfFront: halfD, halfAlong: halfW },
    {
      center,
      front: { x: 0, y: -1 },
      along: axisX,
      halfFront: halfD,
      halfAlong: halfW,
    },
  ];
  return pickBest(candidates, toward);
}

/** Suction / return exits along the pad front face, then a stub just outside. */
function padFrontExits(frame: PadFrontFrame): {
  suctionEdge: PointMm;
  returnEdge: PointMm;
  suctionStub: PointMm;
  returnStub: PointMm;
} {
  const edgeMid = {
    x: frame.center.x + frame.front.x * frame.halfFront,
    y: frame.center.y + frame.front.y * frame.halfFront,
  };
  const spacing = Math.min(frame.halfAlong * 0.55, 20 * IN);
  const suctionEdge = {
    x: edgeMid.x - frame.along.x * spacing,
    y: edgeMid.y - frame.along.y * spacing,
  };
  const returnEdge = {
    x: edgeMid.x + frame.along.x * spacing,
    y: edgeMid.y + frame.along.y * spacing,
  };
  return {
    suctionEdge,
    returnEdge,
    suctionStub: {
      x: suctionEdge.x + frame.front.x * STUB_OFFSET_MM,
      y: suctionEdge.y + frame.front.y * STUB_OFFSET_MM,
    },
    returnStub: {
      x: returnEdge.x + frame.front.x * STUB_OFFSET_MM,
      y: returnEdge.y + frame.front.y * STUB_OFFSET_MM,
    },
  };
}

/**
 * Port → across pad to front edge (above grade) → drop outside into the trench.
 * Or the reverse for suction coming up from the ground.
 */
function padFrontRiserPath(opts: {
  port: PointMm;
  portElev: number;
  frontEdge: PointMm;
  stubOutside: PointMm;
  /** true: equipment → front → ground; false: ground → front → equipment */
  toGround: boolean;
}): { points: PointMm[]; elevationsMm: number[] } {
  const chase = Math.min(
    Math.max(60, opts.portElev - 15),
    Math.max(PAD_CHASE_ELEV_MM, 80),
  );
  const surface = simpleOrtho(opts.port, opts.frontEdge);
  const points: PointMm[] = [];
  const elevationsMm: number[] = [];

  const push = (p: PointMm, e: number) => {
    points.push(p);
    elevationsMm.push(e);
  };

  if (opts.toGround) {
    // Port → chase → front edge on pad → outside overhang → drop
    push(opts.port, opts.portElev);
    if (Math.abs(opts.portElev - chase) > 1) push(opts.port, chase);
    for (const p of surface.slice(1)) push(p, chase);
    if (dist(points[points.length - 1]!, opts.frontEdge) > 1) {
      push(opts.frontEdge, chase);
    }
    if (dist(opts.frontEdge, opts.stubOutside) > 1) {
      push(opts.stubOutside, chase);
    }
    push(opts.stubOutside, TRENCH_ELEV_MM);
  } else {
    // Rise at front, run across pad, up into port
    push(opts.stubOutside, TRENCH_ELEV_MM);
    push(opts.stubOutside, chase);
    if (dist(opts.stubOutside, opts.frontEdge) > 1) {
      push(opts.frontEdge, chase);
    }
    for (const p of [...surface].reverse()) {
      if (dist(points[points.length - 1]!, p) > 1) push(p, chase);
    }
    if (dist(points[points.length - 1]!, opts.port) > 1) {
      push(opts.port, chase);
    }
    if (Math.abs(opts.portElev - chase) > 1) push(opts.port, opts.portElev);
  }

  return zipElevations(points, elevationsMm);
}

function simpleOrtho(a: PointMm, b: PointMm): PointMm[] {
  if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) {
    return dedupePoints([a, b]);
  }
  return dedupePoints([a, { x: b.x, y: a.y }, b]);
}

function zipElevations(
  points: PointMm[],
  elevationsMm: number[],
): { points: PointMm[]; elevationsMm: number[] } {
  const pts: PointMm[] = [];
  const elevs: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const e = elevationsMm[i] ?? TRENCH_ELEV_MM;
    const last = pts[pts.length - 1];
    if (
      last &&
      dist(last, p) < 1 &&
      Math.abs((elevs[elevs.length - 1] ?? 0) - e) < 1
    ) {
      continue;
    }
    pts.push(p);
    elevs.push(e);
  }
  return { points: pts, elevationsMm: elevs };
}

/**
 * Vertical risers + buried ortho between a ground stub and an equipment port.
 * Elevations: port/stub height → trench → trench → port/stub height.
 */
function padBuriedPipePath(
  from: PointMm,
  fromElev: number,
  to: PointMm,
  toElev: number,
): { points: PointMm[]; elevationsMm: number[] } {
  const buried = simpleOrtho(from, to);
  const points: PointMm[] = [];
  const elevationsMm: number[] = [];
  points.push(from);
  elevationsMm.push(fromElev);
  if (Math.abs(fromElev - TRENCH_ELEV_MM) > 1) {
    points.push(from);
    elevationsMm.push(TRENCH_ELEV_MM);
  }
  for (const p of buried.slice(1)) {
    points.push(p);
    elevationsMm.push(TRENCH_ELEV_MM);
  }
  const last = points[points.length - 1];
  if (!last || dist(last, to) > 1) {
    points.push(to);
    elevationsMm.push(TRENCH_ELEV_MM);
  }
  if (Math.abs(toElev - TRENCH_ELEV_MM) > 1) {
    points.push(to);
    elevationsMm.push(toElev);
  }
  return zipElevations(points, elevationsMm);
}

/**
 * Above-grade hop between two pad ports (pump→filter→heater→salt).
 * Stays near equipment height so unions read on the pad, not buried.
 */
function padSurfaceHopPath(
  from: PointMm,
  fromElev: number,
  to: PointMm,
  toElev: number,
): { points: PointMm[]; elevationsMm: number[] } {
  // Chase just below the lower port so pipes hug the equipment, not the trench.
  const hopElev = Math.max(60, Math.min(fromElev, toElev) - 20);
  const ortho = simpleOrtho(from, to);
  const points: PointMm[] = [];
  const elevationsMm: number[] = [];
  points.push(from);
  elevationsMm.push(fromElev);
  if (Math.abs(fromElev - hopElev) > 1) {
    points.push(from);
    elevationsMm.push(hopElev);
  }
  for (const p of ortho.slice(1)) {
    points.push(p);
    elevationsMm.push(hopElev);
  }
  const last = points[points.length - 1];
  if (!last || dist(last, to) > 1) {
    points.push(to);
    elevationsMm.push(hopElev);
  }
  if (Math.abs(toElev - hopElev) > 1) {
    points.push(to);
    elevationsMm.push(toElev);
  }
  return zipElevations(points, elevationsMm);
}

function makePadRun(opts: {
  name: string;
  circuit: PlumbingRun["circuit"];
  points: PointMm[];
  elevationsMm: number[];
  pipeDiameterMm: number;
  equipmentObjectId: string;
}): PlumbingRun {
  return {
    id: newId("run"),
    name: opts.name,
    circuit: opts.circuit,
    points: opts.points,
    elevationsMm: opts.elevationsMm,
    pipeDiameterMm: opts.pipeDiameterMm,
    equipmentObjectId: opts.equipmentObjectId,
    padLocal: true,
  };
}

/**
 * Build pad-local manifold: ground stubs + risers into each piece in
 * pump → filter → heater → salt order, independent of placement layout.
 */
export function buildPadManifoldRuns(design: DesignDocument): PlumbingRun[] {
  const chain = padFlowEquipment(design);
  if (!chain.length) return [];

  const equipId =
    chain[0].id ||
    (design.objects ?? []).find((o) => o.catalogItemId === "equip_pad")?.id ||
    chain[0].id;
  const pairs = chain.map(equipmentPortPair);
  const runs: PlumbingRun[] = [];
  const frame = resolvePadFrontFrame(design);
  const exits = frame
    ? padFrontExits(frame)
    : null;

  // Suction: trench at pad front → across pad → pump suction port
  const first = pairs[0];
  const suctionPort =
    pairs.length === 1
      ? first.ports[0]
      : pickFacingPort(first, pairs[1].obj.position).far;
  const suctionStub = exits
    ? exits.suctionStub
    : groundStubNear(suctionPort, first.obj.position);
  const suctionEdge = exits?.suctionEdge ?? suctionStub;
  {
    const path = exits
      ? padFrontRiserPath({
          port: suctionPort,
          portElev: first.elevMm,
          frontEdge: suctionEdge,
          stubOutside: suctionStub,
          toGround: false,
        })
      : padBuriedPipePath(
          suctionStub,
          TRENCH_ELEV_MM,
          suctionPort,
          first.elevMm,
        );
    runs.push(
      makePadRun({
        name: "Pad suction riser → pump",
        circuit: "suction",
        points: path.points,
        elevationsMm: path.elevationsMm,
        pipeDiameterMm: PIPE_SUCTION_MM,
        equipmentObjectId: equipId,
      }),
    );
  }

  // Pressure chain: each unit discharge → next inlet
  for (let i = 0; i < pairs.length - 1; i++) {
    const a = pairs[i];
    const b = pairs[i + 1];
    const fromPort = pickFacingPort(a, b.obj.position).near;
    const toPort = pickFacingPort(b, a.obj.position).near;
    const path = padSurfaceHopPath(fromPort, a.elevMm, toPort, b.elevMm);
    const fromName = a.obj.name || a.obj.catalogItemId;
    const toName = b.obj.name || b.obj.catalogItemId;
    runs.push(
      makePadRun({
        name: `Pad ${fromName} → ${toName}`,
        circuit: "return",
        points: path.points,
        elevationsMm: path.elevationsMm,
        pipeDiameterMm: PIPE_RETURN_MM,
        equipmentObjectId: equipId,
      }),
    );
  }

  // Return: last discharge → across pad front → drop into trench
  const last = pairs[pairs.length - 1];
  const returnPort =
    pairs.length === 1
      ? last.ports[1]
      : pickFacingPort(last, pairs[pairs.length - 2].obj.position).far;
  const returnStub = exits
    ? exits.returnStub
    : groundStubNear(returnPort, last.obj.position);
  const returnEdge = exits?.returnEdge ?? returnStub;
  {
    const path = exits
      ? padFrontRiserPath({
          port: returnPort,
          portElev: last.elevMm,
          frontEdge: returnEdge,
          stubOutside: returnStub,
          toGround: true,
        })
      : padBuriedPipePath(
          returnPort,
          last.elevMm,
          returnStub,
          TRENCH_ELEV_MM,
        );
    runs.push(
      makePadRun({
        name: "Pad return riser → trench",
        circuit: "return",
        points: path.points,
        elevationsMm: path.elevationsMm,
        pipeDiameterMm: PIPE_RETURN_MM,
        equipmentObjectId: equipId,
      }),
    );
  }

  return runs;
}

/** Ground stubs where body trenches meet the pad manifold. */
export function padManifoldStubs(design: DesignDocument): {
  suctionStub: PointMm;
  returnStub: PointMm;
  equipmentObjectId: string;
  label: string;
} | null {
  const chain = padFlowEquipment(design);
  const pad = (design.objects ?? []).find(
    (o) => o.catalogItemId === "equip_pad",
  );
  if (!chain.length && !pad) return null;

  const frame = resolvePadFrontFrame(design);
  if (frame) {
    const exits = padFrontExits(frame);
    const label =
      chain.length > 1
        ? "Equipment pad"
        : chain[0]?.name || pad?.name || "Equipment";
    return {
      suctionStub: exits.suctionStub,
      returnStub: exits.returnStub,
      equipmentObjectId: (chain[0] ?? pad)!.id,
      label,
    };
  }

  if (!chain.length && pad) {
    return {
      suctionStub: pad.position,
      returnStub: {
        x: pad.position.x + 12 * IN,
        y: pad.position.y,
      },
      equipmentObjectId: pad.id,
      label: pad.name || "Equipment pad",
    };
  }

  const pairs = chain.map(equipmentPortPair);
  const first = pairs[0];
  const last = pairs[pairs.length - 1];
  const suctionPort =
    pairs.length === 1
      ? first.ports[0]
      : pickFacingPort(first, pairs[1].obj.position).far;
  const returnPort =
    pairs.length === 1
      ? last.ports[1]
      : pickFacingPort(last, pairs[pairs.length - 2].obj.position).far;

  const label =
    chain.length > 1
      ? "Equipment pad"
      : chain[0].name || "Equipment";

  return {
    suctionStub: groundStubNear(suctionPort, first.obj.position),
    returnStub: groundStubNear(returnPort, last.obj.position),
    equipmentObjectId: (chain[0] ?? pad)!.id,
    label,
  };
}

/** Strip and rebuild pad-local manifold runs. */
export function ensurePadManifoldPlumbing(
  design: DesignDocument,
): DesignDocument {
  const kept = design.plumbingRuns.filter((r) => !r.padLocal);
  const padRuns = buildPadManifoldRuns(design);
  if (!padRuns.length && kept.length === design.plumbingRuns.length) {
    return design;
  }
  return { ...design, plumbingRuns: [...kept, ...padRuns] };
}

/**
 * If any auto body trench currently crosses a house/patio, rebuild those runs.
 * Manual runs (no parentBodyId) are left alone. Refreshes the pad manifold only
 * when flow equipment exists but pad-local runs are missing/empty.
 */
export function repairAutoPlumbingIfNeeded(
  design: DesignDocument,
): DesignDocument {
  const obstacles = obstaclesFromDesign(design);
  const blocked = obstacles.map((o) =>
    expandBounds(outlineBounds(o.outline), CLEARANCE_MM),
  );
  const clipped = design.plumbingRuns.some(
    (r) =>
      !!r.parentBodyId &&
      !r.padLocal &&
      r.points.length >= 2 &&
      pathHits(r.points, blocked) > 0,
  );
  if (clipped) return syncAllBodiesPlumbing(design);

  const hasFlowEquip = padFlowEquipment(design).length > 0;
  const hasPadLocal = design.plumbingRuns.some((r) => r.padLocal);
  if (hasFlowEquip && !hasPadLocal) {
    return ensurePadManifoldPlumbing(design);
  }
  return design;
}

/** Resolve pad equipment into suction/return connection points. */
export function resolveEquipmentConnection(
  design: DesignDocument,
  near?: PointMm,
): EquipmentConnection | null {
  const stubs = padManifoldStubs(design);
  if (stubs) {
    return {
      suctionTarget: stubs.suctionStub,
      returnOrigin: stubs.returnStub,
      equipmentObjectId: stubs.equipmentObjectId,
      label: stubs.label,
    };
  }

  const equip = (design.objects ?? []).filter(isPadEquipment);
  if (!equip.length) return null;

  const anchor = nearestObject(equip, near ?? { x: 0, y: 0 });
  if (!anchor) return null;

  return {
    suctionTarget: anchor.position,
    returnOrigin: anchor.position,
    equipmentObjectId: anchor.id,
    label: anchor.name || "Equipment",
  };
}

function nearestObject(objs: PlacedObject[], near: PointMm): PlacedObject | null {
  if (!objs.length) return null;
  let best = objs[0];
  let bestD = dist(best.position, near);
  for (const o of objs.slice(1)) {
    const d = dist(o.position, near);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

/** Closest point on the AABB of an outline to a target (shell exit). */
export function nearestEdgePoint(outline: PointMm[], target: PointMm): PointMm {
  const b = outlineBounds(outline);
  const clamps = {
    x: Math.min(b.maxX, Math.max(b.minX, target.x)),
    y: Math.min(b.maxY, Math.max(b.minY, target.y)),
  };
  const toLeft = Math.abs(clamps.x - b.minX);
  const toRight = Math.abs(b.maxX - clamps.x);
  const toBottom = Math.abs(clamps.y - b.minY);
  const toTop = Math.abs(b.maxY - clamps.y);
  const m = Math.min(toLeft, toRight, toBottom, toTop);
  if (m === toLeft) return { x: b.minX, y: clamps.y };
  if (m === toRight) return { x: b.maxX, y: clamps.y };
  if (m === toBottom) return { x: clamps.x, y: b.minY };
  return { x: clamps.x, y: b.maxY };
}

/** Pick shell exit whose trench to target best avoids houses/patios. */
function bestShellExit(
  outline: PointMm[],
  target: PointMm,
  obstacles: RouteObstacle[],
): PointMm {
  const b = outlineBounds(outline);
  const candidates: PointMm[] = [
    { x: b.minX, y: b.cy },
    { x: b.maxX, y: b.cy },
    { x: b.cx, y: b.minY },
    { x: b.cx, y: b.maxY },
    nearestEdgePoint(outline, target),
  ];
  const blockedBoxes = obstacles.map((o) =>
    expandBounds(outlineBounds(o.outline), CLEARANCE_MM),
  );

  let best = candidates[0];
  let bestScore = Infinity;
  for (const exit of candidates) {
    const path = routeOrthoAvoiding(exit, target, obstacles);
    const score = scorePath(path, blockedBoxes);
    if (score < bestScore) {
      bestScore = score;
      best = exit;
    }
  }
  return best;
}

function bodyCenter(outline: PointMm[]): PointMm {
  const b = outlineBounds(outline);
  return { x: b.cx, y: b.cy };
}

export type BodyPlumbingOptions = {
  body: PoolBody;
  connection: EquipmentConnection;
  /** Spa: optional drain / return branch points inside the shell */
  suctionStart?: PointMm;
  returnEnds?: PointMm[];
  featureEnds?: PointMm[];
  /** Houses and patio deck slabs to route around (auto-routes never cross). */
  obstacles?: RouteObstacle[];
};

/**
 * Build editable trench runs from a water body to placed equipment.
 * Auto-routes around houses and patio decks; designers can still draw under them.
 */
export function buildBodyPlumbingRuns(
  opts: BodyPlumbingOptions,
): PlumbingRun[] {
  const { body, connection } = opts;
  const obstacles = opts.obstacles ?? [];
  const center = bodyCenter(body.outline);
  const suctionStart = opts.suctionStart ?? center;
  const exitSuction = bestShellExit(
    body.outline,
    connection.suctionTarget,
    obstacles,
  );
  const exitReturnBase = bestShellExit(
    body.outline,
    connection.returnOrigin,
    obstacles,
  );

  const stagger = 18 * IN;
  const exitReturn = {
    x:
      exitReturnBase.x +
      (Math.abs(exitReturnBase.x - center.x) >
      Math.abs(exitReturnBase.y - center.y)
        ? 0
        : stagger),
    y:
      exitReturnBase.y +
      (Math.abs(exitReturnBase.x - center.x) >
      Math.abs(exitReturnBase.y - center.y)
        ? stagger
        : 0),
  };

  // Inside-shell legs stay short; trench from shell → pad avoids obstacles.
  const suctionPath = dedupePoints([
    suctionStart,
    exitSuction,
    ...routeOrthoAvoiding(exitSuction, connection.suctionTarget, obstacles).slice(
      1,
    ),
  ]);

  const returnTrunk = routeOrthoAvoiding(
    connection.returnOrigin,
    exitReturn,
    obstacles,
  );
  // Parallel offset of the trench segment only (keep equipment endpoint)
  let returnMain = offsetPolyline(returnTrunk, PARALLEL_OFFSET_MM);
  returnMain[0] = connection.returnOrigin;
  // Re-validate offset path; if it clips a blocked obstacle, fall back to unoffset trunk
  const blockedBoxes = obstacles.map((o) =>
    expandBounds(outlineBounds(o.outline), CLEARANCE_MM),
  );
  if (pathHits(returnMain, blockedBoxes) > 0) {
    returnMain = returnTrunk;
  }

  const returnEnds = opts.returnEnds?.length ? opts.returnEnds : [center];
  const returnPath = dedupePoints([...returnMain, exitReturn, ...returnEnds]);

  const runs: PlumbingRun[] = [
    {
      id: newId("run"),
      name: `${body.name} suction → ${connection.label}`,
      circuit: "suction",
      points: suctionPath,
      pipeDiameterMm: PIPE_SUCTION_MM,
      parentBodyId: body.id,
      equipmentObjectId: connection.equipmentObjectId || undefined,
    },
    {
      id: newId("run"),
      name: `${body.name} return ← ${connection.label}`,
      circuit: "return",
      points: returnPath,
      pipeDiameterMm: PIPE_RETURN_MM,
      parentBodyId: body.id,
      equipmentObjectId: connection.equipmentObjectId || undefined,
    },
  ];

  if (opts.featureEnds?.length) {
    const featTrunk = routeOrthoAvoiding(
      connection.returnOrigin,
      exitReturn,
      obstacles,
    );
    const featPath = dedupePoints([
      ...featTrunk,
      exitReturn,
      ...opts.featureEnds,
    ]);
    runs.push({
      id: newId("run"),
      name: `${body.name} features ← ${connection.label}`,
      circuit: "other",
      points: featPath,
      pipeDiameterMm: PIPE_FEATURE_MM,
      parentBodyId: body.id,
      equipmentObjectId: connection.equipmentObjectId || undefined,
    });
  }

  if (waterBodyKind(body) === "spa") {
    runs[0] = {
      ...runs[0],
      name: `${body.name} suction → pump (check valve at pad)`,
    };
  }

  return runs;
}

function dedupePoints(points: PointMm[]): PointMm[] {
  const out: PointMm[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > 1) out.push(p);
  }
  return out;
}

/** True if this body already has equipment-linked suction/return. */
export function bodyHasEquipmentPlumbing(
  design: DesignDocument,
  bodyId: string,
): boolean {
  return design.plumbingRuns.some(
    (r) =>
      r.parentBodyId === bodyId &&
      !!r.equipmentObjectId &&
      (r.circuit === "suction" || r.circuit === "return"),
  );
}

/**
 * Auto-connect every water body that lacks equipment plumbing
 * to the nearest / primary pad equipment.
 */
export function connectBodiesToEquipment(
  design: DesignDocument,
): DesignDocument {
  const connection = resolveEquipmentConnection(design);
  if (!connection) return design;

  const obstacles = obstaclesFromDesign(design);
  const newRuns: PlumbingRun[] = [];
  for (const body of design.poolBodies) {
    if (bodyHasEquipmentPlumbing(design, body.id)) continue;
    const center = bodyCenter(body.outline);
    const local = resolveEquipmentConnection(design, center) ?? connection;
    const isSpa = waterBodyKind(body) === "spa";
    const inner = outlineBounds(body.outline);
    const suctionStart = isSpa
      ? { x: inner.cx, y: inner.cy }
      : nearestEdgePoint(body.outline, local.suctionTarget);

    newRuns.push(
      ...buildBodyPlumbingRuns({
        body,
        connection: local,
        suctionStart,
        returnEnds: [{ x: inner.cx, y: inner.cy }],
        obstacles,
      }),
    );
  }

  if (!newRuns.length) return ensurePadManifoldPlumbing(design);
  return ensurePadManifoldPlumbing({
    ...design,
    plumbingRuns: [...design.plumbingRuns, ...newRuns],
  });
}

/** Fallback stub pad point when no equipment has been placed yet. */
export function virtualEquipmentPoint(outline: PointMm[]): PointMm {
  const b = outlineBounds(outline);
  return { x: b.maxX + 3 * FT, y: b.cy };
}

/** Fixtures that need water plumbing (not lights / electrical). */
export type FixturePlumbingKind = "feature" | "return" | "suction";

export function fixturePlumbingKind(
  catalogItemId: string,
): FixturePlumbingKind | null {
  if (
    catalogItemId === "spa_bubbler" ||
    catalogItemId === "pool_bubbler"
  ) {
    return "feature";
  }
  if (catalogItemId === "spa_jet") return "return";
  if (catalogItemId === "spa_drain") return "suction";
  return null;
}

export function isPlumbingFixtureId(id: string): boolean {
  return fixturePlumbingKind(id) != null;
}

function connectionOrVirtual(
  design: DesignDocument,
  body: PoolBody,
  near: PointMm,
): EquipmentConnection {
  return (
    resolveEquipmentConnection(design, near) ?? {
      suctionTarget: virtualEquipmentPoint(body.outline),
      returnOrigin: virtualEquipmentPoint(body.outline),
      equipmentObjectId: "",
      label: "equipment pad (suggested)",
    }
  );
}

/**
 * Rebuild auto plumbing for one water body from its current fixtures + pad.
 * Strips prior `parentBodyId` runs for that body (manual runs without a parent
 * are kept). Use after place / move / delete of bubblers, jets, drains, or pad.
 */
export function rebuildBodyPlumbing(
  design: DesignDocument,
  bodyId: string,
): DesignDocument {
  const body = design.poolBodies.find((b) => b.id === bodyId);
  if (!body) return design;

  const fixtures = (design.objects ?? []).filter(
    (o) =>
      o.parentBodyId === bodyId && isPlumbingFixtureId(o.catalogItemId),
  );
  const featureEnds = fixtures
    .filter((o) => fixturePlumbingKind(o.catalogItemId) === "feature")
    .map((o) => o.position);
  const returnEnds = fixtures
    .filter((o) => fixturePlumbingKind(o.catalogItemId) === "return")
    .map((o) => o.position);
  const drain = fixtures.find(
    (o) => fixturePlumbingKind(o.catalogItemId) === "suction",
  );

  // Drop auto body runs; keep manual runs (no parentBodyId).
  const plumbingRuns = design.plumbingRuns.filter(
    (r) => r.parentBodyId !== bodyId,
  );

  const hasPad = !!resolveEquipmentConnection(design);
  if (!hasPad && fixtures.length === 0) {
    return ensurePadManifoldPlumbing({ ...design, plumbingRuns });
  }

  const obstacles = obstaclesFromDesign(design);
  const center = bodyCenter(body.outline);
  const connection = connectionOrVirtual(design, body, center);
  const isSpa = waterBodyKind(body) === "spa";
  const inner = outlineBounds(body.outline);
  const suctionStart =
    drain?.position ??
    (isSpa
      ? { x: inner.cx, y: inner.cy }
      : nearestEdgePoint(body.outline, connection.suctionTarget));
  const returns =
    returnEnds.length > 0 ? returnEnds : [{ x: inner.cx, y: inner.cy }];

  const newRuns = buildBodyPlumbingRuns({
    body,
    connection,
    suctionStart,
    returnEnds: returns,
    featureEnds: featureEnds.length ? featureEnds : undefined,
    obstacles,
  }).map((r) =>
    connection.equipmentObjectId
      ? r
      : { ...r, equipmentObjectId: undefined },
  );

  return ensurePadManifoldPlumbing({
    ...design,
    plumbingRuns: [...plumbingRuns, ...newRuns],
  });
}

/** Rebuild auto plumbing for every water body (e.g. after pad move/delete). */
export function syncAllBodiesPlumbing(design: DesignDocument): DesignDocument {
  let next = design;
  for (const body of design.poolBodies) {
    next = rebuildBodyPlumbing(next, body.id);
  }
  // Always refresh pad manifold (covers zero-body pads and hop rebuilds).
  return ensurePadManifoldPlumbing(next);
}

/**
 * After placing a bubbler / jet / drain, rebuild that body's plumbing so
 * endpoints match current fixture positions.
 */
export function attachFixturePlumbing(
  design: DesignDocument,
  opts: {
    bodyId: string;
    position: PointMm;
    catalogItemId: string;
  },
): DesignDocument {
  if (!fixturePlumbingKind(opts.catalogItemId)) return design;
  return rebuildBodyPlumbing(design, opts.bodyId);
}

/**
 * After moving a placed object, keep plumbing consistent.
 * - Plumbing fixtures → rebuild their parent body
 * - Pad equipment → rebuild all bodies
 */
export function syncPlumbingAfterObjectChange(
  design: DesignDocument,
  objectId: string,
): DesignDocument {
  const obj = (design.objects ?? []).find((o) => o.id === objectId);
  if (!obj) return design;
  if (isPadEquipmentId(obj.catalogItemId)) {
    return syncAllBodiesPlumbing(design);
  }
  if (isPlumbingFixtureId(obj.catalogItemId) && obj.parentBodyId) {
    return rebuildBodyPlumbing(design, obj.parentBodyId);
  }
  return design;
}

/**
 * After deleting an object: pass the removed snapshot so we know whether it
 * was pad gear or a body fixture.
 */
export function syncPlumbingAfterObjectRemoved(
  design: DesignDocument,
  removed: PlacedObject,
): DesignDocument {
  if (isPadEquipmentId(removed.catalogItemId)) {
    return syncAllBodiesPlumbing(design);
  }
  if (isPlumbingFixtureId(removed.catalogItemId) && removed.parentBodyId) {
    return rebuildBodyPlumbing(design, removed.parentBodyId);
  }
  return design;
}
