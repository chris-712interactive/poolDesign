"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { GRASS_TILE_M } from "@/lib/cad3d/proceduralTextures";
import type { TimeOfDayPreset } from "@/lib/cad3d/timeOfDay";

/** Half-extent of the horizon lawn. Larger than orbit zoom; fog hides the rim. */
const WORLD_HALF_M = 2800;
const CELL_M = 36;
const SKY_DISTANCE = 4000;

type Props = {
  center: { x: number; z: number };
  /** Lot pad half-size in world XZ (m). Horizon lawn is an annulus outside this. */
  lotPadHalfM: { x: number; z: number };
  tod: TimeOfDayPreset;
  sunPosition: [number, number, number];
  groundMap?: THREE.CanvasTexture | null;
  groundRoughness?: THREE.CanvasTexture | null;
  night: boolean;
};

function disableFog(root: THREE.Object3D | null) {
  if (!root) return;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const m = mat as THREE.ShaderMaterial;
      m.fog = false;
      m.depthWrite = false;
    }
  });
}

/**
 * Square annulus: subdivided lawn around the lot pad. A solid plane filled
 * pool pits and buried survey marks; a disc/ring stretched UVs into a strip.
 */
function segsFor(lengthM: number): number {
  return Math.max(1, Math.ceil(Math.abs(lengthM) / CELL_M));
}

function pushGrid(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  center: { x: number; z: number },
) {
  const nx = segsFor(x1 - x0) + 1;
  const ny = segsFor(y1 - y0) + 1;
  const base = positions.length / 3;
  for (let j = 0; j < ny; j++) {
    const y = y0 + ((y1 - y0) * j) / (ny - 1);
    for (let i = 0; i < nx; i++) {
      const x = x0 + ((x1 - x0) * i) / (nx - 1);
      positions.push(x, y, 0);
      normals.push(0, 0, 1);
      uvs.push(
        (center.x + x) / GRASS_TILE_M,
        (center.z - y) / GRASS_TILE_M,
      );
    }
  }
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = base + j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
}

function makeHorizonLawnGeometry(
  center: { x: number; z: number },
  lotPadHalfM: { x: number; z: number },
): THREE.BufferGeometry {
  const innerX = Math.min(
    WORLD_HALF_M * 0.4,
    Math.max(8, lotPadHalfM.x * 0.98),
  );
  const innerY = Math.min(
    WORLD_HALF_M * 0.4,
    Math.max(8, lotPadHalfM.z * 0.98),
  );
  const o = WORLD_HALF_M;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  // Four rectangles around the pad (local XY, rotated to XZ later).
  pushGrid(positions, normals, uvs, indices, -o, -o, -innerX, o, center);
  pushGrid(positions, normals, uvs, indices, innerX, -o, o, o, center);
  pushGrid(positions, normals, uvs, indices, -innerX, -o, innerX, -innerY, center);
  pushGrid(positions, normals, uvs, indices, -innerX, innerY, innerX, o, center);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function HorizonGround({
  center,
  lotPadHalfM,
  groundMap,
  groundRoughness,
  night,
}: {
  center: { x: number; z: number };
  lotPadHalfM: { x: number; z: number };
  groundMap?: THREE.CanvasTexture | null;
  groundRoughness?: THREE.CanvasTexture | null;
  night: boolean;
}) {
  const geometry = useMemo(
    () => makeHorizonLawnGeometry(center, lotPadHalfM),
    [center.x, center.z, lotPadHalfM.x, lotPadHalfM.z],
  );

  useLayoutEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[center.x, -0.06, center.z]}
      receiveShadow
      frustumCulled={false}
      renderOrder={-2}
    >
      <meshStandardMaterial
        map={groundMap}
        roughnessMap={groundRoughness ?? undefined}
        color={night ? "#4a5848" : "#ffffff"}
        roughness={1}
        metalness={0}
        envMapIntensity={0.35}
        polygonOffset
        polygonOffsetFactor={4}
        polygonOffsetUnits={4}
      />
    </mesh>
  );
}

function NightDome() {
  const stars = useMemo(() => {
    const count = 900;
    const positions = new Float32Array(count * 3);
    const radius = 2800;
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(Math.min(1, Math.max(0, 1 - v * 0.72)));
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useLayoutEffect(() => () => stars.dispose(), [stars]);

  return (
    <group>
      <mesh>
        <sphereGeometry args={[3200, 32, 24]} />
        <meshBasicMaterial
          color="#081018"
          side={THREE.BackSide}
          fog={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial
          color="#d8e4f4"
          size={2.2}
          sizeAttenuation={false}
          fog={false}
          depthWrite={false}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

/**
 * Sky + horizon lawn for walk / orbit. drei Sky is a mesh; scene fog was
 * painting it solid gray past ~150 m. Fog is disabled on the sky only.
 */
export function WorldBackdrop({
  center,
  lotPadHalfM,
  tod,
  sunPosition,
  groundMap,
  groundRoughness,
  night,
}: Props) {
  const skyGroup = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    disableFog(skyGroup.current);
  });

  return (
    <>
      <HorizonGround
        center={center}
        lotPadHalfM={lotPadHalfM}
        groundMap={groundMap}
        groundRoughness={groundRoughness}
        night={night}
      />
      <group ref={skyGroup}>
        {tod.showSky && !night ? (
          <Sky
            distance={SKY_DISTANCE}
            sunPosition={sunPosition}
            turbidity={tod.sky.turbidity}
            rayleigh={tod.sky.rayleigh}
            mieCoefficient={tod.sky.mieCoefficient}
            mieDirectionalG={tod.sky.mieDirectionalG}
          />
        ) : (
          <NightDome />
        )}
      </group>
    </>
  );
}
