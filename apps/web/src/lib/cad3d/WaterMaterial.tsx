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
 * Shallow: sunshelf / ledge film — thin transmission so less water looks lighter.
 */
export function WaterMaterial({
  layer,
  selected,
  opacity,
  spa = false,
  shallow = false,
}: {
  layer: WaterLayer;
  selected: boolean;
  opacity?: number;
  spa?: boolean;
  /** ~9″ ledge water — do not use deep-basin attenuation thickness. */
  shallow?: boolean;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const textures = useContext(WaterTextureContext);
  const matRef = useRef<THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial>(
    null,
  );
  const timeRef = useRef(0);

  // Clone maps so offset animation doesn't fight other water bodies.
  const maps = useMemo(() => {
    if (!textures || layer !== "surface") return null;
    const map = textures.albedo.clone();
    const normalMap = textures.normalA.clone();
    const clearcoatNormalMap = textures.normalB.clone();
    // Spa: tighter, busier chop from jet agitation. Pool: broader calm ripples.
    const rep = spa ? 3.4 : shallow ? 2.1 : 1.6;
    const repB = spa ? 2.6 : shallow ? 1.7 : 1.25;
    map.repeat.set(spa ? 2.2 : shallow ? 1.5 : 1.2, spa ? 2.2 : shallow ? 1.5 : 1.2);
    normalMap.repeat.set(rep, rep);
    clearcoatNormalMap.repeat.set(repB, repB);
    return { map, normalMap, clearcoatNormalMap };
  }, [textures, layer, spa, shallow]);

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
    timeRef.current += t;
    if (spa) {
      // Faster cross-currents — spa surface churns from jets.
      const swirl = Math.sin(timeRef.current * 1.7) * 0.02;
      maps.map.offset.x -= t * 0.048;
      maps.map.offset.y += t * 0.038;
      maps.normalMap.offset.x += t * (0.16 + swirl);
      maps.normalMap.offset.y += t * 0.13;
      maps.clearcoatNormalMap.offset.x -= t * 0.14;
      maps.clearcoatNormalMap.offset.y += t * (0.18 - swirl);
      const mat = matRef.current as THREE.MeshPhysicalMaterial | null;
      if (mat?.normalScale) {
        const pulse = 1.25 + Math.sin(timeRef.current * 3.2) * 0.18;
        mat.normalScale.set(pulse, pulse);
      }
    } else {
      maps.map.offset.x -= t * 0.018;
      maps.map.offset.y += t * 0.011;
      maps.normalMap.offset.x += t * 0.045;
      maps.normalMap.offset.y += t * 0.028;
      maps.clearcoatNormalMap.offset.x -= t * 0.032;
      maps.clearcoatNormalMap.offset.y += t * 0.051;
    }
  });

  // Chlorinated residential pool: turquoise body, deeper teal absorption.
  const baseColor = spa ? "#1a96b4" : shallow ? "#5ec8e0" : "#1290b0";
  const attenuation = spa ? "#0a6e88" : shallow ? "#7ad4ea" : "#055870";

  if (layer === "volume") {
    return (
      <meshStandardMaterial
        ref={matRef as RefObject<THREE.MeshStandardMaterial>}
        color={spa ? "#0e6f88" : shallow ? "#3aa8c4" : "#0a5f78"}
        roughness={0.45}
        metalness={0}
        transparent
        opacity={Math.min(
          shallow ? 0.22 : 0.48,
          Math.max(shallow ? 0.1 : 0.26, opacity ?? (shallow ? 0.14 : 0.34)),
        )}
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
      normalScale={spa ? [1.25, 1.25] : shallow ? [0.45, 0.45] : [0.7, 0.7]}
      clearcoatNormalMap={maps?.clearcoatNormalMap ?? undefined}
      clearcoatNormalScale={
        spa ? [1.05, 1.05] : shallow ? [0.35, 0.35] : [0.55, 0.55]
      }
      roughness={spa ? 0.14 : shallow ? 0.08 : 0.045}
      metalness={0}
      clearcoat={spa ? 0.85 : 1}
      clearcoatRoughness={spa ? 0.28 : shallow ? 0.14 : 0.08}
      // Transmission + attenuation = see the floor with depth tint.
      // Shallow ledge: short thickness so ~9″ water stays pale turquoise.
      transmission={spa ? 0.42 : shallow ? 0.82 : 0.55}
      thickness={spa ? 0.5 : shallow ? 0.12 : 1.6}
      ior={1.333}
      attenuationColor={attenuation}
      attenuationDistance={spa ? 1.1 : shallow ? 6 : 2.2}
      transparent
      opacity={
        shallow
          ? Math.min(0.55, Math.max(0.28, opacity ?? 0.38))
          : Math.min(0.9, Math.max(0.7, opacity ?? 0.82))
      }
      side={THREE.FrontSide}
      depthWrite={!shallow}
      polygonOffset
      polygonOffsetFactor={-2}
      polygonOffsetUnits={-2}
      envMapIntensity={spa ? 1.25 : shallow ? 1.15 : 1.85}
      specularIntensity={spa ? 0.85 : shallow ? 0.7 : 1}
      specularColor="#d8f0ff"
      emissive={selected ? "#1f8a70" : "#000000"}
      emissiveIntensity={selected ? 0.18 : 0}
      clippingPlanes={clippingPlanes}
      clipShadows={clippingPlanes.length > 0}
    />
  );
}

/**
 * Procedural spa→pool waterfall sheet.
 * Vertical streaks, crest foam, and bottom splash — not a flat tinted plane.
 */
export function SpilloverWaterMaterial({
  selected,
  opacity = 0.75,
  /** 0 = main sheet, 1 = soft veil (more transparent, softer foam) */
  layer = 0,
}: {
  selected: boolean;
  opacity?: number;
  layer?: 0 | 1;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uSelected: { value: selected ? 1 : 0 },
      uLayer: { value: layer },
    }),
    // opacity/selected/layer applied each frame below; keep stable uniform object
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value += Math.min(dt, 0.05);
    mat.uniforms.uOpacity.value = opacity;
    mat.uniforms.uSelected.value = selected ? 1 : 0;
    mat.uniforms.uLayer.value = layer;
    // Keep clip planes in sync with section cutaway.
    mat.clipping = clippingPlanes.length > 0;
    mat.clippingPlanes = clippingPlanes;
  });

  return (
    <shaderMaterial
      ref={matRef}
      transparent
      depthWrite={false}
      side={THREE.DoubleSide}
      blending={THREE.NormalBlending}
      uniforms={uniforms}
      vertexShader={/* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - world.xyz);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `}
      fragmentShader={/* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        uniform float uSelected;
        uniform float uLayer;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.05;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          // Flow downward: uv.y 1 at crest → 0 at pool.
          // +t on v scrolls pattern toward decreasing uv.y (spa → pool).
          float t = uTime;
          vec2 flowUv = vec2(vUv.x * 6.0, vUv.y * 5.0 + t * 2.8);
          vec2 flowUv2 = vec2(vUv.x * 11.0 + 1.7, vUv.y * 9.0 + t * 4.2);

          // Vertical filaments / curtain strands
          float strands =
            0.55 * sin(flowUv.x * 6.2831 + fbm(flowUv) * 4.0) +
            0.35 * sin(flowUv2.x * 6.2831 - t * 1.5);
          strands = strands * 0.5 + 0.5;
          float detail = fbm(flowUv2 + strands);
          float curtain = smoothstep(0.25, 0.85, strands * 0.65 + detail * 0.55);

          // Bright chlorinated water vs deeper teal in gaps between strands
          vec3 deep = vec3(0.12, 0.55, 0.68);
          vec3 mid = vec3(0.32, 0.78, 0.88);
          vec3 bright = vec3(0.72, 0.94, 1.0);
          vec3 col = mix(deep, mid, curtain);
          col = mix(col, bright, pow(curtain, 2.2) * 0.65);

          // Specular sparkle traveling down the sheet
          float sparkle = pow(max(0.0, sin(flowUv2.x * 18.0 + flowUv.y * 30.0)), 18.0);
          col += vec3(0.85, 0.95, 1.0) * sparkle * 0.55;

          // Crest foam (top of sheet)
          float crestN = fbm(vec2(vUv.x * 14.0 + t * 0.8, t * 1.2));
          float crest = smoothstep(0.72, 0.98, vUv.y) * (0.55 + 0.45 * crestN);
          col = mix(col, vec3(0.95, 0.98, 1.0), crest * 0.9);

          // Bottom splash / whitewater where sheet hits pool
          float splashN = fbm(vec2(vUv.x * 18.0 + t * 1.4, vUv.y * 6.0 + t * 3.0));
          float splash = smoothstep(0.28, 0.0, vUv.y) * (0.4 + 0.6 * splashN);
          col = mix(col, vec3(0.9, 0.97, 1.0), splash * 0.85);

          // Soft side fade so the sheet isn't a hard rectangle
          float side = smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x);

          // Fresnel rim — brighter glancing edges
          float fres = pow(1.0 - max(0.0, dot(normalize(vWorldNormal), normalize(vViewDir))), 2.4);
          col += vec3(0.55, 0.85, 1.0) * fres * 0.35;

          float alpha = uOpacity * side;
          alpha *= mix(0.35, 0.95, curtain);
          alpha = max(alpha, crest * 0.75);
          alpha = max(alpha, splash * 0.55);
          alpha *= mix(1.0, 0.45, uLayer); // veil layer softer
          alpha = clamp(alpha, 0.0, 0.92);

          if (uSelected > 0.5) {
            col = mix(col, vec3(0.25, 0.75, 0.6), 0.18);
          }

          gl_FragColor = vec4(col, alpha);
        }
      `}
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
