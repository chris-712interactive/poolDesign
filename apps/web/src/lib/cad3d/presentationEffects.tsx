"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isGoldenHour, type TimeOfDay } from "@/lib/cad3d/timeOfDay";

/** Soft-looking PCF shadows for the whole canvas. */
export function SoftShadowSetup() {
  const { gl } = useThree();
  useEffect(() => {
    gl.shadowMap.enabled = true;
    // three r185+: PCFSoftShadowMap is deprecated; PCF + shadow.radius softens contacts.
    gl.shadowMap.type = THREE.PCFShadowMap;
  }, [gl]);
  return null;
}

/**
 * Directional sun / moon. Target is a world-space sibling (not a child of the
 * light) so the shadow camera looks at the yard. Frustum is fitted along the
 * sun ray so low morning/evening light still covers house → pool shadows.
 */
export function SunLight({
  position,
  intensity,
  color,
  castShadow,
  center,
  groundSize,
}: {
  position: [number, number, number];
  intensity: number;
  color: string;
  castShadow: boolean;
  center: { x: number; z: number };
  groundSize: number;
}) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const size = Number.isFinite(groundSize) ? groundSize : 40;
  const cx = Number.isFinite(center.x) ? center.x : 0;
  const cz = Number.isFinite(center.z) ? center.z : 0;
  const [lx, ly, lz] = position;

  useLayoutEffect(() => {
    const light = lightRef.current;
    const target = targetRef.current;
    if (!light || !target) return;

    light.target = target;
    target.position.set(cx, 0, cz);
    target.updateMatrixWorld();
    light.updateMatrixWorld();

    const dist = Math.hypot(lx - cx, ly, lz - cz) || 1;
    const elev = Math.asin(Math.max(-1, Math.min(1, ly / dist)));
    const siteR = Math.max(14, size * 0.42);
    const tanElev = Math.tan(Math.max((7 * Math.PI) / 180, Math.abs(elev)));
    const shadowLen = Math.min(48, 9 / tanElev);
    const half = Math.min(90, Math.max(siteR + 6, siteR * 0.4 + shadowLen));
    const cam = light.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = Math.max(0.5, dist - half);
    cam.far = dist + half + 24;
    cam.updateProjectionMatrix();
    light.shadow.bias = -0.00025;
    light.shadow.normalBias = Math.abs(elev) < 0.22 ? 0.03 : 0.018;
    light.shadow.radius = 2;
  }, [lx, ly, lz, cx, cz, size]);

  return (
    <>
      <directionalLight
        ref={lightRef}
        position={position}
        intensity={intensity}
        color={color}
        castShadow={castShadow}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <object3D ref={targetRef} position={[cx, 0, cz]} />
    </>
  );
}

/**
 * Tone / exposure nudge for sunset & night so emissive LEDs read brighter
 * without EffectComposer (which broke the WebGL present path in this stack).
 */
export function PresentationBloom({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const { gl } = useThree();
  useEffect(() => {
    const base = gl.toneMappingExposure;
    if (timeOfDay === "night") {
      gl.toneMappingExposure = Math.min(1.35, base * 1.15);
    } else if (isGoldenHour(timeOfDay)) {
      gl.toneMappingExposure = Math.min(1.2, base * 1.05);
    }
    return () => {
      // CadScene restores exposure via ToneMappingExposure each frame / preset.
    };
  }, [gl, timeOfDay]);
  return null;
}
