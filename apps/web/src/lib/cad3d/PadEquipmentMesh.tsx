"use client";

import { useContext } from "react";
import { ClipPlanesContext } from "@/lib/cad3d/clipContext";

/**
 * Pentair-inspired pad equipment silhouettes (IntelliFlo-style pump,
 * Clean & Clear-style cartridge filter, MasterTemp-style heater,
 * IntelliChlor-style salt cell). Procedural — no brand marks.
 */

type MatProps = {
  color?: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  selected: boolean;
  emissive?: string;
  emissiveIntensity?: number;
};

function Mat({
  color = "#ffffff",
  roughness = 0.7,
  metalness = 0.05,
  opacity = 1,
  selected,
  emissive,
  emissiveIntensity = 0,
}: MatProps) {
  const clippingPlanes = useContext(ClipPlanesContext);
  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      transparent={opacity < 1}
      opacity={opacity}
      emissive={selected ? "#1f8a70" : (emissive ?? "#000000")}
      emissiveIntensity={selected ? 0.14 : emissiveIntensity}
      clippingPlanes={clippingPlanes}
      clipShadows={clippingPlanes.length > 0}
      depthWrite={opacity >= 0.99}
    />
  );
}

type EquipProps = {
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  groupProps: Record<string, unknown>;
};

/** Concrete equipment pad — raised slab with beveled edge. */
function EquipPadMesh({ sx, sy, sz, selected, groupProps }: EquipProps) {
  const t = Math.max(sy, 0.08);
  return (
    <group {...groupProps}>
      <mesh position={[0, -sy / 2 + t / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx, t * 0.85, sz]} />
        <Mat color="#b8b4aa" roughness={0.92} selected={selected} />
      </mesh>
      <mesh position={[0, -sy / 2 + t * 0.92, 0]} receiveShadow>
        <boxGeometry args={[sx * 0.97, t * 0.18, sz * 0.97]} />
        <Mat color="#cec9be" roughness={0.88} selected={selected} />
      </mesh>
      {/* Expansion joint lines */}
      <mesh position={[0, -sy / 2 + t + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[sx * 0.02, sz * 0.92]} />
        <Mat color="#9a968c" roughness={1} selected={selected} />
      </mesh>
    </group>
  );
}

/**
 * Variable-speed pump — IntelliFlo-like: strainer housing + lid,
 * motor barrel, square drive on top.
 */
function PumpMesh({ sx, sy, sz, selected, groupProps }: EquipProps) {
  const y0 = -sy / 2;
  const wetW = sx * 0.42;
  const wetH = sy * 0.55;
  const wetD = sz * 0.72;
  const motorR = Math.min(sz * 0.28, sy * 0.28);
  const motorLen = sx * 0.48;

  return (
    <group {...groupProps}>
      {/* Base / feet */}
      <mesh position={[0, y0 + 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx * 0.92, 0.04, sz * 0.85]} />
        <Mat color="#2a2e34" roughness={0.75} metalness={0.25} selected={selected} />
      </mesh>

      {/* Wet-end / strainer housing (front) */}
      <mesh
        position={[-sx * 0.22, y0 + wetH * 0.55, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[wetW, wetH, wetD]} />
        <Mat color="#1a1c20" roughness={0.55} metalness={0.2} selected={selected} />
      </mesh>
      {/* Rounded nose of volute */}
      <mesh
        position={[-sx * 0.42, y0 + wetH * 0.42, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[wetD * 0.38, wetD * 0.42, wetW * 0.35, 20]} />
        <Mat color="#22262c" roughness={0.5} metalness={0.25} selected={selected} />
      </mesh>

      {/* See-through strainer lid (teal/clear) */}
      <mesh position={[-sx * 0.22, y0 + wetH + 0.03, 0]} castShadow>
        <cylinderGeometry args={[wetD * 0.32, wetD * 0.34, 0.06, 24]} />
        <Mat
          color="#2a8a9a"
          roughness={0.25}
          metalness={0.15}
          opacity={0.85}
          selected={selected}
        />
      </mesh>
      <mesh position={[-sx * 0.22, y0 + wetH + 0.07, 0]}>
        <cylinderGeometry args={[wetD * 0.18, wetD * 0.18, 0.025, 16]} />
        <Mat color="#1a5a68" roughness={0.4} selected={selected} />
      </mesh>

      {/* Motor barrel */}
      <mesh
        position={[sx * 0.18, y0 + motorR + 0.06, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[motorR, motorR, motorLen, 24]} />
        <Mat color="#141618" roughness={0.45} metalness={0.35} selected={selected} />
      </mesh>
      {/* Motor cooling fins suggestion */}
      <mesh
        position={[sx * 0.18, y0 + motorR + 0.06, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry
          args={[motorR * 1.04, motorR * 1.04, motorLen * 0.55, 24, 1, true]}
        />
        <Mat color="#0e1012" roughness={0.6} metalness={0.4} selected={selected} />
      </mesh>

      {/* Square VFD / drive on top of motor */}
      <mesh
        position={[sx * 0.2, y0 + motorR * 2 + 0.08, 0]}
        castShadow
      >
        <boxGeometry args={[sx * 0.28, sy * 0.22, sz * 0.42]} />
        <Mat color="#0c0e12" roughness={0.4} metalness={0.2} selected={selected} />
      </mesh>
      {/* Display face */}
      <mesh position={[sx * 0.2, y0 + motorR * 2 + 0.1, sz * 0.22]}>
        <boxGeometry args={[sx * 0.2, sy * 0.12, 0.012]} />
        <Mat
          color="#1a4060"
          roughness={0.3}
          emissive="#3a8ecc"
          emissiveIntensity={0.35}
          selected={selected}
        />
      </mesh>
      {/* Union ports */}
      <mesh
        position={[-sx * 0.48, y0 + wetH * 0.35, sz * 0.28]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.04, 0.045, 0.08, 12]} />
        <Mat color="#2a2e34" metalness={0.4} selected={selected} />
      </mesh>
      <mesh
        position={[-sx * 0.48, y0 + wetH * 0.35, -sz * 0.28]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.04, 0.045, 0.08, 12]} />
        <Mat color="#2a2e34" metalness={0.4} selected={selected} />
      </mesh>
    </group>
  );
}

/**
 * Cartridge filter — Clean & Clear Plus-like tall black tank + clamp + dome.
 */
function FilterMesh({ sx, sy, sz, selected, groupProps }: EquipProps) {
  const y0 = -sy / 2;
  const r = Math.min(sx, sz) * 0.42;
  const tankH = sy * 0.78;

  return (
    <group {...groupProps}>
      {/* Pedestal base */}
      <mesh position={[0, y0 + 0.04, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r * 1.05, r * 1.12, 0.08, 28]} />
        <Mat color="#1a1c20" roughness={0.7} selected={selected} />
      </mesh>

      {/* Main tank */}
      <mesh position={[0, y0 + 0.08 + tankH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, tankH, 32]} />
        <Mat color="#141618" roughness={0.48} metalness={0.15} selected={selected} />
      </mesh>

      {/* Tension clamp band */}
      <mesh position={[0, y0 + 0.08 + tankH * 0.72, 0]} castShadow>
        <cylinderGeometry args={[r * 1.04, r * 1.04, sy * 0.06, 32]} />
        <Mat color="#c8ccd0" roughness={0.35} metalness={0.65} selected={selected} />
      </mesh>
      {/* Clamp knob */}
      <mesh position={[r * 1.08, y0 + 0.08 + tankH * 0.72, 0]} castShadow>
        <boxGeometry args={[0.06, sy * 0.08, 0.04]} />
        <Mat color="#9aa0a6" metalness={0.5} selected={selected} />
      </mesh>

      {/* Domed lid */}
      <mesh position={[0, y0 + 0.08 + tankH + r * 0.15, 0]} castShadow>
        <sphereGeometry args={[r * 0.98, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat color="#1c1e22" roughness={0.45} metalness={0.2} selected={selected} />
      </mesh>

      {/* Air relief valve */}
      <mesh position={[0, y0 + 0.08 + tankH + r * 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.08, 10]} />
        <Mat color="#c45c2c" roughness={0.45} selected={selected} />
      </mesh>
      <mesh position={[0, y0 + 0.08 + tankH + r * 0.62, 0]}>
        <sphereGeometry args={[0.028, 10, 8]} />
        <Mat color="#d46838" selected={selected} />
      </mesh>

      {/* Bulkhead unions */}
      <mesh
        position={[r * 0.95, y0 + 0.08 + tankH * 0.22, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.055, 0.06, 0.12, 14]} />
        <Mat color="#0e1012" metalness={0.3} selected={selected} />
      </mesh>
      <mesh
        position={[-r * 0.95, y0 + 0.08 + tankH * 0.22, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.055, 0.06, 0.12, 14]} />
        <Mat color="#0e1012" metalness={0.3} selected={selected} />
      </mesh>
    </group>
  );
}

/**
 * Gas heater — MasterTemp-like metal cabinet with louvers + exhaust.
 */
function HeaterMesh({ sx, sy, sz, selected, groupProps }: EquipProps) {
  const y0 = -sy / 2;
  const bodyH = sy * 0.82;

  return (
    <group {...groupProps}>
      {/* Main cabinet */}
      <mesh position={[0, y0 + bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx * 0.92, bodyH, sz * 0.88]} />
        <Mat color="#d8dce0" roughness={0.55} metalness={0.35} selected={selected} />
      </mesh>

      {/* Darker base skirt */}
      <mesh position={[0, y0 + 0.06, 0]} castShadow>
        <boxGeometry args={[sx * 0.94, 0.12, sz * 0.9]} />
        <Mat color="#6a7078" roughness={0.6} metalness={0.4} selected={selected} />
      </mesh>

      {/* Front control door */}
      <mesh position={[0, y0 + bodyH * 0.55, sz * 0.445]} castShadow>
        <boxGeometry args={[sx * 0.55, bodyH * 0.35, 0.02]} />
        <Mat color="#c5cad0" roughness={0.5} metalness={0.3} selected={selected} />
      </mesh>
      {/* Digital display */}
      <mesh position={[0, y0 + bodyH * 0.62, sz * 0.46]}>
        <boxGeometry args={[sx * 0.28, bodyH * 0.1, 0.015]} />
        <Mat
          color="#1a2838"
          roughness={0.35}
          emissive="#4a9ad4"
          emissiveIntensity={0.4}
          selected={selected}
        />
      </mesh>

      {/* Side louvers (left / right) */}
      {([-1, 1] as const).map((side) =>
        [0.28, 0.4, 0.52, 0.64, 0.76].map((fy, i) => (
          <mesh
            key={`${side}-${i}`}
            position={[side * sx * 0.465, y0 + bodyH * fy, 0]}
            castShadow
          >
            <boxGeometry args={[0.02, bodyH * 0.045, sz * 0.55]} />
            <Mat color="#8a929a" roughness={0.55} metalness={0.45} selected={selected} />
          </mesh>
        )),
      )}

      {/* Top exhaust rain cap */}
      <mesh position={[0, y0 + bodyH + 0.04, 0]} castShadow>
        <cylinderGeometry args={[sx * 0.12, sx * 0.14, 0.08, 16]} />
        <Mat color="#5a6068" metalness={0.5} selected={selected} />
      </mesh>
      <mesh position={[0, y0 + bodyH + 0.1, 0]} castShadow>
        <cylinderGeometry args={[sx * 0.18, sx * 0.16, 0.04, 16]} />
        <Mat color="#4a5058" metalness={0.45} selected={selected} />
      </mesh>

      {/* Water unions at rear */}
      <mesh
        position={[sx * 0.25, y0 + bodyH * 0.25, -sz * 0.48]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.045, 0.05, 0.1, 12]} />
        <Mat color="#2a3038" metalness={0.4} selected={selected} />
      </mesh>
      <mesh
        position={[-sx * 0.25, y0 + bodyH * 0.25, -sz * 0.48]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.045, 0.05, 0.1, 12]} />
        <Mat color="#2a3038" metalness={0.4} selected={selected} />
      </mesh>
    </group>
  );
}

/**
 * Salt cell — IntelliChlor-like horizontal cell + control head.
 */
function SaltCellMesh({ sx, sy, sz, selected, groupProps }: EquipProps) {
  const y0 = -sy / 2;
  const cellR = Math.min(sz * 0.35, sy * 0.28);
  const cellLen = sx * 0.72;

  return (
    <group {...groupProps}>
      {/* Mounting feet / saddle */}
      <mesh position={[0, y0 + 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx * 0.85, 0.06, sz * 0.7]} />
        <Mat color="#2a2e34" roughness={0.7} selected={selected} />
      </mesh>

      {/* Cell body */}
      <mesh
        position={[0, y0 + cellR + 0.08, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[cellR, cellR, cellLen, 24]} />
        <Mat color="#1a1c20" roughness={0.5} metalness={0.2} selected={selected} />
      </mesh>

      {/* End unions */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * (cellLen / 2 + 0.04), y0 + cellR + 0.08, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[cellR * 0.72, cellR * 0.78, 0.08, 14]} />
          <Mat color="#0e1012" metalness={0.35} selected={selected} />
        </mesh>
      ))}

      {/* Control / electronics head */}
      <mesh
        position={[0, y0 + cellR * 2 + 0.12, 0]}
        castShadow
      >
        <boxGeometry args={[sx * 0.38, sy * 0.28, sz * 0.55]} />
        <Mat color="#0c0e12" roughness={0.4} metalness={0.15} selected={selected} />
      </mesh>
      {/* Status LEDs */}
      {(
        [
          ["#2ecc71", -0.06],
          ["#f1c40f", 0],
          ["#e74c3c", 0.06],
        ] as const
      ).map(([c, dx]) => (
        <mesh
          key={c}
          position={[dx, y0 + cellR * 2 + 0.18, sz * 0.29]}
        >
          <sphereGeometry args={[0.012, 8, 6]} />
          <Mat
            color={c}
            emissive={c}
            emissiveIntensity={0.6}
            roughness={0.3}
            selected={selected}
          />
        </mesh>
      ))}

      {/* Cable stub to power center */}
      <mesh
        position={[sx * 0.15, y0 + cellR * 2 + 0.28, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
        <Mat color="#1a1a1a" selected={selected} />
      </mesh>
    </group>
  );
}

export function PadEquipmentMesh({
  catalogId,
  sx,
  sy,
  sz,
  selected,
  groupProps,
}: {
  catalogId: string;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  groupProps: Record<string, unknown>;
}) {
  const props: EquipProps = { sx, sy, sz, selected, groupProps };

  if (catalogId === "equip_pad") return <EquipPadMesh {...props} />;
  if (catalogId === "pump_variable_speed" || catalogId.includes("pump")) {
    return <PumpMesh {...props} />;
  }
  if (catalogId === "filter_cartridge" || catalogId.includes("filter")) {
    return <FilterMesh {...props} />;
  }
  if (catalogId === "heater_gas" || catalogId.includes("heater")) {
    return <HeaterMesh {...props} />;
  }
  if (catalogId === "salt_chlorinator" || catalogId.includes("salt")) {
    return <SaltCellMesh {...props} />;
  }
  // Generic equipment fallback
  return <PumpMesh {...props} />;
}

export function isPadEquipmentCatalogId(catalogId: string): boolean {
  return (
    catalogId === "equip_pad" ||
    catalogId === "pump_variable_speed" ||
    catalogId === "filter_cartridge" ||
    catalogId === "heater_gas" ||
    catalogId === "salt_chlorinator" ||
    catalogId.includes("pump") ||
    catalogId.includes("filter") ||
    catalogId.includes("heater") ||
    catalogId.includes("salt") ||
    catalogId.startsWith("equip_")
  );
}
