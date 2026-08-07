"use client";

import { useContext, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { CanvasTexture } from "three";
import {
  DEFAULT_FURNITURE_CANOPY_FINISH_ID,
  DEFAULT_FURNITURE_FABRIC_FINISH_ID,
  DEFAULT_FURNITURE_FRAME_FINISH_ID,
  DINING_CHAIR_CLEARANCE_MM,
  diningTableShape,
  isDiningSetId,
} from "@pool-design/shared";
import type { BoxDescriptor, SceneSelection } from "@/lib/cad3d/buildScene";
import { ClipPlanesContext } from "@/lib/cad3d/clipContext";
import { getFurnitureFinishTexture } from "@/lib/cad3d/furnitureFinishTextures";

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

  if (catalogId === "person_scale") {
    // Standing adult — proportions keyed to total height (default 5′8″).
    // Group origin is body center; feet at y = -H/2, crown at +H/2.
    const H = Math.max(sy, 1.5);
    const shoulderW = Math.min(sx * 0.98, H * 0.26);
    const chestD = Math.min(sz * 0.95, H * 0.15);
    const headR = H * 0.065;
    const neckH = H * 0.04;
    const torsoH = H * 0.28;
    const hipH = H * 0.08;
    const upperLegH = H * 0.22;
    const lowerLegH = H * 0.22;
    const footH = H * 0.035;
    const upperArmH = H * 0.16;
    const lowerArmH = H * 0.14;
    const armR = H * 0.028;
    const legR = H * 0.038;
    const skin = "#c4a484";
    const shirt = "#3d6b8a";
    const pants = "#3a4550";
    const shoe = "#2a3036";

    // Vertical layout from feet upward (local y, center = 0)
    const footY = -H / 2 + footH / 2;
    const lowerLegY = footY + footH / 2 + lowerLegH / 2;
    const upperLegY = lowerLegY + lowerLegH / 2 + upperLegH / 2;
    const hipY = upperLegY + upperLegH / 2 + hipH / 2;
    const torsoY = hipY + hipH / 2 + torsoH / 2;
    const neckY = torsoY + torsoH / 2 + neckH / 2;
    const headY = neckY + neckH / 2 + headR * 0.95;
    const shoulderY = torsoY + torsoH * 0.28;
    const legSpread = shoulderW * 0.18;

    return (
      <group {...groupProps}>
        {/* Feet */}
        {([-1, 1] as const).map((side) => (
          <mesh
            key={`foot-${side}`}
            position={[side * legSpread, footY, chestD * 0.12]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[legR * 1.6, footH, chestD * 0.55]} />
            <Mat color={shoe} roughness={0.85} selected={selected} />
          </mesh>
        ))}
        {/* Lower legs */}
        {([-1, 1] as const).map((side) => (
          <mesh
            key={`lleg-${side}`}
            position={[side * legSpread, lowerLegY, 0]}
            castShadow
          >
            <capsuleGeometry args={[legR * 0.85, lowerLegH - legR * 1.7, 6, 10]} />
            <Mat color={pants} roughness={0.8} selected={selected} />
          </mesh>
        ))}
        {/* Upper legs */}
        {([-1, 1] as const).map((side) => (
          <mesh
            key={`uleg-${side}`}
            position={[side * legSpread * 0.85, upperLegY, 0]}
            castShadow
          >
            <capsuleGeometry args={[legR, upperLegH - legR * 1.7, 6, 10]} />
            <Mat color={pants} roughness={0.8} selected={selected} />
          </mesh>
        ))}
        {/* Hips */}
        <mesh position={[0, hipY, 0]} castShadow>
          <boxGeometry args={[shoulderW * 0.55, hipH, chestD * 0.85]} />
          <Mat color={pants} roughness={0.8} selected={selected} />
        </mesh>
        {/* Torso */}
        <mesh position={[0, torsoY, 0]} castShadow>
          <boxGeometry args={[shoulderW * 0.72, torsoH, chestD]} />
          <Mat color={shirt} roughness={0.75} selected={selected} />
        </mesh>
        {/* Shoulders */}
        <mesh position={[0, shoulderY, 0]} castShadow>
          <boxGeometry args={[shoulderW, H * 0.06, chestD * 0.9]} />
          <Mat color={shirt} roughness={0.75} selected={selected} />
        </mesh>
        {/* Arms */}
        {([-1, 1] as const).map((side) => {
          const ax = side * (shoulderW * 0.52);
          const upperArmY = shoulderY - upperArmH * 0.35;
          const lowerArmY = upperArmY - upperArmH * 0.45 - lowerArmH * 0.4;
          return (
            <group key={`arm-${side}`}>
              <mesh position={[ax, upperArmY, 0]} castShadow>
                <capsuleGeometry
                  args={[armR, upperArmH - armR * 1.6, 5, 8]}
                />
                <Mat color={shirt} roughness={0.75} selected={selected} />
              </mesh>
              <mesh position={[ax, lowerArmY, chestD * 0.05]} castShadow>
                <capsuleGeometry
                  args={[armR * 0.9, lowerArmH - armR * 1.5, 5, 8]}
                />
                <Mat color={skin} roughness={0.7} selected={selected} />
              </mesh>
            </group>
          );
        })}
        {/* Neck */}
        <mesh position={[0, neckY, 0]} castShadow>
          <cylinderGeometry args={[headR * 0.45, headR * 0.5, neckH, 10]} />
          <Mat color={skin} roughness={0.7} selected={selected} />
        </mesh>
        {/* Head */}
        <mesh position={[0, headY, 0]} castShadow>
          <sphereGeometry args={[headR, 16, 12]} />
          <Mat color={skin} roughness={0.65} selected={selected} />
        </mesh>
      </group>
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
    const shape = diningTableShape(catalogId);
    const frame = furnTex?.frame;
    const fabric = furnTex?.fabric;
    // desc.size is tabletop; chairs sit in clearance beyond the top.
    const tableW = shape === "round" ? Math.max(sx, sz) : sx;
    const tableD = shape === "round" ? Math.max(sx, sz) : sz;
    const clearM = DINING_CHAIR_CLEARANCE_MM / 1000;
    const topT = Math.max(0.04, sy * 0.07);
    const topY = sy * 0.28;
    const legH = sy * 0.55;
    const chairSeatH = sy * 0.38;
    const chairW = Math.min(0.48, clearM * 0.85);
    const chairD = Math.min(0.5, clearM * 0.9);
    const chairSeatT = 0.05;
    const backH = sy * 0.32;

    const chairSlots: { x: number; z: number; yaw: number }[] = [];
    if (shape === "round") {
      const n = tableW >= 1.7 ? 6 : 4;
      const orbit = tableW / 2 + clearM * 0.48;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        chairSlots.push({
          x: Math.sin(a) * orbit,
          z: Math.cos(a) * orbit,
          yaw: a + Math.PI,
        });
      }
    } else {
      const along = Math.max(2, Math.round(tableW / 0.7));
      const sideZ = tableD / 2 + clearM * 0.48;
      for (let i = 0; i < along; i++) {
        const t = along === 1 ? 0.5 : i / (along - 1);
        const x = -tableW * 0.38 + t * tableW * 0.76;
        chairSlots.push({ x, z: sideZ, yaw: Math.PI });
        chairSlots.push({ x, z: -sideZ, yaw: 0 });
      }
      if (tableW >= 1.6) {
        const endX = tableW / 2 + clearM * 0.48;
        chairSlots.push({ x: endX, z: 0, yaw: -Math.PI / 2 });
        chairSlots.push({ x: -endX, z: 0, yaw: Math.PI / 2 });
      }
    }

    return (
      <group {...groupProps}>
        {/* Tabletop */}
        {shape === "round" ? (
          <mesh position={[0, topY, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[tableW / 2, tableW / 2, topT, 32]} />
            <Mat
              map={frame?.color}
              roughnessMap={frame?.roughness}
              roughness={0.45}
              selected={selected}
            />
          </mesh>
        ) : (
          <mesh position={[0, topY, 0]} castShadow receiveShadow>
            <boxGeometry args={[tableW, topT, tableD]} />
            <Mat
              map={frame?.color}
              roughnessMap={frame?.roughness}
              roughness={0.45}
              selected={selected}
            />
          </mesh>
        )}
        {/* Pedestal / legs */}
        {shape === "round" ? (
          <>
            <mesh position={[0, topY - legH / 2 - topT / 2, 0]} castShadow>
              <cylinderGeometry args={[0.055, 0.07, legH, 14]} />
              <Mat
                map={frame?.color}
                roughnessMap={frame?.roughness}
                roughness={0.5}
                selected={selected}
              />
            </mesh>
            <mesh
              position={[0, topY - legH - topT / 2, 0]}
              castShadow
              receiveShadow
            >
              <cylinderGeometry
                args={[tableW * 0.22, tableW * 0.26, 0.04, 20]}
              />
              <Mat
                map={frame?.color}
                roughnessMap={frame?.roughness}
                roughness={0.5}
                selected={selected}
              />
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
              <Mat
                map={frame?.color}
                roughnessMap={frame?.roughness}
                roughness={0.5}
                selected={selected}
              />
            </mesh>
          ))
        )}
        {/* Chairs */}
        {chairSlots.map((c, i) => (
          <group key={`chair-${i}`} position={[c.x, 0, c.z]} rotation={[0, c.yaw, 0]}>
            <mesh position={[0, -sy * 0.5 + chairSeatH, 0]} castShadow>
              <boxGeometry args={[chairW, chairSeatT, chairD]} />
              <Mat
                map={fabric?.color}
                roughnessMap={fabric?.roughness}
                roughness={0.85}
                selected={selected}
              />
            </mesh>
            <mesh
              position={[0, -sy * 0.5 + chairSeatH + backH / 2, -chairD * 0.38]}
              castShadow
            >
              <boxGeometry args={[chairW * 0.95, backH, 0.04]} />
              <Mat
                map={frame?.color}
                roughnessMap={frame?.roughness}
                roughness={0.55}
                selected={selected}
              />
            </mesh>
            {(
              [
                [-chairW * 0.38, -chairD * 0.35],
                [chairW * 0.38, -chairD * 0.35],
                [-chairW * 0.38, chairD * 0.35],
                [chairW * 0.38, chairD * 0.35],
              ] as const
            ).map(([lx, lz], li) => (
              <mesh
                key={li}
                position={[lx, -sy * 0.5 + chairSeatH / 2, lz]}
                castShadow
              >
                <boxGeometry args={[0.035, chairSeatH, 0.035]} />
                <Mat
                  map={frame?.color}
                  roughnessMap={frame?.roughness}
                  roughness={0.5}
                  selected={selected}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  }

  if (catalogId === "sofa_outdoor") {
    const frame = furnTex?.frame;
    const fabric = furnTex?.fabric;
    return (
      <group {...groupProps}>
        <mesh position={[0, -sy * 0.28, 0]} castShadow receiveShadow>
          <boxGeometry args={[sx * 0.98, sy * 0.18, sz * 0.95]} />
          <Mat
            map={frame?.color}
            roughnessMap={frame?.roughness}
            roughness={0.5}
            selected={selected}
          />
        </mesh>
        <mesh position={[0, -sy * 0.12, 0]} castShadow receiveShadow>
          <boxGeometry args={[sx * 0.92, sy * 0.22, sz * 0.88]} />
          <Mat
            map={fabric?.color}
            roughnessMap={fabric?.roughness}
            roughness={0.88}
            selected={selected}
          />
        </mesh>
        <mesh position={[0, sy * 0.12, -sz * 0.35]} castShadow>
          <boxGeometry args={[sx * 0.94, sy * 0.5, sz * 0.2]} />
          <Mat
            map={fabric?.color}
            roughnessMap={fabric?.roughness}
            roughness={0.88}
            selected={selected}
          />
        </mesh>
        <mesh position={[-sx * 0.42, sy * 0.02, sz * 0.05]} castShadow>
          <boxGeometry args={[sx * 0.1, sy * 0.38, sz * 0.75]} />
          <Mat
            map={fabric?.color}
            roughnessMap={fabric?.roughness}
            roughness={0.88}
            selected={selected}
          />
        </mesh>
        <mesh position={[sx * 0.42, sy * 0.02, sz * 0.05]} castShadow>
          <boxGeometry args={[sx * 0.1, sy * 0.38, sz * 0.75]} />
          <Mat
            map={fabric?.color}
            roughnessMap={fabric?.roughness}
            roughness={0.88}
            selected={selected}
          />
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
        <mesh position={[0, -sy * 0.15, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r * 0.45, r * 0.48, sy * 0.7, 20]} />
          <Mat color="#e8e4dc" selected={selected} />
        </mesh>
        <mesh position={[0, sy * 0.25, 0]}>
          <cylinderGeometry args={[r * 0.28, r * 0.28, sy * 0.15, 16]} />
          <Mat
            color="#e85d04"
            selected={selected}
            emissive="#ff6b1a"
            emissiveIntensity={0.45}
          />
        </mesh>
      </group>
    );
  }

  if (catalogId === "planter") {
    const r = Math.min(sx, sz);
    return (
      <group {...groupProps}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[r * 0.42, r * 0.38, sy, 16]} />
          <Mat color="#c4b8a8" selected={selected} />
        </mesh>
        <mesh position={[0, sy * 0.35, 0]} castShadow>
          <sphereGeometry
            args={[r * 0.28, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]}
          />
          <Mat color="#3d6b45" roughness={0.9} selected={selected} />
        </mesh>
      </group>
    );
  }

  if (
    catalogId.includes("pump") ||
    catalogId.includes("filter") ||
    catalogId.includes("heater") ||
    catalogId.includes("salt") ||
    catalogId.startsWith("equip_")
  ) {
    return (
      <group {...groupProps}>
        <mesh position={[0, -sy * 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[sx * 0.95, sy * 0.55, sz * 0.95]} />
          <Mat color="#4a5560" metalness={0.3} selected={selected} />
        </mesh>
        <mesh
          position={[0, sy * 0.22, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry
            args={[Math.min(sx, sz) * 0.28, Math.min(sx, sz) * 0.28, sy * 0.5, 16]}
          />
          <Mat color="#5a6570" metalness={0.35} selected={selected} />
        </mesh>
        <mesh position={[sx * 0.2, sy * 0.05, sz * 0.15]} castShadow>
          <boxGeometry args={[sx * 0.25, sy * 0.2, sz * 0.25]} />
          <Mat color="#c45c2c" selected={selected} />
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
        <mesh position={[0, 0, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.032, 0.1, 14, 1, true]} />
          <Mat color="#8ed0e8" opacity={0.22} roughness={0.15} selected={selected} />
        </mesh>
      </group>
    );
  }

  if (catalogId === "spa_bubbler" || catalogId === "pool_bubbler") {
    // Floor / sunshelf bubbler head with a short bubble column.
    const r = 0.048;
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
        {(
          [
            [0.006, 0.055, 0.004, 0.011],
            [-0.008, 0.095, -0.005, 0.013],
            [0.004, 0.135, 0.007, 0.01],
            [-0.003, 0.175, -0.002, 0.012],
          ] as const
        ).map(([x, y, z, rad], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[rad, 10, 10]} />
            <Mat
              color="#c5eaf5"
              opacity={0.4 - i * 0.05}
              roughness={0.2}
              selected={selected}
            />
          </mesh>
        ))}
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
    const r = 0.05;
    return (
      <group {...groupProps}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[r, r, 0.022, 24]} />
          <Mat color="#4a5560" metalness={0.4} selected={selected} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.012]}>
          <circleGeometry args={[r * 0.72, 24]} />
          <Mat
            color="#ffe9a8"
            selected={selected}
            emissive="#ffd56a"
            emissiveIntensity={0.7}
          />
        </mesh>
      </group>
    );
  }

  if (catalogId === "outdoor_kitchen" || catalogId === "cabana") {
    return (
      <group {...groupProps}>
        <mesh position={[0, -sy * 0.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy * 0.55, sz]} />
          <Mat color="#c4b8a8" selected={selected} />
        </mesh>
        {catalogId === "cabana" ? (
          <mesh position={[0, sy * 0.35, 0]} castShadow>
            <boxGeometry args={[sx * 1.05, sy * 0.12, sz * 1.05]} />
            <Mat color="#6b6358" selected={selected} />
          </mesh>
        ) : (
          <mesh position={[0, sy * 0.28, -sz * 0.35]} castShadow>
            <boxGeometry args={[sx * 0.9, sy * 0.35, sz * 0.15]} />
            <Mat color="#4a5560" selected={selected} />
          </mesh>
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
