"use client";

import { useMemo, useEffect } from "react";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  depthMmAtT,
  formatLength,
  mmToMeters,
  type UnitSystem,
} from "@pool-design/shared";
import type { BasinSectionFrame } from "@/lib/cad3d/buildScene";

type Props = {
  section: BasinSectionFrame;
  /** Cut slide in [-1, 1] across the pool width. */
  cutOffset: number;
  unitSystem?: UnitSystem;
};

type StationMark = {
  t: number;
  depthMm: number;
  u: number;
  floorY: number;
  isShallow: boolean;
  isDeep: boolean;
  dropoff: boolean;
};

function sampleTs(stations: BasinSectionFrame["depthStations"]): number[] {
  const ts: number[] = [];
  for (let i = 0; i <= 64; i++) ts.push(i / 64);
  for (const s of stations) {
    ts.push(
      Math.max(0, s.t - 0.003),
      s.t,
      Math.min(1, s.t + 0.003),
    );
  }
  ts.sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of ts) {
    const prev = out[out.length - 1];
    if (prev == null || Math.abs(prev - t) > 1e-5) out.push(t);
  }
  return out;
}

/**
 * Architectural longitudinal section: concrete U-shell, water in the cavity,
 * bold floor profile, and depth callouts at every station.
 */
export function SectionCapMesh({
  section,
  cutOffset,
  unitSystem = "imperial",
}: Props) {
  const o = Math.min(1, Math.max(-1, cutOffset));
  const planeOffset = o * section.halfSpan * 0.92 - 0.012;
  const nx = section.cutNormal.x;
  const nz = section.cutNormal.z;
  const dx = section.depthDir.x;
  const dz = section.depthDir.z;
  const cx = section.center.x;
  const cz = section.center.z;
  const half = section.halfLength;
  const wallU = Math.min(section.wallThicknessM, half * 0.35);
  const floorT = Math.max(0.12, section.wallThicknessM * 0.7);
  const lipY = section.lipY;
  const waterTop = section.waterTopY;
  const uLeft = -half;
  const uRight = half;
  const uLeftInner = uLeft + wallU;
  const uRightInner = uRight - wallU;

  const stations = useMemo(
    () =>
      section.depthStations.map((s) => ({
        id: "",
        t: s.t,
        depthMm: s.depthMm,
        transition: s.transition,
      })),
    [section.depthStations],
  );

  const floorYAt = (t: number) => -mmToMeters(depthMmAtT(stations, t));
  const tFromU = (u: number) => (u + half) / Math.max(1e-6, half * 2);

  const toWorld = (u: number, v: number, w = 0): [number, number, number] => [
    cx + dx * u + nx * (planeOffset + w),
    v,
    cz + dz * u + nz * (planeOffset + w),
  ];

  const geometry = useMemo(() => {
    const ts = sampleTs(section.depthStations);
    const innerTs = ts.filter(
      (t) => tFromU(uLeftInner) - 1e-6 <= t && t <= tFromU(uRightInner) + 1e-6,
    );
    if (innerTs[0] !== tFromU(uLeftInner)) innerTs.unshift(tFromU(uLeftInner));
    if (innerTs[innerTs.length - 1] !== tFromU(uRightInner)) {
      innerTs.push(tFromU(uRightInner));
    }

    const shell = new THREE.Shape();
    shell.moveTo(uLeft, lipY);
    shell.lineTo(uLeft, floorYAt(0) - floorT);
    for (const t of ts) {
      const u = -half + t * half * 2;
      shell.lineTo(u, floorYAt(t) - floorT);
    }
    shell.lineTo(uRight, floorYAt(1) - floorT);
    shell.lineTo(uRight, lipY);
    shell.lineTo(uRightInner, lipY);
    shell.lineTo(uRightInner, floorYAt(tFromU(uRightInner)));
    for (let i = innerTs.length - 1; i >= 0; i--) {
      const t = innerTs[i]!;
      const u = -half + t * half * 2;
      shell.lineTo(u, floorYAt(t));
    }
    shell.lineTo(uLeftInner, floorYAt(tFromU(uLeftInner)));
    shell.lineTo(uLeftInner, lipY);
    shell.closePath();

    const shellGeo = new THREE.ExtrudeGeometry(shell, {
      depth: 0.09,
      bevelEnabled: false,
      curveSegments: 1,
    });
    shellGeo.translate(0, 0, -0.09);

    const water = new THREE.Shape();
    water.moveTo(uLeftInner, waterTop);
    water.lineTo(uRightInner, waterTop);
    water.lineTo(uRightInner, floorYAt(tFromU(uRightInner)));
    for (let i = innerTs.length - 1; i >= 0; i--) {
      const t = innerTs[i]!;
      const u = -half + t * half * 2;
      water.lineTo(u, floorYAt(t));
    }
    water.lineTo(uLeftInner, floorYAt(tFromU(uLeftInner)));
    water.closePath();
    const waterGeo = new THREE.ShapeGeometry(water);

    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(dx, 0, dz),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(nx, 0, nz),
    );
    const origin = new THREE.Matrix4().makeTranslation(
      cx + nx * planeOffset,
      0,
      cz + nz * planeOffset,
    );
    const xform = origin.multiply(basis);
    shellGeo.applyMatrix4(xform);
    waterGeo.applyMatrix4(xform);
    waterGeo.translate(nx * 0.006, 0, nz * 0.006);
    shellGeo.computeVertexNormals();
    waterGeo.computeVertexNormals();

    return { shell: shellGeo, water: waterGeo };
    // floorYAt / tFromU close over half/stations; section + cut drive the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, cutOffset, floorT, half, lipY, nx, nz, dx, dz, cx, cz, planeOffset, uLeftInner, uRightInner, wallU, waterTop]);

  useEffect(
    () => () => {
      geometry.shell.dispose();
      geometry.water.dispose();
    },
    [geometry],
  );

  const marks = useMemo<StationMark[]>(() => {
    const last = section.depthStations.length - 1;
    return section.depthStations.map((s, i) => {
      const u = -half + s.t * half * 2;
      return {
        t: s.t,
        depthMm: s.depthMm,
        u: Math.min(uRightInner, Math.max(uLeftInner, u)),
        floorY: floorYAt(s.t),
        isShallow: i === 0,
        isDeep: i === last,
        dropoff: s.transition === "dropoff",
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.depthStations, half, uLeftInner, uRightInner]);

  const floorLine = useMemo(() => {
    const ts = sampleTs(section.depthStations).filter(
      (t) => tFromU(uLeftInner) <= t && t <= tFromU(uRightInner),
    );
    const pts: [number, number, number][] = [
      toWorld(uLeftInner, floorYAt(tFromU(uLeftInner)), 0.02),
    ];
    for (const t of ts) {
      pts.push(toWorld(-half + t * half * 2, floorYAt(t), 0.02));
    }
    pts.push(toWorld(uRightInner, floorYAt(tFromU(uRightInner)), 0.02));
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, cutOffset, half, uLeftInner, uRightInner]);

  const innerOutline = useMemo(() => {
    const pts: [number, number, number][] = [
      toWorld(uLeftInner, lipY, 0.018),
      toWorld(uLeftInner, floorYAt(tFromU(uLeftInner)), 0.018),
      ...floorLine.map((p) => [p[0], p[1], p[2]] as [number, number, number]),
      toWorld(uRightInner, floorYAt(tFromU(uRightInner)), 0.018),
      toWorld(uRightInner, lipY, 0.018),
    ];
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorLine, lipY, uLeftInner, uRightInner]);

  const waterlinePts = useMemo(
    (): [number, number, number][] => [
      toWorld(uLeftInner, waterTop, 0.022),
      toWorld(uRightInner, waterTop, 0.022),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section, cutOffset, uLeftInner, uRightInner, waterTop],
  );

  const gradePts = useMemo(
    (): [number, number, number][] => [
      toWorld(uLeft - 0.45, 0, 0.016),
      toWorld(uRight + 0.45, 0, 0.016),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section, cutOffset, uLeft, uRight],
  );

  return (
    <group>
      <mesh geometry={geometry.shell} renderOrder={2} raycast={() => null}>
        <meshStandardMaterial
          color="#d8d2c6"
          roughness={0.82}
          metalness={0.02}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh geometry={geometry.water} renderOrder={3} raycast={() => null}>
        <meshStandardMaterial
          color="#1a8fb5"
          roughness={0.1}
          metalness={0.08}
          transparent
          opacity={0.38}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <Line
        points={innerOutline}
        color="#3f4a52"
        lineWidth={1.75}
        depthTest={false}
        raycast={() => null}
      />
      <Line
        points={floorLine}
        color="#0f766e"
        lineWidth={4}
        depthTest={false}
        raycast={() => null}
      />
      <Line
        points={waterlinePts}
        color="#e0f4fb"
        lineWidth={1.5}
        dashed
        dashSize={0.12}
        gapSize={0.08}
        depthTest={false}
        raycast={() => null}
      />
      <Line
        points={gradePts}
        color="#8a8074"
        lineWidth={1.25}
        dashed
        dashSize={0.18}
        gapSize={0.1}
        depthTest={false}
        raycast={() => null}
      />

      {marks.map((m, i) => (
        <group key={`sec-dim-${i}`}>
          <Line
            points={[
              toWorld(m.u, waterTop, 0.024),
              toWorld(m.u, m.floorY, 0.024),
            ]}
            color={m.dropoff ? "#b45309" : "#1e2933"}
            lineWidth={1.35}
            dashed
            dashSize={0.07}
            gapSize={0.05}
            depthTest={false}
            raycast={() => null}
          />
          <Html
            position={toWorld(m.u, (waterTop + m.floorY) * 0.5, 0.08)}
            center
            occlude={false}
            style={{ pointerEvents: "none" }}
          >
            <div
              className={`cad-scene3d-section-label${m.dropoff ? " is-dropoff" : ""}`}
            >
              {formatLength(m.depthMm, unitSystem)}
            </div>
          </Html>
          {m.isShallow || m.isDeep ? (
            <Html
              position={toWorld(m.u, waterTop + 0.14, 0.08)}
              center
              occlude={false}
              style={{ pointerEvents: "none" }}
            >
              <div className="cad-scene3d-section-end">
                {m.isShallow ? "Shallow" : "Deep"}
              </div>
            </Html>
          ) : null}
        </group>
      ))}

      <Html
        position={toWorld(uLeft - 0.35, 0.12, 0.08)}
        center
        occlude={false}
        style={{ pointerEvents: "none" }}
      >
        <div className="cad-scene3d-section-end is-muted">Grade</div>
      </Html>
    </group>
  );
}
