import {
  DEFAULT_PATIO_ROOF_HEIGHT_MM,
  DEFAULT_PERGOLA_HEIGHT_MM,
  DEFAULT_POOL_WALL_THICKNESS_MM,
  DEFAULT_SPA_SHELL_HEIGHT_MM,
  DEFAULT_SUNSHELF_DEPTH_MM,
  type BuildingOpeningKind,
  type DesignDocument,
  type PointMm,
  type PoolBody,
  normalizeNorthDeg,
} from "./design-model";
import { flattenClosedOutline, outlineHasArcs } from "./outline-arcs";
import { getPlaceableItem, isWaterFixtureId } from "./object-library";
import { isPadEquipmentId } from "./plumbing-route";
import {
  outlineBounds,
  rectangleFrame,
  spaWallThicknessMm,
} from "./spa-defaults";

/** Standard residential clear ceiling height (8′). */
export const DEFAULT_CEILING_HEIGHT_MM = 2438.4;
/**
 * Floor/ceiling structure between stories (~10″ joists + subfloor).
 * Sits between clear ceiling heights so each story keeps its full clear height.
 */
export const FLOOR_STRUCTURE_THICKNESS_MM = 254;
/**
 * @deprecated Prefer `DEFAULT_CEILING_HEIGHT_MM` + `FLOOR_STRUCTURE_THICKNESS_MM`.
 * Kept as the default clear ceiling height for older callers/tests.
 */
export const STORY_HEIGHT_MM = DEFAULT_CEILING_HEIGHT_MM;
/** Thin patio / deck slab */
export const PATIO_SLAB_THICKNESS_MM = 100;
/** Pool shell lip thickness above grade */
export const POOL_LIP_THICKNESS_MM = 150;
/** Default structural pool wall thickness for hollow 3D shell */
export const POOL_WALL_THICKNESS_MM = DEFAULT_POOL_WALL_THICKNESS_MM;
/** Cover roof slab thickness */
export const COVER_SLAB_THICKNESS_MM = 150;

export function mmToMeters(mm: number): number {
  return mm / 1000;
}

export function metersToMm(m: number): number {
  return m * 1000;
}

/**
 * Plan point → Three.js XZ (Y-up world).
 * CAD plan matches screen (X right, Y down). Mirror X so left/right matches the
 * 2D canvas when viewed in orbit (otherwise the yard appears flipped).
 * Map: planX → -x, planY → -z.
 */
export function planToWorldXZ(p: PointMm): { x: number; z: number } {
  return { x: mmToMeters(-p.x), z: mmToMeters(-p.y) };
}

/**
 * Direction toward a celestial body in Three.js Y-up world.
 *
 * `azimuthDeg` is compass degrees clockwise from true north (0=N, 90=E, 180=S, 270=W).
 * `elevationDeg` is degrees above the horizon.
 * `northDeg` is site north, clockwise from drawing-up (same as DesignDocument.northDeg).
 *
 * At northDeg = 0, drawing-up is +Z (north) and plan-right is −X (east).
 */
export function sunWorldDir(
  azimuthDeg: number,
  elevationDeg: number,
  northDeg = 0,
): { x: number; y: number; z: number } {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const cosEl = Math.cos(el);
  const east = Math.sin(az) * cosEl;
  const north = Math.cos(az) * cosEl;
  const up = Math.sin(el);
  // north-aligned frame: east → −X, north → +Z
  const x0 = -east;
  const z0 = north;
  const r = (-normalizeNorthDeg(northDeg) * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return {
    x: x0 * c + z0 * s,
    y: up,
    z: -x0 * s + z0 * c,
  };
}

export type DesignBoundsMm = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
};

/** Axis-aligned bounds of all design footprints (mm). Empty design → unit box. */
export function designBoundsMm(design: DesignDocument): DesignBoundsMm {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const include = (outline: PointMm[]) => {
    for (const p of outline) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  };

  for (const b of design.buildings ?? []) include(b.outline);
  for (const p of design.patios ?? []) include(p.outline);
  for (const c of design.patioCovers ?? []) include(c.outline);
  for (const p of design.poolBodies ?? []) include(p.outline);
  for (const f of design.features ?? []) include(f.outline);
  for (const o of design.objects ?? []) {
    const hw = o.widthMm / 2;
    const hd = o.depthMm / 2;
    include([
      { x: o.position.x - hw, y: o.position.y - hd },
      { x: o.position.x + hw, y: o.position.y + hd },
    ]);
  }
  for (const g of design.gradeSamples ?? []) {
    include([g.position]);
  }
  for (const f of design.fences ?? []) {
    include(f.points);
  }
  for (const line of design.siteLines ?? []) {
    include(line.points);
  }

  if (!Number.isFinite(minX)) {
    return {
      minX: 0,
      minY: 0,
      maxX: 10000,
      maxY: 10000,
      cx: 5000,
      cy: 5000,
      width: 10000,
      height: 10000,
    };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Clamp / default a building's clear ceiling height (mm).
 * Allows ~7′–16′ (common residential range).
 */
export function resolveCeilingHeightMm(ceilingHeightMm?: number): number {
  if (
    ceilingHeightMm != null &&
    Number.isFinite(ceilingHeightMm) &&
    ceilingHeightMm >= 2133.6 &&
    ceilingHeightMm <= 4876.8
  ) {
    return ceilingHeightMm;
  }
  return DEFAULT_CEILING_HEIGHT_MM;
}

/** Finished-floor elevation of a story above grade (mm). */
export function storyFloorElevationMm(
  story: number,
  buildingStories = 1,
  ceilingHeightMm?: number,
): number {
  const s = clampOpeningStory(story, buildingStories);
  if (s <= 1) return 0;
  const clear = resolveCeilingHeightMm(ceilingHeightMm);
  return (s - 1) * (clear + FLOOR_STRUCTURE_THICKNESS_MM);
}

/** Total exterior wall height from grade to underside of roof (mm). */
export function buildingHeightMm(
  stories: number,
  ceilingHeightMm?: number,
): number {
  const n = Math.max(1, stories || 1);
  const clear = resolveCeilingHeightMm(ceilingHeightMm);
  return n * clear + (n - 1) * FLOOR_STRUCTURE_THICKNESS_MM;
}

/** Typical window sill height above finished floor (~36″). */
export const WINDOW_SILL_ABOVE_FLOOR_MM = 914.4;

/** Clamp opening story to 1..buildingStories. */
export function clampOpeningStory(
  story: number | undefined,
  buildingStories: number,
): number {
  const max = Math.max(1, buildingStories || 1);
  const n = story == null || !Number.isFinite(story) ? 1 : Math.round(story);
  return Math.min(max, Math.max(1, n));
}

/** Default sill above finished floor for a given opening kind. */
export function defaultSillAboveFloorMm(kind: BuildingOpeningKind): number {
  return kind === "window" ? WINDOW_SILL_ABOVE_FLOOR_MM : 0;
}

/**
 * Resolved sill above the story finished floor (mm).
 * Uses authorable `sillAboveFloorMm` when set; otherwise kind default.
 */
export function openingSillAboveFloorMm(
  kind: BuildingOpeningKind,
  sillAboveFloorMm?: number,
): number {
  if (
    sillAboveFloorMm != null &&
    Number.isFinite(sillAboveFloorMm) &&
    sillAboveFloorMm >= 0
  ) {
    return sillAboveFloorMm;
  }
  return defaultSillAboveFloorMm(kind);
}

/**
 * Bottom of the opening above grade (mm).
 * Doors sit on the story floor; windows sit on a sill above that floor
 * (authorable via sillAboveFloorMm).
 */
export function openingSillMm(
  kind: BuildingOpeningKind,
  story: number | undefined,
  buildingStories = 1,
  sillAboveFloorMm?: number,
  ceilingHeightMm?: number,
): number {
  const floorMm = storyFloorElevationMm(
    story ?? 1,
    buildingStories,
    ceilingHeightMm,
  );
  return floorMm + openingSillAboveFloorMm(kind, sillAboveFloorMm);
}

export function poolAverageDepthMm(body: PoolBody): number {
  return (body.depthShallowMm + body.depthDeepMm) / 2;
}

export function coverHeightMm(kind: "pergola" | "roof", heightMm?: number): number {
  if (heightMm != null && heightMm > 0) return heightMm;
  return kind === "roof"
    ? DEFAULT_PATIO_ROOF_HEIGHT_MM
    : DEFAULT_PERGOLA_HEIGHT_MM;
}

/**
 * Default vertical size for placed catalog objects.
 * Prefers catalog `heightMm`, then category fallbacks.
 */
export function defaultObjectHeightMm(catalogItemId: string): number {
  const item = getPlaceableItem(catalogItemId);
  if (item?.heightMm && item.heightMm > 0) return item.heightMm;
  if (isWaterFixtureId(catalogItemId)) {
    if (catalogItemId.includes("light")) return 80;
    return 120;
  }
  if (catalogItemId === "equip_pad") return 150;
  if (isPadEquipmentId(catalogItemId)) return 800;
  switch (item?.category) {
    case "furniture":
      return 900;
    case "hardscape":
      return 450;
    case "amenity":
      return 1100;
    case "attraction":
      return 1500;
    case "equipment":
      return 800;
    default:
      return 900;
  }
}

/** Resolve height for a placed object (instance override → catalog → fallback). */
export function objectHeightMm(obj: {
  catalogItemId: string;
  heightMm?: number;
}): number {
  if (obj.heightMm != null && obj.heightMm > 0) return obj.heightMm;
  return defaultObjectHeightMm(obj.catalogItemId);
}

export function spaShellParams(body: PoolBody): {
  wallMm: number;
  shellHeightMm: number;
  insideOutline: PointMm[];
  waterDepthMm: number;
} {
  const wallMm = spaWallThicknessMm(body);
  return {
    wallMm,
    // Preserve explicit 0 (flush with deck); only default when unset.
    shellHeightMm: body.shellHeightMm ?? DEFAULT_SPA_SHELL_HEIGHT_MM,
    insideOutline: insetClosedOutline(body.outline, wallMm),
    waterDepthMm: body.depthShallowMm,
  };
}

export function featureDepthMm(
  kind: "steps" | "bench" | "sunshelf",
  depthMm?: number,
): number {
  if (kind === "sunshelf") return depthMm ?? DEFAULT_SUNSHELF_DEPTH_MM;
  if (kind === "bench") return depthMm ?? 450;
  return depthMm ?? 600;
}

/** Typical residential pool step riser (~12″). */
export const STANDARD_STEP_RISER_MM = 304.8;
/** Typical residential pool step tread depth (~12″). */
export const STANDARD_STEP_TREAD_MM = 304.8;
/** Minimum walkway width across the steps (~4′). */
export const DEFAULT_STEP_WIDTH_MM = 1219.2;

export function stepsRiserCount(riserCount?: number): number {
  if (riserCount == null || !Number.isFinite(riserCount)) return 3;
  return Math.min(12, Math.max(1, Math.round(riserCount)));
}

/** Total run (into the pool) for a step assembly. */
export function stepsRunMm(riserCount?: number): number {
  return stepsRiserCount(riserCount) * STANDARD_STEP_TREAD_MM;
}

/**
 * Size a steps footprint: across-width ≥ 4′, run = risers × tread.
 * Preserves center; aligns the longer drawn side as the walkway width.
 */
export function applyStepsStandardFootprint(
  outline: PointMm[],
  riserCount?: number,
): PointMm[] {
  const runMm = stepsRunMm(riserCount);
  const frame = rectangleFrame(outline);
  const b = outlineBounds(outline);
  const center = frame?.center ?? { x: b.cx, y: b.cy };
  const across = Math.max(
    DEFAULT_STEP_WIDTH_MM,
    frame ? Math.max(frame.widthMm, frame.lengthMm) : Math.max(b.width, b.height),
  );
  let u = frame?.axisWidth ?? { x: 1, y: 0 };
  let v = frame?.axisLength ?? { x: 0, y: 1 };
  if (frame && frame.lengthMm > frame.widthMm) {
    u = frame.axisLength;
    v = frame.axisWidth;
  }
  // Ensure CCW-ish: u × v > 0
  if (u.x * v.y - u.y * v.x < 0) {
    v = { x: -v.x, y: -v.y };
  }
  const hw = across / 2;
  const hl = runMm / 2;
  return [
    { x: center.x - u.x * hw - v.x * hl, y: center.y - u.y * hw - v.y * hl },
    { x: center.x + u.x * hw - v.x * hl, y: center.y + u.y * hw - v.y * hl },
    { x: center.x + u.x * hw + v.x * hl, y: center.y + u.y * hw + v.y * hl },
    { x: center.x - u.x * hw + v.x * hl, y: center.y - u.y * hw + v.y * hl },
  ];
}

/** One tread strip (0 = top/entry) along the steps run axis. */
export function stepsTreadOutline(
  outline: PointMm[],
  stepIndex: number,
  stepCount: number,
): PointMm[] {
  const n = Math.max(1, stepCount);
  const s = Math.min(n - 1, Math.max(0, stepIndex));
  const frame = rectangleFrame(outline);
  if (!frame) return outline;
  // After standard sizing, the shorter side is the run (into pool).
  const runIsWidth = frame.widthMm <= frame.lengthMm;
  const acrossMm = runIsWidth ? frame.lengthMm : frame.widthMm;
  const runMm = runIsWidth ? frame.widthMm : frame.lengthMm;
  const u = runIsWidth ? frame.axisLength : frame.axisWidth;
  const v = runIsWidth ? frame.axisWidth : frame.axisLength;
  const t0 = s / n;
  const t1 = (s + 1) / n;
  const along0 = -runMm / 2 + runMm * t0;
  const along1 = -runMm / 2 + runMm * t1;
  const hw = acrossMm / 2;
  const c = frame.center;
  return [
    { x: c.x + u.x * -hw + v.x * along0, y: c.y + u.y * -hw + v.y * along0 },
    { x: c.x + u.x * hw + v.x * along0, y: c.y + u.y * hw + v.y * along0 },
    { x: c.x + u.x * hw + v.x * along1, y: c.y + u.y * hw + v.y * along1 },
    { x: c.x + u.x * -hw + v.x * along1, y: c.y + u.y * -hw + v.y * along1 },
  ];
}

function openPlanRing(outline: PointMm[]): PointMm[] {
  if (outline.length < 3) return outline;
  const first = outline[0];
  const last = outline[outline.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) < 1) {
    return outline.slice(0, -1);
  }
  return outline;
}

/** Shoelace signed area in plan mm². Positive ⇒ CCW in coordinate space. */
export function planSignedAreaMm2(outline: PointMm[]): number {
  const pts = openPlanRing(outline);
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Unit outward normal for an edge (dx,dy) on a ring with the given signed area. */
export function edgeOutwardNormal(
  dx: number,
  dy: number,
  signedArea: number,
): PointMm {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // CCW (positive area): interior is to the left, outward is to the right.
  if (signedArea >= 0) return { x: uy, y: -ux };
  return { x: -uy, y: ux };
}

/**
 * Parallel offset of a closed plan outline (miter joins).
 * Positive `deltaMm` expands (eaves); negative insets (floor slabs).
 * Unlike a radial centroid expand, this keeps walls parallel — required for
 * L / U footprints so the roof does not web across a notch.
 */
export function offsetClosedOutline(
  outline: PointMm[],
  deltaMm: number,
): PointMm[] {
  const src = outlineHasArcs(outline) ? flattenClosedOutline(outline) : outline;
  const pts = openPlanRing(src);
  if (pts.length < 3 || !Number.isFinite(deltaMm) || Math.abs(deltaMm) < 1e-6) {
    return pts.map((p) => ({ x: p.x, y: p.y }));
  }
  const area = planSignedAreaMm2(pts);
  const miterLimit = 4;
  const out: PointMm[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const cur = pts[i];
    const next = pts[(i + 1) % pts.length];
    const n0 = edgeOutwardNormal(cur.x - prev.x, cur.y - prev.y, area);
    const n1 = edgeOutwardNormal(next.x - cur.x, next.y - cur.y, area);
    const sx = n0.x + n1.x;
    const sy = n0.y + n1.y;
    const slen = Math.hypot(sx, sy);
    if (slen < 1e-6) {
      out.push({ x: cur.x + n0.x * deltaMm, y: cur.y + n0.y * deltaMm });
      continue;
    }
    const ux = sx / slen;
    const uy = sy / slen;
    const cos = n0.x * ux + n0.y * uy;
    const mag =
      Math.abs(cos) < 0.15
        ? Math.sign(deltaMm) * Math.abs(deltaMm) * miterLimit
        : deltaMm / cos;
    const cap = miterLimit * Math.abs(deltaMm);
    const d = Math.max(-cap, Math.min(cap, mag));
    out.push({ x: cur.x + ux * d, y: cur.y + uy * d });
  }
  return out;
}

/** Inset a closed plan outline by wall thickness (arcs tessellated first). */
export function insetClosedOutline(
  outline: PointMm[],
  wallMm: number,
): PointMm[] {
  const inset = offsetClosedOutline(outline, -Math.max(0, wallMm));
  return inset.length >= 3 ? inset : flattenClosedOutline(outline);
}
