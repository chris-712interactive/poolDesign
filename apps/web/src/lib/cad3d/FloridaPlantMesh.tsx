"use client";

import { useContext, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  getFloridaPlant,
  plantCssColor,
  type FloridaPlant,
  type PlantBloom,
  type PlantForm,
} from "@pool-design/shared";
import { ClipPlanesContext } from "@/lib/cad3d/clipContext";
import {
  getLeafVeinTexture,
  getPlantBarkTexture,
  getSpeciesLeafTexture,
  leafHabitFor,
  plantBarkKind,
  type LeafHabit,
} from "@/lib/cad3d/plantTextures";

type GroupProps = {
  position: [number, number, number];
  rotation: [number, number, number];
} & Record<string, unknown>;

type Props = {
  catalogId: string;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  groupProps: GroupProps;
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function PlantMat({
  color,
  roughness = 0.88,
  metalness = 0,
  selected,
  opacity = 1,
  doubleSide = false,
  map,
  roughnessMap,
  bumpMap,
  bumpScale = 0.05,
}: {
  color: string;
  roughness?: number;
  metalness?: number;
  selected: boolean;
  opacity?: number;
  doubleSide?: boolean;
  map?: THREE.Texture | null;
  roughnessMap?: THREE.Texture | null;
  bumpMap?: THREE.Texture | null;
  bumpScale?: number;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  return (
    <meshStandardMaterial
      color={color}
      map={map ?? null}
      roughnessMap={roughnessMap ?? null}
      bumpMap={bumpMap ?? null}
      bumpScale={bumpMap ? bumpScale : 0}
      roughness={roughness}
      metalness={metalness}
      transparent={opacity < 0.99}
      opacity={opacity}
      side={doubleSide ? THREE.DoubleSide : THREE.FrontSide}
      emissive={selected ? "#1f8a70" : "#000000"}
      emissiveIntensity={selected ? 0.22 : 0}
      clippingPlanes={clippingPlanes}
      clipShadows={clippingPlanes.length > 0}
    />
  );
}

function BarkMat({
  plant,
  selected,
  along = 2,
  fallback,
}: {
  plant: FloridaPlant;
  selected: boolean;
  along?: number;
  fallback: string;
}) {
  const maps = useMemo(() => {
    const tex = getPlantBarkTexture(plantBarkKind(plant));
    if (!tex) return null;
    const color = tex.color.clone();
    const roughness = tex.roughness.clone();
    const bump = tex.bump.clone();
    const v = Math.max(1.4, along);
    for (const t of [color, roughness, bump]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1.15, v);
    }
    return { color, roughness, bump, bumpScale: tex.bumpScale };
  }, [along, plant.form, plant.id]);
  return (
    <PlantMat
      color={maps ? "#ffffff" : fallback}
      map={maps?.color}
      roughnessMap={maps?.roughness}
      bumpMap={maps?.bump}
      bumpScale={maps?.bumpScale}
      roughness={0.9}
      selected={selected}
    />
  );
}

function flowerGeometry(bloom: PlantBloom): THREE.BufferGeometry | null {
  if (bloom === "none") return null;
  if (bloom === "saucer") {
    const g = new THREE.SphereGeometry(0.07, 8, 6);
    g.scale(1.35, 0.28, 1.35);
    return g;
  }
  if (bloom === "cluster") {
    const g = new THREE.SphereGeometry(0.045, 7, 5);
    g.scale(1.15, 0.85, 1.15);
    return g;
  }
  if (bloom === "trumpet") {
    const g = new THREE.ConeGeometry(0.04, 0.1, 6, 1, true);
    g.rotateX(Math.PI);
    return g;
  }
  if (bloom === "spike") {
    const g = new THREE.CylinderGeometry(0.018, 0.028, 0.22, 7);
    return g;
  }
  if (bloom === "bract") {
    const g = new THREE.ConeGeometry(0.055, 0.08, 5, 1, true);
    g.scale(1.4, 0.45, 1);
    return g;
  }
  if (bloom === "star") {
    const g = new THREE.SphereGeometry(0.055, 6, 5);
    g.scale(1.4, 0.22, 1.4);
    return g;
  }
  if (bloom === "bird") {
    const g = new THREE.BoxGeometry(0.16, 0.04, 0.05);
    g.scale(1, 1, 1);
    return g;
  }
  return null;
}

function mergeGeoms(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const g of parts) {
    const p = g.getAttribute("position");
    const u = g.getAttribute("uv");
    const base = pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (u) uv.push(u.getX(i), u.getY(i));
      else uv.push(0.5, 0.5);
    }
    const index = g.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i++) idx.push(index.getX(i) + base);
    } else {
      for (let i = 0; i < p.count; i++) idx.push(base + i);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}

function bendAlongY(geo: THREE.BufferGeometry, bendRad: number): THREE.BufferGeometry {
  if (Math.abs(bendRad) < 1e-4) {
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = y * bendRad;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.setXYZ(i, x, y * c - z * s, y * s + z * c);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** Palmate / costapalmate fan with separate leaflets and a curved midrib. */
function fanLeafletGeometry(len: number, width: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(width * 0.22, len * 0.06);
  shape.lineTo(width, len * 0.88);
  shape.lineTo(width * 0.12, len);
  shape.lineTo(0, len);
  shape.lineTo(-width * 0.12, len);
  shape.lineTo(-width, len * 0.88);
  shape.lineTo(-width * 0.22, len * 0.06);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -0.004);
  return g;
}

function fanFrondGeometry(silver: boolean, bend: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const lobes = silver ? 10 : 13;
  const spread = silver ? 1.05 : 0.98;
  for (let i = 0; i < lobes; i++) {
    const u = i / (lobes - 1) - 0.5;
    const blade = fanLeafletGeometry(silver ? 0.92 : 1, silver ? 0.055 : 0.038);
    blade.rotateZ(u * spread);
    parts.push(blade);
  }
  const rib = new THREE.CylinderGeometry(0.006, 0.015, 0.94, 5);
  rib.translate(0, 0.47, 0);
  return bendAlongY(mergeGeoms([...parts, rib]), bend);
}

function diamondLeafletGeometry(len: number, width: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(width * 0.55, len * 0.12);
  shape.lineTo(width, len * 0.48);
  shape.lineTo(width * 0.18, len * 0.92);
  shape.lineTo(0, len);
  shape.lineTo(-width * 0.18, len * 0.92);
  shape.lineTo(-width, len * 0.48);
  shape.lineTo(-width * 0.55, len * 0.12);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -0.003);
  return g;
}

/**
 * Pinnate (feather) frond: rachis + paired leaflets, then arched.
 * Unit length along +Y from the crown.
 */
function pinnateFrondGeometry(plumose: boolean, bend: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rachis = new THREE.CylinderGeometry(0.004, 0.013, 1, 6);
  rachis.translate(0, 0.5, 0);
  parts.push(rachis);
  const pairs = plumose ? 22 : 18;
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.2) / pairs;
    const y = t * 0.97;
    const span = Math.sin(Math.pow(t, 0.82) * Math.PI) * (plumose ? 0.23 : 0.175);
    const sweep = 0.22 + t * 0.12;
    const rows = plumose ? 2 : 1;
    for (let row = 0; row < rows; row++) {
      const z = plumose ? (row === 0 ? 0.016 : -0.016) : 0;
      for (const side of [-1, 1] as const) {
        const leaf = diamondLeafletGeometry(span, span * 0.11);
        leaf.rotateZ(side * -Math.PI / 2);
        leaf.rotateZ(side * sweep);
        leaf.rotateX((t - 0.35) * 0.35);
        leaf.translate(0, y, z);
        parts.push(leaf);
      }
    }
  }
  return bendAlongY(mergeGeoms(parts), bend);
}

const _palmX = new THREE.Vector3();
const _palmY = new THREE.Vector3();
const _palmZ = new THREE.Vector3();
const _palmMat = new THREE.Matrix4();
const _palmDummy = new THREE.Object3D();

function setPalmFrondQuaternion(
  dummy: THREE.Object3D,
  yaw: number,
  droop: number,
  twist: number,
) {
  _palmY
    .set(
      Math.sin(droop) * Math.sin(yaw),
      Math.cos(droop),
      Math.sin(droop) * Math.cos(yaw),
    )
    .normalize();
  _palmZ
    .set(
      Math.cos(droop) * Math.sin(yaw),
      -Math.sin(droop),
      Math.cos(droop) * Math.cos(yaw),
    )
    .normalize();
  _palmX.crossVectors(_palmY, _palmZ).normalize();
  _palmZ.crossVectors(_palmX, _palmY).normalize();
  _palmMat.makeBasis(_palmX, _palmY, _palmZ);
  dummy.quaternion.setFromRotationMatrix(_palmMat);
  dummy.rotateY(twist);
}

function outlineLeaf(pts: [number, number][]): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i]![0], pts[i]![1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.01,
    bevelEnabled: false,
    steps: 1,
  });
  g.translate(0, 0, -0.005);
  g.computeVertexNormals();
  return g;
}

function ovalOutline(widthFn: (t: number) => number, n = 14): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([widthFn(t), t]);
  }
  for (let i = n - 1; i >= 1; i--) {
    const t = i / n;
    pts.push([-widthFn(t), t]);
  }
  return pts;
}

function leafGeometry(habit: LeafHabit): THREE.BufferGeometry {
  if (habit === "oak") {
    return outlineLeaf(
      ovalOutline((t) => Math.pow(Math.sin(t * Math.PI), 0.72) * (0.16 + t * 0.14) * (1 + Math.sin(t * Math.PI * 7) * 0.04)),
    );
  }
  if (habit === "large_glossy") {
    return outlineLeaf(
      ovalOutline((t) => Math.sin(t * Math.PI) * (0.22 + t * 0.08)),
    );
  }
  if (habit === "round") {
    const pts: [number, number][] = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      pts.push([Math.cos(a) * 0.48, 0.5 + Math.sin(a) * 0.48]);
    }
    return outlineLeaf(pts);
  }
  if (habit === "palmate") {
    return outlineLeaf([
      [0, 0],
      [0.1, 0.16],
      [0.42, 0.38],
      [0.22, 0.46],
      [0.3, 0.84],
      [0.1, 0.72],
      [0, 1],
      [-0.1, 0.72],
      [-0.3, 0.84],
      [-0.22, 0.46],
      [-0.42, 0.38],
      [-0.1, 0.16],
    ]);
  }
  if (habit === "toothed") {
    return outlineLeaf(
      ovalOutline((t) => {
        const base = Math.sin(t * Math.PI) * 0.3;
        return base * (1 + Math.sin(t * Math.PI * 10) * 0.12);
      }),
    );
  }
  if (habit === "linear") {
    return outlineLeaf(ovalOutline((t) => Math.sin(t * Math.PI) * 0.08));
  }
  if (habit === "needle") {
    const parts: THREE.BufferGeometry[] = [];
    for (const a of [-0.12, 0, 0.12]) {
      const n = new THREE.CylinderGeometry(0.012, 0.008, 1, 4);
      n.translate(0, 0.5, 0);
      n.rotateZ(a);
      parts.push(n);
    }
    return mergeGeoms(parts);
  }
  if (habit === "fern") {
    const parts: THREE.BufferGeometry[] = [];
    const rachis = new THREE.CylinderGeometry(0.006, 0.01, 1, 4);
    rachis.translate(0, 0.5, 0);
    parts.push(rachis);
    for (let i = 0; i < 10; i++) {
      const t = 0.12 + (i / 9) * 0.82;
      const w = Math.sin((i / 9) * Math.PI) * 0.28;
      for (const side of [-1, 1] as const) {
        const leaflet = outlineLeaf(ovalOutline((u) => Math.sin(u * Math.PI) * 0.12, 6));
        leaflet.scale(w, 0.14, 1);
        leaflet.rotateZ(side * 0.85);
        leaflet.translate(0, t, 0);
        parts.push(leaflet);
      }
    }
    return mergeGeoms(parts);
  }
  if (habit === "compound") {
    const parts: THREE.BufferGeometry[] = [];
    const rachis = new THREE.CylinderGeometry(0.008, 0.012, 1, 4);
    rachis.translate(0, 0.5, 0);
    parts.push(rachis);
    const stations = [0.18, 0.38, 0.58, 0.78, 0.96];
    for (let i = 0; i < stations.length; i++) {
      const y = stations[i]!;
      const tip = i === stations.length - 1;
      const leaflet = outlineLeaf(ovalOutline((t) => Math.sin(t * Math.PI) * 0.22, 8));
      leaflet.scale(0.55, 0.22, 1);
      if (tip) {
        leaflet.translate(0, y - 0.1, 0);
        parts.push(leaflet);
      } else {
        for (const side of [-1, 1] as const) {
          const g = leaflet.clone();
          g.rotateZ(side * 0.7);
          g.translate(0, y, 0);
          parts.push(g);
        }
        leaflet.dispose();
      }
    }
    return mergeGeoms(parts);
  }
  return outlineLeaf(ovalOutline((t) => Math.sin(t * Math.PI) * 0.28));
}

function paddleGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.22, 12, 10);
  g.scale(0.42, 1.28, 0.035);
  g.translate(0, 0.55, 0);
  return g;
}

function heartLeafGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.22, 12, 10);
  g.scale(1.05, 1.12, 0.04);
  g.translate(0, 0.38, 0);
  return g;
}

function swordGeometry(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(0.06, 1, 5, 1, true);
  g.translate(0, 0.5, 0);
  g.scale(1, 1, 0.18);
  return g;
}

type ScatterSpec = {
  count: number;
  geo: THREE.BufferGeometry;
  color: string;
  roughness?: number;
  doubleSide?: boolean;
  map?: THREE.Texture | null;
  place: (i: number, rng: () => number, dummy: THREE.Object3D) => void;
};

function InstancedParts({
  spec,
  seed,
  selected,
}: {
  spec: ScatterSpec;
  seed: number;
  selected: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || spec.count <= 0) return;
    const dummy = new THREE.Object3D();
    const rng = mulberry32(seed);
    for (let i = 0; i < spec.count; i++) {
      dummy.position.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.quaternion.identity();
      spec.place(i, rng, dummy);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [seed, spec]);
  if (spec.count <= 0) return null;
  return (
    <instancedMesh ref={ref} args={[spec.geo, undefined, spec.count]} castShadow>
      <PlantMat
        color={spec.color}
        map={spec.map}
        roughness={spec.roughness ?? 0.9}
        selected={selected}
        doubleSide={spec.doubleSide}
      />
    </instancedMesh>
  );
}

function Trunk({
  plant,
  y0,
  height,
  rBase,
  rTop,
  selected,
  lean = 0,
  segments = 10,
}: {
  plant: FloridaPlant;
  y0: number;
  height: number;
  rBase: number;
  rTop: number;
  selected: boolean;
  lean?: number;
  segments?: number;
}) {
  return (
    <mesh
      position={[lean * height * 0.35, y0 + height / 2, 0]}
      rotation={[0, 0, lean]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[rTop, rBase, height, segments]} />
      <BarkMat
        plant={plant}
        selected={selected}
        along={Math.max(1.6, height / Math.max(0.04, rBase) * 0.18)}
        fallback={plantCssColor(plant.trunk)}
      />
    </mesh>
  );
}

function leafSizeFor(habit: LeafHabit, sx: number, sz: number): { w: number; l: number } {
  const span = Math.max(sx, sz);
  if (habit === "oak") return { w: span * 0.03, l: span * 0.05 };
  if (habit === "large_glossy") return { w: span * 0.12, l: span * 0.22 };
  if (habit === "round") return { w: span * 0.16, l: span * 0.16 };
  if (habit === "palmate") return { w: span * 0.11, l: span * 0.14 };
  if (habit === "needle") return { w: span * 0.035, l: span * 0.16 };
  if (habit === "linear") return { w: span * 0.04, l: span * 0.14 };
  if (habit === "fern") return { w: span * 0.09, l: span * 0.16 };
  if (habit === "compound") return { w: span * 0.12, l: span * 0.2 };
  if (habit === "toothed") return { w: span * 0.1, l: span * 0.14 };
  return { w: span * 0.08, l: span * 0.13 };
}

function LeafCanopy({
  plant,
  y0,
  sx,
  sy,
  sz,
  selected,
  count,
  spreadY,
  yCenter,
  cone = false,
}: {
  plant: FloridaPlant;
  y0: number;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  count: number;
  spreadY: number;
  yCenter: number;
  cone?: boolean;
}) {
  const habit = leafHabitFor(plant);
  const geo = useMemo(() => leafGeometry(habit), [habit]);
  const map = getSpeciesLeafTexture(plant);
  const size = leafSizeFor(habit, sx, sz);
  const glossy = habit === "large_glossy" || plant.form === "citrus" || plant.id === "gardenia";
  const spec = useMemo((): ScatterSpec => {
    return {
      count,
      geo,
      color: map ? "#ffffff" : plantCssColor(plant.foliage),
      map,
      roughness: glossy ? 0.38 : habit === "needle" ? 0.72 : 0.7,
      doubleSide: true,
      place: (_i, rng, dummy) => {
        const a = rng() * Math.PI * 2;
        if (cone) {
          const t = rng();
          const rad = (1 - t) * 0.48;
          dummy.position.set(
            Math.cos(a) * rad * sx,
            y0 + sy * (0.32 + t * 0.62),
            Math.sin(a) * rad * sz,
          );
        } else {
          const elev = (rng() - 0.18) * Math.PI * 0.85;
          const r = 0.12 + rng() * 0.42;
          dummy.position.set(
            Math.cos(a) * Math.cos(elev) * r * sx,
            y0 + yCenter + Math.sin(elev) * spreadY * 0.55,
            Math.sin(a) * Math.cos(elev) * r * sz,
          );
        }
        dummy.rotation.set(
          0.35 + rng() * 1.05,
          a + (rng() - 0.5) * 0.7,
          (rng() - 0.5) * 0.55,
        );
        const s = 0.75 + rng() * 0.55;
        dummy.scale.set(s * size.w, s * size.l, s);
      },
    };
  }, [cone, count, geo, glossy, habit, map, plant.foliage, size.l, size.w, spreadY, sx, sy, sz, y0, yCenter]);
  const seed = hashStr(plant.id) ^ Math.round(sx * 40);
  const alt = plant.foliageAlt;
  const altSpec = useMemo((): ScatterSpec | null => {
    if (!alt || habit === "needle") return null;
    const altCount = Math.max(4, Math.round(count * 0.22));
    return {
      count: altCount,
      geo,
      color: plantCssColor(alt),
      roughness: glossy ? 0.42 : 0.72,
      doubleSide: true,
      place: spec.place,
    };
  }, [alt, count, geo, glossy, habit, spec.place]);
  return (
    <>
      <InstancedParts spec={spec} seed={seed} selected={selected} />
      {altSpec ? (
        <InstancedParts spec={altSpec} seed={seed + 131} selected={selected} />
      ) : null}
    </>
  );
}

function BloomScatter({
  plant,
  y0,
  sx,
  sy,
  sz,
  selected,
  yCenter,
  spreadY,
  count,
}: {
  plant: FloridaPlant;
  y0: number;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  yCenter: number;
  spreadY: number;
  count: number;
}) {
  const geo = useMemo(() => flowerGeometry(plant.bloom), [plant.bloom]);
  const spec = useMemo((): ScatterSpec | null => {
    if (!geo || !plant.flower || count <= 0) return null;
    const scale = Math.max(0.7, plant.flowerSize);
    return {
      count,
      geo,
      color: plantCssColor(plant.flower),
      roughness: 0.55,
      place: (_i, rng, dummy) => {
        const a = rng() * Math.PI * 2;
        const r = 0.15 + rng() * 0.42;
        dummy.position.set(
          Math.cos(a) * r * sx,
          y0 + yCenter + (rng() - 0.3) * spreadY,
          Math.sin(a) * r * sz,
        );
        dummy.rotation.set(rng() * 0.8, rng() * Math.PI * 2, rng() * 0.6);
        const s = scale * (0.7 + rng() * 0.6) * Math.max(0.35, Math.min(sx, sz) * 0.12);
        dummy.scale.set(s, s, s);
      },
    };
  }, [count, geo, plant.flower, plant.flowerSize, spreadY, sx, sz, y0, yCenter]);
  if (!spec) return null;
  return (
    <InstancedParts
      spec={spec}
      seed={hashStr(`${plant.id}-bloom`) ^ Math.round(sy * 20)}
      selected={selected}
    />
  );
}

function FruitScatter({
  color,
  y0,
  sx,
  sz,
  yCenter,
  count,
  selected,
  seed,
  size = 0.045,
  spreadY = 0.18,
}: {
  color: string;
  y0: number;
  sx: number;
  sz: number;
  yCenter: number;
  count: number;
  selected: boolean;
  seed: number;
  size?: number;
  spreadY?: number;
}) {
  const geo = useMemo(() => new THREE.SphereGeometry(size, 8, 6), [size]);
  const spec = useMemo(
    (): ScatterSpec => ({
      count,
      geo,
      color,
      roughness: 0.45,
      place: (_i, rng, dummy) => {
        const a = rng() * Math.PI * 2;
        dummy.position.set(
          Math.cos(a) * (0.15 + rng() * 0.55) * sx,
          y0 + yCenter + (rng() - 0.5) * spreadY,
          Math.sin(a) * (0.15 + rng() * 0.55) * sz,
        );
        dummy.rotation.set(0, rng() * Math.PI, 0);
        const s = 0.75 + rng() * 0.5;
        dummy.scale.set(s, s * 0.9, s);
      },
    }),
    [count, geo, spreadY, sx, sz, y0, yCenter],
  );
  return <InstancedParts spec={spec} seed={seed} selected={selected} />;
}

function PalmFronds({
  form,
  plant,
  yCrown,
  radius,
  selected,
}: {
  form: PlantForm;
  plant: FloridaPlant;
  yCrown: number;
  radius: number;
  selected: boolean;
}) {
  const silver = plant.id === "bismarck_palm";
  const saw = form === "saw_palmetto";
  const fan = form === "fan_palm" || saw;
  const plumose = form === "foxtail_palm" || plant.id === "queen_palm";
  const coconut = form === "coconut_palm";
  const canary = plant.id === "canary_date";
  const bend = coconut
    ? 0.95
    : saw
      ? 0.78
      : silver
        ? 0.32
        : canary
          ? 0.34
          : fan
            ? 0.52
            : plumose
              ? 0.62
              : 0.55;
  const windAmp = coconut
    ? 0.2
    : saw
      ? 0.16
      : silver || canary
        ? 0.07
        : fan
          ? 0.12
          : 0.14;
  const windHz = coconut || silver ? 0.55 : saw ? 0.95 : 0.72;
  const geo = useMemo(
    () =>
      fan ? fanFrondGeometry(silver, bend) : pinnateFrondGeometry(plumose, bend),
    [bend, fan, plumose, silver],
  );
  const count = saw
    ? 16
    : silver
      ? 18
      : fan
        ? 20
        : form === "foxtail_palm"
          ? 30
          : coconut
            ? 28
            : canary
              ? 36
              : 26;
  const seed = hashStr(plant.id) ^ Math.round(radius * 80);
  const poses = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: count }, (_, i) => {
      const yaw = (i / count) * Math.PI * 2 + rng() * 0.22;
      const droop = fan
        ? silver
          ? 0.68 + rng() * 0.42
          : saw
            ? 1.0 + rng() * 0.5
            : 0.78 + rng() * 0.42
        : coconut
          ? 0.48 + (i / Math.max(1, count - 1)) * 1.15 + rng() * 0.16
          : canary
            ? 0.68 + rng() * 0.42
            : 0.7 + rng() * 0.48;
      const len =
        radius *
        (fan ? (silver ? 1.12 : 1) : coconut ? 1.1 : plumose ? 1.02 : 1) *
        (0.8 + rng() * 0.24);
      return {
        yaw,
        droop,
        twist: (rng() - 0.5) * 0.45,
        len,
        px: Math.sin(yaw) * radius * 0.04,
        py: yCrown,
        pz: Math.cos(yaw) * radius * 0.04,
        phase: rng() * Math.PI * 2,
        amp: windAmp * (0.75 + rng() * 0.5) * (0.7 + 0.45 * Math.min(1, droop / 1.4)),
      };
    });
  }, [canary, coconut, count, fan, plumose, radius, seed, silver, windAmp, yCrown]);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const writePoses = (time: number) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const gust = 0.62 + 0.38 * Math.sin(time * 0.15);
    const dummy = _palmDummy;
    for (let i = 0; i < poses.length; i++) {
      const p = poses[i]!;
      const w =
        (Math.sin(time * windHz + p.phase) * 0.62 +
          Math.sin(time * windHz * 1.7 + p.phase * 1.35) * 0.28 +
          Math.sin(time * windHz * 0.33 + p.phase * 0.5) * 0.22) *
        p.amp *
        gust;
      dummy.position.set(p.px, p.py, p.pz);
      dummy.scale.set(p.len, p.len, p.len);
      setPalmFrondQuaternion(
        dummy,
        p.yaw + w * 0.7,
        p.droop + w,
        p.twist + w * 0.25,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    writePoses(0);
  }, [poses, windHz]);

  useFrame(({ clock }) => {
    writePoses(clock.elapsedTime);
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, undefined, count]}
      castShadow
      frustumCulled={false}
    >
      <PlantMat
        color={plantCssColor(plant.foliage)}
        map={getLeafVeinTexture("palm")}
        roughness={silver ? 0.55 : 0.72}
        selected={selected}
        doubleSide
      />
    </instancedMesh>
  );
}

function PalmPlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const r = Math.min(sx, sz) * 0.5;
  const saw = plant.form === "saw_palmetto";
  const coconut = plant.form === "coconut_palm";
  const royal = plant.form === "royal_palm";
  const clump = plant.form === "clumping_palm";
  const canary = plant.id === "canary_date";
  const lean = coconut ? -0.2 : 0;
  const trunkH = saw
    ? sy * 0.22
    : royal
      ? sy * 0.72
      : coconut
        ? sy * 0.72
        : sy * 0.68;
  const rBase = saw
    ? r * 0.12
    : canary
      ? r * 0.16
      : royal
        ? r * 0.09
        : coconut
          ? r * 0.075
          : r * 0.065;
  const rTop = royal ? rBase * 0.82 : coconut ? rBase * 0.72 : rBase * 0.62;
  const crownRadius = r * (saw ? 0.95 : coconut ? 0.98 : 0.92);

  if (clump) {
    const stems = 7;
    return (
      <group>
        {Array.from({ length: stems }, (_, i) => {
          const a = (i / stems) * Math.PI * 2;
          const rr = r * (0.12 + (i % 3) * 0.07);
          const h = trunkH * (0.55 + (i % 4) * 0.12);
          return (
            <group key={i} position={[Math.cos(a) * rr, 0, Math.sin(a) * rr]}>
              <Trunk
                plant={plant}
                y0={y0}
                height={h}
                rBase={r * 0.028}
                rTop={r * 0.02}
                selected={selected}
                segments={8}
              />
              <PalmFronds
                form="feather_palm"
                plant={plant}
                yCrown={y0 + h}
                radius={r * 0.42}
                selected={selected}
              />
            </group>
          );
        })}
      </group>
    );
  }

  return (
    <group position={[0, y0, 0]}>
      <group rotation={[0, 0, lean]}>
        <mesh position={[0, trunkH / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[rTop, rBase, trunkH, canary ? 12 : 10]} />
          <BarkMat
            plant={plant}
            selected={selected}
            along={Math.max(2.2, trunkH / Math.max(0.04, rBase) * 0.22)}
            fallback={plantCssColor(plant.trunk)}
          />
        </mesh>
        {royal ? (
          <mesh position={[0, trunkH + sy * 0.05, 0]} castShadow>
            <cylinderGeometry args={[r * 0.07, r * 0.085, sy * 0.1, 12]} />
            <PlantMat color="#3d7a48" roughness={0.55} selected={selected} />
          </mesh>
        ) : null}
        {plant.id === "sabal_palmetto" ? (
          <mesh position={[0, trunkH * 0.96, 0]} castShadow>
            <sphereGeometry args={[r * 0.12, 8, 6]} />
            <PlantMat color="#6a5a44" roughness={0.95} selected={selected} />
          </mesh>
        ) : null}
        <PalmFronds
          form={plant.form}
          plant={plant}
          yCrown={trunkH + (royal ? sy * 0.06 : 0)}
          radius={crownRadius}
          selected={selected}
        />
        {coconut ? (
          <FruitScatter
            color="#6a4220"
            y0={0}
            sx={rBase * 3.2}
            sz={rBase * 3.2}
            yCenter={trunkH * 0.97}
            count={6}
            selected={selected}
            seed={hashStr(plant.id)}
            size={0.1}
            spreadY={0.14}
          />
        ) : null}
      </group>
    </group>
  );
}

function TravelersPlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const geo = useMemo(() => paddleGeometry(), []);
  const n = 11;
  const leafMap = getSpeciesLeafTexture(plant);
  const spec = useMemo(
    (): ScatterSpec => ({
      count: n,
      geo,
      color: leafMap ? "#ffffff" : plantCssColor(plant.foliage),
      map: leafMap,
      roughness: 0.48,
      doubleSide: true,
      place: (i, rng, dummy) => {
        const t = i / (n - 1) - 0.5;
        const angle = t * 1.15;
        dummy.position.set(0, y0 + sy * 0.12, 0);
        dummy.rotation.set(0, 0, angle);
        dummy.scale.set(
          sx * (0.35 + rng() * 0.08),
          sy * (0.55 + rng() * 0.12),
          Math.max(0.08, sz * 0.22),
        );
      },
    }),
    [geo, n, leafMap, plant.foliage, sx, sy, sz, y0],
  );
  return (
    <group>
      <mesh position={[0, y0 + sy * 0.12, 0]} castShadow>
        <sphereGeometry args={[Math.min(sx, sz) * 0.12, 10, 8]} />
        <BarkMat
          plant={plant}
          selected={selected}
          along={1.6}
          fallback={plantCssColor(plant.trunk)}
        />
      </mesh>
      <InstancedParts spec={spec} seed={hashStr(plant.id)} selected={selected} />
    </group>
  );
}

function TreePlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const oak = plant.form === "live_oak";
  const gumbo = plant.form === "gumbo_limbo";
  const pine = plant.form === "pine";
  const cypress = plant.form === "cypress";
  const crape = plant.form === "crape_myrtle";
  const frangipani = plant.form === "frangipani";
  const bottle = plant.form === "bottlebrush";
  const magnolia = plant.form === "magnolia";
  const citrus = plant.form === "citrus";
  const sea = plant.form === "sea_grape";
  const jacaranda = plant.form === "jacaranda";
  const r = Math.min(sx, sz) * 0.5;
  const trunkH = pine
    ? sy * 0.62
    : oak
      ? sy * 0.32
      : crape || frangipani
        ? sy * 0.42
        : cypress
          ? sy * 0.55
          : sy * 0.38;
  const rBase = oak || gumbo ? r * 0.09 : pine ? r * 0.045 : cypress ? r * 0.1 : r * 0.055;
  const rTop = pine ? rBase * 0.7 : rBase * 0.62;
  const yCanopy = trunkH * (pine ? 1.15 : oak ? 1.35 : 1.2);
  const leafN = oak
    ? 220
    : jacaranda
      ? 150
      : pine
        ? 110
        : sea
          ? 52
          : magnolia
            ? 72
            : gumbo
              ? 90
              : citrus
                ? 120
                : 110;

  if (frangipani) {
    const arms = 6;
    return (
      <group>
        <Trunk
          plant={plant}
          y0={y0}
          height={trunkH * 0.7}
          rBase={rBase * 1.3}
          rTop={rBase * 1.05}
          selected={selected}
          segments={8}
        />
        {Array.from({ length: arms }, (_, i) => {
          const a = (i / arms) * Math.PI * 2;
          const len = sy * 0.38;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(a) * r * 0.18,
                y0 + trunkH * 0.7 + len * 0.32,
                Math.sin(a) * r * 0.18,
              ]}
              rotation={[0.55, a, 0]}
              castShadow
            >
              <cylinderGeometry args={[r * 0.028, r * 0.045, len, 7]} />
              <BarkMat
                plant={plant}
                selected={selected}
                along={1.8}
                fallback={plantCssColor(plant.trunk)}
              />
            </mesh>
          );
        })}
        <LeafCanopy
          plant={plant}
          y0={y0}
          sx={sx * 0.7}
          sy={sy}
          sz={sz * 0.7}
          selected={selected}
          count={40}
          yCenter={sy * 0.72}
          spreadY={sy * 0.16}
        />
        <BloomScatter
          plant={plant}
          y0={y0}
          sx={sx * 0.75}
          sy={sy}
          sz={sz * 0.75}
          selected={selected}
          yCenter={sy * 0.78}
          spreadY={sy * 0.16}
          count={28}
        />
      </group>
    );
  }

  if (crape) {
    return (
      <group>
        {[-0.12, 0, 0.14].map((t, i) => (
          <Trunk
            key={i}
            plant={plant}
            y0={y0}
            height={trunkH * (0.85 + i * 0.08)}
            rBase={rBase * 0.55}
            rTop={rBase * 0.35}
            selected={selected}
            lean={t * 0.8}
            segments={8}
          />
        ))}
        <LeafCanopy
          plant={plant}
          y0={y0}
          sx={sx}
          sy={sy}
          sz={sz}
          selected={selected}
          count={100}
          yCenter={sy * 0.68}
          spreadY={sy * 0.28}
        />
        <BloomScatter
          plant={plant}
          y0={y0}
          sx={sx}
          sy={sy}
          sz={sz}
          selected={selected}
          yCenter={sy * 0.72}
          spreadY={sy * 0.22}
          count={36}
        />
      </group>
    );
  }

  if (cypress) {
    return (
      <group>
        <mesh position={[0, y0 + sy * 0.08, 0]} castShadow>
          <cylinderGeometry args={[r * 0.16, r * 0.28, sy * 0.16, 8]} />
          <BarkMat
            plant={plant}
            selected={selected}
            along={1.4}
            fallback={plantCssColor(plant.trunk)}
          />
        </mesh>
        <Trunk
          plant={plant}
          y0={y0 + sy * 0.08}
          height={trunkH}
          rBase={rBase}
          rTop={rTop * 0.5}
          selected={selected}
        />
        <LeafCanopy
          plant={plant}
          y0={y0}
          sx={sx}
          sy={sy}
          sz={sz}
          selected={selected}
          count={130}
          yCenter={sy * 0.62}
          spreadY={sy * 0.55}
          cone
        />
      </group>
    );
  }

  return (
    <group>
      <Trunk
        plant={plant}
        y0={y0}
        height={trunkH}
        rBase={rBase}
        rTop={rTop}
        selected={selected}
        lean={gumbo ? 0.08 : 0}
      />
      <LeafCanopy
        plant={plant}
        y0={y0}
        sx={sx * (oak ? 1 : pine ? 0.7 : 0.92)}
        sy={sy}
        sz={sz * (oak ? 1 : pine ? 0.7 : 0.92)}
        selected={selected}
        count={leafN}
        yCenter={yCanopy}
        spreadY={sy * (oak ? 0.38 : pine ? 0.28 : magnolia ? 0.32 : 0.28)}
        cone={pine}
      />
      {citrus ? (
        <FruitScatter
          color="#e07020"
          y0={y0}
          sx={sx * 0.7}
          sz={sz * 0.7}
          yCenter={yCanopy}
          count={16}
          selected={selected}
          seed={hashStr(plant.id)}
        />
      ) : null}
      {bottle ? (
        <BloomScatter
          plant={plant}
          y0={y0}
          sx={sx * 0.7}
          sy={sy}
          sz={sz * 0.7}
          selected={selected}
          yCenter={yCanopy * 0.85}
          spreadY={sy * 0.35}
          count={22}
        />
      ) : (
        <BloomScatter
          plant={plant}
          y0={y0}
          sx={sx}
          sy={sy}
          sz={sz}
          selected={selected}
          yCenter={yCanopy}
          spreadY={sy * 0.22}
          count={plant.bloom === "none" ? 0 : magnolia ? 12 : jacaranda ? 40 : 22}
        />
      )}
    </group>
  );
}

function ShrubPlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const hedge = plant.form === "hedge";
  const variegated = plant.form === "variegated_shrub";
  return (
    <group>
      <mesh position={[0, y0 + sy * 0.08, 0]} castShadow>
        <cylinderGeometry
          args={[Math.min(sx, sz) * 0.06, Math.min(sx, sz) * 0.08, sy * 0.16, 8]}
        />
        <BarkMat
          plant={plant}
          selected={selected}
          along={1.5}
          fallback={plantCssColor(plant.trunk)}
        />
      </mesh>
      <LeafCanopy
        plant={plant}
        y0={y0}
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        count={variegated ? 110 : hedge ? 90 : 100}
        yCenter={sy * (hedge ? 0.52 : 0.48)}
        spreadY={sy * (hedge ? 0.42 : 0.38)}
      />
      <BloomScatter
        plant={plant}
        y0={y0}
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        yCenter={sy * 0.55}
        spreadY={sy * 0.32}
        count={plant.bloom === "none" ? 0 : plant.form === "flowering_shrub" ? 28 : 14}
      />
    </group>
  );
}

function RosettePlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const cycad = plant.form === "cycad";
  const geo = useMemo(
    () => (cycad ? pinnateFrondGeometry(false, 0.45) : swordGeometry()),
    [cycad],
  );
  const n = cycad ? 16 : plant.id === "bromeliad" ? 18 : 20;
  const spec = useMemo(
    (): ScatterSpec => ({
      count: n,
      geo,
      color: cycad || !getSpeciesLeafTexture(plant)
        ? plantCssColor(plant.foliage)
        : "#ffffff",
      map: cycad ? getLeafVeinTexture("palm") : getSpeciesLeafTexture(plant),
      roughness: 0.62,
      doubleSide: true,
      place: (i, rng, dummy) => {
        const yaw = (i / n) * Math.PI * 2;
        dummy.position.set(0, y0 + sy * 0.08, 0);
        dummy.rotation.set(cycad ? 0.85 + rng() * 0.35 : 0.95 + rng() * 0.4, yaw, 0);
        dummy.scale.set(
          Math.min(sx, sz) * (cycad ? 0.28 : 0.45),
          sy * (0.7 + rng() * 0.2),
          Math.min(sx, sz) * (cycad ? 0.22 : 0.18),
        );
      },
    }),
    [cycad, geo, n, plant, sx, sy, sz, y0],
  );
  return (
    <group>
      <mesh position={[0, y0 + sy * 0.06, 0]} castShadow>
        <sphereGeometry args={[Math.min(sx, sz) * 0.1, 8, 6]} />
        <PlantMat
          color={plantCssColor(plant.foliageAlt ?? plant.trunk)}
          roughness={0.85}
          selected={selected}
        />
      </mesh>
      <InstancedParts spec={spec} seed={hashStr(plant.id)} selected={selected} />
      {plant.id === "bromeliad" && plant.flower ? (
        <mesh position={[0, y0 + sy * 0.55, 0]} castShadow>
          <coneGeometry args={[Math.min(sx, sz) * 0.12, sy * 0.45, 6]} />
          <PlantMat color={plantCssColor(plant.flower)} roughness={0.5} selected={selected} />
        </mesh>
      ) : null}
    </group>
  );
}

function PaddleClump({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const banana = plant.form === "banana";
  const ear = plant.form === "elephant_ear";
  const phil = plant.form === "philodendron";
  const geo = useMemo(
    () => (ear ? heartLeafGeometry() : paddleGeometry()),
    [ear],
  );
  const n = banana ? 9 : ear ? 7 : phil ? 10 : 8;
  const leafMap = getSpeciesLeafTexture(plant);
  const spec = useMemo(
    (): ScatterSpec => ({
      count: n,
      geo,
      color: leafMap ? "#ffffff" : plantCssColor(plant.foliage),
      map: leafMap,
      roughness: 0.45,
      doubleSide: true,
      place: (i, rng, dummy) => {
        const a = (i / n) * Math.PI * 2 + rng() * 0.2;
        const spread = banana ? 0.18 : 0.22;
        dummy.position.set(
          Math.cos(a) * sx * spread,
          y0 + sy * (banana ? 0.18 : 0.12),
          Math.sin(a) * sz * spread,
        );
        dummy.rotation.set(
          (rng() - 0.3) * 0.45,
          a + (phil ? 0.4 : 0),
          (rng() - 0.5) * 0.35,
        );
        dummy.scale.set(
          (ear ? sx : sx) * (banana ? 0.55 : 0.42) * (0.85 + rng() * 0.25),
          sy * (banana ? 0.7 : 0.55) * (0.85 + rng() * 0.2),
          Math.max(0.06, sz * 0.12),
        );
      },
    }),
    [banana, ear, geo, leafMap, n, phil, plant.foliage, sx, sy, sz, y0],
  );
  return (
    <group>
      <mesh position={[0, y0 + sy * (banana ? 0.28 : 0.12), 0]} castShadow>
        <cylinderGeometry
          args={[
            Math.min(sx, sz) * (banana ? 0.1 : 0.06),
            Math.min(sx, sz) * (banana ? 0.14 : 0.08),
            sy * (banana ? 0.5 : 0.2),
            8,
          ]}
        />
        <BarkMat
          plant={plant}
          selected={selected}
          along={banana ? 2.4 : 1.6}
          fallback={plantCssColor(plant.trunk)}
        />
      </mesh>
      <InstancedParts spec={spec} seed={hashStr(plant.id)} selected={selected} />
      {(() => {
        const flower = plant.flower;
        if (plant.form !== "bird_of_paradise" || !flower) return null;
        return [0.15, -0.12].map((t, i) => (
            <group
              key={i}
              position={[sx * t, y0 + sy * 0.42, sz * 0.08]}
              rotation={[0.3, i * 0.8, 0.4]}
            >
              <mesh castShadow>
                <boxGeometry args={[sx * 0.22, sy * 0.04, sz * 0.05]} />
                <PlantMat color={plantCssColor(flower)} roughness={0.48} selected={selected} />
              </mesh>
              <mesh position={[sx * 0.08, sy * 0.04, 0]} castShadow>
                <boxGeometry args={[sx * 0.08, sy * 0.09, sz * 0.03]} />
                <PlantMat color="#3a6cb0" roughness={0.5} selected={selected} />
              </mesh>
            </group>
        ));
      })()}
    </group>
  );
}

function CordylinePlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const geo = useMemo(() => swordGeometry(), []);
  const leafMap = getSpeciesLeafTexture(plant);
  const spec = useMemo(
    (): ScatterSpec => ({
      count: 22,
      geo,
      color: leafMap ? "#ffffff" : plantCssColor(plant.foliage),
      map: leafMap,
      roughness: 0.55,
      doubleSide: true,
      place: (i, rng, dummy) => {
        dummy.position.set(0, y0 + sy * 0.42, 0);
        dummy.rotation.set(0.35 + rng() * 0.55, (i / 22) * Math.PI * 2, 0);
        dummy.scale.set(
          Math.min(sx, sz) * 0.55,
          sy * 0.55 * (0.75 + rng() * 0.3),
          Math.min(sx, sz) * 0.18,
        );
      },
    }),
    [geo, leafMap, plant.foliage, sx, sy, sz, y0],
  );
  return (
    <group>
      <Trunk
        plant={plant}
        y0={y0}
        height={sy * 0.45}
        rBase={Math.min(sx, sz) * 0.045}
        rTop={Math.min(sx, sz) * 0.035}
        selected={selected}
        segments={7}
      />
      <InstancedParts spec={spec} seed={hashStr(plant.id)} selected={selected} />
    </group>
  );
}

function FernPlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const geo = useMemo(() => pinnateFrondGeometry(true, 0.7), []);
  const spec = useMemo(
    (): ScatterSpec => ({
      count: 18,
      geo,
      color: plantCssColor(plant.foliage),
      map: getLeafVeinTexture("palm"),
      roughness: 0.68,
      doubleSide: true,
      place: (i, rng, dummy) => {
        const yaw = (i / 18) * Math.PI * 2;
        dummy.position.set(0, y0 + sy * 0.08, 0);
        dummy.rotation.set(1.05 + rng() * 0.35, yaw, (rng() - 0.5) * 0.2);
        dummy.scale.set(
          Math.min(sx, sz) * 0.35,
          Math.max(sx, sz) * 0.55,
          Math.min(sx, sz) * 0.22,
        );
      },
    }),
    [geo, plant.foliage, sx, sy, sz, y0],
  );
  return <InstancedParts spec={spec} seed={hashStr(plant.id)} selected={selected} />;
}

function PlantBody({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const form = plant.form;
  if (
    form === "fan_palm" ||
    form === "feather_palm" ||
    form === "royal_palm" ||
    form === "coconut_palm" ||
    form === "foxtail_palm" ||
    form === "clumping_palm" ||
    form === "saw_palmetto"
  ) {
    return <PalmPlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (form === "travelers") {
    return <TravelersPlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (
    form === "round_shrub" ||
    form === "variegated_shrub" ||
    form === "flowering_shrub" ||
    form === "hedge"
  ) {
    return <ShrubPlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (form === "rosette" || form === "cycad") {
    return <RosettePlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (
    form === "bird_of_paradise" ||
    form === "banana" ||
    form === "elephant_ear" ||
    form === "philodendron"
  ) {
    return <PaddleClump plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (form === "cordyline") {
    return <CordylinePlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (form === "fern") {
    return <FernPlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  return <TreePlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
}

export function FloridaPlantMesh({
  catalogId,
  sx,
  sy,
  sz,
  selected,
  groupProps,
}: Props) {
  const plant = getFloridaPlant(catalogId);
  if (!plant) return null;
  return (
    <group {...groupProps}>
      <PlantBody plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />
    </group>
  );
}
