"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { GRASS_TILE_M } from "@/lib/cad3d/proceduralTextures";
import type { TimeOfDayPreset } from "@/lib/cad3d/timeOfDay";

/** Half-extent of the horizon lawn. Larger than orbit zoom; fog hides the rim. */
const WORLD_HALF_M = 2800;
const WORLD_SEGMENTS = 96;
const SKY_DISTANCE = 4000;

type Props = {
  center: { x: number; z: number };
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
 * Subdivided square lawn. A disc/ring used huge radial triangles, which
 * stretched grass into a corduroy strip and left a thin rim you could see
 * under at low pitch.
 */
function makeHorizonLawnGeometry(center: {
  x: number;
  z: number;
}): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(
    WORLD_HALF_M * 2,
    WORLD_HALF_M * 2,
    WORLD_SEGMENTS,
    WORLD_SEGMENTS,
  );
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    uv.setXY(
      i,
      (center.x + lx) / GRASS_TILE_M,
      (center.z - ly) / GRASS_TILE_M,
    );
  }
  uv.needsUpdate = true;
  return geo;
}

function HorizonGround({
  center,
  groundMap,
  groundRoughness,
  night,
}: {
  center: { x: number; z: number };
  groundMap?: THREE.CanvasTexture | null;
  groundRoughness?: THREE.CanvasTexture | null;
  night: boolean;
}) {
  const geometry = useMemo(
    () => makeHorizonLawnGeometry(center),
    [center.x, center.z],
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
