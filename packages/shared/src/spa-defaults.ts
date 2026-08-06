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
  DEFAULT_SPA_DEPTH_MM,
  DEFAULT_SPA_SHELL_HEIGHT_MM,
  DEFAULT_SPA_WALL_THICKNESS_MM,
} from "./design-model";
import {
  buildBodyPlumbingRuns,
  obstaclesFromDesign,
  resolveEquipmentConnection,
  virtualEquipmentPoint,
  type EquipmentConnection,
} from "./plumbing-route";

const IN = 25.4;

export type SpaPackage = {
  body: PoolBody;
  features: PoolFeature[];
  objects: PlacedObject[];
  plumbingRuns: PlumbingRun[];
};

export type OutlineBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
};

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function outlineBounds(outline: PointMm[]): OutlineBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outline) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function rect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): PointMm[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/** True when outline is (nearly) an axis-aligned rectangle. */
export function isAxisAlignedRect(outline: PointMm[], tolMm = 2): boolean {
  if (outline.length !== 4) return false;
  const b = outlineBounds(outline);
  if (b.width < tolMm || b.height < tolMm) return false;
  const cornerKey = (p: PointMm) => {
    const onMinX = Math.abs(p.x - b.minX) <= tolMm;
    const onMaxX = Math.abs(p.x - b.maxX) <= tolMm;
    const onMinY = Math.abs(p.y - b.minY) <= tolMm;
    const onMaxY = Math.abs(p.y - b.maxY) <= tolMm;
    if (!(onMinX || onMaxX) || !(onMinY || onMaxY)) return null;
    return `${onMinX ? "0" : "1"},${onMinY ? "0" : "1"}`;
  };
  const keys = new Set<string>();
  for (const p of outline) {
    const key = cornerKey(p);
    if (!key) return false;
    keys.add(key);
  }
  return keys.size === 4;
}

/** Rebuild an axis-aligned outside rectangle around the same center. */
export function resizeAxisAlignedOutline(
  outline: PointMm[],
  widthMm: number,
  heightMm: number,
): PointMm[] {
  const b = outlineBounds(outline);
  const hw = widthMm / 2;
  const hh = heightMm / 2;
  return rect(b.cx - hw, b.cy - hh, b.cx + hw, b.cy + hh);
}

export function spaWallThicknessMm(body: PoolBody): number {
  return body.wallThicknessMm ?? DEFAULT_SPA_WALL_THICKNESS_MM;
}

export function spaShellHeightMm(body: PoolBody): number {
  return body.shellHeightMm ?? DEFAULT_SPA_SHELL_HEIGHT_MM;
}

/** Inside (waterline) bounds from outside outline and wall thickness. */
export function insideBoundsFromOutside(
  outside: PointMm[],
  wallThicknessMm: number,
): OutlineBounds {
  const b = outlineBounds(outside);
  const t = Math.max(0, wallThicknessMm);
  const width = Math.max(IN, b.width - 2 * t);
  const height = Math.max(IN, b.height - 2 * t);
  const insetX = (b.width - width) / 2;
  const insetY = (b.height - height) / 2;
  return {
    minX: b.minX + insetX,
    minY: b.minY + insetY,
    maxX: b.maxX - insetX,
    maxY: b.maxY - insetY,
    width,
    height,
    cx: b.cx,
    cy: b.cy,
  };
}

export function insideOutlineFromOutside(
  outside: PointMm[],
  wallThicknessMm: number,
): PointMm[] {
  const i = insideBoundsFromOutside(outside, wallThicknessMm);
  return rect(i.minX, i.minY, i.maxX, i.maxY);
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
    parentBodyId,
  };
}

/**
 * Layout benches / equipment / plumbing inside the spa waterline
 * (outside outline inset by wall thickness).
 * When pad equipment exists on the design, trench runs target the pump/heater.
 */
export function layoutSpaContents(
  bodyId: string,
  bodyName: string,
  outsideOutline: PointMm[],
  wallThicknessMm: number,
  design?: DesignDocument,
): {
  features: PoolFeature[];
  objects: PlacedObject[];
  plumbingRuns: PlumbingRun[];
} {
  const outside = outlineBounds(outsideOutline);
  const b = insideBoundsFromOutside(outsideOutline, wallThicknessMm);
  const inset = 2 * IN;
  const benchDepth = Math.min(
    18 * IN,
    Math.max(10 * IN, Math.min(b.width, b.height) * 0.22),
  );
  const wallInset = Math.min(6 * IN, Math.min(b.width, b.height) * 0.12);
  const landscape = b.width >= b.height;

  const features: PoolFeature[] = [];
  if (landscape) {
    features.push({
      id: newId("bench"),
      kind: "bench",
      name: "Spa bench A",
      outline: rect(
        b.minX + inset,
        b.maxY - benchDepth - inset,
        b.maxX - inset,
        b.maxY - inset,
      ),
      poolBodyId: bodyId,
    });
    features.push({
      id: newId("bench"),
      kind: "bench",
      name: "Spa bench B",
      outline: rect(
        b.minX + inset,
        b.minY + inset,
        b.maxX - inset,
        b.minY + benchDepth + inset,
      ),
      poolBodyId: bodyId,
    });
  } else {
    features.push({
      id: newId("bench"),
      kind: "bench",
      name: "Spa bench A",
      outline: rect(
        b.minX + inset,
        b.minY + inset,
        b.minX + benchDepth + inset,
        b.maxY - inset,
      ),
      poolBodyId: bodyId,
    });
    features.push({
      id: newId("bench"),
      kind: "bench",
      name: "Spa bench B",
      outline: rect(
        b.maxX - benchDepth - inset,
        b.minY + inset,
        b.maxX - inset,
        b.maxY - inset,
      ),
      poolBodyId: bodyId,
    });
  }

  const objects: PlacedObject[] = [
    placeEquip("spa_drain", "Main drain", { x: b.cx, y: b.cy }, bodyId),
  ];

  const bubblerY = landscape
    ? b.maxY - inset - benchDepth / 2
    : b.cy - b.height * 0.18;
  const bubblerX = landscape
    ? b.cx - b.width * 0.18
    : b.minX + inset + benchDepth / 2;
  objects.push(
    placeEquip(
      "spa_bubbler",
      "Bubbler 1",
      landscape
        ? { x: b.cx - b.width * 0.18, y: bubblerY }
        : { x: bubblerX, y: b.cy - b.height * 0.18 },
      bodyId,
    ),
    placeEquip(
      "spa_bubbler",
      "Bubbler 2",
      landscape
        ? { x: b.cx + b.width * 0.18, y: bubblerY }
        : { x: bubblerX, y: b.cy + b.height * 0.18 },
      bodyId,
    ),
  );

  const jetPts: PointMm[] = landscape
    ? [
        { x: b.minX + wallInset, y: b.cy - b.height * 0.22 },
        { x: b.minX + wallInset, y: b.cy + b.height * 0.22 },
        { x: b.maxX - wallInset, y: b.cy - b.height * 0.22 },
        { x: b.maxX - wallInset, y: b.cy + b.height * 0.22 },
        { x: b.cx - b.width * 0.22, y: b.minY + wallInset },
        { x: b.cx + b.width * 0.22, y: b.minY + wallInset },
      ]
    : [
        { x: b.cx - b.width * 0.22, y: b.minY + wallInset },
        { x: b.cx + b.width * 0.22, y: b.minY + wallInset },
        { x: b.cx - b.width * 0.22, y: b.maxY - wallInset },
        { x: b.cx + b.width * 0.22, y: b.maxY - wallInset },
        { x: b.minX + wallInset, y: b.cy - b.height * 0.18 },
        { x: b.maxX - wallInset, y: b.cy + b.height * 0.18 },
      ];

  jetPts.forEach((pos, i) => {
    const towardCenter =
      (Math.atan2(b.cy - pos.y, b.cx - pos.x) * 180) / Math.PI;
    objects.push(
      placeEquip("spa_jet", `Jet ${i + 1}`, pos, bodyId, towardCenter),
    );
  });

  const bodyStub: PoolBody = {
    id: bodyId,
    name: bodyName,
    kind: "spa",
    outline: outsideOutline,
    depthShallowMm: DEFAULT_SPA_DEPTH_MM,
    depthDeepMm: DEFAULT_SPA_DEPTH_MM,
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

  const bubbler1 = objects.find((o) => o.name === "Bubbler 1")!.position;
  const bubbler2 = objects.find((o) => o.name === "Bubbler 2")!.position;
  const drainPos = objects.find((o) => o.catalogItemId === "spa_drain")!.position;

  const plumbingRuns = buildBodyPlumbingRuns({
    body: bodyStub,
    connection,
    suctionStart: drainPos,
    returnEnds: jetPts.slice(0, 4),
    featureEnds: [bubbler1, bubbler2],
    obstacles: design ? obstaclesFromDesign(design) : [],
  }).map((r) =>
    connection.equipmentObjectId
      ? r
      : { ...r, equipmentObjectId: undefined },
  );

  return {
    features,
    objects,
    plumbingRuns,
  };
}

/**
 * Standard residential spa package. Outline is the outside/shell dimension;
 * benches and equipment are laid out on the inside waterline.
 */
export function buildSpaPackage(
  outsideOutline: PointMm[],
  spaIndex: number,
  wallThicknessMm: number = DEFAULT_SPA_WALL_THICKNESS_MM,
  design?: DesignDocument,
): SpaPackage {
  const bodyId = newId("spa");
  const body: PoolBody = {
    id: bodyId,
    name: `Spa ${spaIndex}`,
    kind: "spa",
    outline: outsideOutline,
    depthShallowMm: DEFAULT_SPA_DEPTH_MM,
    depthDeepMm: DEFAULT_SPA_DEPTH_MM,
    wallThicknessMm,
    shellHeightMm: DEFAULT_SPA_SHELL_HEIGHT_MM,
  };
  const contents = layoutSpaContents(
    bodyId,
    body.name,
    outsideOutline,
    wallThicknessMm,
    design,
  );
  return { body, ...contents };
}

/** Merge a spa package into a design document. */
export function applySpaPackage(
  design: DesignDocument,
  pkg: SpaPackage,
): DesignDocument {
  let layers = design.layers;
  if (!layers.some((l) => l.id === "equipment")) {
    layers = [...layers, { id: "equipment", name: "equipment", visible: true }];
  }
  if (!layers.some((l) => l.id === "features")) {
    layers = [...layers, { id: "features", name: "features", visible: true }];
  }
  return {
    ...design,
    layers,
    poolBodies: [...design.poolBodies, pkg.body],
    features: [...(design.features ?? []), ...pkg.features],
    objects: [...(design.objects ?? []), ...pkg.objects],
    plumbingRuns: [...design.plumbingRuns, ...pkg.plumbingRuns],
  };
}

/** Remove features/objects/runs linked to a water body. */
export function stripBodyChildren(
  design: DesignDocument,
  bodyId: string,
): DesignDocument {
  return {
    ...design,
    features: (design.features ?? []).filter((f) => f.poolBodyId !== bodyId),
    objects: (design.objects ?? []).filter((o) => o.parentBodyId !== bodyId),
    plumbingRuns: design.plumbingRuns.filter((r) => r.parentBodyId !== bodyId),
  };
}

/**
 * Keep spa body (outside outline / depths / wall) and rebuild package
 * contents so they fit the current inside waterline.
 */
export function relayoutSpaPackage(
  design: DesignDocument,
  body: PoolBody,
): DesignDocument {
  const wall = spaWallThicknessMm(body);
  const cleared = stripBodyChildren(design, body.id);
  const contents = layoutSpaContents(
    body.id,
    body.name,
    body.outline,
    wall,
    cleared,
  );
  return {
    ...cleared,
    poolBodies: cleared.poolBodies.map((p) =>
      p.id === body.id
        ? {
            ...body,
            kind: "spa",
            wallThicknessMm: wall,
          }
        : p,
    ),
    features: [...(cleared.features ?? []), ...contents.features],
    objects: [...(cleared.objects ?? []), ...contents.objects],
    plumbingRuns: [...cleared.plumbingRuns, ...contents.plumbingRuns],
  };
}

/** Replace linked spa package pieces with a fresh standard package. */
export function resetSpaPackage(
  design: DesignDocument,
  body: PoolBody,
): DesignDocument {
  return relayoutSpaPackage(design, {
    ...body,
    kind: "spa",
    wallThicknessMm: spaWallThicknessMm(body),
  });
}

export function spaCount(design: DesignDocument): number {
  return design.poolBodies.filter((p) => (p.kind ?? "pool") === "spa").length;
}

export function poolCount(design: DesignDocument): number {
  return design.poolBodies.filter((p) => (p.kind ?? "pool") !== "spa").length;
}
