import {
  COVER_SLAB_THICKNESS_MM,
  PATIO_SLAB_THICKNESS_MM,
  POOL_LIP_THICKNESS_MM,
  POOL_WALL_THICKNESS_MM,
  POOL_WATER_FREEBOARD_MM,
  approximateIntersectionAreaMm2,
  buildingHeightMm,
  clipOutlineByAabbs,
  coverHeightMm,
  depthMmAtT,
  depthProfileForBody,
  depthTAtPlanPoint,
  designBoundsMm,
  featureDepthMm,
  formatLength,
  insideOutlineFromOutside,
  isAxisAlignedRect,
  isRectangularOutline,
  maxDepthMmFromProfile,
  clampOpeningStory,
  coverSupportFootingSizeMm,
  coverSupportPostSizeMm,
  mmToMeters,
  openingSillMm,
  STANDARD_STEP_RISER_MM,
  stepsRiserCount,
  stepsTreadOutline,
  objectHeightMm,
  outlineBounds,
  openWallSegments,
  outlineBoundsRect,
  planToWorldXZ,
  pointInPolygon,
  rectangleFrame,
  spaNeedsDeckPit,
  spaShellParams,
  spaTotalDepthMm,
  subtractAabbHoles,
  waterBodiesConnected,
  waterBodyKind,
  type BuildingOpeningKind,
  type DepthTransition,
  type DesignDocument,
  type PointMm,
} from "@pool-design/shared";
import { openingEndpoints } from "@/lib/cad/draw";

/** Mirrors CadWorkspace selection (non-null). */
export type SceneSelection =
  | { kind: "pool"; id: string }
  | { kind: "patio"; id: string }
  | { kind: "building"; id: string }
  | { kind: "opening"; buildingId: string; id: string }
  | { kind: "cover"; id: string }
  | { kind: "coverSupport"; coverId: string; id: string }
  | { kind: "run"; id: string }
  | { kind: "object"; id: string }
  | { kind: "feature"; id: string };

export type SceneMaterialKey =
  | "ground"
  | "building"
  | "patio"
  | "poolWater"
  | "poolShell"
  | "poolFloor"
  | "coping"
  | "waterline"
  | "spaShell"
  | "spaWater"
  | "cover"
  | "pergola"
  | "object"
  | "equipment"
  | "feature"
  | "door"
  | "window"
  | "pipeSuction"
  | "pipeReturn"
  | "pipeOther"
  | "pipeGas"
  | "sectionCap"
  | "sectionWater";

/** Optional presentation toggles for the 3D preview. */
export type SceneBuildOptions = {
  /** Draw underground plumbing tubes (off by default). */
  showPlumbing?: boolean;
  /** Omit patio/deck slabs for cutaway review. */
  hideDeck?: boolean;
};

type Selectable = { select?: SceneSelection };

/** Extruded polygon in Three meters (Y-up). Optional hole = hollow shell. */
export type ExtrudeDescriptor = {
  kind: "extrude";
  id: string;
  material: SceneMaterialKey;
  outlineMm: PointMm[];
  /** Inner outline punched through the extrusion (pool/spa walls). */
  holeOutlineMm?: PointMm[];
  /** Additional holes (e.g. multiple water bodies in a patio slab). */
  holeOutlinesMm?: PointMm[][];
  bottomY: number;
  height: number;
  opacity?: number;
  /** Patio finish catalog id (when material === "patio"). */
  patioFinishId?: string;
} & Selectable;

export type BoxDescriptor = {
  kind: "box";
  id: string;
  material: SceneMaterialKey;
  position: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  /** Yaw around world Y (radians). Ignored when axisX/axisZ are set. */
  rotationY: number;
  /**
   * Optional horizontal basis (unit-ish). Local X = along width, local Z = thickness.
   * When set, overrides rotationY for correct wall-aligned openings/walls.
   */
  axisX?: { x: number; z: number };
  axisZ?: { x: number; z: number };
  opacity?: number;
  /** When set, render a stylized catalog stand-in instead of a plain box. */
  catalogItemId?: string;
  /** Door / window variant for OpeningMesh. */
  openingKind?: BuildingOpeningKind;
} & Selectable;

/** Shared depth-profile fields for floor / water meshes. */
export type DepthProfileFields = {
  depthStations: {
    t: number;
    depthMm: number;
    transition: DepthTransition;
  }[];
  depthAxis: PointMm;
  axisOriginMm: PointMm;
  axisLengthMm: number;
};

/** Sloped pool floor from an authorable depth profile. */
export type FloorDescriptor = {
  kind: "floor";
  id: string;
  material: SceneMaterialKey;
  outlineMm: PointMm[];
  depthShallowMm: number;
  depthDeepMm: number;
  /** Structural slab thickness (m). */
  thicknessM?: number;
  opacity?: number;
} & DepthProfileFields &
  Selectable;

/**
 * Water volume whose bottom follows the depth profile (flat top at waterline).
 */
export type WaterBodyDescriptor = {
  kind: "waterBody";
  id: string;
  material: SceneMaterialKey;
  outlineMm: PointMm[];
  /** Footprints punched from the water (e.g. solid sunshelf fill). */
  holeOutlinesMm?: PointMm[][];
  waterTopY: number;
  opacity?: number;
  surfaceOpacity?: number;
} & DepthProfileFields &
  Selectable;

/** Camera / clip frame for a longitudinal basin cross-section. */
export type BasinSectionFrame = {
  /** Pool center in world XZ. */
  center: { x: number; z: number };
  /** Mid-depth look target Y. */
  targetY: number;
  /** Unit normal of the cut plane (horizontal); camera sits on +normal. */
  cutNormal: { x: number; z: number };
  /** Unit direction along the pool (shallow → deep) in world XZ. */
  depthDir: { x: number; z: number };
  /** Half-span along the cut normal (m) — used to slide the cut. */
  halfSpan: number;
  /** Half-length along the depth axis (m). */
  halfLength: number;
  /** Plane constant at cutOffset=0: normal·p + constant = 0 through center. */
  planeConstant: number;
  /** Suggested camera distance (m). */
  distance: number;
  waterTopY: number;
  lipY: number;
  depthStations: {
    t: number;
    depthMm: number;
    transition: DepthTransition;
  }[];
};

/** World-space text label for 3D dimension / depth callouts. */
export type LabelDescriptor = {
  kind: "label";
  id: string;
  text: string;
  position: { x: number; y: number; z: number };
};

/** Buried / trench plumbing tube. */
export type TubeDescriptor = {
  kind: "tube";
  id: string;
  material: SceneMaterialKey;
  pointsMm: PointMm[];
  radiusM: number;
  /** World Y for the trench centerline */
  y: number;
} & Selectable;

export type MeshDescriptor =
  | ExtrudeDescriptor
  | BoxDescriptor
  | FloorDescriptor
  | WaterBodyDescriptor
  | TubeDescriptor;

export type SceneModel = {
  center: { x: number; z: number };
  groundSize: number;
  /** Grade slab (with water-body holes) rendered under the design. */
  ground: ExtrudeDescriptor;
  meshes: MeshDescriptor[];
};

function layerVisible(design: DesignDocument, id: string): boolean {
  return design.layers.find((l) => l.id === id)?.visible !== false;
}

function closeOutline(outline: PointMm[]): PointMm[] {
  if (outline.length < 3) return outline;
  const first = outline[0];
  const last = outline[outline.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) < 1) return outline;
  return [...outline, first];
}

function selectionEquals(
  a: SceneSelection | null | undefined,
  b: SceneSelection | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "opening" && b.kind === "opening") {
    return a.id === b.id && a.buildingId === b.buildingId;
  }
  if (a.kind === "coverSupport" && b.kind === "coverSupport") {
    return a.id === b.id && a.coverId === b.coverId;
  }
  return a.id === b.id;
}

export { selectionEquals };

/** Plan direction (nx,ny) → world XZ unit vector (planX→-x, planY→-z). */
function planDirToWorldXZ(nx: number, ny: number): { x: number; z: number } {
  const x = -nx;
  const z = -ny;
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}

function ringPoints(outline: PointMm[]): PointMm[] {
  const closed = closeOutline(outline);
  if (
    closed.length > 1 &&
    Math.hypot(
      closed[0].x - closed[closed.length - 1].x,
      closed[0].y - closed[closed.length - 1].y,
    ) < 1
  ) {
    return closed.slice(0, -1);
  }
  return closed;
}

/** Vertical wall panels around an outline (hollow basin). */
function pushWallRing(
  meshes: MeshDescriptor[],
  opts: {
    outlineMm: PointMm[];
    bottomY: number;
    height: number;
    thicknessMm: number;
    material: SceneMaterialKey;
    select: SceneSelection;
    idPrefix: string;
    /** If true, thickness grows toward outline centroid (pool/spa). */
    inward: boolean;
    /** Open wall segments that join these footprints (shared waterline). */
    openAgainst?: PointMm[][];
  },
) {
  const pts = ringPoints(opts.outlineMm);
  if (pts.length < 3) return;
  const thickM = mmToMeters(opts.thicknessMm);
  let segIndex = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const segments =
      opts.openAgainst && opts.openAgainst.length > 0
        ? openWallSegments(a, b, opts.openAgainst)
        : Math.hypot(b.x - a.x, b.y - a.y) >= 40
          ? [{ a, b }]
          : [];
    for (const seg of segments) {
      const edgeLen = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
      if (edgeLen < 40) continue;
      const tx = (seg.b.x - seg.a.x) / edgeLen;
      const ty = (seg.b.y - seg.a.y) / edgeLen;
      let nx = -ty;
      let ny = tx;
      const mid = { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 };
      // Probe inside the polygon (AABB centroid fails for L / notched shapes).
      const probe = { x: mid.x + nx * 25, y: mid.y + ny * 25 };
      const probeInside = pointInPolygon(probe, pts);
      if (opts.inward !== probeInside) {
        nx = -nx;
        ny = -ny;
      }
      const centerPlan = {
        x: mid.x + nx * (opts.thicknessMm / 2),
        y: mid.y + ny * (opts.thicknessMm / 2),
      };
      const xz = planToWorldXZ(centerPlan);
      meshes.push({
        kind: "box",
        id: `${opts.idPrefix}_${segIndex++}`,
        material: opts.material,
        position: {
          x: xz.x,
          y: opts.bottomY + opts.height / 2,
          z: xz.z,
        },
        size: {
          x: mmToMeters(edgeLen),
          y: opts.height,
          z: thickM,
        },
        rotationY: 0,
        axisX: planDirToWorldXZ(tx, ty),
        axisZ: planDirToWorldXZ(nx, ny),
        select: opts.select,
      });
    }
  }
}

const BASIN_FLOOR_THICKNESS_M = 0.14;

/** Spa floor / water / rim elevations — shared by shell meshes and fixtures. */
function spaElevations(
  body: Parameters<typeof spaShellParams>[0],
  poolWaterTopY: number,
  joinsPool: boolean,
): {
  floorY: number;
  waterTopY: number;
  wallTopY: number;
  deckTopY: number;
} {
  const spa = spaShellParams(body);
  const shellHMm = Math.max(0, spa.shellHeightMm);
  const deckTopY = mmToMeters(PATIO_SLAB_THICKNESS_MM);
  const wallTopY = deckTopY + mmToMeters(shellHMm);
  const waterDepthMm = Math.max(spaTotalDepthMm(body), 350);
  const spaFreeboardMm =
    shellHMm <= 0
      ? POOL_WATER_FREEBOARD_MM
      : Math.min(75, Math.max(20, shellHMm * 0.12));
  const spaWaterTop = Math.max(
    poolWaterTopY,
    wallTopY - mmToMeters(spaFreeboardMm),
  );
  const needsPit = spaNeedsDeckPit(body) || joinsPool;
  let floorY: number;
  if (needsPit) {
    floorY = spaWaterTop - mmToMeters(waterDepthMm);
  } else {
    const raisedH = Math.max(0.02, wallTopY - deckTopY);
    const waterD = Math.min(
      mmToMeters(waterDepthMm),
      Math.max(0.08, raisedH - mmToMeters(spaFreeboardMm)),
    );
    floorY = Math.max(deckTopY + 0.02, spaWaterTop - waterD);
  }
  return {
    floorY,
    waterTopY: Math.max(floorY + 0.05, spaWaterTop),
    wallTopY,
    deckTopY,
  };
}

/**
 * Vertical center for in-water fixtures so jets / bubblers stay underwater.
 * Returns null when the object should use the default deck/ground placement.
 */
function waterFixtureCenterY(
  obj: {
    catalogItemId: string;
    parentBodyId?: string;
    position: PointMm;
  },
  opts: {
    spas: Parameters<typeof spaShellParams>[0][];
    pools: Parameters<typeof spaShellParams>[0][];
    features: { kind: string; outline: PointMm[]; depthMm?: number; poolBodyId?: string }[];
    poolWaterTopY: number;
  },
): number | null {
  const id = obj.catalogItemId;
  const isJet = id === "spa_jet";
  const isLight = id.startsWith("light_");
  const isSpaBubbler = id === "spa_bubbler";
  const isPoolBubbler = id === "pool_bubbler";
  const isDrain = id === "spa_drain";
  if (!isJet && !isLight && !isSpaBubbler && !isPoolBubbler && !isDrain) {
    return null;
  }

  const parentId = obj.parentBodyId;
  const spa =
    (parentId
      ? opts.spas.find((s) => s.id === parentId)
      : undefined) ??
    opts.spas.find((s) => pointInPolygon(obj.position, s.outline));

  if (spa && (isJet || isLight || isSpaBubbler || isDrain)) {
    const joinsPool = opts.pools.some((p) =>
      waterBodiesConnected(p.outline, spa.outline),
    );
    const elev = spaElevations(spa, opts.poolWaterTopY, joinsPool);
    const waterDepth = elev.waterTopY - elev.floorY;
    if (isSpaBubbler || isDrain) {
      // Floor fixtures sit just above the basin floor.
      return elev.floorY + (isDrain ? 0.02 : 0.028);
    }
    // Wall jet / light: mid-water, always below the surface.
    const y = elev.floorY + waterDepth * (isLight ? 0.4 : 0.55);
    return Math.min(
      elev.waterTopY - 0.09,
      Math.max(elev.floorY + 0.12, y),
    );
  }

  if (isPoolBubbler || isJet || isLight) {
    const shelf = opts.features.find(
      (f) =>
        f.kind === "sunshelf" &&
        f.outline.length >= 3 &&
        pointInPolygon(obj.position, f.outline),
    );
    if (shelf) {
      const shelfTop =
        opts.poolWaterTopY - mmToMeters(featureDepthMm("sunshelf", shelf.depthMm));
      // Bubbler head on the ledge, still under the freeboard waterline.
      return Math.min(opts.poolWaterTopY - 0.05, shelfTop + 0.022);
    }

    const pool =
      (parentId
        ? opts.pools.find((p) => p.id === parentId)
        : undefined) ??
      opts.pools.find((p) => pointInPolygon(obj.position, p.outline));
    if (pool && waterBodyKind(pool) !== "spa") {
      const profile = depthProfileForBody(pool);
      const t = depthTAtPlanPoint(
        obj.position,
        profile.originMm,
        profile.axis,
        profile.axisLengthMm,
      );
      const floorY = -mmToMeters(depthMmAtT(profile.stations, t));
      if (isPoolBubbler || isDrain) {
        return Math.min(opts.poolWaterTopY - 0.05, floorY + 0.028);
      }
      const waterDepth = opts.poolWaterTopY - floorY;
      const y = floorY + waterDepth * 0.45;
      return Math.min(
        opts.poolWaterTopY - 0.09,
        Math.max(floorY + 0.12, y),
      );
    }

    // Last resort: keep under the pool waterline.
    return opts.poolWaterTopY - 0.12;
  }

  return null;
}

/**
 * Vertical center for a standing scale person so feet sit on the basin floor
 * (or sunshelf) when placed in water. Returns null on dry deck / grade.
 */
function standingPersonCenterY(
  position: PointMm,
  heightM: number,
  opts: {
    spas: Parameters<typeof spaShellParams>[0][];
    pools: Parameters<typeof spaShellParams>[0][];
    features: {
      kind: string;
      outline: PointMm[];
      depthMm?: number;
      poolBodyId?: string;
    }[];
    poolWaterTopY: number;
  },
): number | null {
  const h = Math.max(0.1, heightM);

  const shelf = opts.features.find(
    (f) =>
      f.kind === "sunshelf" &&
      f.outline.length >= 3 &&
      pointInPolygon(position, f.outline),
  );
  if (shelf) {
    const shelfTop =
      opts.poolWaterTopY -
      mmToMeters(featureDepthMm("sunshelf", shelf.depthMm));
    return shelfTop + h / 2;
  }

  const spa = opts.spas.find(
    (s) => s.outline.length >= 3 && pointInPolygon(position, s.outline),
  );
  if (spa) {
    const joinsPool = opts.pools.some((p) =>
      waterBodiesConnected(p.outline, spa.outline),
    );
    const elev = spaElevations(spa, opts.poolWaterTopY, joinsPool);
    return elev.floorY + h / 2;
  }

  const pool = opts.pools.find(
    (p) => p.outline.length >= 3 && pointInPolygon(position, p.outline),
  );
  if (pool) {
    const profile = depthProfileForBody(pool);
    const t = depthTAtPlanPoint(
      position,
      profile.originMm,
      profile.axis,
      profile.axisLengthMm,
    );
    const floorY = -mmToMeters(depthMmAtT(profile.stations, t));
    return floorY + h / 2;
  }

  return null;
}

/** Opaque structural floor that seals the basin (hides underground work). */
function pushBasinFloor(
  meshes: MeshDescriptor[],
  opts: {
    idPrefix: string;
    outlineMm: PointMm[];
    floorY: number;
    select: SceneSelection;
    material?: SceneMaterialKey;
  },
) {
  if (opts.outlineMm.length < 3) return;
  const t = BASIN_FLOOR_THICKNESS_M;
  meshes.push({
    kind: "extrude",
    id: `${opts.idPrefix}_floor`,
    material: opts.material ?? "poolFloor",
    outlineMm: closeOutline(opts.outlineMm),
    // Embed slightly so wall bottoms sit on the slab without a light leak.
    bottomY: opts.floorY - t * 0.2,
    height: t,
    select: opts.select,
  });
}

/** Flat-bottom water volume + surface (spas / constant-depth basins). */
function pushWaterFill(
  meshes: MeshDescriptor[],
  opts: {
    idPrefix: string;
    outlineMm: PointMm[];
    floorY: number;
    waterTopY: number;
    select: SceneSelection;
    waterMaterial: SceneMaterialKey;
    /** When false, caller already pushed {@link pushBasinFloor}. */
    includeFloor?: boolean;
    floorMaterial?: SceneMaterialKey;
  },
) {
  if (opts.outlineMm.length < 3) return;
  const outline = closeOutline(opts.outlineMm);
  const waterTop = opts.waterTopY;
  const floorY = Math.min(opts.floorY, waterTop - 0.12);
  const floorTop =
    floorY +
    (opts.includeFloor === false ? 0.02 : BASIN_FLOOR_THICKNESS_M * 0.8);
  if (opts.includeFloor !== false) {
    pushBasinFloor(meshes, {
      idPrefix: opts.idPrefix,
      outlineMm: opts.outlineMm,
      floorY,
      select: opts.select,
      material: opts.floorMaterial,
    });
  }
  const volumeH = Math.max(0.15, waterTop - floorTop - 0.01);
  meshes.push({
    kind: "extrude",
    id: `${opts.idPrefix}_volume`,
    material: opts.waterMaterial,
    outlineMm: outline,
    bottomY: floorTop,
    height: volumeH,
    opacity: 0.22,
    select: opts.select,
  });
  meshes.push({
    kind: "extrude",
    id: `${opts.idPrefix}_surface`,
    material: opts.waterMaterial,
    outlineMm: outline,
    bottomY: waterTop - 0.012,
    height: 0.012,
    opacity: 0.56,
    select: opts.select,
  });
}

/** Profile-following water (bottom tracks depth stations; flat top at waterline). */
function pushProfileWater(
  meshes: MeshDescriptor[],
  opts: {
    idPrefix: string;
    outlineMm: PointMm[];
    waterTopY: number;
    select: SceneSelection;
    waterMaterial: SceneMaterialKey;
    holeOutlinesMm?: PointMm[][];
    profile: {
      stations: {
        t: number;
        depthMm: number;
        transition: DepthTransition;
      }[];
      axis: PointMm;
      originMm: PointMm;
      axisLengthMm: number;
    };
  },
) {
  if (opts.outlineMm.length < 3) return;
  meshes.push({
    kind: "waterBody",
    id: `${opts.idPrefix}_body`,
    material: opts.waterMaterial,
    outlineMm: closeOutline(opts.outlineMm),
    holeOutlinesMm: opts.holeOutlinesMm,
    waterTopY: opts.waterTopY,
    depthStations: opts.profile.stations,
    depthAxis: opts.profile.axis,
    axisOriginMm: opts.profile.originMm,
    axisLengthMm: opts.profile.axisLengthMm,
    opacity: 0.22,
    surfaceOpacity: 0.56,
    select: opts.select,
  });
}

/**
 * Longitudinal cross-section frame for the primary pool (shallow→deep axis).
 * Used by the "Into basin" camera + clipping plane.
 */
export function basinSectionFrame(
  design: DesignDocument,
): BasinSectionFrame | null {
  const pools = (design.poolBodies ?? []).filter(
    (b) => waterBodyKind(b) !== "spa" && b.outline.length >= 3,
  );
  const body = pools[0];
  if (!body) return null;
  const profile = depthProfileForBody(body);
  const bb = outlineBounds(body.outline);
  const center = planToWorldXZ({ x: bb.cx, y: bb.cy });
  const ax = profile.axis;
  const alen = Math.hypot(ax.x, ax.y) || 1;
  // Depth direction in world XZ (planX→-x, planY→-z).
  const depthX = -ax.x / alen;
  const depthZ = -ax.y / alen;
  // Cut plane normal = horizontal perpendicular (opens the long section).
  let cutX = -depthZ;
  let cutZ = depthX;
  const nLen = Math.hypot(cutX, cutZ) || 1;
  cutX /= nLen;
  cutZ /= nLen;
  const lengthM = mmToMeters(profile.axisLengthMm);
  // Project AABB corners onto cut normal for slide range.
  const corners = [
    { x: bb.minX, y: bb.minY },
    { x: bb.maxX, y: bb.minY },
    { x: bb.maxX, y: bb.maxY },
    { x: bb.minX, y: bb.maxY },
  ].map((p) => planToWorldXZ(p));
  let minN = Infinity;
  let maxN = -Infinity;
  for (const c of corners) {
    const n = c.x * cutX + c.z * cutZ;
    if (n < minN) minN = n;
    if (n > maxN) maxN = n;
  }
  const halfSpan = Math.max(0.5, (maxN - minN) / 2);
  const spanM = mmToMeters(Math.max(bb.width, bb.height, 6000));
  const midDepthMm =
    (profile.stations[0].depthMm +
      profile.stations[profile.stations.length - 1].depthMm) /
    2;
  const waterTopY = -mmToMeters(POOL_WATER_FREEBOARD_MM);
  return {
    center,
    targetY: -mmToMeters(midDepthMm) * 0.55,
    cutNormal: { x: cutX, z: cutZ },
    depthDir: { x: depthX, z: depthZ },
    halfSpan,
    halfLength: Math.max(1, lengthM / 2),
    // THREE.Plane: normal·x + constant = 0
    planeConstant: -(cutX * center.x + cutZ * center.z),
    distance: Math.max(8, spanM * 0.85),
    waterTopY,
    lipY: mmToMeters(POOL_LIP_THICKNESS_MM),
    depthStations: profile.stations.map((s) => ({
      t: s.t,
      depthMm: s.depthMm,
      transition: s.transition,
    })),
  };
}

/** Plane constant for a slid cut: offset in [-1,1] across the pool width. */
export function basinCutPlaneConstant(
  section: BasinSectionFrame,
  cutOffset: number,
): number {
  const o = Math.min(1, Math.max(-1, cutOffset));
  return section.planeConstant - o * section.halfSpan * 0.92;
}

/** Deck/ground pit outline: prefer true rectangle corners over AABB inflate. */
function pitHoleOutline(outline: PointMm[]): PointMm[] {
  const open = ringPoints(outline);
  if (open.length < 3) return outlineBoundsRect(outline);
  if (isAxisAlignedRect(open, 80)) return open;
  if (isRectangularOutline(open, 80)) return open.slice(0, 4);
  return outlineBoundsRect(outline);
}

function pipeMaterialForCircuit(
  circuit: "suction" | "return" | "gas" | "other",
): SceneMaterialKey {
  if (circuit === "suction") return "pipeSuction";
  if (circuit === "return") return "pipeReturn";
  if (circuit === "gas") return "pipeGas";
  return "pipeOther";
}

/**
 * World-space dimension / depth callouts for the current 3D selection.
 */
export function selectionReadouts(
  design: DesignDocument,
  selection: SceneSelection | null,
): LabelDescriptor[] {
  if (!selection) return [];
  const unit = design.unitSystem ?? "imperial";
  const labels: LabelDescriptor[] = [];

  if (selection.kind === "pool") {
    const body = (design.poolBodies ?? []).find((b) => b.id === selection.id);
    if (!body || body.outline.length < 3) return labels;
    const bb = outlineBounds(body.outline);
    const center = planToWorldXZ({ x: bb.cx, y: bb.cy });
    const frame = rectangleFrame(body.outline);
    const w = frame?.widthMm ?? bb.width;
    const len = frame?.lengthMm ?? bb.height;
    labels.push({
      kind: "label",
      id: `lbl_${body.id}_size`,
      text: `${formatLength(w, unit)} × ${formatLength(len, unit)}`,
      position: { x: center.x, y: 0.55, z: center.z },
    });
    if (waterBodyKind(body) !== "spa") {
      const profile = depthProfileForBody(body);
      const shallow = profile.stations[0];
      const deep = profile.stations[profile.stations.length - 1];
      const ax = profile.axis;
      const alen = Math.hypot(ax.x, ax.y) || 1;
      const ux = ax.x / alen;
      const uy = ax.y / alen;
      const shallowPt = {
        x: profile.originMm.x + ux * profile.axisLengthMm * 0.08,
        y: profile.originMm.y + uy * profile.axisLengthMm * 0.08,
      };
      const deepPt = {
        x: profile.originMm.x + ux * profile.axisLengthMm * 0.92,
        y: profile.originMm.y + uy * profile.axisLengthMm * 0.92,
      };
      const sw = planToWorldXZ(shallowPt);
      const dw = planToWorldXZ(deepPt);
      labels.push({
        kind: "label",
        id: `lbl_${body.id}_shallow`,
        text: `Shallow ${formatLength(shallow.depthMm, unit)}`,
        position: {
          x: sw.x,
          y: -mmToMeters(shallow.depthMm) * 0.35,
          z: sw.z,
        },
      });
      labels.push({
        kind: "label",
        id: `lbl_${body.id}_deep`,
        text: `Deep ${formatLength(deep.depthMm, unit)}`,
        position: {
          x: dw.x,
          y: -mmToMeters(deep.depthMm) * 0.45,
          z: dw.z,
        },
      });
    } else {
      const d = spaTotalDepthMm(body);
      labels.push({
        kind: "label",
        id: `lbl_${body.id}_depth`,
        text: `Depth ${formatLength(d, unit)}`,
        position: { x: center.x, y: 0.25, z: center.z },
      });
    }
    return labels;
  }

  if (selection.kind === "patio") {
    const patio = (design.patios ?? []).find((p) => p.id === selection.id);
    if (!patio || patio.outline.length < 3) return labels;
    const bb = outlineBounds(patio.outline);
    const center = planToWorldXZ({ x: bb.cx, y: bb.cy });
    const frame = rectangleFrame(patio.outline);
    const w = frame?.widthMm ?? bb.width;
    const len = frame?.lengthMm ?? bb.height;
    labels.push({
      kind: "label",
      id: `lbl_patio_${patio.id}`,
      text: `${formatLength(w, unit)} × ${formatLength(len, unit)}`,
      position: { x: center.x, y: 0.35, z: center.z },
    });
    return labels;
  }

  if (selection.kind === "feature") {
    const f = (design.features ?? []).find((x) => x.id === selection.id);
    if (!f || f.outline.length < 3) return labels;
    const bb = outlineBounds(f.outline);
    const center = planToWorldXZ({ x: bb.cx, y: bb.cy });
    const frame = rectangleFrame(f.outline);
    const w = frame?.widthMm ?? bb.width;
    const len = frame?.lengthMm ?? bb.height;
    labels.push({
      kind: "label",
      id: `lbl_feat_${f.id}`,
      text: `${formatLength(w, unit)} × ${formatLength(len, unit)}`,
      position: { x: center.x, y: 0.2, z: center.z },
    });
  }

  return labels;
}

export function buildSceneModel(
  design: DesignDocument,
  options: SceneBuildOptions = {},
): SceneModel {
  const bounds = designBoundsMm(design);
  const center = planToWorldXZ({ x: bounds.cx, y: bounds.cy });
  const spanM = mmToMeters(Math.max(bounds.width, bounds.height, 10000));
  const groundSize = Math.max(40, spanM * 2.5);
  const meshes: MeshDescriptor[] = [];

  const padMm = Math.max(bounds.width, bounds.height, 20000) * 1.25;
  const groundOutline: PointMm[] = [
    { x: bounds.cx - padMm, y: bounds.cy - padMm },
    { x: bounds.cx + padMm, y: bounds.cy - padMm },
    { x: bounds.cx + padMm, y: bounds.cy + padMm },
    { x: bounds.cx - padMm, y: bounds.cy + padMm },
  ];
  const bodies = design.poolBodies ?? [];
  const spas = bodies.filter((b) => waterBodyKind(b) === "spa");
  const pools = bodies.filter((b) => waterBodyKind(b) !== "spa");

  // Deck pits: in-ground pools + spas that drop below grade (shell < total depth)
  // or that join a pool. Punch each footprint separately — merging to a union
  // AABB over-cuts the empty corner beside an attached spa.
  const poolPitHoles: PointMm[][] = [];
  for (const p of pools) {
    if (p.outline.length >= 3) poolPitHoles.push(pitHoleOutline(p.outline));
  }
  for (const s of spas) {
    if (s.outline.length < 3) continue;
    const joinsPool = pools.some((p) =>
      waterBodiesConnected(p.outline, s.outline),
    );
    if (spaNeedsDeckPit(s) || joinsPool) {
      poolPitHoles.push(pitHoleOutline(s.outline));
    }
  }

  const waterTopY = -mmToMeters(POOL_WATER_FREEBOARD_MM);

  // Prefer solid AABB slabs with pits subtracted (reliable). Fall back to
  // Extrude holes only when the outline isn't a rectangle.
  const groundRegions = subtractAabbHoles(groundOutline, poolPitHoles);
  if (groundRegions.length > 0) {
    let gi = 0;
    for (const region of groundRegions) {
      meshes.push({
        kind: "extrude",
        id: `ground_grade_${gi++}`,
        material: "ground",
        outlineMm: closeOutline(region),
        bottomY: -0.04,
        height: 0.04,
      });
    }
  }

  const ground: ExtrudeDescriptor = {
    kind: "extrude",
    id: "ground_grade",
    material: "ground",
    outlineMm: groundOutline,
    // When subtracted slabs were emitted into meshes, skip the solid ground mesh.
    holeOutlinesMm: groundRegions.length > 0 ? [] : poolPitHoles,
    bottomY: -0.04,
    height: groundRegions.length > 0 ? 0 : 0.04,
  };

  if (layerVisible(design, "house") || layerVisible(design, "building")) {
    for (const b of design.buildings ?? []) {
      if (b.outline.length < 3) continue;
      const hMm = buildingHeightMm(b.stories);
      const h = mmToMeters(hMm);
      const select: SceneSelection = { kind: "building", id: b.id };
      meshes.push({
        kind: "extrude",
        id: `building_${b.id}`,
        material: "building",
        outlineMm: closeOutline(b.outline),
        bottomY: 0,
        height: h,
        select,
      });

      const bb = outlineBounds(b.outline);
      for (const opening of b.openings ?? []) {
        const geom = openingEndpoints(b.outline, opening);
        if (!geom) continue;
        const wallUx = geom.edgeB.x - geom.edgeA.x;
        const wallUy = geom.edgeB.y - geom.edgeA.y;
        const wallLen = Math.hypot(wallUx, wallUy) || 1;
        const tx = wallUx / wallLen;
        const ty = wallUy / wallLen;
        // Outward normal in plan (away from building center)
        let nx = -ty;
        let ny = tx;
        const toCenterX = bb.cx - geom.center.x;
        const toCenterY = bb.cy - geom.center.y;
        if (nx * toCenterX + ny * toCenterY > 0) {
          nx = -nx;
          ny = -ny;
        }
        // Sit on the exterior face so frames / glass aren't buried in the solid shell.
        const thicknessMm = 110;
        const xz = planToWorldXZ(geom.center);
        const outward = planDirToWorldXZ(nx, ny);
        const faceOffsetM = mmToMeters(thicknessMm) * 0.35 + 0.04;
        const stories = Math.max(1, b.stories || 1);
        const story = clampOpeningStory(opening.story, stories);
        const sillMm = openingSillMm(opening.kind, story, stories);
        const openH = Math.min(opening.heightMm, hMm - sillMm - 50);
        if (openH < 100) continue;
        meshes.push({
          kind: "box",
          id: `opening_${b.id}_${opening.id}`,
          material: opening.kind === "window" ? "window" : "door",
          openingKind: opening.kind,
          position: {
            x: xz.x + outward.x * faceOffsetM,
            y: mmToMeters(sillMm + openH / 2),
            z: xz.z + outward.z * faceOffsetM,
          },
          size: {
            x: mmToMeters(opening.widthMm),
            y: mmToMeters(openH),
            z: mmToMeters(thicknessMm),
          },
          rotationY: 0,
          axisX: planDirToWorldXZ(tx, ty),
          axisZ: outward,
          opacity: 1,
          select: {
            kind: "opening",
            buildingId: b.id,
            id: opening.id,
          },
        });
      }
    }
  }

  if (
    !options.hideDeck &&
    (layerVisible(design, "patio") || layerVisible(design, "deck"))
  ) {
    for (const p of design.patios ?? []) {
      if (p.outline.length < 3) continue;
      const t = mmToMeters(PATIO_SLAB_THICKNESS_MM);
      const select: SceneSelection = { kind: "patio", id: p.id };
      const open = ringPoints(p.outline);
      if (isAxisAlignedRect(open, 80)) {
        // Clean AABB decks: remainder slabs (robust, no earcut hole issues).
        const regions =
          poolPitHoles.length > 0
            ? subtractAabbHoles(open, poolPitHoles)
            : [open];
        let pi = 0;
        for (const region of regions) {
          meshes.push({
            kind: "extrude",
            id: `patio_${p.id}_${pi++}`,
            material: "patio",
            patioFinishId: p.materialId,
            outlineMm: closeOutline(region),
            bottomY: 0,
            height: t,
            select,
          });
        }
      } else {
        // L / rotated / irregular: keep the true patio outline and punch pits.
        meshes.push({
          kind: "extrude",
          id: `patio_${p.id}`,
          material: "patio",
          patioFinishId: p.materialId,
          outlineMm: closeOutline(p.outline),
          holeOutlinesMm: poolPitHoles.length > 0 ? poolPitHoles : undefined,
          bottomY: 0,
          height: t,
          select,
        });
      }
    }
  }

  if (layerVisible(design, "covers")) {
    const deckTopY = mmToMeters(PATIO_SLAB_THICKNESS_MM);
    for (const c of design.patioCovers ?? []) {
      if (c.outline.length < 3) continue;
      const top = mmToMeters(
        coverHeightMm(c.kind === "roof" ? "roof" : "pergola", c.heightMm),
      );
      const slab = mmToMeters(COVER_SLAB_THICKNESS_MM);
      const isRoof = c.kind === "roof";
      meshes.push({
        kind: "extrude",
        id: `cover_${c.id}`,
        material: isRoof ? "cover" : "pergola",
        outlineMm: closeOutline(c.outline),
        bottomY: top - slab,
        height: slab,
        // Solid roofs must fully occlude; pergolas keep open lattice opacity.
        opacity: isRoof ? 1 : 0.55,
        select: { kind: "cover", id: c.id },
      });

      for (const support of c.supports ?? []) {
        const postMm = coverSupportPostSizeMm(support);
        const footMm = coverSupportFootingSizeMm(support);
        const postM = mmToMeters(postMm);
        const footM = mmToMeters(footMm);
        const xz = planToWorldXZ(support.position);
        const footingH = Math.max(0.12, mmToMeters(200));
        const postBottom = deckTopY;
        const postTop = top - slab;
        const postH = Math.max(0.2, postTop - postBottom);
        const supportSelect: SceneSelection = {
          kind: "coverSupport",
          coverId: c.id,
          id: support.id,
        };
        meshes.push({
          kind: "box",
          id: `cover_footing_${c.id}_${support.id}`,
          material: "feature",
          position: {
            x: xz.x,
            y: postBottom - footingH / 2,
            z: xz.z,
          },
          size: { x: footM, y: footingH, z: footM },
          rotationY: 0,
          select: supportSelect,
        });
        meshes.push({
          kind: "box",
          id: `cover_post_${c.id}_${support.id}`,
          material: "pergola",
          position: {
            x: xz.x,
            y: postBottom + postH / 2,
            z: xz.z,
          },
          size: { x: postM, y: postH, z: postM },
          rotationY: 0,
          select: supportSelect,
        });
      }
    }
  }

  if (layerVisible(design, "pool") || layerVisible(design, "pools")) {
    for (const body of bodies) {
      if (body.outline.length < 3) continue;
      const kind = waterBodyKind(body);
      const select: SceneSelection = { kind: "pool", id: body.id };

      if (kind === "spa") {
        const spa = spaShellParams(body);
        const outer = body.outline;
        const inner =
          spa.insideOutline.length >= 3 ? spa.insideOutline : outer;
        const wallT = Math.max(80, spa.wallMm);
        const joinsPool = pools.some((p) =>
          waterBodiesConnected(p.outline, body.outline),
        );
        const needsPit = spaNeedsDeckPit(body) || joinsPool;
        const elev = spaElevations(body, waterTopY, joinsPool);
        const { floorY, waterTopY: spaWaterTop, wallTopY, deckTopY } = elev;

        if (needsPit) {
          const wallBottom = Math.min(floorY, -0.02);
          const wallH = Math.max(0.02, wallTopY - wallBottom);
          // Full spa shell, including pool-side spillover walls. The pool omits
          // those shared edges so only the spa draws that border.
          pushWallRing(meshes, {
            outlineMm: outer,
            bottomY: wallBottom,
            height: wallH,
            thicknessMm: wallT,
            material: "spaShell",
            select,
            idPrefix: `spa_wall_${body.id}`,
            inward: true,
          });
          pushWaterFill(meshes, {
            idPrefix: `spa_${body.id}`,
            outlineMm: inner,
            floorY,
            waterTopY: spaWaterTop,
            select,
            waterMaterial: joinsPool ? "poolWater" : "spaWater",
          });
        } else {
          // Fully raised spa — vessel sits on the deck; shell rises above patio.
          const raisedH = Math.max(0.02, wallTopY - deckTopY);
          pushWallRing(meshes, {
            outlineMm: outer,
            bottomY: deckTopY,
            height: raisedH,
            thicknessMm: wallT,
            material: "spaShell",
            select,
            idPrefix: `spa_wall_${body.id}`,
            inward: true,
          });
          pushWaterFill(meshes, {
            idPrefix: `spa_${body.id}`,
            outlineMm: inner,
            floorY,
            waterTopY: spaWaterTop,
            select,
            waterMaterial: "spaWater",
          });
        }
      } else {
        const profile = depthProfileForBody(body);
        const maxDepth = Math.max(maxDepthMmFromProfile(body), 900);
        const depthM = mmToMeters(maxDepth);
        const lip = mmToMeters(POOL_LIP_THICKNESS_MM);
        const attachedSpas = spas.filter(
          (s) =>
            waterBodiesConnected(body.outline, s.outline) ||
            approximateIntersectionAreaMm2(body.outline, s.outline) > 5_000,
        );
        const spaOutlines = attachedSpas.map((s) => s.outline);
        const outer = body.outline;
        // Pool shell wraps the spa (L/U); spa owns the shared spillover wall.
        const wallOutline =
          spaOutlines.length > 0
            ? clipOutlineByAabbs(outer, spaOutlines)
            : outer;
        const waterInner = insideOutlineFromOutside(
          outer,
          POOL_WALL_THICKNESS_MM,
        );
        // Floor extends under the wall thickness so the shell seals (no light leaks).
        const floorInner = insideOutlineFromOutside(
          outer,
          POOL_WALL_THICKNESS_MM * 0.35,
        );
        const floorOutline =
          spaOutlines.length > 0
            ? clipOutlineByAabbs(floorInner, spaOutlines)
            : floorInner;
        // One continuous water volume (not AABB remainder slabs — those seam).
        const waterOutline =
          spaOutlines.length > 0
            ? clipOutlineByAabbs(waterInner, spaOutlines)
            : waterInner;

        const floorY = -depthM;
        pushWallRing(meshes, {
          outlineMm: wallOutline,
          bottomY: floorY,
          height: depthM + lip,
          thicknessMm: POOL_WALL_THICKNESS_MM,
          material: "poolShell",
          select,
          idPrefix: `pool_wall_${body.id}`,
          inward: true,
          // Drop pool walls on spa-facing edges; spa draws the spillover.
          openAgainst: spaOutlines.length > 0 ? spaOutlines : undefined,
        });

        const floorOutlineClosed = closeOutline(
          floorOutline.length >= 3 ? floorOutline : wallOutline,
        );
        const profileFields = {
          stations: profile.stations.map((s) => ({
            t: s.t,
            depthMm: s.depthMm,
            transition: s.transition,
          })),
          axis: profile.axis,
          originMm: profile.originMm,
          axisLengthMm: profile.axisLengthMm,
        };

        meshes.push({
          kind: "floor",
          id: `pool_${body.id}_floor`,
          material: "poolFloor",
          outlineMm: floorOutlineClosed,
          depthShallowMm: profile.stations[0].depthMm,
          depthDeepMm: profile.stations[profile.stations.length - 1].depthMm,
          depthStations: profileFields.stations,
          depthAxis: profileFields.axis,
          axisOriginMm: profileFields.originMm,
          axisLengthMm: profileFields.axisLengthMm,
          thicknessM: BASIN_FLOOR_THICKNESS_M,
          select,
        });

        // Thin coping cap along the pool lip (sales presentation).
        pushWallRing(meshes, {
          outlineMm: wallOutline,
          bottomY: lip * 0.15,
          height: lip * 0.85,
          thicknessMm: POOL_WALL_THICKNESS_MM * 1.15,
          material: "coping",
          select,
          idPrefix: `pool_coping_${body.id}`,
          inward: true,
          openAgainst: spaOutlines.length > 0 ? spaOutlines : undefined,
        });

        // Waterline tile band just below the freeboard.
        const tileH = mmToMeters(150);
        pushWallRing(meshes, {
          outlineMm: wallOutline,
          bottomY: waterTopY - tileH * 0.85,
          height: tileH,
          thicknessMm: POOL_WALL_THICKNESS_MM * 0.55,
          material: "waterline",
          select,
          idPrefix: `pool_tile_${body.id}`,
          inward: true,
          openAgainst: spaOutlines.length > 0 ? spaOutlines : undefined,
        });

        // Solid sunshelves punch out of the deep water mass (filled with shell).
        const shelfHoles = (design.features ?? [])
          .filter(
            (f) =>
              f.kind === "sunshelf" &&
              f.outline.length >= 3 &&
              (!f.poolBodyId || f.poolBodyId === body.id),
          )
          .map((f) => closeOutline(f.outline));

        if (waterOutline.length >= 3) {
          pushProfileWater(meshes, {
            idPrefix: `pool_${body.id}`,
            outlineMm: waterOutline,
            waterTopY,
            select,
            waterMaterial: "poolWater",
            holeOutlinesMm: shelfHoles.length > 0 ? shelfHoles : undefined,
            profile: profileFields,
          });
        }

        // Shallow water on top of each sunshelf (~feature depth).
        for (const f of design.features ?? []) {
          if (f.kind !== "sunshelf" || f.outline.length < 3) continue;
          if (f.poolBodyId && f.poolBodyId !== body.id) continue;
          const shelfDepthMm = featureDepthMm("sunshelf", f.depthMm);
          const shelfWaterH = Math.max(0.08, mmToMeters(shelfDepthMm) * 0.95);
          // Thin surface only — thick shelf water volumes flicker against the ledge.
          meshes.push({
            kind: "extrude",
            id: `pool_${body.id}_shelfwater_${f.id}`,
            material: "poolWater",
            outlineMm: closeOutline(f.outline),
            bottomY: waterTopY - 0.014,
            height: 0.014,
            opacity: 0.55,
            select,
          });
        }
      }
    }
  }

  if (layerVisible(design, "features")) {
    for (const f of design.features ?? []) {
      if (f.outline.length < 3) continue;
      const select: SceneSelection = { kind: "feature", id: f.id };
      const depthMm = featureDepthMm(f.kind, f.depthMm);
      const outline = closeOutline(f.outline);

      if (f.kind === "sunshelf") {
        // Solid shell fill from pool floor up to the ledge — no hollow undercroft.
        const shelfTop = waterTopY - mmToMeters(depthMm);
        const parent =
          (f.poolBodyId
            ? bodies.find((b) => b.id === f.poolBodyId)
            : undefined) ?? pools[0];
        let floorY = waterTopY - 1.2;
        if (parent && waterBodyKind(parent) !== "spa") {
          const profile = depthProfileForBody(parent);
          const bb = outlineBounds(f.outline);
          const t = depthTAtPlanPoint(
            { x: bb.cx, y: bb.cy },
            profile.originMm,
            profile.axis,
            profile.axisLengthMm,
          );
          floorY = -mmToMeters(depthMmAtT(profile.stations, t));
        }
        const fillH = Math.max(0.12, shelfTop - floorY);
        meshes.push({
          kind: "extrude",
          id: `feature_sunshelf_${f.id}`,
          material: "poolShell",
          outlineMm: outline,
          bottomY: shelfTop - fillH,
          height: fillH,
          select,
        });
      } else if (f.kind === "bench") {
        const benchTop = waterTopY - mmToMeters(Math.min(depthMm, 450));
        const thickness = 0.35;
        meshes.push({
          kind: "extrude",
          id: `feature_bench_${f.id}`,
          material: "poolShell",
          outlineMm: outline,
          bottomY: benchTop - thickness,
          height: thickness,
          select,
        });
      } else if (f.kind === "steps") {
        // Stepped treads: one strip per riser, descending into the pool.
        const risers = stepsRiserCount(f.riserCount);
        const riserM = mmToMeters(STANDARD_STEP_RISER_MM);
        const treadH = Math.max(0.08, riserM * 0.92);
        for (let s = 0; s < risers; s++) {
          const tread = stepsTreadOutline(f.outline, s, risers);
          if (tread.length < 3) continue;
          // s=0 is the top/entry tread (nearest waterline)
          const top = waterTopY - riserM * (s + 1);
          meshes.push({
            kind: "extrude",
            id: `feature_steps_${f.id}_${s}`,
            material: "poolShell",
            outlineMm: closeOutline(tread),
            bottomY: top - treadH,
            height: treadH,
            select,
          });
        }
      }
    }
  }

  // Plumbing is underground — omitted unless cutaway review enables it.
  if (options.showPlumbing && layerVisible(design, "plumbing")) {
    for (const run of design.plumbingRuns ?? []) {
      if (run.points.length < 2) continue;
      const dia = Math.max(20, run.pipeDiameterMm ?? 50.8);
      meshes.push({
        kind: "tube",
        id: `pipe_${run.id}`,
        material: pipeMaterialForCircuit(run.circuit),
        pointsMm: run.points,
        radiusM: mmToMeters(dia / 2),
        y: -0.42,
        select: { kind: "run", id: run.id },
      });
    }
  }

  for (const obj of design.objects ?? []) {
    const hasLayer = design.layers.some((l) => l.id === obj.layerId);
    if (hasLayer && !layerVisible(design, obj.layerId)) continue;

    const hMm = objectHeightMm(obj);
    const h = mmToMeters(hMm);
    const w = mmToMeters(obj.widthMm);
    const d = mmToMeters(obj.depthMm);
    const xz = planToWorldXZ(obj.position);
    const isEquip =
      obj.layerId === "equipment" ||
      obj.catalogItemId.startsWith("equip_") ||
      obj.catalogItemId.includes("pump") ||
      obj.catalogItemId.includes("filter") ||
      obj.catalogItemId.includes("heater") ||
      obj.catalogItemId.includes("salt");

    const planYaw = ((obj.rotationDeg || 0) * Math.PI) / 180;
    // Plan atan2(dy,dx) → Three yaw so local +Z points toward vessel center.
    const rotationY =
      obj.catalogItemId === "spa_jet" ||
      obj.catalogItemId.startsWith("light_")
        ? -planYaw - Math.PI / 2
        : planYaw;

    // Jets / bubblers / underwater lights always sit below the waterline.
    const fixtureY = waterFixtureCenterY(obj, {
      spas,
      pools,
      features: design.features ?? [],
      poolWaterTopY: waterTopY,
    });
    // Scale person: feet on pool/spa floor (or sunshelf) when in water.
    const personY =
      obj.catalogItemId === "person_scale"
        ? standingPersonCenterY(obj.position, h, {
            spas,
            pools,
            features: design.features ?? [],
            poolWaterTopY: waterTopY,
          })
        : null;
    // Patio furniture / dry-deck scale figures stand on finished deck.
    const deckTopY = mmToMeters(PATIO_SLAB_THICKNESS_MM);
    const y =
      fixtureY ??
      personY ??
      (isEquip ? h / 2 : deckTopY + h / 2);

    meshes.push({
      kind: "box",
      id: `object_${obj.id}`,
      material: isEquip ? "equipment" : "object",
      position: { x: xz.x, y, z: xz.z },
      size: { x: w, y: h, z: d },
      rotationY,
      catalogItemId: obj.catalogItemId,
      select: { kind: "object", id: obj.id },
    });
  }

  return { center, groundSize, ground, meshes };
}
