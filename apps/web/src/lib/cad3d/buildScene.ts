import {
  COVER_SLAB_THICKNESS_MM,
  PATIO_SLAB_THICKNESS_MM,
  POOL_LIP_THICKNESS_MM,
  POOL_WATER_FREEBOARD_MM,
  analyzePatioGrade,
  approximateIntersectionAreaMm2,
  buildingHeightMm,
  storyFloorElevationMm,
  colinearOverlapInterval,
  clipOutlineByAabbs,
  coverHeightMm,
  depthMmAtT,
  depthProfileForBody,
  depthTAtPlanPoint,
  designBoundsMm,
  existingGradeDropMm,
  flowerBedHeightMm,
  flowerBedWallThicknessMm,
  resolveFlowerBedWallFinish,
  distToPolygonBoundaryMm,
  featureDepthMm,
  flattenClosedOutline,
  formatLength,
  isCoverAccessoryId,
  isAxisAlignedRect,
  isRectangularOutline,
  maxDepthMmFromProfile,
  clampOpeningStory,
  clampOpeningT,
  coverSupportFootingSizeMm,
  coverSupportPostSizeMm,
  defaultFenceHeightMm,
  fenceFinishHex,
  FENCE_THICKNESS_MM,
  gateEndpoints,
  houseExteriorHex,
  resolveBuildingStoryExterior,
  mmToMeters,
  openingSillMm,
  offsetClosedOutline,
  insetClosedOutline,
  edgeOutwardNormal,
  planSignedAreaMm2,
  poolWallThicknessMm,
  resolveCeilingHeightMm,
  resolveFenceFinish,
  FLOOR_STRUCTURE_THICKNESS_MM,
  STANDARD_STEP_RISER_MM,
  stepsRiserCount,
  stepsTreadOutline,
  stepsRunSignTowardPool,
  DEFAULT_WATERLINE_TILE_ID,
  waterlineNosingBandMm,
  objectHeightMm,
  outlineBounds,
  openWallSegments,
  outlineBoundsRect,
  paddedAabbRing,
  segmentHitsFootprint,
  planToWorldXZ,
  pointInPolygon,
  rectangleFrame,
  resolveGradeStrategy,
  spaNeedsDeckPit,
  spaShellParams,
  spaTotalDepthMm,
  subtractAabbHoles,
  subtractPolygonAabbHoles,
  aabbUnionRing,
  resolveSpaSpillovers,
  spilloverOmitIntervals,
  wallSegmentsMinusIntervals,
  waterBodiesConnected,
  outlinesAabbTouch,
  waterBodyKind,
  ensurePadManifoldPlumbing,
  repairAutoPlumbingIfNeeded,
  resolveInfinityEdges,
  infinityTroughPolygon,
  infinityTroughOuterSpan,
  infinityDeckCutPolygon,
  siteLineLayerIds,
  siteLineSegments,
  type BuildingOpeningKind,
  type DepthTransition,
  type DesignDocument,
  type FlowerBedRegion,
  type FlowerBedWallFinish,
  type PatioCover,
  type PointMm,
  gateOutwardNormal,
  poolGateHingeHeightsMm,
  poolGateLatchSpec,
  polygonCentroid,
  polygonAreaMm2,
  POOL_GATE_GROUND_CLEARANCE_MM,
  type ResolvedSpaSpillover,
  type ResolvedInfinityEdge,
  resolvedBuildingRoof,
  tessellatePitchedRoof,
  roofColorHex,
} from "@pool-design/shared";
import {
  openOutlineRing,
  openingEndpoints,
  resolveOpeningEdge,
} from "@/lib/cad/draw";
import { drapePlanPolygon } from "@/lib/cad3d/drapeSurface";

/** Mirrors CadWorkspace selection (non-null). */
export type SceneSelection =
  | { kind: "pool"; id: string }
  | { kind: "patio"; id: string }
  | { kind: "flowerBed"; id: string }
  | { kind: "building"; id: string }
  | { kind: "opening"; buildingId: string; id: string }
  | { kind: "cover"; id: string }
  | { kind: "coverSupport"; coverId: string; id: string }
  | { kind: "run"; id: string }
  | { kind: "fence"; id: string }
  | { kind: "gate"; fenceId: string; id: string }
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
  | "spilloverWater"
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
  | "sectionWater"
  | "fill"
  | "retaining"
  | "flowerBedSoil"
  | "flowerBedWall"
  | "fence"
  | "gate"
  | "gateSteel"
  | "gateLatch"
  | "gateButton"
  | "roof";

/** Optional presentation toggles for the 3D preview. */
export type SceneBuildOptions = {
  /** Draw underground plumbing tubes (off by default). */
  showPlumbing?: boolean;
  /** Draw property lines / easements on the ground. */
  showSiteLines?: boolean;
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
  /** Tilled furrows vs bark mulch (when material === "flowerBedSoil"). */
  flowerBedSoilKind?: "tilled" | "mulch";
  /** Raised-bed wall finish (when material === "flowerBedWall"). */
  flowerBedWallFinish?: FlowerBedWallFinish;
  /**
   * Shallow water overlay (sunshelf): use thin transmission so ~9″ of water
   * reads lighter than the deep end — not the deep-basin thickness model.
   */
  waterShallow?: boolean;
  /** Exterior wall tint (corner fillers matching wall panels). */
  colorHex?: string;
  sidingId?: string;
  /** House roof catalog id (when material === "roof"). */
  roofFinishId?: string;
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
  /** Waterline tile finish id (when material === "waterline"). */
  waterlineTileId?: string;
  /** When set, render a stylized catalog stand-in instead of a plain box. */
  catalogItemId?: string;
  /** Door / window variant for OpeningMesh. */
  openingKind?: BuildingOpeningKind;
  /** Furniture wood / frame finish id. */
  frameFinishId?: string;
  /** Furniture cushion / canopy finish id. */
  fabricFinishId?: string;
  /** Florida vine on a trellis / arbor. */
  vineId?: string;
  /** Optional solid color override (e.g. fence powder coat). */
  colorHex?: string;
  /**
   * Hardware shape. Default box. `cylinderY` is vertical (hinges/springs);
   * `cylinderX` is along local width (sliding rollers).
   */
  primitive?: "box" | "cylinderY" | "cylinderX";
  /**
   * Pitch around local Z after yaw (radians). Positive raises +local X.
   * Used for fence rails that follow grade (pickets stay plumb separately).
   */
  pitchRad?: number;
  /** World-space water freeboard Y — bubbler plumes break this surface. */
  waterSurfaceY?: number;
  /** Bubbler niche LED under the fountain. */
  hasLedLight?: boolean;
  /** Scale figure sex / outfit (person_scale only). */
  personSex?: "female" | "male";
  personOutfitId?: string;
} & Selectable;

/**
 * Continuous spa spillover curtain along a crest polyline (plan mm).
 * Used for connected weirs so water reads as one flowing sheet around corners.
 */
export type SpilloverRibbonDescriptor = {
  kind: "spilloverRibbon";
  id: string;
  material: "spilloverWater";
  /**
   * Dense crest samples in plan mm. Each has position on the lip and a unit
   * outward normal (toward the pool).
   */
  crest: Array<{ x: number; y: number; nx: number; ny: number }>;
  crestY: number;
  poolWaterY: number;
  /** Extra radial throw at the pool (m). */
  flareM: number;
  /** How far the crest tucks back onto the spa lip (m). */
  lipTuckM?: number;
  opacity?: number;
} & Selectable;

/** @deprecated Prefer SpilloverRibbonDescriptor — kept for type compatibility. */
export type SpilloverCornerDescriptor = SpilloverRibbonDescriptor;

/**
 * Racked fence / glass panel: top & bottom follow grade, vertical edges stay plumb.
 * World-space bottom-rail endpoints + vertical height.
 */
export type FencePanelDescriptor = {
  kind: "fencePanel";
  id: string;
  material: SceneMaterialKey;
  /** World-space bottom-rail start */
  a: { x: number; y: number; z: number };
  /** World-space bottom-rail end */
  b: { x: number; y: number; z: number };
  heightM: number;
  thicknessM: number;
  colorHex?: string;
  opacity?: number;
  /**
   * Picket width (m). When set with picketGapM, draw racked rails + plumb pickets
   * instead of a solid parallelogram slab (glass).
   */
  picketWidthM?: number;
  picketGapM?: number;
  /** Square post size at panel ends (m). Omit for glass / no posts. */
  postSizeM?: number;
  /** Top/bottom rail height (m). Defaults to a thin aluminum-style rail. */
  railHeightM?: number;
  /** Rail depth through the fence (m). Defaults to thicknessM. */
  railDepthM?: number;
  /** Picket depth through the fence (m). Defaults to 75% of thicknessM. */
  picketDepthM?: number;
  /** How far pickets extend into each rail so they read as notched in. */
  picketNotchM?: number;
  /** Pack boards across the bay with tight grooves (vinyl privacy T&G). */
  privacyBoards?: boolean;
  /** Pyramid cap on end posts (typical vinyl). */
  postCap?: boolean;
  /** Extra horizontal rail at mid-height (gate leaves). */
  midRail?: boolean;
  /** Skip end posts (gate leaf between existing jambs). */
  omitPosts?: boolean;
  /** Diagonal brace on the leaf, hinge-bottom to latch-top. */
  brace?: boolean;
} & Selectable;

/**
 * Vertical wall panel with rectangular punched openings (doors / windows).
 * Local X = along wall, Y = up, extruded along local +Z (inward).
 */
export type WallPanelDescriptor = {
  kind: "wallPanel";
  id: string;
  material: SceneMaterialKey;
  /** Bottom-center of the exterior face in world space. */
  position: { x: number; y: number; z: number };
  /** Unit along the wall in world XZ. */
  axisX: { x: number; z: number };
  /** Unit outward in world XZ (panel extrudes inward = −axisZ). */
  axisZ: { x: number; z: number };
  lengthM: number;
  heightM: number;
  thicknessM: number;
  /** Holes in local coords: x along length from panel center, y up from floor. */
  holes: { x: number; y: number; w: number; h: number }[];
  /** Exterior wall tint (multiplies siding albedo). */
  colorHex?: string;
  /** House siding id (stucco, lap, brick, …). */
  sidingId?: string;
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
  /** Skip floor-slab side faces that open into these footprints (attached spa). */
  omitPerimeterAgainst?: PointMm[][];
  /** Footprints punched from the floor tessellation (attached spa). */
  holeOutlinesMm?: PointMm[][];
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
  /**
   * Perimeter for vertical water-column sides. Defaults to outlineMm.
   * Use the spa-clipped pool ring so the authorable inner wall cannot
   * continue through an overlapping spa.
   */
  sideOutlineMm?: PointMm[];
  /** Open water-column sides that join these footprints (attached spa). */
  sideOpenAgainst?: PointMm[][];
  /** Skip vertical water-column faces (they leak through an overlapping spa). */
  omitSides?: boolean;
  /**
   * Local shallow regions (sunshelf). Surface stays continuous; volume bottom
   * steps up to this water depth instead of the basin profile.
   */
  shallowFootprints?: { outlineMm: PointMm[]; depthMm: number }[];
  waterTopY: number;
  /**
   * Raised spa / constant basin: volume bottom at this world Y instead of
   * −depth from the profile (which assumes a pool whose waterline is ~0).
   */
  basinFloorY?: number;
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
  /** World Y for the trench centerline when elevationsMm is omitted */
  y: number;
  /**
   * Optional per-point elevation above grade (mm), parallel to pointsMm.
   * Used for pad risers into equipment.
   */
  elevationsMm?: number[];
} & Selectable;

/**
 * Plan-aligned heightfield for sloping existing grade.
 * Vertex (i,j) at plan (originMm.x + i*stepMm, originMm.y + j*stepYMm),
 * world Y = heightsM[j * cols + i].
 */
export type TerrainDescriptor = {
  kind: "terrain";
  id: string;
  material: SceneMaterialKey;
  originMm: PointMm;
  /** Plan X step between columns (mm). */
  stepMm: number;
  /** Plan Y step between rows (mm). Defaults to stepMm when omitted. */
  stepYMm?: number;
  cols: number;
  rows: number;
  heightsM: number[];
};

/** Survey overlay painted on the ground (property line / easement). */
export type GroundMarkDescriptor = {
  kind: "groundMark";
  id: string;
  /** World-space samples already lifted onto grade. */
  points: { x: number; y: number; z: number }[];
  widthM: number;
  /** Extrude up so the mark is a curb, not a coplanar decal. */
  heightM?: number;
  colorHex: string;
  opacity?: number;
};

/** Triangle soup in world meters (pitched roofs, gable infill). */
export type TriMeshDescriptor = {
  kind: "triMesh";
  id: string;
  material: SceneMaterialKey;
  positions: number[];
  uvs?: number[];
  indices: number[];
  colorHex?: string;
  sidingId?: string;
  roofFinishId?: string;
  opacity?: number;
  flowerBedSoilKind?: "tilled" | "mulch";
  flowerBedWallFinish?: FlowerBedWallFinish;
} & Selectable;

export type MeshDescriptor =
  | ExtrudeDescriptor
  | BoxDescriptor
  | SpilloverRibbonDescriptor
  | FloorDescriptor
  | WaterBodyDescriptor
  | TubeDescriptor
  | TerrainDescriptor
  | FencePanelDescriptor
  | WallPanelDescriptor
  | GroundMarkDescriptor
  | TriMeshDescriptor;

export type SceneModel = {
  center: { x: number; z: number };
  groundSize: number;
  /** Grade slab (with water-body holes) rendered under the design. */
  ground: ExtrudeDescriptor;
  meshes: MeshDescriptor[];
};

function layerVisible(design: DesignDocument, id: string): boolean {
  const layer = design.layers.find((l) => l.id === id);
  if (!layer) return false;
  return layer.visible !== false;
}

/** True if any existing named layer is visible (ignores missing aliases). */
function anyLayerVisible(design: DesignDocument, ...ids: string[]): boolean {
  const present = ids.filter((id) => design.layers.some((l) => l.id === id));
  if (present.length === 0) return true;
  return present.some((id) => layerVisible(design, id));
}

const TILLED_SOIL_LIFT_M = 0.03;

function planGradeY(
  plan: PointMm,
  patios: { outline: PointMm[] }[],
  gradeSamples: Parameters<typeof existingGradeDropMm>[1],
): number {
  for (const patio of patios) {
    if (patio.outline.length >= 3 && pointInPolygon(plan, patio.outline)) {
      return mmToMeters(PATIO_SLAB_THICKNESS_MM);
    }
  }
  return -mmToMeters(existingGradeDropMm(plan, gradeSamples));
}

function flowerBedSoilTopY(
  bed: FlowerBedRegion,
  plan: PointMm,
  patios: { outline: PointMm[] }[],
  gradeSamples: Parameters<typeof existingGradeDropMm>[1],
): number {
  const gradeY = planGradeY(plan, patios, gradeSamples);
  if (bed.style === "raised") {
    return gradeY + mmToMeters(flowerBedHeightMm(bed)) - 0.05;
  }
  return gradeY + TILLED_SOIL_LIFT_M;
}

type DrapedTris = {
  positions: number[];
  uvs: number[];
  indices: number[];
};

function appendDrapedPolygon(
  into: DrapedTris,
  outline: PointMm[],
  patios: { outline: PointMm[] }[],
  gradeSamples: Parameters<typeof existingGradeDropMm>[1],
  liftM: number,
  hole?: PointMm[],
): boolean {
  const draped = drapePlanPolygon(
    outline,
    hole,
    (plan) => planGradeY(plan, patios, gradeSamples),
    liftM,
  );
  if (!draped || draped.indices.length < 3) return false;
  const base = into.positions.length / 3;
  into.positions.push(...draped.positions);
  into.uvs.push(...draped.uvs);
  for (const i of draped.indices) into.indices.push(base + i);
  return true;
}

function appendDrapedWallRing(
  into: DrapedTris,
  outline: PointMm[],
  patios: { outline: PointMm[] }[],
  gradeSamples: Parameters<typeof existingGradeDropMm>[1],
  bottomInsetM: number,
  heightM: number,
  inward: boolean,
): void {
  const ring = flattenClosedOutline(outline);
  if (ring.length < 2) return;
  const n = ring.length;
  const stepMm = 320;
  type Node = { plan: PointMm; xz: { x: number; z: number }; y0: number };
  const nodes: Node[] = [];
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const segs = Math.max(1, Math.ceil(len / stepMm));
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      const plan = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const xz = planToWorldXZ(plan);
      nodes.push({
        plan,
        xz,
        y0: planGradeY(plan, patios, gradeSamples) - bottomInsetM,
      });
    }
  }
  if (nodes.length < 2) return;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const b = nodes[(i + 1) % nodes.length];
    const dx = b.xz.x - a.xz.x;
    const dz = b.xz.z - a.xz.z;
    const edge = Math.hypot(dx, dz);
    if (edge < 1e-4) continue;
    const y1a = a.y0 + heightM;
    const y1b = b.y0 + heightM;
    const u0 = i * 0.45;
    const u1 = u0 + edge;
    const base = into.positions.length / 3;
    const verts = inward
      ? [
          [a.xz.x, a.y0, a.xz.z, u0, 0],
          [b.xz.x, b.y0, b.xz.z, u1, 0],
          [b.xz.x, y1b, b.xz.z, u1, heightM],
          [a.xz.x, y1a, a.xz.z, u0, heightM],
        ]
      : [
          [b.xz.x, b.y0, b.xz.z, u1, 0],
          [a.xz.x, a.y0, a.xz.z, u0, 0],
          [a.xz.x, y1a, a.xz.z, u0, heightM],
          [b.xz.x, y1b, b.xz.z, u1, heightM],
        ];
    for (const v of verts) {
      into.positions.push(v[0], v[1], v[2]);
      into.uvs.push(v[3], v[4]);
    }
    into.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
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
  if (a.kind === "gate" && b.kind === "gate") {
    return a.id === b.id && a.fenceId === b.fenceId;
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

function flipTriWindingIfNeeded(
  positions: number[],
  indices: number[],
  wantY: "up" | "out",
  outX = 0,
  outZ = 0,
) {
  if (indices.length < 3) return;
  const ia = indices[0]!;
  const ib = indices[1]!;
  const ic = indices[2]!;
  const ax = positions[ia * 3]!;
  const ay = positions[ia * 3 + 1]!;
  const az = positions[ia * 3 + 2]!;
  const bx = positions[ib * 3]!;
  const by = positions[ib * 3 + 1]!;
  const bz = positions[ib * 3 + 2]!;
  const cx = positions[ic * 3]!;
  const cy = positions[ic * 3 + 1]!;
  const cz = positions[ic * 3 + 2]!;
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  const bad =
    wantY === "up" ? ny < 0 : nx * outX + nz * outZ < 0;
  if (!bad) return;
  for (let i = 0; i < indices.length; i += 3) {
    const t = indices[i + 1]!;
    indices[i + 1] = indices[i + 2]!;
    indices[i + 2] = t;
  }
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

/**
 * Infinity / vanishing edge 3D — same idea as spa spillover:
 *  - Weir shell stops below the waterline so it does not cap the spill.
 *  - Upper rim, coping, and waterline omit the weir edge entirely.
 *  - Deck/fill is slotted through the trough (no wrap-around box wall).
 *  - Water sheets over the crest into the trough.
 * Nothing at deck height (pavers, coping, retaining) is drawn on the weir.
 */
function pushInfinityEdgeMeshes(
  meshes: MeshDescriptor[],
  opts: {
    poolId: string;
    edges: ResolvedInfinityEdge[];
    crestY: number;
    floorY: number;
    wallThicknessMm: number;
    select: SceneSelection;
  },
) {
  if (!opts.edges.length) return;

  const pushWall = (
    id: string,
    a: PointMm,
    b: PointMm,
    toward: { x: number; y: number },
    thicknessMm: number,
    bottomY: number,
    topY: number,
  ) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 40) return;
    const tx = (b.x - a.x) / len;
    const ty = (b.y - a.y) / len;
    const nLen = Math.hypot(toward.x, toward.y) || 1;
    const nx = toward.x / nLen;
    const ny = toward.y / nLen;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const center = {
      x: mid.x + nx * (thicknessMm / 2),
      y: mid.y + ny * (thicknessMm / 2),
    };
    const xz = planToWorldXZ(center);
    const h = Math.max(0.04, topY - bottomY);
    meshes.push({
      kind: "box",
      id,
      material: "poolShell",
      position: { x: xz.x, y: bottomY + h / 2, z: xz.z },
      size: {
        x: mmToMeters(len),
        y: h,
        z: mmToMeters(thicknessMm),
      },
      rotationY: 0,
      axisX: planDirToWorldXZ(tx, ty),
      axisZ: planDirToWorldXZ(nx, ny),
      select: opts.select,
    });
  };

  const weirT = Math.max(80, opts.wallThicknessMm);
  const sillTop = opts.crestY - 0.08;

  for (const edge of opts.edges) {
    const weirA = edge.edgeA ?? edge.a;
    const weirB = edge.edgeB ?? edge.b;
    const outer = infinityTroughOuterSpan(edge);
    const troughPoly = closeOutline(infinityTroughPolygon(edge));
    if (troughPoly.length < 4) continue;

    const troughDepthM = mmToMeters(edge.troughDepthMm);
    const troughWaterM = mmToMeters(edge.troughWaterDepthMm);
    const troughBottom = -troughDepthM;
    const floorT = 0.12;

    // Weir sill stays below the waterline so it does not cap the spill.
    if (sillTop > opts.floorY + 0.05) {
      pushWall(
        `pool_${opts.poolId}_weirsill_${edge.edgeIndex}`,
        weirA,
        weirB,
        { x: -edge.nx, y: -edge.ny },
        weirT,
        opts.floorY,
        sillTop,
      );
    }

    meshes.push({
      kind: "extrude",
      id: `pool_${opts.poolId}_troughfloor_${edge.edgeIndex}`,
      material: "poolShell",
      outlineMm: troughPoly,
      bottomY: troughBottom,
      height: floorT,
      select: opts.select,
    });

    const waterPoly = [
      {
        x: weirA.x + edge.nx * 20,
        y: weirA.y + edge.ny * 20,
      },
      {
        x: weirB.x + edge.nx * 20,
        y: weirB.y + edge.ny * 20,
      },
      outer.b,
      outer.a,
    ];
    const waterTop = troughBottom + Math.max(0.12, troughWaterM * 0.45);
    const waterBottom = troughBottom + floorT + 0.01;
    const waterH = Math.max(0.05, waterTop - waterBottom);
    meshes.push({
      kind: "extrude",
      id: `pool_${opts.poolId}_troughwater_${edge.edgeIndex}`,
      material: "poolWater",
      outlineMm: closeOutline(waterPoly),
      bottomY: waterBottom,
      height: waterH,
      opacity: 0.55,
      select: opts.select,
    });

    for (let oi = 0; oi < edge.openings.length; oi++) {
      const opening = edge.openings[oi];
      const len = Math.hypot(
        opening.b.x - opening.a.x,
        opening.b.y - opening.a.y,
      );
      if (len < 40) continue;
      const n = Math.max(3, Math.ceil(len / 80));
      const crest: Array<{ x: number; y: number; nx: number; ny: number }> = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        crest.push({
          x: opening.a.x + (opening.b.x - opening.a.x) * t,
          y: opening.a.y + (opening.b.y - opening.a.y) * t,
          nx: edge.nx,
          ny: edge.ny,
        });
      }
      const drop = Math.max(0.12, opts.crestY - waterTop);
      meshes.push({
        kind: "spilloverRibbon",
        id: `pool_${opts.poolId}_inffall_${edge.edgeIndex}_${oi}`,
        material: "spilloverWater",
        crest,
        crestY: opts.crestY + 0.002,
        poolWaterY: waterTop + 0.01,
        flareM: Math.max(0.12, Math.min(0.38, drop * 0.85)),
        lipTuckM: 0.02,
        opacity: edge.style === "sheer" ? 0.5 : 0.78,
        select: opts.select,
      });
    }
  }
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
    /**
     * Omit intervals along specific outline edges (edge index → mm ranges
     * from edge start). Used for spa spillover weir notches.
     */
    edgeOmits?: { edgeIndex: number; intervals: [number, number][] }[];
    /** If set, only emit these outline edge indexes. */
    onlyEdgeIndexes?: number[];
    /**
     * Also omit any wall segment that is colinear with these weir openings
     * (indexes don't have to match — used for infinity edges / inset rings).
     */
    omitAgainst?: { a: PointMm; b: PointMm }[];
    /** Waterline tile finish (material === "waterline"). */
    waterlineTileId?: string;
    /**
     * Extra shift along the thickness normal (mm). Positive = further in the
     * thickness direction. Use a small negative bias on waterline veneers so
     * they sit slightly proud of the shell and avoid z-fighting.
     */
    normalBiasMm?: number;
  },
) {
  const pts = ringPoints(
    opts.edgeOmits?.length ||
      opts.omitAgainst?.length ||
      opts.onlyEdgeIndexes?.length
      ? opts.outlineMm
      : flattenClosedOutline(opts.outlineMm),
  );
  if (pts.length < 3) return;
  const thickM = mmToMeters(opts.thicknessMm);
  const biasMm = opts.normalBiasMm ?? 0;
  const only =
    opts.onlyEdgeIndexes && opts.onlyEdgeIndexes.length > 0
      ? new Set(opts.onlyEdgeIndexes)
      : null;
  let segIndex = 0;
  for (let i = 0; i < pts.length; i++) {
    if (only && !only.has(i)) continue;
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    let segments =
      opts.openAgainst && opts.openAgainst.length > 0
        ? openWallSegments(a, b, opts.openAgainst)
        : Math.hypot(b.x - a.x, b.y - a.y) >= 40
          ? [{ a, b }]
          : [];
    const edgeLenMm = Math.hypot(b.x - a.x, b.y - a.y);
    let skipWeirEdge = false;
    for (const weir of opts.omitAgainst ?? []) {
      const iv = colinearOverlapInterval(a, b, weir.a, weir.b, 320);
      if (iv && iv[1] - iv[0] > edgeLenMm * 0.35) {
        skipWeirEdge = true;
        break;
      }
    }
    if (skipWeirEdge) continue;
    const omit = opts.edgeOmits?.find((o) => o.edgeIndex === i);
    const geoOmits: [number, number][] = [];
    for (const weir of opts.omitAgainst ?? []) {
      const iv = colinearOverlapInterval(a, b, weir.a, weir.b, 320);
      if (iv) geoOmits.push(iv);
    }
    const intervals = [...(omit?.intervals ?? []), ...geoOmits];
    if (intervals.length > 0) {
      // Notch against the full edge, then keep only pieces that remain in
      // the openAgainst result (usually the full edge for spa shells).
      const notched = wallSegmentsMinusIntervals(a, b, intervals);
      if (!opts.openAgainst?.length) {
        segments = notched;
      } else {
        segments = notched.filter((n) =>
          segments.some((s) => {
            const mid = {
              x: (n.a.x + n.b.x) / 2,
              y: (n.a.y + n.b.y) / 2,
            };
            const d0 = Math.hypot(mid.x - s.a.x, mid.y - s.a.y);
            const d1 = Math.hypot(mid.x - s.b.x, mid.y - s.b.y);
            const span = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
            return d0 + d1 <= span + 2;
          }),
        );
      }
    }
    if (opts.openAgainst?.length) {
      segments = segments.filter(
        (s) =>
          !opts.openAgainst!.some((poly) =>
            segmentHitsFootprint(s.a, s.b, poly, 0),
          ),
      );
    }
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
        x: mid.x + nx * (opts.thicknessMm / 2 + biasMm),
        y: mid.y + ny * (opts.thicknessMm / 2 + biasMm),
      };
      if (
        opts.openAgainst?.some(
          (poly) =>
            pointInPolygon(mid, poly) ||
            pointInPolygon(centerPlan, poly) ||
            distToPolygonBoundaryMm(mid, poly) <= 40,
        )
      ) {
        continue;
      }
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
        waterlineTileId: opts.waterlineTileId,
        select: opts.select,
      });
    }
  }
}

/** ~6″ waterline tile veneer on the wet face of a basin / ledge. */
function pushWaterlineTileBand(
  meshes: MeshDescriptor[],
  opts: {
    /** Inside / waterline outline (not the outer shell). */
    waterlineOutlineMm: PointMm[];
    wallThicknessMm: number;
    waterTopY: number;
    waterlineTileId?: string;
    select: SceneSelection;
    idPrefix: string;
    openAgainst?: PointMm[][];
    edgeOmits?: { edgeIndex: number; intervals: [number, number][] }[];
    omitAgainst?: { a: PointMm; b: PointMm }[];
  },
) {
  if (opts.waterlineOutlineMm.length < 3) return;
  const tileH = mmToMeters(152); // 6″
  const veneerMm = Math.min(
    Math.max(28, opts.wallThicknessMm * 0.22),
    Math.max(40, opts.wallThicknessMm * 0.45),
  );
  pushWallRing(meshes, {
    outlineMm: opts.waterlineOutlineMm,
    bottomY: opts.waterTopY - tileH * 0.92,
    height: tileH,
    thicknessMm: veneerMm,
    material: "waterline",
    waterlineTileId: opts.waterlineTileId,
    select: opts.select,
    idPrefix: opts.idPrefix,
    // Grow from waterline into the shell so the face reads underwater.
    inward: false,
    openAgainst: opts.openAgainst,
    edgeOmits: opts.edgeOmits,
    omitAgainst: opts.omitAgainst,
    // Slightly proud of the plaster so the tile wins depth tests.
    normalBiasMm: -6,
  });
}

/**
 * Flat ~6″ tile strip on the TOP of a tread / sunshelf along one edge.
 * Marks the nosing — not a full vertical riser wrap.
 */
function pushTopEdgeTileBand(
  meshes: MeshDescriptor[],
  opts: {
    a: PointMm;
    b: PointMm;
    /** Unit plan direction from the edge into the tread/shelf surface. */
    inwardX: number;
    inwardY: number;
    bandWidthMm: number;
    topY: number;
    /** Vertical thickness of the band (proud of the surface). */
    thicknessM?: number;
    waterlineTileId?: string;
    select: SceneSelection;
    id: string;
  },
) {
  const edgeLen = Math.hypot(opts.b.x - opts.a.x, opts.b.y - opts.a.y);
  if (edgeLen < 40) return;
  const tx = (opts.b.x - opts.a.x) / edgeLen;
  const ty = (opts.b.y - opts.a.y) / edgeLen;
  let ix = opts.inwardX;
  let iy = opts.inwardY;
  const il = Math.hypot(ix, iy) || 1;
  ix /= il;
  iy /= il;
  const bandMm = Math.max(40, opts.bandWidthMm);
  const thickM = opts.thicknessM ?? 0.016;
  const mid = {
    x: (opts.a.x + opts.b.x) / 2 + ix * (bandMm / 2),
    y: (opts.a.y + opts.b.y) / 2 + iy * (bandMm / 2),
  };
  const xz = planToWorldXZ(mid);
  meshes.push({
    kind: "box",
    id: opts.id,
    material: "waterline",
    position: {
      x: xz.x,
      y: opts.topY + thickM * 0.5 + 0.003,
      z: xz.z,
    },
    size: {
      x: mmToMeters(edgeLen),
      y: thickM,
      z: mmToMeters(bandMm),
    },
    rotationY: 0,
    axisX: planDirToWorldXZ(tx, ty),
    // Local Z = band depth into the tread/shelf.
    axisZ: planDirToWorldXZ(ix, iy),
    waterlineTileId: opts.waterlineTileId,
    select: opts.select,
  });
}

/** Perimeter nosing bands on the top face of a sunshelf / ledge. */
function pushShelfTopTileBands(
  meshes: MeshDescriptor[],
  opts: {
    outlineMm: PointMm[];
    topY: number;
    bandWidthMm: number;
    waterlineTileId?: string;
    select: SceneSelection;
    idPrefix: string;
  },
) {
  const pts = ringPoints(flattenClosedOutline(opts.outlineMm));
  if (pts.length < 3) return;
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pushTopEdgeTileBand(meshes, {
      a,
      b,
      inwardX: cx - mid.x,
      inwardY: cy - mid.y,
      bandWidthMm: opts.bandWidthMm,
      topY: opts.topY,
      waterlineTileId: opts.waterlineTileId,
      select: opts.select,
      id: `${opts.idPrefix}_${i}`,
    });
  }
}

const BASIN_FLOOR_THICKNESS_M = 0.14;

/** Prefer cascade normal pointing toward the pool (outside the spa). */
function cascadeOutwardNormal(
  openingA: PointMm,
  openingB: PointMm,
  spaOutline: PointMm[],
): { nx: number; ny: number } {
  const len = Math.hypot(openingB.x - openingA.x, openingB.y - openingA.y) || 1;
  const tx = (openingB.x - openingA.x) / len;
  const ty = (openingB.y - openingA.y) / len;
  let nx = -ty;
  let ny = tx;
  const mid = {
    x: (openingA.x + openingB.x) / 2,
    y: (openingA.y + openingB.y) / 2,
  };
  const probe = { x: mid.x + nx * 80, y: mid.y + ny * 80 };
  if (pointInPolygon(probe, spaOutline)) {
    nx = -nx;
    ny = -ny;
  }
  return { nx, ny };
}

type CrestSample = { x: number; y: number; nx: number; ny: number };

function pushCrestSample(
  out: CrestSample[],
  sample: CrestSample,
  minDistMm = 8,
) {
  const last = out[out.length - 1];
  if (
    last &&
    Math.hypot(sample.x - last.x, sample.y - last.y) < minDistMm
  ) {
    // Keep the freshest normal at near-duplicates (important at corners).
    last.nx = sample.nx;
    last.ny = sample.ny;
    last.x = sample.x;
    last.y = sample.y;
    return;
  }
  out.push(sample);
}

function pushCrestSegment(
  out: CrestSample[],
  a: PointMm,
  b: PointMm,
  nx: number,
  ny: number,
  lipOffsetMm: number,
  spacingMm: number,
) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 20) return;
  const n = Math.max(2, Math.ceil(len / spacingMm));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pushCrestSample(out, {
      x: a.x + (b.x - a.x) * t + nx * lipOffsetMm,
      y: a.y + (b.y - a.y) * t + ny * lipOffsetMm,
      nx,
      ny,
    });
  }
}

/** Walk the lip from the current crest tip to a target sample so gaps close. */
function pushCrestBridge(
  out: CrestSample[],
  target: CrestSample,
  spacingMm: number,
) {
  const last = out[out.length - 1];
  if (!last) {
    out.push(target);
    return;
  }
  const len = Math.hypot(target.x - last.x, target.y - last.y);
  if (len < 8) {
    pushCrestSample(out, target, 0);
    return;
  }
  const steps = Math.max(1, Math.ceil(len / spacingMm));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const nx = last.nx + (target.nx - last.nx) * t;
    const ny = last.ny + (target.ny - last.ny) * t;
    const nLen = Math.hypot(nx, ny) || 1;
    pushCrestSample(out, {
      x: last.x + (target.x - last.x) * t,
      y: last.y + (target.y - last.y) * t,
      nx: nx / nLen,
      ny: ny / nLen,
    });
  }
}

function pushCrestCornerArc(
  out: CrestSample[],
  vertex: PointMm,
  n0: { nx: number; ny: number },
  n1: { nx: number; ny: number },
  lipOffsetMm: number,
  spacingMm: number,
) {
  let ang0 = Math.atan2(n0.ny, n0.nx);
  let ang1 = Math.atan2(n1.ny, n1.nx);
  let dAng = ang1 - ang0;
  while (dAng > Math.PI) dAng -= Math.PI * 2;
  while (dAng < -Math.PI) dAng += Math.PI * 2;
  if (Math.abs(dAng) < 1e-3) dAng = Math.PI / 2;
  if (Math.abs(dAng) > Math.PI * 0.95) {
    dAng = dAng > 0 ? dAng - Math.PI * 2 : dAng + Math.PI * 2;
  }

  // Close any leftover gap from the straight weir into the corner lip.
  pushCrestBridge(
    out,
    {
      x: vertex.x + n0.nx * lipOffsetMm,
      y: vertex.y + n0.ny * lipOffsetMm,
      nx: n0.nx,
      ny: n0.ny,
    },
    spacingMm,
  );

  const arcLen = Math.abs(dAng) * lipOffsetMm;
  const steps = Math.max(10, Math.ceil(Math.max(arcLen, 1) / Math.max(40, spacingMm * 0.55)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ang = ang0 + dAng * t;
    const nx = Math.cos(ang);
    const ny = Math.sin(ang);
    pushCrestSample(out, {
      x: vertex.x + nx * lipOffsetMm,
      y: vertex.y + ny * lipOffsetMm,
      nx,
      ny,
    });
  }
}

/**
 * Order sheet-style spills into contiguous chains around the spa ring, then
 * emit one continuous crest ribbon per chain (straight runs + corner arcs).
 * Scuppers stay as discrete box cascades.
 */
function pushSpaSpilloverWater(
  meshes: MeshDescriptor[],
  opts: {
    spills: ResolvedSpaSpillover[];
    spaOutline: PointMm[];
    crestY: number;
    poolWaterTopY: number;
    wallThicknessMm: number;
    select: SceneSelection;
    idPrefix: string;
  },
) {
  if (!opts.spills.length) return;
  const pts = ringPoints(opts.spaOutline);
  const n = pts.length;
  if (n < 3) return;

  // `spaOutline` is the outer shell face. Keep the crest on that lip (slight
  // tuck inward so the sheet overlaps the coping) instead of floating out.
  const lipOffsetMm = Math.max(2, Math.min(8, opts.wallThicknessMm * 0.04));
  const spacingMm = 55;
  const topY = opts.crestY - 0.004;
  const bottomY = opts.poolWaterTopY + 0.004;
  const drop = Math.max(0.05, topY - bottomY);
  const flareM = Math.max(0.1, Math.min(0.34, drop * 0.95));
  const sheetOpacity = opts.spills[0]?.style === "sheer" ? 0.55 : 0.78;

  // Discrete scuppers keep the old per-opening boxes.
  const scupperSpills = opts.spills.filter((s) => s.style === "scuppers");
  for (const spill of scupperSpills) {
    pushSpilloverCascades(meshes, {
      spill,
      spaOutline: opts.spaOutline,
      crestY: opts.crestY,
      poolWaterTopY: opts.poolWaterTopY,
      wallThicknessMm: opts.wallThicknessMm,
      select: opts.select,
      idPrefix: `${opts.idPrefix}_scup_e${spill.edgeIndex}`,
    });
  }

  const sheetSpills = opts.spills.filter((s) => s.style !== "scuppers");
  if (!sheetSpills.length) return;

  const byEdge = new Map(sheetSpills.map((s) => [s.edgeIndex, s]));
  const visited = new Set<number>();
  let ribbonIdx = 0;

  const openingAlongEdge = (
    spill: ResolvedSpaSpillover,
  ): { a: PointMm; b: PointMm; nx: number; ny: number } | null => {
    const opening = spill.openings[0] ?? { a: spill.a, b: spill.b };
    const len = Math.hypot(opening.b.x - opening.a.x, opening.b.y - opening.a.y);
    if (len < 40) return null;
    const { nx, ny } = cascadeOutwardNormal(
      opening.a,
      opening.b,
      opts.spaOutline,
    );
    // Orient a→b to match spa ring direction (edgeA → edgeB).
    const edgeA = pts[spill.edgeIndex];
    const edgeB = pts[(spill.edgeIndex + 1) % n];
    const ex = edgeB.x - edgeA.x;
    const ey = edgeB.y - edgeA.y;
    const ox = opening.b.x - opening.a.x;
    const oy = opening.b.y - opening.a.y;
    if (ex * ox + ey * oy < 0) {
      return { a: opening.b, b: opening.a, nx, ny };
    }
    return { a: opening.a, b: opening.b, nx, ny };
  };

  for (const start of sheetSpills) {
    if (visited.has(start.edgeIndex)) continue;

    // Walk backward to chain start.
    let head = start.edgeIndex;
    for (;;) {
      const prev = (head - 1 + n) % n;
      if (!byEdge.has(prev) || visited.has(prev)) break;
      head = prev;
      if (head === start.edgeIndex) break;
    }

    const chain: ResolvedSpaSpillover[] = [];
    let cur = head;
    for (;;) {
      const spill = byEdge.get(cur);
      if (!spill || visited.has(cur)) break;
      visited.add(cur);
      chain.push(spill);
      const next = (cur + 1) % n;
      if (!byEdge.has(next)) break;
      cur = next;
      if (cur === head) break;
    }

    const crest: CrestSample[] = [];
    for (let i = 0; i < chain.length; i++) {
      const spill = chain[i];
      const seg = openingAlongEdge(spill);
      if (!seg) continue;
      // After a corner arc, close into this run's start before sampling it.
      if (crest.length) {
        pushCrestBridge(
          crest,
          {
            x: seg.a.x + seg.nx * lipOffsetMm,
            y: seg.a.y + seg.ny * lipOffsetMm,
            nx: seg.nx,
            ny: seg.ny,
          },
          spacingMm,
        );
      }
      pushCrestSegment(
        crest,
        seg.a,
        seg.b,
        seg.nx,
        seg.ny,
        lipOffsetMm,
        spacingMm,
      );
      const nextSpill = chain[i + 1];
      if (!nextSpill) continue;
      const nextSeg = openingAlongEdge(nextSpill);
      if (!nextSeg) continue;
      const corner = pts[nextSpill.edgeIndex];
      pushCrestCornerArc(
        crest,
        corner,
        { nx: seg.nx, ny: seg.ny },
        { nx: nextSeg.nx, ny: nextSeg.ny },
        lipOffsetMm,
        spacingMm,
      );
    }

    if (crest.length < 3) {
      // Fallback: emit per-edge boxes if ribbon failed.
      for (const spill of chain) {
        pushSpilloverCascades(meshes, {
          spill,
          spaOutline: opts.spaOutline,
          crestY: opts.crestY,
          poolWaterTopY: opts.poolWaterTopY,
          wallThicknessMm: opts.wallThicknessMm,
          select: opts.select,
          idPrefix: `${opts.idPrefix}_e${spill.edgeIndex}`,
        });
      }
      continue;
    }

    meshes.push({
      kind: "spilloverRibbon",
      id: `${opts.idPrefix}_ribbon_${ribbonIdx++}`,
      material: "spilloverWater",
      crest,
      crestY: topY,
      poolWaterY: bottomY,
      flareM,
      lipTuckM: 0.028,
      opacity: sheetOpacity,
      select: opts.select,
    });
  }
}

/** Thin cascading water sheets / scuppers from spa weir down to pool water. */
function pushSpilloverCascades(
  meshes: MeshDescriptor[],
  opts: {
    spill: ResolvedSpaSpillover;
    spaOutline: PointMm[];
    crestY: number;
    poolWaterTopY: number;
    wallThicknessMm: number;
    select: SceneSelection;
    idPrefix: string;
  },
) {
  const drop = Math.max(0.05, opts.crestY - opts.poolWaterTopY);
  const sheetThickMm =
    opts.spill.style === "sheer"
      ? 12
      : opts.spill.style === "scuppers"
        ? 28
        : 18;
  // Hang just outside the spa outer face; the mesh flares further out as it falls.
  const outwardMm = Math.max(10, opts.wallThicknessMm * 0.12) + sheetThickMm * 0.25;

  let i = 0;
  for (const opening of opts.spill.openings) {
    const len = Math.hypot(
      opening.b.x - opening.a.x,
      opening.b.y - opening.a.y,
    );
    if (len < 40) continue;
    const tx = (opening.b.x - opening.a.x) / len;
    const ty = (opening.b.y - opening.a.y) / len;
    const { nx, ny } = cascadeOutwardNormal(
      opening.a,
      opening.b,
      opts.spaOutline,
    );
    const mid = {
      x: (opening.a.x + opening.b.x) / 2,
      y: (opening.a.y + opening.b.y) / 2,
    };
    const centerPlan = {
      x: mid.x + nx * outwardMm,
      y: mid.y + ny * outwardMm,
    };
    const xz = planToWorldXZ(centerPlan);
    // Leave a hair of air under the rim so the sheet reads as pouring over.
    const topY = opts.crestY - 0.008;
    const bottomY = opts.poolWaterTopY + 0.004;
    const ribbonH = Math.max(0.04, topY - bottomY);
    const widthM = mmToMeters(len);
    const thickM = mmToMeters(sheetThickMm);
    meshes.push({
      kind: "box",
      id: `${opts.idPrefix}_cascade_${i++}`,
      material: "spilloverWater",
      position: {
        x: xz.x,
        y: bottomY + ribbonH / 2,
        z: xz.z,
      },
      size: {
        x: widthM,
        y: ribbonH,
        z: thickM,
      },
      rotationY: 0,
      axisX: planDirToWorldXZ(tx, ty),
      axisZ: planDirToWorldXZ(nx, ny),
      opacity: opts.spill.style === "sheer" ? 0.55 : 0.72,
      select: opts.select,
    });
  }
}

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
 * Niche light depth below freeboard (meters).
 * Jandy / industry guides: 9–12″ uniform on main walls; ~4″ on sunshelves;
 * ~18–24″ only in very deep basins. Spa lights sit below the bench / footwell.
 */
const LIGHT_BELOW_WATER_MAIN_M = 0.279; // 11″
const LIGHT_BELOW_WATER_SHELF_M = 0.102; // 4″
const LIGHT_BELOW_WATER_DEEP_M = 0.508; // 20″ when local water > ~10′

/** World Y for a wall niche light given freeboard + local floor. */
function nicheLightCenterY(
  waterTopY: number,
  floorY: number,
  opts?: { onShelf?: boolean },
): number {
  const waterDepth = Math.max(0.05, waterTopY - floorY);
  let below = LIGHT_BELOW_WATER_MAIN_M;
  if (opts?.onShelf || waterDepth < 0.5) {
    // Sunshelf / very shallow water: 4″ under waterline (Jandy).
    below = LIGHT_BELOW_WATER_SHELF_M;
  } else if (waterDepth > 3.05) {
    // Very deep end (>~10′): drop a bit further for coverage.
    below = LIGHT_BELOW_WATER_DEEP_M;
  }
  const target = waterTopY - below;
  // Keep the fixture in the water column with a little floor / surface clearance.
  const minY = floorY + 0.06;
  const maxY = waterTopY - 0.06;
  return Math.min(maxY, Math.max(minY, target));
}

function isWallFacingCatalogId(id: string): boolean {
  return (
    id === "spa_jet" ||
    id === "pool_return" ||
    id === "pool_skimmer" ||
    id.startsWith("light_")
  );
}

/**
 * Vertical center for in-water fixtures so they sit on the floor or wall
 * instead of the deck plane. Returns null for dry-deck / pad equipment.
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
  const isReturn = id === "pool_return";
  const isLight = id.startsWith("light_");
  const isSpaBubbler = id === "spa_bubbler";
  const isPoolBubbler = id === "pool_bubbler";
  const isDrain = id === "spa_drain" || id === "pool_drain";
  const isSkimmer = id === "pool_skimmer";
  if (
    !isJet &&
    !isReturn &&
    !isLight &&
    !isSpaBubbler &&
    !isPoolBubbler &&
    !isDrain &&
    !isSkimmer
  ) {
    return null;
  }

  const parentId = obj.parentBodyId;
  const spa =
    (parentId
      ? opts.spas.find((s) => s.id === parentId)
      : undefined) ??
    opts.spas.find((s) => pointInPolygon(obj.position, s.outline));

  if (spa && (isJet || isLight || isSpaBubbler || id === "spa_drain")) {
    const joinsPool = opts.pools.some((p) =>
      waterBodiesConnected(p.outline, spa.outline),
    );
    const elev = spaElevations(spa, opts.poolWaterTopY, joinsPool);
    const waterDepth = elev.waterTopY - elev.floorY;
    if (isSpaBubbler || id === "spa_drain") {
      // Floor fixtures sit just above the basin floor.
      return elev.floorY + (id === "spa_drain" ? 0.012 : 0.028);
    }
    if (isLight) {
      // Spa niche lights: below the bench / in the footwell (~lower third).
      const y = elev.floorY + waterDepth * 0.32;
      return Math.min(
        elev.waterTopY - 0.15,
        Math.max(elev.floorY + 0.1, y),
      );
    }
    // Wall jet: mid-water, always below the surface.
    const y = elev.floorY + waterDepth * 0.55;
    return Math.min(
      elev.waterTopY - 0.09,
      Math.max(elev.floorY + 0.12, y),
    );
  }

  const onShelf = opts.features.some(
    (f) =>
      f.kind === "sunshelf" &&
      f.outline.length >= 3 &&
      pointInPolygon(obj.position, f.outline),
  );

  // Floor bubblers on a sunshelf sit on the ledge — not wall lights/jets.
  if (isPoolBubbler && onShelf) {
    const shelf = opts.features.find(
      (f) =>
        f.kind === "sunshelf" &&
        f.outline.length >= 3 &&
        pointInPolygon(obj.position, f.outline),
    )!;
    const shelfTop =
      opts.poolWaterTopY -
      mmToMeters(featureDepthMm("sunshelf", shelf.depthMm));
    return Math.min(opts.poolWaterTopY - 0.05, shelfTop + 0.022);
  }

  const wallLike = isJet || isReturn || isLight || isSkimmer;
  const pool =
    (parentId
      ? opts.pools.find((p) => p.id === parentId)
      : undefined) ??
    opts.pools.find((p) => pointInPolygon(obj.position, p.outline)) ??
    // Wall fixtures sit just inside the shell — still associate with nearest pool.
    (wallLike
      ? opts.pools.find((p) => waterBodyKind(p) !== "spa")
      : undefined);
  if (pool && waterBodyKind(pool) !== "spa") {
    const profile = depthProfileForBody(pool);
    const t = depthTAtPlanPoint(
      obj.position,
      profile.originMm,
      profile.axis,
      profile.axisLengthMm,
    );
    const floorY = -mmToMeters(depthMmAtT(profile.stations, t));
    if (isPoolBubbler || id === "pool_drain") {
      return Math.min(opts.poolWaterTopY - 0.04, floorY + 0.01);
    }
    if (isSkimmer) {
      // Weir mouth straddles the operating waterline.
      return opts.poolWaterTopY;
    }
    if (isLight) {
      const nearShelf = opts.features.some(
        (f) =>
          f.kind === "sunshelf" &&
          f.outline.length >= 3 &&
          (() => {
            const b = outlineBounds(f.outline);
            const dx = Math.max(b.minX - obj.position.x, 0, obj.position.x - b.maxX);
            const dy = Math.max(b.minY - obj.position.y, 0, obj.position.y - b.maxY);
            return Math.hypot(dx, dy) < 600;
          })(),
      );
      return nicheLightCenterY(opts.poolWaterTopY, floorY, {
        onShelf: onShelf || nearShelf,
      });
    }
    if (isReturn) {
      // Wall return ~12″ below waterline, clear of the floor.
      return Math.min(
        opts.poolWaterTopY - 0.12,
        Math.max(floorY + 0.14, opts.poolWaterTopY - 0.305),
      );
    }
    // Wall jet: mid-water for the local depth.
    const waterDepth = opts.poolWaterTopY - floorY;
    const y = floorY + waterDepth * 0.45;
    return Math.min(
      opts.poolWaterTopY - 0.12,
      Math.max(floorY + 0.15, y),
    );
  }

  if (id === "pool_drain") return opts.poolWaterTopY - 1.2;
  if (isSkimmer) return opts.poolWaterTopY;
  if (isReturn) return opts.poolWaterTopY - 0.305;
  if (isLight) return opts.poolWaterTopY - LIGHT_BELOW_WATER_MAIN_M;
  return opts.poolWaterTopY - 0.18;
}

function sunshelfSurfaceY(
  position: PointMm,
  features: {
    kind: string;
    outline: PointMm[];
    depthMm?: number;
  }[],
  poolWaterTopY: number,
): number | null {
  const shelf = features.find(
    (f) =>
      f.kind === "sunshelf" &&
      f.outline.length >= 3 &&
      pointInPolygon(position, f.outline),
  );
  if (!shelf) return null;
  return (
    poolWaterTopY - mmToMeters(featureDepthMm("sunshelf", shelf.depthMm))
  );
}

function coverAccessoryCenterY(
  position: PointMm,
  catalogItemId: string,
  heightM: number,
  covers: PatioCover[],
): number | null {
  if (!isCoverAccessoryId(catalogItemId)) return null;
  const h = Math.max(0.08, heightM);
  let cover =
    covers.find(
      (c) => c.outline.length >= 3 && pointInPolygon(position, c.outline),
    ) ?? null;
  if (!cover) {
    let best: { c: PatioCover; d: number } | null = null;
    for (const c of covers) {
      if (c.outline.length < 3) continue;
      const d = distToPolygonBoundaryMm(position, c.outline);
      if (!best || d < best.d) best = { c, d };
    }
    if (best && best.d < 2500) cover = best.c;
  }
  const top = mmToMeters(
    coverHeightMm(
      cover?.kind === "roof" ? "roof" : "pergola",
      cover?.heightMm,
    ),
  );
  const slab = mmToMeters(COVER_SLAB_THICKNESS_MM);
  const hang = catalogItemId === "cover_fan" ? 0.06 : 0.1;
  return top - slab - hang - h / 2;
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
  const bb = outlineBounds(opts.outlineMm);
  const depthMm = Math.max(150, volumeH * 1000);
  meshes.push({
    kind: "waterBody",
    id: `${opts.idPrefix}_body`,
    material: opts.waterMaterial,
    outlineMm: outline,
    waterTopY: waterTop,
    basinFloorY: floorTop,
    depthStations: [
      { t: 0, depthMm, transition: "smooth" as const },
      { t: 1, depthMm, transition: "smooth" as const },
    ],
    depthAxis: { x: 1, y: 0 },
    axisOriginMm: { x: bb.minX, y: bb.minY },
    axisLengthMm: Math.max(1, bb.width),
    opacity: 0.22,
    surfaceOpacity: 0.56,
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
    sideOutlineMm?: PointMm[];
    sideOpenAgainst?: PointMm[][];
    omitSides?: boolean;
    shallowFootprints?: { outlineMm: PointMm[]; depthMm: number }[];
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
    sideOutlineMm: opts.sideOutlineMm,
    sideOpenAgainst: opts.sideOpenAgainst,
    omitSides: opts.omitSides,
    shallowFootprints: opts.shallowFootprints,
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

function isSliverOutline(outline: PointMm[], minSpanMm = 250): boolean {
  if (outline.length < 3) return true;
  const bb = outlineBounds(outline);
  // Drop specks only. A long thin remainder (shared patio seam) must stay.
  return bb.width < minSpanMm && bb.height < minSpanMm;
}

/** Close grass seams between overlapping / nearly touching patio slabs. */
const PATIO_SEAM_PAD_MM = 200;

type PatioSlabCluster = {
  id: string;
  outline: PointMm[];
  materialId?: string;
};

function clusterPatioSlabs(
  patios: Array<{ id: string; outline: PointMm[]; materialId?: string }>,
): PatioSlabCluster[] {
  const clusters: PatioSlabCluster[] = patios
    .filter((p) => (p.outline?.length ?? 0) >= 3)
    .map((p) => ({
      id: p.id,
      outline: p.outline,
      materialId: p.materialId,
    }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (
          !outlinesAabbTouch(
            clusters[i].outline,
            clusters[j].outline,
            PATIO_SEAM_PAD_MM,
          )
        ) {
          continue;
        }
        const a = clusters[i];
        const b = clusters[j];
        const union = aabbUnionRing(a.outline, b.outline);
        // Two pads wrapping a house share a big AABB. The bbox union would
        // fill the interior with deck. Keep them separate in that case.
        if (aabbUnionFillsCourtyard(a.outline, b.outline, union)) {
          continue;
        }
        const ba = outlineBounds(a.outline);
        const bb = outlineBounds(b.outline);
        const aLarger = ba.width * ba.height >= bb.width * bb.height;
        clusters[i] = {
          id: aLarger ? a.id : b.id,
          outline: union,
          materialId: aLarger ? a.materialId : b.materialId,
        };
        clusters.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return clusters;
}

/** True when the AABB/L union covers a void neither patio occupies (house). */
function aabbUnionFillsCourtyard(
  a: PointMm[],
  b: PointMm[],
  union: PointMm[],
): boolean {
  const unionArea = polygonAreaMm2(union);
  const expected =
    polygonAreaMm2(a) +
    polygonAreaMm2(b) -
    approximateIntersectionAreaMm2(a, b);
  // ~4 m² of extra fill, or 12% larger than the authored pads.
  return unionArea > expected * 1.12 + 4_000_000;
}

function asAabbRing(outline: PointMm[]): PointMm[] {
  const open = ringPoints(outline);
  if (isAxisAlignedRect(open, 80)) return open;
  return outlineBoundsRect(open);
}

function aabbRingFromOutlines(outlines: PointMm[][]): PointMm[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const outline of outlines) {
    if (outline.length < 1) continue;
    const b = outlineBounds(outline);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  if (!Number.isFinite(minX)) return [];
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function deckPunchHoles(poolPits: PointMm[][], infinityCuts: PointMm[][]): PointMm[][] {
  return [...poolPits, ...infinityCuts].filter((h) => h.length >= 3);
}

/**
 * One hole per basin: pool pit unioned with the vanishing-side slot so fill
 * cannot leave a wall in the gap between the weir and the trough.
 */
function patioPunchHoles(
  poolPits: PointMm[][],
  patioOutline: PointMm[],
  edges: ResolvedInfinityEdge[],
  buildingOutlines: PointMm[][] = [],
): PointMm[][] {
  const pits = poolPits
    .filter((h) => h.length >= 3)
    .map((h) => paddedAabbRing(asAabbRing(h), 80));
  const buildingHoles = buildingOutlines.filter((h) => {
    if (h.length < 3) return false;
    return approximateIntersectionAreaMm2(patioOutline, h) > 10_000;
  });
  if (!edges.length) return [...pits, ...buildingHoles];

  const bb = outlineBounds(patioOutline);
  const corners = [
    { x: bb.minX, y: bb.minY },
    { x: bb.maxX, y: bb.minY },
    { x: bb.maxX, y: bb.maxY },
    { x: bb.minX, y: bb.maxY },
  ];
  const cuts = edges.map((edge) => {
    let outPad = 80;
    for (const c of corners) {
      const d = weirOutwardMm(c, edge) - edge.troughWidthMm;
      if (d > outPad) outPad = d + 80;
    }
    return asAabbRing(infinityDeckCutPolygon(edge, 250, outPad));
  });

  const used = new Set<number>();
  const holes: PointMm[][] = [];
  for (const cut of cuts) {
    let idx = -1;
    let best = 0;
    for (let i = 0; i < pits.length; i++) {
      const area = approximateIntersectionAreaMm2(pits[i], cut);
      if (area > best) {
        best = area;
        idx = i;
      }
    }
    if (idx >= 0 && best > 500) {
      holes.push(aabbRingFromOutlines([pits[idx], cut]));
      used.add(idx);
    } else {
      holes.push(cut);
    }
  }
  for (let i = 0; i < pits.length; i++) {
    if (!used.has(i)) holes.push(pits[i]);
  }
  return [...holes, ...buildingHoles].filter((h) => h.length >= 3);
}

function regionOnVanishingSide(
  region: PointMm[],
  edges: ResolvedInfinityEdge[],
): boolean {
  if (!edges.length) return false;
  const pts = ringPoints(region);
  if (pts.length < 3) return true;
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  for (const e of edges) {
    if (weirOutwardMm({ x: cx, y: cy }, e) > WEIR_RETAIN_STOP_MM) return true;
    let minD = Infinity;
    for (const p of pts) minD = Math.min(minD, weirOutwardMm(p, e));
    if (minD > WEIR_RETAIN_STOP_MM) return true;
  }
  return false;
}

/**
 * Stop retaining slightly pool-inward of the weir so it can sit below the
 * waterline on the sides but never covers the spill or wraps the trough.
 */
const WEIR_RETAIN_STOP_MM = -60;

/** Skip retaining that would stand on the weir, the spill, or around the trough. */
function retainingSegmentFacesInfinity(
  a: PointMm,
  b: PointMm,
  edges: ResolvedInfinityEdge[],
): boolean {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  for (const e of edges) {
    const wdx = e.edgeB.x - e.edgeA.x;
    const wdy = e.edgeB.y - e.edgeA.y;
    const wlen = Math.hypot(wdx, wdy) || 1;
    const parallel =
      Math.abs(ux * (wdy / wlen) - uy * (wdx / wlen)) <= 0.15;
    const da = weirOutwardMm(a, e);
    const db = weirOutwardMm(b, e);
    if (da > WEIR_RETAIN_STOP_MM && db > WEIR_RETAIN_STOP_MM) return true;
    if (parallel && (da + db) / 2 > WEIR_RETAIN_STOP_MM) return true;
  }
  return false;
}

function weirOutwardMm(p: PointMm, edge: ResolvedInfinityEdge): number {
  const a = edge.edgeA ?? edge.a;
  return (p.x - a.x) * edge.nx + (p.y - a.y) * edge.ny;
}

/** Keep the patio-side of a retaining run; drop anything at or past the weir. */
function clipRetainingAtWeir(
  a: PointMm,
  b: PointMm,
  edges: ResolvedInfinityEdge[],
): { a: PointMm; b: PointMm }[] {
  if (!edges.length) return [{ a, b }];
  let a0 = a;
  let b0 = b;
  for (const e of edges) {
    const da = weirOutwardMm(a0, e);
    const db = weirOutwardMm(b0, e);
    if (da > WEIR_RETAIN_STOP_MM && db > WEIR_RETAIN_STOP_MM) return [];
    if ((da > WEIR_RETAIN_STOP_MM) !== (db > WEIR_RETAIN_STOP_MM)) {
      const t = Math.max(
        0,
        Math.min(1, (WEIR_RETAIN_STOP_MM - da) / (db - da)),
      );
      const hit = {
        x: a0.x + (b0.x - a0.x) * t,
        y: a0.y + (b0.y - a0.y) * t,
      };
      if (da > WEIR_RETAIN_STOP_MM) a0 = hit;
      else b0 = hit;
    }
  }
  if (Math.hypot(b0.x - a0.x, b0.y - a0.y) < 80) return [];
  return [{ a: a0, b: b0 }];
}

/** Pull the water outline out to the weir so it isn't held back by wall inset. */
function snapOutlineToWeirFaces(
  outline: PointMm[],
  edges: ResolvedInfinityEdge[],
): PointMm[] {
  if (!edges.length) return outline;
  return outline.map((p) => {
    let q = p;
    for (const e of edges) {
      const ea = e.edgeA ?? e.a;
      const eb = e.edgeB ?? e.b;
      const len = Math.hypot(eb.x - ea.x, eb.y - ea.y) || 1;
      const ux = (eb.x - ea.x) / len;
      const uy = (eb.y - ea.y) / len;
      const along = (p.x - ea.x) * ux + (p.y - ea.y) * uy;
      if (along < -80 || along > len + 80) continue;
      const d = weirOutwardMm(p, e);
      if (d < -2 && d > -400) {
        q = { x: p.x + e.nx * -d, y: p.y + e.ny * -d };
      }
    }
    return q;
  });
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

  if (selection.kind === "flowerBed") {
    const bed = (design.flowerBeds ?? []).find((b) => b.id === selection.id);
    if (!bed || bed.outline.length < 3) return labels;
    const bb = outlineBounds(bed.outline);
    const center = planToWorldXZ({ x: bb.cx, y: bb.cy });
    const frame = rectangleFrame(bed.outline);
    const w = frame?.widthMm ?? bb.width;
    const len = frame?.lengthMm ?? bb.height;
    const kind = bed.style === "raised" ? "Raised bed" : "Tilled bed";
    labels.push({
      kind: "label",
      id: `lbl_bed_${bed.id}`,
      text: `${kind} ${formatLength(w, unit)} × ${formatLength(len, unit)}`,
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

const GATE_LEAF_OFFSET_MM = 28;
const GATE_SWING_OPEN_RAD = (10 * Math.PI) / 180;

function darkenHex(hex: string, amount = 0.2): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = (i: number) =>
    Math.max(0, Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - amount)));
  const p = (v: number) => v.toString(16).padStart(2, "0");
  return `#${p(n(0))}${p(n(2))}${p(n(4))}`;
}

function offsetPlan(p: PointMm, n: PointMm, mm: number): PointMm {
  return { x: p.x + n.x * mm, y: p.y + n.y * mm };
}

/** Rotate `far` around `hinge` toward `outward` by `rad` (leaf opens away from pool). */
function swingLeafFar(
  hinge: PointMm,
  far: PointMm,
  outward: PointMm,
  rad: number,
): PointMm {
  const w = Math.hypot(far.x - hinge.x, far.y - hinge.y);
  if (w < 1) return far;
  const ux = (far.x - hinge.x) / w;
  const uy = (far.y - hinge.y) / w;
  let nx = -uy;
  let ny = ux;
  if (nx * outward.x + ny * outward.y < 0) {
    nx = -nx;
    ny = -ny;
  }
  return {
    x: hinge.x + ux * w * Math.cos(rad) + nx * w * Math.sin(rad),
    y: hinge.y + uy * w * Math.cos(rad) + ny * w * Math.sin(rad),
  };
}

function gateWorldBasis(
  a: PointMm,
  b: PointMm,
  outward: PointMm,
): { along: { x: number; z: number }; out: { x: number; z: number } } {
  const wa = planToWorldXZ(a);
  const wb = planToWorldXZ(b);
  const lx = wb.x - wa.x;
  const lz = wb.z - wa.z;
  const len = Math.hypot(lx, lz) || 1;
  const along = { x: lx / len, z: lz / len };
  // Face normal must be perpendicular to THIS leaf (open or closed), not the
  // closed fence line — otherwise hardware floats off a swung / racked leaf.
  let nx = -along.z;
  let nz = along.x;
  const want = { x: -outward.x, z: -outward.y };
  if (nx * want.x + nz * want.z < 0) {
    nx = -nx;
    nz = -nz;
  }
  const nlen = Math.hypot(nx, nz) || 1;
  return { along, out: { x: nx / nlen, z: nz / nlen } };
}

/** World point on a racked leaf: t along the bottom rail, upM above that rail. */
function rackedLeafPoint(
  wa: { x: number; z: number },
  wb: { x: number; z: number },
  y0: number,
  y1: number,
  out: { x: number; z: number },
  t: number,
  upM: number,
  outM: number,
): { x: number; y: number; z: number } {
  return {
    x: wa.x + (wb.x - wa.x) * t + out.x * outM,
    y: y0 + (y1 - y0) * t + upM,
    z: wa.z + (wb.z - wa.z) * t + out.z * outM,
  };
}

type WorldMarkPt = { x: number; y: number; z: number };

function densifyWorldPolyline(
  plan: PointMm[],
  closed: boolean,
  heightAt: (p: PointMm) => number,
  stepMm = 700,
): WorldMarkPt[] {
  const segs = siteLineSegments({
    id: "",
    name: "",
    kind: "property",
    points: plan,
    closed,
  });
  const out: WorldMarkPt[] = [];
  const lift = 0.03;
  for (let s = 0; s < segs.length; s++) {
    const [a, b] = segs[s];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(len / stepMm));
    const start = s === 0 ? 0 : 1;
    for (let i = start; i <= n; i++) {
      const t = i / n;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const xz = planToWorldXZ(p);
      out.push({ x: xz.x, y: heightAt(p) + lift, z: xz.z });
    }
  }
  return out;
}

function polylineLengthM(pts: WorldMarkPt[]): number {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) {
    sum += Math.hypot(
      pts[i].x - pts[i - 1].x,
      pts[i].y - pts[i - 1].y,
      pts[i].z - pts[i - 1].z,
    );
  }
  return sum;
}

function pointAlongPolyline(pts: WorldMarkPt[], distM: number): WorldMarkPt {
  if (pts.length === 0) return { x: 0, y: 0, z: 0 };
  if (distM <= 0) return pts[0];
  let remain = distM;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const dz = pts[i].z - pts[i - 1].z;
    const len = Math.hypot(dx, dy, dz) || 1e-6;
    if (remain <= len) {
      const t = remain / len;
      return {
        x: pts[i - 1].x + dx * t,
        y: pts[i - 1].y + dy * t,
        z: pts[i - 1].z + dz * t,
      };
    }
    remain -= len;
  }
  return pts[pts.length - 1];
}

function dashedWorldChains(
  pts: WorldMarkPt[],
  dashM = 0.9,
  gapM = 0.5,
): WorldMarkPt[][] {
  const total = polylineLengthM(pts);
  if (pts.length < 2 || total < 0.05) return pts.length >= 2 ? [pts] : [];
  const chains: WorldMarkPt[][] = [];
  let d = 0;
  let on = true;
  while (d < total - 0.04) {
    const span = on ? dashM : gapM;
    const d1 = Math.min(total, d + span);
    if (on) {
      const samples: WorldMarkPt[] = [pointAlongPolyline(pts, d)];
      const inner = Math.max(1, Math.ceil((d1 - d) / 0.55));
      for (let i = 1; i <= inner; i++) {
        samples.push(pointAlongPolyline(pts, d + ((d1 - d) * i) / inner));
      }
      chains.push(samples);
    }
    d = d1;
    on = !on;
  }
  return chains.filter((c) => c.length >= 2);
}

export function buildSceneModel(
  designInput: DesignDocument,
  options: SceneBuildOptions = {},
): SceneModel {
  // Fix clipped auto trenches; always materialize pad manifold for 3D.
  const design = ensurePadManifoldPlumbing(
    repairAutoPlumbingIfNeeded(designInput),
  );
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
  const infinityTroughCuts: PointMm[][] = [];
  const infinityEdgesAll: ResolvedInfinityEdge[] = [];
  for (const p of pools) {
    if (p.outline.length < 3) continue;
    for (const edge of resolveInfinityEdges(p)) {
      infinityEdgesAll.push(edge);
      infinityTroughCuts.push(closeOutline(infinityTroughPolygon(edge)));
    }
  }
  for (const s of spas) {
    if (s.outline.length >= 3) poolPitHoles.push(pitHoleOutline(s.outline));
  }

  const waterTopY = -mmToMeters(POOL_WATER_FREEBOARD_MM);
  const gradeSamples = design.gradeSamples ?? [];
  const hasGradeSamples = gradeSamples.length > 0;

  // Prefer solid AABB slabs with pits subtracted (reliable). Fall back to
  // Extrude holes only when the outline isn't a rectangle.
  // Always punch pool/spa pits out of grade so basins stay clear.
  const hideDeck = Boolean(
    options.hideDeck || !anyLayerVisible(design, "patio", "deck"),
  );
  const patioClusters = hideDeck
    ? []
    : clusterPatioSlabs(design.patios ?? []);
  const buildingPunchOutlines = (design.buildings ?? [])
    .filter((b) => b.outline.length >= 3)
    .map((b) => ringPoints(b.outline));
  // Rect unions only — an L bbox would also punch the empty courtyard.
  const patioGrassHoles = patioClusters
    .map((c) => ringPoints(c.outline))
    .filter((h) => h.length >= 3 && isAxisAlignedRect(h, 80));
  const groundHoles = deckPunchHoles(
    [...poolPitHoles, ...patioGrassHoles],
    infinityTroughCuts,
  );
  const groundRegions = subtractAabbHoles(groundOutline, groundHoles);
  if (!hasGradeSamples && groundRegions.length > 0) {
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

  if (hasGradeSamples) {
    const stepMm = Math.max(
      900,
      Math.min(bounds.width, bounds.height, 40000) / 28,
    );
    // One sloping patch per remainder region so pool/spa pits have no grass.
    let ti = 0;
    for (const region of groundRegions) {
      if (region.length < 3) continue;
      const bb = outlineBounds(region);
      if (bb.width < 50 || bb.height < 50) continue;
      const cols = Math.max(2, Math.ceil(bb.width / stepMm) + 1);
      const rows = Math.max(2, Math.ceil(bb.height / stepMm) + 1);
      const cellW = bb.width / (cols - 1);
      const cellH = bb.height / (rows - 1);
      const heightsM: number[] = [];
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const plan = {
            x: bb.minX + i * cellW,
            y: bb.minY + j * cellH,
          };
          const dropMm = existingGradeDropMm(plan, gradeSamples);
          heightsM.push(-mmToMeters(dropMm));
        }
      }
      meshes.push({
        kind: "terrain",
        id: `ground_terrain_${ti++}`,
        material: "ground",
        originMm: { x: bb.minX, y: bb.minY },
        stepMm: cellW,
        // TerrainMesh uses uniform step for both axes; store cellW and
        // encode non-uniform via a second field when needed.
        cols,
        rows,
        heightsM,
        stepYMm: cellH,
      });
    }
  }

  const ground: ExtrudeDescriptor = {
    kind: "extrude",
    id: "ground_grade",
    material: "ground",
    outlineMm: groundOutline,
    // When subtracted slabs / terrain were emitted, skip the solid ground mesh.
    holeOutlinesMm: groundRegions.length > 0 ? [] : groundHoles,
    bottomY: -0.04,
    height:
      hasGradeSamples || groundRegions.length > 0 ? 0 : 0.04,
  };

  if (anyLayerVisible(design, "house", "building")) {
    for (const b of design.buildings ?? []) {
      if (b.outline.length < 3) continue;
      const stories = Math.max(1, b.stories || 1);
      const ceilingMm = resolveCeilingHeightMm(b.ceilingHeightMm);
      const hMm = buildingHeightMm(stories, ceilingMm);
      const h = mmToMeters(hMm);
      const select: SceneSelection = { kind: "building", id: b.id };
      const storyLooks = Array.from({ length: stories }, (_, i) => {
        const look = resolveBuildingStoryExterior(b, i + 1);
        return {
          colorHex: houseExteriorHex(look.color),
          sidingId: look.sidingId,
        };
      });
      const wallTmm = 180;
      // Exact same ring as resolveOpeningEdge / openingEndpoints.
      const pts = openOutlineRing(b.outline);
      const wallArea = planSignedAreaMm2(pts);

      // Interior ground floor — hollow shell so walkthrough can stand inside.
      meshes.push({
        kind: "extrude",
        id: `building_floor_${b.id}`,
        material: "feature",
        outlineMm: closeOutline(b.outline),
        bottomY: 0,
        height: 0.06,
        select,
      });

      // Intermediate floor / ceiling slabs for multi-story houses.
      if (stories > 1) {
        const floorOutline = closeOutline(
          offsetClosedOutline(b.outline, -Math.min(wallTmm * 0.75, 140)),
        );
        for (let s = 1; s < stories; s++) {
          const undersideMm =
            s * ceilingMm + (s - 1) * FLOOR_STRUCTURE_THICKNESS_MM;
          meshes.push({
            kind: "extrude",
            id: `building_floor_${b.id}_s${s + 1}`,
            material: "feature",
            outlineMm: floorOutline,
            bottomY: mmToMeters(undersideMm),
            height: mmToMeters(FLOOR_STRUCTURE_THICKNESS_MM),
            select,
          });
        }
        // Ceiling under the roof so the top story isn't open to the attic.
        const topCeilingT = 0.1;
        meshes.push({
          kind: "extrude",
          id: `building_ceiling_${b.id}_top`,
          material: "feature",
          outlineMm: floorOutline,
          bottomY: h - topCeilingT - 0.02,
          height: topCeilingT,
          select,
        });
      }

      // One extruded panel per edge with true punched holes (no stacked box gaps).
      type WallHole = { x: number; y: number; w: number; h: number };
      const holesByEdge = new Map<number, WallHole[]>();
      for (const opening of b.openings ?? []) {
        const resolved = resolveOpeningEdge(b.outline, opening.edgeIndex);
        if (!resolved) continue;
        const { edgeIndex: ei, edgeLen: openEdgeLen } = resolved;
        const t = clampOpeningT(openEdgeLen, opening.widthMm, opening.t);
        const story = clampOpeningStory(opening.story, stories);
        const sillMm = openingSillMm(
          opening.kind,
          story,
          stories,
          opening.sillAboveFloorMm,
          ceilingMm,
        );
        const openH = Math.min(opening.heightMm, hMm - sillMm - 50);
        if (openH < 100) continue;
        // Match the opening unit closely — only a hairline so the frame
        // isn't z-fighting the wall (large pads read as see-through gaps).
        const padMm = 4;
        const holeW = Math.min(opening.widthMm + padMm * 2, openEdgeLen - 8);
        const holeH = openH + padMm * 2;
        const hole: WallHole = {
          x: (t - 0.5) * mmToMeters(openEdgeLen),
          y: mmToMeters(Math.max(0, sillMm - padMm)),
          w: mmToMeters(holeW),
          h: mmToMeters(holeH),
        };
        const list = holesByEdge.get(ei) ?? [];
        list.push(hole);
        holesByEdge.set(ei, list);
      }

      // One extruded panel per edge, full length so corners meet.
      // Only pull an end back when the neighboring wall has a punched
      // opening in the overlap — otherwise that solid would fill the hole.
      const insetM = mmToMeters(wallTmm);
      const holeReaches = (
        edgeIndex: number,
        which: "start" | "end",
      ): boolean => {
        const holes = holesByEdge.get(edgeIndex) ?? [];
        const ea = pts[edgeIndex];
        const eb = pts[(edgeIndex + 1) % pts.length];
        const len = Math.hypot(eb.x - ea.x, eb.y - ea.y);
        if (len < 40) return false;
        const half = mmToMeters(len) / 2;
        for (const hole of holes) {
          const left = hole.x - hole.w / 2;
          const right = hole.x + hole.w / 2;
          if (which === "start" && left <= -half + insetM + 0.02) return true;
          if (which === "end" && right >= half - insetM - 0.02) return true;
        }
        return false;
      };

      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const bPt = pts[(i + 1) % pts.length];
        const edgeLen = Math.hypot(bPt.x - a.x, bPt.y - a.y);
        if (edgeLen < 40) continue;
        const tx = (bPt.x - a.x) / edgeLen;
        const ty = (bPt.y - a.y) / edgeLen;
        const n = edgeOutwardNormal(bPt.x - a.x, bPt.y - a.y, wallArea);
        const nx = n.x;
        const ny = n.y;

        const holes = [...(holesByEdge.get(i) ?? [])];
        const prev = (i - 1 + pts.length) % pts.length;
        const next = (i + 1) % pts.length;
        const startInsetM = holeReaches(prev, "end") ? insetM : 0;
        const endInsetM = holeReaches(next, "start") ? insetM : 0;
        const fullLenM = mmToMeters(edgeLen);
        const panelLenM = Math.max(0.05, fullLenM - startInsetM - endInsetM);
        const centerFromStartM = startInsetM + panelLenM / 2;
        const holeShiftM = fullLenM / 2 - centerFromStartM;
        const holesLocal = holes.map((hole) => ({
          ...hole,
          x: hole.x + holeShiftM,
        }));
        const centerPlan = {
          x: a.x + tx * centerFromStartM * 1000,
          y: a.y + ty * centerFromStartM * 1000,
        };
        const xz = planToWorldXZ(centerPlan);
        const outward = planDirToWorldXZ(nx, ny);
        for (let s = 1; s <= stories; s++) {
          const floorMm = storyFloorElevationMm(s, stories, ceilingMm);
          const topMm =
            s < stories
              ? storyFloorElevationMm(s + 1, stories, ceilingMm)
              : hMm;
          const bottomM = mmToMeters(floorMm);
          const heightM = Math.max(0.05, mmToMeters(topMm - floorMm));
          const look = storyLooks[s - 1];
          const holesStory = holesLocal
            .map((hole) => ({
              ...hole,
              y: hole.y - bottomM,
            }))
            .filter((hole) => hole.y + hole.h > 0.02 && hole.y < heightM - 0.02);
          meshes.push({
            kind: "wallPanel",
            id: `building_wall_${b.id}_${i}_s${s}`,
            material: "building",
            position: { x: xz.x, y: bottomM, z: xz.z },
            axisX: planDirToWorldXZ(tx, ty),
            axisZ: outward,
            lengthM: panelLenM,
            heightM,
            thicknessM: mmToMeters(wallTmm),
            holes: holesStory,
            colorHex: look.colorHex,
            sidingId: look.sidingId,
            select,
          });
        }
      }

      // Concave (inner) corners leave a T×T parallelogram hole because
      // neighboring walls extrude inward and pull away from each other.
      for (let i = 0; i < pts.length; i++) {
        const prev = pts[(i - 1 + pts.length) % pts.length];
        const cur = pts[i];
        const next = pts[(i + 1) % pts.length];
        const inDx = cur.x - prev.x;
        const inDy = cur.y - prev.y;
        const outDx = next.x - cur.x;
        const outDy = next.y - cur.y;
        if (Math.hypot(inDx, inDy) < 40 || Math.hypot(outDx, outDy) < 40) {
          continue;
        }
        const cross = inDx * outDy - inDy * outDx;
        // Reflex interior angle: turn opposite the ring winding.
        if (cross * wallArea >= 0) continue;
        const n0 = edgeOutwardNormal(inDx, inDy, wallArea);
        const n1 = edgeOutwardNormal(outDx, outDy, wallArea);
        const in0 = { x: -n0.x * wallTmm, y: -n0.y * wallTmm };
        const in1 = { x: -n1.x * wallTmm, y: -n1.y * wallTmm };
        const cornerOutline = closeOutline([
          cur,
          { x: cur.x + in0.x, y: cur.y + in0.y },
          { x: cur.x + in0.x + in1.x, y: cur.y + in0.y + in1.y },
          { x: cur.x + in1.x, y: cur.y + in1.y },
        ]);
        for (let s = 1; s <= stories; s++) {
          const floorMm = storyFloorElevationMm(s, stories, ceilingMm);
          const topMm =
            s < stories
              ? storyFloorElevationMm(s + 1, stories, ceilingMm)
              : hMm;
          const look = storyLooks[s - 1];
          meshes.push({
            kind: "extrude",
            id: `building_wall_corner_${b.id}_${i}_s${s}`,
            material: "building",
            outlineMm: cornerOutline,
            bottomY: mmToMeters(floorMm),
            height: Math.max(0.05, mmToMeters(topMm - floorMm)),
            colorHex: look.colorHex,
            sidingId: look.sidingId,
            select,
          });
        }
      }

      // Roof: flat slab, or a pitched surface from 2D ridge / peak lines.
      const roof = resolvedBuildingRoof(b);
      const eavesMm = roof.overhangMm;
      const roofSlab = 0.12;
      const fascia = 0.08;
      const roofOutline = closeOutline(
        offsetClosedOutline(b.outline, eavesMm),
      );
      const roofColor = roofColorHex(roof.color);
      if (roof.style === "pitched" && roof.ridges.length > 0) {
        const tess = tessellatePitchedRoof(
          b.outline,
          roof.ridges,
          roof.pitch12,
          eavesMm,
        );
        if (tess.indices.length >= 3) {
          const positions: number[] = [];
          const uvs: number[] = [];
          for (const v of tess.vertices) {
            const xz = planToWorldXZ(v);
            positions.push(xz.x, h + mmToMeters(v.hMm), xz.z);
            uvs.push(xz.x, xz.z);
          }
          const indices = tess.indices.slice();
          flipTriWindingIfNeeded(positions, indices, "up");
          meshes.push({
            kind: "triMesh",
            id: `building_roof_${b.id}`,
            material: "roof",
            positions,
            uvs,
            indices,
            colorHex: roofColor,
            roofFinishId: roof.finishId,
            select,
          });
        }
        if (tess.gables.length) {
          const gPos: number[] = [];
          const gUv: number[] = [];
          const gIdx: number[] = [];
          const look = storyLooks[stories - 1] ?? storyLooks[0];
          for (const g of tess.gables) {
            const a0 = planToWorldXZ(g.a);
            const b0 = planToWorldXZ(g.b);
            const ha = h + mmToMeters(g.haMm);
            const hb = h + mmToMeters(g.hbMm);
            const base = gPos.length / 3;
            gPos.push(a0.x, h, a0.z, b0.x, h, b0.z, b0.x, hb, b0.z, a0.x, ha, a0.z);
            const along = Math.hypot(b0.x - a0.x, b0.z - a0.z);
            gUv.push(0, 0, along, 0, along, hb - h, 0, ha - h);
            const n = edgeOutwardNormal(
              g.b.x - g.a.x,
              g.b.y - g.a.y,
              wallArea,
            );
            const out = planDirToWorldXZ(n.x, n.y);
            const tmpIdx = [0, 1, 2, 0, 2, 3];
            const tmpPos = gPos.slice(base * 3);
            flipTriWindingIfNeeded(tmpPos, tmpIdx, "out", out.x, out.z);
            gIdx.push(...tmpIdx.map((i) => i + base));
          }
          meshes.push({
            kind: "triMesh",
            id: `building_gable_${b.id}`,
            material: "building",
            positions: gPos,
            uvs: gUv,
            indices: gIdx,
            colorHex: look?.colorHex,
            sidingId: look?.sidingId,
            select,
          });
        }
        meshes.push({
          kind: "extrude",
          id: `building_fascia_${b.id}`,
          material: "roof",
          outlineMm: roofOutline,
          holeOutlinesMm: [closeOutline(b.outline)],
          bottomY: h - fascia,
          height: fascia,
          opacity: 1,
          colorHex: roofColor,
          roofFinishId: roof.finishId,
          select,
        });
      } else {
        meshes.push({
          kind: "extrude",
          id: `building_roof_${b.id}`,
          material: "roof",
          outlineMm: roofOutline,
          bottomY: h,
          height: roofSlab,
          colorHex: roofColor,
          roofFinishId: roof.finishId,
          select,
        });
        meshes.push({
          kind: "extrude",
          id: `building_fascia_${b.id}`,
          material: "roof",
          outlineMm: roofOutline,
          holeOutlinesMm: [closeOutline(b.outline)],
          bottomY: h - fascia,
          height: fascia,
          opacity: 1,
          colorHex: roofColor,
          roofFinishId: roof.finishId,
          select,
        });
      }

      for (const opening of b.openings ?? []) {
        const geom = openingEndpoints(b.outline, opening);
        if (!geom) continue;
        const wallUx = geom.edgeB.x - geom.edgeA.x;
        const wallUy = geom.edgeB.y - geom.edgeA.y;
        const wallLen = Math.hypot(wallUx, wallUy) || 1;
        const tx = wallUx / wallLen;
        const ty = wallUy / wallLen;
        const n = edgeOutwardNormal(wallUx, wallUy, wallArea);
        const nx = n.x;
        const ny = n.y;
        // Center glass / door in the hollow wall so you can see out from inside.
        const xz = planToWorldXZ(geom.center);
        const outward = planDirToWorldXZ(nx, ny);
        const inward = { x: -outward.x, z: -outward.z };
        const faceOffsetM = mmToMeters(wallTmm) * 0.5;
        const story = clampOpeningStory(opening.story, stories);
        const sillMm = openingSillMm(
          opening.kind,
          story,
          stories,
          opening.sillAboveFloorMm,
          ceilingMm,
        );
        const openH = Math.min(opening.heightMm, hMm - sillMm - 50);
        if (openH < 100) continue;
        meshes.push({
          kind: "box",
          id: `opening_${b.id}_${opening.id}`,
          material:
            opening.kind === "door" ? "door" : "window",
          openingKind: opening.kind,
          position: {
            x: xz.x + inward.x * faceOffsetM,
            y: mmToMeters(sillMm + openH / 2),
            z: xz.z + inward.z * faceOffsetM,
          },
          size: {
            x: mmToMeters(opening.widthMm),
            y: mmToMeters(openH),
            z: mmToMeters(wallTmm * 0.85),
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
    anyLayerVisible(design, "patio", "deck")
  ) {
    for (const p of patioClusters) {
      if (p.outline.length < 3) continue;
      const t = mmToMeters(PATIO_SLAB_THICKNESS_MM);
      const select: SceneSelection = { kind: "patio", id: p.id };
      const open = ringPoints(p.outline);
      const punchHoles = patioPunchHoles(
        poolPitHoles,
        p.outline,
        infinityEdgesAll,
        buildingPunchOutlines,
      );
      const holesAabb = punchHoles.map(asAabbRing);
      // Always cover with AABB-subtracted regions. ExtrudeGeometry + Earcut
      // holes leave a paver sidewall through spas / attached pools.
      let regions: PointMm[][] = [];
      try {
        regions = subtractPolygonAabbHoles(open, holesAabb);
      } catch (err) {
        console.warn("patio punch failed", p.id, err);
        regions = subtractAabbHoles(open, holesAabb);
      }
      let pi = 0;
      for (const region of regions) {
        if (isSliverOutline(region)) continue;
        if (regionOnVanishingSide(region, infinityEdgesAll)) continue;
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
    }

    // Fill / retaining from site grade samples (per authored patio).
    for (const p of design.patios ?? []) {
      if (p.outline.length < 3 || !hasGradeSamples) continue;
      const t = mmToMeters(PATIO_SLAB_THICKNESS_MM);
      const select: SceneSelection = { kind: "patio", id: p.id };
      const open = ringPoints(p.outline);
      const punchHoles = patioPunchHoles(
        poolPitHoles,
        p.outline,
        infinityEdgesAll,
        buildingPunchOutlines,
      );
      const holesAabb = punchHoles.map(asAabbRing);
      const strategy = resolveGradeStrategy(p.gradeStrategy);
      const analysis = analyzePatioGrade(
        p,
        gradeSamples,
        design.gradeOptions,
      );
        // Max existing-grade drop under this patio (for a solid raised pad).
        let maxDropMm = 0;
        for (const corner of p.outline) {
          maxDropMm = Math.max(
            maxDropMm,
            existingGradeDropMm(corner, gradeSamples),
          );
        }
        maxDropMm = Math.max(maxDropMm, analysis.maxFillHeightMm);
        for (const seg of analysis.retainingSegments) {
          maxDropMm = Math.max(maxDropMm, seg.dropMm);
        }

        if (
          (analysis.includeFill ||
            strategy === "fill" ||
            strategy === "both") &&
          maxDropMm > PATIO_SLAB_THICKNESS_MM + 40
        ) {
          const dropM = mmToMeters(maxDropMm);
          // Cover with AABB-subtracted regions so fill cannot wall through a spa.
          let fillRegions: PointMm[][] = [];
          try {
            fillRegions = subtractPolygonAabbHoles(open, holesAabb);
          } catch (err) {
            console.warn("fill punch failed", p.id, err);
            fillRegions = subtractAabbHoles(open, holesAabb);
          }
          let fi = 0;
          for (const region of fillRegions) {
            if (region.length < 3 || isSliverOutline(region)) continue;
            if (regionOnVanishingSide(region, infinityEdgesAll)) continue;
            meshes.push({
              kind: "extrude",
              id: `fill_${p.id}_${fi++}`,
              material: "fill",
              outlineMm: closeOutline(region),
              bottomY: -dropM,
              height: dropM,
              select,
            });
          }
        }

        if (analysis.retainingSegments.length > 0) {
          let ri = 0;
          const patioBb = outlineBounds(p.outline);
          const RETAIN_STEP_MM = 600;
          const pushRetainRun = (
            a: PointMm,
            b: PointMm,
            nx: number,
            ny: number,
            offsetMm: number,
            topY: number,
          ) => {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            if (len < 80) return;
            const along = planDirToWorldXZ(dx, dy);
            const nSteps = Math.max(1, Math.ceil(len / RETAIN_STEP_MM));
            const buryM = 0.08;
            for (let i = 0; i < nSteps; i++) {
              const t0 = i / nSteps;
              const t1 = (i + 1) / nSteps;
              const p0 = {
                x: a.x + dx * t0,
                y: a.y + dy * t0,
              };
              const p1 = {
                x: a.x + dx * t1,
                y: a.y + dy * t1,
              };
              const mid = {
                x: (p0.x + p1.x) / 2,
                y: (p0.y + p1.y) / 2,
              };
              const wallMid = {
                x: mid.x + nx * offsetMm,
                y: mid.y + ny * offsetMm,
              };
              const dropMm = hasGradeSamples
                ? Math.max(
                    existingGradeDropMm(
                      { x: p0.x + nx * offsetMm, y: p0.y + ny * offsetMm },
                      gradeSamples,
                    ),
                    existingGradeDropMm(wallMid, gradeSamples),
                    existingGradeDropMm(
                      { x: p1.x + nx * offsetMm, y: p1.y + ny * offsetMm },
                      gradeSamples,
                    ),
                  )
                : 200;
              const span = Math.hypot(p1.x - p0.x, p1.y - p0.y);
              const lenM = mmToMeters(span);
              const bottom = -mmToMeters(Math.max(0, dropMm)) - buryM;
              const height = Math.max(0.08, topY - bottom);
              const thickM = 0.25;
              const xz = planToWorldXZ(wallMid);
              meshes.push({
                kind: "box",
                id: `retain_${p.id}_${ri++}`,
                material: "retaining",
                position: {
                  x: xz.x,
                  y: bottom + height / 2,
                  z: xz.z,
                },
                size: { x: Math.max(0.2, lenM), y: height, z: thickM },
                rotationY: Math.atan2(-along.z, along.x),
                select,
              });
            }
          };
          for (const seg of analysis.retainingSegments) {
            if (
              seg.source !== "retaining" &&
              retainingSegmentFacesInfinity(seg.a, seg.b, infinityEdgesAll)
            ) {
              continue;
            }
            const dx = seg.b.x - seg.a.x;
            const dy = seg.b.y - seg.a.y;
            const len = Math.hypot(dx, dy) || 1;
            const mid0 = {
              x: (seg.a.x + seg.b.x) / 2,
              y: (seg.a.y + seg.b.y) / 2,
            };
            let nx = -dy / len;
            let ny = dx / len;
            if (nx * (patioBb.cx - mid0.x) + ny * (patioBb.cy - mid0.y) > 0) {
              nx = -nx;
              ny = -ny;
            }
            const pieces =
              seg.source === "retaining"
                ? [{ a: seg.a, b: seg.b }]
                : clipRetainingAtWeir(seg.a, seg.b, infinityEdgesAll);
            for (const piece of pieces) {
              pushRetainRun(piece.a, piece.b, nx, ny, 120, t);
            }
          }
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

      // Pergola: a few rafters under the translucent slab so it reads as lattice, not a tinted box.
      if (!isRoof) {
        const bb = outlineBounds(c.outline);
        const spanX = Math.max(400, bb.maxX - bb.minX);
        const spanY = Math.max(400, bb.maxY - bb.minY);
        const rafterCount = Math.min(7, Math.max(3, Math.round(spanX / 900)));
        const beamCount = Math.min(5, Math.max(2, Math.round(spanY / 1200)));
        const rafterW = mmToMeters(90);
        const rafterH = mmToMeters(140);
        const coverSelect: SceneSelection = { kind: "cover", id: c.id };
        for (let i = 0; i < rafterCount; i++) {
          const t = (i + 0.5) / rafterCount;
          const px = bb.minX + spanX * t;
          const a = planToWorldXZ({ x: px, y: bb.minY });
          const b = planToWorldXZ({ x: px, y: bb.maxY });
          const midX = (a.x + b.x) / 2;
          const midZ = (a.z + b.z) / 2;
          const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.5;
          const yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
          meshes.push({
            kind: "box",
            id: `cover_rafter_${c.id}_${i}`,
            material: "pergola",
            position: { x: midX, y: top - slab - rafterH / 2, z: midZ },
            size: { x: len, y: rafterH, z: rafterW },
            rotationY: yaw,
            select: coverSelect,
          });
        }
        for (let i = 0; i < beamCount; i++) {
          const t = (i + 0.5) / beamCount;
          const py = bb.minY + spanY * t;
          const a = planToWorldXZ({ x: bb.minX, y: py });
          const b = planToWorldXZ({ x: bb.maxX, y: py });
          const midX = (a.x + b.x) / 2;
          const midZ = (a.z + b.z) / 2;
          const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.5;
          const yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
          meshes.push({
            kind: "box",
            id: `cover_beam_${c.id}_${i}`,
            material: "pergola",
            position: {
              x: midX,
              y: top - slab - rafterH - mmToMeters(40),
              z: midZ,
            },
            size: { x: len, y: rafterW, z: rafterH * 0.85 },
            rotationY: yaw,
            select: coverSelect,
          });
        }
      }

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

  if (anyLayerVisible(design, "pool", "pools")) {
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
        const spills = joinsPool
          ? resolveSpaSpillovers(body, pools)
          : [];
        const pts = ringPoints(outer);
        const edgeOmits = spills.length
          ? spills.map((spill) => {
              const edgeA = pts[spill.edgeIndex];
              const edgeB = pts[(spill.edgeIndex + 1) % pts.length];
              const edgeLen = Math.hypot(
                edgeB.x - edgeA.x,
                edgeB.y - edgeA.y,
              );
              let intervals = spilloverOmitIntervals(spill, edgeA, edgeB);
              // When an adjacent weir shares this corner, open the upper wall
              // all the way to the vertex so the corner post is notched out.
              const prev = spills.find(
                (s) => (s.edgeIndex + 1) % pts.length === spill.edgeIndex,
              );
              const next = spills.find(
                (s) =>
                  s.edgeIndex === (spill.edgeIndex + 1) % pts.length,
              );
              if (prev || next) {
                intervals = intervals.map(([t0, t1]) => {
                  let lo = t0;
                  let hi = t1;
                  if (prev) lo = Math.min(lo, 0);
                  if (next) hi = Math.max(hi, edgeLen);
                  return [lo, hi] as [number, number];
                });
              }
              return {
                edgeIndex: spill.edgeIndex,
                intervals,
              };
            })
          : undefined;
        const notchDepthMm = spills[0]?.notchDepthMm ?? 0;
        // Crest of the weir notch (below rim, at/above spa water).
        const crestY = spills.length
          ? Math.min(
              wallTopY - 0.01,
              Math.max(
                spaWaterTop - 0.005,
                wallTopY - mmToMeters(notchDepthMm),
              ),
            )
          : wallTopY;

        const pushSpaShell = (bottomY: number, topY: number) => {
          const h = Math.max(0.02, topY - bottomY);
          if (!spills.length || !edgeOmits || crestY >= topY - 0.005) {
            pushWallRing(meshes, {
              outlineMm: outer,
              bottomY,
              height: h,
              thicknessMm: wallT,
              material: "spaShell",
              select,
              idPrefix: `spa_wall_${body.id}`,
              inward: true,
            });
            return;
          }
          // Only the weir edge is split at crest height. Splitting every wall
          // left a dark horizontal seam through the spa shell.
          const spillIdx = edgeOmits.map((e) => e.edgeIndex);
          const nEdge = pts.length;
          const otherIdx = Array.from({ length: nEdge }, (_, i) => i).filter(
            (i) => !spillIdx.includes(i),
          );
          if (otherIdx.length) {
            pushWallRing(meshes, {
              outlineMm: outer,
              bottomY,
              height: h,
              thicknessMm: wallT,
              material: "spaShell",
              select,
              idPrefix: `spa_wall_${body.id}`,
              inward: true,
              onlyEdgeIndexes: otherIdx,
            });
          }
          const lowerH = Math.max(0.02, crestY - bottomY);
          pushWallRing(meshes, {
            outlineMm: outer,
            bottomY,
            height: lowerH,
            thicknessMm: wallT,
            material: "spaShell",
            select,
            idPrefix: `spa_wall_${body.id}_sill`,
            inward: true,
            onlyEdgeIndexes: spillIdx,
          });
          const upperH = Math.max(0.015, topY - crestY);
          pushWallRing(meshes, {
            outlineMm: outer,
            bottomY: crestY,
            height: upperH,
            thicknessMm: wallT,
            material: "spaShell",
            select,
            idPrefix: `spa_wall_${body.id}_rim`,
            inward: true,
            onlyEdgeIndexes: spillIdx,
            edgeOmits,
          });
        };

        if (needsPit) {
          const wallBottom = Math.min(floorY, -0.02);
          // Full spa shell, including pool-side spillover walls. The pool omits
          // those shared edges so only the spa draws that border.
          pushSpaShell(wallBottom, wallTopY);
          pushWaterFill(meshes, {
            idPrefix: `spa_${body.id}`,
            outlineMm: inner,
            floorY,
            waterTopY: spaWaterTop,
            select,
            // Always spa water — jet agitation reads differently from the pool.
            waterMaterial: "spaWater",
          });
        } else {
          // Fully raised spa — vessel sits on the deck; shell rises above patio.
          pushSpaShell(deckTopY, wallTopY);
          pushWaterFill(meshes, {
            idPrefix: `spa_${body.id}`,
            outlineMm: inner,
            floorY,
            waterTopY: spaWaterTop,
            select,
            waterMaterial: "spaWater",
          });
        }

        // Waterline tile on the spa wet face (~6″ band at freeboard).
        pushWaterlineTileBand(meshes, {
          waterlineOutlineMm: inner,
          wallThicknessMm: wallT,
          waterTopY: spaWaterTop,
          waterlineTileId: body.waterlineTileId,
          select,
          idPrefix: `spa_tile_${body.id}`,
          edgeOmits,
        });

        pushSpaSpilloverWater(meshes, {
          spills,
          spaOutline: outer,
          crestY: Math.max(crestY, spaWaterTop),
          poolWaterTopY: waterTopY,
          wallThicknessMm: wallT,
          select,
          idPrefix: `spa_${body.id}`,
        });
      } else {
        const profile = depthProfileForBody(body);
        const maxDepth = Math.max(maxDepthMmFromProfile(body), 900);
        const depthM = mmToMeters(maxDepth);
        const lip = mmToMeters(POOL_LIP_THICKNESS_MM);
        const spaClippers = spas
          .filter(
            (s) =>
              s.outline.length >= 3 &&
              (waterBodiesConnected(body.outline, s.outline) ||
                approximateIntersectionAreaMm2(body.outline, s.outline) >
                  5_000 ||
                outlinesAabbTouch(body.outline, s.outline, 80)),
          )
          .map((s) => paddedAabbRing(s.outline, 40));
        const spaBlockers = spas
          .filter((s) => s.outline.length >= 3)
          .flatMap((s) => [s.outline, outlineBoundsRect(s.outline)]);
        const outer = body.outline;
        const wallT = poolWallThicknessMm(body);
        // Keep the authorable pool outline for walls/coping. Wrapping into an L
        // drew pool walls through the spa overlap; spa owns that shell.
        const wallOutline = outer;
        const waterInner = insetClosedOutline(outer, wallT);
        // Floor extends under the wall thickness so the shell seals (no light leaks).
        const floorInner = insetClosedOutline(outer, wallT * 0.35);
        const floorOutline =
          spaClippers.length > 0
            ? clipOutlineByAabbs(floorInner, spaClippers)
            : floorInner;

        const floorY = -depthM;
        const infinityEdges = resolveInfinityEdges(body);
        // One continuous water volume (not AABB remainder slabs — those seam).
        // Snap the vanishing edge out to the weir so wall inset does not leave
        // a dry cap across the spill.
        const waterOutline = snapOutlineToWeirFaces(
          spaClippers.length > 0
            ? clipOutlineByAabbs(waterInner, spaClippers)
            : waterInner,
          infinityEdges,
        );
        // Edge indexes come from the authorable pool outline, not spa-clipped walls.
        const pts = ringPoints(outer);
        const nPts = pts.length;
        // Spa-style: omit the entire vanishing edge on the upper rim / coping / tile.
        const infinityOmits = infinityEdges.length
          ? infinityEdges.map((edge) => {
              const edgeA = pts[edge.edgeIndex];
              const edgeB = pts[(edge.edgeIndex + 1) % nPts];
              const edgeLen = edgeA && edgeB
                ? Math.hypot(edgeB.x - edgeA.x, edgeB.y - edgeA.y)
                : 0;
              return {
                edgeIndex: edge.edgeIndex,
                intervals: [[0, edgeLen] as [number, number]],
              };
            })
          : undefined;
        const crestY = infinityEdges.length ? waterTopY : lip;
        const weirFaces = infinityEdges.map((e) => ({
          a: e.edgeA,
          b: e.edgeB,
        }));

        if (infinityEdges.length && infinityOmits && crestY < lip - 0.005) {
          // Solid shell up to weir crest, vanishing edge omitted so the wall
          // top does not cap the spill. A submerged sill is drawn below.
          pushWallRing(meshes, {
            outlineMm: wallOutline,
            bottomY: floorY,
            height: Math.max(0.05, crestY - floorY),
            thicknessMm: wallT,
            material: "poolShell",
            select,
            idPrefix: `pool_wall_${body.id}_low`,
            inward: true,
            openAgainst: spaBlockers.length > 0 ? spaBlockers : undefined,
            edgeOmits: infinityOmits,
            omitAgainst: weirFaces,
          });
          // Upper rim notched at vanishing openings (spa-style edge omit).
          pushWallRing(meshes, {
            outlineMm: wallOutline,
            bottomY: crestY,
            height: Math.max(0.02, lip - crestY),
            thicknessMm: wallT,
            material: "poolShell",
            select,
            idPrefix: `pool_wall_${body.id}_rim`,
            inward: true,
            openAgainst: spaBlockers.length > 0 ? spaBlockers : undefined,
            edgeOmits: infinityOmits,
            omitAgainst: weirFaces,
          });
        } else {
          pushWallRing(meshes, {
            outlineMm: wallOutline,
            bottomY: floorY,
            height: depthM + lip,
            thicknessMm: wallT,
            material: "poolShell",
            select,
            idPrefix: `pool_wall_${body.id}`,
            inward: true,
            // Drop pool walls on spa-facing edges; spa draws the spillover.
            openAgainst: spaBlockers.length > 0 ? spaBlockers : undefined,
          });
        }

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
          omitPerimeterAgainst:
            spaBlockers.length > 0 ? spaBlockers : undefined,
          holeOutlinesMm: spaClippers.length > 0 ? spaClippers : undefined,
          select,
        });

        // Thin coping cap along the pool lip (sales presentation).
        pushWallRing(meshes, {
          outlineMm: wallOutline,
          bottomY: lip * 0.15,
          height: lip * 0.85,
          thicknessMm: wallT * 1.15,
          material: "coping",
          select,
          idPrefix: `pool_coping_${body.id}`,
          inward: true,
          openAgainst: spaBlockers.length > 0 ? spaBlockers : undefined,
          edgeOmits: infinityOmits,
          omitAgainst: weirFaces,
        });

        // Waterline tile band on the wet face (inside waterline), not the
        // outer shell — old placement sat in the wall and flickered outside.
        pushWaterlineTileBand(meshes, {
          waterlineOutlineMm: waterInner,
          wallThicknessMm: wallT,
          waterTopY,
          waterlineTileId: body.waterlineTileId,
          select,
          idPrefix: `pool_tile_${body.id}`,
          openAgainst: spaBlockers.length > 0 ? spaBlockers : undefined,
          edgeOmits: infinityOmits,
          omitAgainst: weirFaces,
        });

        // Catch trough + fall sheets for infinity edges.
        pushInfinityEdgeMeshes(meshes, {
          poolId: body.id,
          edges: infinityEdges,
          crestY,
          floorY,
          wallThicknessMm: wallT,
          select,
        });

        const shallowFootprints = (design.features ?? [])
          .filter(
            (f) =>
              f.kind === "sunshelf" &&
              f.outline.length >= 3 &&
              (!f.poolBodyId || f.poolBodyId === body.id),
          )
          .map((f) => ({
            outlineMm: closeOutline(f.outline),
            depthMm: featureDepthMm(f.kind, f.depthMm),
          }));

        if (waterOutline.length >= 3) {
          pushProfileWater(meshes, {
            idPrefix: `pool_${body.id}`,
            outlineMm: waterOutline,
            waterTopY,
            select,
            waterMaterial: "poolWater",
            // Punch spa only — a sunshelf hole left a dry gap at the ledge.
            holeOutlinesMm: spaClippers.length > 0 ? spaClippers : undefined,
            omitSides: spaClippers.length > 0,
            shallowFootprints:
              shallowFootprints.length > 0 ? shallowFootprints : undefined,
            profile: profileFields,
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
      const parent =
        (f.poolBodyId
          ? bodies.find((b) => b.id === f.poolBodyId)
          : undefined) ??
        pools[0] ??
        bodies[0];
      // Steps / sunshelf show waterline tile by default (same finish as pool).
      const featureTilesOn = f.waterlineTiles !== false;
      const featureTileId =
        f.waterlineTileId ??
        parent?.waterlineTileId ??
        DEFAULT_WATERLINE_TILE_ID;
      const nosingBandMm = waterlineNosingBandMm(f.waterlineNosingBandMm);

      if (f.kind === "sunshelf") {
        // Solid shell fill from pool floor up to the ledge — no hollow undercroft.
        const shelfTop = waterTopY - mmToMeters(depthMm);
        const spaPunches = spas
          .filter((s) => s.outline.length >= 3)
          .map((s) => paddedAabbRing(s.outline, 40));
        const shelfOutline =
          spaPunches.length > 0
            ? clipOutlineByAabbs(outline, spaPunches)
            : outline;
        if (shelfOutline.length < 3) continue;
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
          outlineMm: closeOutline(shelfOutline),
          bottomY: shelfTop - fillH,
          height: fillH,
          select,
        });
        // Flat nosing band on the shelf TOP (marks the edge — not a riser wrap).
        if (featureTilesOn) {
          pushShelfTopTileBands(meshes, {
            outlineMm: closeOutline(shelfOutline),
            topY: shelfTop,
            bandWidthMm: nosingBandMm,
            waterlineTileId: featureTileId,
            select,
            idPrefix: `feature_sunshelf_tile_${f.id}`,
          });
        }
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
        // Solid treads from the basin floor up, descending into the pool.
        const risers = stepsRiserCount(f.riserCount);
        const riserM = mmToMeters(STANDARD_STEP_RISER_MM);
        const runSign = stepsRunSignTowardPool(
          f.outline,
          risers,
          parent?.outline ?? [],
        );
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
        for (let s = 0; s < risers; s++) {
          const tread = stepsTreadOutline(f.outline, s, risers, runSign);
          if (tread.length < 3) continue;
          // s=0 is the top/entry tread (nearest waterline / wall)
          const top = waterTopY - riserM * (s + 1);
          const height = Math.max(riserM * 1.08, top - floorY);
          meshes.push({
            kind: "extrude",
            id: `feature_steps_${f.id}_${s}`,
            material: "poolShell",
            outlineMm: closeOutline(tread),
            bottomY: top - height,
            height,
            select,
          });
          // Tile band on the tread TOP at the deep nosing (into the pool).
          if (featureTilesOn && tread.length >= 4) {
            // stepsTreadOutline: [0],[1] = wall-side edge; [2],[3] = pool nosing.
            const deepA = tread[3];
            const deepB = tread[2];
            let cx = 0;
            let cy = 0;
            for (const p of tread) {
              cx += p.x;
              cy += p.y;
            }
            cx /= tread.length;
            cy /= tread.length;
            const mid = {
              x: (deepA.x + deepB.x) / 2,
              y: (deepA.y + deepB.y) / 2,
            };
            pushTopEdgeTileBand(meshes, {
              a: deepA,
              b: deepB,
              inwardX: cx - mid.x,
              inwardY: cy - mid.y,
              bandWidthMm: nosingBandMm,
              topY: top,
              waterlineTileId: featureTileId,
              select,
              id: `feature_steps_tile_${f.id}_${s}`,
            });
          }
        }
      }
    }
  }

  // Pad manifold (risers + above-grade hops) always draws with the equipment.
  // Buried body↔pad trenches stay behind the Plumbing review toggle.
  for (const run of design.plumbingRuns ?? []) {
    if (run.points.length < 2) continue;
    const isPadLocal = run.padLocal === true;
    if (
      !isPadLocal &&
      !(options.showPlumbing && layerVisible(design, "plumbing"))
    ) {
      continue;
    }
    const dia = Math.max(20, run.pipeDiameterMm ?? 50.8);
    meshes.push({
      kind: "tube",
      id: `pipe_${run.id}`,
      material: pipeMaterialForCircuit(run.circuit),
      pointsMm: run.points,
      radiusM: mmToMeters(dia / 2),
      y: -0.42,
      ...(run.elevationsMm?.length === run.points.length
        ? { elevationsMm: run.elevationsMm }
        : {}),
      select: { kind: "run", id: run.id },
    });
  }

  if (options.showSiteLines) {
    const deckTopY = mmToMeters(PATIO_SLAB_THICKNESS_MM);
    const patios = design.patios ?? [];
    const markY = (plan: PointMm): number => {
      for (const patio of patios) {
        if (patio.outline.length >= 3 && pointInPolygon(plan, patio.outline)) {
          return deckTopY;
        }
      }
      return -mmToMeters(existingGradeDropMm(plan, gradeSamples));
    };
    let markI = 0;
    for (const line of design.siteLines ?? []) {
      if (line.points.length < 2) continue;
      if (!anyLayerVisible(design, ...siteLineLayerIds(line.kind))) continue;
      const samples = densifyWorldPolyline(
        line.points,
        line.closed === true,
        markY,
      );
      if (samples.length < 2) continue;
      const isEasement = line.kind === "easement";
      const recordedW = isEasement ? line.widthMm ?? 0 : 0;
      if (isEasement && recordedW > 8) {
        meshes.push({
          kind: "groundMark",
          id: `siteline_${line.id}_band_${markI++}`,
          points: samples,
          widthM: Math.max(0.45, mmToMeters(recordedW)),
          heightM: 0.08,
          colorHex: "#7b4bb8",
          opacity: 0.55,
        });
      }
      const centerWidth = isEasement ? 0.18 : 0.28;
      const color = isEasement ? "#e2c8ff" : "#ffd24a";
      for (const chain of dashedWorldChains(samples, 1.2, 0.45)) {
        meshes.push({
          kind: "groundMark",
          id: `siteline_${line.id}_dash_${markI++}`,
          points: chain,
          widthM: centerWidth,
          heightM: 0.16,
          colorHex: color,
          opacity: 1,
        });
      }
    }
  }

  if (layerVisible(design, "fence")) {
    const deckTopY = mmToMeters(PATIO_SLAB_THICKNESS_MM);
    const patios = design.patios ?? [];
    /** Surface the fence sits on: patio top on deck, else existing grade. */
    const fenceBaseY = (plan: PointMm): number => {
      for (const patio of patios) {
        if (
          patio.outline.length >= 3 &&
          pointInPolygon(plan, patio.outline)
        ) {
          return deckTopY;
        }
      }
      return -mmToMeters(existingGradeDropMm(plan, gradeSamples));
    };

    const pushRackedPanel = (
      id: string,
      p0: PointMm,
      p1: PointMm,
      heightM: number,
      material: SceneMaterialKey,
      select: SceneSelection,
      opts: {
        colorHex: string;
        opacity?: number;
        thicknessM: number;
        kind: string;
        liftM?: number;
        midRail?: boolean;
        omitPosts?: boolean;
        brace?: boolean;
      },
    ) => {
      const xz0 = planToWorldXZ(p0);
      const xz1 = planToWorldXZ(p1);
      const lift = opts.liftM ?? 0;
      const y0 = fenceBaseY(p0) + lift;
      const y1 = fenceBaseY(p1) + lift;
      const a = { x: xz0.x, y: y0, z: xz0.z };
      const b = { x: xz1.x, y: y1, z: xz1.z };
      let picketWidthM: number | undefined;
      let picketGapM: number | undefined;
      let postSizeM: number | undefined;
      let railHeightM: number | undefined;
      let railDepthM: number | undefined;
      let picketDepthM: number | undefined;
      let picketNotchM: number | undefined;
      let privacyBoards = false;
      let postCap = false;
      if (opts.kind === "vinyl") {
        // 5×5 post, 2.5″ routed rails, 6″ T&G pickets notched into the rails.
        postSizeM = 0.127;
        picketWidthM = 0.152;
        picketGapM = 0.003;
        railHeightM = 0.064;
        railDepthM = 0.09;
        picketDepthM = 0.022;
        picketNotchM = 0.028;
        privacyBoards = true;
        postCap = !opts.omitPosts;
      } else if (opts.kind === "wood") {
        // Privacy: solid bay between posts (no board gaps).
        postSizeM = 0.115; // ~4.5″ post
      } else if (opts.kind === "chain_link") {
        picketWidthM = 0.012;
        picketGapM = 0.045;
        postSizeM = 0.06;
      } else if (opts.kind === "glass") {
        postSizeM = 0.05; // glass spigot / post
      } else {
        // aluminum / wrought iron — open pickets
        picketWidthM = 0.045;
        picketGapM = 0.085;
        postSizeM = 0.065;
      }
      const privacySlab = opts.kind === "wood";
      meshes.push({
        kind: "fencePanel",
        id,
        material,
        a,
        b,
        heightM,
        // Wood slabs match post depth so you can't see past thin panels.
        thicknessM: privacySlab
          ? Math.max(opts.thicknessM, (postSizeM ?? 0.1) * 0.85)
          : (railDepthM ?? opts.thicknessM),
        colorHex: opts.colorHex,
        opacity: opts.opacity,
        picketWidthM,
        picketGapM,
        postSizeM,
        railHeightM,
        railDepthM,
        picketDepthM,
        picketNotchM,
        privacyBoards,
        postCap,
        midRail: opts.midRail,
        omitPosts: opts.omitPosts,
        brace: opts.brace,
        select,
      });
    };

    const waterCentroids = (design.poolBodies ?? [])
      .filter((b) => b.outline.length >= 3)
      .map((b) => polygonCentroid(b.outline))
      .filter((c): c is PointMm => Boolean(c));

    const pushGateBox = (
      id: string,
      position: { x: number; y: number; z: number },
      size: { x: number; y: number; z: number },
      along: { x: number; z: number },
      material: SceneMaterialKey,
      select: SceneSelection,
      primitive: BoxDescriptor["primitive"] = "box",
      colorHex?: string,
    ) => {
      meshes.push({
        kind: "box",
        id,
        material,
        position,
        size,
        rotationY: 0,
        axisX: along,
        primitive,
        colorHex,
        select,
      });
    };

    for (const fence of design.fences ?? []) {
      if (fence.points.length < 2) continue;
      const finish = resolveFenceFinish(fence.kind, fence.finishId);
      const colorHex = fenceFinishHex(finish);
      const hMm = fence.heightMm ?? defaultFenceHeightMm(fence.kind);
      const hM = Math.max(0.6, mmToMeters(hMm));
      const thickM = Math.max(0.03, mmToMeters(FENCE_THICKNESS_MM));
      const select: SceneSelection = { kind: "fence", id: fence.id };
      const isGlass = fence.kind === "glass";
      const opacity = isGlass
        ? finish.id.includes("frosted")
          ? 0.55
          : 0.35
        : fence.kind === "chain_link"
          ? 0.8
          : undefined;
      // Short spans so a non-planar grade still reads along the run.
      const PANEL_STEP_MM = 2400;

      for (let i = 0; i < fence.points.length - 1; i++) {
        const a = fence.points[i];
        const b = fence.points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 40) continue;

        const gatesOnEdge = (fence.gates ?? []).filter((g) => g.edgeIndex === i);
        const cuts: { t0: number; t1: number }[] = [{ t0: 0, t1: 1 }];
        for (const gate of gatesOnEdge) {
          const half = Math.min(gate.widthMm / 2, len / 2) / len;
          const t = Math.min(1 - half, Math.max(half, gate.t));
          const next: { t0: number; t1: number }[] = [];
          for (const span of cuts) {
            const g0 = t - half;
            const g1 = t + half;
            if (g1 <= span.t0 || g0 >= span.t1) {
              next.push(span);
              continue;
            }
            if (g0 > span.t0) next.push({ t0: span.t0, t1: g0 });
            if (g1 < span.t1) next.push({ t0: g1, t1: span.t1 });
          }
          cuts.length = 0;
          cuts.push(...next);
        }

        let panel = 0;
        for (const span of cuts) {
          const spanLenMm = (span.t1 - span.t0) * len;
          if (spanLenMm < 40) continue;
          const steps = Math.max(1, Math.ceil(spanLenMm / PANEL_STEP_MM));
          for (let s = 0; s < steps; s++) {
            const u0 = span.t0 + ((span.t1 - span.t0) * s) / steps;
            const u1 = span.t0 + ((span.t1 - span.t0) * (s + 1)) / steps;
            const p0 = { x: a.x + dx * u0, y: a.y + dy * u0 };
            const p1 = { x: a.x + dx * u1, y: a.y + dy * u1 };
            pushRackedPanel(
              `fence_${fence.id}_${i}_${panel++}`,
              p0,
              p1,
              hM,
              "fence",
              select,
              {
                colorHex,
                opacity,
                thicknessM: thickM,
                kind: fence.kind,
              },
            );
          }
        }
      }

      for (const gate of fence.gates ?? []) {
        const geom = gateEndpoints(fence.points, gate);
        if (!geom) continue;
        const gateHMm =
          gate.heightMm ?? fence.heightMm ?? defaultFenceHeightMm(fence.kind);
        const clearanceM = mmToMeters(POOL_GATE_GROUND_CLEARANCE_MM);
        const leafHM = Math.max(0.55, mmToMeters(gateHMm) - clearanceM);
        const gateSelect: SceneSelection = {
          kind: "gate",
          fenceId: fence.id,
          id: gate.id,
        };
        const outward = gateOutwardNormal(geom.a, geom.b, waterCentroids);
        const leafColor = darkenHex(colorHex, 0.16);
        const postSizeM =
          fence.kind === "vinyl"
            ? 0.127
            : fence.kind === "wood"
              ? 0.115
              : fence.kind === "chain_link"
                ? 0.06
                : fence.kind === "glass"
                  ? 0.05
                  : 0.065;

        const jamb = (p: PointMm, tag: string) => {
          const xz = planToWorldXZ(p);
          const y0 = fenceBaseY(p);
          const h = Math.max(leafHM + clearanceM, hM);
          pushGateBox(
            `gate_${fence.id}_${gate.id}_${tag}`,
            { x: xz.x, y: y0 + h / 2, z: xz.z },
            { x: postSizeM, y: h, z: postSizeM },
            gateWorldBasis(geom.a, geom.b, outward).along,
            "gate",
            gateSelect,
            "box",
            colorHex,
          );
        };
        jamb(geom.a, "jambA");
        jamb(geom.b, "jambB");

        const offsetA = offsetPlan(geom.a, outward, GATE_LEAF_OFFSET_MM);
        const offsetB = offsetPlan(geom.b, outward, GATE_LEAF_OFFSET_MM);
        const mid = {
          x: (offsetA.x + offsetB.x) / 2,
          y: (offsetA.y + offsetB.y) / 2,
        };

        type Leaf = { a: PointMm; b: PointMm; hingeAtStart: boolean };
        const leaves: Leaf[] =
          gate.kind === "double_swing"
            ? [
                {
                  a: offsetA,
                  b: swingLeafFar(
                    offsetA,
                    mid,
                    outward,
                    GATE_SWING_OPEN_RAD,
                  ),
                  hingeAtStart: true,
                },
                {
                  a: swingLeafFar(
                    offsetB,
                    mid,
                    outward,
                    GATE_SWING_OPEN_RAD,
                  ),
                  b: offsetB,
                  hingeAtStart: false,
                },
              ]
            : gate.kind === "sliding"
              ? [{ a: offsetA, b: offsetB, hingeAtStart: true }]
              : [
                  {
                    a: offsetA,
                    b: swingLeafFar(
                      offsetA,
                      offsetB,
                      outward,
                      GATE_SWING_OPEN_RAD,
                    ),
                    hingeAtStart: true,
                  },
                ];

        leaves.forEach((leaf, li) => {
          const leafThickM =
            fence.kind === "wood"
              ? Math.max(thickM * 0.95, postSizeM * 0.85)
              : fence.kind === "vinyl"
                ? 0.09
                : thickM * 0.95;
          pushRackedPanel(
            `gate_${fence.id}_${gate.id}_leaf${li}`,
            leaf.a,
            leaf.b,
            leafHM,
            "gate",
            gateSelect,
            {
              colorHex: leafColor,
              opacity: isGlass ? 0.5 : opacity,
              thicknessM: thickM * 0.95,
              kind: fence.kind,
              liftM: clearanceM,
              midRail: true,
              omitPosts: true,
              brace: gate.kind !== "sliding" && fence.kind !== "glass",
            },
          );

          const { along, out } = gateWorldBasis(leaf.a, leaf.b, outward);
          const wa = planToWorldXZ(leaf.a);
          const wb = planToWorldXZ(leaf.b);
          const y0 = fenceBaseY(leaf.a) + clearanceM;
          const y1 = fenceBaseY(leaf.b) + clearanceM;
          const leafLenM = Math.hypot(wb.x - wa.x, wb.z - wa.z) || 1;
          const stileInsetT = Math.min(0.12, 0.05 / leafLenM);
          const alongT = (t: number, upM: number, outM: number) =>
            rackedLeafPoint(wa, wb, y0, y1, out, t, upM, outM);
          const stileT = leaf.hingeAtStart ? stileInsetT : 1 - stileInsetT;
          const latchT = leaf.hingeAtStart ? 1 - stileInsetT : stileInsetT;
          const faceOut = leafThickM / 2;
          const leafHMm = Math.round(leafHM * 1000);

          if (gate.kind !== "sliding") {
            for (const hMm of poolGateHingeHeightsMm(leafHMm)) {
              const upM = mmToMeters(hMm);
              // Barrels on the outside face of the hinge stile.
              pushGateBox(
                `gate_${fence.id}_${gate.id}_h${li}_${Math.round(hMm)}`,
                alongT(stileT, upM, faceOut + 0.02),
                { x: 0.038, y: 0.09, z: 0.038 },
                along,
                "gateSteel",
                gateSelect,
                "cylinderY",
              );
              // TruClose-style spring body, also outside.
              pushGateBox(
                `gate_${fence.id}_${gate.id}_s${li}_${Math.round(hMm)}`,
                alongT(stileT, upM + 0.04, faceOut + 0.05),
                { x: 0.028, y: 0.16, z: 0.028 },
                along,
                "gateSteel",
                gateSelect,
                "cylinderY",
              );
            }
          } else {
            // Sliding: top rollers on the outside of the upper rail.
            for (const t of [0.18, 0.5, 0.82]) {
              pushGateBox(
                `gate_${fence.id}_${gate.id}_roll_${t}`,
                alongT(t, leafHM - 0.03, faceOut + 0.02),
                { x: 0.05, y: 0.048, z: 0.048 },
                along,
                "gateSteel",
                gateSelect,
                "cylinderX",
              );
            }
          }

          const latch = poolGateLatchSpec(leafHMm);
          const latchFace =
            latch.face === "outside" ? faceOut + 0.035 : -(faceOut + 0.035);
          const latchUp = mmToMeters(latch.heightMm);
          pushGateBox(
            `gate_${fence.id}_${gate.id}_latch${li}`,
            alongT(latchT, latchUp, latchFace),
            { x: 0.055, y: 0.2, z: 0.07 },
            along,
            "gateLatch",
            gateSelect,
          );
          pushGateBox(
            `gate_${fence.id}_${gate.id}_btn${li}`,
            alongT(
              latchT,
              latchUp + 0.12,
              latchFace + (latch.face === "outside" ? 0.01 : -0.01),
            ),
            { x: 0.034, y: 0.042, z: 0.034 },
            along,
            "gateButton",
            gateSelect,
            "cylinderY",
          );
        });
      }
    }
  }

  if (anyLayerVisible(design, "furniture")) {
    let bi = 0;
    const patios = design.patios ?? [];
    for (const bed of design.flowerBeds ?? []) {
      if (bed.outline.length < 3) continue;
      const select: SceneSelection = { kind: "flowerBed", id: bed.id };
      if (bed.style === "raised") {
        const wallFinish = resolveFlowerBedWallFinish(bed.wallFinish);
        const wallMm = flowerBedWallThicknessMm(wallFinish);
        const wallH = mmToMeters(flowerBedHeightMm(bed));
        const inner = insetClosedOutline(bed.outline, wallMm);
        const innerOk =
          inner.length >= 3 &&
          Math.abs(polygonAreaMm2(inner)) >
            Math.abs(polygonAreaMm2(bed.outline)) * 0.15;
        const walls: DrapedTris = { positions: [], uvs: [], indices: [] };
        appendDrapedWallRing(
          walls,
          bed.outline,
          patios,
          gradeSamples,
          0.04,
          wallH + 0.04,
          false,
        );
        if (innerOk) {
          appendDrapedWallRing(
            walls,
            inner,
            patios,
            gradeSamples,
            0.04,
            wallH + 0.04,
            true,
          );
        }
        const cap: DrapedTris = { positions: [], uvs: [], indices: [] };
        appendDrapedPolygon(
          cap,
          bed.outline,
          patios,
          gradeSamples,
          wallH,
          innerOk ? inner : undefined,
        );
        if (walls.indices.length >= 3) {
          meshes.push({
            kind: "triMesh",
            id: `flowerbed_wall_${bed.id}_${bi++}`,
            material: "flowerBedWall",
            positions: walls.positions,
            uvs: walls.uvs,
            indices: walls.indices,
            flowerBedWallFinish: wallFinish,
            select,
          });
        }
        if (cap.indices.length >= 3) {
          meshes.push({
            kind: "triMesh",
            id: `flowerbed_cap_${bed.id}_${bi++}`,
            material: "flowerBedWall",
            positions: cap.positions,
            uvs: cap.uvs,
            indices: cap.indices,
            flowerBedWallFinish: wallFinish,
            select,
          });
        }
        const soil: DrapedTris = { positions: [], uvs: [], indices: [] };
        appendDrapedPolygon(
          soil,
          innerOk ? inner : bed.outline,
          patios,
          gradeSamples,
          Math.max(0.06, wallH - 0.05),
        );
        if (soil.indices.length >= 3) {
          meshes.push({
            kind: "triMesh",
            id: `flowerbed_soil_${bed.id}_${bi++}`,
            material: "flowerBedSoil",
            positions: soil.positions,
            uvs: soil.uvs,
            indices: soil.indices,
            flowerBedSoilKind: "mulch",
            select,
          });
        }
      } else {
        const soil: DrapedTris = { positions: [], uvs: [], indices: [] };
        appendDrapedPolygon(
          soil,
          bed.outline,
          patios,
          gradeSamples,
          TILLED_SOIL_LIFT_M,
        );
        if (soil.indices.length >= 3) {
          meshes.push({
            kind: "triMesh",
            id: `flowerbed_soil_${bed.id}_${bi++}`,
            material: "flowerBedSoil",
            positions: soil.positions,
            uvs: soil.uvs,
            indices: soil.indices,
            flowerBedSoilKind: "tilled",
            select,
          });
        }
      }
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
    // Plan atan2(dy,dx) → Three yaw so local +Z points into the vessel.
    const rotationY = isWallFacingCatalogId(obj.catalogItemId)
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
    const coverY = coverAccessoryCenterY(
      obj.position,
      obj.catalogItemId,
      h,
      design.patioCovers ?? [],
    );
    const shelfTopY = sunshelfSurfaceY(
      obj.position,
      design.features ?? [],
      waterTopY,
    );
    const shelfY =
      shelfTopY != null &&
      !isCoverAccessoryId(obj.catalogItemId) &&
      fixtureY == null &&
      !isEquip
        ? shelfTopY + h / 2
        : null;
    // Deck furniture sits on the patio slab; trees and yard objects sit on
    // existing grade so downhill grass doesn't leave them floating at FFE.
    const onPatio = (design.patios ?? []).some(
      (p) => p.outline.length >= 3 && pointInPolygon(obj.position, p.outline),
    );
    const inBed = (design.flowerBeds ?? []).find(
      (b) => b.outline.length >= 3 && pointInPolygon(obj.position, b.outline),
    );
    const groundY = inBed
      ? flowerBedSoilTopY(inBed, obj.position, design.patios ?? [], gradeSamples)
      : onPatio
        ? mmToMeters(PATIO_SLAB_THICKNESS_MM)
        : -mmToMeters(existingGradeDropMm(obj.position, gradeSamples));
    const y =
      fixtureY ??
      coverY ??
      personY ??
      shelfY ??
      groundY + h / 2;

    const isBubbler =
      obj.catalogItemId === "spa_bubbler" ||
      obj.catalogItemId === "pool_bubbler";
    let bubblerWaterY: number | undefined;
    if (isBubbler) {
      const spaParent =
        (obj.parentBodyId
          ? spas.find((s) => s.id === obj.parentBodyId)
          : undefined) ??
        spas.find((s) => pointInPolygon(obj.position, s.outline));
      if (spaParent && obj.catalogItemId === "spa_bubbler") {
        const joinsPool = pools.some((p) =>
          waterBodiesConnected(p.outline, spaParent.outline),
        );
        bubblerWaterY = spaElevations(
          spaParent,
          waterTopY,
          joinsPool,
        ).waterTopY;
      } else {
        bubblerWaterY = waterTopY;
      }
    }

    meshes.push({
      kind: "box",
      id: `object_${obj.id}`,
      material: isEquip ? "equipment" : "object",
      position: { x: xz.x, y, z: xz.z },
      size: { x: w, y: h, z: d },
      rotationY,
      catalogItemId: obj.catalogItemId,
      frameFinishId: obj.frameFinishId,
      fabricFinishId: obj.fabricFinishId,
      vineId: obj.vineId,
      ...(bubblerWaterY != null ? { waterSurfaceY: bubblerWaterY } : {}),
      ...(isBubbler ? { hasLedLight: obj.hasLedLight === true } : {}),
      ...(obj.catalogItemId === "person_scale"
        ? {
            personSex: obj.personSex,
            personOutfitId: obj.personOutfitId,
          }
        : {}),
      select: { kind: "object", id: obj.id },
    });
  }

  // Drop pool wall/coping/tile boxes whose center still sits inside a spa —
  // leftover from an outer pool edge that continues through the overlap.
  const spaOutlines = spas.map((s) => s.outline).filter((o) => o.length >= 3);
  if (spaOutlines.length > 0) {
    const kept: MeshDescriptor[] = [];
    for (const m of meshes) {
      if (
        m.kind === "box" &&
        (m.id.startsWith("pool_wall") ||
          m.id.startsWith("pool_coping") ||
          m.id.startsWith("pool_tile"))
      ) {
        const plan = {
          x: -m.position.x * 1000,
          y: -m.position.z * 1000,
        };
        if (spaOutlines.some((s) => pointInPolygon(plan, s))) continue;
      }
      kept.push(m);
    }
    meshes.length = 0;
    meshes.push(...kept);
  }

  return { center, groundSize, ground, meshes };
}
