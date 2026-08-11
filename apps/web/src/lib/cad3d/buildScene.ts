import {
  COVER_SLAB_THICKNESS_MM,
  PATIO_SLAB_THICKNESS_MM,
  POOL_LIP_THICKNESS_MM,
  POOL_WALL_THICKNESS_MM,
  POOL_WATER_FREEBOARD_MM,
  analyzePatioGrade,
  approximateIntersectionAreaMm2,
  buildingHeightMm,
  clipOutlineByAabbs,
  coverHeightMm,
  depthMmAtT,
  depthProfileForBody,
  depthTAtPlanPoint,
  designBoundsMm,
  existingGradeDropMm,
  featureDepthMm,
  formatLength,
  insideOutlineFromOutside,
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
  mmToMeters,
  openingSillMm,
  resolveCeilingHeightMm,
  resolveFenceFinish,
  resolveHouseExteriorColor,
  FLOOR_STRUCTURE_THICKNESS_MM,
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
  resolveGradeStrategy,
  spaNeedsDeckPit,
  spaShellParams,
  spaTotalDepthMm,
  subtractAabbHoles,
  resolveSpaSpillovers,
  spilloverOmitIntervals,
  wallSegmentsMinusIntervals,
  waterBodiesConnected,
  waterBodyKind,
  ensurePadManifoldPlumbing,
  repairAutoPlumbingIfNeeded,
  type BuildingOpeningKind,
  type DepthTransition,
  type DesignDocument,
  type PointMm,
  type ResolvedSpaSpillover,
} from "@pool-design/shared";
import {
  openOutlineRing,
  openingEndpoints,
  resolveOpeningEdge,
} from "@/lib/cad/draw";

/** Mirrors CadWorkspace selection (non-null). */
export type SceneSelection =
  | { kind: "pool"; id: string }
  | { kind: "patio"; id: string }
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
  | "fence"
  | "gate";

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
  /** Furniture wood / frame finish id. */
  frameFinishId?: string;
  /** Furniture cushion / canopy finish id. */
  fabricFinishId?: string;
  /** Optional solid color override (e.g. fence powder coat). */
  colorHex?: string;
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
 * Curved spa spillover at a corner where two weirs meet.
 * Plan normals point outward (toward the pool); the mesh sweeps the exterior arc.
 */
export type SpilloverCornerDescriptor = {
  kind: "spilloverCorner";
  id: string;
  material: "spilloverWater";
  /** Spa outline corner in plan mm. */
  cornerMm: PointMm;
  /** Outward plan normal of the first weir. */
  normal0: PointMm;
  /** Outward plan normal of the second weir. */
  normal1: PointMm;
  /** World Y of weir crest (top of sheet). */
  crestY: number;
  /** World Y where the sheet meets the pool water. */
  poolWaterY: number;
  /** Radius at the lip (m) — typically ~ wall thickness / 2. */
  lipRadiusM: number;
  /** Extra radial throw at the pool (m). */
  flareM: number;
  opacity?: number;
} & Selectable;

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
  /** Exterior wall tint (multiplies stucco albedo). */
  colorHex?: string;
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

export type MeshDescriptor =
  | ExtrudeDescriptor
  | BoxDescriptor
  | SpilloverCornerDescriptor
  | FloorDescriptor
  | WaterBodyDescriptor
  | TubeDescriptor
  | TerrainDescriptor
  | FencePanelDescriptor
  | WallPanelDescriptor;

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

function closeOutline(outline: PointMm[]): PointMm[] {
  if (outline.length < 3) return outline;
  const first = outline[0];
  const last = outline[outline.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) < 1) return outline;
  return [...outline, first];
}

/** Expand a plan outline away from its centroid (eaves / roof overhang). */
function expandOutlineFromCentroid(outline: PointMm[], mm: number): PointMm[] {
  const open =
    outline.length > 1 &&
    Math.hypot(
      outline[0].x - outline[outline.length - 1].x,
      outline[0].y - outline[outline.length - 1].y,
    ) < 1
      ? outline.slice(0, -1)
      : outline;
  if (open.length < 3) return outline;
  const bb = outlineBounds(open);
  return open.map((p) => {
    const dx = p.x - bb.cx;
    const dy = p.y - bb.cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * mm, y: p.y + (dy / len) * mm };
  });
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
    /**
     * Omit intervals along specific outline edges (edge index → mm ranges
     * from edge start). Used for spa spillover weir notches.
     */
    edgeOmits?: { edgeIndex: number; intervals: [number, number][] }[];
  },
) {
  const pts = ringPoints(opts.outlineMm);
  if (pts.length < 3) return;
  const thickM = mmToMeters(opts.thicknessMm);
  let segIndex = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    let segments =
      opts.openAgainst && opts.openAgainst.length > 0
        ? openWallSegments(a, b, opts.openAgainst)
        : Math.hypot(b.x - a.x, b.y - a.y) >= 40
          ? [{ a, b }]
          : [];
    const omit = opts.edgeOmits?.find((o) => o.edgeIndex === i);
    if (omit && omit.intervals.length > 0) {
      // Notch against the full edge, then keep only pieces that remain in
      // the openAgainst result (usually the full edge for spa shells).
      const notched = wallSegmentsMinusIntervals(a, b, omit.intervals);
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

/**
 * Pull straight weir openings back from shared corners so the curved corner
 * curtain owns the wrap (avoids a hard vertical sheet edge at the vertex).
 */
function insetSpillOpeningsAtCorners(
  spills: ResolvedSpaSpillover[],
  spaOutline: PointMm[],
  insetMm: number,
): ResolvedSpaSpillover[] {
  if (spills.length < 2 || insetMm < 1) return spills;
  const pts = ringPoints(spaOutline);
  const n = pts.length;
  if (n < 3) return spills;

  const cornerVerts = new Set<string>();
  const keyOf = (p: PointMm) => `${Math.round(p.x)}:${Math.round(p.y)}`;
  const byEdge = new Map(spills.map((s) => [s.edgeIndex, s]));
  for (const s of spills) {
    const next = (s.edgeIndex + 1) % n;
    if (byEdge.has(next)) cornerVerts.add(keyOf(pts[next]));
  }

  const insetEnd = (from: PointMm, to: PointMm, corner: PointMm): PointMm => {
    // If `to` is at the corner, pull it toward `from`.
    if (Math.hypot(to.x - corner.x, to.y - corner.y) > 160) return to;
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const pull = Math.min(insetMm, len * 0.35);
    const ux = (from.x - to.x) / len;
    const uy = (from.y - to.y) / len;
    return { x: to.x + ux * pull, y: to.y + uy * pull };
  };

  return spills.map((spill) => {
    const edgeA = pts[spill.edgeIndex];
    const edgeB = pts[(spill.edgeIndex + 1) % n];
    const startCorner = cornerVerts.has(keyOf(edgeA)) ? edgeA : null;
    const endCorner = cornerVerts.has(keyOf(edgeB)) ? edgeB : null;
    if (!startCorner && !endCorner) return spill;

    const openings = spill.openings.map((o) => {
      let a = o.a;
      let b = o.b;
      if (startCorner) {
        // Whichever endpoint is nearer the start corner gets inset.
        if (
          Math.hypot(a.x - startCorner.x, a.y - startCorner.y) <=
          Math.hypot(b.x - startCorner.x, b.y - startCorner.y)
        ) {
          a = insetEnd(b, a, startCorner);
        } else {
          b = insetEnd(a, b, startCorner);
        }
      }
      if (endCorner) {
        if (
          Math.hypot(a.x - endCorner.x, a.y - endCorner.y) <=
          Math.hypot(b.x - endCorner.x, b.y - endCorner.y)
        ) {
          a = insetEnd(b, a, endCorner);
        } else {
          b = insetEnd(a, b, endCorner);
        }
      }
      return { a, b };
    });
    return { ...spill, openings };
  });
}

/**
 * Curved spillover curtain where two weirs meet — sweeps the exterior corner
 * arc with the same free-fall pour profile as the straight sheets.
 */
function pushSpilloverCornerCascades(
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
  if (opts.spills.length < 2) return;
  const pts = ringPoints(opts.spaOutline);
  const n = pts.length;
  if (n < 3) return;

  const byEdge = new Map(opts.spills.map((s) => [s.edgeIndex, s]));
  const near = (a: PointMm, b: PointMm, tol = 140) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= tol;

  let cornerIdx = 0;
  const seen = new Set<string>();

  const emitCorner = (
    vertex: PointMm,
    spill: ResolvedSpaSpillover,
    next: ResolvedSpaSpillover,
  ) => {
    const key = `${Math.round(vertex.x)}:${Math.round(vertex.y)}`;
    if (seen.has(key)) return;
    seen.add(key);

    const n0 = cascadeOutwardNormal(spill.a, spill.b, opts.spaOutline);
    const n1 = cascadeOutwardNormal(next.a, next.b, opts.spaOutline);
    // Ensure both normals point toward the pool / away from spa interior.
    const n0p = { x: n0.nx, y: n0.ny };
    const n1p = { x: n1.nx, y: n1.ny };

    const lipRadiusM = Math.max(0.04, mmToMeters(opts.wallThicknessMm) * 0.55);
    const drop = Math.max(0.05, opts.crestY - opts.poolWaterTopY);
    const flareM = Math.max(0.1, Math.min(0.34, drop * 0.95));

    meshes.push({
      kind: "spilloverCorner",
      id: `${opts.idPrefix}_${cornerIdx++}`,
      material: "spilloverWater",
      cornerMm: vertex,
      normal0: n0p,
      normal1: n1p,
      crestY: opts.crestY - 0.008,
      poolWaterY: opts.poolWaterTopY + 0.004,
      lipRadiusM,
      flareM,
      opacity: spill.style === "sheer" ? 0.55 : 0.78,
      select: opts.select,
    });
  };

  for (const spill of opts.spills) {
    const nextIdx = (spill.edgeIndex + 1) % n;
    const next = byEdge.get(nextIdx);
    if (next) {
      emitCorner(pts[nextIdx], spill, next);
      continue;
    }

    for (const other of opts.spills) {
      if (other.edgeIndex === spill.edgeIndex) continue;
      const hits =
        (near(spill.a, other.a) && spill.a) ||
        (near(spill.a, other.b) && spill.a) ||
        (near(spill.b, other.a) && spill.b) ||
        (near(spill.b, other.b) && spill.b);
      if (!hits || typeof hits === "boolean") continue;
      let vertex = hits;
      let bestD = Infinity;
      for (const p of pts) {
        const d = Math.hypot(p.x - hits.x, p.y - hits.y);
        if (d < bestD) {
          bestD = d;
          vertex = p;
        }
      }
      emitCorner(vertex, spill, other);
    }
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

  if (isPoolBubbler || isJet || isLight) {
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

    const pool =
      (parentId
        ? opts.pools.find((p) => p.id === parentId)
        : undefined) ??
      opts.pools.find((p) => pointInPolygon(obj.position, p.outline)) ??
      // Wall fixtures sit just inside the shell — still associate with nearest pool.
      (isJet || isLight
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
      if (isPoolBubbler || isDrain) {
        return Math.min(opts.poolWaterTopY - 0.05, floorY + 0.028);
      }
      if (isLight) {
        // Also treat walls beside a sunshelf as shelf lighting (~4″).
        const nearShelf = opts.features.some(
          (f) =>
            f.kind === "sunshelf" &&
            f.outline.length >= 3 &&
            // Within ~2′ of the shelf footprint in plan.
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
      // Wall jet: mid-water for the local depth.
      const waterDepth = opts.poolWaterTopY - floorY;
      const y = floorY + waterDepth * 0.45;
      return Math.min(
        opts.poolWaterTopY - 0.12,
        Math.max(floorY + 0.15, y),
      );
    }

    // Last resort: main-wall niche depth under the freeboard.
    if (isLight) return opts.poolWaterTopY - LIGHT_BELOW_WATER_MAIN_M;
    return opts.poolWaterTopY - 0.18;
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
  const gradeSamples = design.gradeSamples ?? [];
  const hasGradeSamples = gradeSamples.length > 0;

  // Prefer solid AABB slabs with pits subtracted (reliable). Fall back to
  // Extrude holes only when the outline isn't a rectangle.
  // Always punch pool/spa pits out of grade so basins stay clear.
  const groundRegions = subtractAabbHoles(groundOutline, poolPitHoles);
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
    holeOutlinesMm: groundRegions.length > 0 ? [] : poolPitHoles,
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
      const colorHex = houseExteriorHex(
        resolveHouseExteriorColor(b.exteriorFinishId, b.exteriorColor),
      );
      const wallTmm = 180;
      // Exact same ring as resolveOpeningEdge / openingEndpoints.
      const pts = openOutlineRing(b.outline);
      const bb = outlineBounds(b.outline);

      // Yard-facing edge — used for walk spawn views when no openings exist.
      const lookBody =
        (design.poolBodies ?? []).find(
          (p) => p.outline.length >= 3 && waterBodyKind(p) !== "spa",
        ) ?? (design.poolBodies ?? []).find((p) => p.outline.length >= 3);
      const lookPlan = lookBody
        ? outlineBounds(lookBody.outline)
        : { cx: bb.cx, cy: bb.cy + Math.max(bb.height, 1000) };
      let yardEdgeIndex = -1;
      let yardToward = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const bPt = pts[(i + 1) % pts.length];
        const edgeLen = Math.hypot(bPt.x - a.x, bPt.y - a.y);
        if (edgeLen < 800) continue;
        const mid = { x: (a.x + bPt.x) / 2, y: (a.y + bPt.y) / 2 };
        let nx = -(bPt.y - a.y) / edgeLen;
        let ny = (bPt.x - a.x) / edgeLen;
        if (nx * (bb.cx - mid.x) + ny * (bb.cy - mid.y) > 0) {
          nx = -nx;
          ny = -ny;
        }
        const toward = nx * (lookPlan.cx - mid.x) + ny * (lookPlan.cy - mid.y);
        if (toward > yardToward) {
          yardToward = toward;
          yardEdgeIndex = i;
        }
      }

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
          expandOutlineFromCentroid(b.outline, -Math.min(wallTmm * 0.75, 140)),
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

      // Track which corners still need a solid post (no opening reaches them).
      const cornerNeedsPost = new Array(pts.length).fill(true);

      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const bPt = pts[(i + 1) % pts.length];
        const edgeLen = Math.hypot(bPt.x - a.x, bPt.y - a.y);
        if (edgeLen < 40) continue;
        const tx = (bPt.x - a.x) / edgeLen;
        const ty = (bPt.y - a.y) / edgeLen;
        let nx = -ty;
        let ny = tx;
        const mid = { x: (a.x + bPt.x) / 2, y: (a.y + bPt.y) / 2 };
        const toCenterX = bb.cx - mid.x;
        const toCenterY = bb.cy - mid.y;
        if (nx * toCenterX + ny * toCenterY > 0) {
          nx = -nx;
          ny = -ny;
        }

        const holes = [...(holesByEdge.get(i) ?? [])];

        // Synthetic yard window when this edge has no openings.
        const syntheticView =
          holes.length === 0 && i === yardEdgeIndex && edgeLen >= 1600;
        if (syntheticView) {
          const winW = Math.min(2800, edgeLen * 0.45);
          const sillY = 0.85;
          const headY = Math.min(h - 0.25, sillY + 2.1);
          holes.push({
            x: 0,
            y: sillY,
            w: mmToMeters(winW),
            h: headY - sillY,
          });
          const xz = planToWorldXZ(mid);
          const outward = planDirToWorldXZ(nx, ny);
          meshes.push({
            kind: "box",
            id: `building_viewglass_${b.id}`,
            material: "window",
            openingKind: "window",
            position: {
              x: xz.x - outward.x * mmToMeters(wallTmm) * 0.5,
              y: (sillY + headY) / 2,
              z: xz.z - outward.z * mmToMeters(wallTmm) * 0.5,
            },
            size: {
              x: mmToMeters(winW),
              y: headY - sillY,
              z: mmToMeters(wallTmm * 0.7),
            },
            rotationY: 0,
            axisX: planDirToWorldXZ(tx, ty),
            axisZ: outward,
            select,
          });
        }

        // Shorten panels at corners so adjacent walls don't fill each
        // other's punched openings (half-punched kitchen windows, etc.).
        // Expand back out when an opening reaches near a corner.
        const insetM = mmToMeters(wallTmm);
        const halfEdgeM = mmToMeters(edgeLen) / 2;
        let halfPanelM = Math.max(0.05, halfEdgeM - insetM);
        for (const hole of holes) {
          halfPanelM = Math.max(
            halfPanelM,
            Math.abs(hole.x) + hole.w / 2 + 0.01,
          );
        }
        halfPanelM = Math.min(halfPanelM, halfEdgeM);
        const panelLenM = halfPanelM * 2;

        // Opening reaches this edge's start / end → skip that corner post.
        for (const hole of holes) {
          const left = hole.x - hole.w / 2;
          const right = hole.x + hole.w / 2;
          if (left <= -halfEdgeM + insetM + 0.02) cornerNeedsPost[i] = false;
          if (right >= halfEdgeM - insetM - 0.02) {
            cornerNeedsPost[(i + 1) % pts.length] = false;
          }
        }

        const xz = planToWorldXZ(mid);
        const outward = planDirToWorldXZ(nx, ny);
        // Sit the exterior face on the footprint edge; extrude inward.
        meshes.push({
          kind: "wallPanel",
          id: `building_wall_${b.id}_${i}`,
          material: "building",
          position: { x: xz.x, y: 0, z: xz.z },
          axisX: planDirToWorldXZ(tx, ty),
          axisZ: outward,
          lengthM: panelLenM,
          heightM: h,
          thicknessM: mmToMeters(wallTmm),
          holes,
          colorHex,
          select,
        });
      }

      // Solid corner posts where shortened walls meet (no opening there).
      for (let i = 0; i < pts.length; i++) {
        if (!cornerNeedsPost[i]) continue;
        const prev = pts[(i - 1 + pts.length) % pts.length];
        const cur = pts[i];
        const next = pts[(i + 1) % pts.length];
        const lenIn = Math.hypot(cur.x - prev.x, cur.y - prev.y);
        const lenOut = Math.hypot(next.x - cur.x, next.y - cur.y);
        if (lenIn < 40 || lenOut < 40) continue;
        let nx0 = -(cur.y - prev.y) / lenIn;
        let ny0 = (cur.x - prev.x) / lenIn;
        let nx1 = -(next.y - cur.y) / lenOut;
        let ny1 = (next.x - cur.x) / lenOut;
        const mid0 = { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 };
        const mid1 = { x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2 };
        if (nx0 * (bb.cx - mid0.x) + ny0 * (bb.cy - mid0.y) > 0) {
          nx0 = -nx0;
          ny0 = -ny0;
        }
        if (nx1 * (bb.cx - mid1.x) + ny1 * (bb.cy - mid1.y) > 0) {
          nx1 = -nx1;
          ny1 = -ny1;
        }
        // Place post on the interior side of the exterior corner.
        const inset = wallTmm * 0.5;
        const plan = {
          x: cur.x - ((nx0 + nx1) / 2) * inset,
          y: cur.y - ((ny0 + ny1) / 2) * inset,
        };
        const xz = planToWorldXZ(plan);
        const tM = mmToMeters(wallTmm);
        meshes.push({
          kind: "box",
          id: `building_corner_${b.id}_${i}`,
          material: "building",
          position: { x: xz.x, y: h / 2, z: xz.z },
          size: { x: tM, y: h, z: tM },
          rotationY: 0,
          colorHex,
          select,
        });
      }

      // Flat roof deck + eaves overhang so the volume reads as a house, not a foam block.
      const eavesMm = 280;
      const roofSlab = 0.12;
      const fascia = 0.08;
      const roofOutline = closeOutline(
        expandOutlineFromCentroid(b.outline, eavesMm),
      );
      meshes.push({
        kind: "extrude",
        id: `building_roof_${b.id}`,
        material: "cover",
        outlineMm: roofOutline,
        bottomY: h,
        height: roofSlab,
        select,
      });
      meshes.push({
        kind: "extrude",
        id: `building_fascia_${b.id}`,
        material: "cover",
        outlineMm: roofOutline,
        holeOutlinesMm: [closeOutline(b.outline)],
        bottomY: h - fascia,
        height: fascia,
        opacity: 1,
        select,
      });

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

      // Fill / retaining from site grade samples.
      if (hasGradeSamples) {
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
          (strategy === "fill" || strategy === "both") &&
          maxDropMm > PATIO_SLAB_THICKNESS_MM + 40
        ) {
          const dropM = mmToMeters(maxDropMm);
          // Continuous fill pad: existing grade → slab underside (y = 0).
          // Punch pool/spa pits the same way as the deck (AABB subtract is
          // reliable; ExtrudeGeometry holes often leave wedges in the basin).
          if (isAxisAlignedRect(open, 80)) {
            const fillRegions =
              poolPitHoles.length > 0
                ? subtractAabbHoles(open, poolPitHoles)
                : [open];
            let fi = 0;
            for (const region of fillRegions) {
              if (region.length < 3) continue;
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
          } else {
            meshes.push({
              kind: "extrude",
              id: `fill_${p.id}`,
              material: "fill",
              outlineMm: closeOutline(p.outline),
              holeOutlinesMm:
                poolPitHoles.length > 0 ? poolPitHoles : undefined,
              bottomY: -dropM,
              height: dropM,
              select,
            });
          }
        }

        if (strategy === "retaining" || strategy === "both") {
          let ri = 0;
          const patioBb = outlineBounds(p.outline);
          for (const seg of analysis.retainingSegments) {
            const mid = {
              x: (seg.a.x + seg.b.x) / 2,
              y: (seg.a.y + seg.b.y) / 2,
            };
            const dx = seg.b.x - seg.a.x;
            const dy = seg.b.y - seg.a.y;
            const len = Math.hypot(dx, dy) || 1;
            // Outward normal (away from patio center)
            let nx = -dy / len;
            let ny = dx / len;
            if (
              nx * (patioBb.cx - mid.x) + ny * (patioBb.cy - mid.y) >
              0
            ) {
              nx = -nx;
              ny = -ny;
            }
            const offsetMm = 120;
            const wallMid = {
              x: mid.x + nx * offsetMm,
              y: mid.y + ny * offsetMm,
            };
            const lenM = mmToMeters(seg.lengthMm);
            const hM = Math.max(0.2, mmToMeters(seg.dropMm));
            const thickM = 0.25;
            const along = planDirToWorldXZ(dx, dy);
            const xz = planToWorldXZ(wallMid);
            // Wall sits from existing grade up to patio top.
            meshes.push({
              kind: "box",
              id: `retain_${p.id}_${ri++}`,
              material: "retaining",
              position: {
                x: xz.x,
                y: -hM / 2 + t,
                z: xz.z,
              },
              size: { x: Math.max(0.35, lenM), y: hM + t, z: thickM },
              rotationY: Math.atan2(-along.z, along.x),
              select,
            });
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
          // Lower course up to weir crest (solid, including shared wall sill).
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
          });
          // Upper course notched at spillover openings.
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

        const cascadeSpills = insetSpillOpeningsAtCorners(
          spills,
          outer,
          Math.max(180, wallT * 0.85),
        );
        for (const spill of cascadeSpills) {
          pushSpilloverCascades(meshes, {
            spill,
            spaOutline: outer,
            crestY: Math.max(crestY, spaWaterTop),
            poolWaterTopY: waterTopY,
            wallThicknessMm: wallT,
            select,
            idPrefix: `spa_${body.id}_e${spill.edgeIndex}`,
          });
        }
        pushSpilloverCornerCascades(meshes, {
          spills,
          spaOutline: outer,
          crestY: Math.max(crestY, spaWaterTop),
          poolWaterTopY: waterTopY,
          wallThicknessMm: wallT,
          select,
          idPrefix: `spa_${body.id}_corner`,
        });
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
      },
    ) => {
      const xz0 = planToWorldXZ(p0);
      const xz1 = planToWorldXZ(p1);
      const y0 = fenceBaseY(p0);
      const y1 = fenceBaseY(p1);
      const a = { x: xz0.x, y: y0, z: xz0.z };
      const b = { x: xz1.x, y: y1, z: xz1.z };
      let picketWidthM: number | undefined;
      let picketGapM: number | undefined;
      let postSizeM: number | undefined;
      if (opts.kind === "wood" || opts.kind === "vinyl") {
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
      const privacy = opts.kind === "wood" || opts.kind === "vinyl";
      meshes.push({
        kind: "fencePanel",
        id,
        material,
        a,
        b,
        heightM,
        // Privacy slabs match post depth so you can't see past thin panels.
        thicknessM: privacy
          ? Math.max(opts.thicknessM, (postSizeM ?? 0.1) * 0.85)
          : opts.thicknessM,
        colorHex: opts.colorHex,
        opacity: opts.opacity,
        picketWidthM,
        picketGapM,
        postSizeM,
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
      // Short spans so IDW grade curvature is followed along the run.
      const PANEL_STEP_MM = 1200;

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
        const gateHM = Math.max(0.6, mmToMeters(gateHMm));
        pushRackedPanel(
          `gate_${fence.id}_${gate.id}`,
          geom.a,
          geom.b,
          gateHM,
          "gate",
          { kind: "gate", fenceId: fence.id, id: gate.id },
          {
            colorHex,
            opacity: isGlass ? 0.45 : opacity,
            thicknessM: thickM * 0.85,
            kind: fence.kind,
          },
        );
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

  return { center, groundSize, ground, meshes };
}
