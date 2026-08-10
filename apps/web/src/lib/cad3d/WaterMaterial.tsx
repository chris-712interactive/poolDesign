"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ClipPlanesContext } from "@/lib/cad3d/clipContext";
import {
  TIME_OF_DAY_PRESETS,
  type TimeOfDay,
} from "@/lib/cad3d/timeOfDay";

export type WaterTextures = {
  albedo: THREE.CanvasTexture;
  normalA: THREE.CanvasTexture;
  normalB: THREE.CanvasTexture;
};

export const WaterTextureContext = createContext<WaterTextures | null>(null);

type WaterLayer = "volume" | "surface";

/**
 * Animated pool / spa water.
 * Surface: physical water with dual scrolling normals, clearcoat, sky reflections.
 * Volume: soft absorption tint so depth reads through the basin.
 */
export function WaterMaterial({
  layer,
  selected,
  opacity,
  spa = false,
}: {
  layer: WaterLayer;
  selected: boolean;
  opacity?: number;
  spa?: boolean;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const textures = useContext(WaterTextureContext);
  const matRef = useRef<THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial>(
    null,
  );

  // Clone maps so offset animation doesn't fight other water bodies.
  const maps = useMemo(() => {
    if (!textures || layer !== "surface") return null;
    return {
      map: textures.albedo.clone(),
      normalMap: textures.normalA.clone(),
      clearcoatNormalMap: textures.normalB.clone(),
    };
  }, [textures, layer]);

  useEffect(
    () => () => {
      maps?.map.dispose();
      maps?.normalMap.dispose();
      maps?.clearcoatNormalMap.dispose();
    },
    [maps],
  );

  useFrame((_, dt) => {
    if (!maps) return;
    const t = Math.min(dt, 0.05);
    maps.map.offset.x -= t * 0.018;
    maps.map.offset.y += t * 0.011;
    maps.normalMap.offset.x += t * 0.045;
    maps.normalMap.offset.y += t * 0.028;
    maps.clearcoatNormalMap.offset.x -= t * 0.032;
    maps.clearcoatNormalMap.offset.y += t * 0.051;
  });

  // Chlorinated residential pool: turquoise body, deeper teal absorption.
  const baseColor = spa ? "#1a96b4" : "#1290b0";
  const attenuation = spa ? "#0a6e88" : "#055870";

  if (layer === "volume") {
    return (
      <meshStandardMaterial
        ref={matRef as RefObject<THREE.MeshStandardMaterial>}
        color={spa ? "#0e6f88" : "#0a5f78"}
        roughness={0.45}
        metalness={0}
        transparent
        opacity={Math.min(0.48, Math.max(0.26, opacity ?? 0.34))}
        side={THREE.FrontSide}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
        emissive={selected ? "#1f8a70" : "#021820"}
        emissiveIntensity={selected ? 0.22 : 0.06}
        envMapIntensity={0.2}
        clippingPlanes={clippingPlanes}
        clipShadows={clippingPlanes.length > 0}
      />
    );
  }

  return (
    <meshPhysicalMaterial
      ref={matRef as RefObject<THREE.MeshPhysicalMaterial>}
      color={baseColor}
      map={maps?.map ?? undefined}
      normalMap={maps?.normalMap ?? undefined}
      normalScale={[0.7, 0.7]}
      clearcoatNormalMap={maps?.clearcoatNormalMap ?? undefined}
      clearcoatNormalScale={[0.55, 0.55]}
      roughness={0.045}
      metalness={0}
      clearcoat={1}
      clearcoatRoughness={0.08}
      // Transmission + attenuation = see the floor with depth tint.
      transmission={0.55}
      thickness={spa ? 0.5 : 1.6}
      ior={1.333}
      attenuationColor={attenuation}
      attenuationDistance={spa ? 1.1 : 2.2}
      transparent
      opacity={Math.min(0.9, Math.max(0.7, opacity ?? 0.82))}
      side={THREE.FrontSide}
      depthWrite
      polygonOffset
      polygonOffsetFactor={-2}
      polygonOffsetUnits={-2}
      envMapIntensity={1.85}
      specularIntensity={1}
      specularColor="#d8f0ff"
      emissive={selected ? "#1f8a70" : "#000000"}
      emissiveIntensity={selected ? 0.18 : 0}
      clippingPlanes={clippingPlanes}
      clipShadows={clippingPlanes.length > 0}
    />
  );
}

function useScrollingCausticMap(repeat: number) {
  const textures = useContext(WaterTextureContext);
  const map = useMemo(() => {
    if (!textures) return null;
    const tex = textures.albedo.clone();
    tex.repeat.set(repeat, repeat);
    return tex;
  }, [textures, repeat]);

  useEffect(
    () => () => {
      map?.dispose();
    },
    [map],
  );

  useFrame((_, dt) => {
    if (!map) return;
    const t = Math.min(dt, 0.05);
    map.offset.x += t * 0.04;
    map.offset.y -= t * 0.025;
  });

  return map;
}

/** Soft animated caustic sparkle just under the waterline. */
export function WaterCausticOverlay({
  geometry,
}: {
  geometry: THREE.BufferGeometry;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const map = useScrollingCausticMap(3.6);
  if (!map) return null;

  return (
    <mesh
      geometry={geometry}
      position={[0, -0.012, 0]}
      renderOrder={2.5}
      raycast={() => null}
    >
      <meshBasicMaterial
        map={map}
        color="#9fe8ff"
        transparent
        opacity={0.22}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.FrontSide}
        clippingPlanes={clippingPlanes}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * Projected-style caustics on the basin floor (and optionally walls).
 * Additive scroll so the shell sparkles under daylight / LED wash.
 */
export function BasinCausticOverlay({
  geometry,
  /** Lift slightly above the receiving surface to avoid z-fight. */
  yOffset = 0.012,
  opacity = 0.32,
  color = "#7fdfff",
}: {
  geometry: THREE.BufferGeometry;
  yOffset?: number;
  opacity?: number;
  color?: string;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const map = useScrollingCausticMap(2.8);
  if (!map) return null;

  return (
    <mesh
      geometry={geometry}
      position={[0, yOffset, 0]}
      renderOrder={1.5}
      raycast={() => null}
    >
      <meshBasicMaterial
        map={map}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

/**
 * Outdoor sky + ground bounce env map (no CDN HDR dependency).
 * Higher-res PMREM shared scene-wide for water, wet coping, glass, metal.
 * Rebuilds when the day / sunset / night preset changes.
 */
export function WaterEnvironment({
  timeOfDay = "day",
}: {
  timeOfDay?: TimeOfDay;
}) {
  const { gl, scene } = useThree();
  const preset = TIME_OF_DAY_PRESETS[timeOfDay];

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    const skyGeo = new THREE.SphereGeometry(50, 64, 32);
    const [sx, sy, sz] = preset.env.sunDir;
    const [sr, sg, sb] = preset.env.sunColor;
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(preset.env.top) },
        midColor: { value: new THREE.Color(preset.env.mid) },
        botColor: { value: new THREE.Color(preset.env.bot) },
        sunDir: { value: new THREE.Vector3(sx, sy, sz).normalize() },
        sunColor: { value: new THREE.Vector3(sr, sg, sb) },
        sunStrength: { value: preset.env.sunStrength },
        glowStrength: { value: preset.env.glowStrength },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldPos = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 botColor;
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        uniform float sunStrength;
        uniform float glowStrength;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y;
          vec3 col = mix(botColor, midColor, smoothstep(-0.25, 0.12, h));
          col = mix(col, topColor, smoothstep(0.1, 0.9, h));
          // Soft horizon haze for richer reflections on wet surfaces.
          float haze = exp(-abs(h) * 4.5) * 0.12;
          col += midColor * haze;
          float sun = pow(max(0.0, dot(dir, sunDir)), 72.0);
          float glow = pow(max(0.0, dot(dir, sunDir)), 7.0);
          col += sunColor * sun * sunStrength;
          col += sunColor * glow * glowStrength;
          // Dim opposite sky so metal / glass get contrasty reflections.
          float anti = pow(max(0.0, -dot(dir, sunDir)), 2.0);
          col *= 1.0 - anti * 0.18;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    envScene.add(sky);

    // Ground bounce disc — landscaping greens in the lower hemisphere.
    const groundGeo = new THREE.CircleGeometry(48, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(preset.env.bot).multiplyScalar(0.85),
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.5;
    envScene.add(ground);

    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 120, { size: 512 });
    const prev = scene.environment;
    scene.environment = rt.texture;
    scene.environmentIntensity = timeOfDay === "night" ? 0.55 : 1;

    skyGeo.dispose();
    skyMat.dispose();
    groundGeo.dispose();
    groundMat.dispose();
    pmrem.dispose();

    return () => {
      rt.texture.dispose();
      if (scene.environment === rt.texture) {
        scene.environment = prev;
      }
      scene.environmentIntensity = 1;
    };
  }, [gl, scene, preset, timeOfDay]);

  return null;
}
