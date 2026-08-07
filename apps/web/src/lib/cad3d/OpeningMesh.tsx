"use client";

import { useContext, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { CanvasTexture } from "three";
import type { BuildingOpeningKind } from "@pool-design/shared";
import type { BoxDescriptor, SceneSelection } from "@/lib/cad3d/buildScene";
import { ClipPlanesContext } from "@/lib/cad3d/clipContext";
import {
  makeDoorWoodTexture,
  makeTrimTexture,
} from "@/lib/cad3d/proceduralTextures";

type Props = {
  desc: BoxDescriptor;
  selected: boolean;
  onSelect?: (sel: SceneSelection | null) => void;
};

function useOpeningTextures() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    return {
      wood: makeDoorWoodTexture(),
      trim: makeTrimTexture(),
    };
  }, []);
}

function Mat({
  color,
  map,
  roughnessMap,
  roughness = 0.65,
  metalness = 0.05,
  opacity = 1,
  selected,
}: {
  color?: string;
  map?: CanvasTexture;
  roughnessMap?: CanvasTexture;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  selected: boolean;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  return (
    <meshStandardMaterial
      color={color ?? "#ffffff"}
      map={map}
      roughnessMap={roughnessMap}
      roughness={roughness}
      metalness={metalness}
      transparent={opacity < 0.99}
      opacity={opacity}
      depthWrite={opacity >= 0.9}
      polygonOffset
      polygonOffsetFactor={-1}
      polygonOffsetUnits={-1}
      emissive={selected ? "#1f8a70" : "#000000"}
      emissiveIntensity={selected ? 0.22 : 0}
      clippingPlanes={clippingPlanes}
      clipShadows={clippingPlanes.length > 0}
    />
  );
}

function GlassMat({
  selected,
  color = "#6eb8d4",
  opacity = 0.45,
}: {
  selected: boolean;
  color?: string;
  opacity?: number;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.05}
      metalness={0.55}
      transparent
      opacity={opacity}
      depthWrite={false}
      polygonOffset
      polygonOffsetFactor={-2}
      polygonOffsetUnits={-2}
      emissive={selected ? "#1f8a70" : "#4a90a8"}
      emissiveIntensity={selected ? 0.18 : 0.12}
      clippingPlanes={clippingPlanes}
      clipShadows={clippingPlanes.length > 0}
    />
  );
}

/** Four frame sides around an opening (no solid backer). */
function FrameShell({
  w,
  h,
  depth,
  thick,
  z,
  trim,
  selected,
  sillExtra = 0,
}: {
  w: number;
  h: number;
  depth: number;
  thick: number;
  z: number;
  trim: { color: CanvasTexture; roughness: CanvasTexture } | undefined;
  selected: boolean;
  /** Extra thickness on the bottom rail (window sill). */
  sillExtra?: number;
}) {
  const left = -w / 2 + thick / 2;
  const right = w / 2 - thick / 2;
  const top = h / 2 - thick / 2;
  const sillH = thick + sillExtra;
  const bottom = -h / 2 + sillH / 2;
  const midH = h - thick - sillH;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[left, (sillH - thick) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[thick, midH + thick, depth]} />
        <Mat
          map={trim?.color}
          roughnessMap={trim?.roughness}
          color="#f2efe8"
          roughness={0.48}
          selected={selected}
        />
      </mesh>
      <mesh position={[right, (sillH - thick) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[thick, midH + thick, depth]} />
        <Mat
          map={trim?.color}
          roughnessMap={trim?.roughness}
          color="#f2efe8"
          roughness={0.48}
          selected={selected}
        />
      </mesh>
      <mesh position={[0, top, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, thick, depth]} />
        <Mat
          map={trim?.color}
          roughnessMap={trim?.roughness}
          color="#f2efe8"
          roughness={0.48}
          selected={selected}
        />
      </mesh>
      <mesh position={[0, bottom, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, sillH, depth]} />
        <Mat
          map={trim?.color}
          roughnessMap={trim?.roughness}
          color="#ebe6dc"
          roughness={0.52}
          selected={selected}
        />
      </mesh>
    </group>
  );
}

export function OpeningMesh({ desc, selected, onSelect }: Props) {
  const textures = useOpeningTextures();
  const kind: BuildingOpeningKind =
    desc.openingKind ??
    (desc.material === "window" ? "window" : "door");
  const { x: w, y: h, z: t } = desc.size;
  // Local +Z must face outward (axisZ) so frames/glass sit on the facade.
  const rotationY = useMemo(() => {
    if (desc.axisZ) return Math.atan2(desc.axisZ.x, desc.axisZ.z);
    if (desc.axisX) return Math.atan2(-desc.axisX.z, desc.axisX.x);
    return desc.rotationY;
  }, [desc.axisX, desc.axisZ, desc.rotationY]);

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

  const wood = textures?.wood;
  const trim = textures?.trim;
  const frameT = Math.min(0.07, Math.max(0.045, w * 0.07));
  const frameD = Math.max(0.07, t * 0.85);

  if (kind === "window") {
    const innerW = w - frameT * 2;
    const innerH = h - frameT * 2 - frameT * 0.35;
    const mullion = frameT * 0.55;
    const paneW = (innerW - mullion) / 2;
    const paneH = (innerH - mullion) / 2;
    const glassZ = -0.012;
    const xs = [
      -paneW / 2 - mullion / 2,
      paneW / 2 + mullion / 2,
    ];
    const ys = [
      paneH / 2 + mullion / 2 + frameT * 0.1,
      -paneH / 2 - mullion / 2 + frameT * 0.1,
    ];
    return (
      <group {...groupProps}>
        {/* Dark reveal so the opening reads as a punched hole */}
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[w - 0.01, h - 0.01, 0.04]} />
          <Mat color="#2a3238" roughness={0.9} selected={selected} />
        </mesh>
        <FrameShell
          w={w}
          h={h}
          depth={frameD}
          thick={frameT}
          z={0.01}
          trim={trim}
          selected={selected}
          sillExtra={frameT * 0.45}
        />
        {/* Mullions */}
        <mesh position={[0, frameT * 0.1, 0.02]} castShadow>
          <boxGeometry args={[mullion, innerH, frameD * 0.7]} />
          <Mat
            map={trim?.color}
            roughnessMap={trim?.roughness}
            color="#f2efe8"
            roughness={0.48}
            selected={selected}
          />
        </mesh>
        <mesh position={[0, frameT * 0.1, 0.02]} castShadow>
          <boxGeometry args={[innerW, mullion, frameD * 0.7]} />
          <Mat
            map={trim?.color}
            roughnessMap={trim?.roughness}
            color="#f2efe8"
            roughness={0.48}
            selected={selected}
          />
        </mesh>
        {xs.map((x, ix) =>
          ys.map((y, iy) => (
            <mesh key={`${ix}-${iy}`} position={[x, y, glassZ]}>
              <boxGeometry args={[paneW * 0.96, paneH * 0.96, 0.012]} />
              <GlassMat selected={selected} />
            </mesh>
          )),
        )}
      </group>
    );
  }

  if (kind === "sliding_door") {
    const stile = frameT * 0.9;
    const panelW = (w - stile * 3) / 2;
    const panelH = h - stile * 2;
    return (
      <group {...groupProps}>
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[w - 0.01, h - 0.01, 0.04]} />
          <Mat color="#2a3238" roughness={0.9} selected={selected} />
        </mesh>
        <FrameShell
          w={w}
          h={h}
          depth={frameD}
          thick={stile}
          z={0.01}
          trim={trim}
          selected={selected}
        />
        {/* Center meeting stile */}
        <mesh position={[0, 0, 0.02]} castShadow>
          <boxGeometry args={[stile, panelH, frameD * 0.75]} />
          <Mat
            map={trim?.color}
            roughnessMap={trim?.roughness}
            color="#f2efe8"
            roughness={0.48}
            selected={selected}
          />
        </mesh>
        {([-1, 1] as const).map((side) => (
          <group key={side} position={[(panelW / 2 + stile / 2) * side, 0, 0]}>
            <mesh position={[0, 0, -0.01]}>
              <boxGeometry args={[panelW * 0.92, panelH * 0.92, 0.014]} />
              <GlassMat selected={selected} opacity={0.5} color="#7ec0d6" />
            </mesh>
            {/* Panel frame */}
            <mesh position={[0, panelH / 2 - stile * 0.35, 0.025]} castShadow>
              <boxGeometry args={[panelW * 0.95, stile * 0.55, frameD * 0.55]} />
              <Mat
                map={trim?.color}
                roughnessMap={trim?.roughness}
                color="#f2efe8"
                roughness={0.48}
                selected={selected}
              />
            </mesh>
            <mesh position={[0, -panelH / 2 + stile * 0.35, 0.025]} castShadow>
              <boxGeometry args={[panelW * 0.95, stile * 0.55, frameD * 0.55]} />
              <Mat
                map={trim?.color}
                roughnessMap={trim?.roughness}
                color="#f2efe8"
                roughness={0.48}
                selected={selected}
              />
            </mesh>
          </group>
        ))}
        {/* Track */}
        <mesh position={[0, -h / 2 + 0.025, 0.04]} castShadow>
          <boxGeometry args={[w * 0.94, 0.035, frameD * 0.9]} />
          <Mat
            color="#5a6570"
            metalness={0.55}
            roughness={0.35}
            selected={selected}
          />
        </mesh>
        {/* Handle on right panel */}
        <mesh position={[panelW * 0.35, 0, 0.055]} castShadow>
          <boxGeometry args={[0.02, 0.14, 0.03]} />
          <Mat
            color="#b8c0c8"
            metalness={0.8}
            roughness={0.25}
            selected={selected}
          />
        </mesh>
      </group>
    );
  }

  // Entry / swing door — wood leaf with recessed panels + casing
  const casing = Math.min(0.06, w * 0.08);
  const leafW = w - casing * 1.1;
  const leafH = h - casing * 0.55;
  const leafZ = 0.02;
  const panelInset = 0.03;
  const rail = Math.min(0.1, leafW * 0.14);
  const panelW = leafW - rail * 2;
  const upperH = (leafH - rail * 3) * 0.4;
  const lowerH = (leafH - rail * 3) * 0.5;

  return (
    <group {...groupProps}>
      {/* Dark reveal */}
      <mesh position={[0, 0, -0.035]}>
        <boxGeometry args={[w + 0.02, h + 0.02, 0.05]} />
        <Mat color="#2a3238" roughness={0.9} selected={selected} />
      </mesh>
      {/* Exterior casing */}
      <FrameShell
        w={w + casing * 0.4}
        h={h + casing * 0.15}
        depth={frameD * 0.85}
        thick={casing}
        z={0}
        trim={trim}
        selected={selected}
        sillExtra={casing * 0.2}
      />
      {/* Door leaf */}
      <mesh position={[0, casing * 0.1, leafZ]} castShadow receiveShadow>
        <boxGeometry args={[leafW, leafH, 0.05]} />
        <Mat
          map={wood?.color}
          roughnessMap={wood?.roughness}
          color="#8b5a2b"
          roughness={0.78}
          selected={selected}
        />
      </mesh>
      {/* Recessed upper panel (darker inset) */}
      <mesh
        position={[0, leafH / 2 - rail - upperH / 2 + casing * 0.1, leafZ + 0.012]}
        castShadow
      >
        <boxGeometry args={[panelW, upperH, 0.035]} />
        <Mat
          map={wood?.color}
          roughnessMap={wood?.roughness}
          color="#6e4520"
          roughness={0.82}
          selected={selected}
        />
      </mesh>
      {/* Raised panel face */}
      <mesh
        position={[
          0,
          leafH / 2 - rail - upperH / 2 + casing * 0.1,
          leafZ + 0.028,
        ]}
        castShadow
      >
        <boxGeometry
          args={[panelW - panelInset * 2, upperH - panelInset * 2, 0.02]}
        />
        <Mat
          map={wood?.color}
          roughnessMap={wood?.roughness}
          color="#a06a35"
          roughness={0.72}
          selected={selected}
        />
      </mesh>
      {/* Recessed lower panel */}
      <mesh
        position={[
          0,
          -leafH / 2 + rail + lowerH / 2 + casing * 0.1,
          leafZ + 0.012,
        ]}
        castShadow
      >
        <boxGeometry args={[panelW, lowerH, 0.035]} />
        <Mat
          map={wood?.color}
          roughnessMap={wood?.roughness}
          color="#6e4520"
          roughness={0.82}
          selected={selected}
        />
      </mesh>
      <mesh
        position={[
          0,
          -leafH / 2 + rail + lowerH / 2 + casing * 0.1,
          leafZ + 0.028,
        ]}
        castShadow
      >
        <boxGeometry
          args={[panelW - panelInset * 2, lowerH - panelInset * 2, 0.02]}
        />
        <Mat
          map={wood?.color}
          roughnessMap={wood?.roughness}
          color="#a06a35"
          roughness={0.72}
          selected={selected}
        />
      </mesh>
      {/* Mid rail */}
      <mesh position={[0, casing * 0.1 - leafH * 0.05, leafZ + 0.02]} castShadow>
        <boxGeometry args={[leafW * 0.96, rail * 0.85, 0.045]} />
        <Mat
          map={wood?.color}
          roughnessMap={wood?.roughness}
          color="#8b5a2b"
          roughness={0.75}
          selected={selected}
        />
      </mesh>
      {/* Lever handle */}
      <mesh
        position={[leafW * 0.32, casing * 0.1, leafZ + 0.045]}
        castShadow
      >
        <cylinderGeometry args={[0.012, 0.012, 0.035, 12]} />
        <Mat
          color="#c5ccd3"
          metalness={0.85}
          roughness={0.22}
          selected={selected}
        />
      </mesh>
      <mesh
        position={[leafW * 0.32 + 0.045, casing * 0.1, leafZ + 0.055]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.008, 0.008, 0.09, 10]} />
        <Mat
          color="#c5ccd3"
          metalness={0.85}
          roughness={0.22}
          selected={selected}
        />
      </mesh>
      {/* Deadbolt plate */}
      <mesh
        position={[leafW * 0.32, casing * 0.1 + 0.08, leafZ + 0.042]}
        castShadow
      >
        <boxGeometry args={[0.035, 0.055, 0.012]} />
        <Mat
          color="#a8b0b8"
          metalness={0.7}
          roughness={0.3}
          selected={selected}
        />
      </mesh>
    </group>
  );
}
