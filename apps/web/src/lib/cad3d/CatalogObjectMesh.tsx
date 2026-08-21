"use client";

import { useContext, useLayoutEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { CanvasTexture } from "three";
import {
  DEFAULT_FURNITURE_CANOPY_FINISH_ID,
  DEFAULT_FURNITURE_FABRIC_FINISH_ID,
  DEFAULT_FURNITURE_FRAME_FINISH_ID,
  DINING_CHAIR_CLEARANCE_MM,
  diningChairSlotsMm,
  diningTableShape,
  furnitureFinishCssColor,
  getFurnitureFinish,
  isDiningSetId,
  PATIO_SLAB_THICKNESS_MM,
  getFloridaVine,
  isTrellisId,
  resolvePersonOutfitId,
  resolvePersonSex,
  vineBloomShape,
  vineCssColor,
} from "@pool-design/shared";
import { PersonMesh } from "@/lib/cad3d/PersonMesh";
import {
  isPadEquipmentCatalogId,
  PadEquipmentMesh,
} from "@/lib/cad3d/PadEquipmentMesh";
import type { BoxDescriptor, SceneSelection } from "@/lib/cad3d/buildScene";
import { ClipPlanesContext } from "@/lib/cad3d/clipContext";
import {
  getFurnitureFinishTexture,
  type FurnTexPair,
} from "@/lib/cad3d/furnitureFinishTextures";
import {
  isNightTime,
  ledBoostForTimeOfDay,
  useTimeOfDay,
} from "@/lib/cad3d/timeOfDay";

type Props = {
  desc: BoxDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
};

function useFurnitureTextures(desc: BoxDescriptor) {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    return {
      frame: getFurnitureFinishTexture(
        desc.frameFinishId,
        "wood",
        DEFAULT_FURNITURE_FRAME_FINISH_ID,
      ),
      fabric: getFurnitureFinishTexture(
        desc.fabricFinishId,
        "fabric",
        DEFAULT_FURNITURE_FABRIC_FINISH_ID,
      ),
      canopy: getFurnitureFinishTexture(
        desc.fabricFinishId,
        "canvas",
        DEFAULT_FURNITURE_CANOPY_FINISH_ID,
      ),
    };
  }, [desc.frameFinishId, desc.fabricFinishId]);
}

function Mat({
  color,
  map,
  roughnessMap,
  bumpMap,
  bumpScale = 0,
  roughness = 0.7,
  metalness = 0.05,
  opacity = 1,
  selected,
  emissive,
  emissiveIntensity = 0,
}: {
  color?: string;
  map?: CanvasTexture;
  roughnessMap?: CanvasTexture;
  bumpMap?: CanvasTexture;
  bumpScale?: number;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  selected: boolean;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  return (
    <meshStandardMaterial
      color={color ?? "#ffffff"}
      map={map}
      roughnessMap={roughnessMap}
      bumpMap={bumpMap}
      bumpScale={bumpScale}
      roughness={roughness}
      metalness={metalness}
      transparent={opacity < 0.99}
      opacity={opacity}
      emissive={selected ? "#1f8a70" : (emissive ?? "#000000")}
      emissiveIntensity={selected ? 0.28 : emissiveIntensity}
      clippingPlanes={clippingPlanes}
      clipShadows={clippingPlanes.length > 0}
    />
  );
}

/** ~10.5″ above water — typical aerated pool bubbler fountain. */
const BUBBLER_FOUNTAIN_HEIGHT_M = 0.267;

type DropletSeed = {
  phase: number;
  radius: number;
  dirX: number;
  dirZ: number;
  peakJitter: number;
  speed: number;
  /** How far out this droplet rides in the frothy column (0–1). */
  columnR: number;
};

/** Full RGB show cycle period (seconds) — leisurely like a real pool LED program. */
const BUBBLER_LED_CYCLE_SEC = 10;

/**
 * Aerated bubbler fountain: frothy column ~9–12″ above freeboard, falling back.
 * Optional niche LED cycles smoothly through RGB colors from below.
 */
function BubblerPlume({
  waterSurfaceLocalY,
  sunshelf,
  selected,
  hasLed,
}: {
  waterSurfaceLocalY: number;
  sunshelf: boolean;
  selected: boolean;
  hasLed: boolean;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const timeOfDay = useTimeOfDay();
  const ledBoost = ledBoostForTimeOfDay(timeOfDay);
  const dropsRef = useRef<THREE.Group>(null);
  const streamRef = useRef<THREE.Mesh>(null);
  const streamMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const foamRef = useRef<THREE.Mesh>(null);
  const foamMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const spotTargetRef = useRef<THREE.Object3D>(null);
  const ledColor = useMemo(() => new THREE.Color(), []);
  const ledTint = useMemo(() => new THREE.Color(), []);
  const ledSoft = useMemo(() => new THREE.Color(), []);
  const ledWhite = useMemo(() => new THREE.Color("#ffffff"), []);

  const nozzleY = 0.028;
  const peakY = waterSurfaceLocalY + BUBBLER_FOUNTAIN_HEIGHT_M;
  const landY = waterSurfaceLocalY - 0.01;
  const apexU = 0.4;
  const streamH = Math.max(0.08, peakY - nozzleY);
  const night = isNightTime(timeOfDay);
  const spotIntensity = (night ? 9 : 4.5) * ledBoost;

  useLayoutEffect(() => {
    if (spotRef.current && spotTargetRef.current) {
      spotRef.current.target = spotTargetRef.current;
    }
  }, [hasLed]);

  const droplets = useMemo<DropletSeed[]>(() => {
    const n = sunshelf ? 28 : 22;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 * 1.7 + i * 0.41;
      return {
        phase: (i * 0.618) % 1,
        radius: 0.008 + (i % 5) * 0.003,
        dirX: Math.cos(a),
        dirZ: Math.sin(a),
        peakJitter: ((i * 13) % 9) / 9 * 0.03 - 0.012,
        speed: 0.95 + (i % 5) * 0.07,
        columnR: 0.25 + ((i * 7) % 10) / 10 * 0.75,
      };
    });
  }, [sunshelf]);

  useFrame(({ clock }) => {
    const g = dropsRef.current;
    if (!g) return;
    const t = clock.elapsedTime;

    // Smooth RGB show: HSL hue walk (pool LED “color swim”).
    if (hasLed) {
      const hue = (t / BUBBLER_LED_CYCLE_SEC) % 1;
      ledColor.setHSL(hue, 1, 0.55);
      ledTint.copy(ledColor).lerp(ledWhite, 0.35);
      ledSoft.copy(ledColor).lerp(ledWhite, 0.55);
      if (spotRef.current) {
        spotRef.current.color.copy(ledColor);
        spotRef.current.intensity = spotIntensity + Math.sin(t * 6.5) * 0.4;
        spotRef.current.target.updateMatrixWorld();
      }
      if (streamMatRef.current) {
        streamMatRef.current.color.copy(ledTint);
        streamMatRef.current.emissive.copy(ledColor);
      }
      if (foamMatRef.current) {
        foamMatRef.current.color.copy(ledSoft);
        foamMatRef.current.emissive.copy(ledColor);
      }
    }

    for (let i = 0; i < droplets.length; i++) {
      const child = g.children[i];
      const d = droplets[i];
      if (!d || !(child instanceof THREE.Mesh)) continue;

      const cycle = (t * d.speed * 0.85 + d.phase) % 1;
      const thisPeak = peakY + d.peakJitter;

      let y: number;
      let radialT: number;
      if (cycle <= apexU) {
        const u = cycle / apexU;
        // Decelerate into the crest (frothy boil hangs at the top).
        const ease = 1 - (1 - u) * (1 - u);
        y = nozzleY + (thisPeak - nozzleY) * ease;
        // Column wider near the waterline, tapers toward the peak.
        const above = THREE.MathUtils.clamp(
          (y - waterSurfaceLocalY) / BUBBLER_FOUNTAIN_HEIGHT_M,
          0,
          1,
        );
        radialT = (0.045 * (1 - above * 0.55) + 0.01) * d.columnR;
      } else {
        const u = (cycle - apexU) / (1 - apexU);
        const ease = u * u;
        y = thisPeak + (landY - thisPeak) * ease;
        // Fall back with a slight outward mushroom.
        radialT = (0.02 + 0.05 * Math.sin(u * Math.PI)) * d.columnR;
      }

      const wobble = Math.sin(t * 11 + d.phase * 20) * 0.004;
      child.position.set(
        d.dirX * radialT + wobble,
        y,
        d.dirZ * radialT - wobble * 0.6,
      );

      const nearEnds =
        cycle < 0.04
          ? cycle / 0.04
          : cycle > 0.92
            ? Math.max(0, 1 - (cycle - 0.92) / 0.08)
            : 1;
      const aboveFrac = THREE.MathUtils.clamp(
        (y - waterSurfaceLocalY) / BUBBLER_FOUNTAIN_HEIGHT_M,
        0,
        1,
      );
      // Frothy blobs stay chunky near the base / mid column.
      child.scale.setScalar((1.1 + (1 - aboveFrac) * 0.7) * nearEnds);
      const mat = child.material as THREE.MeshStandardMaterial;
      mat.opacity = (hasLed ? 0.7 : 0.55) * nearEnds * (0.75 + aboveFrac * 0.25);
      if (hasLed) {
        mat.color.copy(ledSoft);
        mat.emissive.copy(ledColor);
        mat.emissiveIntensity =
          (0.55 + aboveFrac * 0.35 + Math.sin(t * 8 + d.phase) * 0.08) *
          ledBoost;
      }
    }

    if (streamRef.current && streamMatRef.current) {
      const pulse = 0.92 + Math.sin(t * 10) * 0.08;
      streamRef.current.scale.set(pulse, 1, pulse);
      streamMatRef.current.opacity =
        (hasLed ? 0.55 : 0.38) + Math.sin(t * 8) * 0.06;
      if (hasLed) {
        streamMatRef.current.emissiveIntensity =
          (0.85 + Math.sin(t * 7) * 0.15) * ledBoost;
      }
    }

    if (foamRef.current && foamMatRef.current) {
      const boil = 0.9 + Math.sin(t * 12) * 0.12;
      foamRef.current.scale.set(boil, 1, boil);
      foamMatRef.current.opacity =
        (hasLed ? 0.55 : 0.4) + Math.sin(t * 9) * 0.08;
      if (hasLed) {
        foamMatRef.current.emissiveIntensity =
          (0.9 + Math.sin(t * 6) * 0.2) * ledBoost;
      }
    }
  });

  return (
    <group>
      {hasLed ? (
        <>
          {/* Upward beam only — no omni point light washing the house/deck. */}
          <spotLight
            ref={spotRef}
            color="#ff2e6a"
            intensity={spotIntensity}
            distance={night ? 4.5 : 3}
            decay={1.8}
            angle={Math.PI / 5}
            penumbra={0.55}
            position={[0, nozzleY, 0]}
          />
          <object3D
            ref={spotTargetRef}
            position={[0, peakY + 0.35, 0]}
          />
        </>
      ) : null}

      {/* Dense aerated column — wider at the boil, tapers at the crest */}
      <mesh
        ref={streamRef}
        position={[0, nozzleY + streamH * 0.5, 0]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.018, 0.055, streamH, 16, 1, true]} />
        <meshStandardMaterial
          ref={streamMatRef}
          color={selected ? "#a8ebe0" : hasLed ? "#ff8eb0" : "#cfeef8"}
          transparent
          opacity={hasLed ? 0.55 : 0.38}
          roughness={0.35}
          metalness={0}
          emissive={hasLed ? "#ff2e6a" : "#000000"}
          emissiveIntensity={hasLed ? 0.85 : 0}
          side={THREE.DoubleSide}
          depthWrite={false}
          clippingPlanes={clippingPlanes}
          clipShadows={clippingPlanes.length > 0}
        />
      </mesh>

      {/* Surface foam ring where the jet breaks the waterline */}
      <mesh
        ref={foamRef}
        position={[0, waterSurfaceLocalY + 0.006, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        frustumCulled={false}
      >
        <circleGeometry args={[0.09, 28]} />
        <meshStandardMaterial
          ref={foamMatRef}
          color={hasLed ? "#ffd0e0" : "#f4fcff"}
          transparent
          opacity={hasLed ? 0.55 : 0.4}
          roughness={0.55}
          metalness={0}
          emissive={hasLed ? "#ff2e6a" : "#000000"}
          emissiveIntensity={hasLed ? 0.9 : 0}
          depthWrite={false}
          clippingPlanes={clippingPlanes}
        />
      </mesh>

      {/* Frothy droplets riding the column up and falling back */}
      <group ref={dropsRef}>
        {droplets.map((d, i) => (
          <mesh key={i} frustumCulled={false}>
            <sphereGeometry args={[d.radius, 8, 8]} />
            <meshStandardMaterial
              color={selected ? "#c5f5ea" : hasLed ? "#ffe0ea" : "#e8f7fc"}
              transparent
              opacity={0.6}
              roughness={0.25}
              metalness={0}
              emissive={hasLed ? "#ff2e6a" : "#000000"}
              emissiveIntensity={hasLed ? 0.6 : 0}
              depthWrite={false}
              clippingPlanes={clippingPlanes}
              clipShadows={clippingPlanes.length > 0}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

type JetBubbleSeed = {
  phase: number;
  radius: number;
  speed: number;
  spreadX: number;
  spreadY: number;
};

/**
 * Wall spa jet: aerated stream shooting into the vessel along local +Z,
 * with bubbles that spread and rise as they dissipate.
 */
function SpaJetStream({ selected }: { selected: boolean }) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const dropsRef = useRef<THREE.Group>(null);
  const streamRef = useRef<THREE.Mesh>(null);
  const streamMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const mistRef = useRef<THREE.Mesh>(null);
  const mistMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const nozzleZ = 0.048;
  const streamLen = 0.32;

  const bubbles = useMemo<JetBubbleSeed[]>(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        phase: (i * 0.618) % 1,
        radius: 0.0055 + (i % 4) * 0.0022,
        speed: 0.85 + (i % 6) * 0.1,
        spreadX: ((i * 7) % 11) / 11 * 2 - 1,
        spreadY: ((i * 13) % 11) / 11 * 2 - 1,
      })),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const g = dropsRef.current;
    if (g) {
      for (let i = 0; i < bubbles.length; i++) {
        const child = g.children[i];
        const d = bubbles[i];
        if (!d || !(child instanceof THREE.Mesh)) continue;

        const cycle = (t * d.speed * 0.75 + d.phase) % 1;
        // Fast near the nozzle, ease out as the jet dissipates.
        const u = 1 - (1 - cycle) * (1 - cycle);
        const z = nozzleZ + u * streamLen;
        const spread = 0.006 + u * 0.06;
        // Buoyancy: bubbles climb as they travel into the spa.
        const rise = u * u * 0.055;
        const wobble = Math.sin(t * 13 + d.phase * 18) * 0.0035 * (0.4 + u);

        child.position.set(
          d.spreadX * spread + wobble,
          d.spreadY * spread * 0.65 + rise,
          z,
        );

        const fade =
          cycle < 0.05
            ? cycle / 0.05
            : cycle > 0.72
              ? Math.max(0, 1 - (cycle - 0.72) / 0.28)
              : 1;
        child.scale.setScalar((0.95 + u * 1.1) * fade);
        const mat = child.material as THREE.MeshStandardMaterial;
        mat.opacity = 0.62 * fade * (1 - u * 0.4);
      }
    }

    if (streamRef.current && streamMatRef.current) {
      const pulse = 0.88 + Math.sin(t * 12) * 0.12;
      streamRef.current.scale.set(pulse, 1, pulse);
      streamMatRef.current.opacity = 0.2 + Math.sin(t * 10) * 0.045;
    }
    if (mistRef.current && mistMatRef.current) {
      const boil = 0.9 + Math.sin(t * 9 + 1.2) * 0.12;
      mistRef.current.scale.set(boil, boil, 1);
      mistMatRef.current.opacity = 0.14 + Math.sin(t * 8) * 0.04;
    }
  });

  return (
    <group>
      {/* Soft translucent jet body along +Z */}
      <mesh
        ref={streamRef}
        position={[0, 0.008, nozzleZ + streamLen * 0.42]}
        rotation={[Math.PI / 2, 0, 0]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.038, 0.011, streamLen * 0.85, 14, 1, true]} />
        <meshStandardMaterial
          ref={streamMatRef}
          color={selected ? "#a8ebe0" : "#9ad4e8"}
          transparent
          opacity={0.22}
          roughness={0.18}
          metalness={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          clippingPlanes={clippingPlanes}
          clipShadows={clippingPlanes.length > 0}
        />
      </mesh>

      {/* Wider mist veil a bit further out */}
      <mesh
        ref={mistRef}
        position={[0, 0.02, nozzleZ + streamLen * 0.62]}
        rotation={[Math.PI / 2, 0, 0]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.055, 0.022, streamLen * 0.45, 14, 1, true]} />
        <meshStandardMaterial
          ref={mistMatRef}
          color={selected ? "#c5f5ea" : "#c8eef8"}
          transparent
          opacity={0.14}
          roughness={0.35}
          metalness={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          clippingPlanes={clippingPlanes}
          clipShadows={clippingPlanes.length > 0}
        />
      </mesh>

      <group ref={dropsRef}>
        {bubbles.map((d, i) => (
          <mesh key={i} frustumCulled={false}>
            <sphereGeometry args={[d.radius, 7, 7]} />
            <meshStandardMaterial
              color={selected ? "#c5f5ea" : "#e8f7fc"}
              transparent
              opacity={0.6}
              roughness={0.22}
              metalness={0}
              depthWrite={false}
              clippingPlanes={clippingPlanes}
              clipShadows={clippingPlanes.length > 0}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Animated fire-pit glow — soft cones + point fill for night drama. */
function FireGlow({
  radius,
  baseY,
  height,
  selected,
}: {
  radius: number;
  baseY: number;
  height: number;
  selected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tod = useTimeOfDay();
  const boost = ledBoostForTimeOfDay(tod);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.children.forEach((child, i) => {
      if (!(child instanceof THREE.Mesh)) return;
      const flicker = 0.85 + Math.sin(t * (9 + i * 2.3) + i) * 0.15;
      const stretch = 0.9 + Math.sin(t * (7 + i * 1.7) + i * 0.6) * 0.18;
      child.scale.set(flicker, stretch, flicker);
      const mat = child.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (0.55 + flicker * 0.55) * (0.7 + boost * 0.35);
      mat.opacity = 0.45 + flicker * 0.35;
    });
  });

  return (
    <group ref={groupRef} position={[0, baseY, 0]}>
      <mesh position={[0, height * 0.2, 0]}>
        <coneGeometry args={[radius, height * 0.7, 10, 1, true]} />
        <meshStandardMaterial
          color="#ff9a3c"
          emissive="#ff6b1a"
          emissiveIntensity={0.9}
          transparent
          opacity={0.65}
          depthWrite={false}
          roughness={0.4}
          metalness={0}
        />
      </mesh>
      <mesh position={[radius * 0.15, height * 0.35, -radius * 0.1]}>
        <coneGeometry args={[radius * 0.55, height * 0.55, 8, 1, true]} />
        <meshStandardMaterial
          color="#ffcc66"
          emissive="#ffaa33"
          emissiveIntensity={1.1}
          transparent
          opacity={0.55}
          depthWrite={false}
          roughness={0.35}
          metalness={0}
        />
      </mesh>
      <mesh position={[-radius * 0.12, height * 0.28, radius * 0.08]}>
        <coneGeometry args={[radius * 0.4, height * 0.45, 8, 1, true]} />
        <meshStandardMaterial
          color="#ffe0a0"
          emissive="#ffd080"
          emissiveIntensity={1.2}
          transparent
          opacity={0.5}
          depthWrite={false}
          roughness={0.3}
          metalness={0}
        />
      </mesh>
      <pointLight
        position={[0, height * 0.25, 0]}
        color="#ff8a3a"
        intensity={0.9 * boost}
        distance={Math.max(3.5, radius * 14)}
        decay={2}
      />
      {selected ? (
        <mesh position={[0, height * 0.15, 0]}>
          <sphereGeometry args={[radius * 0.9, 12, 10]} />
          <meshBasicMaterial color="#1f8a70" transparent opacity={0.12} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Wall niche pool/spa light — faces local +Z into the vessel. */
function PoolNicheLight({
  groupProps,
  selected,
  colorChanging,
}: {
  groupProps: {
    position: [number, number, number];
    rotation: [number, number, number];
  } & Record<string, unknown>;
  selected: boolean;
  colorChanging: boolean;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const timeOfDay = useTimeOfDay();
  const ledBoost = ledBoostForTimeOfDay(timeOfDay);
  const lensMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const glowMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const wideSpotRef = useRef<THREE.SpotLight>(null);
  const spotTargetRef = useRef<THREE.Object3D>(null);
  const wideTargetRef = useRef<THREE.Object3D>(null);
  const ledColor = useMemo(() => new THREE.Color("#ffe9a8"), []);
  const r = 0.07;
  const night = isNightTime(timeOfDay);
  // Spots only — no point lights (those are omni and wash the house).
  const beamDist = night ? 13 : 9;
  const spotIntensity = (night ? 24 : 13) * ledBoost;
  const wideSpotIntensity = (night ? 9 : 5) * ledBoost;

  // Target must be a sibling (not a child of the SpotLight) or aiming breaks.
  useLayoutEffect(() => {
    if (spotRef.current && spotTargetRef.current) {
      spotRef.current.target = spotTargetRef.current;
    }
    if (wideSpotRef.current && wideTargetRef.current) {
      wideSpotRef.current.target = wideTargetRef.current;
    }
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (colorChanging) {
      const hue = (t / 10) % 1;
      ledColor.setHSL(hue, 1, 0.58);
    } else {
      ledColor.set("#ffe9a8");
    }
    if (lensMatRef.current) {
      lensMatRef.current.color.copy(ledColor);
      lensMatRef.current.emissive.copy(ledColor);
      lensMatRef.current.emissiveIntensity =
        (1.25 + Math.sin(t * 3.5) * 0.15 + (selected ? 0.2 : 0)) * ledBoost;
    }
    if (glowMatRef.current) {
      glowMatRef.current.color.copy(ledColor);
      glowMatRef.current.emissive.copy(ledColor);
      glowMatRef.current.emissiveIntensity =
        (0.85 + Math.sin(t * 2.8) * 0.1) * ledBoost;
      glowMatRef.current.opacity = 0.28 + Math.sin(t * 2.8) * 0.04;
    }
    const pulse = 1 + Math.sin(t * 3) * 0.04;
    if (spotRef.current) {
      spotRef.current.color.copy(ledColor);
      spotRef.current.intensity = spotIntensity * pulse;
      spotRef.current.target.updateMatrixWorld();
    }
    if (wideSpotRef.current) {
      wideSpotRef.current.color.copy(ledColor);
      wideSpotRef.current.intensity = wideSpotIntensity * pulse;
      wideSpotRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <group {...groupProps}>
      {/*
        Aim targets are siblings in this group at +Z (into the pool).
        Lights sit slightly into the water so the cone never opens toward the house.
      */}
      <object3D ref={spotTargetRef} position={[0, 0, 10]} />
      <object3D ref={wideTargetRef} position={[0, 0, 9]} />
      <spotLight
        ref={spotRef}
        color={colorChanging ? "#ff2e6a" : "#ffe9a8"}
        intensity={spotIntensity}
        distance={beamDist}
        decay={1.55}
        angle={Math.PI / 3.4}
        penumbra={0.4}
        position={[0, 0, 0.25]}
      />
      <spotLight
        ref={wideSpotRef}
        color={colorChanging ? "#ff2e6a" : "#ffe9a8"}
        intensity={wideSpotIntensity}
        distance={beamDist * 0.8}
        decay={1.6}
        angle={Math.PI / 2.6}
        penumbra={0.6}
        position={[0, 0, 0.32]}
      />
      {/* Niche ring flush to wall */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.02]} castShadow>
        <cylinderGeometry args={[r, r * 1.05, 0.03, 28]} />
        <Mat color="#3d454c" metalness={0.55} roughness={0.35} selected={selected} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.01]}>
        <cylinderGeometry args={[r * 0.82, r * 0.82, 0.02, 28]} />
        <Mat color="#6a727a" metalness={0.65} roughness={0.3} selected={selected} />
      </mesh>
      {/* Lit lens facing into the pool (circleGeometry already faces +Z). */}
      <mesh position={[0, 0, 0.004]}>
        <circleGeometry args={[r * 0.68, 28]} />
        <meshStandardMaterial
          ref={lensMatRef}
          color="#ffe9a8"
          emissive="#ffd56a"
          emissiveIntensity={1.25}
          roughness={0.2}
          metalness={0.05}
          clippingPlanes={clippingPlanes}
          clipShadows={clippingPlanes.length > 0}
        />
      </mesh>
      {/* Soft glow volume just in front of the lens (emissive mesh, not a light) */}
      <mesh position={[0, 0, 0.09]} frustumCulled={false}>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshStandardMaterial
          ref={glowMatRef}
          color="#ffe9a8"
          emissive="#ffd56a"
          emissiveIntensity={0.85}
          transparent
          opacity={0.26}
          depthWrite={false}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
    </group>
  );
}

function CoverFanMesh({
  sx,
  sy,
  sz,
  selected,
  groupProps,
  frame,
}: {
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  groupProps: {
    position: [number, number, number];
    rotation: [number, number, number];
  } & Record<string, unknown>;
  frame?: { color?: CanvasTexture; roughness?: CanvasTexture };
}) {
  const bladesRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (bladesRef.current) bladesRef.current.rotation.y += dt * 1.8;
  });
  const span = Math.min(sx, sz);
  const motorR = Math.max(0.06, span * 0.075);
  return (
    <group {...groupProps}>
      <mesh position={[0, sy * 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, sy * 0.22, 8]} />
        <Mat
          color="#4a5058"
          metalness={0.5}
          roughness={0.32}
          selected={selected}
        />
      </mesh>
      <mesh position={[0, sy * 0.12, 0]} castShadow>
        <cylinderGeometry args={[motorR, motorR * 0.9, sy * 0.28, 18]} />
        <Mat
          map={frame?.color}
          roughnessMap={frame?.roughness}
          roughness={0.45}
          selected={selected}
        />
      </mesh>
      <group ref={bladesRef} position={[0, sy * 0.02, 0]}>
        {Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(a) * span * 0.22,
                0,
                Math.sin(a) * span * 0.22,
              ]}
              rotation={[-0.1, -a, 0.08]}
              castShadow
            >
              <boxGeometry args={[span * 0.4, 0.012, span * 0.1]} />
              <Mat
                map={frame?.color}
                roughnessMap={frame?.roughness}
                roughness={0.5}
                selected={selected}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function CoverLightMesh({
  sx,
  sy,
  sz,
  selected,
  groupProps,
}: {
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  groupProps: {
    position: [number, number, number];
    rotation: [number, number, number];
  } & Record<string, unknown>;
}) {
  const timeOfDay = useTimeOfDay();
  const night = isNightTime(timeOfDay);
  const boost = ledBoostForTimeOfDay(timeOfDay);
  const r = Math.min(sx, sz);
  const lightRef = useRef<THREE.PointLight>(null);
  // Omni wash under the roof. Cube-map shadows (and the opaque cover slab)
  // keep the beam from punching through onto the second story.
  const intensity = (night ? 11 : 0) * boost;

  useLayoutEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    const cam = light.shadow.camera;
    // Fixture hangs ~0.23 m below the soffit. If near ≥ that, the roof is
    // clipped out of the cube map and light leaks onto the second story.
    cam.near = 0.05;
    cam.far = 12;
    cam.updateProjectionMatrix();
    light.shadow.bias = -0.002;
    light.shadow.normalBias = 0.035;
    light.shadow.radius = 2;
  });

  return (
    <group {...groupProps}>
      <mesh position={[0, sy * 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, sy * 0.16, 8]} />
        <Mat
          color="#3a3a40"
          metalness={0.45}
          roughness={0.35}
          selected={selected}
        />
      </mesh>
      <mesh position={[0, sy * 0.3, 0]} castShadow>
        <cylinderGeometry args={[r * 0.42, r * 0.36, sy * 0.12, 16]} />
        <Mat
          color="#2a2a30"
          metalness={0.35}
          roughness={0.4}
          selected={selected}
        />
      </mesh>
      <mesh
        position={[0, sy * 0.36, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
      >
        <circleGeometry args={[r * 0.44, 16]} />
        <Mat
          color="#1a1a20"
          metalness={0.25}
          roughness={0.55}
          selected={selected}
        />
      </mesh>
      <mesh position={[0, -sy * 0.04, 0]}>
        <cylinderGeometry args={[r * 0.28, r * 0.24, sy * 0.48, 16]} />
        <Mat
          color="#f4e4b8"
          roughness={0.35}
          opacity={0.82}
          selected={selected}
          emissive="#ffe9a8"
          emissiveIntensity={night ? 0.7 * boost : 0.12}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color="#ffe9a8"
        intensity={intensity}
        distance={9}
        decay={2}
        position={[0, -sy * 0.04, 0]}
        castShadow={night}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
    </group>
  );
}

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

function mergeGeoms(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const g of parts) {
    const p = g.getAttribute("position");
    const base = pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
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
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}

function flowerGeometry(shape: ReturnType<typeof vineBloomShape>): THREE.BufferGeometry {
  if (shape === "bract") {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.ConeGeometry(0.028, 0.052, 4);
      c.rotateX(Math.PI / 2);
      c.translate(0, 0, 0.018);
      c.rotateY((i * Math.PI * 2) / 3);
      c.rotateX(-0.5);
      parts.push(c);
    }
    return mergeGeoms(parts);
  }
  if (shape === "star") {
    const petal = new THREE.ConeGeometry(0.03, 0.012, 5);
    petal.rotateX(Math.PI);
    const bud = new THREE.SphereGeometry(0.008, 6, 4);
    bud.translate(0, 0.006, 0);
    return mergeGeoms([petal, bud]);
  }
  if (shape === "trumpet") {
    const bell = new THREE.ConeGeometry(0.026, 0.05, 6);
    bell.rotateX(Math.PI / 2);
    bell.translate(0, 0, 0.02);
    const tube = new THREE.CylinderGeometry(0.006, 0.009, 0.028, 6);
    tube.rotateX(Math.PI / 2);
    tube.translate(0, 0, -0.012);
    return mergeGeoms([bell, tube]);
  }
  if (shape === "passion") {
    const disc = new THREE.CylinderGeometry(0.03, 0.03, 0.004, 12);
    const rim = new THREE.TorusGeometry(0.02, 0.004, 5, 12);
    rim.rotateX(Math.PI / 2);
    const rays: THREE.BufferGeometry[] = [disc, rim];
    for (let i = 0; i < 5; i++) {
      const ray = new THREE.BoxGeometry(0.004, 0.028, 0.003);
      ray.translate(0, 0.02, 0);
      ray.rotateZ((i * Math.PI * 2) / 5);
      rays.push(ray);
    }
    return mergeGeoms(rays);
  }
  if (shape === "saucer") {
    const g = new THREE.SphereGeometry(
      0.032,
      8,
      6,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    g.scale(1, 0.35, 1);
    return g;
  }
  const parts: THREE.BufferGeometry[] = [];
  const offs = [
    [0, 0, 0],
    [0.018, 0.006, 0.008],
    [-0.014, 0.008, -0.006],
    [0.004, -0.01, 0.012],
  ];
  for (const o of offs) {
    const s = new THREE.SphereGeometry(0.012, 6, 5);
    s.translate(o[0], o[1], o[2]);
    parts.push(s);
  }
  return mergeGeoms(parts);
}

function TrellisFoliage({
  width,
  height,
  depth,
  centerZ,
  vineId,
  selected,
}: {
  width: number;
  height: number;
  depth: number;
  centerZ: number;
  vineId?: string;
  selected: boolean;
}) {
  const vine = getFloridaVine(vineId);
  const bloom = vineBloomShape(vine);
  const leafN = Math.max(
    48,
    Math.round(170 * vine.leafDensity * Math.max(0.4, width)),
  );
  const flowerN =
    bloom === "none"
      ? 0
      : Math.max(18, Math.round(64 * vine.flowerSize * Math.max(0.4, width)));
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const flowerRef = useRef<THREE.InstancedMesh>(null);
  const leafGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.046, 7, 5);
    g.scale(1, 0.22, 0.62);
    return g;
  }, []);
  const flowerGeo = useMemo(
    () => (bloom === "none" ? null : flowerGeometry(bloom)),
    [bloom],
  );
  const stems = useMemo(() => {
    const n = 6;
    const phase = (hashStr(vine.id) % 50) / 8;
    const paths: Array<Array<[number, number, number]>> = [];
    for (let i = 0; i < n; i++) {
      const pts: Array<[number, number, number]> = [];
      const x0 = ((i + 0.5) / n - 0.5) * width * 0.82;
      const steps = 8;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        pts.push([
          x0 + Math.sin(t * 5.2 + i * 1.1 + phase) * width * 0.07,
          -height * 0.5 + t * height,
          centerZ + Math.sin(t * 3.4 + i * 0.8 + phase) * depth * 0.55,
        ]);
      }
      paths.push(pts);
    }
    return { paths };
  }, [centerZ, depth, height, vine.id, width]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const rng = mulberry32(hashStr(vine.id) ^ Math.round(width * 100));
    const yMin = -height * 0.5 + 0.03;
    const ySpan = Math.max(0.08, height - 0.06);
    const place = (
      mesh: THREE.InstancedMesh | null,
      n: number,
      scale: number,
      leaf: boolean,
    ) => {
      if (!mesh || n <= 0) return;
      for (let i = 0; i < n; i++) {
        dummy.position.set(
          (rng() - 0.5) * width * 0.9,
          yMin + rng() * ySpan,
          centerZ + (rng() - 0.5) * depth,
        );
        dummy.rotation.set(
          (rng() - 0.5) * (leaf ? 1.4 : 0.9),
          rng() * Math.PI * 2,
          (rng() - 0.5) * 0.8,
        );
        const s = scale * (0.7 + rng() * 0.65);
        dummy.scale.set(s, leaf ? s : s, s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(leafRef.current, leafN, 1, true);
    place(flowerRef.current, flowerN, Math.max(0.85, vine.flowerSize), false);
  }, [
    centerZ,
    depth,
    flowerN,
    height,
    leafN,
    vine.flowerSize,
    vine.id,
    width,
  ]);

  const stemColor = vineCssColor({
    r: Math.max(20, vine.foliage.r - 18),
    g: Math.max(28, vine.foliage.g - 22),
    b: Math.max(16, vine.foliage.b - 16),
  });

  return (
    <group>
      {stems.paths.flatMap((path, pi) =>
        path.slice(0, -1).map((a, k) => {
          const b = path[k + 1]!;
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const dz = b[2] - a[2];
          const len = Math.hypot(dx, dy, dz);
          if (len < 1e-4) return null;
          const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(dx / len, dy / len, dz / len),
          );
          const r = 0.007 + (1 - k / path.length) * 0.006;
          return (
            <mesh
              key={`stem-${pi}-${k}`}
              position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]}
              quaternion={quat}
            >
              <cylinderGeometry args={[r * 0.82, r, len, 5]} />
              <Mat color={stemColor} roughness={0.92} selected={selected} />
            </mesh>
          );
        }),
      )}
      <instancedMesh
        ref={leafRef}
        args={[leafGeo, undefined, leafN]}
        castShadow
      >
        <Mat color={vineCssColor(vine.foliage)} roughness={0.9} selected={selected} />
      </instancedMesh>
      {flowerN > 0 && flowerGeo ? (
        <instancedMesh
          ref={flowerRef}
          args={[flowerGeo, undefined, flowerN]}
          castShadow
        >
          <Mat
            color={vineCssColor(vine.flower)}
            roughness={0.62}
            selected={selected}
          />
        </instancedMesh>
      ) : null}
    </group>
  );
}

function LatticePanel({
  width,
  height,
  z,
  selected,
  frame,
}: {
  width: number;
  height: number;
  z: number;
  selected: boolean;
  frame?: { color?: THREE.CanvasTexture; roughness?: THREE.CanvasTexture };
}) {
  const post = Math.min(0.07, width * 0.06);
  const rail = 0.028;
  const halfW = width / 2;
  const cols = 5;
  const rows = 6;
  const Wood = () => (
    <Mat
      map={frame?.color}
      roughnessMap={frame?.roughness}
      color={frame?.color ? "#ffffff" : "#c4a06a"}
      roughness={0.82}
      selected={selected}
    />
  );
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((side) => (
        <mesh
          key={`post-${side}`}
          position={[side * (halfW - post * 0.5), 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[post, height, post]} />
          <Wood />
        </mesh>
      ))}
      <mesh position={[0, height / 2 - rail * 0.5, 0]} castShadow>
        <boxGeometry args={[width - post * 0.2, rail, post * 0.7]} />
        <Wood />
      </mesh>
      <mesh position={[0, -height / 2 + rail * 0.5, 0]} castShadow>
        <boxGeometry args={[width - post * 0.2, rail, post * 0.7]} />
        <Wood />
      </mesh>
      {Array.from({ length: cols }, (_, i) => {
        const t = (i + 1) / (cols + 1);
        const x = -halfW + t * width;
        return (
          <mesh key={`v-${i}`} position={[x, 0, 0]} castShadow>
            <boxGeometry args={[rail * 0.55, height - rail * 2, rail * 0.45]} />
            <Wood />
          </mesh>
        );
      })}
      {Array.from({ length: rows }, (_, i) => {
        const t = (i + 1) / (rows + 1);
        const y = -height / 2 + t * height;
        return (
          <mesh key={`h-${i}`} position={[0, y, 0]} castShadow>
            <boxGeometry args={[width - post * 1.6, rail * 0.5, rail * 0.4]} />
            <Wood />
          </mesh>
        );
      })}
    </group>
  );
}

function TrellisMesh({
  catalogId,
  sx,
  sy,
  sz,
  selected,
  vineId,
  frame,
  groupProps,
}: {
  catalogId: string;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  vineId?: string;
  frame?: { color?: THREE.CanvasTexture; roughness?: THREE.CanvasTexture };
  groupProps: Record<string, unknown>;
}) {
  const arbor = catalogId === "trellis_arbor";
  const panelW = arbor ? sx * 0.92 : sx;
  const panelH = sy;
  const sideZ = arbor ? sz * 0.42 : 0;
  return (
    <group {...groupProps}>
      <LatticePanel
        width={panelW}
        height={panelH}
        z={arbor ? -sideZ : 0}
        selected={selected}
        frame={frame}
      />
      {arbor ? (
        <>
          <LatticePanel
            width={panelW}
            height={panelH}
            z={sideZ}
            selected={selected}
            frame={frame}
          />
          {[-0.32, 0, 0.32].map((t) => (
            <mesh
              key={`rafter-${t}`}
              position={[t * panelW, sy * 0.48, 0]}
              castShadow
            >
              <boxGeometry args={[0.06, 0.05, sz * 0.92]} />
              <Mat
                map={frame?.color}
                roughnessMap={frame?.roughness}
                color={frame?.color ? "#ffffff" : "#c4a06a"}
                roughness={0.82}
                selected={selected}
              />
            </mesh>
          ))}
        </>
      ) : null}
      <TrellisFoliage
        width={panelW}
        height={panelH}
        depth={arbor ? 0.1 : Math.max(0.08, sz * 0.7)}
        centerZ={arbor ? -sideZ : 0}
        vineId={vineId}
        selected={selected}
      />
      {arbor ? (
        <TrellisFoliage
          width={panelW}
          height={panelH}
          depth={0.1}
          centerZ={sideZ}
          vineId={vineId}
          selected={selected}
        />
      ) : null}
    </group>
  );
}

function cloneFurnRepeat(
  pair: FurnTexPair | null | undefined,
  rx: number,
  ry: number,
): FurnTexPair | null {
  if (!pair) return null;
  const color = pair.color.clone();
  const roughness = pair.roughness.clone();
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  color.repeat.set(rx, ry);
  roughness.repeat.set(rx, ry);
  color.needsUpdate = true;
  roughness.needsUpdate = true;
  return { color, roughness };
}

function WoodMat({
  frame,
  selected,
  roughness = 0.5,
}: {
  frame?: FurnTexPair | null;
  selected: boolean;
  roughness?: number;
}) {
  return (
    <Mat
      map={frame?.color}
      roughnessMap={frame?.roughness}
      color={frame?.color ? "#ffffff" : "#c4a06a"}
      roughness={roughness}
      selected={selected}
    />
  );
}

function FabricMat({
  fabric,
  selected,
  roughness = 0.88,
}: {
  fabric?: FurnTexPair | null;
  selected: boolean;
  roughness?: number;
}) {
  return (
    <Mat
      map={fabric?.color}
      roughnessMap={fabric?.roughness}
      bumpMap={fabric?.roughness}
      bumpScale={fabric ? 0.55 : 0}
      color={fabric?.color ? "#ffffff" : "#5c6e62"}
      roughness={roughness}
      selected={selected}
    />
  );
}

function DiningChairMesh({
  yBottom,
  seatH,
  w,
  d,
  backH,
  frame,
  fabric,
  selected,
}: {
  yBottom: number;
  seatH: number;
  w: number;
  d: number;
  backH: number;
  frame?: FurnTexPair | null;
  fabric?: FurnTexPair | null;
  selected: boolean;
}) {
  const y0 = yBottom;
  const seatY = y0 + seatH;
  const insetX = w * 0.37;
  const frontZ = d * 0.34;
  const rearZ = -d * 0.38;
  const cushionH = 0.05;
  const woodSeatT = 0.022;
  const slatSpan = w * 0.7;

  return (
    <group>
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`fl-${side}`}
          position={[side * insetX, y0 + seatH * 0.48, frontZ]}
          castShadow
        >
          <cylinderGeometry args={[0.013, 0.017, seatH * 0.96, 10]} />
          <WoodMat frame={frame} selected={selected} />
        </mesh>
      ))}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`rl-${side}`}
          position={[side * insetX, y0 + (seatH + backH) * 0.5, rearZ]}
          castShadow
        >
          <cylinderGeometry args={[0.014, 0.017, seatH + backH, 10]} />
          <WoodMat frame={frame} selected={selected} />
        </mesh>
      ))}
      <mesh
        position={[0, y0 + 0.1, frontZ]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.007, 0.007, insetX * 2, 8]} />
        <WoodMat frame={frame} selected={selected} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`st-${side}`}
          position={[side * insetX, y0 + 0.1, (frontZ + rearZ) / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry
            args={[0.007, 0.007, Math.abs(frontZ - rearZ), 8]}
          />
          <WoodMat frame={frame} selected={selected} />
        </mesh>
      ))}
      <mesh
        position={[0, seatY - woodSeatT / 2, (frontZ + rearZ) * 0.12]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w * 0.78, woodSeatT, d * 0.72]} />
        <WoodMat frame={frame} selected={selected} roughness={0.48} />
      </mesh>
      <mesh position={[0, seatY - 0.04, frontZ - 0.008]} castShadow>
        <boxGeometry args={[w * 0.72, 0.038, 0.016]} />
        <WoodMat frame={frame} selected={selected} />
      </mesh>
      <RoundedBox
        args={[w * 0.88, cushionH, d * 0.7]}
        radius={Math.min(0.022, cushionH * 0.42)}
        smoothness={4}
        position={[0, seatY + cushionH * 0.42, d * 0.02]}
        castShadow
        receiveShadow
      >
        <FabricMat fabric={fabric} selected={selected} />
      </RoundedBox>
      {[0.22, 0.42, 0.62, 0.82].map((t) => (
        <mesh
          key={`slat-${t}`}
          position={[0, seatY + backH * t, rearZ + 0.012]}
          castShadow
        >
          <boxGeometry args={[slatSpan, 0.028, 0.012]} />
          <WoodMat frame={frame} selected={selected} />
        </mesh>
      ))}
      <mesh position={[0, seatY + backH * 0.96, rearZ + 0.01]} castShadow>
        <boxGeometry args={[w * 0.74, 0.032, 0.022]} />
        <WoodMat frame={frame} selected={selected} />
      </mesh>
      <group
        position={[0, seatY + backH * 0.42, rearZ + 0.045]}
        rotation={[0.12, 0, 0]}
      >
        <RoundedBox
          args={[w * 0.72, backH * 0.72, 0.04]}
          radius={0.016}
          smoothness={4}
          castShadow
        >
          <FabricMat fabric={fabric} selected={selected} />
        </RoundedBox>
      </group>
    </group>
  );
}

function DiningSetMesh({
  catalogId,
  sx,
  sy,
  sz,
  selected,
  groupProps,
  frame,
  fabric,
}: {
  catalogId: string;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  groupProps: Record<string, unknown>;
  frame?: FurnTexPair | null;
  fabric?: FurnTexPair | null;
}) {
  const chairFabric = useMemo(
    () => cloneFurnRepeat(fabric, 2.4, 2.4),
    [fabric],
  );
  const shape = diningTableShape(catalogId);
  const tableW = shape === "round" ? Math.max(sx, sz) : sx;
  const tableD = shape === "round" ? Math.max(sx, sz) : sz;
  const clearM = DINING_CHAIR_CLEARANCE_MM / 1000;
  const topT = Math.max(0.04, sy * 0.07);
  const topY = sy * 0.28;
  const legH = sy * 0.55;
  const chairSeatH = sy * 0.38;
  const chairW = Math.min(0.48, clearM * 0.85);
  const chairD = Math.min(0.5, clearM * 0.9);
  const backH = sy * 0.32;
  const chairSlots = diningChairSlotsMm(shape, tableW * 1000, tableD * 1000).map(
    (s) => ({
      x: s.xMm / 1000,
      z: s.yMm / 1000,
      yaw: s.yawRad,
    }),
  );

  return (
    <group {...groupProps}>
      {shape === "round" ? (
        <mesh position={[0, topY, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[tableW / 2, tableW / 2, topT, 32]} />
          <WoodMat frame={frame} selected={selected} roughness={0.45} />
        </mesh>
      ) : (
        <mesh position={[0, topY, 0]} castShadow receiveShadow>
          <boxGeometry args={[tableW, topT, tableD]} />
          <WoodMat frame={frame} selected={selected} roughness={0.45} />
        </mesh>
      )}
      {shape === "round" ? (
        <>
          <mesh position={[0, topY - legH / 2 - topT / 2, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.07, legH, 14]} />
            <WoodMat frame={frame} selected={selected} />
          </mesh>
          <mesh
            position={[0, topY - legH - topT / 2, 0]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[tableW * 0.22, tableW * 0.26, 0.04, 20]} />
            <WoodMat frame={frame} selected={selected} />
          </mesh>
        </>
      ) : (
        (
          [
            [-tableW * 0.4, -tableD * 0.38],
            [tableW * 0.4, -tableD * 0.38],
            [-tableW * 0.4, tableD * 0.38],
            [tableW * 0.4, tableD * 0.38],
          ] as const
        ).map(([lx, lz], i) => (
          <mesh
            key={`leg-${i}`}
            position={[lx, topY - legH / 2 - topT / 2, lz]}
            castShadow
          >
            <boxGeometry args={[0.06, legH, 0.06]} />
            <WoodMat frame={frame} selected={selected} />
          </mesh>
        ))
      )}
      {chairSlots.map((c, i) => (
        <group
          key={`chair-${i}`}
          position={[c.x, 0, c.z]}
          rotation={[0, c.yaw, 0]}
        >
          <DiningChairMesh
            yBottom={-sy * 0.5}
            seatH={chairSeatH}
            w={chairW}
            d={chairD}
            backH={backH}
            frame={frame}
            fabric={chairFabric}
            selected={selected}
          />
        </group>
      ))}
    </group>
  );
}

/** In-pool tanning-ledge chaise: one-piece molded resin, not a deck lounge. */
function SunshelfChaiseMesh({
  sx,
  sy,
  sz,
  selected,
  color,
  groupProps,
}: {
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  color: string;
  groupProps: Record<string, unknown>;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  const { body, arms } = useMemo(() => {
    const L = Math.max(0.9, sz * 0.98);
    const H = Math.max(0.28, sy * 0.96);
    const bodyW = Math.max(0.32, sx * 0.72);
    const y0 = -sy * 0.5 + 0.01;
    const topPts = [
      new THREE.Vector2(0, y0 + 0.048),
      new THREE.Vector2(L * 0.1, y0 + 0.04),
      new THREE.Vector2(L * 0.26, y0 + 0.055),
      new THREE.Vector2(L * 0.42, y0 + 0.07),
      new THREE.Vector2(L * 0.52, y0 + 0.062),
      new THREE.Vector2(L * 0.62, y0 + 0.1),
      new THREE.Vector2(L * 0.72, y0 + 0.2),
      new THREE.Vector2(L * 0.82, y0 + H * 0.55),
      new THREE.Vector2(L * 0.9, y0 + H * 0.82),
      new THREE.Vector2(L * 0.96, y0 + H * 0.94),
      new THREE.Vector2(L * 0.995, y0 + H * 0.78),
      new THREE.Vector2(L, y0 + H * 0.58),
    ];
    const botPts = [
      new THREE.Vector2(L * 0.97, y0 + H * 0.42),
      new THREE.Vector2(L * 0.88, y0 + 0.08),
      new THREE.Vector2(L * 0.72, y0 + 0.018),
      new THREE.Vector2(L * 0.2, y0 + 0.016),
      new THREE.Vector2(L * 0.04, y0 + 0.022),
      new THREE.Vector2(0.01, y0 + 0.028),
    ];
    const top = new THREE.SplineCurve(topPts).getPoints(40);
    const bot = new THREE.SplineCurve(botPts).getPoints(18);
    const shape = new THREE.Shape();
    shape.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < top.length; i++) shape.lineTo(top[i].x, top[i].y);
    for (const p of bot) shape.lineTo(p.x, p.y);
    shape.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(shape, {
      depth: bodyW,
      bevelEnabled: true,
      bevelThickness: Math.min(0.032, bodyW * 0.08),
      bevelSize: Math.min(0.028, bodyW * 0.07),
      bevelSegments: 3,
      curveSegments: 8,
    });
    bodyGeo.rotateY(Math.PI / 2);
    bodyGeo.translate(-bodyW / 2, 0, L / 2);
    bodyGeo.computeVertexNormals();

    const armR = Math.min(0.03, sx * 0.045);
    const armX = sx * 0.38;
    const makeArm = (side: number) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * armX * 0.92, y0 + 0.07, L * 0.18),
        new THREE.Vector3(side * armX, y0 + 0.1, L * 0.02),
        new THREE.Vector3(side * armX * 1.02, y0 + 0.16, -L * 0.12),
        new THREE.Vector3(side * armX * 0.95, y0 + H * 0.42, -L * 0.28),
        new THREE.Vector3(side * armX * 0.7, y0 + H * 0.55, -L * 0.38),
      ]);
      return new THREE.TubeGeometry(curve, 24, armR, 10, false);
    };
    return { body: bodyGeo, arms: [makeArm(-1), makeArm(1)] };
  }, [sx, sy, sz]);

  useLayoutEffect(
    () => () => {
      body.dispose();
      arms.forEach((g) => g.dispose());
    },
    [body, arms],
  );

  const resinProps = {
    color,
    roughness: 0.3,
    metalness: 0.03,
    clearcoat: 0.42,
    clearcoatRoughness: 0.38,
    envMapIntensity: 0.85,
    emissive: selected ? "#1f8a70" : "#000000",
    emissiveIntensity: selected ? 0.22 : 0,
    clippingPlanes,
    clipShadows: clippingPlanes.length > 0,
  };

  return (
    <group {...groupProps}>
      <mesh geometry={body} castShadow receiveShadow>
        <meshPhysicalMaterial {...resinProps} />
      </mesh>
      {arms.map((geo, i) => (
        <mesh key={i} geometry={geo} castShadow>
          <meshPhysicalMaterial {...resinProps} />
        </mesh>
      ))}
    </group>
  );
}

function OutdoorSofaMesh({
  sx,
  sy,
  sz,
  selected,
  groupProps,
  frame,
  fabric,
}: {
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  groupProps: Record<string, unknown>;
  frame?: FurnTexPair | null;
  fabric?: FurnTexPair | null;
}) {
  const cushionTex = useMemo(() => cloneFurnRepeat(fabric, 5, 5), [fabric]);
  const y0 = -sy * 0.5;
  const legH = Math.min(0.14, sy * 0.18);
  const deckT = 0.07;
  const seatH = Math.min(0.15, sy * 0.2);
  const nCush = Math.max(2, Math.min(4, Math.round(sx / 0.68)));
  const armW = Math.min(0.14, sx * 0.08);
  const innerW = sx - armW * 2 - 0.04;
  const gap = 0.018;
  const cushW = (innerW - gap * (nCush - 1)) / nCush;
  const seatD = sz * 0.62;
  const deckY = y0 + legH + deckT / 2;
  const seatY = y0 + legH + deckT + seatH / 2;
  const backT = 0.15;
  const backH = sy * 0.52;
  const cushXs = Array.from({ length: nCush }, (_, i) => {
    const start = -innerW / 2 + cushW / 2;
    return start + i * (cushW + gap);
  });
  const cushRadius = Math.min(0.04, seatH * 0.42, cushW * 0.2);

  return (
    <group {...groupProps}>
      {([-1, 1] as const).flatMap((x) =>
        ([-1, 1] as const).map((z) => (
          <mesh
            key={`leg-${x}-${z}`}
            position={[x * (sx * 0.44), y0 + legH / 2, z * (sz * 0.38)]}
            castShadow
          >
            <cylinderGeometry args={[0.028, 0.032, legH, 10]} />
            <WoodMat frame={frame} selected={selected} />
          </mesh>
        )),
      )}
      <mesh position={[0, deckY, sz * 0.02]} castShadow receiveShadow>
        <boxGeometry args={[sx * 0.96, deckT, sz * 0.88]} />
        <WoodMat frame={frame} selected={selected} roughness={0.48} />
      </mesh>
      <mesh position={[0, y0 + legH * 0.55, sz * 0.42]} castShadow>
        <boxGeometry args={[sx * 0.9, legH * 0.55, 0.03]} />
        <WoodMat frame={frame} selected={selected} />
      </mesh>
      {cushXs.map((x, i) => (
        <RoundedBox
          key={`seat-${i}`}
          args={[cushW, seatH, seatD]}
          radius={cushRadius}
          smoothness={4}
          position={[x, seatY, sz * 0.08]}
          castShadow
          receiveShadow
        >
          <FabricMat fabric={cushionTex} selected={selected} />
        </RoundedBox>
      ))}
      <mesh
        position={[0, y0 + legH + deckT + backH * 0.45, -sz * 0.42]}
        castShadow
      >
        <boxGeometry args={[sx * 0.92, backH * 0.85, 0.04]} />
        <WoodMat frame={frame} selected={selected} />
      </mesh>
      {cushXs.map((x, i) => (
        <group
          key={`back-${i}`}
          position={[x, y0 + legH + deckT + seatH + backH * 0.38, -sz * 0.28]}
          rotation={[0.18, 0, 0]}
        >
          <RoundedBox
            args={[cushW * 0.98, backH, backT]}
            radius={Math.min(0.038, cushW * 0.18)}
            smoothness={4}
            castShadow
          >
            <FabricMat fabric={cushionTex} selected={selected} />
          </RoundedBox>
        </group>
      ))}
      {([-1, 1] as const).map((side) => (
        <group key={`arm-${side}`}>
          <mesh
            position={[
              side * (sx * 0.5 - armW * 0.5),
              y0 + legH + deckT + 0.16,
              sz * 0.02,
            ]}
            castShadow
          >
            <boxGeometry args={[armW * 0.7, 0.28, sz * 0.72]} />
            <WoodMat frame={frame} selected={selected} />
          </mesh>
          <RoundedBox
            args={[armW, 0.12, sz * 0.7]}
            radius={Math.min(0.04, armW * 0.4)}
            smoothness={4}
            position={[
              side * (sx * 0.5 - armW * 0.55),
              y0 + legH + deckT + 0.32,
              sz * 0.04,
            ]}
            castShadow
          >
            <FabricMat fabric={cushionTex} selected={selected} />
          </RoundedBox>
        </group>
      ))}
      {([-1, 1] as const).map((side) => {
        const pillowW = 0.1;
        const pillowH = 0.24;
        const pillowD = Math.min(0.34, seatD * 0.72);
        const armInnerX = side * (sx * 0.5 - armW * 0.85);
        return (
          <RoundedBox
            key={`pillow-${side}`}
            args={[pillowW, pillowH, pillowD]}
            radius={0.04}
            smoothness={4}
            position={[
              armInnerX - side * (pillowW * 0.5 + 0.02),
              y0 + legH + deckT + seatH + pillowH * 0.45,
              sz * 0.06,
            ]}
            rotation={[0, 0, -side * 0.06]}
            castShadow
          >
            <FabricMat fabric={cushionTex} selected={selected} />
          </RoundedBox>
        );
      })}
    </group>
  );
}

export function CatalogObjectMesh({ desc, selected, onSelect }: Props) {
  const catalogId = desc.catalogItemId ?? "";
  const { x: sx, y: sy, z: sz } = desc.size;
  const furnTex = useFurnitureTextures(desc);
  const rotationY = useMemo(() => {
    if (desc.axisX) return Math.atan2(-desc.axisX.z, desc.axisX.x);
    return desc.rotationY;
  }, [desc.axisX, desc.rotationY]);

  const handlers = useMemo(() => {
    if (!onSelect || !desc.select) return {};
    return {
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(desc.select ?? null);
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      },
      onPointerOut: () => {
        document.body.style.cursor = "default";
      },
    };
  }, [desc.select, onSelect]);

  const groupProps = {
    position: [desc.position.x, desc.position.y, desc.position.z] as [
      number,
      number,
      number,
    ],
    rotation: [0, rotationY, 0] as [number, number, number],
    ...handlers,
  };

  if (isTrellisId(catalogId)) {
    return (
      <TrellisMesh
        catalogId={catalogId}
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        vineId={desc.vineId}
        frame={furnTex?.frame ?? undefined}
        groupProps={groupProps}
      />
    );
  }

  if (catalogId === "person_scale") {
    return (
      <PersonMesh
        heightM={Math.max(sy, 1.45)}
        sex={resolvePersonSex(desc.personSex)}
        outfitId={resolvePersonOutfitId(desc.personOutfitId)}
        selected={selected}
        groupProps={groupProps}
      />
    );
  }

  if (catalogId === "sunshelf_chaise") {
    const finish = getFurnitureFinish(
      desc.fabricFinishId ?? DEFAULT_FURNITURE_FABRIC_FINISH_ID,
    );
    return (
      <SunshelfChaiseMesh
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        color={furnitureFinishCssColor(finish.color)}
        groupProps={groupProps}
      />
    );
  }

  if (catalogId === "lounge_chair") {
    const frame = furnTex?.frame;
    const fabric = furnTex?.fabric;
    return (
      <group {...groupProps}>
        <mesh position={[0, -sy * 0.15, -sz * 0.05]} castShadow receiveShadow>
          <boxGeometry args={[sx * 0.92, sy * 0.12, sz * 0.55]} />
          <Mat
            map={fabric?.color}
            roughnessMap={fabric?.roughness}
            roughness={0.85}
            selected={selected}
          />
        </mesh>
        <mesh
          position={[0, sy * 0.12, -sz * 0.28]}
          rotation={[0.55, 0, 0]}
          castShadow
        >
          <boxGeometry args={[sx * 0.9, sy * 0.08, sz * 0.42]} />
          <Mat
            map={fabric?.color}
            roughnessMap={fabric?.roughness}
            roughness={0.85}
            selected={selected}
          />
        </mesh>
        {/* Side rails */}
        {([-1, 1] as const).map((side) => (
          <mesh
            key={`rail-${side}`}
            position={[side * sx * 0.42, -sy * 0.05, -sz * 0.05]}
            castShadow
          >
            <boxGeometry args={[0.03, sy * 0.22, sz * 0.5]} />
            <Mat
              map={frame?.color}
              roughnessMap={frame?.roughness}
              roughness={0.55}
              selected={selected}
            />
          </mesh>
        ))}
        {(
          [
            [-sx * 0.35, -sy * 0.38, sz * 0.18],
            [sx * 0.35, -sy * 0.38, sz * 0.18],
            [-sx * 0.35, -sy * 0.38, -sz * 0.2],
            [sx * 0.35, -sy * 0.38, -sz * 0.2],
          ] as const
        ).map((p, i) => (
          <mesh key={i} position={[...p]} castShadow>
            <boxGeometry args={[0.04, sy * 0.35, 0.04]} />
            <Mat
              map={frame?.color}
              roughnessMap={frame?.roughness}
              roughness={0.5}
              selected={selected}
            />
          </mesh>
        ))}
      </group>
    );
  }

  if (isDiningSetId(catalogId)) {
    return (
      <DiningSetMesh
        catalogId={catalogId}
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        groupProps={groupProps}
        frame={furnTex?.frame}
        fabric={furnTex?.fabric}
      />
    );
  }

  if (catalogId === "sofa_outdoor") {
    return (
      <OutdoorSofaMesh
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        groupProps={groupProps}
        frame={furnTex?.frame}
        fabric={furnTex?.fabric}
      />
    );
  }

  if (catalogId === "cover_fan") {
    return (
      <CoverFanMesh
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        groupProps={groupProps}
        frame={furnTex?.frame ?? undefined}
      />
    );
  }

  if (catalogId === "cover_light") {
    return (
      <CoverLightMesh
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        groupProps={groupProps}
      />
    );
  }

  if (catalogId === "sunshelf_table") {
    const r = Math.min(sx, sz);
    const frame = furnTex?.frame;
    return (
      <group {...groupProps}>
        <mesh position={[0, sy * 0.32, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r * 0.48, r * 0.48, sy * 0.12, 24]} />
          <Mat
            map={frame?.color}
            roughnessMap={frame?.roughness}
            roughness={0.45}
            selected={selected}
          />
        </mesh>
        <mesh position={[0, -sy * 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, sy * 0.62, 12]} />
          <Mat
            map={frame?.color}
            roughnessMap={frame?.roughness}
            roughness={0.5}
            selected={selected}
          />
        </mesh>
        <mesh position={[0, -sy * 0.42, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r * 0.22, r * 0.26, 0.03, 16]} />
          <Mat
            map={frame?.color}
            roughnessMap={frame?.roughness}
            roughness={0.5}
            selected={selected}
          />
        </mesh>
      </group>
    );
  }

  if (catalogId === "umbrella_sleeve") {
    const r = Math.min(sx, sz) * 0.48;
    return (
      <group {...groupProps}>
        <mesh position={[0, sy * 0.12, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r, r * 0.92, sy * 0.72, 20]} />
          <Mat
            color="#8a7a62"
            metalness={0.45}
            roughness={0.4}
            selected={selected}
          />
        </mesh>
        <mesh position={[0, sy * 0.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r * 0.42, r * 1.05, 24]} />
          <Mat
            color="#c4b496"
            metalness={0.5}
            roughness={0.35}
            selected={selected}
          />
        </mesh>
        <mesh position={[0, sy * 0.18, 0]}>
          <cylinderGeometry args={[r * 0.38, r * 0.34, sy * 0.7, 16]} />
          <Mat color="#1a1c20" roughness={0.85} selected={selected} />
        </mesh>
      </group>
    );
  }

  if (catalogId === "umbrella") {
    const canopy = furnTex?.canopy;
    return (
      <group {...groupProps}>
        <mesh castShadow>
          <cylinderGeometry args={[0.03, 0.04, sy, 10]} />
          <Mat color="#4a5560" metalness={0.35} roughness={0.4} selected={selected} />
        </mesh>
        <mesh position={[0, sy * 0.42, 0]} castShadow>
          <coneGeometry
            args={[Math.min(sx, sz) * 0.48, sy * 0.18, 20, 1, true]}
          />
          <Mat
            map={canopy?.color}
            roughnessMap={canopy?.roughness}
            roughness={0.75}
            opacity={0.95}
            selected={selected}
          />
        </mesh>
      </group>
    );
  }

  if (catalogId === "fire_pit") {
    const r = Math.min(sx, sz);
    return (
      <group {...groupProps}>
        <mesh position={[0, -sy * 0.18, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r * 0.48, r * 0.52, sy * 0.55, 24]} />
          <Mat color="#d8d2c8" roughness={0.85} selected={selected} />
        </mesh>
        <mesh position={[0, sy * 0.08, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r * 0.4, r * 0.42, sy * 0.22, 24]} />
          <Mat color="#3a3834" roughness={0.7} selected={selected} />
        </mesh>
        {/* Capstones */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(a) * r * 0.38,
                sy * 0.2,
                Math.sin(a) * r * 0.38,
              ]}
              castShadow
            >
              <boxGeometry args={[r * 0.18, sy * 0.1, r * 0.14]} />
              <Mat color="#cfc8bc" roughness={0.8} selected={selected} />
            </mesh>
          );
        })}
        <FireGlow
          radius={r * 0.22}
          baseY={sy * 0.22}
          height={sy * 0.55}
          selected={selected}
        />
      </group>
    );
  }

  if (catalogId === "planter") {
    const r = Math.min(sx, sz);
    return (
      <group {...groupProps}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[r * 0.44, r * 0.36, sy * 0.72, 20]} />
          <Mat color="#b8a990" roughness={0.88} selected={selected} />
        </mesh>
        <mesh position={[0, sy * 0.32, 0]} castShadow>
          <cylinderGeometry args={[r * 0.4, r * 0.4, sy * 0.08, 20]} />
          <Mat color="#5a4030" roughness={0.95} selected={selected} />
        </mesh>
        {/* Layered canopy — denser than a single hemisphere. */}
        <mesh position={[0, sy * 0.42, 0]} castShadow>
          <sphereGeometry args={[r * 0.32, 14, 12]} />
          <Mat color="#2f5a38" roughness={0.92} selected={selected} />
        </mesh>
        <mesh position={[r * 0.12, sy * 0.55, -r * 0.08]} castShadow>
          <sphereGeometry args={[r * 0.22, 12, 10]} />
          <Mat color="#3d6b45" roughness={0.9} selected={selected} />
        </mesh>
        <mesh position={[-r * 0.1, sy * 0.52, r * 0.1]} castShadow>
          <sphereGeometry args={[r * 0.2, 12, 10]} />
          <Mat color="#4a7a52" roughness={0.9} selected={selected} />
        </mesh>
        <mesh position={[0, sy * 0.68, 0]} castShadow>
          <sphereGeometry args={[r * 0.14, 10, 8]} />
          <Mat color="#356340" roughness={0.88} selected={selected} />
        </mesh>
      </group>
    );
  }

  if (isPadEquipmentCatalogId(catalogId)) {
    return (
      <PadEquipmentMesh
        catalogId={catalogId}
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        groupProps={groupProps}
      />
    );
  }

  if (catalogId === "pool_drain") {
    // VGBA anti-entrapment floor grate, flush to plaster.
    const r = 0.15;
    return (
      <group {...groupProps}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
          <circleGeometry args={[r, 32]} />
          <Mat color="#3a4248" metalness={0.35} roughness={0.55} selected={selected} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <ringGeometry args={[r * 0.82, r * 0.98, 32]} />
          <Mat color="#6a727a" metalness={0.55} roughness={0.35} selected={selected} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(a) * r * 0.38,
                0.008,
                Math.sin(a) * r * 0.38,
              ]}
              rotation={[-Math.PI / 2, 0, a]}
            >
              <boxGeometry args={[r * 0.72, r * 0.09, 0.007]} />
              <Mat color="#2a3036" metalness={0.4} roughness={0.45} selected={selected} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.01, 0]}>
          <cylinderGeometry args={[r * 0.12, r * 0.12, 0.01, 12]} />
          <Mat color="#5a6268" metalness={0.5} roughness={0.4} selected={selected} />
        </mesh>
      </group>
    );
  }

  if (catalogId === "pool_skimmer") {
    // Recessed weir in the wall at the waterline; lid sits on the deck behind.
    const deckTop = PATIO_SLAB_THICKNESS_MM / 1000;
    const lidY = deckTop - desc.position.y + 0.012;
    return (
      <group {...groupProps}>
        {/* Face plate flush to interior plaster (origin is slightly in-water). */}
        <mesh position={[0, 0, -0.028]} castShadow>
          <boxGeometry args={[0.24, 0.145, 0.018]} />
          <Mat color="#d8d2c6" roughness={0.55} selected={selected} />
        </mesh>
        {/* Dark throat into the wall */}
        <mesh position={[0, 0.008, -0.06]}>
          <boxGeometry args={[0.175, 0.085, 0.07]} />
          <Mat color="#1a1e22" roughness={0.9} selected={selected} />
        </mesh>
        {/* Floating weir door at the waterline */}
        <mesh
          position={[0, -0.028, 0.012]}
          rotation={[-0.38, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.16, 0.008, 0.055]} />
          <Mat color="#ece8e0" roughness={0.45} selected={selected} />
        </mesh>
        {/* Deck lid behind the wall */}
        <mesh position={[0, lidY, -0.42]} receiveShadow castShadow>
          <boxGeometry args={[0.32, 0.018, 0.32]} />
          <Mat color="#cfc8bb" roughness={0.7} selected={selected} />
        </mesh>
        <mesh position={[0, lidY + 0.012, -0.42]}>
          <boxGeometry args={[0.05, 0.008, 0.09]} />
          <Mat color="#8a8478" metalness={0.35} roughness={0.45} selected={selected} />
        </mesh>
      </group>
    );
  }

  if (catalogId === "pool_return") {
    // Wall return / inlet eyeball, flush to plaster, facing +Z into the pool.
    const r = 0.028;
    return (
      <group {...groupProps}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.012]} castShadow>
          <cylinderGeometry args={[r * 1.15, r * 1.2, 0.018, 20]} />
          <Mat color="#cfc8bb" roughness={0.5} selected={selected} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.002]}>
          <cylinderGeometry args={[r, r, 0.012, 20]} />
          <Mat color="#8a9298" metalness={0.55} roughness={0.32} selected={selected} />
        </mesh>
        <mesh position={[0, 0, 0.01]} castShadow>
          <sphereGeometry args={[r * 0.62, 16, 12]} />
          <Mat color="#6e7882" metalness={0.55} roughness={0.35} selected={selected} />
        </mesh>
        <mesh position={[0, 0, 0.028]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 0.16, r * 0.22, 0.02, 12]} />
          <Mat color="#3d454c" metalness={0.6} selected={selected} />
        </mesh>
      </group>
    );
  }

  if (catalogId === "spa_jet") {
    // Wall-mounted eyeball jet — faces local +Z (into the vessel).
    const r = 0.042;
    return (
      <group {...groupProps}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[r, r, 0.018, 24]} />
          <Mat color="#9aa3ab" metalness={0.72} roughness={0.28} selected={selected} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.006]}>
          <cylinderGeometry args={[r * 0.92, r * 0.92, 0.01, 24]} />
          <Mat color="#5a6570" metalness={0.55} selected={selected} />
        </mesh>
        <mesh position={[0, 0, 0.012]} castShadow>
          <sphereGeometry args={[r * 0.58, 18, 14]} />
          <Mat color="#6e7882" metalness={0.6} roughness={0.32} selected={selected} />
        </mesh>
        <mesh position={[0, 0, 0.038]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 0.2, r * 0.28, 0.032, 14]} />
          <Mat color="#3d454c" metalness={0.65} selected={selected} />
        </mesh>
        <SpaJetStream selected={selected} />
      </group>
    );
  }

  if (catalogId === "spa_bubbler" || catalogId === "pool_bubbler") {
    // Floor / sunshelf bubbler head + animated plume that breaks the waterline.
    const r = 0.048;
    const sunshelf = catalogId === "pool_bubbler";
    const waterLocalY =
      desc.waterSurfaceY != null
        ? desc.waterSurfaceY - desc.position.y
        : sunshelf
          ? 0.05
          : 0.55;
    return (
      <group {...groupProps}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[r, 28]} />
          <Mat color="#6a727a" metalness={0.55} roughness={0.4} selected={selected} />
        </mesh>
        <mesh position={[0, 0.01, 0]} castShadow>
          <cylinderGeometry args={[r * 0.62, r * 0.72, 0.016, 20]} />
          <Mat color="#9aa3ab" metalness={0.7} roughness={0.3} selected={selected} />
        </mesh>
        <mesh position={[0, 0.022, 0]} castShadow>
          <cylinderGeometry args={[r * 0.2, r * 0.26, 0.02, 12]} />
          <Mat color="#3d454c" metalness={0.55} selected={selected} />
        </mesh>
        <BubblerPlume
          waterSurfaceLocalY={waterLocalY}
          sunshelf={sunshelf}
          selected={selected}
          hasLed={desc.hasLedLight === true}
        />
      </group>
    );
  }

  if (catalogId === "spa_drain") {
    const r = 0.055;
    return (
      <group {...groupProps}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[r, 28]} />
          <Mat color="#4a5560" metalness={0.45} selected={selected} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * r * 0.35, 0.006, Math.sin(a) * r * 0.35]}
              rotation={[-Math.PI / 2, 0, a]}
            >
              <boxGeometry args={[r * 0.55, r * 0.1, 0.008]} />
              <Mat color="#2f363c" metalness={0.4} selected={selected} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (catalogId.startsWith("light_")) {
    return (
      <PoolNicheLight
        groupProps={groupProps}
        selected={selected}
        colorChanging={catalogId === "light_color"}
      />
    );
  }

  if (catalogId === "outdoor_kitchen" || catalogId === "cabana") {
    const isCabana = catalogId === "cabana";
    return (
      <group {...groupProps}>
        {/* Base cabinet run */}
        <mesh position={[0, -sy * 0.18, 0]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy * 0.5, sz]} />
          <Mat color="#c9c2b4" roughness={0.82} selected={selected} />
        </mesh>
        {/* Countertop */}
        <mesh position={[0, sy * 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[sx * 1.02, sy * 0.08, sz * 1.04]} />
          <Mat color="#e8e4dc" roughness={0.45} metalness={0.08} selected={selected} />
        </mesh>
        {isCabana ? (
          <>
            <mesh position={[0, sy * 0.42, 0]} castShadow>
              <boxGeometry args={[sx * 1.08, sy * 0.1, sz * 1.08]} />
              <Mat color="#6b6358" roughness={0.85} selected={selected} />
            </mesh>
            {/* Corner posts */}
            {(
              [
                [-1, -1],
                [-1, 1],
                [1, -1],
                [1, 1],
              ] as const
            ).map(([ix, iz]) => (
              <mesh
                key={`${ix}-${iz}`}
                position={[ix * sx * 0.42, sy * 0.18, iz * sz * 0.42]}
                castShadow
              >
                <boxGeometry args={[sx * 0.06, sy * 0.55, sz * 0.06]} />
                <Mat color="#5a5044" roughness={0.8} selected={selected} />
              </mesh>
            ))}
          </>
        ) : (
          <>
            {/* Grill insert */}
            <mesh position={[sx * 0.12, sy * 0.18, -sz * 0.05]} castShadow>
              <boxGeometry args={[sx * 0.42, sy * 0.12, sz * 0.55]} />
              <Mat
                color="#2a2e32"
                metalness={0.55}
                roughness={0.35}
                selected={selected}
              />
            </mesh>
            <mesh position={[sx * 0.12, sy * 0.26, -sz * 0.05]}>
              <boxGeometry args={[sx * 0.36, sy * 0.02, sz * 0.48]} />
              <Mat
                color="#e85d04"
                selected={selected}
                emissive="#ff6b1a"
                emissiveIntensity={0.35}
              />
            </mesh>
            {/* Backsplash / upper shelf */}
            <mesh position={[0, sy * 0.32, -sz * 0.42]} castShadow>
              <boxGeometry args={[sx * 0.95, sy * 0.42, sz * 0.1]} />
              <Mat color="#4a5560" metalness={0.25} roughness={0.45} selected={selected} />
            </mesh>
            {/* Side cabinet doors suggestion */}
            <mesh position={[-sx * 0.28, -sy * 0.05, sz * 0.48]} castShadow>
              <boxGeometry args={[sx * 0.35, sy * 0.28, 0.02]} />
              <Mat color="#b0a898" roughness={0.75} selected={selected} />
            </mesh>
          </>
        )}
      </group>
    );
  }

  return (
    <mesh {...groupProps} castShadow receiveShadow>
      <boxGeometry args={[sx, sy, sz]} />
      <Mat
        color={desc.material === "equipment" ? "#4a5560" : "#5c7a6e"}
        opacity={desc.opacity ?? 1}
        selected={selected}
      />
    </mesh>
  );
}
