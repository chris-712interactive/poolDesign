"use client";

import { useEffect, useRef } from "react";
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
 * Directional sun / moon with a frustum fitted to the design footprint.
 * Higher map size + bias / radius for softer contact without hard jagged edges.
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
  const size = Number.isFinite(groundSize) ? groundSize : 40;
  const half = Math.max(18, size * 0.55 + 6);
  const cx = Number.isFinite(center.x) ? center.x : 0;
  const cz = Number.isFinite(center.z) ? center.z : 0;

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = Math.max(80, half * 4);
    cam.updateProjectionMatrix();
    light.shadow.bias = -0.00015;
    light.shadow.normalBias = 0.04;
    light.shadow.radius = 3.5;
  }, [half]);

  return (
    <directionalLight
      ref={lightRef}
      position={position}
      intensity={intensity}
      color={color}
      castShadow={castShadow}
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-far={Math.max(80, half * 4)}
      shadow-camera-left={-half}
      shadow-camera-right={half}
      shadow-camera-top={half}
      shadow-camera-bottom={-half}
    >
      {/* Target must live in the scene graph for correct aiming / shadows. */}
      <object3D attach="target" position={[cx, 0, cz]} />
    </directionalLight>
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
