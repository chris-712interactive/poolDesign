/**
 * Standard residential pool package — fixtures + plumbing stubs.
 * Mirrors spa-defaults: dual VGBA drains, skimmers, returns, lights, steps.
 */

import { getPlaceableItem } from "./object-library";
import type {
  DesignDocument,
  PlacedObject,
  PlumbingRun,
  PointMm,
  PoolBody,
  PoolFeature,
} from "./design-model";
import {
  DEFAULT_POOL_DEEP_MM,
  DEFAULT_POOL_SHALLOW_MM,
  DEFAULT_POOL_WALL_THICKNESS_MM,
} from "./design-model";
import { materializeDepthStations } from "./depth-profile";
import {
  buildBodyPlumbingRuns,
  ensurePadManifoldPlumbing,
  obstaclesFromDesign,
  resolveEquipmentConnection,
  virtualEquipmentPoint,
  type EquipmentConnection,
} from "./plumbing-route";
import {
  insideBoundsFromOutside,
  outlineBounds,
  poolWallThicknessMm,
  stripBodyChildren,
} from "./spa-defaults";

const IN = 25.4;
const FT = 304.8;

export type PoolPackage = {
  body: PoolBody;
  features: PoolFeature[];
  objects: PlacedObject[];
  plumbingRuns: PlumbingRun[];
};

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function placeEquip(
  catalogItemId: string,
  name: string,
  position: PointMm,
  parentBodyId: string,
  rotationDeg = 0,
): PlacedObject {
  const item = getPlaceableItem(catalogItemId);
  return {
    id: newId("obj"),
    catalogItemId,
    name,
    position,
    rotationDeg,
    layerId: item?.layerId ?? "equipment",
    widthMm: item?.widthMm ?? 8 * IN,
    depthMm: item?.depthMm ?? 8 * IN,
    heightMm: item?.heightMm,
    parentBodyId,
  };
}

function wallNormalRotation(
  from: PointMm,
  towardInterior: PointMm,
): number {
  return (
    (Math.atan2(
      towardInterior.y - from.y,
      towardInterior.x - from.x,
    ) *
      180) /
    Math.PI
  );
}

/**
 * Layout standard pool fixtures on the inside waterline + stub plumbing.
 * Dual floor drains (VGBA), 2 skimmers, 4 returns, 2 lights, shallow-end steps.
 */
export function layoutPoolContents(
  bodyId: string,
  bodyName: string,
  outsideOutline: PointMm[],
  wallThicknessMm: number,
  design?: DesignDocument,
  depths?: { shallowMm: number; deepMm: number },
): {
  features: PoolFeature[];
  objects: PlacedObject[];
  plumbingRuns: PlumbingRun[];
} {
  const outside = outlineBounds(outsideOutline);
  const b = insideBoundsFromOutside(outsideOutline, wallThicknessMm);
  const wallInset = Math.min(8 * IN, Math.min(b.width, b.height) * 0.08);
  const landscape = b.width >= b.height;
  const long = Math.max(b.width, b.height);
  const short = Math.min(b.width, b.height);

  // Depth axis: long direction, shallow at "start" (min along that axis).
  const shallowEndIsMinY = landscape;
  const features: PoolFeature[] = [];

  // Steps at shallow end (~8′ wide × 4′ deep, capped to shell).
  const stepsW = Math.min(8 * FT, short * 0.85);
  const stepsD = Math.min(4 * FT, long * 0.22);
  if (landscape) {
    const x0 = b.cx - stepsW / 2;
    features.push({
      id: newId("steps"),
      kind: "steps",
      name: "Entry steps",
      outline: [
        { x: x0, y: b.minY + 2 * IN },
        { x: x0 + stepsW, y: b.minY + 2 * IN },
        { x: x0 + stepsW, y: b.minY + stepsD },
        { x: x0, y: b.minY + stepsD },
      ],
      poolBodyId: bodyId,
    });
  } else {
    const y0 = b.cy - stepsW / 2;
    features.push({
      id: newId("steps"),
      kind: "steps",
      name: "Entry steps",
      outline: [
        { x: b.minX + 2 * IN, y: y0 },
        { x: b.minX + stepsD, y: y0 },
        { x: b.minX + stepsD, y: y0 + stepsW },
        { x: b.minX + 2 * IN, y: y0 + stepsW },
      ],
      poolBodyId: bodyId,
    });
  }

  const objects: PlacedObject[] = [];

  // Dual main drains on long centerline, ~3′ either side of mid (VGBA pair).
  const drainSep = Math.min(4 * FT, long * 0.18);
  if (landscape) {
    objects.push(
      placeEquip(
        "pool_drain",
        "Main drain 1",
        { x: b.cx - drainSep / 2, y: b.cy },
        bodyId,
      ),
      placeEquip(
        "pool_drain",
        "Main drain 2",
        { x: b.cx + drainSep / 2, y: b.cy },
        bodyId,
      ),
    );
  } else {
    objects.push(
      placeEquip(
        "pool_drain",
        "Main drain 1",
        { x: b.cx, y: b.cy - drainSep / 2 },
        bodyId,
      ),
      placeEquip(
        "pool_drain",
        "Main drain 2",
        { x: b.cx, y: b.cy + drainSep / 2 },
        bodyId,
      ),
    );
  }

  // Skimmers mid-long walls.
  const skimmerPts: PointMm[] = landscape
    ? [
        { x: b.minX + wallInset, y: b.cy },
        { x: b.maxX - wallInset, y: b.cy },
      ]
    : [
        { x: b.cx, y: b.minY + wallInset },
        { x: b.cx, y: b.maxY - wallInset },
      ];
  skimmerPts.forEach((pos, i) => {
    objects.push(
      placeEquip(
        "pool_skimmer",
        `Skimmer ${i + 1}`,
        pos,
        bodyId,
        wallNormalRotation(pos, { x: b.cx, y: b.cy }),
      ),
    );
  });

  // Four wall returns at ~25% / 75% on long walls.
  const returnPts: PointMm[] = landscape
    ? [
        { x: b.minX + wallInset, y: b.cy - b.height * 0.28 },
        { x: b.minX + wallInset, y: b.cy + b.height * 0.28 },
        { x: b.maxX - wallInset, y: b.cy - b.height * 0.28 },
        { x: b.maxX - wallInset, y: b.cy + b.height * 0.28 },
      ]
    : [
        { x: b.cx - b.width * 0.28, y: b.minY + wallInset },
        { x: b.cx + b.width * 0.28, y: b.minY + wallInset },
        { x: b.cx - b.width * 0.28, y: b.maxY - wallInset },
        { x: b.cx + b.width * 0.28, y: b.maxY - wallInset },
      ];
  returnPts.forEach((pos, i) => {
    objects.push(
      placeEquip(
        "pool_return",
        `Return ${i + 1}`,
        pos,
        bodyId,
        wallNormalRotation(pos, { x: b.cx, y: b.cy }),
      ),
    );
  });

  // Lights: deep-end wall + mid opposite long wall.
  const lightPts: PointMm[] = landscape
    ? [
        {
          x: b.cx,
          y: shallowEndIsMinY ? b.maxY - wallInset : b.minY + wallInset,
        },
        { x: b.minX + wallInset, y: b.cy - b.height * 0.1 },
      ]
    : [
        { x: b.maxX - wallInset, y: b.cy },
        { x: b.cx - b.width * 0.1, y: b.minY + wallInset },
      ];
  lightPts.forEach((pos, i) => {
    objects.push(
      placeEquip(
        "light_standard",
        `Pool light ${i + 1}`,
        pos,
        bodyId,
        wallNormalRotation(pos, { x: b.cx, y: b.cy }),
      ),
    );
  });

  const shallowMm = depths?.shallowMm ?? DEFAULT_POOL_SHALLOW_MM;
  const deepMm = depths?.deepMm ?? DEFAULT_POOL_DEEP_MM;
  const bodyStub: PoolBody = {
    id: bodyId,
    name: bodyName,
    kind: "pool",
    outline: outsideOutline,
    depthShallowMm: shallowMm,
    depthDeepMm: deepMm,
    wallThicknessMm,
  };

  const placed = design
    ? resolveEquipmentConnection(design, { x: outside.cx, y: outside.cy })
    : null;
  const stub = virtualEquipmentPoint(outsideOutline);
  const connection: EquipmentConnection = placed ?? {
    suctionTarget: stub,
    returnOrigin: stub,
    equipmentObjectId: "",
    label: "Equip stub",
  };

  const drain1 = objects.find((o) => o.name === "Main drain 1")!.position;
  const plumbingRuns = buildBodyPlumbingRuns({
    body: bodyStub,
    connection,
    suctionStart: drain1,
    returnEnds: returnPts,
    obstacles: design ? obstaclesFromDesign(design) : [],
  }).map((r) =>
    connection.equipmentObjectId
      ? r
      : { ...r, equipmentObjectId: undefined },
  );

  return { features, objects, plumbingRuns };
}

/** Standard residential pool package with depth stations materialized. */
export function buildPoolPackage(
  outsideOutline: PointMm[],
  poolIndex: number,
  wallThicknessMm: number = DEFAULT_POOL_WALL_THICKNESS_MM,
  design?: DesignDocument,
): PoolPackage {
  const bodyId = newId("pool");
  let body: PoolBody = {
    id: bodyId,
    name: `Pool ${poolIndex}`,
    kind: "pool",
    outline: outsideOutline,
    depthShallowMm: DEFAULT_POOL_SHALLOW_MM,
    depthDeepMm: DEFAULT_POOL_DEEP_MM,
    wallThicknessMm,
  };
  body = materializeDepthStations(body);
  const contents = layoutPoolContents(
    bodyId,
    body.name,
    outsideOutline,
    wallThicknessMm,
    design,
    { shallowMm: body.depthShallowMm, deepMm: body.depthDeepMm },
  );
  return { body, ...contents };
}

export function applyPoolPackage(
  design: DesignDocument,
  pkg: PoolPackage,
): DesignDocument {
  let layers = design.layers;
  if (!layers.some((l) => l.id === "equipment")) {
    layers = [...layers, { id: "equipment", name: "equipment", visible: true }];
  }
  if (!layers.some((l) => l.id === "features")) {
    layers = [...layers, { id: "features", name: "features", visible: true }];
  }
  return ensurePadManifoldPlumbing({
    ...design,
    layers,
    poolBodies: [...design.poolBodies, pkg.body],
    features: [...(design.features ?? []), ...pkg.features],
    objects: [...(design.objects ?? []), ...pkg.objects],
    plumbingRuns: [...design.plumbingRuns, ...pkg.plumbingRuns],
  });
}

export function relayoutPoolPackage(
  design: DesignDocument,
  body: PoolBody,
): DesignDocument {
  const wall = poolWallThicknessMm(body);
  const cleared = stripBodyChildren(design, body.id);
  const contents = layoutPoolContents(
    body.id,
    body.name,
    body.outline,
    wall,
    cleared,
    { shallowMm: body.depthShallowMm, deepMm: body.depthDeepMm },
  );
  return ensurePadManifoldPlumbing({
    ...cleared,
    poolBodies: cleared.poolBodies.map((p) =>
      p.id === body.id
        ? {
            ...body,
            kind: "pool",
            wallThicknessMm: wall,
          }
        : p,
    ),
    features: [...(cleared.features ?? []), ...contents.features],
    objects: [...(cleared.objects ?? []), ...contents.objects],
    plumbingRuns: [...cleared.plumbingRuns, ...contents.plumbingRuns],
  });
}

export function resetPoolPackage(
  design: DesignDocument,
  body: PoolBody,
): DesignDocument {
  return relayoutPoolPackage(design, {
    ...body,
    kind: "pool",
    wallThicknessMm: poolWallThicknessMm(body),
  });
}
