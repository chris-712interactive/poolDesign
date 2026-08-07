"use client";

import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { depthMmAtT, mmToMeters } from "@pool-design/shared";
import type { BasinSectionFrame } from "@/lib/cad3d/buildScene";

type Props = {
  section: BasinSectionFrame;
  /** Cut slide in [-1, 1] across the pool width. */
  cutOffset: number;
};

/**
 * Solid longitudinal section fill so the cutaway reads as a filled cross-section
 * instead of hollow wall boxes.
 */
export function SectionCapMesh({ section, cutOffset }: Props) {
  const geometry = useMemo(() => {
    const samples = 48;
    const stations = section.depthStations.map((s) => ({
      id: "",
      t: s.t,
      depthMm: s.depthMm,
      transition: s.transition,
    }));
    const o = Math.min(1, Math.max(-1, cutOffset));
    // Sit just on the visible side of the clip plane.
    const planeOffset = o * section.halfSpan * 0.92 - 0.012;
    const nx = section.cutNormal.x;
    const nz = section.cutNormal.z;
    const dx = section.depthDir.x;
    const dz = section.depthDir.z;
    const cx = section.center.x + nx * planeOffset;
    const cz = section.center.z + nz * planeOffset;
    const half = section.halfLength * 0.98;
    const floorThick = 0.14;
    const lipY = section.lipY;
    const waterTop = section.waterTopY;

    const shellVerts: number[] = [];
    const shellIdx: number[] = [];
    const waterVerts: number[] = [];
    const waterIdx: number[] = [];

    const pushStrip = (
      verts: number[],
      indices: number[],
      topY: (t: number, floorY: number) => number,
      botY: (t: number, floorY: number) => number,
    ) => {
      const base = verts.length / 3;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const along = -half + t * half * 2;
        const floorY = -mmToMeters(depthMmAtT(stations, t));
        const x = cx + dx * along;
        const z = cz + dz * along;
        verts.push(x, topY(t, floorY), z);
        verts.push(x, botY(t, floorY), z);
      }
      for (let i = 0; i < samples; i++) {
        const a = base + i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    };

    // Shell fill: floor underside → coping lip
    pushStrip(
      shellVerts,
      shellIdx,
      () => lipY,
      (_t, floorY) => floorY - floorThick,
    );
    // Water fill: floor → waterline (drawn slightly toward camera via plane offset)
    pushStrip(
      waterVerts,
      waterIdx,
      () => waterTop,
      (_t, floorY) => floorY + 0.02,
    );

    const shell = new THREE.BufferGeometry();
    shell.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(shellVerts, 3),
    );
    shell.setIndex(shellIdx);
    shell.computeVertexNormals();

    const water = new THREE.BufferGeometry();
    water.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(waterVerts, 3),
    );
    water.setIndex(waterIdx);
    water.computeVertexNormals();

    return { shell, water };
  }, [section, cutOffset]);

  useEffect(
    () => () => {
      geometry.shell.dispose();
      geometry.water.dispose();
    },
    [geometry],
  );

  return (
    <group>
      <mesh geometry={geometry.shell} renderOrder={2}>
        <meshStandardMaterial
          color="#e8eeec"
          roughness={0.55}
          metalness={0.02}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh geometry={geometry.water} renderOrder={3}>
        <meshStandardMaterial
          color="#1a8fb5"
          roughness={0.12}
          metalness={0.12}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
