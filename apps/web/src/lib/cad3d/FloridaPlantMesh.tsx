"use client";

import { useContext, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  getFloridaPlant,
  plantCssColor,
  type FloridaPlant,
  type PlantBloom,
  type PlantForm,
} from "@pool-design/shared";
import { ClipPlanesContext } from "@/lib/cad3d/clipContext";

type GroupProps = {
  position: [number, number, number];
  rotation: [number, number, number];
} & Record<string, unknown>;

type Props = {
  catalogId: string;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  groupProps: GroupProps;
};

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

function PlantMat({
  color,
  roughness = 0.88,
  metalness = 0,
  selected,
  opacity = 1,
  doubleSide = false,
}: {
  color: string;
  roughness?: number;
  metalness?: number;
  selected: boolean;
  opacity?: number;
  doubleSide?: boolean;
}) {
  const clippingPlanes = useContext(ClipPlanesContext);
  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      transparent={opacity < 0.99}
      opacity={opacity}
      side={doubleSide ? THREE.DoubleSide : THREE.FrontSide}
      emissive={selected ? "#1f8a70" : "#000000"}
      emissiveIntensity={selected ? 0.22 : 0}
      clippingPlanes={clippingPlanes}
      clipShadows={clippingPlanes.length > 0}
    />
  );
}

function flowerGeometry(bloom: PlantBloom): THREE.BufferGeometry | null {
  if (bloom === "none") return null;
  if (bloom === "saucer") {
    const g = new THREE.SphereGeometry(0.07, 8, 6);
    g.scale(1.35, 0.28, 1.35);
    return g;
  }
  if (bloom === "cluster") {
    const g = new THREE.SphereGeometry(0.045, 7, 5);
    g.scale(1.15, 0.85, 1.15);
    return g;
  }
  if (bloom === "trumpet") {
    const g = new THREE.ConeGeometry(0.04, 0.1, 6, 1, true);
    g.rotateX(Math.PI);
    return g;
  }
  if (bloom === "spike") {
    const g = new THREE.CylinderGeometry(0.018, 0.028, 0.22, 7);
    return g;
  }
  if (bloom === "bract") {
    const g = new THREE.ConeGeometry(0.055, 0.08, 5, 1, true);
    g.scale(1.4, 0.45, 1);
    return g;
  }
  if (bloom === "star") {
    const g = new THREE.SphereGeometry(0.055, 6, 5);
    g.scale(1.4, 0.22, 1.4);
    return g;
  }
  if (bloom === "bird") {
    const g = new THREE.BoxGeometry(0.16, 0.04, 0.05);
    g.scale(1, 1, 1);
    return g;
  }
  return null;
}

function fanFrondGeometry(silver: boolean): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(silver ? 0.42 : 0.32, 1, 8, 1, true);
  g.translate(0, 0.5, 0);
  g.scale(1, 1, silver ? 0.08 : 0.1);
  return g;
}

function pinnateFrondGeometry(plumose: boolean): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(plumose ? 0.22 : 0.14, 1, plumose ? 0.08 : 0.055);
  g.translate(0, 0.5, 0);
  return g;
}

function leafBladeGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.08, 8, 6);
  g.scale(1.6, 0.18, 0.7);
  return g;
}

function paddleGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.22, 10, 8);
  g.scale(0.55, 1.35, 0.08);
  g.translate(0, 0.55, 0);
  return g;
}

function heartLeafGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.22, 10, 8);
  g.scale(1.15, 1.25, 0.08);
  g.translate(0, 0.4, 0);
  return g;
}

function swordGeometry(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(0.06, 1, 5, 1, true);
  g.translate(0, 0.5, 0);
  g.scale(1, 1, 0.18);
  return g;
}

type ScatterSpec = {
  count: number;
  geo: THREE.BufferGeometry;
  color: string;
  roughness?: number;
  doubleSide?: boolean;
  place: (i: number, rng: () => number, dummy: THREE.Object3D) => void;
};

function InstancedParts({
  spec,
  seed,
  selected,
}: {
  spec: ScatterSpec;
  seed: number;
  selected: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || spec.count <= 0) return;
    const dummy = new THREE.Object3D();
    const rng = mulberry32(seed);
    for (let i = 0; i < spec.count; i++) {
      spec.place(i, rng, dummy);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [seed, spec]);
  if (spec.count <= 0) return null;
  return (
    <instancedMesh ref={ref} args={[spec.geo, undefined, spec.count]} castShadow>
      <PlantMat
        color={spec.color}
        roughness={spec.roughness ?? 0.9}
        selected={selected}
        doubleSide={spec.doubleSide}
      />
    </instancedMesh>
  );
}

function Trunk({
  y0,
  height,
  rBase,
  rTop,
  color,
  selected,
  lean = 0,
  segments = 10,
}: {
  y0: number;
  height: number;
  rBase: number;
  rTop: number;
  color: string;
  selected: boolean;
  lean?: number;
  segments?: number;
}) {
  return (
    <mesh
      position={[lean * height * 0.35, y0 + height / 2, 0]}
      rotation={[0, 0, lean]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[rTop, rBase, height, segments]} />
      <PlantMat color={color} roughness={0.92} selected={selected} />
    </mesh>
  );
}

function CanopyBlobs({
  plant,
  y0,
  sx,
  sy,
  sz,
  selected,
  count,
  spreadY,
  yCenter,
  blobScale = 1,
}: {
  plant: FloridaPlant;
  y0: number;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  count: number;
  spreadY: number;
  yCenter: number;
  blobScale?: number;
}) {
  const geo = useMemo(() => new THREE.SphereGeometry(0.5, 12, 10), []);
  const alt = plant.foliageAlt ?? plant.foliage;
  const specs = useMemo((): ScatterSpec[] => {
    const place =
      (colorIndex: number): ScatterSpec["place"] =>
      (i, rng, dummy) => {
        const a = rng() * Math.PI * 2;
        const r = 0.18 + rng() * 0.38;
        dummy.position.set(
          Math.cos(a) * r * sx,
          y0 + yCenter + (rng() - 0.45) * spreadY,
          Math.sin(a) * r * sz,
        );
        dummy.rotation.set(rng() * 0.5, rng() * Math.PI, rng() * 0.5);
        const s = blobScale * (0.22 + rng() * 0.28) * Math.max(sx, sz);
        dummy.scale.set(s * (0.85 + rng() * 0.3), s * (0.7 + rng() * 0.4), s * (0.85 + rng() * 0.3));
        if (colorIndex === 1 && i % 3 !== 0) dummy.scale.set(0, 0, 0);
      };
    return [
      {
        count,
        geo,
        color: plantCssColor(plant.foliage),
        place: place(0),
      },
      {
        count: Math.max(3, Math.round(count * 0.35)),
        geo,
        color: plantCssColor(alt),
        roughness: 0.86,
        place: place(1),
      },
    ];
  }, [alt, blobScale, count, geo, plant.foliage, spreadY, sx, sz, y0, yCenter]);
  const seed = hashStr(plant.id) ^ Math.round(sx * 40);
  return (
    <>
      {specs.map((spec, i) => (
        <InstancedParts key={i} spec={spec} seed={seed + i * 97} selected={selected} />
      ))}
    </>
  );
}

function BloomScatter({
  plant,
  y0,
  sx,
  sy,
  sz,
  selected,
  yCenter,
  spreadY,
  count,
}: {
  plant: FloridaPlant;
  y0: number;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
  yCenter: number;
  spreadY: number;
  count: number;
}) {
  const geo = useMemo(() => flowerGeometry(plant.bloom), [plant.bloom]);
  const spec = useMemo((): ScatterSpec | null => {
    if (!geo || !plant.flower || count <= 0) return null;
    const scale = Math.max(0.7, plant.flowerSize);
    return {
      count,
      geo,
      color: plantCssColor(plant.flower),
      roughness: 0.55,
      place: (_i, rng, dummy) => {
        const a = rng() * Math.PI * 2;
        const r = 0.15 + rng() * 0.42;
        dummy.position.set(
          Math.cos(a) * r * sx,
          y0 + yCenter + (rng() - 0.3) * spreadY,
          Math.sin(a) * r * sz,
        );
        dummy.rotation.set(rng() * 0.8, rng() * Math.PI * 2, rng() * 0.6);
        const s = scale * (0.7 + rng() * 0.6) * Math.max(0.35, Math.min(sx, sz) * 0.12);
        dummy.scale.set(s, s, s);
      },
    };
  }, [count, geo, plant.flower, plant.flowerSize, spreadY, sx, sz, y0, yCenter]);
  if (!spec) return null;
  return (
    <InstancedParts
      spec={spec}
      seed={hashStr(`${plant.id}-bloom`) ^ Math.round(sy * 20)}
      selected={selected}
    />
  );
}

function FruitScatter({
  color,
  y0,
  sx,
  sz,
  yCenter,
  count,
  selected,
  seed,
}: {
  color: string;
  y0: number;
  sx: number;
  sz: number;
  yCenter: number;
  count: number;
  selected: boolean;
  seed: number;
}) {
  const geo = useMemo(() => new THREE.SphereGeometry(0.045, 8, 6), []);
  const spec = useMemo(
    (): ScatterSpec => ({
      count,
      geo,
      color,
      roughness: 0.45,
      place: (_i, rng, dummy) => {
        const a = rng() * Math.PI * 2;
        dummy.position.set(
          Math.cos(a) * (0.12 + rng() * 0.32) * sx,
          y0 + yCenter + (rng() - 0.5) * 0.35 * yCenter,
          Math.sin(a) * (0.12 + rng() * 0.32) * sz,
        );
        dummy.rotation.set(0, rng() * Math.PI, 0);
        const s = 0.7 + rng() * 0.55;
        dummy.scale.set(s, s, s);
      },
    }),
    [count, geo, sx, sz, y0, yCenter],
  );
  return <InstancedParts spec={spec} seed={seed} selected={selected} />;
}

function PalmFronds({
  form,
  plant,
  yCrown,
  radius,
  selected,
}: {
  form: PlantForm;
  plant: FloridaPlant;
  yCrown: number;
  radius: number;
  selected: boolean;
}) {
  const silver = plant.id === "bismarck_palm";
  const saw = form === "saw_palmetto";
  const fan = form === "fan_palm" || saw;
  const plumose = form === "foxtail_palm" || plant.id === "queen_palm";
  const geo = useMemo(
    () => (fan ? fanFrondGeometry(silver) : pinnateFrondGeometry(plumose)),
    [fan, plumose, silver],
  );
  const count = saw
    ? 14
    : silver
      ? 16
      : fan
        ? 18
        : form === "foxtail_palm"
          ? 28
          : form === "coconut_palm"
            ? 22
            : plant.id === "canary_date"
              ? 36
              : 24;
  const spec = useMemo(
    (): ScatterSpec => ({
      count,
      geo,
      color: plantCssColor(plant.foliage),
      roughness: silver ? 0.72 : 0.88,
      doubleSide: true,
      place: (i, rng, dummy) => {
        const t = i / count;
        const yaw = t * Math.PI * 2 + rng() * 0.18;
        const droop = fan
          ? silver
            ? 0.55 + rng() * 0.35
            : saw
              ? 0.9 + rng() * 0.5
              : 0.7 + rng() * 0.45
          : form === "coconut_palm"
            ? 0.85 + rng() * 0.55
            : plant.id === "canary_date"
              ? 0.55 + rng() * 0.35
              : 0.65 + rng() * 0.5;
        const len = radius * (fan ? (silver ? 1.15 : 1) : plumose ? 1.05 : 1) * (0.78 + rng() * 0.28);
        dummy.position.set(
          Math.cos(yaw) * radius * 0.08,
          yCrown,
          Math.sin(yaw) * radius * 0.08,
        );
        dummy.rotation.set(droop, yaw, (rng() - 0.5) * 0.25);
        dummy.scale.set(
          fan ? radius * (silver ? 1.15 : 0.85) : radius * (plumose ? 0.55 : 0.42),
          len,
          fan ? radius * 0.85 : radius * (plumose ? 0.7 : 0.55),
        );
      },
    }),
    [count, fan, form, geo, plant.foliage, plant.id, plumose, radius, silver, yCrown],
  );
  return (
    <InstancedParts
      spec={spec}
      seed={hashStr(plant.id) ^ Math.round(radius * 80)}
      selected={selected}
    />
  );
}

function PalmPlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const r = Math.min(sx, sz) * 0.5;
  const saw = plant.form === "saw_palmetto";
  const coconut = plant.form === "coconut_palm";
  const royal = plant.form === "royal_palm";
  const clump = plant.form === "clumping_palm";
  const canary = plant.id === "canary_date";
  const lean = coconut ? -0.22 : 0;
  const trunkH = saw ? sy * 0.22 : royal ? sy * 0.72 : coconut ? sy * 0.7 : sy * 0.68;
  const rBase = saw
    ? r * 0.12
    : canary
      ? r * 0.16
      : royal
        ? r * 0.09
        : coconut
          ? r * 0.07
          : r * 0.065;
  const rTop = royal ? rBase * 0.82 : rBase * 0.62;
  const yCrown = y0 + trunkH + (royal ? sy * 0.06 : 0);

  if (clump) {
    const stems = 7;
    return (
      <group>
        {Array.from({ length: stems }, (_, i) => {
          const a = (i / stems) * Math.PI * 2;
          const rr = r * (0.12 + (i % 3) * 0.07);
          const h = trunkH * (0.55 + (i % 4) * 0.12);
          return (
            <group key={i} position={[Math.cos(a) * rr, 0, Math.sin(a) * rr]}>
              <Trunk
                y0={y0}
                height={h}
                rBase={r * 0.028}
                rTop={r * 0.02}
                color={plantCssColor(plant.trunk)}
                selected={selected}
                segments={8}
              />
              <PalmFronds
                form="feather_palm"
                plant={plant}
                yCrown={y0 + h}
                radius={r * 0.42}
                selected={selected}
              />
            </group>
          );
        })}
      </group>
    );
  }

  return (
    <group>
      <Trunk
        y0={y0}
        height={trunkH}
        rBase={rBase}
        rTop={rTop}
        color={plantCssColor(plant.trunk)}
        selected={selected}
        lean={lean}
        segments={canary ? 12 : 10}
      />
      {royal ? (
        <mesh
          position={[0, y0 + trunkH + sy * 0.05, 0]}
          castShadow
        >
          <cylinderGeometry args={[r * 0.07, r * 0.085, sy * 0.1, 12]} />
          <PlantMat color="#3d7a48" roughness={0.55} selected={selected} />
        </mesh>
      ) : null}
      {plant.id === "sabal_palmetto" ? (
        <mesh position={[0, y0 + trunkH * 0.92, 0]} castShadow>
          <sphereGeometry args={[r * 0.12, 8, 6]} />
          <PlantMat color="#6a5a44" roughness={0.95} selected={selected} />
        </mesh>
      ) : null}
      <PalmFronds
        form={plant.form}
        plant={plant}
        yCrown={yCrown}
        radius={r * (saw ? 0.95 : 0.92)}
        selected={selected}
      />
      {coconut ? (
        <FruitScatter
          color="#6a4220"
          y0={y0}
          sx={sx * 0.35}
          sz={sz * 0.35}
          yCenter={trunkH * 0.92}
          count={5}
          selected={selected}
          seed={hashStr(plant.id)}
        />
      ) : null}
    </group>
  );
}

function TravelersPlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const geo = useMemo(() => paddleGeometry(), []);
  const n = 11;
  const spec = useMemo(
    (): ScatterSpec => ({
      count: n,
      geo,
      color: plantCssColor(plant.foliage),
      doubleSide: true,
      place: (i, rng, dummy) => {
        const t = i / (n - 1) - 0.5;
        const angle = t * 1.15;
        dummy.position.set(0, y0 + sy * 0.12, 0);
        dummy.rotation.set(0, 0, angle);
        dummy.scale.set(
          sx * (0.35 + rng() * 0.08),
          sy * (0.55 + rng() * 0.12),
          Math.max(0.08, sz * 0.22),
        );
      },
    }),
    [geo, n, plant.foliage, sx, sy, sz, y0],
  );
  return (
    <group>
      <mesh position={[0, y0 + sy * 0.12, 0]} castShadow>
        <sphereGeometry args={[Math.min(sx, sz) * 0.12, 10, 8]} />
        <PlantMat color={plantCssColor(plant.trunk)} roughness={0.8} selected={selected} />
      </mesh>
      <InstancedParts spec={spec} seed={hashStr(plant.id)} selected={selected} />
    </group>
  );
}

function TreePlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const oak = plant.form === "live_oak";
  const gumbo = plant.form === "gumbo_limbo";
  const pine = plant.form === "pine";
  const cypress = plant.form === "cypress";
  const crape = plant.form === "crape_myrtle";
  const frangipani = plant.form === "frangipani";
  const bottle = plant.form === "bottlebrush";
  const magnolia = plant.form === "magnolia";
  const citrus = plant.form === "citrus";
  const sea = plant.form === "sea_grape";
  const jacaranda = plant.form === "jacaranda";
  const r = Math.min(sx, sz) * 0.5;
  const trunkH = pine
    ? sy * 0.62
    : oak
      ? sy * 0.32
      : crape || frangipani
        ? sy * 0.42
        : cypress
          ? sy * 0.55
          : sy * 0.38;
  const rBase = oak || gumbo ? r * 0.09 : pine ? r * 0.045 : cypress ? r * 0.1 : r * 0.055;
  const rTop = pine ? rBase * 0.7 : rBase * 0.62;
  const yCanopy = trunkH * (pine ? 1.15 : oak ? 1.35 : 1.2);
  const blobN = oak ? 22 : jacaranda ? 18 : pine ? 10 : cypress ? 12 : sea ? 14 : 16;

  if (frangipani) {
    const arms = 6;
    return (
      <group>
        <Trunk
          y0={y0}
          height={trunkH * 0.7}
          rBase={rBase * 1.3}
          rTop={rBase * 1.05}
          color={plantCssColor(plant.trunk)}
          selected={selected}
          segments={8}
        />
        {Array.from({ length: arms }, (_, i) => {
          const a = (i / arms) * Math.PI * 2;
          const len = sy * 0.38;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(a) * r * 0.18,
                y0 + trunkH * 0.7 + len * 0.32,
                Math.sin(a) * r * 0.18,
              ]}
              rotation={[0.55, a, 0]}
              castShadow
            >
              <cylinderGeometry args={[r * 0.028, r * 0.045, len, 7]} />
              <PlantMat color={plantCssColor(plant.trunk)} roughness={0.78} selected={selected} />
            </mesh>
          );
        })}
        <CanopyBlobs
          plant={plant}
          y0={y0}
          sx={sx * 0.7}
          sy={sy}
          sz={sz * 0.7}
          selected={selected}
          count={10}
          yCenter={sy * 0.72}
          spreadY={sy * 0.18}
          blobScale={0.55}
        />
        <BloomScatter
          plant={plant}
          y0={y0}
          sx={sx * 0.75}
          sy={sy}
          sz={sz * 0.75}
          selected={selected}
          yCenter={sy * 0.78}
          spreadY={sy * 0.16}
          count={28}
        />
      </group>
    );
  }

  if (crape) {
    return (
      <group>
        {[-0.12, 0, 0.14].map((t, i) => (
          <Trunk
            key={i}
            y0={y0}
            height={trunkH * (0.85 + i * 0.08)}
            rBase={rBase * 0.55}
            rTop={rBase * 0.35}
            color={plantCssColor(plant.trunk)}
            selected={selected}
            lean={t * 0.8}
            segments={8}
          />
        ))}
        <CanopyBlobs
          plant={plant}
          y0={y0}
          sx={sx}
          sy={sy}
          sz={sz}
          selected={selected}
          count={14}
          yCenter={sy * 0.68}
          spreadY={sy * 0.28}
          blobScale={0.7}
        />
        <BloomScatter
          plant={plant}
          y0={y0}
          sx={sx}
          sy={sy}
          sz={sz}
          selected={selected}
          yCenter={sy * 0.72}
          spreadY={sy * 0.22}
          count={36}
        />
      </group>
    );
  }

  if (cypress) {
    return (
      <group>
        <mesh position={[0, y0 + sy * 0.08, 0]} castShadow>
          <cylinderGeometry args={[r * 0.16, r * 0.28, sy * 0.16, 8]} />
          <PlantMat color={plantCssColor(plant.trunk)} roughness={0.95} selected={selected} />
        </mesh>
        <Trunk
          y0={y0 + sy * 0.08}
          height={trunkH}
          rBase={rBase}
          rTop={rTop * 0.5}
          color={plantCssColor(plant.trunk)}
          selected={selected}
        />
        {[0.38, 0.52, 0.66, 0.8, 0.92].map((t, i) => (
          <mesh key={i} position={[0, y0 + sy * t, 0]} castShadow>
            <sphereGeometry args={[r * (0.72 - i * 0.1), 12, 10]} />
            <PlantMat color={plantCssColor(plant.foliage)} roughness={0.92} selected={selected} />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group>
      <Trunk
        y0={y0}
        height={trunkH}
        rBase={rBase}
        rTop={rTop}
        color={plantCssColor(plant.trunk)}
        selected={selected}
        lean={gumbo ? 0.08 : 0}
      />
      <CanopyBlobs
        plant={plant}
        y0={y0}
        sx={sx * (oak ? 1 : pine ? 0.7 : 0.92)}
        sy={sy}
        sz={sz * (oak ? 1 : pine ? 0.7 : 0.92)}
        selected={selected}
        count={blobN}
        yCenter={yCanopy}
        spreadY={sy * (oak ? 0.38 : pine ? 0.22 : magnolia ? 0.32 : 0.28)}
        blobScale={oak ? 0.85 : pine ? 0.55 : sea ? 0.7 : 0.72}
      />
      {citrus ? (
        <FruitScatter
          color="#e07020"
          y0={y0}
          sx={sx * 0.7}
          sz={sz * 0.7}
          yCenter={yCanopy}
          count={16}
          selected={selected}
          seed={hashStr(plant.id)}
        />
      ) : null}
      {bottle ? (
        <BloomScatter
          plant={plant}
          y0={y0}
          sx={sx * 0.7}
          sy={sy}
          sz={sz * 0.7}
          selected={selected}
          yCenter={yCanopy * 0.85}
          spreadY={sy * 0.35}
          count={22}
        />
      ) : (
        <BloomScatter
          plant={plant}
          y0={y0}
          sx={sx}
          sy={sy}
          sz={sz}
          selected={selected}
          yCenter={yCanopy}
          spreadY={sy * 0.22}
          count={plant.bloom === "none" ? 0 : magnolia ? 12 : jacaranda ? 40 : 22}
        />
      )}
    </group>
  );
}

function ShrubPlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const hedge = plant.form === "hedge";
  const variegated = plant.form === "variegated_shrub";
  return (
    <group>
      <mesh position={[0, y0 + sy * 0.08, 0]} castShadow>
        <cylinderGeometry
          args={[Math.min(sx, sz) * 0.06, Math.min(sx, sz) * 0.08, sy * 0.16, 8]}
        />
        <PlantMat color={plantCssColor(plant.trunk)} roughness={0.92} selected={selected} />
      </mesh>
      <CanopyBlobs
        plant={plant}
        y0={y0}
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        count={variegated ? 18 : hedge ? 12 : 14}
        yCenter={sy * (hedge ? 0.52 : 0.48)}
        spreadY={sy * (hedge ? 0.42 : 0.38)}
        blobScale={hedge ? 0.62 : 0.72}
      />
      <BloomScatter
        plant={plant}
        y0={y0}
        sx={sx}
        sy={sy}
        sz={sz}
        selected={selected}
        yCenter={sy * 0.55}
        spreadY={sy * 0.32}
        count={plant.bloom === "none" ? 0 : plant.form === "flowering_shrub" ? 28 : 14}
      />
    </group>
  );
}

function RosettePlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const cycad = plant.form === "cycad";
  const geo = useMemo(
    () => (cycad ? pinnateFrondGeometry(false) : swordGeometry()),
    [cycad],
  );
  const n = cycad ? 16 : plant.id === "bromeliad" ? 18 : 20;
  const spec = useMemo(
    (): ScatterSpec => ({
      count: n,
      geo,
      color: plantCssColor(plant.foliage),
      doubleSide: true,
      place: (i, rng, dummy) => {
        const yaw = (i / n) * Math.PI * 2;
        dummy.position.set(0, y0 + sy * 0.08, 0);
        dummy.rotation.set(cycad ? 0.85 + rng() * 0.35 : 0.95 + rng() * 0.4, yaw, 0);
        dummy.scale.set(
          Math.min(sx, sz) * (cycad ? 0.28 : 0.45),
          sy * (0.7 + rng() * 0.2),
          Math.min(sx, sz) * (cycad ? 0.22 : 0.18),
        );
      },
    }),
    [cycad, geo, n, plant.foliage, sx, sy, sz, y0],
  );
  return (
    <group>
      <mesh position={[0, y0 + sy * 0.06, 0]} castShadow>
        <sphereGeometry args={[Math.min(sx, sz) * 0.1, 8, 6]} />
        <PlantMat
          color={plantCssColor(plant.foliageAlt ?? plant.trunk)}
          roughness={0.85}
          selected={selected}
        />
      </mesh>
      <InstancedParts spec={spec} seed={hashStr(plant.id)} selected={selected} />
      {plant.id === "bromeliad" && plant.flower ? (
        <mesh position={[0, y0 + sy * 0.55, 0]} castShadow>
          <coneGeometry args={[Math.min(sx, sz) * 0.12, sy * 0.45, 6]} />
          <PlantMat color={plantCssColor(plant.flower)} roughness={0.5} selected={selected} />
        </mesh>
      ) : null}
    </group>
  );
}

function PaddleClump({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const banana = plant.form === "banana";
  const ear = plant.form === "elephant_ear";
  const phil = plant.form === "philodendron";
  const geo = useMemo(
    () => (ear ? heartLeafGeometry() : paddleGeometry()),
    [ear],
  );
  const n = banana ? 9 : ear ? 7 : phil ? 10 : 8;
  const spec = useMemo(
    (): ScatterSpec => ({
      count: n,
      geo,
      color: plantCssColor(plant.foliage),
      doubleSide: true,
      place: (i, rng, dummy) => {
        const a = (i / n) * Math.PI * 2 + rng() * 0.2;
        const spread = banana ? 0.18 : 0.22;
        dummy.position.set(
          Math.cos(a) * sx * spread,
          y0 + sy * (banana ? 0.18 : 0.12),
          Math.sin(a) * sz * spread,
        );
        dummy.rotation.set(
          (rng() - 0.3) * 0.45,
          a + (phil ? 0.4 : 0),
          (rng() - 0.5) * 0.35,
        );
        dummy.scale.set(
          (ear ? sx : sx) * (banana ? 0.55 : 0.42) * (0.85 + rng() * 0.25),
          sy * (banana ? 0.7 : 0.55) * (0.85 + rng() * 0.2),
          Math.max(0.06, sz * 0.12),
        );
      },
    }),
    [banana, ear, geo, n, phil, plant.foliage, sx, sy, sz, y0],
  );
  return (
    <group>
      <mesh position={[0, y0 + sy * (banana ? 0.28 : 0.12), 0]} castShadow>
        <cylinderGeometry
          args={[
            Math.min(sx, sz) * (banana ? 0.1 : 0.06),
            Math.min(sx, sz) * (banana ? 0.14 : 0.08),
            sy * (banana ? 0.5 : 0.2),
            8,
          ]}
        />
        <PlantMat color={plantCssColor(plant.trunk)} roughness={0.82} selected={selected} />
      </mesh>
      <InstancedParts spec={spec} seed={hashStr(plant.id)} selected={selected} />
      {(() => {
        const flower = plant.flower;
        if (plant.form !== "bird_of_paradise" || !flower) return null;
        return [0.15, -0.12].map((t, i) => (
            <group
              key={i}
              position={[sx * t, y0 + sy * 0.42, sz * 0.08]}
              rotation={[0.3, i * 0.8, 0.4]}
            >
              <mesh castShadow>
                <boxGeometry args={[sx * 0.22, sy * 0.04, sz * 0.05]} />
                <PlantMat color={plantCssColor(flower)} roughness={0.48} selected={selected} />
              </mesh>
              <mesh position={[sx * 0.08, sy * 0.04, 0]} castShadow>
                <boxGeometry args={[sx * 0.08, sy * 0.09, sz * 0.03]} />
                <PlantMat color="#3a6cb0" roughness={0.5} selected={selected} />
              </mesh>
            </group>
        ));
      })()}
    </group>
  );
}

function CordylinePlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const geo = useMemo(() => swordGeometry(), []);
  const spec = useMemo(
    (): ScatterSpec => ({
      count: 22,
      geo,
      color: plantCssColor(plant.foliage),
      doubleSide: true,
      place: (i, rng, dummy) => {
        dummy.position.set(0, y0 + sy * 0.42, 0);
        dummy.rotation.set(0.35 + rng() * 0.55, (i / 22) * Math.PI * 2, 0);
        dummy.scale.set(
          Math.min(sx, sz) * 0.55,
          sy * 0.55 * (0.75 + rng() * 0.3),
          Math.min(sx, sz) * 0.18,
        );
      },
    }),
    [geo, plant.foliage, sx, sy, sz, y0],
  );
  return (
    <group>
      <Trunk
        y0={y0}
        height={sy * 0.45}
        rBase={Math.min(sx, sz) * 0.045}
        rTop={Math.min(sx, sz) * 0.035}
        color={plantCssColor(plant.trunk)}
        selected={selected}
        segments={7}
      />
      <InstancedParts spec={spec} seed={hashStr(plant.id)} selected={selected} />
    </group>
  );
}

function FernPlant({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const y0 = -sy / 2;
  const geo = useMemo(() => pinnateFrondGeometry(true), []);
  const spec = useMemo(
    (): ScatterSpec => ({
      count: 18,
      geo,
      color: plantCssColor(plant.foliage),
      doubleSide: true,
      place: (i, rng, dummy) => {
        const yaw = (i / 18) * Math.PI * 2;
        dummy.position.set(0, y0 + sy * 0.08, 0);
        dummy.rotation.set(1.05 + rng() * 0.35, yaw, (rng() - 0.5) * 0.2);
        dummy.scale.set(
          Math.min(sx, sz) * 0.35,
          Math.max(sx, sz) * 0.55,
          Math.min(sx, sz) * 0.22,
        );
      },
    }),
    [geo, plant.foliage, sx, sy, sz, y0],
  );
  return <InstancedParts spec={spec} seed={hashStr(plant.id)} selected={selected} />;
}

function PlantBody({
  plant,
  sx,
  sy,
  sz,
  selected,
}: {
  plant: FloridaPlant;
  sx: number;
  sy: number;
  sz: number;
  selected: boolean;
}) {
  const form = plant.form;
  if (
    form === "fan_palm" ||
    form === "feather_palm" ||
    form === "royal_palm" ||
    form === "coconut_palm" ||
    form === "foxtail_palm" ||
    form === "clumping_palm" ||
    form === "saw_palmetto"
  ) {
    return <PalmPlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (form === "travelers") {
    return <TravelersPlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (
    form === "round_shrub" ||
    form === "variegated_shrub" ||
    form === "flowering_shrub" ||
    form === "hedge"
  ) {
    return <ShrubPlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (form === "rosette" || form === "cycad") {
    return <RosettePlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (
    form === "bird_of_paradise" ||
    form === "banana" ||
    form === "elephant_ear" ||
    form === "philodendron"
  ) {
    return <PaddleClump plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (form === "cordyline") {
    return <CordylinePlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  if (form === "fern") {
    return <FernPlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
  }
  return <TreePlant plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />;
}

export function FloridaPlantMesh({
  catalogId,
  sx,
  sy,
  sz,
  selected,
  groupProps,
}: Props) {
  const plant = getFloridaPlant(catalogId);
  if (!plant) return null;
  return (
    <group {...groupProps}>
      <PlantBody plant={plant} sx={sx} sy={sy} sz={sz} selected={selected} />
    </group>
  );
}
