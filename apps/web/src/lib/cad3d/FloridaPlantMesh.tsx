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
  getSeaGrapeLeafTexture,
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
    const petiole = new THREE.CylinderGeometry(0.012, 0.02, 0.16, 5);
    petiole.translate(0, 0.08, 0);
    const pts: [number, number][] = [];
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      pts.push([Math.cos(a) * 0.5, 0.58 + Math.sin(a) * 0.46]);
    }
    const disc = outlineLeaf(pts);
    const pos = disc.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const d = Math.hypot(x, y - 0.58);
      pos.setZ(i, pos.getZ(i) - d * d * 0.18);
    }
    pos.needsUpdate = true;
    return mergeGeoms([petiole, disc]);
  }
  if (habit === "citrus") {
    const petiole = new THREE.CylinderGeometry(0.01, 0.014, 0.2, 5);
    petiole.translate(0, 0.1, 0);
    const wingL = outlineLeaf(ovalOutline((t) => Math.sin(t * Math.PI) * 0.08, 6));
    wingL.scale(0.9, 0.18, 1);
    wingL.translate(-0.045, 0.08, 0);
    const wingR = outlineLeaf(ovalOutline((t) => Math.sin(t * Math.PI) * 0.08, 6));
    wingR.scale(0.9, 0.18, 1);
    wingR.translate(0.045, 0.08, 0);
    const blade = outlineLeaf(
      ovalOutline((t) => Math.sin(Math.pow(t, 0.85) * Math.PI) * 0.26, 12),
    );
    blade.translate(0, 0.18, 0);
    return mergeGeoms([petiole, wingL, wingR, blade]);
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

function seaGrapeLeafGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const n = 20;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * 0.5;
    const y = Math.max(0.26, 0.6 + Math.sin(a) * 0.46);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const blade = new THREE.ExtrudeGeometry(shape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.016,
    bevelSegments: 1,
    steps: 1,
  });
  blade.translate(0, 0, -0.036);
  const pos = blade.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const d = Math.hypot(x, y - 0.6);
    pos.setZ(i, pos.getZ(i) - d * d * 0.14);
  }
  pos.needsUpdate = true;
  const petiole = new THREE.CylinderGeometry(0.026, 0.038, 0.28, 6);
  petiole.translate(0, 0.14, 0);
  const rib = new THREE.CylinderGeometry(0.01, 0.018, 0.7, 5);
  rib.translate(0, 0.58, 0.038);
  const parts = [petiole, blade, rib];
  for (const ang of [-0.62, -0.32, 0.32, 0.62]) {
    const vein = new THREE.CylinderGeometry(0.005, 0.009, 0.36, 4);
    vein.translate(0, 0.18, 0);
    vein.rotateZ(ang);
    vein.translate(0, 0.4, 0.032);
    parts.push(vein);
  }
  return mergeGeoms(parts);
}

function paddleGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.22, 12, 10);
  g.scale(0.42, 1.28, 0.035);
  g.translate(0, 0.55, 0);
  return g;
}

function bananaHalfBlade(side: 1 | -1, tattered: boolean): THREE.BufferGeometry {
  const pts: [number, number][] = [[0, 0.24]];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = 0.24 + t * 0.74;
    let w = Math.sin(Math.pow(t, 0.72) * Math.PI) * 0.32;
    if (tattered && t > 0.12 && t < 0.92) {
      const tear = Math.sin(t * Math.PI * 10 + (side > 0 ? 0 : 1.1));
      if (tear > 0.42) w *= 0.18 + (1 - tear) * 0.35;
    }
    pts.push([side * Math.max(0.012, w), y]);
  }
  pts.push([0, 0.99]);
  return outlineLeaf(pts);
}

/** Musa leaf: petiole + oblong blade with midrib, optional wind-splits, then arched. */
function bananaLeafGeometry(tattered: boolean, bend: number): THREE.BufferGeometry {
  const petiole = new THREE.CylinderGeometry(0.016, 0.028, 0.26, 8);
  petiole.translate(0, 0.13, 0);
  const left = bananaHalfBlade(-1, tattered);
  const right = bananaHalfBlade(1, tattered);
  const rib = new THREE.CylinderGeometry(0.009, 0.018, 0.78, 6);
  rib.translate(0, 0.6, 0.01);
  const merged = mergeGeoms([petiole, left, right, rib]);
  const pos = merged.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const fold = Math.sin(x * 22) * 0.016 * Math.max(0, Math.sin((y - 0.22) * Math.PI));
    pos.setZ(i, pos.getZ(i) + fold);
  }
  pos.needsUpdate = true;
  return bendAlongY(merged, bend);
}

/** Ravenala: long petiole + oblong blade, mild arch — used in a single-plane fan. */
function travelersLeafGeometry(bend: number): THREE.BufferGeometry {
  const petiole = new THREE.CylinderGeometry(0.012, 0.026, 0.4, 8);
  petiole.translate(0, 0.2, 0);
  const ptsL: [number, number][] = [[0, 0.38]];
  const ptsR: [number, number][] = [[0, 0.38]];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = 0.38 + t * 0.6;
    const w = Math.sin(Math.pow(t, 0.7) * Math.PI) * 0.26;
    ptsL.push([-Math.max(0.01, w), y]);
    ptsR.push([Math.max(0.01, w), y]);
  }
  ptsL.push([0, 0.99]);
  ptsR.push([0, 0.99]);
  const left = outlineLeaf(ptsL);
  const right = outlineLeaf(ptsR);
  const rib = new THREE.CylinderGeometry(0.008, 0.015, 0.62, 6);
  rib.translate(0, 0.68, 0.008);
  const merged = mergeGeoms([petiole, left, right, rib]);
  const pos = merged.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    if (y > 0.38) {
      pos.setZ(i, pos.getZ(i) + Math.sin(x * 18) * 0.01);
    }
  }
  pos.needsUpdate = true;
  return bendAlongY(merged, bend);
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

function fernFrondGeometry(bend: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rachis = new THREE.CylinderGeometry(0.004, 0.012, 1, 5);
  rachis.translate(0, 0.5, 0);
  parts.push(rachis);
  const pairs = 24;
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.12) / pairs;
    const y = t * 0.97;
    const span = Math.sin(Math.pow(t, 0.75) * Math.PI) * 0.155;
    for (const side of [-1, 1] as const) {
      const pinna = outlineLeaf(ovalOutline((u) => Math.sin(u * Math.PI) * 0.14, 6));
      pinna.scale(span, 0.042, 1);
      pinna.rotateZ(side * (1.05 - t * 0.15));
      pinna.translate(0, y, 0);
      parts.push(pinna);
    }
  }
  return bendAlongY(mergeGeoms(parts), bend);
}

function tiLeafGeometry(): THREE.BufferGeometry {
  const petiole = new THREE.CylinderGeometry(0.01, 0.016, 0.14, 5);
  petiole.translate(0, 0.07, 0);
  const blade = outlineLeaf(
    ovalOutline((t) => Math.sin(Math.pow(t, 0.62) * Math.PI) * 0.2, 12),
  );
  blade.translate(0, 0.12, 0);
  const rib = new THREE.CylinderGeometry(0.006, 0.012, 0.82, 5);
  rib.translate(0, 0.52, 0.008);
  return bendAlongY(mergeGeoms([petiole, blade, rib]), 0.42);
}

function strelitziaLeafGeometry(): THREE.BufferGeometry {
  const petiole = new THREE.CylinderGeometry(0.014, 0.022, 0.42, 6);
  petiole.translate(0, 0.21, 0);
  const blade = outlineLeaf(
    ovalOutline((t) => Math.sin(Math.pow(t, 0.78) * Math.PI) * 0.24, 12),
  );
  blade.translate(0, 0.4, 0);
  const rib = new THREE.CylinderGeometry(0.008, 0.014, 0.52, 5);
  rib.translate(0, 0.66, 0.01);
  return bendAlongY(mergeGeoms([petiole, blade, rib]), 0.28);
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
  if (habit === "citrus") return { w: span * 0.038, l: span * 0.065 };
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
  bush = false,
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
  bush?: boolean;
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
        let droop: number;
        if (bush) {
          const t = 0.12 + rng() * 0.84;
          const flare = 0.2 + Math.pow(t, 0.65) * 0.58;
          const u = rng();
          const r = (0.04 + u * 0.4) * flare;
          dummy.position.set(
            Math.cos(a) * r * sx,
            y0 + t * sy,
            Math.sin(a) * r * sz,
          );
          droop = 0.42 + rng() * 0.9 + u * 0.12;
        } else if (cone) {
          const t = rng();
          const rad = (1 - t) * 0.48;
          dummy.position.set(
            Math.cos(a) * rad * sx,
            y0 + sy * (0.32 + t * 0.62),
            Math.sin(a) * rad * sz,
          );
          droop = 0.95 + t * 0.45;
        } else {
          const elev = (rng() - 0.18) * Math.PI * 0.85;
          const r = 0.12 + rng() * 0.42;
          dummy.position.set(
            Math.cos(a) * Math.cos(elev) * r * sx,
            y0 + yCenter + Math.sin(elev) * spreadY * 0.55,
            Math.sin(a) * Math.cos(elev) * r * sz,
          );
          droop = 0.65 + rng() * 0.75;
        }
        setPalmFrondQuaternion(dummy, a + (rng() - 0.5) * 0.35, droop, (rng() - 0.5) * 0.45);
        const s = 0.75 + rng() * 0.55;
        dummy.scale.set(s * size.w, s * size.l, s);
      },
    };
  }, [bush, cone, count, geo, glossy, habit, map, plant.foliage, size.l, size.w, spreadY, sx, sy, sz, y0, yCenter]);
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
  bush = false,
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
  bush?: boolean;
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
        if (bush) {
          const t = 0.34 + rng() * 0.58;
          const flare = 0.32 + t * 0.5;
          const r = (0.18 + rng() * 0.34) * flare;
          dummy.position.set(
            Math.cos(a) * r * sx,
            y0 + t * sy,
            Math.sin(a) * r * sz,
          );
        } else {
          const r = 0.15 + rng() * 0.42;
          dummy.position.set(
            Math.cos(a) * r * sx,
            y0 + yCenter + (rng() - 0.3) * spreadY,
            Math.sin(a) * r * sz,
          );
        }
        dummy.rotation.set(rng() * 0.8, rng() * Math.PI * 2, rng() * 0.6);
        const s = scale * (0.7 + rng() * 0.6) * Math.max(0.35, Math.min(sx, sz) * 0.12);
        dummy.scale.set(s, s, s);
      },
    };
  }, [bush, count, geo, plant.flower, plant.flowerSize, spreadY, sx, sy, sz, y0, yCenter]);
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
  const trunkH = sy * 0.36;
  const rBase = sx * 0.048;
  const rTop = sx * 0.034;
  const yCrown = y0 + trunkH;
  const n = 12;
  const leafLen = Math.min(sy * 0.58, sx * 0.52);
  const leafWide = sx * 0.13;
  const geo = useMemo(() => travelersLeafGeometry(0.48), []);
  const sheathGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(0.2, 0.42, 0.065);
    g.translate(0, 0.18, 0);
    return g;
  }, []);
  const leafMap = getSpeciesLeafTexture(plant);
  const leafColor = leafMap ? "#ffffff" : plantCssColor(plant.foliage);
  const seed = hashStr(plant.id) ^ Math.round(sx * 20);
  const poses = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: n }, (_, i) => {
      const t = n <= 1 ? 0 : i / (n - 1);
      const angle = (t - 0.5) * 2.7;
      return {
        angle,
        twist: (rng() - 0.5) * 0.06,
        len: leafLen * (0.9 + rng() * 0.14),
        wide: leafWide * (0.88 + rng() * 0.2),
        z: (t - 0.5) * sz * 0.22,
        phase: rng() * Math.PI * 2,
      };
    });
  }, [leafLen, leafWide, n, seed, sz]);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const writeLeaves = (time: number) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = _palmDummy;
    const gust = 0.7 + 0.3 * Math.sin(time * 0.16);
    for (let i = 0; i < poses.length; i++) {
      const p = poses[i]!;
      const w = Math.sin(time * 0.55 + p.phase) * 0.045 * gust;
      dummy.position.set(0, yCrown, p.z);
      dummy.scale.set(p.wide, p.len, 1);
      dummy.quaternion.identity();
      dummy.rotation.set(p.twist, 0, p.angle + w);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    writeLeaves(0);
  }, [poses, yCrown]);

  useFrame(({ clock }) => {
    writeLeaves(clock.elapsedTime);
  });

  return (
    <group>
      <mesh position={[0, y0 + trunkH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[rTop, rBase, trunkH, 12]} />
        <BarkMat
          plant={plant}
          selected={selected}
          along={Math.max(2, trunkH / Math.max(0.05, rBase) * 0.2)}
          fallback={plantCssColor(plant.trunk)}
        />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const t = i / 6 - 0.5;
        const angle = t * 1.15;
        return (
          <mesh
            key={`sheath-${i}`}
            geometry={sheathGeo}
            position={[0, yCrown - sy * 0.02, (t) * sz * 0.12]}
            rotation={[0.05, 0, angle]}
            scale={[sx * 0.14, sy * 0.1, 1]}
            castShadow
          >
            <PlantMat
              color={plantCssColor(plant.foliage)}
              roughness={0.55}
              selected={selected}
            />
          </mesh>
        );
      })}
      <instancedMesh
        ref={meshRef}
        args={[geo, undefined, n]}
        castShadow
        frustumCulled={false}
      >
        <PlantMat
          color={leafColor}
          map={leafMap}
          roughness={0.4}
          selected={selected}
          doubleSide
        />
      </instancedMesh>
    </group>
  );
}

function limbPoint(
  b: { ox: number; oy: number; oz: number; yaw: number; droop: number; len: number },
  t: number,
) {
  return {
    x: b.ox + Math.sin(b.droop) * Math.sin(b.yaw) * b.len * t,
    y: b.oy + Math.cos(b.droop) * b.len * t,
    z: b.oz + Math.sin(b.droop) * Math.cos(b.yaw) * b.len * t,
  };
}

function BranchedLeafTree({
  plant,
  sx,
  sy,
  sz,
  selected,
  kind,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  kind: "citrus";
}) {
  const y0 = -sy / 2;
  const r = Math.min(sx, sz) * 0.5;
  const citrus = kind === "citrus";
  const trunkH = citrus ? sy * 0.34 : sy * 0.4;
  const rBase = citrus ? r * 0.07 : r * 0.08;
  const rTop = rBase * 0.62;
  const habit = leafHabitFor(plant);
  const geo = useMemo(() => leafGeometry(habit), [habit]);
  const fruitGeo = useMemo(
    () => (citrus ? new THREE.SphereGeometry(0.055, 8, 6) : null),
    [citrus],
  );
  const leafMap = getSpeciesLeafTexture(plant);
  const seed = hashStr(plant.id) ^ Math.round(sx * 31);
  const limbs = useMemo(() => {
    const rng = mulberry32(seed);
    const primaries = citrus ? 8 : 7;
    const out: {
      ox: number;
      oy: number;
      oz: number;
      yaw: number;
      droop: number;
      len: number;
      r0: number;
      r1: number;
    }[] = [];
    for (let i = 0; i < primaries; i++) {
      const yaw = (i / primaries) * Math.PI * 2 + rng() * 0.28;
      const droop = citrus ? 0.72 + rng() * 0.42 : 0.62 + rng() * 0.5;
      const len = r * (citrus ? 0.72 + rng() * 0.22 : 0.68 + rng() * 0.28);
      const attach = y0 + trunkH * (citrus ? 0.48 + rng() * 0.4 : 0.42 + rng() * 0.45);
      const b = {
        ox: Math.sin(yaw) * rTop * 0.35,
        oy: attach,
        oz: Math.cos(yaw) * rTop * 0.35,
        yaw,
        droop,
        len,
        r0: rBase * (citrus ? 0.38 : 0.42),
        r1: rBase * 0.16,
      };
      out.push(b);
      const twigs = citrus ? 2 : 1;
      for (let s = 0; s < twigs; s++) {
        const t = 0.42 + s * 0.28 + rng() * 0.08;
        const p = limbPoint(b, t);
        const side = s % 2 === 0 ? 0.85 : -0.85;
        out.push({
          ox: p.x,
          oy: p.y,
          oz: p.z,
          yaw: yaw + side + (rng() - 0.5) * 0.25,
          droop: droop + 0.12 + rng() * 0.2,
          len: len * (0.38 + rng() * 0.14),
          r0: rBase * 0.16,
          r1: rBase * 0.07,
        });
      }
    }
    return out;
  }, [citrus, r, rBase, rTop, seed, trunkH, y0]);

  const leafCount = citrus ? 220 : 70;
  const leafW = citrus ? r * 0.09 : r * 0.2;
  const leafL = citrus ? r * 0.15 : r * 0.2;
  const leafSpec = useMemo((): ScatterSpec => {
    return {
      count: leafCount,
      geo,
      color: leafMap ? "#ffffff" : plantCssColor(plant.foliage),
      map: leafMap,
      roughness: citrus ? 0.32 : 0.48,
      doubleSide: true,
      place: (i, rng, dummy) => {
        const b = limbs[i % limbs.length]!;
        const t = citrus ? 0.38 + rng() ** 0.65 * 0.6 : 0.28 + rng() * 0.68;
        const p = limbPoint(b, t);
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(
          0.25 + rng() * 0.9,
          b.yaw + (rng() - 0.5) * 0.9,
          (rng() - 0.5) * 0.55,
        );
        const s = 0.8 + rng() * 0.45;
        dummy.scale.set(s * leafW, s * leafL, s);
      },
    };
  }, [citrus, geo, leafCount, leafL, leafMap, leafW, limbs, plant.foliage]);

  const alt = plant.foliageAlt;
  const altSpec = useMemo((): ScatterSpec | null => {
    if (!alt || citrus) return null;
    return {
      count: Math.max(8, Math.round(leafCount * 0.18)),
      geo,
      color: plantCssColor(alt),
      roughness: 0.5,
      doubleSide: true,
      place: leafSpec.place,
    };
  }, [alt, citrus, geo, leafCount, leafSpec.place]);

  const fruitSpec = useMemo((): ScatterSpec | null => {
    if (!fruitGeo) return null;
    return {
      count: 22,
      geo: fruitGeo,
      color: "#e07020",
      roughness: 0.38,
      place: (i, rng, dummy) => {
        const b = limbs[i % limbs.length]!;
        const t = 0.58 + rng() * 0.38;
        const p = limbPoint(b, t);
        dummy.position.set(p.x, p.y - r * 0.04, p.z);
        dummy.rotation.set(rng() * 0.4, rng() * Math.PI, 0);
        const s = 0.85 + rng() * 0.4;
        dummy.scale.set(s, s * 0.92, s);
      },
    };
  }, [fruitGeo, limbs, r]);

  return (
    <group>
      <Trunk
        plant={plant}
        y0={y0}
        height={trunkH}
        rBase={rBase}
        rTop={rTop}
        selected={selected}
      />
      {limbs.map((b, i) => {
        const mid = limbPoint(b, 0.5);
        setPalmFrondQuaternion(_palmDummy, b.yaw, b.droop, 0);
        const q = _palmDummy.quaternion;
        return (
          <mesh
            key={i}
            position={[mid.x, mid.y, mid.z]}
            quaternion={[q.x, q.y, q.z, q.w]}
            castShadow
          >
            <cylinderGeometry args={[b.r1, b.r0, b.len, 6]} />
            <BarkMat
              plant={plant}
              selected={selected}
              along={1.5}
              fallback={plantCssColor(plant.trunk)}
            />
          </mesh>
        );
      })}
      <InstancedParts spec={leafSpec} seed={seed + 3} selected={selected} />
      {altSpec ? (
        <InstancedParts spec={altSpec} seed={seed + 19} selected={selected} />
      ) : null}
      {fruitSpec ? (
        <InstancedParts spec={fruitSpec} seed={seed + 41} selected={selected} />
      ) : null}
      {citrus ? (
        <BloomScatter
          plant={plant}
          y0={y0}
          sx={sx * 0.55}
          sy={sy}
          sz={sz * 0.55}
          selected={selected}
          yCenter={sy * 0.62}
          spreadY={sy * 0.22}
          count={10}
        />
      ) : null}
    </group>
  );
}

function SeaGrapePlant({
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
  const trunkH = sy * 0.4;
  const rBase = r * 0.1;
  const rTop = rBase * 0.68;
  const lean = 0.12;
  const geo = useMemo(() => seaGrapeLeafGeometry(), []);
  const grapeGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.SphereGeometry(0.028, 6, 5);
      const a = (i / 8) * Math.PI * 2;
      const row = i < 3 ? 0 : i < 6 ? 1 : 2;
      g.translate(Math.cos(a) * (0.04 + row * 0.01), -row * 0.055, Math.sin(a) * 0.04);
      parts.push(g);
    }
    return mergeGeoms(parts);
  }, []);
  const greenMap = getSeaGrapeLeafTexture(false);
  const bronzeMap = getSeaGrapeLeafTexture(true);
  const seed = hashStr(plant.id) ^ Math.round(sx * 17);
  const limbs = useMemo(() => {
    const rng = mulberry32(seed);
    const out: {
      ox: number;
      oy: number;
      oz: number;
      yaw: number;
      droop: number;
      len: number;
      r0: number;
      r1: number;
    }[] = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + rng() * 0.35;
      const droop = 0.55 + rng() * 0.4;
      const len = r * (0.42 + rng() * 0.16);
      const attach = y0 + trunkH * (0.38 + rng() * 0.5);
      const b = {
        ox: Math.sin(yaw) * rTop * 0.4,
        oy: attach,
        oz: Math.cos(yaw) * rTop * 0.4,
        yaw,
        droop,
        len,
        r0: rBase * 0.48,
        r1: rBase * 0.22,
      };
      out.push(b);
      const tip = limbPoint(b, 1);
      const yaw2 = yaw + (rng() - 0.5) * 0.7;
      out.push({
        ox: tip.x,
        oy: tip.y,
        oz: tip.z,
        yaw: yaw2,
        droop: droop + 0.28 + rng() * 0.22,
        len: len * (0.7 + rng() * 0.2),
        r0: rBase * 0.22,
        r1: rBase * 0.06,
      });
    }
    return out;
  }, [r, rBase, rTop, seed, trunkH, y0]);

  const greenPoses = useMemo(() => {
    const rng = mulberry32(seed + 5);
    const poses: {
      x: number;
      y: number;
      z: number;
      yaw: number;
      droop: number;
      twist: number;
      s: number;
    }[] = [];
    for (let i = 0; i < limbs.length; i++) {
      const b = limbs[i]!;
      const nLeaf = 5;
      for (let k = 0; k < nLeaf; k++) {
        const t = 0.22 + (k / (nLeaf - 1)) * 0.72;
        const p = limbPoint(b, t);
        const side = k % 2 === 0 ? 1 : -1;
        poses.push({
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: b.yaw + side * (0.45 + rng() * 0.2),
          droop: 0.72 + rng() * 0.38,
          twist: (rng() - 0.5) * 0.25,
          s: (0.88 + rng() * 0.22) * r * 0.2,
        });
      }
    }
    return poses;
  }, [limbs, r, seed]);

  const bronzePoses = useMemo(() => {
    const rng = mulberry32(seed + 9);
    return limbs
      .filter((_, i) => i % 2 === 1)
      .map((b) => {
        const p = limbPoint(b, 0.92 + rng() * 0.06);
        return {
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: b.yaw + (rng() - 0.5) * 0.4,
          droop: 0.55 + rng() * 0.25,
          twist: 0,
          s: r * 0.14 * (0.85 + rng() * 0.2),
        };
      });
  }, [limbs, r, seed]);

  const grapePoses = useMemo(() => {
    const rng = mulberry32(seed + 11);
    return limbs.filter((_, i) => i % 3 === 0).map((b) => {
      const p = limbPoint(b, 0.82);
      return { ...p, s: 0.9 + rng() * 0.25 };
    });
  }, [limbs, seed]);

  const greenRef = useRef<THREE.InstancedMesh>(null);
  const bronzeRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = _palmDummy;
    const write = (
      mesh: THREE.InstancedMesh | null,
      poses: typeof greenPoses,
    ) => {
      if (!mesh) return;
      for (let i = 0; i < poses.length; i++) {
        const p = poses[i]!;
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.set(p.s, p.s, p.s);
        setPalmFrondQuaternion(dummy, p.yaw, p.droop, p.twist);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    write(greenRef.current, greenPoses);
    write(bronzeRef.current, bronzePoses);
  }, [bronzePoses, greenPoses]);

  const grapeSpec = useMemo((): ScatterSpec => {
    return {
      count: grapePoses.length,
      geo: grapeGeo,
      color: "#6a4a78",
      roughness: 0.4,
      place: (i, rng, dummy) => {
        const p = grapePoses[i]!;
        dummy.position.set(p.x, p.y - r * 0.06, p.z);
        dummy.rotation.set(0.2, rng() * Math.PI, 0);
        dummy.scale.setScalar(p.s);
      },
    };
  }, [grapeGeo, grapePoses, r]);

  return (
    <group>
      <mesh position={[0, y0 + rBase * 0.45, 0]} castShadow>
        <sphereGeometry args={[rBase * 1.15, 10, 8]} />
        <BarkMat
          plant={plant}
          selected={selected}
          along={1.2}
          fallback={plantCssColor(plant.trunk)}
        />
      </mesh>
      <Trunk
        plant={plant}
        y0={y0}
        height={trunkH}
        rBase={rBase}
        rTop={rTop}
        selected={selected}
        lean={lean}
      />
      {limbs.map((b, i) => {
        const mid = limbPoint(b, 0.5);
        const tip = limbPoint(b, 1);
        setPalmFrondQuaternion(_palmDummy, b.yaw, b.droop, 0);
        const q = _palmDummy.quaternion;
        return (
          <group key={i}>
            <mesh
              position={[mid.x, mid.y, mid.z]}
              quaternion={[q.x, q.y, q.z, q.w]}
              castShadow
            >
              <cylinderGeometry args={[b.r1, b.r0, b.len, 7]} />
              <BarkMat
                plant={plant}
                selected={selected}
                along={1.4}
                fallback={plantCssColor(plant.trunk)}
              />
            </mesh>
            <mesh position={[tip.x, tip.y, tip.z]} castShadow>
              <sphereGeometry args={[b.r1 * 1.05, 6, 5]} />
              <BarkMat
                plant={plant}
                selected={selected}
                along={1}
                fallback={plantCssColor(plant.trunk)}
              />
            </mesh>
          </group>
        );
      })}
      <instancedMesh
        ref={greenRef}
        args={[geo, undefined, greenPoses.length]}
        castShadow
        frustumCulled={false}
      >
        <PlantMat
          color={greenMap ? "#ffffff" : plantCssColor(plant.foliage)}
          map={greenMap}
          roughness={0.46}
          selected={selected}
          doubleSide
        />
      </instancedMesh>
      <instancedMesh
        ref={bronzeRef}
        args={[geo, undefined, bronzePoses.length]}
        castShadow
        frustumCulled={false}
      >
        <PlantMat
          color={bronzeMap ? "#ffffff" : "#b05a32"}
          map={bronzeMap}
          roughness={0.5}
          selected={selected}
          doubleSide
        />
      </instancedMesh>
      <InstancedParts spec={grapeSpec} seed={seed + 21} selected={selected} />
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
  if (citrus) {
    return (
      <BranchedLeafTree
        plant={plant}
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        kind="citrus"
      />
    );
  }
  if (sea) {
    return (
      <SeaGrapePlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />
    );
  }
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

function ShrubStems({
  plant,
  y0,
  sx,
  sy,
  sz,
  selected,
  hedge,
}: {
  plant: FloridaPlant;
  y0: number;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  hedge: boolean;
}) {
  const n = hedge ? 8 : 6;
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.55, 1, 1, 6);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const rng = mulberry32(hashStr(plant.id) ^ 91);
    const span = Math.min(sx, sz);
    for (let i = 0; i < n; i++) {
      dummy.quaternion.identity();
      const yaw = hedge
        ? (rng() - 0.5) * 0.55
        : (i / n) * Math.PI * 2 + rng() * 0.45;
      const h = sy * (hedge ? 0.5 : 0.46) * (0.78 + rng() * 0.32);
      const r = span * (hedge ? 0.014 : 0.02) * (0.85 + rng() * 0.3);
      if (hedge) {
        dummy.position.set(
          ((i + 0.5) / n - 0.5) * sx * 0.82,
          y0,
          (rng() - 0.5) * sz * 0.2,
        );
      } else {
        const rad = span * (0.02 + rng() * 0.11);
        dummy.position.set(Math.cos(yaw) * rad, y0, Math.sin(yaw) * rad);
      }
      dummy.scale.set(r, h, r);
      setPalmFrondQuaternion(
        dummy,
        yaw,
        hedge ? 0.05 + rng() * 0.12 : 0.14 + rng() * 0.22,
        0,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [geo, hedge, n, plant.id, sx, sy, sz, y0]);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, n]} castShadow>
      <BarkMat
        plant={plant}
        selected={selected}
        along={2.1}
        fallback={plantCssColor(plant.trunk)}
      />
    </instancedMesh>
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
      <ShrubStems
        plant={plant}
        y0={y0}
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        hedge={hedge}
      />
      <LeafCanopy
        plant={plant}
        y0={y0}
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        count={variegated ? 110 : hedge ? 90 : 100}
        yCenter={sy * 0.5}
        spreadY={sy * 0.4}
        bush
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
        bush
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

function BananaPlant({
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
  const stemH = sy * 0.38;
  const rBase = r * 0.15;
  const rTop = r * 0.1;
  const matureGeo = useMemo(() => bananaLeafGeometry(true, 1.12), []);
  const freshGeo = useMemo(() => bananaLeafGeometry(false, 0.58), []);
  const pupGeo = useMemo(() => bananaLeafGeometry(false, 0.7), []);
  const leafMap = getSpeciesLeafTexture(plant);
  const leafColor = leafMap ? "#ffffff" : plantCssColor(plant.foliage);
  const matureN = 7;
  const freshN = 2;
  const seed = hashStr(plant.id) ^ Math.round(sx * 40);
  const maturePoses = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: matureN }, (_, i) => {
      const age = (i + 0.35) / (matureN + freshN);
      const yaw = i * 2.399 + rng() * 0.12;
      return {
        yaw,
        droop: 0.72 + age * 0.7 + rng() * 0.08,
        twist: (rng() - 0.5) * 0.18,
        len: r * (1.55 + rng() * 0.22),
        wide: r * (0.72 + rng() * 0.12),
        px: Math.sin(yaw) * rTop * 0.45,
        py: y0 + stemH * (0.78 + age * 0.12),
        pz: Math.cos(yaw) * rTop * 0.45,
        phase: rng() * Math.PI * 2,
      };
    });
  }, [matureN, r, rTop, seed, stemH, y0]);
  const freshPoses = useMemo(() => {
    const rng = mulberry32(seed + 17);
    return Array.from({ length: freshN }, (_, i) => {
      const yaw = (i + 0.5) * 2.399 + 0.4;
      return {
        yaw,
        droop: 0.28 + i * 0.16,
        twist: (rng() - 0.5) * 0.1,
        len: r * (1.15 + i * 0.12),
        wide: r * 0.55,
        px: Math.sin(yaw) * rTop * 0.2,
        py: y0 + stemH * 0.92,
        pz: Math.cos(yaw) * rTop * 0.2,
        phase: rng() * Math.PI * 2,
      };
    });
  }, [freshN, r, rTop, seed, stemH, y0]);
  const matureRef = useRef<THREE.InstancedMesh>(null);
  const freshRef = useRef<THREE.InstancedMesh>(null);

  const writeLeaves = (time: number) => {
    const dummy = _palmDummy;
    const gust = 0.7 + 0.3 * Math.sin(time * 0.18);
    const write = (
      mesh: THREE.InstancedMesh | null,
      poses: typeof maturePoses,
    ) => {
      if (!mesh) return;
      for (let i = 0; i < poses.length; i++) {
        const p = poses[i]!;
        const w =
          Math.sin(time * 0.65 + p.phase) * 0.07 * gust * (0.6 + p.droop * 0.4);
        dummy.position.set(p.px, p.py, p.pz);
        dummy.scale.set(p.wide, p.len, 1);
        setPalmFrondQuaternion(dummy, p.yaw + w * 0.5, p.droop + w, p.twist);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    write(matureRef.current, maturePoses);
    write(freshRef.current, freshPoses);
  };

  useLayoutEffect(() => {
    writeLeaves(0);
  }, [freshPoses, maturePoses]);

  useFrame(({ clock }) => {
    writeLeaves(clock.elapsedTime);
  });

  return (
    <group>
      <mesh position={[0, y0 + stemH * 0.08, 0]} castShadow>
        <sphereGeometry args={[rBase * 1.15, 10, 8]} />
        <PlantMat color="#6a5a32" roughness={0.9} selected={selected} />
      </mesh>
      <mesh position={[0, y0 + stemH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[rTop, rBase, stemH, 12, 1, true]} />
        <BarkMat
          plant={plant}
          selected={selected}
          along={2.1}
          fallback={plantCssColor(plant.trunk)}
        />
      </mesh>
      <mesh position={[0, y0 + stemH - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[rTop * 0.98, 12]} />
        <PlantMat color={plantCssColor(plant.trunk)} roughness={0.7} selected={selected} />
      </mesh>
      {Array.from({ length: 3 }, (_, i) => {
        const h = stemH * (0.22 + i * 0.08);
        const rr = rBase * (1.08 - i * 0.08);
        return (
          <mesh
            key={`sheath-${i}`}
            position={[0, y0 + h * 0.45 + i * stemH * 0.04, 0]}
            rotation={[0, i * 0.85, 0.04]}
            castShadow
          >
            <cylinderGeometry args={[rr * 0.82, rr, h, 10, 1, true]} />
            <BarkMat
              plant={plant}
              selected={selected}
              along={1.3}
              fallback={plantCssColor(plant.trunk)}
            />
          </mesh>
        );
      })}
      <instancedMesh
        ref={matureRef}
        args={[matureGeo, undefined, matureN]}
        castShadow
        frustumCulled={false}
      >
        <PlantMat
          color={leafColor}
          map={leafMap}
          roughness={0.42}
          selected={selected}
          doubleSide
        />
      </instancedMesh>
      <instancedMesh
        ref={freshRef}
        args={[freshGeo, undefined, freshN]}
        castShadow
        frustumCulled={false}
      >
        <PlantMat
          color={leafColor}
          map={leafMap}
          roughness={0.38}
          selected={selected}
          doubleSide
        />
      </instancedMesh>
      <mesh
        position={[0, y0 + stemH + sy * 0.08, 0]}
        rotation={[0.12, 0.4, 0]}
        castShadow
      >
        <coneGeometry args={[r * 0.045, sy * 0.22, 8]} />
        <PlantMat
          color={plantCssColor(plant.foliage)}
          roughness={0.45}
          selected={selected}
        />
      </mesh>
      <group position={[r * 0.55, y0 * 0.62, -r * 0.32]} scale={0.38}>
        <mesh position={[0, y0 + stemH * 0.45, 0]} castShadow>
          <cylinderGeometry args={[rTop * 0.9, rBase, stemH * 0.85, 8, 1, true]} />
          <BarkMat
            plant={plant}
            selected={selected}
            along={1.6}
            fallback={plantCssColor(plant.trunk)}
          />
        </mesh>
        {[0.2, 2.3, 4.4].map((yaw, i) => {
          setPalmFrondQuaternion(_palmDummy, yaw, 0.7 + i * 0.1, 0);
          const q = _palmDummy.quaternion;
          return (
            <mesh
              key={`pup-${i}`}
              geometry={pupGeo}
              position={[
                Math.sin(yaw) * rTop * 0.3,
                y0 + stemH * 0.72,
                Math.cos(yaw) * rTop * 0.3,
              ]}
              quaternion={[q.x, q.y, q.z, q.w]}
              scale={[r * 0.55, r * 1.1, 1]}
              castShadow
            >
              <PlantMat
                color={leafColor}
                map={leafMap}
                roughness={0.42}
                selected={selected}
                doubleSide
              />
            </mesh>
          );
        })}
      </group>
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
  const ear = plant.form === "elephant_ear";
  const phil = plant.form === "philodendron";
  const geo = useMemo(
    () => (ear ? heartLeafGeometry() : paddleGeometry()),
    [ear],
  );
  const n = ear ? 7 : phil ? 10 : 8;
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
        const spread = 0.22;
        dummy.position.set(
          Math.cos(a) * sx * spread,
          y0 + sy * 0.12,
          Math.sin(a) * sz * spread,
        );
        dummy.rotation.set(
          (rng() - 0.3) * 0.45,
          a + (phil ? 0.4 : 0),
          (rng() - 0.5) * 0.35,
        );
        dummy.scale.set(
          sx * 0.42 * (0.85 + rng() * 0.25),
          sy * 0.55 * (0.85 + rng() * 0.2),
          Math.max(0.06, sz * 0.12),
        );
      },
    }),
    [ear, geo, leafMap, n, phil, plant.foliage, sx, sy, sz, y0],
  );
  return (
    <group>
      <mesh position={[0, y0 + sy * 0.12, 0]} castShadow>
        <cylinderGeometry
          args={[
            Math.min(sx, sz) * 0.06,
            Math.min(sx, sz) * 0.08,
            sy * 0.2,
            8,
          ]}
        />
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

function BirdOfParadisePlant({
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
  const geo = useMemo(() => strelitziaLeafGeometry(), []);
  const leafMap = getSpeciesLeafTexture(plant);
  const n = 8;
  const seed = hashStr(plant.id);
  const poses = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: n }, (_, i) => {
      const yaw = (i / n) * Math.PI * 2 + rng() * 0.2;
      const droop = 0.28 + rng() * 0.35;
      return {
        yaw,
        droop,
        twist: (rng() - 0.5) * 0.12,
        px: Math.sin(yaw) * r * 0.12,
        py: y0 + sy * 0.08,
        pz: Math.cos(yaw) * r * 0.12,
        len: sy * (0.72 + rng() * 0.14),
        wide: r * (0.42 + rng() * 0.1),
      };
    });
  }, [n, r, seed, sy, y0]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = _palmDummy;
    for (let i = 0; i < poses.length; i++) {
      const p = poses[i]!;
      dummy.position.set(p.px, p.py, p.pz);
      dummy.scale.set(p.wide, p.len, 1);
      setPalmFrondQuaternion(dummy, p.yaw, p.droop, p.twist);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [poses]);

  return (
    <group>
      <mesh position={[0, y0 + sy * 0.06, 0]} castShadow>
        <sphereGeometry args={[r * 0.14, 8, 6]} />
        <PlantMat color="#5a6a38" roughness={0.85} selected={selected} />
      </mesh>
      <instancedMesh
        ref={meshRef}
        args={[geo, undefined, n]}
        castShadow
        frustumCulled={false}
      >
        <PlantMat
          color={leafMap ? "#ffffff" : plantCssColor(plant.foliage)}
          map={leafMap}
          roughness={0.48}
          selected={selected}
          doubleSide
        />
      </instancedMesh>
      {[0.4, 2.2, 4.1].map((yaw, i) => {
        const p = poses[Math.min(poses.length - 1, i * 2)]!;
        const bloom = limbPoint(
          { ox: p.px, oy: p.py, oz: p.pz, yaw: p.yaw, droop: p.droop, len: p.len },
          0.42,
        );
        return (
          <group
            key={`bloom-${i}`}
            position={[bloom.x, bloom.y, bloom.z]}
            rotation={[0.2, yaw, 0.45]}
            scale={r * 1.15}
          >
            <mesh rotation={[Math.PI / 2, 0, 0.2]} castShadow>
              <coneGeometry args={[0.055, 0.18, 7]} />
              <PlantMat color="#6a8a48" roughness={0.55} selected={selected} />
            </mesh>
            <mesh
              position={[0.02, 0.02, 0]}
              rotation={[Math.PI / 2, 0, 0.2]}
              scale={[1.6, 0.45, 1]}
              castShadow
            >
              <coneGeometry args={[0.05, 0.16, 6]} />
              <PlantMat color="#c47a6a" roughness={0.55} selected={selected} />
            </mesh>
            {[-0.38, -0.14, 0.1, 0.34].map((a, k) => (
              <mesh
                key={k}
                position={[0.01, 0.1, 0]}
                rotation={[0.15, 0, a]}
                castShadow
              >
                <coneGeometry args={[0.012, 0.16, 4]} />
                <PlantMat color="#e07020" roughness={0.42} selected={selected} />
              </mesh>
            ))}
            <mesh
              position={[0.11, 0.04, 0]}
              rotation={[0.1, 0, 1.15]}
              scale={[1.2, 0.35, 0.7]}
              castShadow
            >
              <coneGeometry args={[0.028, 0.11, 5]} />
              <PlantMat color="#2c5cb0" roughness={0.4} selected={selected} />
            </mesh>
          </group>
        );
      })}
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
  const r = Math.min(sx, sz) * 0.5;
  const caneH = sy * 0.48;
  const geo = useMemo(() => tiLeafGeometry(), []);
  const leafMap = getSpeciesLeafTexture(plant);
  const n = 16;
  const seed = hashStr(plant.id);
  const poses = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: n }, (_, i) => {
      const yaw = (i / n) * Math.PI * 2 + rng() * 0.18;
      const along = i < 4 ? 0.62 + rng() * 0.2 : 0.92 + rng() * 0.06;
      return {
        yaw,
        droop: 0.38 + rng() * 0.55,
        twist: (rng() - 0.5) * 0.2,
        px: Math.sin(yaw) * r * 0.04,
        py: y0 + caneH * along,
        pz: Math.cos(yaw) * r * 0.04,
        len: sy * (0.42 + rng() * 0.12),
        wide: r * (0.48 + rng() * 0.12),
      };
    });
  }, [caneH, n, r, seed, sy, y0]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = _palmDummy;
    for (let i = 0; i < poses.length; i++) {
      const p = poses[i]!;
      dummy.position.set(p.px, p.py, p.pz);
      dummy.scale.set(p.wide, p.len, 1);
      setPalmFrondQuaternion(dummy, p.yaw, p.droop, p.twist);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [poses]);
  return (
    <group>
      <Trunk
        plant={plant}
        y0={y0}
        height={caneH}
        rBase={r * 0.08}
        rTop={r * 0.055}
        selected={selected}
        segments={8}
      />
      <instancedMesh
        ref={meshRef}
        args={[geo, undefined, n]}
        castShadow
        frustumCulled={false}
      >
        <PlantMat
          color={leafMap ? "#ffffff" : plantCssColor(plant.foliage)}
          map={leafMap}
          roughness={0.48}
          selected={selected}
          doubleSide
        />
      </instancedMesh>
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
  const r = Math.min(sx, sz) * 0.5;
  const geo = useMemo(() => fernFrondGeometry(0.85), []);
  const leafMap = getSpeciesLeafTexture(plant);
  const n = 22;
  const seed = hashStr(plant.id);
  const poses = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: n }, (_, i) => {
      const yaw = (i / n) * Math.PI * 2 + rng() * 0.16;
      const age = i / Math.max(1, n - 1);
      return {
        yaw,
        droop: 0.55 + age * 0.85 + rng() * 0.1,
        twist: (rng() - 0.5) * 0.18,
        px: Math.sin(yaw) * r * 0.06,
        py: y0 + sy * 0.06,
        pz: Math.cos(yaw) * r * 0.06,
        len: sy * (0.72 + rng() * 0.2),
        wide: r * (0.55 + rng() * 0.16),
      };
    });
  }, [n, r, seed, sy, y0]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = _palmDummy;
    for (let i = 0; i < poses.length; i++) {
      const p = poses[i]!;
      dummy.position.set(p.px, p.py, p.pz);
      dummy.scale.set(p.wide, p.len, 1);
      setPalmFrondQuaternion(dummy, p.yaw, p.droop, p.twist);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [poses]);
  return (
    <group>
      <mesh position={[0, y0 + sy * 0.05, 0]} castShadow>
        <sphereGeometry args={[r * 0.12, 8, 6]} />
        <PlantMat color="#4a3a28" roughness={0.9} selected={selected} />
      </mesh>
      <instancedMesh
        ref={meshRef}
        args={[geo, undefined, n]}
        castShadow
        frustumCulled={false}
      >
        <PlantMat
          color={leafMap ? "#ffffff" : plantCssColor(plant.foliage)}
          map={leafMap}
          roughness={0.62}
          selected={selected}
          doubleSide
        />
      </instancedMesh>
    </group>
  );
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
  if (form === "banana") {
    return <BananaPlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (form === "bird_of_paradise") {
    return (
      <BirdOfParadisePlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />
    );
  }
  if (form === "elephant_ear" || form === "philodendron") {
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
