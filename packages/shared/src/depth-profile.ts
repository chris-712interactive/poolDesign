import {
  type DepthStation,
  type DepthTransition,
  type PointMm,
  type PoolBody,
  pointInPolygon,
  polygonAreaMm2,
  polygonPerimeterMm,
  waterBodyKind,
} from "./design-model";
import {
  outlineBounds,
  poolWallThicknessMm,
  spaWallThicknessMm,
} from "./spa-defaults";
import { insetClosedOutline } from "./scene3d";
import { MM_PER_FOOT } from "./units";

const GAL_PER_CU_FT = 7.48052;
const MM3_PER_CY = 764_554_857.984; // (304.8)^3 * 27

export type ResolvedDepthStation = {
  id: string;
  t: number;
  depthMm: number;
  transition: DepthTransition;
};

export type DepthProfile = {
  stations: ResolvedDepthStation[];
  axis: PointMm;
  /** Plan point used as t=0 projection origin (AABB corner toward shallow). */
  originMm: PointMm;
  axisLengthMm: number;
};

function newStationId(): string {
  return `ds_${Math.random().toString(36).slice(2, 10)}`;
}

function unit(v: PointMm): PointMm {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** Default depth axis: +long side of the outline AABB. */
export function defaultDepthAxis(outline: PointMm[]): PointMm {
  const b = outlineBounds(outline);
  if (b.width >= b.height) return { x: 1, y: 0 };
  return { x: 0, y: 1 };
}

/** Axis origin (t=0) and length for projecting plan points. */
export function depthAxisFrame(
  outline: PointMm[],
  axis: PointMm,
): { originMm: PointMm; axisLengthMm: number } {
  const b = outlineBounds(outline);
  const a = unit(axis);
  const corners: PointMm[] = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
  let minP = Infinity;
  let maxP = -Infinity;
  for (const c of corners) {
    const p = c.x * a.x + c.y * a.y;
    if (p < minP) minP = p;
    if (p > maxP) maxP = p;
  }
  const axisLengthMm = Math.max(1, maxP - minP);
  // Origin on the axis line through the AABB center at projection minP.
  const cProj = b.cx * a.x + b.cy * a.y;
  return {
    originMm: {
      x: b.cx + a.x * (minP - cProj),
      y: b.cy + a.y * (minP - cProj),
    },
    axisLengthMm,
  };
}

/** Project a plan point onto the depth axis → t in [0,1]. */
export function depthTAtPlanPoint(
  point: PointMm,
  originMm: PointMm,
  axis: PointMm,
  axisLengthMm: number,
): number {
  const a = unit(axis);
  const relX = point.x - originMm.x;
  const relY = point.y - originMm.y;
  const p = relX * a.x + relY * a.y;
  return Math.min(1, Math.max(0, p / Math.max(1, axisLengthMm)));
}

function smoothstep(u: number): number {
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
}

/**
 * Synthesize two endpoint stations from shallow/deep when none are authored.
 */
export function synthesizeDepthStations(
  shallowMm: number,
  deepMm: number,
): DepthStation[] {
  return [
    { id: newStationId(), t: 0, depthMm: shallowMm, transition: "smooth" },
    { id: newStationId(), t: 1, depthMm: deepMm, transition: "smooth" },
  ];
}

/** Sort, clamp, pin endpoints, resolve transitions. */
export function normalizeDepthStations(
  stations: DepthStation[],
  shallowMm: number,
  deepMm: number,
): ResolvedDepthStation[] {
  if (stations.length < 2) {
    return synthesizeDepthStations(shallowMm, deepMm).map((s) => ({
      id: s.id,
      t: s.t,
      depthMm: s.depthMm,
      transition: "smooth" as const,
    }));
  }
  const sorted = [...stations]
    .map((s) => ({
      id: s.id || newStationId(),
      t: Math.min(1, Math.max(0, s.t)),
      depthMm: Math.max(100, s.depthMm),
      transition: (s.transition === "dropoff" ? "dropoff" : "smooth") as DepthTransition,
    }))
    .sort((a, b) => a.t - b.t);

  // Dedupe nearly identical t (keep later)
  const deduped: ResolvedDepthStation[] = [];
  for (const s of sorted) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.t - s.t) < 1e-4) {
      deduped[deduped.length - 1] = s;
    } else {
      deduped.push(s);
    }
  }

  if (deduped.length < 2) {
    return synthesizeDepthStations(shallowMm, deepMm).map((s) => ({
      id: s.id,
      t: s.t,
      depthMm: s.depthMm,
      transition: "smooth" as const,
    }));
  }

  deduped[0] = { ...deduped[0], t: 0 };
  deduped[deduped.length - 1] = {
    ...deduped[deduped.length - 1],
    t: 1,
  };
  return deduped;
}

/** Full resolved profile for a pool body (works without authored stations). */
export function depthProfileForBody(body: PoolBody): DepthProfile {
  const axis = unit(body.depthAxis ?? defaultDepthAxis(body.outline));
  const { originMm, axisLengthMm } = depthAxisFrame(body.outline, axis);
  const stations = normalizeDepthStations(
    body.depthStations ?? [],
    body.depthShallowMm,
    body.depthDeepMm,
  );
  // When no authored stations, use shallow/deep endpoints
  const resolved =
    body.depthStations && body.depthStations.length >= 2
      ? stations
      : normalizeDepthStations(
          synthesizeDepthStations(body.depthShallowMm, body.depthDeepMm),
          body.depthShallowMm,
          body.depthDeepMm,
        );
  return { stations: resolved, axis, originMm, axisLengthMm };
}

/** Max depth along the profile (for wall bottoms / water volume). */
export function maxDepthMmFromProfile(body: PoolBody): number {
  const { stations } = depthProfileForBody(body);
  return Math.max(...stations.map((s) => s.depthMm), body.depthDeepMm, 900);
}

/**
 * Floor depth at a plan point. Smooth segments use smoothstep; drop-off holds
 * the previous depth until the station, then steps.
 */
export function depthMmAtPlanPoint(body: PoolBody, point: PointMm): number {
  const profile = depthProfileForBody(body);
  return depthMmAtT(profile.stations, depthTAtPlanPoint(
    point,
    profile.originMm,
    profile.axis,
    profile.axisLengthMm,
  ));
}

export function depthMmAtT(
  stations: ResolvedDepthStation[],
  t: number,
): number {
  const tt = Math.min(1, Math.max(0, t));
  if (stations.length < 2) return stations[0]?.depthMm ?? 1200;

  // Before first / after last
  if (tt <= stations[0].t) return stations[0].depthMm;
  if (tt >= stations[stations.length - 1].t) {
    return stations[stations.length - 1].depthMm;
  }

  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1];
    const b = stations[i];
    if (tt > b.t) continue;
    if (tt <= a.t) return a.depthMm;

    const span = Math.max(1e-9, b.t - a.t);
    const u = (tt - a.t) / span;

    if (b.transition === "dropoff") {
      // Hold previous depth until the station, then step.
      return tt < b.t - 1e-9 ? a.depthMm : b.depthMm;
    }

    // Smooth curved transition (smoothstep, no overshoot)
    const s = smoothstep(u);
    return a.depthMm + (b.depthMm - a.depthMm) * s;
  }

  return stations[stations.length - 1].depthMm;
}

/** Materialize authored stations from shallow/deep + default axis. */
export function materializeDepthStations(body: PoolBody): PoolBody {
  const axis = unit(body.depthAxis ?? defaultDepthAxis(body.outline));
  const stations =
    body.depthStations && body.depthStations.length >= 2
      ? normalizeDepthStations(
          body.depthStations,
          body.depthShallowMm,
          body.depthDeepMm,
        )
      : normalizeDepthStations(
          synthesizeDepthStations(body.depthShallowMm, body.depthDeepMm),
          body.depthShallowMm,
          body.depthDeepMm,
        );
  return syncShallowDeepFromStations({
    ...body,
    depthAxis: axis,
    depthStations: stations,
  });
}

/** Keep legacy shallow/deep fields aligned with endpoint stations. */
export function syncShallowDeepFromStations(body: PoolBody): PoolBody {
  if (!body.depthStations || body.depthStations.length < 2) return body;
  const stations = normalizeDepthStations(
    body.depthStations,
    body.depthShallowMm,
    body.depthDeepMm,
  );
  return {
    ...body,
    depthStations: stations,
    depthShallowMm: stations[0].depthMm,
    depthDeepMm: stations[stations.length - 1].depthMm,
  };
}

/** Flip shallow/deep ends by reversing the axis (station t values stay put). */
export function flipDepthEnds(body: PoolBody): PoolBody {
  const materialized = materializeDepthStations(body);
  const axis = unit(
    materialized.depthAxis ?? defaultDepthAxis(materialized.outline),
  );
  return {
    ...materialized,
    depthAxis: { x: -axis.x, y: -axis.y },
  };
}

/** Insert a break between two stations (mid t, interpolated depth). */
export function addDepthBreak(body: PoolBody, afterIndex = 0): PoolBody {
  const materialized = materializeDepthStations(body);
  const stations = [
    ...(materialized.depthStations ?? []),
  ] as DepthStation[];
  const i = Math.min(Math.max(0, afterIndex), stations.length - 2);
  const a = stations[i];
  const b = stations[i + 1];
  const t = (a.t + b.t) / 2;
  const depthMm = depthMmAtT(
    normalizeDepthStations(stations, a.depthMm, b.depthMm),
    t,
  );
  const next = [
    ...stations.slice(0, i + 1),
    {
      id: newStationId(),
      t,
      depthMm,
      transition: "dropoff" as const,
    },
    ...stations.slice(i + 1),
  ];
  return syncShallowDeepFromStations({
    ...materialized,
    depthStations: next,
  });
}

/** Remove a middle station (endpoints cannot be removed). */
export function removeDepthBreak(body: PoolBody, stationId: string): PoolBody {
  const materialized = materializeDepthStations(body);
  const stations = materialized.depthStations ?? [];
  if (stations.length <= 2) return materialized;
  const next = stations.filter(
    (s, i) => s.id !== stationId || i === 0 || i === stations.length - 1,
  );
  if (next.length < 2) return materialized;
  return syncShallowDeepFromStations({
    ...materialized,
    depthStations: next,
  });
}

/** Update one station's depth / transition / t (endpoints pin t). */
export function updateDepthStation(
  body: PoolBody,
  stationId: string,
  patch: Partial<Pick<DepthStation, "t" | "depthMm" | "transition">>,
): PoolBody {
  const materialized = materializeDepthStations(body);
  const stations = (materialized.depthStations ?? []).map((s, i, arr) => {
    if (s.id !== stationId) return s;
    const isEnd = i === 0 || i === arr.length - 1;
    return {
      ...s,
      depthMm:
        patch.depthMm != null ? Math.max(100, patch.depthMm) : s.depthMm,
      transition:
        patch.transition === "dropoff" || patch.transition === "smooth"
          ? patch.transition
          : s.transition,
      t: isEnd ? s.t : patch.t != null ? Math.min(1, Math.max(0, patch.t)) : s.t,
    };
  });
  return syncShallowDeepFromStations({
    ...materialized,
    depthStations: stations,
  });
}

/** Plan-space point on the depth axis at parameter t (for 2D handles). */
export function depthStationPlanPoint(
  outline: PointMm[],
  axis: PointMm,
  t: number,
): PointMm {
  const a = unit(axis);
  const { originMm, axisLengthMm } = depthAxisFrame(outline, a);
  const tt = Math.min(1, Math.max(0, t));
  return {
    x: originMm.x + a.x * axisLengthMm * tt,
    y: originMm.y + a.y * axisLengthMm * tt,
  };
}

/**
 * Integrate water volume over the inside waterline using the depth profile.
 * Samples a grid; good enough for takeoff / turnover sizing.
 */
export function waterVolumeMm3(body: PoolBody, stepMm = 300): number {
  const wall =
    waterBodyKind(body) === "spa"
      ? spaWallThicknessMm(body)
      : poolWallThicknessMm(body);
  const inside = insetClosedOutline(body.outline, wall);
  const ring = inside.length >= 3 ? inside : body.outline;
  if (ring.length < 3) return 0;

  const b = outlineBounds(ring);
  const step = Math.max(100, stepMm);
  let sum = 0;
  let cells = 0;
  for (let y = b.minY + step / 2; y < b.maxY; y += step) {
    for (let x = b.minX + step / 2; x < b.maxX; x += step) {
      const p = { x, y };
      if (!pointInPolygon(p, ring)) continue;
      sum += depthMmAtPlanPoint(body, p);
      cells += 1;
    }
  }
  if (cells === 0) {
    const avg = (body.depthShallowMm + body.depthDeepMm) / 2;
    return polygonAreaMm2(ring) * avg;
  }
  return sum * step * step;
}

export function waterVolumeGal(body: PoolBody, stepMm = 300): number {
  const cuFt = waterVolumeMm3(body, stepMm) / (MM_PER_FOOT ** 3);
  return cuFt * GAL_PER_CU_FT;
}

/**
 * Wet interior surface (floor + walls) for plaster takeoff.
 * Floor = inside area; walls = inside perimeter × mean profile depth.
 */
export function wetInteriorSurfaceMm2(body: PoolBody): number {
  const wall =
    waterBodyKind(body) === "spa"
      ? spaWallThicknessMm(body)
      : poolWallThicknessMm(body);
  const inside = insetClosedOutline(body.outline, wall);
  const ring = inside.length >= 3 ? inside : body.outline;
  const floor = polygonAreaMm2(ring);
  const wallDepth =
    body.depthStations && body.depthStations.length >= 2
      ? (body.depthShallowMm + maxDepthMmFromProfile(body)) / 2
      : (body.depthShallowMm + body.depthDeepMm) / 2;
  return floor + polygonPerimeterMm(ring) * wallDepth;
}

/**
 * Excavation allowance (cy): outside footprint × max depth + 6″ overdig
 * on the floor, plus 6″ working space outside the shell.
 */
export function excavationVolumeCy(body: PoolBody): number {
  const overdigMm = 6 * 25.4;
  const workingMm = 6 * 25.4;
  const b = outlineBounds(body.outline);
  const footprint =
    (b.width + 2 * workingMm) * (b.height + 2 * workingMm);
  const depth = maxDepthMmFromProfile(body) + overdigMm;
  return (footprint * depth) / MM3_PER_CY;
}
