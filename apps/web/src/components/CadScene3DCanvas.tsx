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
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Sky } from "@react-three/drei";
import * as THREE from "three";
import type { DesignDocument, PointMm } from "@pool-design/shared";
import {
  depthMmAtT,
  depthTAtPlanPoint,
  mmToMeters,
  planToWorldXZ,
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
  type FloorDescriptor,
  type LabelDescriptor,
  type MeshDescriptor,
  type SceneMaterialKey,
  type SceneSelection,
  type TerrainDescriptor,
  type TubeDescriptor,
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
  makeDeckTexture,
  makeGroundTexture,
  makePebbleFloorTexture,
  makePlasterTexture,
  makeStoneCopingTexture,
  makeStuccoTexture,
  makeWaterSurfaceTexture,
  makeWaterlineTileTexture,
} from "@/lib/cad3d/proceduralTextures";
import { getPatioFinishTexture } from "@/lib/cad3d/patioFinishTextures";
import { OpeningMesh } from "@/lib/cad3d/OpeningMesh";

type MatDef = {
  color: string;
  roughness: number;
  metalness: number;
  map?: "plaster" | "pebble" | "tile" | "stone" | "deck" | "ground" | "stucco";
  mapRepeat?: [number, number];
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
  poolWater: { color: "#1a7fa3", roughness: 0.08, metalness: 0.12 },
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
    roughness: 0.62,
    metalness: 0.04,
    map: "stone",
    mapRepeat: [3, 1.2],
  },
  waterline: {
    color: "#ffffff",
    roughness: 0.28,
    metalness: 0.12,
    map: "tile",
    mapRepeat: [10, 1.4],
  },
  spaShell: {
    color: "#ffffff",
    roughness: 0.55,
    metalness: 0.02,
    map: "plaster",
    mapRepeat: [3, 3],
  },
  spaWater: { color: "#1a7fa3", roughness: 0.08, metalness: 0.12 },
  cover: { color: "#4a433c", roughness: 0.92, metalness: 0 },
  pergola: { color: "#8b7355", roughness: 0.75, metalness: 0 },
  object: { color: "#5c7a6e", roughness: 0.7, metalness: 0.1 },
  equipment: { color: "#4a5560", roughness: 0.55, metalness: 0.25 },
  feature: { color: "#c9c2b4", roughness: 0.85, metalness: 0 },
  door: { color: "#5a4030", roughness: 0.65, metalness: 0.05 },
  window: { color: "#8ec8e0", roughness: 0.1, metalness: 0.35 },
  pipeSuction: { color: "#2f6f9f", roughness: 0.45, metalness: 0.2 },
  pipeReturn: { color: "#c45c2c", roughness: 0.45, metalness: 0.2 },
  pipeOther: { color: "#6a8f4e", roughness: 0.5, metalness: 0.15 },
  pipeGas: { color: "#b89b2c", roughness: 0.5, metalness: 0.2 },
  sectionCap: { color: "#e8eeec", roughness: 0.55, metalness: 0.02 },
  sectionWater: { color: "#1a7fa3", roughness: 0.1, metalness: 0.1 },
  fill: { color: "#a89070", roughness: 0.95, metalness: 0 },
  retaining: { color: "#8a8074", roughness: 0.85, metalness: 0.05 },
};

type SceneTextures = {
  plaster: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  pebble: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  tile: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  stone: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  deck: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  ground: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  stucco: { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  water: THREE.CanvasTexture;
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
      water: makeWaterSurfaceTexture(),
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
}: {
  material: SceneMaterialKey;
  opacity?: number;
  selected: boolean;
  waterLayer?: "volume" | "surface";
  patioFinishId?: string;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const textures = useContext(TextureContext);
  const mat = MATERIALS[material] ?? MATERIALS.object;
  const patioPair = useMemo(
    () =>
      material === "patio" ? getPatioFinishTexture(patioFinishId) : null,
    [material, patioFinishId],
  );
  const pair =
    patioPair ?? (mat.map && textures ? textures[mat.map] : null);
  const isWater =
    material === "poolWater" ||
    material === "spaWater" ||
    material === "sectionWater";
  const transparent =
    material === "cover"
      ? false
      : (opacity ?? 1) < 0.99 || material === "window" || isWater;
  if (isWater) {
    const surface = waterLayer === "surface";
    return (
      <meshStandardMaterial
        color={mat.color}
        map={surface ? (textures?.water ?? undefined) : undefined}
        roughness={surface ? 0.06 : 0.22}
        metalness={surface ? 0.28 : 0.05}
        transparent
        opacity={
          surface
            ? Math.min(0.72, Math.max(0.48, opacity ?? 0.58))
            : Math.min(0.32, Math.max(0.18, opacity ?? 0.24))
        }
        side={THREE.FrontSide}
        // Surface writes depth so the basin doesn't flicker; volume does not.
        depthWrite={surface}
        polygonOffset
        polygonOffsetFactor={surface ? -2 : 1}
        polygonOffsetUnits={surface ? -2 : 1}
        emissive={selected ? "#1f8a70" : "#000000"}
        emissiveIntensity={selected ? 0.22 : 0}
        clippingPlanes={clippingPlanes}
        clipShadows={clippingPlanes.length > 0}
      />
    );
  }

  return (
    <meshStandardMaterial
      color={mat.color}
      map={pair?.color}
      roughnessMap={pair?.roughness}
      roughness={mat.roughness}
      metalness={mat.metalness}
      transparent={transparent}
      opacity={opacity ?? 1}
      // Opaque shells keep DoubleSide for cutaways; water uses FrontSide above.
      side={THREE.DoubleSide}
      depthWrite={!transparent}
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
    isWater && desc.height <= 0.04 ? "surface" : isWater ? "volume" : undefined;

  return (
    <mesh
      geometry={geometry}
      castShadow={!isWater}
      receiveShadow={!isWater}
      renderOrder={isWater ? (waterLayer === "surface" ? 3 : 2) : 0}
      {...handlers}
    >
      <SelectableMaterial
        material={desc.material}
        opacity={desc.opacity}
        selected={selected}
        waterLayer={waterLayer}
        patioFinishId={desc.patioFinishId}
      />
    </mesh>
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
  const handlers = useSelectHandlers(desc.select, onSelect);
  const rotationY = useMemo(() => {
    if (desc.axisX) {
      return Math.atan2(-desc.axisX.z, desc.axisX.x);
    }
    return desc.rotationY;
  }, [desc.axisX, desc.rotationY]);

  return (
    <mesh
      position={[desc.position.x, desc.position.y, desc.position.z]}
      rotation={[0, rotationY, 0]}
      castShadow
      receiveShadow
      {...handlers}
    >
      <boxGeometry args={[desc.size.x, desc.size.y, desc.size.z]} />
      <SelectableMaterial
        material={desc.material}
        opacity={desc.opacity}
        selected={selected}
      />
    </mesh>
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

    const shape = outlineToShape(desc.outlineMm, false);
    const shapeGeo = new THREE.ShapeGeometry(shape);
    const src = shapeGeo.attributes.position;
    const srcIndex = shapeGeo.index;
    const n = src.count;
    const verts: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const uvScale = 0.45;

    for (let i = 0; i < n; i++) {
      const sx = src.getX(i);
      const sy = src.getY(i);
      const d = depthAtShape(sx, sy);
      verts.push(sx, -d, -sy);
      uvs.push(sx * uvScale, sy * uvScale);
    }
    for (let i = 0; i < n; i++) {
      const sx = src.getX(i);
      const sy = src.getY(i);
      const d = depthAtShape(sx, sy);
      verts.push(sx, -d - thick, -sy);
      uvs.push(sx * uvScale, sy * uvScale);
    }

    if (srcIndex) {
      for (let i = 0; i < srcIndex.count; i += 3) {
        const a = srcIndex.getX(i);
        const bi = srcIndex.getX(i + 1);
        const c = srcIndex.getX(i + 2);
        indices.push(a, bi, c);
        indices.push(n + a, n + c, n + bi);
      }
    }

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
    shapeGeo.dispose();
    return geo;
  }, [desc]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  const handlers = useSelectHandlers(desc.select, onSelect);

  return (
    <mesh geometry={geometry} receiveShadow castShadow {...handlers}>
      <SelectableMaterial
        material={desc.material}
        opacity={desc.opacity}
        selected={selected}
      />
    </mesh>
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

    // Volume: bottom + sides only (no top — surface mesh owns the waterline)
    for (let i = 0; i < n; i++) {
      const sx = src.getX(i);
      const sy = src.getY(i);
      const d = depthAtShape(sx, sy);
      const bottomY = Math.min(waterTop - 0.12, -d + floorClearance);
      volVerts.push(sx, bottomY, -sy);
    }
    // Degenerate thin top ring for side attachment reference (not rendered as face)
    // Sides connect waterTop → bottom
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
    // Soft bottom fill (facing up into the basin — reverse winding vs top)
    if (srcIndex) {
      const base = 0;
      for (let i = 0; i < srcIndex.count; i += 3) {
        const a = srcIndex.getX(i);
        const bi = srcIndex.getX(i + 1);
        const c = srcIndex.getX(i + 2);
        // Flip so FrontSide faces upward into the water column
        volIdx.push(base + a, base + c, base + bi);
      }
    }

    const surface = new THREE.BufferGeometry();
    surface.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(surfVerts, 3),
    );
    surface.setIndex(surfIdx);
    surface.computeVertexNormals();
    // Simple planar UVs for caustic map
    const uvs: number[] = [];
    for (let i = 0; i < n; i++) {
      uvs.push(src.getX(i) * 0.35, src.getY(i) * 0.35);
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
          opacity={desc.opacity ?? 0.24}
          selected={selected}
          waterLayer="volume"
        />
      </mesh>
      <mesh
        geometry={geos.surface}
        renderOrder={3}
        {...handlers}
      >
        <SelectableMaterial
          material={desc.material}
          opacity={desc.surfaceOpacity ?? 0.58}
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
    const pts = desc.pointsMm.map((p) => {
      const xz = planToWorldXZ(p);
      return new THREE.Vector3(xz.x, desc.y, xz.z);
    });
    if (pts.length < 2) return new THREE.BufferGeometry();
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1);
    return new THREE.TubeGeometry(
      curve,
      Math.max(8, pts.length * 6),
      desc.radiusM,
      8,
      false,
    );
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

function CameraRig({
  projectId,
  center,
  groundSize,
  viewPreset,
  presetToken,
  section,
}: {
  projectId: string;
  center: { x: number; z: number };
  groundSize: number;
  viewPreset: ViewPresetId;
  /** Bumps when the user clicks a preset so we re-apply even if same id. */
  presetToken: number;
  section: BasinSectionFrame | null;
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
    presetToken,
    projectId,
    section,
    target,
    viewPreset,
  ]);

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
  recordOrbit: () => Promise<void>;
};

function ExportBridge({
  apiRef,
}: {
  apiRef: MutableRefObject<ExportApi | null>;
}) {
  const { gl, camera, scene, controls } = useThree();

  useEffect(() => {
    apiRef.current = {
      capturePng: () => {
        gl.render(scene, camera);
        const url = gl.domElement.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `pool-design-${Date.now()}.png`;
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
        a.download = `pool-design-orbit-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, camera, controls, gl, scene]);

  return null;
}

type Props = {
  design: DesignDocument;
  projectId: string;
  selection: SceneSelection | null;
  onSelect: (sel: SceneSelection | null) => void;
};

export function CadScene3DCanvas({
  design,
  projectId,
  selection,
  onSelect,
}: Props) {
  const [showPlumbing, setShowPlumbing] = useState(false);
  const [hideDeck, setHideDeck] = useState(false);
  const [viewPreset, setViewPreset] = useState<ViewPresetId>("default");
  const [presetToken, setPresetToken] = useState(0);
  const [cutOffset, setCutOffset] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const exportApi = useRef<ExportApi | null>(null);
  const textures = useSceneTextures();

  const section = useMemo(() => basinSectionFrame(design), [design]);
  const cutaway = viewPreset === "basin";
  const effectiveHideDeck = hideDeck || cutaway;

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

  const applyPreset = (id: ViewPresetId) => {
    setViewPreset(id);
    setPresetToken((t) => t + 1);
    if (id === "basin") setCutOffset(0);
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
            className={`btn secondary cad-scene3d-tool-btn ${viewPreset === "default" ? "active" : ""}`}
            onClick={() => applyPreset("default")}
          >
            Orbit
          </button>
          <button
            type="button"
            className={`btn secondary cad-scene3d-tool-btn ${viewPreset === "basin" ? "active" : ""}`}
            onClick={() => applyPreset("basin")}
          >
            Into basin
          </button>
          <button
            type="button"
            className={`btn secondary cad-scene3d-tool-btn ${viewPreset === "spa" ? "active" : ""}`}
            onClick={() => applyPreset("spa")}
          >
            Spa
          </button>
          <button
            type="button"
            className={`btn secondary cad-scene3d-tool-btn ${viewPreset === "top" ? "active" : ""}`}
            onClick={() => applyPreset("top")}
          >
            Top
          </button>
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
          >
            Plumbing
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
          <ClipPlanesContext.Provider value={clipPlanes}>
            <ClippingEnable enabled={clipPlanes.length > 0} />
            <ExportBridge apiRef={exportApi} />
            <color attach="background" args={["#b9c9d4"]} />
            <fog attach="fog" args={["#b9c9d4", 65, 160]} />
            <Sky
              sunPosition={[60, 30, 40]}
              turbidity={8}
              rayleigh={0.8}
              mieCoefficient={0.005}
              mieDirectionalG={0.7}
            />
            <ambientLight intensity={0.55} />
            <directionalLight
              position={[40, 50, 20]}
              intensity={1.15}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-camera-far={100}
              shadow-camera-left={-35}
              shadow-camera-right={35}
              shadow-camera-top={35}
              shadow-camera-bottom={-35}
            />
            <directionalLight position={[-25, 18, -30]} intensity={0.3} />
            <hemisphereLight args={["#dceaf2", "#6b7a6e", 0.5]} />

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
            <CameraRig
              projectId={projectId}
              center={model.center}
              groundSize={model.groundSize}
              viewPreset={viewPreset}
              presetToken={presetToken}
              section={section}
            />
          </ClipPlanesContext.Provider>
        </TextureContext.Provider>
      </Canvas>
      <div className="cad-scene3d-hint muted">
        {cutaway
          ? "Basin cutaway — slide Cut position · drag to orbit · PNG / Orbit clip to share"
          : "Click to select · drag to orbit · PNG / Orbit clip to export · edit in 2D"}
      </div>
    </div>
  );
}
