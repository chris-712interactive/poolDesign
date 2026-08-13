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
import { Html, OrbitControls, Sky } from "@react-three/drei";
import * as THREE from "three";
import type { DesignDocument, PointMm } from "@pool-design/shared";
import {
  depthMmAtT,
  depthTAtPlanPoint,
  mmToMeters,
  planToWorldXZ,
  pointInPolygon,
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
import {
  PresentationBloom,
  SoftShadowSetup,
  SunLight,
} from "@/lib/cad3d/presentationEffects";
import {
  TIME_OF_DAY_ORDER,
  TIME_OF_DAY_PRESETS,
  TimeOfDayContext,
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
  let pts = ringPts(outlineMm);
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
  let pts = ringPts(outlineMm);
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
  waterShallow,
}: {
  material: SceneMaterialKey;
  opacity?: number;
  selected: boolean;
  waterLayer?: "volume" | "surface";
  patioFinishId?: string;
  waterlineTileId?: string;
  colorHex?: string;
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
  const pair =
    patioPair ??
    waterlinePair ??
    (mat.map && textures ? textures[mat.map] : null);
  const isWater =
    material === "poolWater" ||
    material === "spaWater" ||
    material === "sectionWater" ||
    material === "spilloverWater";
  const transparent =
    material === "cover"
      ? false
      : (opacity ?? 1) < 0.99 || material === "window" || isWater;
  const color = colorHex ?? mat.color;
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
      roughness={mat.roughness}
      metalness={mat.metalness}
      transparent={transparent}
      opacity={opacity ?? 1}
      // Opaque shells keep DoubleSide for cutaways; water uses FrontSide above.
      side={THREE.DoubleSide}
      depthWrite={!transparent}
      envMapIntensity={mat.envMapIntensity ?? 0.85}
      emissive={selected ? "#1f8a70" : "#000000"}
      emissiveIntensity={selected ? 0.28 : 0}
      clippingPlanes={clippingPlanes}
      clipShadows={clippingPlanes.length > 0}
    />
  );
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
        uvs[idx * 2] = i / Math.max(1, cols - 1);
        uvs[idx * 2 + 1] = j / Math.max(1, rows - 1);
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
    const isShallowWater =
      desc.waterShallow === true &&
      (desc.material === "poolWater" || desc.material === "spaWater");
    // Flat single-face film for sunshelf water — an extruded slab's top+bottom
    // faces stack in transparency and read as dark navy over the ledge.
    if (isShallowWater) {
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, desc.bottomY + Math.max(0.004, desc.height), 0);
      return geo;
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, desc.height),
      bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, desc.bottomY, 0);
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
        />
      </mesh>
      {desc.material === "poolFloor" ? (
        <BasinCausticOverlay
          geometry={geometry}
          yOffset={Math.max(0.008, desc.height * 0.92)}
          opacity={0.3}
        />
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
    if (postSize > 0) {
      postList.push(
        { x: ax, y: ay + h / 2, z: az, h, size: postSize },
        { x: bx, y: by + h / 2, z: bz, h, size: postSize },
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
        }[],
        posts: postList,
      };
    }

    const railH = Math.min(0.05, h * 0.08);
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

    // Pack pickets edge-to-edge across the clear bay (adjust gap to fill).
    const spanStart = railInset;
    const spanEnd = len - railInset;
    const spanLen = spanEnd - spanStart;
    let count =
      spanLen > 0
        ? Math.max(1, Math.round((spanLen + picketGap) / (picketW + picketGap)))
        : 0;
    while (count > 1 && count * picketW > spanLen + 1e-6) count -= 1;
    const gap =
      count > 1 ? Math.max(0, (spanLen - count * picketW) / (count - 1)) : 0;
    const picketList: { x: number; y: number; z: number; h: number }[] = [];
    const picketH = Math.max(0.05, h - railH * 1.6);
    for (let i = 0; i < count; i++) {
      const d = spanStart + picketW / 2 + i * (picketW + gap);
      const t = d / len;
      const x = ax + dx * t;
      const z = az + dz * t;
      const yBase = ay + (by - ay) * t + railH * 0.85;
      picketList.push({
        x,
        y: yBase + picketH / 2,
        z,
        h: picketH,
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

  const picketW = desc.picketWidthM ?? 0.045;
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
            <boxGeometry
              args={[rail.len, Math.min(0.05, desc.heightM * 0.08), Math.max(0.02, desc.thicknessM)]}
            />
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
          <boxGeometry
            args={[picketW, p.h, Math.max(0.02, desc.thicknessM * 0.75)]}
          />
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
      // Keep a thin band outside so edge cells still form; depth still valid.
      inside[i] =
        pointInPolygon(plan, open) ||
        pointInPolygon(
          {
            x: plan.x + perp.x * 30,
            y: plan.y + perp.y * 30,
          },
          open,
        ) ||
        pointInPolygon(
          {
            x: plan.x - perp.x * 30,
            y: plan.y - perp.y * 30,
          },
          open,
        );
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
    for (let i = 0; i < open.length; i++) {
      const p0 = open[i];
      const p1 = open[(i + 1) % open.length];
      const x0 = mmToMeters(-p0.x);
      const y0 = mmToMeters(p0.y);
      const x1 = mmToMeters(-p1.x);
      const y1 = mmToMeters(p1.y);
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
) {
  const open = ringPts(ring);
  for (let i = 0; i < open.length; i++) {
    const p0 = open[i];
    const p1 = open[(i + 1) % open.length];
    const x0 = mmToMeters(-p0.x);
    const y0 = mmToMeters(p0.y);
    const x1 = mmToMeters(-p1.x);
    const y1 = mmToMeters(p1.y);
    const b0 = Math.min(waterTop - 0.12, -depthAtShape(x0, y0) + floorClearance);
    const b1 = Math.min(waterTop - 0.12, -depthAtShape(x1, y1) + floorClearance);
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

    const shape = outlineToShape(desc.outlineMm, false);
    for (const hole of desc.holeOutlinesMm ?? []) {
      if (hole.length >= 3) shape.holes.push(outlineToPath(hole, true));
    }
    const shapeGeo = new THREE.ShapeGeometry(shape);
    const src = shapeGeo.attributes.position;
    const srcIndex = shapeGeo.index;
    const n = src.count;

    const surfVerts: number[] = [];
    const surfIdx: number[] = [];
    const volVerts: number[] = [];
    const volIdx: number[] = [];

    // Surface: top face only (slightly above volume top to avoid coplanar fight)
    const surfaceY = waterTop + 0.004;
    for (let i = 0; i < n; i++) {
      surfVerts.push(src.getX(i), surfaceY, -src.getY(i));
    }
    if (srcIndex) {
      for (let i = 0; i < srcIndex.count; i += 3) {
        surfIdx.push(
          srcIndex.getX(i),
          srcIndex.getX(i + 1),
          srcIndex.getX(i + 2),
        );
      }
    }

    // Profiled basin bottom (follows depth breaks) + side walls
    const bottom = buildProfiledBasinSurface({
      outlineMm: desc.outlineMm,
      depthStations: desc.depthStations,
      axisOriginMm: desc.axisOriginMm,
      depthAxis: desc.depthAxis,
      axisLengthMm: desc.axisLengthMm,
      yAtDepth: (d) => Math.min(waterTop - 0.12, -d + floorClearance),
      uvScale: 0.55,
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
      desc.outlineMm,
      waterTop,
      depthAtShape,
      floorClearance,
    );
    for (const hole of desc.holeOutlinesMm ?? []) {
      pushWaterSideRing(
        volVerts,
        volIdx,
        hole,
        waterTop,
        depthAtShape,
        floorClearance,
      );
    }

    const surface = new THREE.BufferGeometry();
    surface.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(surfVerts, 3),
    );
    surface.setIndex(surfIdx);
    surface.computeVertexNormals();
    // Planar UVs — meters → texture space for caustics / ripple normals
    const uvs: number[] = [];
    for (let i = 0; i < n; i++) {
      uvs.push(src.getX(i) * 0.55, src.getY(i) * 0.55);
    }
    surface.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

    const volume = new THREE.BufferGeometry();
    volume.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(volVerts, 3),
    );
    volume.setIndex(volIdx);
    volume.computeVertexNormals();
    shapeGeo.dispose();
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
        maxDistance={groundSize * 3}
        maxPolarAngle={Math.PI * 0.49}
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
        hideDeck: effectiveHideDeck,
      }),
    [design, showPlumbing, effectiveHideDeck],
  );
  const labels = useMemo(
    () => selectionReadouts(design, selection),
    [design, selection],
  );
  const lighting = useMemo(
    () => lightingForNorth(tod, design.northDeg ?? 0, model.center),
    [tod, design.northDeg, model.center],
  );

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
        camera={{ fov: 45, near: 0.1, far: 2000 }}
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
                {tod.showSky ? (
                  <Sky
                    sunPosition={lighting.sunPosition}
                    turbidity={tod.sky.turbidity}
                    rayleigh={tod.sky.rayleigh}
                    mieCoefficient={tod.sky.mieCoefficient}
                    mieDirectionalG={tod.sky.mieDirectionalG}
                  />
                ) : null}
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
      <div className="cad-scene3d-hint muted">
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
