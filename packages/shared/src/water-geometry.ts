import {
  approximateIntersectionAreaMm2,
  distToPolygonBoundaryMm,
  pointInPolygon,
  segmentColinearOverlapMm,
  segmentLengthMm,
  sharedBoundaryLengthMm,
  type PointMm,
  type PoolBody,
} from "./design-model";
import {
  isAxisAlignedRect,
  outlineBounds,
  spaShellHeightMm,
  type OutlineBounds,
} from "./spa-defaults";

/**
 * Recommended residential pool waterline below deck/coping (~6″).
 * Matches typical tile line / skimmer operating level.
 */
export const POOL_WATER_FREEBOARD_MM = 152.4;

/** Spa sitting / basin depth from the model. */
export function spaTotalDepthMm(body: PoolBody): number {
  return Math.max(body.depthShallowMm, body.depthDeepMm);
}

/**
 * Punch a spa through the deck when its above-deck shell is shorter than the
 * total basin depth (part of the vessel sits below grade).
 */
export function spaNeedsDeckPit(body: PoolBody): boolean {
  return spaShellHeightMm(body) < spaTotalDepthMm(body);
}

/** How far the spa floor sits below grade when water is at the pool freeboard. */
export function spaBelowDeckMm(body: PoolBody): number {
  const shell = spaShellHeightMm(body);
  const depth = spaTotalDepthMm(body);
  return Math.max(0, depth + POOL_WATER_FREEBOARD_MM - shell);
}

/** Drop duplicate closing vertex so AABB helpers see 4-point rectangles. */
export function openRing(outline: PointMm[]): PointMm[] {
  if (outline.length < 2) return outline;
  const a = outline[0];
  const b = outline[outline.length - 1];
  if (Math.hypot(a.x - b.x, a.y - b.y) < 1) return outline.slice(0, -1);
  return outline;
}

function asBounds(outline: PointMm[]): OutlineBounds {
  return outlineBounds(openRing(outline));
}

function rectRing(b: OutlineBounds): PointMm[] {
  return [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
}

function boundsOverlap(a: OutlineBounds, b: OutlineBounds, pad = 1): boolean {
  return !(
    a.maxX < b.minX - pad ||
    b.maxX < a.minX - pad ||
    a.maxY < b.minY - pad ||
    b.maxY < a.minY - pad
  );
}

function boundsIntersection(
  a: OutlineBounds,
  b: OutlineBounds,
): OutlineBounds | null {
  const minX = Math.max(a.minX, b.minX);
  const minY = Math.max(a.minY, b.minY);
  const maxX = Math.min(a.maxX, b.maxX);
  const maxY = Math.min(a.maxY, b.maxY);
  if (maxX - minX < 1 || maxY - minY < 1) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

/** True when two water-body footprints overlap or share a wall. */
export function waterBodiesConnected(
  a: PointMm[],
  b: PointMm[],
  minAreaMm2 = 25_000,
  minSharedMm = 100,
): boolean {
  if (a.length < 3 || b.length < 3) return false;
  if (approximateIntersectionAreaMm2(a, b) >= minAreaMm2) return true;
  return sharedBoundaryLengthMm(a, b) >= minSharedMm;
}

/**
 * Axis-aligned subject minus clipper → a single orthogonal polygon ring
 * (L / U / notched rect). Returns null if the clipper covers the subject.
 * Prefer this over {@link aabbDifferenceRects} when you need one continuous shape.
 */
export function aabbDifferenceRing(
  subject: PointMm[],
  clipper: PointMm[],
): PointMm[] | null {
  const sub = openRing(subject);
  const clip = openRing(clipper);
  const subB = asBounds(sub);
  // Clip by the spa's AABB even when the drawing is a few mm off-square;
  // a strict rect check used to skip the punch and leave pool walls through the spa.
  const C = asBounds(clip);
  if (!boundsOverlap(subB, C, 1)) return sub;

  const S = isAxisAlignedRect(sub, 40) ? subB : null;
  if (
    S &&
    C.minX <= S.minX + 1 &&
    C.maxX >= S.maxX - 1 &&
    C.minY <= S.minY + 1 &&
    C.maxY >= S.maxY - 1
  ) {
    return null;
  }

  const xs = uniqueSorted([
    subB.minX,
    subB.maxX,
    ...sub.map((p) => p.x),
    Math.max(subB.minX, Math.min(subB.maxX, C.minX)),
    Math.max(subB.minX, Math.min(subB.maxX, C.maxX)),
  ]);
  const ys = uniqueSorted([
    subB.minY,
    subB.maxY,
    ...sub.map((p) => p.y),
    Math.max(subB.minY, Math.min(subB.maxY, C.minY)),
    Math.max(subB.minY, Math.min(subB.maxY, C.maxY)),
  ]);
  if (xs.length < 2 || ys.length < 2) return sub;

  const nx = xs.length - 1;
  const ny = ys.length - 1;
  const filled: boolean[][] = Array.from({ length: nx }, () =>
    Array<boolean>(ny).fill(false),
  );
  let any = false;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      const inS = S
        ? cx >= S.minX - 1e-6 &&
          cx <= S.maxX + 1e-6 &&
          cy >= S.minY - 1e-6 &&
          cy <= S.maxY + 1e-6
        : pointInPolygon({ x: cx, y: cy }, sub);
      const inC =
        cx >= C.minX + 1e-6 &&
        cx <= C.maxX - 1e-6 &&
        cy >= C.minY + 1e-6 &&
        cy <= C.maxY - 1e-6;
      filled[i][j] = inS && !inC;
      if (filled[i][j]) any = true;
    }
  }
  if (!any) return null;

  const ring = traceOrthogonalBoundary(xs, ys, filled);
  return ring.length >= 3 ? ring : sub;
}

/** True when two outlines' bounding boxes overlap or nearly touch. */
export function outlinesAabbTouch(
  a: PointMm[],
  b: PointMm[],
  padMm = 80,
): boolean {
  return boundsOverlap(asBounds(a), asBounds(b), padMm);
}

function uniqueSorted(vals: number[], eps = 0.5): number[] {
  const s = [...vals].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of s) {
    if (out.length === 0 || Math.abs(out[out.length - 1] - v) > eps) out.push(v);
  }
  return out;
}

/**
 * Trace the outer CCW boundary of a filled orthogonal cell grid.
 * `filled[i][j]` is the cell between xs[i]..xs[i+1] and ys[j]..ys[j+1].
 */
function traceOrthogonalBoundary(
  xs: number[],
  ys: number[],
  filled: boolean[][],
): PointMm[] {
  const nx = filled.length;
  const ny = filled[0]?.length ?? 0;
  const isFilled = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < nx && j < ny && filled[i][j];

  // Start at bottom-most, then left-most filled cell; walk its bottom edge east.
  let si = -1;
  let sj = -1;
  outer: for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (filled[i][j]) {
        si = i;
        sj = j;
        break outer;
      }
    }
  }
  if (si < 0) return [];

  // Vertex grid indices; start at SW corner of start cell, heading east.
  // dirs: 0=E 1=N 2=W 3=S
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  let vx = si;
  let vy = sj;
  let dir = 0;
  const startVx = vx;
  const startVy = vy;
  const startDir = dir;
  const ring: PointMm[] = [];

  const maxSteps = (nx + 1) * (ny + 1) * 4 + 8;
  for (let step = 0; step < maxSteps; step++) {
    // Completed a full loop when we return to the start vertex.
    if (step > 0 && vx === startVx && vy === startVy) break;
    ring.push({ x: xs[vx], y: ys[vy] });

    // Prefer left turn, then straight, then right (CCW, interior on left).
    const tryOrder = [(dir + 1) % 4, dir, (dir + 3) % 4];
    let moved = false;
    for (const nd of tryOrder) {
      const cell = cellOnLeft(vx, vy, nd);
      if (!isFilled(cell.i, cell.j)) continue;
      // Boundary edge: cell on the right must be empty / outside
      const right = cellOnRight(vx, vy, nd);
      if (isFilled(right.i, right.j)) continue;

      vx += DX[nd];
      vy += DY[nd];
      dir = nd;
      moved = true;
      break;
    }
    if (!moved) break;
  }
  void startDir;

  return dedupeRing(ring);
}

/** Cell to the left of a directed edge leaving vertex (vx,vy) in direction d. */
function cellOnLeft(
  vx: number,
  vy: number,
  d: number,
): { i: number; j: number } {
  // E: left is north cell (vx, vy)
  // N: left is west cell (vx-1, vy)
  // W: left is south cell (vx-1, vy-1)
  // S: left is east cell (vx, vy-1)
  if (d === 0) return { i: vx, j: vy };
  if (d === 1) return { i: vx - 1, j: vy };
  if (d === 2) return { i: vx - 1, j: vy - 1 };
  return { i: vx, j: vy - 1 };
}

function cellOnRight(
  vx: number,
  vy: number,
  d: number,
): { i: number; j: number } {
  // Opposite of left
  if (d === 0) return { i: vx, j: vy - 1 };
  if (d === 1) return { i: vx, j: vy };
  if (d === 2) return { i: vx - 1, j: vy };
  return { i: vx - 1, j: vy - 1 };
}

function dedupeRing(ring: PointMm[]): PointMm[] {
  if (ring.length === 0) return ring;
  const out: PointMm[] = [];
  for (const p of ring) {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(prev.x - p.x, prev.y - p.y) < 0.5) continue;
    out.push(p);
  }
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.5) out.pop();
  }
  return simplifyOrthoRing(out);
}

/**
 * Clip a pool/spa outline by one or more overlapping spa footprints,
 * producing a single continuous polygon (not separate rectangles).
 */
export function clipOutlineByAabbs(
  subject: PointMm[],
  clippers: PointMm[][],
): PointMm[] {
  let ring = openRing(subject);
  for (const clip of clippers) {
    const next = aabbDifferenceRing(ring, clip);
    if (!next || next.length < 3) return ring;
    ring = next;
  }
  return ring;
}

function simplifyOrthoRing(ring: PointMm[]): PointMm[] {
  if (ring.length < 3) return ring;
  const result: PointMm[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[(i - 1 + ring.length) % ring.length];
    const b = ring[i];
    const c = ring[(i + 1) % ring.length];
    const colinear =
      (Math.abs(a.x - b.x) < 1 && Math.abs(b.x - c.x) < 1) ||
      (Math.abs(a.y - b.y) < 1 && Math.abs(b.y - c.y) < 1);
    if (colinear) continue;
    result.push(b);
  }
  return result.length >= 3 ? result : ring;
}

/**
 * Axis-aligned subject minus clipper → covering rectangles (0–4).
 * Used for patio/ground slabs. Prefer {@link aabbDifferenceRing} for pool shells.
 */
export function aabbDifferenceRects(
  subject: PointMm[],
  clipper: PointMm[],
): PointMm[][] {
  const sub = openRing(subject);
  const clip = openRing(clipper);
  if (!isAxisAlignedRect(sub) || !isAxisAlignedRect(clip)) {
    return [sub];
  }
  const S = asBounds(sub);
  const C = asBounds(clip);
  const I = boundsIntersection(S, C);
  if (!I) return [rectRing(S)];
  if (
    I.minX <= S.minX + 1 &&
    I.maxX >= S.maxX - 1 &&
    I.minY <= S.minY + 1 &&
    I.maxY >= S.maxY - 1
  ) {
    return [];
  }
  const out: PointMm[][] = [];
  if (I.minY - S.minY > 1) {
    out.push(
      rectRing({
        minX: S.minX,
        minY: S.minY,
        maxX: S.maxX,
        maxY: I.minY,
        width: S.width,
        height: I.minY - S.minY,
        cx: S.cx,
        cy: (S.minY + I.minY) / 2,
      }),
    );
  }
  if (S.maxY - I.maxY > 1) {
    out.push(
      rectRing({
        minX: S.minX,
        minY: I.maxY,
        maxX: S.maxX,
        maxY: S.maxY,
        width: S.width,
        height: S.maxY - I.maxY,
        cx: S.cx,
        cy: (I.maxY + S.maxY) / 2,
      }),
    );
  }
  if (I.minX - S.minX > 1) {
    out.push(
      rectRing({
        minX: S.minX,
        minY: I.minY,
        maxX: I.minX,
        maxY: I.maxY,
        width: I.minX - S.minX,
        height: I.height,
        cx: (S.minX + I.minX) / 2,
        cy: I.cy,
      }),
    );
  }
  if (S.maxX - I.maxX > 1) {
    out.push(
      rectRing({
        minX: I.maxX,
        minY: I.minY,
        maxX: S.maxX,
        maxY: I.maxY,
        width: S.maxX - I.maxX,
        height: I.height,
        cx: (I.maxX + S.maxX) / 2,
        cy: I.cy,
      }),
    );
  }
  return out;
}

function bboxRing(a: OutlineBounds, b: OutlineBounds): PointMm[] {
  const minX = Math.min(a.minX, b.minX);
  const minY = Math.min(a.minY, b.minY);
  const maxX = Math.max(a.maxX, b.maxX);
  const maxY = Math.max(a.maxY, b.maxY);
  return rectRing({
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  });
}

/**
 * Axis-aligned union as a single orthogonal ring (rectangle or L shape).
 * Falls back to the bounding box when attachment topology is ambiguous.
 */
export function aabbUnionRing(a: PointMm[], b: PointMm[]): PointMm[] {
  const ra = openRing(a);
  const rb = openRing(b);
  const A = asBounds(ra);
  const B = asBounds(rb);
  if (!isAxisAlignedRect(ra) || !isAxisAlignedRect(rb)) {
    return bboxRing(A, B);
  }
  if (
    A.minX <= B.minX + 1 &&
    A.maxX >= B.maxX - 1 &&
    A.minY <= B.minY + 1 &&
    A.maxY >= B.maxY - 1
  ) {
    return rectRing(A);
  }
  if (
    B.minX <= A.minX + 1 &&
    B.maxX >= A.maxX - 1 &&
    B.minY <= A.minY + 1 &&
    B.maxY >= A.maxY - 1
  ) {
    return rectRing(B);
  }

  const areaA = A.width * A.height;
  const areaB = B.width * B.height;
  const inter = boundsIntersection(A, B);
  const interArea = inter ? inter.width * inter.height : 0;
  const unionArea = areaA + areaB - interArea;
  const box = bboxRing(A, B);
  const boxB = asBounds(box);
  if (Math.abs(boxB.width * boxB.height - unionArea) < 1e6) {
    return box;
  }

  return buildAttachedL(A, B) ?? box;
}

/** L-ring when two AABBs share / touch along one side. */
function buildAttachedL(A: OutlineBounds, B: OutlineBounds): PointMm[] | null {
  const pool = A.width * A.height >= B.width * B.height ? A : B;
  const spa = pool === A ? B : A;
  const touchTol = 50;
  const overlapsX =
    spa.maxX > pool.minX - touchTol && spa.minX < pool.maxX + touchTol;
  const overlapsY =
    spa.maxY > pool.minY - touchTol && spa.minY < pool.maxY + touchTol;
  if (!overlapsX || !overlapsY) return null;

  // Spa above pool (touching top edge)
  if (spa.minY >= pool.maxY - touchTol && spa.minY <= pool.maxY + touchTol) {
    const left = Math.max(pool.minX, Math.min(spa.minX, spa.maxX));
    const right = Math.min(pool.maxX, Math.max(spa.minX, spa.maxX));
    return [
      { x: pool.minX, y: pool.minY },
      { x: pool.maxX, y: pool.minY },
      { x: pool.maxX, y: pool.maxY },
      { x: right, y: pool.maxY },
      { x: right, y: spa.maxY },
      { x: left, y: spa.maxY },
      { x: left, y: pool.maxY },
      { x: pool.minX, y: pool.maxY },
    ];
  }
  // Spa below pool
  if (spa.maxY <= pool.minY + touchTol && spa.maxY >= pool.minY - touchTol) {
    const left = Math.max(pool.minX, Math.min(spa.minX, spa.maxX));
    const right = Math.min(pool.maxX, Math.max(spa.minX, spa.maxX));
    return [
      { x: pool.minX, y: pool.minY },
      { x: left, y: pool.minY },
      { x: left, y: spa.minY },
      { x: right, y: spa.minY },
      { x: right, y: pool.minY },
      { x: pool.maxX, y: pool.minY },
      { x: pool.maxX, y: pool.maxY },
      { x: pool.minX, y: pool.maxY },
    ];
  }
  // Spa to the right
  if (spa.minX >= pool.maxX - touchTol && spa.minX <= pool.maxX + touchTol) {
    const bot = Math.max(pool.minY, Math.min(spa.minY, spa.maxY));
    const top = Math.min(pool.maxY, Math.max(spa.minY, spa.maxY));
    return [
      { x: pool.minX, y: pool.minY },
      { x: pool.maxX, y: pool.minY },
      { x: pool.maxX, y: bot },
      { x: spa.maxX, y: bot },
      { x: spa.maxX, y: top },
      { x: pool.maxX, y: top },
      { x: pool.maxX, y: pool.maxY },
      { x: pool.minX, y: pool.maxY },
    ];
  }
  // Spa to the left
  if (spa.maxX <= pool.minX + touchTol && spa.maxX >= pool.minX - touchTol) {
    const bot = Math.max(pool.minY, Math.min(spa.minY, spa.maxY));
    const top = Math.min(pool.maxY, Math.max(spa.minY, spa.maxY));
    return [
      { x: pool.minX, y: pool.minY },
      { x: pool.maxX, y: pool.minY },
      { x: pool.maxX, y: pool.maxY },
      { x: pool.minX, y: pool.maxY },
      { x: pool.minX, y: top },
      { x: spa.minX, y: top },
      { x: spa.minX, y: bot },
      { x: pool.minX, y: bot },
    ];
  }

  // Partial overlap into the pool — bounding box of union is safe for pit punch
  if (boundsOverlap(pool, spa, touchTol)) {
    return bboxRing(pool, spa);
  }
  return null;
}

/**
 * Merge pit footprints so overlapping/touching holes become single rings.
 * Connected groups collapse to an axis-aligned bounding rect — Earcut is
 * unreliable with L-shaped / concave holes, which left decks capping pools.
 */
export function mergePitHoles(holes: PointMm[][]): PointMm[][] {
  const usable = holes.filter((h) => h.length >= 3).map(openRing);
  if (usable.length <= 1) return usable.map((h) => [...h]);

  const groups: PointMm[][][] = usable.map((h) => [h]);
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const connected = groups[i].some((a) =>
          groups[j].some((b) => waterBodiesConnected(a, b)),
        );
        if (!connected) continue;
        groups[i] = [...groups[i], ...groups[j]];
        groups.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }

  return groups.map((group) => {
    let b = asBounds(group[0]);
    for (let i = 1; i < group.length; i++) {
      const o = asBounds(group[i]);
      const minX = Math.min(b.minX, o.minX);
      const minY = Math.min(b.minY, o.minY);
      const maxX = Math.max(b.maxX, o.maxX);
      const maxY = Math.max(b.maxY, o.maxY);
      b = {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
      };
    }
    return rectRing(b);
  });
}

/**
 * Axis-aligned rectangle ring from an outline's bounding box.
 * Handy for nearly-rect patio/deck outlines that fail strict AABB checks.
 */
export function outlineBoundsRect(outline: PointMm[]): PointMm[] {
  return rectRing(asBounds(outline));
}

/**
 * Subtract axis-aligned holes from a subject outline.
 * Returns covering rectangles (empty if fully subtracted).
 * Non-rectangular subjects are treated as their bounding box so skewed
 * hand-drawn decks still punch cleanly.
 */
export function subtractAabbHoles(
  subject: PointMm[],
  holes: PointMm[][],
): PointMm[][] {
  let regions = [
    isAxisAlignedRect(openRing(subject))
      ? openRing(subject)
      : outlineBoundsRect(subject),
  ];
  for (const hole of holes) {
    const clip = isAxisAlignedRect(openRing(hole))
      ? openRing(hole)
      : outlineBoundsRect(hole);
    const next: PointMm[][] = [];
    for (const region of regions) {
      next.push(...aabbDifferenceRects(region, clip));
    }
    regions = next.filter((r) => r.length >= 3);
  }
  return regions;
}

/**
 * True when a pool wall edge should be omitted because it opens into a spa
 * (samples along the edge lie inside the spa, or most of the edge is shared).
 */
export function shouldOmitPoolWallEdge(
  edgeA: PointMm,
  edgeB: PointMm,
  spaOutline: PointMm[],
  tolMm = 60,
): boolean {
  return openWallSegments(edgeA, edgeB, [spaOutline], tolMm).length === 0;
}

/** Parametric overlap of two colinear segments along edgeA→edgeB, or null. */
export function colinearOverlapInterval(
  a1: PointMm,
  a2: PointMm,
  b1: PointMm,
  b2: PointMm,
  tolMm: number,
): [number, number] | null {
  const ax = a2.x - a1.x;
  const ay = a2.y - a1.y;
  const lenA = Math.hypot(ax, ay);
  if (lenA < 1e-6) return null;
  const ux = ax / lenA;
  const uy = ay / lenA;
  const bx = b2.x - b1.x;
  const by = b2.y - b1.y;
  const lenB = Math.hypot(bx, by);
  if (lenB < 1e-6) return null;
  if (Math.abs(ux * (by / lenB) - uy * (bx / lenB)) > 0.05) return null;
  const lineDist = (p: PointMm) =>
    Math.abs(ux * (p.y - a1.y) - uy * (p.x - a1.x));
  if (lineDist(b1) > tolMm || lineDist(b2) > tolMm) return null;
  const proj = (p: PointMm) => (p.x - a1.x) * ux + (p.y - a1.y) * uy;
  let bMin = proj(b1);
  let bMax = proj(b2);
  if (bMin > bMax) {
    const tmp = bMin;
    bMin = bMax;
    bMax = tmp;
  }
  const left = Math.max(0, bMin);
  const right = Math.min(lenA, bMax);
  if (right - left <= 1) return null;
  return [left, right];
}

/**
 * Wall segments to keep after opening an edge against one or more blockers
 * (attached spa/pool). Splits partially-shared edges so exterior walls remain.
 */
export function openWallSegments(
  edgeA: PointMm,
  edgeB: PointMm,
  blockers: PointMm[][],
  tolMm = 60,
  minKeepMm = 40,
): { a: PointMm; b: PointMm }[] {
  const len = segmentLengthMm(edgeA, edgeB);
  if (len < minKeepMm) return [];
  if (blockers.length === 0) return [{ a: edgeA, b: edgeB }];

  const ux = (edgeB.x - edgeA.x) / len;
  const uy = (edgeB.y - edgeA.y) / len;
  const covered: [number, number][] = [];
  const add = (t0: number, t1: number) => {
    const lo = Math.max(0, Math.min(t0, t1));
    const hi = Math.min(len, Math.max(t0, t1));
    if (hi - lo > 1) covered.push([lo, hi]);
  };

  for (const poly of blockers) {
    const ring = openRing(poly);
    if (ring.length < 3) continue;
    for (let i = 0; i < ring.length; i++) {
      const iv = colinearOverlapInterval(
        edgeA,
        edgeB,
        ring[i],
        ring[(i + 1) % ring.length],
        tolMm,
      );
      if (iv) add(iv[0], iv[1]);
    }
    let runStart: number | null = null;
    const n = Math.max(8, Math.ceil(len / 80));
    for (let s = 0; s <= n; s++) {
      const t = (s / n) * len;
      const p = { x: edgeA.x + ux * t, y: edgeA.y + uy * t };
      const inBlocker =
        pointInPolygon(p, ring) || distToPolygonBoundaryMm(p, ring) <= tolMm;
      if (inBlocker) {
        if (runStart === null) runStart = Math.max(0, t - len / n);
      } else if (runStart !== null) {
        add(runStart, t);
        runStart = null;
      }
    }
    if (runStart !== null) add(runStart, len);
  }

  covered.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const iv of covered) {
    const last = merged[merged.length - 1];
    if (!last || iv[0] > last[1] + 1) merged.push([iv[0], iv[1]]);
    else last[1] = Math.max(last[1], iv[1]);
  }

  const keep: { a: PointMm; b: PointMm }[] = [];
  let cursor = 0;
  for (const [c0, c1] of merged) {
    if (c0 - cursor >= minKeepMm) {
      keep.push({
        a: { x: edgeA.x + ux * cursor, y: edgeA.y + uy * cursor },
        b: { x: edgeA.x + ux * c0, y: edgeA.y + uy * c0 },
      });
    }
    cursor = c1;
  }
  if (len - cursor >= minKeepMm) {
    keep.push({
      a: { x: edgeA.x + ux * cursor, y: edgeA.y + uy * cursor },
      b: { x: edgeB.x, y: edgeB.y },
    });
  }
  return keep;
}
