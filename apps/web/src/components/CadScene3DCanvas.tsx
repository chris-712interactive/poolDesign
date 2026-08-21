"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { CadScene3DHandle } from "@/lib/cad3d/cadScene3dHandle";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { DesignDocument, PointMm } from "@pool-design/shared";
import {
  depthMmAtT,
  depthTAtPlanPoint,
  flattenClosedOutline,
  houseExteriorColorFromHex,
  mmToMeters,
  openWallSegments,
  planToWorldXZ,
  pointInPolygon,
  distToPolygonBoundaryMm,
  segmentHitsFootprint,
  resolveHouseSidingId,
} from "@pool-design/shared";
import {
  basinCutPlaneConstant,
  basinSectionFrame,
  buildSceneModel,
  selectionEquals,
  selectionReadouts,
  type BasinSectionFrame,
  type BoxDescriptor,
  type ExtrudeDescriptor,
  type FencePanelDescriptor,
  type FloorDescriptor,
  type LabelDescriptor,
  type MeshDescriptor,
  type SceneMaterialKey,
  type SceneSelection,
  type SpilloverRibbonDescriptor,
  type TerrainDescriptor,
  type TubeDescriptor,
  type WallPanelDescriptor,
  type WaterBodyDescriptor,
  type GroundMarkDescriptor,
  type TriMeshDescriptor,
} from "@/lib/cad3d/buildScene";
import {
  loadCameraPose,
  saveCameraPose,
  type CameraPose3D,
} from "@/lib/cad3d/cameraPose";
import { ClipPlanesContext } from "@/lib/cad3d/clipContext";
import { CatalogObjectMesh } from "@/lib/cad3d/CatalogObjectMesh";
import { SectionCapMesh } from "@/lib/cad3d/SectionCapMesh";
import {
  makeBrushedSteelTexture,
  makeDeckTexture,
  makeGateButtonTexture,
  makeGatePolymerTexture,
  GRASS_TILE_M,
  makeGroundTexture,
  makePebbleFloorTexture,
  makePlasterTexture,
  makeStoneCopingTexture,
  makeStuccoTexture,
  makeWaterNormalTexture,
  makeWaterSurfaceTexture,
  makeWaterlineTileTexture,
} from "@/lib/cad3d/proceduralTextures";
import { getPatioFinishTexture } from "@/lib/cad3d/patioFinishTextures";
import { getWaterlineTileTexture } from "@/lib/cad3d/waterlineTileTextures";
import { getHouseSidingTexture } from "@/lib/cad3d/houseSidingTextures";
import { getRoofFinishTexture } from "@/lib/cad3d/roofFinishTextures";
import { OpeningMesh } from "@/lib/cad3d/OpeningMesh";
import {
  BasinCausticOverlay,
  SpilloverWaterMaterial,
  WaterCausticOverlay,
  WaterEnvironment,
  WaterMaterial,
  WaterTextureContext,
  type WaterTextures,
} from "@/lib/cad3d/WaterMaterial";
import { WalkControls } from "@/lib/cad3d/WalkControls";
import { walkSpawnPose } from "@/lib/cad3d/walkMode";
import { WorldBackdrop } from "@/lib/cad3d/WorldBackdrop";
import {
  PresentationBloom,
  SoftShadowSetup,
  SunLight,
} from "@/lib/cad3d/presentationEffects";
import {
  TIME_OF_DAY_ORDER,
  TIME_OF_DAY_PRESETS,
  TimeOfDayContext,
  isNightTime,
  lightingForNorth,
  type TimeOfDay,
} from "@/lib/cad3d/timeOfDay";

type MatDef = {
  color: string;
  roughness: number;
  metalness: number;
  map?:
    | "plaster"
    | "pebble"
    | "tile"
    | "stone"
    | "deck"
    | "ground"
    | "stucco"
    | "steel"
    | "gatePolymer"
    | "gateButton";
  mapRepeat?: [number, number];
  /** Wet / reflective physical extras (coping, tile, glass). */
  clearcoat?: number;
  clearcoatRoughness?: number;
  envMapIntensity?: number;
  transmission?: number;
  thickness?: number;
  ior?: number;
};

const MATERIALS: Record<SceneMaterialKey, MatDef> = {
  ground: {
    color: "#ffffff",
    roughness: 1,
    metalness: 0,
    map: "ground",
  },
  building: {
    color: "#ffffff",
    roughness: 0.9,
    metalness: 0,
    map: "stucco",
    mapRepeat: [4, 3],
  },
  patio: {
    color: "#ffffff",
    roughness: 0.95,
    metalness: 0,
    map: "deck",
  },
  poolWater: { color: "#0d7a9a", roughness: 0.06, metalness: 0 },
  spilloverWater: { color: "#3ec4e0", roughness: 0.08, metalness: 0 },
  poolShell: {
    color: "#ffffff",
    roughness: 0.55,
    metalness: 0.02,
    map: "plaster",
    mapRepeat: [4, 4],
  },
  poolFloor: {
    color: "#ffffff",
    roughness: 0.88,
    metalness: 0,
    map: "pebble",
    mapRepeat: [5, 5],
  },
  coping: {
    color: "#ffffff",
    roughness: 0.38,
    metalness: 0.04,
    map: "stone",
    mapRepeat: [3, 1.2],
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.35,
  },
  waterline: {
    color: "#ffffff",
    roughness: 0.18,
    metalness: 0.18,
    map: "tile",
    mapRepeat: [10, 1.4],
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.5,
  },
  spaShell: {
    color: "#ffffff",
    roughness: 0.55,
    metalness: 0.02,
    map: "plaster",
    mapRepeat: [3, 3],
  },
  spaWater: { color: "#1488a8", roughness: 0.06, metalness: 0 },
  cover: { color: "#4a433c", roughness: 0.92, metalness: 0 },
  pergola: { color: "#8b7355", roughness: 0.75, metalness: 0 },
  object: { color: "#5c7a6e", roughness: 0.7, metalness: 0.1 },
  equipment: { color: "#4a5560", roughness: 0.55, metalness: 0.25 },
  feature: { color: "#c9c2b4", roughness: 0.85, metalness: 0 },
  door: { color: "#5a4030", roughness: 0.65, metalness: 0.05 },
  window: {
    color: "#d7eef6",
    roughness: 0.04,
    metalness: 0,
    transmission: 0.95,
    thickness: 0.025,
    ior: 1.5,
    envMapIntensity: 2,
  },
  pipeSuction: { color: "#2f6f9f", roughness: 0.45, metalness: 0.2 },
  pipeReturn: { color: "#c45c2c", roughness: 0.45, metalness: 0.2 },
  pipeOther: { color: "#6a8f4e", roughness: 0.5, metalness: 0.15 },
  pipeGas: { color: "#b89b2c", roughness: 0.5, metalness: 0.2 },
  sectionCap: { color: "#e8eeec", roughness: 0.55, metalness: 0.02 },
  sectionWater: { color: "#0d7a9a", roughness: 0.1, metalness: 0 },
  fill: { color: "#a89070", roughness: 0.95, metalness: 0 },
  retaining: { color: "#8a8074", roughness: 0.85, metalness: 0.05 },
  fence: {
    color: "#2a2a2c",
    roughness: 0.55,
    metalness: 0.35,
    envMapIntensity: 1.1,
  },
  gate: { color: "#2a2a2c", roughness: 0.5, metalness: 0.4, envMapIntensity: 1.1 },
  gateSteel: {
    color: "#ffffff",
    roughness: 0.28,
    metalness: 0.96,
    map: "steel",
    envMapIntensity: 1.85,
    clearcoat: 0.18,
    clearcoatRoughness: 0.22,
  },
  gateLatch: {
    color: "#ffffff",
    roughness: 0.48,
    metalness: 0.08,
    map: "gatePolymer",
    envMapIntensity: 0.9,
    clearcoat: 0.28,
    clearcoatRoughness: 0.35,
  },
  gateButton: {
    color: "#ffffff",
    roughness: 0.32,
    metalness: 0.18,
    map: "gateButton",
    envMapIntensity: 1.15,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
  },
  roof: { color: "#ffffff", roughness: 0.9, metalness: 0 },
};

type SceneTextures = {
  plaster: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  pebble: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  tile: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  stone: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  deck: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  ground: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  stucco: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  steel: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  gatePolymer: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  gateButton: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  water: WaterTextures;
};

const TextureContext = createContext<SceneTextures | null>(null);

function applyRepeat(
  pair: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture },
  repeat: [number, number],
) {
  pair.color.repeat.set(repeat[0], repeat[1]);
  pair.roughness.repeat.set(repeat[0], repeat[1]);
  return pair;
}

function useSceneTextures(): SceneTextures | null {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    return {
      plaster: applyRepeat(makePlasterTexture(), [4, 4]),
      pebble: applyRepeat(makePebbleFloorTexture(), [5, 5]),
      tile: applyRepeat(makeWaterlineTileTexture(), [10, 1.4]),
      stone: applyRepeat(makeStoneCopingTexture(), [3, 1.2]),
      deck: makeDeckTexture(),
      ground: makeGroundTexture(),
      stucco: applyRepeat(makeStuccoTexture(), [4, 3]),
      steel: applyRepeat(makeBrushedSteelTexture(), [2, 4]),
      gatePolymer: applyRepeat(makeGatePolymerTexture(), [2, 3]),
      gateButton: applyRepeat(makeGateButtonTexture(), [2, 2]),
      water: {
        albedo: makeWaterSurfaceTexture(),
        normalA: makeWaterNormalTexture(3),
        normalB: makeWaterNormalTexture(29),
      },
    };
  }, []);
}

/** Drop duplicate closing vertex; Earcut holes break on zero-length final edge. */
function ringPts(outlineMm: PointMm[]): PointMm[] {
  if (outlineMm.length < 3) return outlineMm;
  const first = outlineMm[0];
  const last = outlineMm[outlineMm.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) < 1) {
    return outlineMm.slice(0, -1);
  }
  return outlineMm;
}

/** Signed area in shape space (x=-planX, y=+planY). >0 ⇒ CCW. */
function shapeSignedArea(outlineMm: PointMm[]): number {
  const pts = ringPts(outlineMm);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const px = mmToMeters(-p.x);
    const py = mmToMeters(p.y);
    const qx = mmToMeters(-q.x);
    const qy = mmToMeters(q.y);
    a += px * qy - qx * py;
  }
  return a / 2;
}

function outlineToShape(
  outlineMm: PointMm[],
  /** true ⇒ force clockwise (holes); false ⇒ force CCW (outer). */
  clockwise = false,
): THREE.Shape {
  const shape = new THREE.Shape();
  let pts = flattenClosedOutline(ringPts(outlineMm));
  if (pts.length < 3) return shape;
  const cw = shapeSignedArea(pts) < 0;
  if (cw !== clockwise) pts = [...pts].reverse();
  const first = pts[0];
  shape.moveTo(mmToMeters(-first.x), mmToMeters(first.y));
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    shape.lineTo(mmToMeters(-p.x), mmToMeters(p.y));
  }
  shape.closePath();
  return shape;
}

function outlineToPath(outlineMm: PointMm[], clockwise = true): THREE.Path {
  const path = new THREE.Path();
  let pts = flattenClosedOutline(ringPts(outlineMm));
  if (pts.length < 3) return path;
  const cw = shapeSignedArea(pts) < 0;
  if (cw !== clockwise) pts = [...pts].reverse();
  const first = pts[0];
  path.moveTo(mmToMeters(-first.x), mmToMeters(first.y));
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    path.lineTo(mmToMeters(-p.x), mmToMeters(p.y));
  }
  path.closePath();
  return path;
}

/**
 * ShapeGeometry ear-clips a rectangle into two triangles. Repeating water
 * maps then pick mip levels from each triangle's screen-space UV derivatives,
 * which draws a hard diagonal of sharp vs muddy texture across the pool.
 */
function applyWorldXzUvs(geo: THREE.BufferGeometry, scale = 0.35) {
  const pos = geo.attributes.position;
  if (!pos) return;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = pos.getX(i) * scale;
    uvs[i * 2 + 1] = pos.getZ(i) * scale;
  }
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
}

function tessellatePlanarShape(
  geo: THREE.BufferGeometry,
  maxEdgeM: number,
): THREE.BufferGeometry {
  const src = geo.attributes.position;
  if (!src || src.count < 3) return geo;
  const verts: number[] = [];
  for (let i = 0; i < src.count; i++) {
    verts.push(src.getX(i), src.getY(i), src.getZ(i));
  }
  let tris: number[] = [];
  const idx = geo.index;
  if (idx) {
    for (let i = 0; i < idx.count; i++) tris.push(idx.getX(i));
  } else {
    for (let i = 0; i < src.count; i++) tris.push(i);
  }

  const key = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const dist = (a: number, b: number) =>
    Math.hypot(
      verts[a * 3] - verts[b * 3],
      verts[a * 3 + 1] - verts[b * 3 + 1],
      verts[a * 3 + 2] - verts[b * 3 + 2],
    );

  for (let pass = 0; pass < 16; pass++) {
    const mids = new Map<string, number>();
    const midpoint = (a: number, b: number) => {
      const k = key(a, b);
      const hit = mids.get(k);
      if (hit != null) return hit;
      const i = verts.length / 3;
      verts.push(
        (verts[a * 3] + verts[b * 3]) * 0.5,
        (verts[a * 3 + 1] + verts[b * 3 + 1]) * 0.5,
        (verts[a * 3 + 2] + verts[b * 3 + 2]) * 0.5,
      );
      mids.set(k, i);
      return i;
    };
    let split = false;
    const next: number[] = [];
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t];
      const b = tris[t + 1];
      const c = tris[t + 2];
      const ab = dist(a, b);
      const bc = dist(b, c);
      const ca = dist(c, a);
      const longest = Math.max(ab, bc, ca);
      if (longest <= maxEdgeM) {
        next.push(a, b, c);
        continue;
      }
      split = true;
      if (ab >= bc && ab >= ca) {
        const m = midpoint(a, b);
        next.push(a, m, c, m, b, c);
      } else if (bc >= ca) {
        const m = midpoint(b, c);
        next.push(a, b, m, a, m, c);
      } else {
        const m = midpoint(c, a);
        next.push(a, b, m, b, c, m);
      }
    }
    tris = next;
    if (!split) break;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  out.setIndex(tris);
  geo.dispose();
  return out;
}

function useSelectHandlers(
  select: SceneSelection | undefined,
  onSelect?: (sel: SceneSelection | null) => void,
) {
  return useMemo(() => {
    if (!onSelect || !select) return {};
    return {
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(select);
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      },
      onPointerOut: () => {
        document.body.style.cursor = "default";
      },
    };
  }, [onSelect, select]);
}

function SelectableMaterial({
  material,
  opacity,
  selected,
  /** Water volume fill vs top surface — different depth/side settings. */
  waterLayer,
  patioFinishId,
  waterlineTileId,
  colorHex,
  houseSidingId,
  roofFinishId,
  waterShallow,
}: {
  material: SceneMaterialKey;
  opacity?: number;
  selected: boolean;
  waterLayer?: "volume" | "surface";
  patioFinishId?: string;
  waterlineTileId?: string;
  colorHex?: string;
  houseSidingId?: string;
  roofFinishId?: string;
  waterShallow?: boolean;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const textures = useContext(TextureContext);
  const mat = MATERIALS[material] ?? MATERIALS.object;
  const patioPair = useMemo(
    () =>
      material === "patio" ? getPatioFinishTexture(patioFinishId) : null,
    [material, patioFinishId],
  );
  const waterlinePair = useMemo(
    () =>
      material === "waterline"
        ? getWaterlineTileTexture(waterlineTileId)
        : null,
    [material, waterlineTileId],
  );
  const housePair = useMemo(() => {
    if (material !== "building") return null;
    const paint =
      houseExteriorColorFromHex(colorHex ?? "") ?? {
        r: 245,
        g: 244,
        b: 240,
      };
    return getHouseSidingTexture(resolveHouseSidingId(houseSidingId), paint);
  }, [material, houseSidingId, colorHex]);
  const roofPair = useMemo(() => {
    if (material !== "roof") return null;
    const paint =
      houseExteriorColorFromHex(colorHex ?? "") ?? {
        r: 58,
        g: 54,
        b: 50,
      };
    return getRoofFinishTexture(roofFinishId, paint);
  }, [material, roofFinishId, colorHex]);
  const pair = patioPair ?? waterlinePair ?? housePair ?? roofPair ??
    (mat.map && textures ? textures[mat.map] : null);
  const normalMap =
    patioPair?.normal ??
    waterlinePair?.normal ??
    housePair?.normal ??
    roofPair?.normal;
  const isWater =
    material === "poolWater" ||
    material === "spaWater" ||
    material === "sectionWater" ||
    material === "spilloverWater";
  const transparent =
    material === "cover" || material === "roof"
      ? false
      : (opacity ?? 1) < 0.99 || material === "window" || isWater;
  // Siding / roof albedo already bakes the paint color — don't multiply it again.
  const color = housePair || roofPair ? "#ffffff" : (colorHex ?? mat.color);
  if (material === "spilloverWater") {
    return (
      <SpilloverWaterMaterial selected={selected} opacity={opacity ?? 0.7} />
    );
  }
  if (isWater) {
    return (
      <WaterMaterial
        layer={waterLayer === "volume" ? "volume" : "surface"}
        selected={selected}
        opacity={opacity}
        spa={material === "spaWater"}
        shallow={waterShallow}
      />
    );
  }

  const isGlassFence =
    (material === "fence" || material === "gate") && transparent;
  const usePhysical =
    mat.clearcoat != null ||
    mat.transmission != null ||
    isGlassFence ||
    material === "window";

  if (usePhysical) {
    const glassLike = isGlassFence || material === "window";
    const waterline = material === "waterline";
    return (
      <meshPhysicalMaterial
        color={color}
        map={pair?.color}
        roughnessMap={glassLike ? undefined : pair?.roughness}
        normalMap={glassLike ? undefined : normalMap}
        roughness={glassLike ? 0.05 : mat.roughness}
        metalness={glassLike ? 0 : mat.metalness}
        clearcoat={mat.clearcoat ?? (glassLike ? 1 : 0)}
        clearcoatRoughness={mat.clearcoatRoughness ?? (glassLike ? 0.05 : 0.2)}
        transmission={
          glassLike ? (mat.transmission ?? 0.92) : 0
        }
        thickness={mat.thickness ?? (glassLike ? 0.025 : 0)}
        ior={mat.ior ?? 1.5}
        transparent={transparent || glassLike}
        opacity={glassLike ? 1 : (opacity ?? 1)}
        side={THREE.DoubleSide}
        depthWrite={!transparent && !glassLike}
        envMapIntensity={mat.envMapIntensity ?? (glassLike ? 2 : 1)}
        emissive={selected ? "#1f8a70" : "#000000"}
        emissiveIntensity={selected ? 0.28 : 0}
        clippingPlanes={clippingPlanes}
        clipShadows={clippingPlanes.length > 0}
        // Prefer tile over coplanar plaster when viewing the wet face.
        polygonOffset={waterline}
        polygonOffsetFactor={waterline ? -2 : 0}
        polygonOffsetUnits={waterline ? -2 : 0}
      />
    );
  }

  return (
    <meshStandardMaterial
      color={color}
      map={pair?.color}
      roughnessMap={pair?.roughness}
      normalMap={normalMap}
      flatShading={material === "roof"}
      roughness={mat.roughness}
      metalness={roofPair?.metalness ?? mat.metalness}
      transparent={transparent}
      opacity={opacity ?? 1}
      // Opaque shells keep DoubleSide for cutaways; water uses FrontSide above.
      side={THREE.DoubleSide}
      shadowSide={THREE.DoubleSide}
      depthWrite={!transparent}
      envMapIntensity={mat.envMapIntensity ?? 0.85}
      normalScale={
        material === "patio"
          ? [1.35, 1.35]
          : material === "roof"
            ? [1.25, 1.25]
            : [1, 1]
      }
      emissive={selected ? "#1f8a70" : "#000000"}
      emissiveIntensity={selected ? 0.28 : 0}
      clippingPlanes={clippingPlanes}
      clipShadows={clippingPlanes.length > 0}
    />
  );
}

function applyGrassWorldUVs(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position;
  let uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv || uv.count !== pos.count) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    geo.setAttribute("uv", uv);
  }
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / GRASS_TILE_M, pos.getZ(i) / GRASS_TILE_M);
  }
  uv.needsUpdate = true;
}

function TerrainMesh({ desc }: { desc: TerrainDescriptor }) {
  const geometry = useMemo(() => {
    const { cols, rows, stepMm, originMm, heightsM } = desc;
    const stepYMm = desc.stepYMm ?? stepMm;
    const positions = new Float32Array(cols * rows * 3);
    const uvs = new Float32Array(cols * rows * 2);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const idx = j * cols + i;
        const plan = {
          x: originMm.x + i * stepMm,
          y: originMm.y + j * stepYMm,
        };
        const xz = planToWorldXZ(plan);
        const y = heightsM[idx] ?? 0;
        positions[idx * 3] = xz.x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = xz.z;
        uvs[idx * 2] = xz.x / GRASS_TILE_M;
        uvs[idx * 2 + 1] = xz.z / GRASS_TILE_M;
      }
    }
    const indices: number[] = [];
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        // Winding chosen for plan→world flip (both axes negated).
        indices.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [desc]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow castShadow={false}>
      <SelectableMaterial material={desc.material} selected={false} />
    </mesh>
  );
}

function TriMesh({
  desc,
  selected,
  onSelect,
}: {
  desc: TriMeshDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(desc.positions, 3),
    );
    if (desc.uvs && desc.uvs.length) {
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(desc.uvs, 2));
    }
    geo.setIndex(desc.indices);
    geo.computeVertexNormals();
    return geo;
  }, [desc]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  const handlers = useSelectHandlers(desc.select, onSelect);

  return (
    <mesh geometry={geometry} castShadow receiveShadow {...handlers}>
      <SelectableMaterial
        material={desc.material}
        selected={selected}
        opacity={desc.opacity}
        colorHex={desc.colorHex}
        houseSidingId={desc.sidingId}
        roofFinishId={desc.roofFinishId}
      />
    </mesh>
  );
}

function ExtrudeMesh({
  desc,
  selected,
  onSelect,
}: {
  desc: ExtrudeDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  const geometry = useMemo(() => {
    const shape = outlineToShape(desc.outlineMm, false);
    const holes =
      desc.holeOutlinesMm?.length
        ? desc.holeOutlinesMm
        : desc.holeOutlineMm
          ? [desc.holeOutlineMm]
          : [];
    for (const hole of holes) {
      if (hole.length >= 3) {
        shape.holes.push(outlineToPath(hole, true));
      }
    }
    const isWaterMat =
      desc.material === "poolWater" || desc.material === "spaWater";
    const isShallowWater = desc.waterShallow === true && isWaterMat;
    // Single tessellated face for any thin water slab. ExtrudeGeometry ear-clips
    // a rectangle into two triangles — that diagonal is the line through spas.
    if (isWaterMat && desc.height <= 0.04) {
      const geo = tessellatePlanarShape(new THREE.ShapeGeometry(shape), 0.28);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, desc.bottomY + Math.max(0.004, desc.height), 0);
      geo.computeVertexNormals();
      applyWorldXzUvs(geo, isShallowWater ? 0.45 : 0.28);
      return geo;
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, desc.height),
      bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, desc.bottomY, 0);
    if (desc.material === "ground") applyGrassWorldUVs(geo);
    return geo;
  }, [desc]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  const handlers = useSelectHandlers(desc.select, onSelect);
  const isWater =
    desc.material === "poolWater" || desc.material === "spaWater";
  const waterLayer =
    isWater && (desc.waterShallow || desc.height <= 0.04)
      ? "surface"
      : isWater
        ? "volume"
        : undefined;

  return (
    <group>
      <mesh
        geometry={geometry}
        castShadow={!isWater}
        receiveShadow
        renderOrder={isWater ? (waterLayer === "surface" ? 3 : 2) : 0}
        {...handlers}
      >
        <SelectableMaterial
          material={desc.material}
          opacity={desc.opacity}
          selected={selected}
          waterLayer={waterLayer}
          patioFinishId={desc.patioFinishId}
          waterShallow={desc.waterShallow}
          colorHex={desc.colorHex}
          houseSidingId={desc.sidingId}
          roofFinishId={desc.roofFinishId}
        />
      </mesh>
      {desc.material === "poolFloor" ? (
        <BasinCausticOverlay
          geometry={geometry}
          yOffset={Math.max(0.008, desc.height * 0.92)}
          opacity={0.3}
        />
      ) : null}
      {isWater && waterLayer === "surface" ? (
        <WaterCausticOverlay geometry={geometry} />
      ) : null}
    </group>
  );
}

function PlainBoxMesh({
  desc,
  selected,
  onSelect,
}: {
  desc: BoxDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  if (desc.material === "spilloverWater") {
    return (
      <SpilloverCascadeMesh
        desc={desc}
        selected={selected}
        onSelect={onSelect}
      />
    );
  }
  const handlers = useSelectHandlers(desc.select, onSelect);
  const rotationY = useMemo(() => {
    if (desc.axisX) {
      return Math.atan2(-desc.axisX.z, desc.axisX.x);
    }
    return desc.rotationY;
  }, [desc.axisX, desc.rotationY]);
  const pitchRad = desc.pitchRad ?? 0;
  const primitive = desc.primitive ?? "box";
  const cylX = primitive === "cylinderX";
  const radius = cylX
    ? Math.max(0.006, Math.min(desc.size.y, desc.size.z) / 2)
    : Math.max(0.006, Math.min(desc.size.x, desc.size.z) / 2);
  const cylHeight = cylX ? desc.size.x : desc.size.y;

  return (
    <group
      position={[desc.position.x, desc.position.y, desc.position.z]}
      rotation={[0, rotationY, 0]}
    >
      <mesh
        rotation={cylX ? [0, 0, Math.PI / 2] : [0, 0, pitchRad]}
        castShadow
        receiveShadow
        {...handlers}
      >
        {primitive === "box" ? (
          <boxGeometry args={[desc.size.x, desc.size.y, desc.size.z]} />
        ) : (
          <cylinderGeometry args={[radius, radius, cylHeight, 20]} />
        )}
        <SelectableMaterial
          material={desc.material}
          opacity={desc.opacity}
          selected={selected}
          colorHex={desc.colorHex}
          waterlineTileId={desc.waterlineTileId}
        />
      </mesh>
    </group>
  );
}

/**
 * Curved translucent sheet with procedural flowing water.
 * Profile: attached at the weir crest, flares outward toward the pool as it falls.
 */
function SpilloverCascadeMesh({
  desc,
  selected,
  onSelect,
}: {
  desc: BoxDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  const handlers = useSelectHandlers(desc.select, onSelect);

  /** Local +X along weir, +Y up, +Z toward the pool (away from spa wall). */
  const quaternion = useMemo(() => {
    const ax = desc.axisX ?? { x: 1, z: 0 };
    const az = desc.axisZ ?? { x: 0, z: 1 };
    const xV = new THREE.Vector3(ax.x, 0, ax.z).normalize();
    const zV = new THREE.Vector3(az.x, 0, az.z).normalize();
    const yV = new THREE.Vector3(0, 1, 0);
    // Quaternions need a right-handed basis. Flip tangent, never outward —
    // flipping +Z buried the sheet inside the spa and made it vanish.
    const cross = new THREE.Vector3().crossVectors(xV, yV);
    if (cross.dot(zV) < 0) xV.negate();
    const m = new THREE.Matrix4().makeBasis(xV, yV, zV);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }, [desc.axisX, desc.axisZ]);

  const { sheetGeo, veilGeo, foamGeo, splashGeo } = useMemo(() => {
    const w = Math.max(0.05, desc.size.x);
    const h = Math.max(0.04, desc.size.y);
    // Throw distance at the pool — enough that the pour arc reads from the side.
    const flare = Math.max(0.09, Math.min(0.32, h * 0.9));

    /**
     * Free-fall pour in local +Z (toward pool):
     * Crest hugs the lip; path follows a √fall-style curve so it leaves the
     * ledge then steepens into the pool — a curtain, not a straight ramp.
     */
    const bend = (geo: THREE.PlaneGeometry, amount: number, height: number) => {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = (y + height / 2) / height; // 0 bottom → 1 crest
        const fall = Math.min(1, Math.max(0, 1 - t));
        // √fall ≈ horizontal leave at lip, more vertical toward the pool.
        // fall*(2-fall) under sqrt keeps a finite slope on the first segment.
        const pour = Math.sqrt(fall * (2 - fall));
        pos.setZ(i, pour * amount);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };

    const sheet = new THREE.PlaneGeometry(w, h, 8, 40);
    const veil = new THREE.PlaneGeometry(w * 1.04, h * 0.98, 4, 28);
    bend(sheet, flare, h);
    bend(veil, flare * 1.06, h);

    // Crest foam — sits on the lip (z ≈ 0)
    const foamH = Math.min(0.04, h * 0.12);
    const foam = new THREE.PlaneGeometry(w * 1.02, foamH, 8, 2);
    const foamPos = foam.attributes.position;
    for (let i = 0; i < foamPos.count; i++) {
      foamPos.setY(i, foamPos.getY(i) + h / 2 - foamH * 0.4);
      foamPos.setZ(i, 0.006);
    }
    foamPos.needsUpdate = true;
    foam.computeVertexNormals();

    // Splash pad at pool surface, out where the sheet lands
    const splashW = w * 1.12;
    const splashD = Math.max(0.1, flare * 0.85);
    const splash = new THREE.PlaneGeometry(splashW, splashD, 8, 4);
    splash.rotateX(-Math.PI / 2);
    const splashPos = splash.attributes.position;
    for (let i = 0; i < splashPos.count; i++) {
      splashPos.setY(i, -h / 2 + 0.005);
      const z = splashPos.getZ(i);
      splashPos.setZ(i, z + flare + splashD * 0.1);
    }
    splashPos.needsUpdate = true;
    splash.computeVertexNormals();

    return {
      sheetGeo: sheet,
      veilGeo: veil,
      foamGeo: foam,
      splashGeo: splash,
    };
  }, [desc.size.x, desc.size.y, desc.size.z]);

  useEffect(
    () => () => {
      sheetGeo.dispose();
      veilGeo.dispose();
      foamGeo.dispose();
      splashGeo.dispose();
    },
    [sheetGeo, veilGeo, foamGeo, splashGeo],
  );

  return (
    <group
      position={[desc.position.x, desc.position.y, desc.position.z]}
      quaternion={quaternion}
    >
      <mesh geometry={sheetGeo} renderOrder={4} {...handlers}>
        <SpilloverWaterMaterial
          selected={selected}
          opacity={desc.opacity ?? 0.78}
          layer={0}
        />
      </mesh>
      <mesh
        geometry={veilGeo}
        position={[0, -0.002, 0.006]}
        renderOrder={4.05}
        raycast={() => null}
      >
        <SpilloverWaterMaterial selected={false} opacity={0.4} layer={1} />
      </mesh>
      <mesh geometry={foamGeo} renderOrder={4.2} raycast={() => null}>
        <meshBasicMaterial
          color="#f2fbff"
          transparent
          opacity={0.72}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={splashGeo} renderOrder={4.15} raycast={() => null}>
        <meshBasicMaterial
          color="#dff6ff"
          transparent
          opacity={0.45}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Continuous spillover curtain along a crest polyline (straight runs + corner arcs).
 * One mesh so adjacent weirs read as a single flowing sheet.
 */
function SpilloverRibbonMesh({
  desc,
  selected,
  onSelect,
}: {
  desc: SpilloverRibbonDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  const handlers = useSelectHandlers(desc.select, onSelect);

  const { sheetGeo, veilGeo, foamGeo } = useMemo(() => {
    const crest = desc.crest;
    if (crest.length < 2) {
      return {
        sheetGeo: new THREE.BufferGeometry(),
        veilGeo: new THREE.BufferGeometry(),
        foamGeo: new THREE.BufferGeometry(),
      };
    }

    const segsV = 36;
    const topY = desc.crestY;
    const botY = desc.poolWaterY;
    const h = Math.max(0.04, topY - botY);
    const flare = Math.max(0.08, desc.flareM);
    const lipTuckMm = Math.max(0, (desc.lipTuckM ?? 0.028) * 1000);
    const uCount = crest.length;
    const vCount = segsV + 1;

    const build = (flareScale: number, heightScale: number) => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let iv = 0; iv < vCount; iv++) {
        const v = iv / segsV; // 0 crest → 1 pool
        const fall = v;
        const pour = Math.sqrt(Math.min(1, Math.max(0, fall * (2 - fall))));
        // Start tucked onto the spa lip, then flare out as it falls.
        const throwMm =
          -lipTuckMm * (1 - pour) + pour * flare * flareScale * 1000;
        const y = topY - v * h * heightScale;
        for (let iu = 0; iu < uCount; iu++) {
          const s = crest[iu];
          const plan = {
            x: s.x + s.nx * throwMm,
            y: s.y + s.ny * throwMm,
          };
          const xz = planToWorldXZ(plan);
          positions.push(xz.x, y, xz.z);
          uvs.push(iu / Math.max(1, uCount - 1), 1 - v);
        }
      }
      for (let iv = 0; iv < segsV; iv++) {
        for (let iu = 0; iu < uCount - 1; iu++) {
          const a = iv * uCount + iu;
          const b = a + 1;
          const c = a + uCount;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    };

    const sheet = build(1, 1);
    const veil = build(1.04, 0.98);

    // Thin foam strip along the crest lip (tucked onto coping)
    const foamPos: number[] = [];
    const foamUv: number[] = [];
    const foamIdx: number[] = [];
    const foamRows = 2;
    const foamH = Math.min(0.035, h * 0.1);
    for (let iv = 0; iv <= foamRows; iv++) {
      const v = iv / foamRows;
      const y = topY - v * foamH;
      for (let iu = 0; iu < uCount; iu++) {
        const s = crest[iu];
        const xz = planToWorldXZ({
          x: s.x + s.nx * (-lipTuckMm + 2),
          y: s.y + s.ny * (-lipTuckMm + 2),
        });
        foamPos.push(xz.x, y, xz.z);
        foamUv.push(iu / Math.max(1, uCount - 1), 1 - v);
      }
    }
    for (let iv = 0; iv < foamRows; iv++) {
      for (let iu = 0; iu < uCount - 1; iu++) {
        const a = iv * uCount + iu;
        const b = a + 1;
        const c = a + uCount;
        const d = c + 1;
        foamIdx.push(a, c, b, b, c, d);
      }
    }
    const foam = new THREE.BufferGeometry();
    foam.setAttribute("position", new THREE.Float32BufferAttribute(foamPos, 3));
    foam.setAttribute("uv", new THREE.Float32BufferAttribute(foamUv, 2));
    foam.setIndex(foamIdx);
    foam.computeVertexNormals();

    return { sheetGeo: sheet, veilGeo: veil, foamGeo: foam };
  }, [desc]);

  useEffect(
    () => () => {
      sheetGeo.dispose();
      veilGeo.dispose();
      foamGeo.dispose();
    },
    [sheetGeo, veilGeo, foamGeo],
  );

  if (!desc.crest.length) return null;

  return (
    <group>
      <mesh geometry={sheetGeo} renderOrder={4.1} {...handlers}>
        <SpilloverWaterMaterial
          selected={selected}
          opacity={desc.opacity ?? 0.78}
          layer={0}
        />
      </mesh>
      <mesh geometry={veilGeo} renderOrder={4.12} raycast={() => null}>
        <SpilloverWaterMaterial selected={false} opacity={0.38} layer={1} />
      </mesh>
      <mesh geometry={foamGeo} renderOrder={4.25} raycast={() => null}>
        <meshBasicMaterial
          color="#f2fbff"
          transparent
          opacity={0.7}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Racked fence: sloping rails + plumb pickets (or solid glass parallelogram). */
function FencePanelMesh({
  desc,
  selected,
  onSelect,
}: {
  desc: FencePanelDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  const handlers = useSelectHandlers(desc.select, onSelect);
  const { geometry, yaw, rails, pickets, posts } = useMemo(() => {
    const ax = desc.a.x;
    const ay = desc.a.y;
    const az = desc.a.z;
    const bx = desc.b.x;
    const by = desc.b.y;
    const bz = desc.b.z;
    const h = desc.heightM;
    const halfT = desc.thicknessM / 2;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const nx = -uz;
    const nz = ux;
    const yaw = Math.atan2(-uz, ux);
    const postSize = desc.omitPosts ? 0 : (desc.postSizeM ?? 0);

    type Post = { x: number; y: number; z: number; h: number; size: number };
    const postList: Post[] = [];
    const postExtra = desc.postCap && postSize > 0 ? 0.045 : 0;
    if (postSize > 0) {
      postList.push(
        {
          x: ax,
          y: ay + (h + postExtra) / 2,
          z: az,
          h: h + postExtra,
          size: postSize,
        },
        {
          x: bx,
          y: by + (h + postExtra) / 2,
          z: bz,
          h: h + postExtra,
          size: postSize,
        },
      );
    }

    const parallelogram = () => {
      // Inset solid panel between posts so posts read as solid ends.
      const inset = postSize > 0 ? postSize * 0.5 : 0;
      const t0 = inset / len;
      const t1 = 1 - inset / len;
      if (t1 <= t0) {
        return null;
      }
      const sax = ax + dx * t0;
      const say = ay + (by - ay) * t0;
      const saz = az + dz * t0;
      const sbx = ax + dx * t1;
      const sby = ay + (by - ay) * t1;
      const sbz = az + dz * t1;
      const positions = new Float32Array(8 * 3);
      const write = (
        i: number,
        x: number,
        y: number,
        z: number,
      ) => {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      };
      write(0, sax - nx * halfT, say, saz - nz * halfT);
      write(1, sbx - nx * halfT, sby, sbz - nz * halfT);
      write(2, sbx - nx * halfT, sby + h, sbz - nz * halfT);
      write(3, sax - nx * halfT, say + h, saz - nz * halfT);
      write(4, sax + nx * halfT, say, saz + nz * halfT);
      write(5, sbx + nx * halfT, sby, sbz + nz * halfT);
      write(6, sbx + nx * halfT, sby + h, sbz + nz * halfT);
      write(7, sax + nx * halfT, say + h, saz + nz * halfT);
      const indices = [
        0, 1, 2, 0, 2, 3,
        5, 4, 7, 5, 7, 6,
        4, 0, 3, 4, 3, 7,
        1, 5, 6, 1, 6, 2,
        3, 2, 6, 3, 6, 7,
        4, 5, 1, 4, 1, 0,
      ];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    };

    const picketW = desc.picketWidthM;
    const picketGap = desc.picketGapM ?? 0.08;
    if (picketW == null || picketW <= 0) {
      return {
        geometry: parallelogram(),
        yaw,
        rails: null as null | {
          mid: [number, number, number];
          pitch: number;
          len: number;
        }[],
        pickets: null as null | {
          x: number;
          y: number;
          z: number;
          h: number;
          w: number;
        }[],
        posts: postList,
      };
    }

    const railH = desc.railHeightM ?? Math.min(0.05, h * 0.08);
    const notch = Math.min(desc.picketNotchM ?? railH * 0.22, railH * 0.7);
    const pitch = Math.atan2(by - ay, len);
    // Rails run between post faces (not through post centers).
    const railInset = postSize > 0 ? postSize * 0.5 : 0;
    const railLen = Math.max(0.05, len - railInset * 2);
    const railT0 = railInset / len;
    const railT1 = 1 - railInset / len;
    const r0x = ax + dx * railT0;
    const r0z = az + dz * railT0;
    const r0y = ay + (by - ay) * railT0;
    const r1x = ax + dx * railT1;
    const r1z = az + dz * railT1;
    const r1y = ay + (by - ay) * railT1;
    const midX = (r0x + r1x) / 2;
    const midZ = (r0z + r1z) / 2;
    const midY0 = (r0y + r1y) / 2;
    const rails = [
      {
        mid: [midX, midY0 + (railH / 2) * Math.cos(pitch), midZ] as [
          number,
          number,
          number,
        ],
        pitch,
        len: railLen,
      },
      {
        mid: [
          midX,
          midY0 + h - (railH / 2) * Math.cos(pitch),
          midZ,
        ] as [number, number, number],
        pitch,
        len: railLen,
      },
      ...(desc.midRail
        ? [
            {
              mid: [
                midX,
                midY0 + h * 0.5,
                midZ,
              ] as [number, number, number],
              pitch,
              len: railLen,
            },
          ]
        : []),
    ];

    // Pack pickets across the clear bay. Privacy boards fill with tight T&G grooves;
    // open styles keep a fixed picket width and absorb leftover as gap.
    const spanStart = railInset;
    const spanEnd = len - railInset;
    const spanLen = spanEnd - spanStart;
    let count = 0;
    let gap = 0;
    let boardW = picketW;
    if (spanLen > 0) {
      if (desc.privacyBoards) {
        const groove = Math.max(0.002, picketGap);
        count = Math.max(1, Math.round((spanLen + groove) / (picketW + groove)));
        while (
          count > 1 &&
          count * Math.min(picketW * 0.55, 0.08) > spanLen + 1e-6
        ) {
          count -= 1;
        }
        gap = count > 1 ? groove : 0;
        boardW = Math.max(
          0.04,
          (spanLen - gap * Math.max(0, count - 1)) / count,
        );
      } else {
        count = Math.max(
          1,
          Math.round((spanLen + picketGap) / (picketW + picketGap)),
        );
        while (count > 1 && count * picketW > spanLen + 1e-6) count -= 1;
        gap =
          count > 1 ? Math.max(0, (spanLen - count * picketW) / (count - 1)) : 0;
        boardW = picketW;
      }
    }
    const picketList: { x: number; y: number; z: number; h: number; w: number }[] =
      [];
    const picketH = Math.max(0.05, h - 2 * railH + 2 * notch);
    for (let i = 0; i < count; i++) {
      const d = spanStart + boardW / 2 + i * (boardW + gap);
      const t = d / len;
      const x = ax + dx * t;
      const z = az + dz * t;
      const yBase = ay + (by - ay) * t + (railH - notch);
      picketList.push({
        x,
        y: yBase + picketH / 2,
        z,
        h: picketH,
        w: boardW,
      });
    }

    return {
      geometry: null as THREE.BufferGeometry | null,
      yaw,
      rails,
      pickets: picketList,
      posts: postList,
    };
  }, [desc]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  const railH = desc.railHeightM ?? Math.min(0.05, desc.heightM * 0.08);
  const railDepth = desc.railDepthM ?? Math.max(0.02, desc.thicknessM);
  const picketDepth = desc.picketDepthM ?? Math.max(0.02, desc.thicknessM * 0.75);
  const braceLen = Math.hypot(
    desc.b.x - desc.a.x,
    desc.b.z - desc.a.z,
  );
  const braceMesh = desc.brace ? (
    <mesh
      position={[
        (desc.a.x + desc.b.x) / 2,
        (desc.a.y + desc.b.y) / 2 + desc.heightM / 2,
        (desc.a.z + desc.b.z) / 2,
      ]}
      rotation={[0, yaw, Math.atan2(desc.heightM, braceLen || 1)]}
      castShadow
      receiveShadow
    >
      <boxGeometry
        args={[
          Math.hypot(braceLen, desc.heightM) * 0.88,
          0.028,
          Math.max(0.016, desc.thicknessM * 0.55),
        ]}
      />
      <SelectableMaterial
        material={desc.material}
        opacity={desc.opacity}
        selected={selected}
        colorHex={desc.colorHex}
      />
    </mesh>
  ) : null;

  if (geometry) {
    return (
      <group {...handlers}>
        <mesh geometry={geometry} castShadow receiveShadow>
          <SelectableMaterial
            material={desc.material}
            opacity={desc.opacity}
            selected={selected}
            colorHex={desc.colorHex}
          />
        </mesh>
        {posts.map((p, i) => (
          <mesh
            key={`post-${i}`}
            position={[p.x, p.y, p.z]}
            rotation={[0, yaw, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[p.size, p.h, p.size]} />
            <SelectableMaterial
              material={desc.material}
              opacity={desc.opacity}
              selected={selected}
              colorHex={desc.colorHex}
            />
          </mesh>
        ))}
        {braceMesh}
      </group>
    );
  }

  return (
    <group {...handlers}>
      {posts.map((p, i) => (
        <mesh
          key={`post-${i}`}
          position={[p.x, p.y, p.z]}
          rotation={[0, yaw, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[p.size, p.h, p.size]} />
          <SelectableMaterial
            material={desc.material}
            opacity={desc.opacity}
            selected={selected}
            colorHex={desc.colorHex}
          />
        </mesh>
      ))}
      {rails?.map((rail, i) => (
        <group
          key={`rail-${i}`}
          position={rail.mid}
          rotation={[0, yaw, 0]}
        >
          <mesh rotation={[0, 0, rail.pitch]} castShadow receiveShadow>
            <boxGeometry args={[rail.len, railH, railDepth]} />
            <SelectableMaterial
              material={desc.material}
              opacity={desc.opacity}
              selected={selected}
              colorHex={desc.colorHex}
            />
          </mesh>
        </group>
      ))}
      {pickets?.map((p, i) => (
        <mesh
          key={`picket-${i}`}
          position={[p.x, p.y, p.z]}
          rotation={[0, yaw, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[p.w, p.h, picketDepth]} />
          <SelectableMaterial
            material={desc.material}
            opacity={desc.opacity}
            selected={selected}
            colorHex={desc.colorHex}
          />
        </mesh>
      ))}
      {desc.postCap
        ? posts.map((p, i) => {
            const capH = Math.min(0.07, p.size * 0.55);
            const topY = p.y + p.h / 2;
            return (
              <group
                key={`cap-${i}`}
                position={[p.x, topY, p.z]}
                rotation={[0, yaw + Math.PI / 4, 0]}
              >
                <mesh
                  position={[0, 0.012, 0]}
                  rotation={[0, -Math.PI / 4, 0]}
                  castShadow
                >
                  <boxGeometry args={[p.size * 1.12, 0.024, p.size * 1.12]} />
                  <SelectableMaterial
                    material={desc.material}
                    opacity={desc.opacity}
                    selected={selected}
                    colorHex={desc.colorHex}
                  />
                </mesh>
                <mesh position={[0, 0.024 + capH / 2, 0]} castShadow>
                  <coneGeometry args={[p.size * 0.72, capH, 4]} />
                  <SelectableMaterial
                    material={desc.material}
                    opacity={desc.opacity}
                    selected={selected}
                    colorHex={desc.colorHex}
                  />
                </mesh>
              </group>
            );
          })
        : null}
      {braceMesh}
    </group>
  );
}

function BoxMesh({
  desc,
  selected,
  onSelect,
}: {
  desc: BoxDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  if (desc.catalogItemId) {
    return (
      <CatalogObjectMesh
        desc={desc}
        selected={selected}
        onSelect={onSelect}
      />
    );
  }
  if (
    desc.openingKind ||
    desc.material === "door" ||
    desc.material === "window"
  ) {
    return (
      <OpeningMesh desc={desc} selected={selected} onSelect={onSelect} />
    );
  }
  return (
    <PlainBoxMesh desc={desc} selected={selected} onSelect={onSelect} />
  );
}

function depthSampler(desc: {
  depthStations: FloorDescriptor["depthStations"];
  axisOriginMm: PointMm;
  depthAxis: PointMm;
  axisLengthMm: number;
}) {
  const stations = desc.depthStations.map((s) => ({
    id: "",
    t: s.t,
    depthMm: s.depthMm,
    transition: s.transition,
  }));
  return (sx: number, sy: number) => {
    const planXmm = -sx * 1000;
    const planYmm = sy * 1000;
    const t = depthTAtPlanPoint(
      { x: planXmm, y: planYmm },
      desc.axisOriginMm,
      desc.depthAxis,
      desc.axisLengthMm,
    );
    return mmToMeters(depthMmAtT(stations, t));
  };
}

function unit2(v: PointMm): PointMm {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * Sample parameters along the depth axis, densified at authored stations
 * (especially drop-offs) so floor breaks appear in 3D.
 */
function depthAxisTSamples(
  stations: FloorDescriptor["depthStations"],
  axisLengthMm: number,
): number[] {
  const maxStep = Math.min(0.035, 220 / Math.max(1, axisLengthMm));
  const marks = new Set<number>([0, 1]);
  for (const s of stations) {
    const t = Math.min(1, Math.max(0, s.t));
    marks.add(t);
    if (s.transition === "dropoff") {
      marks.add(Math.max(0, t - 2e-4));
      marks.add(Math.min(1, t + 2e-4));
    }
  }
  const sorted = [...marks].sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    out.push(a);
    const gap = b - a;
    const n = Math.max(1, Math.ceil(gap / maxStep));
    for (let k = 1; k < n; k++) out.push(a + (gap * k) / n);
  }
  out.push(1);
  return out;
}

/**
 * Build a basin floor (or water bottom) that follows the depth profile,
 * including mid-pool breaks. ShapeGeometry alone only has outline verts, so
 * depth stations never showed up in the interior.
 */
function buildProfiledBasinSurface(opts: {
  outlineMm: PointMm[];
  depthStations: FloorDescriptor["depthStations"];
  axisOriginMm: PointMm;
  depthAxis: PointMm;
  axisLengthMm: number;
  /** y = -depth + yBias (floor) or water bottom with clearance */
  yAtDepth: (depthM: number) => number;
  uvScale?: number;
  holeOutlinesMm?: PointMm[][];
  /** Extra mm outside the outline so edge cells still form. */
  edgePadMm?: number;
}): {
  positions: number[];
  uvs: number[];
  indices: number[];
} {
  const open = ringPts(opts.outlineMm);
  const empty = { positions: [] as number[], uvs: [] as number[], indices: [] as number[] };
  if (open.length < 3) return empty;

  const axis = unit2(opts.depthAxis);
  const perp = { x: -axis.y, y: axis.x };
  const origin = opts.axisOriginMm;
  const axisLen = Math.max(1, opts.axisLengthMm);

  let sMin = Infinity;
  let sMax = -Infinity;
  for (const p of open) {
    const s =
      (p.x - origin.x) * perp.x + (p.y - origin.y) * perp.y;
    sMin = Math.min(sMin, s);
    sMax = Math.max(sMax, s);
  }
  // Pad slightly so edge quads reach the shell.
  const pad = 40;
  sMin -= pad;
  sMax += pad;

  const tSamples = depthAxisTSamples(opts.depthStations, axisLen);
  const sStep = Math.min(280, Math.max(120, (sMax - sMin) / 24));
  const sCount = Math.max(2, Math.ceil((sMax - sMin) / sStep) + 1);
  const sSamples: number[] = [];
  for (let i = 0; i < sCount; i++) {
    sSamples.push(sMin + ((sMax - sMin) * i) / (sCount - 1));
  }

  const depthAt = depthSampler({
    depthStations: opts.depthStations,
    axisOriginMm: opts.axisOriginMm,
    depthAxis: opts.depthAxis,
    axisLengthMm: opts.axisLengthMm,
  });
  const uvScale = opts.uvScale ?? 0.45;
  const holes = (opts.holeOutlinesMm ?? [])
    .map((h) => ringPts(h))
    .filter((h) => h.length >= 3);
  const edgePad = opts.edgePadMm ?? 40;

  const nt = tSamples.length;
  const ns = sSamples.length;
  const idxOf = (ti: number, si: number) => ti * ns + si;
  const inside: boolean[] = new Array(nt * ns);
  const positions: number[] = new Array(nt * ns * 3);
  const uvs: number[] = new Array(nt * ns * 2);

  for (let ti = 0; ti < nt; ti++) {
    const t = tSamples[ti];
    for (let si = 0; si < ns; si++) {
      const s = sSamples[si];
      const plan = {
        x: origin.x + axis.x * axisLen * t + perp.x * s,
        y: origin.y + axis.y * axisLen * t + perp.y * s,
      };
      const i = idxOf(ti, si);
      let inPoly =
        pointInPolygon(plan, open) ||
        (edgePad > 0 &&
          (pointInPolygon(
            {
              x: plan.x + perp.x * Math.min(30, edgePad),
              y: plan.y + perp.y * Math.min(30, edgePad),
            },
            open,
          ) ||
            pointInPolygon(
              {
                x: plan.x - perp.x * Math.min(30, edgePad),
                y: plan.y - perp.y * Math.min(30, edgePad),
              },
              open,
            )));
      if (inPoly && holes.some((h) => pointInPolygon(plan, h))) inPoly = false;
      inside[i] = inPoly;
      const sx = mmToMeters(-plan.x);
      const sy = mmToMeters(plan.y);
      const d = depthAt(sx, sy);
      const y = opts.yAtDepth(d);
      positions[i * 3] = sx;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = -sy;
      uvs[i * 2] = sx * uvScale;
      uvs[i * 2 + 1] = sy * uvScale;
    }
  }

  const indices: number[] = [];
  const emitTri = (a: number, b: number, c: number) => {
    if (!inside[a] || !inside[b] || !inside[c]) return;
    indices.push(a, b, c);
  };

  for (let ti = 0; ti < nt - 1; ti++) {
    for (let si = 0; si < ns - 1; si++) {
      const a = idxOf(ti, si);
      const b = idxOf(ti, si + 1);
      const c = idxOf(ti + 1, si);
      const d = idxOf(ti + 1, si + 1);
      const count =
        (inside[a] ? 1 : 0) +
        (inside[b] ? 1 : 0) +
        (inside[c] ? 1 : 0) +
        (inside[d] ? 1 : 0);
      if (count === 4) {
        emitTri(a, b, d);
        emitTri(a, d, c);
      } else if (count === 3) {
        if (!inside[a]) emitTri(b, d, c);
        else if (!inside[b]) emitTri(a, d, c);
        else if (!inside[c]) emitTri(a, b, d);
        else emitTri(a, b, c);
      }
    }
  }

  // Compact unused vertices so BufferGeometry stays lean.
  if (!indices.length) return empty;
  const used = new Set(indices);
  const remap = new Map<number, number>();
  const posOut: number[] = [];
  const uvOut: number[] = [];
  let next = 0;
  for (const i of [...used].sort((a, b) => a - b)) {
    remap.set(i, next++);
    posOut.push(
      positions[i * 3],
      positions[i * 3 + 1],
      positions[i * 3 + 2],
    );
    uvOut.push(uvs[i * 2], uvs[i * 2 + 1]);
  }
  return {
    positions: posOut,
    uvs: uvOut,
    indices: indices.map((i) => remap.get(i)!),
  };
}

function FloorMesh({
  desc,
  selected,
  onSelect,
}: {
  desc: FloorDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  const geometry = useMemo(() => {
    const open = ringPts(desc.outlineMm);
    if (open.length < 3) return new THREE.BufferGeometry();
    const thick = Math.max(0.06, desc.thicknessM ?? 0.14);
    const depthAtShape = depthSampler(desc);
    const uvScale = 0.45;

    const top = buildProfiledBasinSurface({
      outlineMm: desc.outlineMm,
      depthStations: desc.depthStations,
      axisOriginMm: desc.axisOriginMm,
      depthAxis: desc.depthAxis,
      axisLengthMm: desc.axisLengthMm,
      yAtDepth: (d) => -d,
      uvScale,
    });

    const verts: number[] = [...top.positions];
    const uvs: number[] = [...top.uvs];
    const indices: number[] = [...top.indices];
    const nTop = top.positions.length / 3;

    // Bottom slab face (offset down by thickness)
    for (let i = 0; i < nTop; i++) {
      verts.push(
        top.positions[i * 3],
        top.positions[i * 3 + 1] - thick,
        top.positions[i * 3 + 2],
      );
      uvs.push(top.uvs[i * 2], top.uvs[i * 2 + 1]);
    }
    for (let i = 0; i < top.indices.length; i += 3) {
      const a = top.indices[i];
      const b = top.indices[i + 1];
      const c = top.indices[i + 2];
      indices.push(nTop + a, nTop + c, nTop + b);
    }

    // Perimeter walls between top and bottom
    const emitFloorSide = (a: PointMm, b: PointMm) => {
      const x0 = mmToMeters(-a.x);
      const y0 = mmToMeters(a.y);
      const x1 = mmToMeters(-b.x);
      const y1 = mmToMeters(b.y);
      const d0 = depthAtShape(x0, y0);
      const d1 = depthAtShape(x1, y1);
      const r = verts.length / 3;
      verts.push(
        x0,
        -d0,
        -y0,
        x1,
        -d1,
        -y1,
        x1,
        -d1 - thick,
        -y1,
        x0,
        -d0 - thick,
        -y0,
      );
      uvs.push(
        x0 * uvScale,
        y0 * uvScale,
        x1 * uvScale,
        y1 * uvScale,
        x1 * uvScale,
        y1 * uvScale,
        x0 * uvScale,
        y0 * uvScale,
      );
      indices.push(r, r + 1, r + 2, r, r + 2, r + 3);
    };
    for (let i = 0; i < open.length; i++) {
      const p0 = open[i];
      const p1 = open[(i + 1) % open.length];
      const segs = desc.omitPerimeterAgainst?.length
        ? openWallSegments(p0, p1, desc.omitPerimeterAgainst)
        : [{ a: p0, b: p1 }];
      for (const seg of segs) {
        const mid = {
          x: (seg.a.x + seg.b.x) / 2,
          y: (seg.a.y + seg.b.y) / 2,
        };
        if (
          desc.omitPerimeterAgainst?.some(
            (poly) =>
              pointInPolygon(mid, poly) ||
              distToPolygonBoundaryMm(mid, poly) <= 40 ||
              segmentHitsFootprint(seg.a, seg.b, poly, 0),
          )
        ) {
          continue;
        }
        emitFloorSide(seg.a, seg.b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [desc]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  const handlers = useSelectHandlers(desc.select, onSelect);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow castShadow {...handlers}>
        <SelectableMaterial
          material={desc.material}
          opacity={desc.opacity}
          selected={selected}
        />
      </mesh>
      {desc.material === "poolFloor" ? (
        <BasinCausticOverlay geometry={geometry} yOffset={0.01} opacity={0.34} />
      ) : null}
    </group>
  );
}

function pushWaterSideRing(
  verts: number[],
  indices: number[],
  ring: PointMm[],
  waterTop: number,
  depthAtShape: (sx: number, sy: number) => number,
  floorClearance: number,
  openAgainst?: PointMm[][],
  basinFloorY?: number,
) {
  const open = ringPts(ring);
  for (let i = 0; i < open.length; i++) {
    const p0 = open[i];
    const p1 = open[(i + 1) % open.length];
    const segs = openAgainst?.length
      ? openWallSegments(p0, p1, openAgainst)
      : [{ a: p0, b: p1 }];
    for (const seg of segs) {
      const mid = {
        x: (seg.a.x + seg.b.x) / 2,
        y: (seg.a.y + seg.b.y) / 2,
      };
      if (
        openAgainst?.some(
          (poly) =>
            pointInPolygon(mid, poly) ||
            distToPolygonBoundaryMm(mid, poly) <= 40 ||
            segmentHitsFootprint(seg.a, seg.b, poly, 0),
        )
      ) {
        continue;
      }
      const x0 = mmToMeters(-seg.a.x);
      const y0 = mmToMeters(seg.a.y);
      const x1 = mmToMeters(-seg.b.x);
      const y1 = mmToMeters(seg.b.y);
      const b0 =
        basinFloorY != null
          ? basinFloorY + floorClearance
          : Math.min(waterTop - 0.12, -depthAtShape(x0, y0) + floorClearance);
      const b1 =
        basinFloorY != null
          ? basinFloorY + floorClearance
          : Math.min(waterTop - 0.12, -depthAtShape(x1, y1) + floorClearance);
      const r = verts.length / 3;
      verts.push(
        x0,
        waterTop,
        -y0,
        x1,
        waterTop,
        -y1,
        x1,
        b1,
        -y1,
        x0,
        b0,
        -y0,
      );
      indices.push(r, r + 1, r + 2, r, r + 2, r + 3);
    }
  }
}

/** Water volume + separate top surface (avoids DoubleSide transparency flicker). */
function WaterBodyMesh({
  desc,
  selected,
  onSelect,
}: {
  desc: WaterBodyDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  const geos = useMemo(() => {
    const empty = {
      volume: new THREE.BufferGeometry(),
      surface: new THREE.BufferGeometry(),
    };
    const open = ringPts(desc.outlineMm);
    if (open.length < 3) return empty;
    const depthAtShape = depthSampler(desc);
    const waterTop = desc.waterTopY;
    // Clear of the structural floor to prevent z-fighting flicker.
    const floorClearance = 0.06;
    const surfaceY = waterTop + 0.004;
    const bottomAt = (d: number) =>
      desc.basinFloorY != null
        ? desc.basinFloorY + floorClearance
        : Math.min(waterTop - 0.12, -d + floorClearance);

    const surf = buildProfiledBasinSurface({
      outlineMm: desc.outlineMm,
      depthStations: desc.depthStations,
      axisOriginMm: desc.axisOriginMm,
      depthAxis: desc.depthAxis,
      axisLengthMm: desc.axisLengthMm,
      yAtDepth: () => surfaceY,
      uvScale: 0.28,
      holeOutlinesMm: desc.holeOutlinesMm,
      edgePadMm: 8,
    });

    const volVerts: number[] = [];
    const volIdx: number[] = [];

    // Profiled basin bottom (follows depth breaks) + side walls
    const bottom = buildProfiledBasinSurface({
      outlineMm: desc.outlineMm,
      depthStations: desc.depthStations,
      axisOriginMm: desc.axisOriginMm,
      depthAxis: desc.depthAxis,
      axisLengthMm: desc.axisLengthMm,
      yAtDepth: bottomAt,
      uvScale: 0.55,
      holeOutlinesMm: desc.holeOutlinesMm,
      edgePadMm: 8,
    });
    const bottomBase = volVerts.length / 3;
    volVerts.push(...bottom.positions);
    for (let i = 0; i < bottom.indices.length; i += 3) {
      const a = bottomBase + bottom.indices[i];
      const b = bottomBase + bottom.indices[i + 1];
      const c = bottomBase + bottom.indices[i + 2];
      // Flip so FrontSide faces upward into the water column
      volIdx.push(a, c, b);
    }

    pushWaterSideRing(
      volVerts,
      volIdx,
      desc.sideOutlineMm ?? desc.outlineMm,
      waterTop,
      depthAtShape,
      floorClearance,
      desc.sideOpenAgainst,
      desc.basinFloorY,
    );
    // Do not add vertical water faces around sunshelf holes — those walls
    // cut through an attached spa when the ledge shares an edge.

    const surface = new THREE.BufferGeometry();
    surface.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(surf.positions, 3),
    );
    surface.setAttribute("uv", new THREE.Float32BufferAttribute(surf.uvs, 2));
    surface.setIndex(surf.indices);
    surface.computeVertexNormals();

    const volume = new THREE.BufferGeometry();
    volume.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(volVerts, 3),
    );
    volume.setIndex(volIdx);
    volume.computeVertexNormals();
    return { volume, surface };
  }, [desc]);

  useEffect(
    () => () => {
      geos.volume.dispose();
      geos.surface.dispose();
    },
    [geos],
  );
  const handlers = useSelectHandlers(desc.select, onSelect);

  return (
    <group>
      <mesh
        geometry={geos.volume}
        renderOrder={2}
        {...handlers}
      >
        <SelectableMaterial
          material={desc.material}
          opacity={desc.opacity ?? 0.34}
          selected={selected}
          waterLayer="volume"
        />
      </mesh>
      <WaterCausticOverlay geometry={geos.surface} />
      <mesh
        geometry={geos.surface}
        renderOrder={3}
        {...handlers}
      >
        <SelectableMaterial
          material={desc.material}
          opacity={desc.surfaceOpacity ?? 0.82}
          selected={selected}
          waterLayer="surface"
        />
      </mesh>
    </group>
  );
}

function GroundMarkMesh({ desc }: { desc: GroundMarkDescriptor }) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const geometry = useMemo(() => {
    const pts = desc.points;
    if (pts.length < 2) return new THREE.BufferGeometry();
    const hw = Math.max(0.06, desc.widthM) / 2;
    const h = Math.max(0.03, desc.heightM ?? 0.08);
    const verts: number[] = [];
    const norms: number[] = [];
    const indices: number[] = [];

    const pushTri = (
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      cx: number,
      cy: number,
      cz: number,
    ) => {
      const base = verts.length / 3;
      verts.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      const e1x = bx - ax;
      const e1y = by - ay;
      const e1z = bz - az;
      const e2x = cx - ax;
      const e2y = cy - ay;
      const e2z = cz - az;
      let nx = e1y * e2z - e1z * e2y;
      let ny = e1z * e2x - e1x * e2z;
      let nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      norms.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      indices.push(base, base + 1, base + 2);
    };

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = (-dz / len) * hw;
      const pz = (dx / len) * hw;
      const a0 = { x: a.x + px, y: a.y, z: a.z + pz };
      const a1 = { x: a.x - px, y: a.y, z: a.z - pz };
      const b0 = { x: b.x + px, y: b.y, z: b.z + pz };
      const b1 = { x: b.x - px, y: b.y, z: b.z - pz };
      const a0t = { x: a0.x, y: a.y + h, z: a0.z };
      const a1t = { x: a1.x, y: a.y + h, z: a1.z };
      const b0t = { x: b0.x, y: b.y + h, z: b0.z };
      const b1t = { x: b1.x, y: b.y + h, z: b1.z };
      // Top
      pushTri(a0t.x, a0t.y, a0t.z, b0t.x, b0t.y, b0t.z, b1t.x, b1t.y, b1t.z);
      pushTri(a0t.x, a0t.y, a0t.z, b1t.x, b1t.y, b1t.z, a1t.x, a1t.y, a1t.z);
      // Bottom (facing down)
      pushTri(a0.x, a0.y, a0.z, b1.x, b1.y, b1.z, b0.x, b0.y, b0.z);
      pushTri(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b1.x, b1.y, b1.z);
      // Sides
      pushTri(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, b0t.x, b0t.y, b0t.z);
      pushTri(a0.x, a0.y, a0.z, b0t.x, b0t.y, b0t.z, a0t.x, a0t.y, a0t.z);
      pushTri(a1.x, a1.y, a1.z, a1t.x, a1t.y, a1t.z, b1t.x, b1t.y, b1t.z);
      pushTri(a1.x, a1.y, a1.z, b1t.x, b1t.y, b1t.z, b1.x, b1.y, b1.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(norms, 3));
    geo.setIndex(indices);
    return geo;
  }, [desc]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  const opacity = desc.opacity ?? 1;
  const transparent = opacity < 0.99;

  return (
    <mesh geometry={geometry} renderOrder={5} frustumCulled={false} castShadow={false}>
      <meshBasicMaterial
        color={desc.colorHex}
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
        side={THREE.DoubleSide}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-8}
        polygonOffsetUnits={-8}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}

function TubeMesh({
  desc,
  selected,
  onSelect,
}: {
  desc: TubeDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  const geometry = useMemo(() => {
    const pts = desc.pointsMm.map((p, i) => {
      const xz = planToWorldXZ(p);
      const elevMm = desc.elevationsMm?.[i];
      const y =
        elevMm != null ? mmToMeters(elevMm) : desc.y;
      return new THREE.Vector3(xz.x, y, xz.z);
    });
    if (pts.length < 2) return new THREE.BufferGeometry();

    // Piecewise-linear path keeps ortho trenches and vertical risers sharp.
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < pts.length - 1; i++) {
      path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    }
    const segs = Math.max(8, pts.length * 8);
    return new THREE.TubeGeometry(path, segs, desc.radiusM, 8, false);
  }, [desc]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  const handlers = useSelectHandlers(desc.select, onSelect);

  return (
    <mesh geometry={geometry} castShadow {...handlers}>
      <SelectableMaterial material={desc.material} selected={selected} />
    </mesh>
  );
}

function SceneLabel({ desc }: { desc: LabelDescriptor }) {
  return (
    <Html
      position={[desc.position.x, desc.position.y, desc.position.z]}
      center
      distanceFactor={14}
      style={{ pointerEvents: "none" }}
    >
      <div className="cad-scene3d-label">{desc.text}</div>
    </Html>
  );
}

function SceneMeshes({
  meshes,
  selection,
  onSelect,
}: {
  meshes: MeshDescriptor[];
  selection: SceneSelection | null;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  return (
    <>
      {meshes.map((m) => {
        const selected =
          "select" in m ? selectionEquals(m.select, selection) : false;
        if (m.kind === "terrain") {
          return <TerrainMesh key={m.id} desc={m} />;
        }
        if (m.kind === "triMesh") {
          return (
            <TriMesh
              key={m.id}
              desc={m}
              selected={selected}
              onSelect={onSelect}
            />
          );
        }
        if (m.kind === "extrude") {
          return (
            <ExtrudeMesh
              key={m.id}
              desc={m}
              selected={selected}
              onSelect={onSelect}
            />
          );
        }
        if (m.kind === "box") {
          return (
            <BoxMesh
              key={m.id}
              desc={m}
              selected={selected}
              onSelect={onSelect}
            />
          );
        }
        if (m.kind === "spilloverRibbon") {
          return (
            <SpilloverRibbonMesh
              key={m.id}
              desc={m}
              selected={selected}
              onSelect={onSelect}
            />
          );
        }
        if (m.kind === "fencePanel") {
          return (
            <FencePanelMesh
              key={m.id}
              desc={m}
              selected={selected}
              onSelect={onSelect}
            />
          );
        }
        if (m.kind === "wallPanel") {
          return (
            <WallPanelMesh
              key={m.id}
              desc={m}
              selected={selected}
              onSelect={onSelect}
            />
          );
        }
        if (m.kind === "floor") {
          return (
            <FloorMesh
              key={m.id}
              desc={m}
              selected={selected}
              onSelect={onSelect}
            />
          );
        }
        if (m.kind === "waterBody") {
          return (
            <WaterBodyMesh
              key={m.id}
              desc={m}
              selected={selected}
              onSelect={onSelect}
            />
          );
        }
        if (m.kind === "groundMark") {
          return <GroundMarkMesh key={m.id} desc={m} />;
        }
        return (
          <TubeMesh
            key={m.id}
            desc={m}
            selected={selected}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}

/** Vertical building wall with punched door/window holes. */
function WallPanelMesh({
  desc,
  selected,
  onSelect,
}: {
  desc: WallPanelDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
}) {
  const handlers = useSelectHandlers(desc.select, onSelect);
  const { geometry, rotationY } = useMemo(() => {
    const L = Math.max(0.05, desc.lengthM);
    const H = Math.max(0.05, desc.heightM);
    const T = Math.max(0.02, desc.thicknessM);
    const shape = new THREE.Shape();
    shape.moveTo(-L / 2, 0);
    shape.lineTo(L / 2, 0);
    shape.lineTo(L / 2, H);
    shape.lineTo(-L / 2, H);
    shape.closePath();

    for (const hole of desc.holes) {
      const hw = Math.max(0.05, hole.w);
      const hh = Math.max(0.05, hole.h);
      // Keep the full opening width — do not shrink toward mid-panel
      // (that caused half-punched windows near corners).
      const x0 = hole.x - hw / 2;
      const x1 = hole.x + hw / 2;
      const y0 = Math.max(0.005, Math.min(H - 0.06, hole.y));
      const y1 = Math.max(y0 + 0.05, Math.min(H - 0.005, hole.y + hh));
      if (x1 <= -L / 2 + 0.01 || x0 >= L / 2 - 0.01) continue;
      if (y1 - y0 < 0.05 || x1 - x0 < 0.05) continue;
      // Clip only to the panel extents; never shrink more than the panel edge.
      const cx0 = Math.max(-L / 2 + 0.001, x0);
      const cx1 = Math.min(L / 2 - 0.001, x1);
      if (cx1 - cx0 < 0.05) continue;
      // Holes must wind opposite the outer shape (CCW outer → CW hole).
      const path = new THREE.Path();
      path.moveTo(cx0, y0);
      path.lineTo(cx0, y1);
      path.lineTo(cx1, y1);
      path.lineTo(cx1, y0);
      path.closePath();
      shape.holes.push(path);
    }

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: T,
      bevelEnabled: false,
    });

    // Align local +X to axisX. After yaw, local +Z is one of the two horizontals.
    const rotationY = Math.atan2(-desc.axisX.z, desc.axisX.x);
    const localZx = Math.sin(rotationY);
    const localZz = Math.cos(rotationY);
    const outwardDot =
      localZx * desc.axisZ.x + localZz * desc.axisZ.z;
    if (outwardDot > 0) {
      // +Z faces outward — shift so the solid fills inward from the exterior face.
      geo.translate(0, 0, -T);
    }
    // else +Z already faces inward; exterior face stays at z=0.

    return { geometry: geo, rotationY };
  }, [desc]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[desc.position.x, desc.position.y, desc.position.z]}
      rotation={[0, rotationY, 0]}
      castShadow
      receiveShadow
      {...handlers}
    >
      <SelectableMaterial
        material={desc.material}
        selected={selected}
        colorHex={desc.colorHex}
        houseSidingId={desc.sidingId}
      />
    </mesh>
  );
}

function CameraPosePersistence({ projectId }: { projectId: string }) {
  const { camera, controls } = useThree();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ctrl = controls as unknown as {
      addEventListener?: (t: string, fn: () => void) => void;
      removeEventListener?: (t: string, fn: () => void) => void;
      target: THREE.Vector3;
    } | null;
    if (!ctrl?.addEventListener) return;
    const onEnd = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const pose: CameraPose3D = {
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [ctrl.target.x, ctrl.target.y, ctrl.target.z],
        };
        saveCameraPose(projectId, pose);
      }, 200);
    };
    ctrl.addEventListener("end", onEnd);
    return () => {
      ctrl.removeEventListener?.("end", onEnd);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [camera, controls, projectId]);

  return null;
}

export type ViewPresetId = "default" | "basin" | "spa" | "top";

function presetPose(
  id: ViewPresetId,
  center: { x: number; z: number },
  dist: number,
  section: BasinSectionFrame | null,
): { position: [number, number, number]; target: [number, number, number] } {
  if (id === "basin" && section) {
    // Sit on the clipped-away side, looking into the open longitudinal section.
    const d = section.distance;
    const n = section.cutNormal;
    return {
      position: [
        section.center.x + n.x * d * 0.62,
        Math.max(0.9, d * 0.06),
        section.center.z + n.z * d * 0.62,
      ],
      target: [section.center.x, section.targetY, section.center.z],
    };
  }
  if (id === "basin") {
    return {
      position: [
        center.x + dist * 0.2,
        dist * 0.12,
        center.z - dist * 0.35,
      ],
      target: [center.x, -1.1, center.z],
    };
  }
  if (id === "spa") {
    return {
      position: [
        center.x - dist * 0.4,
        dist * 0.22,
        center.z - dist * 0.55,
      ],
      target: [center.x + dist * 0.05, -0.35, center.z + dist * 0.05],
    };
  }
  if (id === "top") {
    return {
      position: [center.x, dist * 1.15, center.z + 0.01],
      target: [center.x, 0, center.z],
    };
  }
  return {
    position: [
      center.x + dist * 0.55,
      dist * 0.28,
      center.z - dist * 0.75,
    ],
    target: [center.x, -0.6, center.z],
  };
}

function ClippingEnable({ enabled }: { enabled: boolean }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.localClippingEnabled = enabled;
    return () => {
      gl.localClippingEnabled = false;
    };
  }, [enabled, gl]);
  return null;
}

function ToneMappingExposure({ exposure }: { exposure: number }) {
  const { gl } = useThree();
  useEffect(() => {
    const prev = gl.toneMappingExposure;
    gl.toneMappingExposure = exposure;
    return () => {
      gl.toneMappingExposure = prev;
    };
  }, [exposure, gl]);
  return null;
}

function CameraRig({
  projectId,
  center,
  groundSize,
  viewPreset,
  presetToken,
  section,
  enabled = true,
}: {
  projectId: string;
  center: { x: number; z: number };
  groundSize: number;
  viewPreset: ViewPresetId;
  /** Bumps when the user clicks a preset so we re-apply even if same id. */
  presetToken: number;
  section: BasinSectionFrame | null;
  /** When false (walk mode), orbit is disabled and pose is not applied. */
  enabled?: boolean;
}) {
  const { camera, controls } = useThree();
  const dist = Math.max(12, groundSize * 0.45);
  const target = useMemo(
    () => new THREE.Vector3(center.x, 0, center.z),
    [center.x, center.z],
  );
  const appliedProject = useRef<string | null>(null);
  const lastToken = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (appliedProject.current === projectId && presetToken === lastToken.current) {
      return;
    }
    const isNewProject = appliedProject.current !== projectId;
    appliedProject.current = projectId;
    lastToken.current = presetToken;

    if (isNewProject && presetToken === 0) {
      const saved = loadCameraPose(projectId);
      if (saved) {
        camera.position.set(...saved.position);
        target.set(...saved.target);
        camera.lookAt(target);
        camera.updateProjectionMatrix();
        const ctrl = controls as unknown as { target: THREE.Vector3; update?: () => void } | null;
        if (ctrl?.target) {
          ctrl.target.copy(target);
          ctrl.update?.();
        }
        return;
      }
    }

    const pose = presetPose(viewPreset, center, dist, section);
    camera.position.set(...pose.position);
    target.set(...pose.target);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    const ctrl = controls as unknown as { target: THREE.Vector3; update?: () => void } | null;
    if (ctrl?.target) {
      ctrl.target.copy(target);
      ctrl.update?.();
    }
  }, [
    camera,
    center,
    controls,
    dist,
    enabled,
    presetToken,
    projectId,
    section,
    target,
    viewPreset,
  ]);

  if (!enabled) return null;

  return (
    <>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={Math.max(80, groundSize * 5)}
        maxPolarAngle={Math.PI * 0.495}
        target={target}
      />
      <CameraPosePersistence projectId={projectId} />
    </>
  );
}

type ExportApi = {
  capturePng: () => void;
  capturePngDataUrl: () => string;
  recordOrbit: () => Promise<void>;
};

export type { CadScene3DHandle } from "@/lib/cad3d/cadScene3dHandle";

/** "Kendig Residence Pool" → "kendig_residence_pool" */
function projectExportSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "pool_design";
}

function ExportBridge({
  apiRef,
  projectName,
}: {
  apiRef: MutableRefObject<ExportApi | null>;
  projectName: string;
}) {
  const { gl, camera, scene, controls } = useThree();

  useEffect(() => {
    apiRef.current = {
      capturePngDataUrl: () => {
        gl.render(scene, camera);
        return gl.domElement.toDataURL("image/png");
      },
      capturePng: () => {
        gl.render(scene, camera);
        const url = gl.domElement.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `${projectExportSlug(projectName)}.png`;
        a.click();
      },
      recordOrbit: async () => {
        const canvas = gl.domElement;
        const stream = canvas.captureStream(30);
        const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";
        const recorder = new MediaRecorder(stream, {
          mimeType: mime,
          videoBitsPerSecond: 6_000_000,
        });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        const done = new Promise<Blob>((resolve) => {
          recorder.onstop = () =>
            resolve(new Blob(chunks, { type: "video/webm" }));
        });
        recorder.start();

        const ctrl = controls as { target: THREE.Vector3 } | null;
        const target = ctrl?.target?.clone() ?? new THREE.Vector3();
        const start = camera.position.clone();
        const radius = start.distanceTo(target);
        const startAngle = Math.atan2(start.x - target.x, start.z - target.z);
        const elev = start.y - target.y;
        const durationMs = 4000;
        const t0 = performance.now();

        await new Promise<void>((resolve) => {
          const tick = (now: number) => {
            const u = Math.min(1, (now - t0) / durationMs);
            const ang = startAngle + u * Math.PI * 2;
            camera.position.set(
              target.x + Math.sin(ang) * radius,
              target.y + elev,
              target.z + Math.cos(ang) * radius,
            );
            camera.lookAt(target);
            gl.render(scene, camera);
            if (u < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });

        recorder.stop();
        const blob = await done;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `poolshape-orbit-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, camera, controls, gl, projectName, scene]);

  return null;
}

type Props = {
  design: DesignDocument;
  projectId: string;
  projectName: string;
  selection: SceneSelection | null;
  onSelect: (sel: SceneSelection | null) => void;
  onDelete?: () => void;
  /** Optional handle for parent Share / capture flows. */
  exportHandleRef?: MutableRefObject<CadScene3DHandle | null>;
};

export function CadScene3DCanvas({
  design,
  projectId,
  projectName,
  selection,
  onSelect,
  onDelete,
  exportHandleRef,
}: Props) {
  const [showPlumbing, setShowPlumbing] = useState(false);
  const [showSiteLines, setShowSiteLines] = useState(true);
  const [hideDeck, setHideDeck] = useState(false);
  const [viewPreset, setViewPreset] = useState<ViewPresetId>("default");
  const [walkMode, setWalkMode] = useState(false);
  const [walkLocked, setWalkLocked] = useState(false);
  const [walkSpawnToken, setWalkSpawnToken] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("noon");
  const [presetToken, setPresetToken] = useState(0);
  const [cutOffset, setCutOffset] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const exportApi = useRef<ExportApi | null>(null);

  useEffect(() => {
    if (!exportHandleRef) return;
    exportHandleRef.current = {
      capturePngDataUrl: () => exportApi.current?.capturePngDataUrl() ?? null,
    };
    return () => {
      exportHandleRef.current = null;
    };
  }, [exportHandleRef]);
  const textures = useSceneTextures();
  const tod = TIME_OF_DAY_PRESETS[timeOfDay];

  const section = useMemo(() => basinSectionFrame(design), [design]);
  const cutaway = !walkMode && viewPreset === "basin";
  const effectiveHideDeck = hideDeck || cutaway;
  const walkSpawn = useMemo(() => walkSpawnPose(design), [design]);

  const clipPlanes = useMemo(() => {
    if (!cutaway || !section) return [] as THREE.Plane[];
    return [
      new THREE.Plane(
        new THREE.Vector3(section.cutNormal.x, 0, section.cutNormal.z),
        basinCutPlaneConstant(section, cutOffset),
      ),
    ];
  }, [cutaway, section, cutOffset]);

  const model = useMemo(
    () =>
      buildSceneModel(design, {
        showPlumbing,
        showSiteLines,
        hideDeck: effectiveHideDeck,
      }),
    [design, showPlumbing, showSiteLines, effectiveHideDeck],
  );
  const labels = useMemo(
    () => selectionReadouts(design, selection),
    [design, selection],
  );
  const lighting = useMemo(
    () => lightingForNorth(tod, design.northDeg ?? 0, model.center),
    [tod, design.northDeg, model.center],
  );
  const lotPadHalfM = useMemo(() => {
    let x = 16;
    let z = 16;
    for (const p of model.ground.outlineMm) {
      const w = planToWorldXZ(p);
      x = Math.max(x, Math.abs(w.x - model.center.x));
      z = Math.max(z, Math.abs(w.z - model.center.z));
    }
    return { x, z };
  }, [model.ground.outlineMm, model.center.x, model.center.z]);
  const applyPreset = (id: ViewPresetId) => {
    setWalkMode(false);
    setWalkLocked(false);
    setViewPreset(id);
    setPresetToken((t) => t + 1);
    if (id === "basin") setCutOffset(0);
  };

  const enterWalk = () => {
    setWalkMode(true);
    setWalkLocked(false);
    setWalkSpawnToken((t) => t + 1);
    if (viewPreset === "basin") setViewPreset("default");
  };

  const onCapture = () => exportApi.current?.capturePng();
  const onRecordOrbit = async () => {
    if (!exportApi.current || exportBusy) return;
    setExportBusy(true);
    try {
      await exportApi.current.recordOrbit();
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="cad-scene3d">
      <div className="cad-scene3d-toolbar" role="toolbar" aria-label="3D view">
        <div className="cad-scene3d-toolbar-group">
          <button
            type="button"
            className={`btn secondary cad-scene3d-tool-btn ${!walkMode && viewPreset === "default" ? "active" : ""}`}
            onClick={() => applyPreset("default")}
          >
            Orbit
          </button>
          <button
            type="button"
            className={`btn secondary cad-scene3d-tool-btn ${walkMode ? "active" : ""}`}
            onClick={enterWalk}
            title="Walk the property in first person — starts inside the house looking out"
          >
            Walk
          </button>
          <button
            type="button"
            className={`btn secondary cad-scene3d-tool-btn ${!walkMode && viewPreset === "basin" ? "active" : ""}`}
            onClick={() => applyPreset("basin")}
          >
            Into basin
          </button>
          <button
            type="button"
            className={`btn secondary cad-scene3d-tool-btn ${!walkMode && viewPreset === "spa" ? "active" : ""}`}
            onClick={() => applyPreset("spa")}
          >
            Spa
          </button>
          <button
            type="button"
            className={`btn secondary cad-scene3d-tool-btn ${!walkMode && viewPreset === "top" ? "active" : ""}`}
            onClick={() => applyPreset("top")}
          >
            Top
          </button>
        </div>
        <div className="cad-scene3d-toolbar-group" role="group" aria-label="Time of day">
          {TIME_OF_DAY_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={`btn secondary cad-scene3d-tool-btn ${timeOfDay === id ? "active" : ""}`}
              onClick={() => setTimeOfDay(id)}
              aria-pressed={timeOfDay === id}
              title={`${TIME_OF_DAY_PRESETS[id].label} — ${TIME_OF_DAY_PRESETS[id].hint}`}
            >
              {TIME_OF_DAY_PRESETS[id].label}
            </button>
          ))}
        </div>
        <div className="cad-scene3d-toolbar-group">
          <button
            type="button"
            className={`btn secondary cad-scene3d-tool-btn ${hideDeck || cutaway ? "active" : ""}`}
            onClick={() => setHideDeck((v) => !v)}
            aria-pressed={hideDeck || cutaway}
            disabled={cutaway}
            title={
              cutaway
                ? "Deck is hidden in the basin cutaway"
                : "Hide patio / deck slabs"
            }
          >
            Hide deck
          </button>
          <button
            type="button"
            className={`btn secondary cad-scene3d-tool-btn ${showPlumbing ? "active" : ""}`}
            onClick={() => setShowPlumbing((v) => !v)}
            aria-pressed={showPlumbing}
            title="Show buried trench plumbing from the pool/spa to the pad"
          >
            Buried pipes
          </button>
          <button
            type="button"
            className={`btn secondary cad-scene3d-tool-btn ${showSiteLines ? "active" : ""}`}
            onClick={() => setShowSiteLines((v) => !v)}
            aria-pressed={showSiteLines}
            disabled={!(design.siteLines ?? []).some((l) => l.points.length >= 2)}
            title={
              (design.siteLines ?? []).some((l) => l.points.length >= 2)
                ? "Show property lines and easements on the ground (also in Layers)"
                : "Trace a property line or easement in 2D first"
            }
          >
            Lot lines
          </button>
          <button
            type="button"
            className="btn secondary cad-scene3d-tool-btn"
            onClick={onCapture}
          >
            PNG
          </button>
          <button
            type="button"
            className="btn secondary cad-scene3d-tool-btn"
            onClick={() => void onRecordOrbit()}
            disabled={exportBusy}
          >
            {exportBusy ? "Recording…" : "Orbit clip"}
          </button>
          <button
            type="button"
            className="btn danger cad-scene3d-tool-btn"
            onClick={() => onDelete?.()}
            disabled={!selection || !onDelete}
            title={
              selection
                ? "Remove selected item from the plan (Delete)"
                : "Select an item to delete"
            }
          >
            Delete
          </button>
        </div>
      </div>
      {cutaway ? (
        <div className="cad-scene3d-cut-slider">
          <label htmlFor="cut-offset">
            Cut position
            <input
              id="cut-offset"
              type="range"
              min={-1}
              max={1}
              step={0.02}
              value={cutOffset}
              onChange={(e) => setCutOffset(Number(e.target.value))}
            />
          </label>
        </div>
      ) : null}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 45, near: 0.1, far: 8000 }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          localClippingEnabled: true,
        }}
        onPointerMissed={() => onSelect(null)}
      >
        <TextureContext.Provider value={textures}>
          <TimeOfDayContext.Provider value={timeOfDay}>
            <WaterTextureContext.Provider value={textures?.water ?? null}>
              <ClipPlanesContext.Provider value={clipPlanes}>
                <ClippingEnable enabled={clipPlanes.length > 0} />
                <ToneMappingExposure exposure={tod.exposure} />
                <ExportBridge apiRef={exportApi} projectName={projectName} />
                <SoftShadowSetup />
                <PresentationBloom timeOfDay={timeOfDay} />
                <WaterEnvironment
                  timeOfDay={timeOfDay}
                  sunDir={lighting.sunDir}
                />
                <color attach="background" args={[tod.background]} />
                <fog attach="fog" args={[tod.fog, tod.fogNear, tod.fogFar]} />
                <WorldBackdrop
                  center={model.center}
                  lotPadHalfM={lotPadHalfM}
                  tod={tod}
                  sunPosition={lighting.sunPosition}
                  groundMap={textures?.ground.color ?? null}
                  groundRoughness={textures?.ground.roughness ?? null}
                  night={isNightTime(timeOfDay)}
                />
                <ambientLight intensity={tod.ambient} />
                <SunLight
                  position={lighting.sunWorld}
                  intensity={tod.sun.intensity}
                  color={tod.sun.color}
                  castShadow
                  center={model.center}
                  groundSize={model.groundSize}
                />
                <directionalLight
                  position={lighting.fillWorld}
                  intensity={tod.fill.intensity}
                  color={tod.fill.color}
                />
                <hemisphereLight
                  args={[tod.hemi.sky, tod.hemi.ground, tod.hemi.intensity]}
                />

                {model.ground.height > 0.001 ? (
                  <ExtrudeMesh
                    desc={model.ground}
                    selected={false}
                    onSelect={() => onSelect(null)}
                  />
                ) : null}

                <SceneMeshes
                  meshes={model.meshes}
                  selection={selection}
                  onSelect={onSelect}
                />
                {cutaway && section ? (
                  <SectionCapMesh section={section} cutOffset={cutOffset} />
                ) : null}
                {labels.map((lbl) => (
                  <SceneLabel key={lbl.id} desc={lbl} />
                ))}
                {walkMode ? (
                  <WalkControls
                    spawn={walkSpawn}
                    spawnToken={walkSpawnToken}
                    center={model.center}
                    groundSize={model.groundSize}
                    onLockChange={setWalkLocked}
                  />
                ) : (
                  <CameraRig
                    projectId={projectId}
                    center={model.center}
                    groundSize={model.groundSize}
                    viewPreset={viewPreset}
                    presetToken={presetToken}
                    section={section}
                    enabled
                  />
                )}
              </ClipPlanesContext.Provider>
            </WaterTextureContext.Provider>
          </TimeOfDayContext.Provider>
        </TextureContext.Provider>
      </Canvas>
      {walkMode ? (
        <>
          <div
            className={`cad-scene3d-walk-veil ${walkLocked ? "is-locked" : ""}`}
            aria-hidden={walkLocked}
          >
            {walkLocked ? null : (
              <div className="cad-scene3d-walk-card">
                <p className="cad-scene3d-walk-title">
                  {walkSpawn.fromBuilding
                    ? "Inside the house — looking out to the yard"
                    : "Walk the property"}
                </p>
                <p className="cad-scene3d-walk-body">
                  Click the scene to look around.{" "}
                  <kbd>W</kbd>
                  <kbd>A</kbd>
                  <kbd>S</kbd>
                  <kbd>D</kbd> move · <kbd>Shift</kbd> sprint · <kbd>Esc</kbd>{" "}
                  release mouse
                </p>
                <button
                  type="button"
                  className="btn secondary cad-scene3d-tool-btn"
                  onClick={enterWalk}
                >
                  Respawn
                </button>
              </div>
            )}
          </div>
          {walkLocked ? <div className="cad-scene3d-crosshair" aria-hidden /> : null}
        </>
      ) : null}
      <div className="cad-scene3d-hint">
        {walkMode
          ? walkLocked
            ? "WASD move · Shift sprint · Esc release mouse · Walk again to respawn inside"
            : "Click the scene to start walking · Esc anytime to release the mouse"
          : cutaway
            ? "Basin cutaway — slide Cut position · drag to orbit · PNG / Orbit clip to share"
            : "Click to select · drag to orbit · PNG / Orbit clip to export · edit in 2D"}
      </div>
    </div>
  );
}
