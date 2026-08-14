import type { PointMm } from "./design-model";

/** DXF bulge = tan(included sweep / 4). |4| ≈ 303° — beyond that is rarely useful. */
export const MAX_BULGE = 4;

/** Tessellation step for arcs in plan mm (~5″). */
export const ARC_FLATTEN_STEP_MM = 120;

export function outlineHasArcs(outline: PointMm[]): boolean {
  return outline.some((p) => Math.abs(p.bulge ?? 0) > 1e-6);
}

export function clampBulge(bulge: number): number {
  if (!Number.isFinite(bulge) || Math.abs(bulge) < 1e-6) return 0;
  return Math.max(-MAX_BULGE, Math.min(MAX_BULGE, bulge));
}

export type ArcGeom = {
  cx: number;
  cy: number;
  r: number;
  /** Signed included angle (radians). Positive = CCW in plan coords. */
  sweep: number;
  startAng: number;
};

/**
 * Circular arc from `a` to `b` implied by DXF bulge on `a`.
 * Returns null when the edge is straight or degenerate.
 */
export function arcFromBulge(
  a: PointMm,
  b: PointMm,
  bulge: number,
): ArcGeom | null {
  if (Math.abs(bulge) < 1e-6) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-6) return null;
  const r = (chord * (1 + bulge * bulge)) / (4 * Math.abs(bulge));
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const half = chord / 2;
  const d = Math.sqrt(Math.max(0, r * r - half * half));
  const px = -dy / chord;
  const py = dx / chord;
  // Minor arc: center opposite the bulge; major arc: center on the bulge side.
  const side = Math.sign(bulge) * (Math.abs(bulge) > 1 ? 1 : -1);
  const cx = mx + px * d * side;
  const cy = my + py * d * side;
  const startAng = Math.atan2(a.y - cy, a.x - cx);
  const apex = arcApex(a, b, bulge);
  if (!apex) return null;
  const apexAng = Math.atan2(apex.y - cy, apex.x - cx);
  let toApex = apexAng - startAng;
  while (toApex > Math.PI) toApex -= Math.PI * 2;
  while (toApex < -Math.PI) toApex += Math.PI * 2;
  return {
    cx,
    cy,
    r,
    sweep: 2 * toApex,
    startAng,
  };
}

/** Mid-arc point (sagitta tip). Null when the edge is straight. */
export function arcApex(
  a: PointMm,
  b: PointMm,
  bulge: number,
): PointMm | null {
  if (Math.abs(bulge) < 1e-6) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-6) return null;
  const sagitta = (bulge * chord) / 2;
  return {
    x: (a.x + b.x) / 2 + (-dy / chord) * sagitta,
    y: (a.y + b.y) / 2 + (dx / chord) * sagitta,
  };
}

/**
 * Bulge that puts the arc through `p` (sagitta from the chord midpoint).
 * Dragging onto the chord clears the bulge.
 */
export function bulgeFromPoint(a: PointMm, b: PointMm, p: PointMm): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-6) return 0;
  const sagitta =
    (p.x - (a.x + b.x) / 2) * (-dy / chord) +
    (p.y - (a.y + b.y) / 2) * (dx / chord);
  if (Math.abs(sagitta) < 1) return 0;
  return clampBulge((2 * sagitta) / chord);
}

/** Screen-stable idle offset: circle sits this many mm off a straight chord. */
export function bulgeHandlePoint(
  a: PointMm,
  b: PointMm,
  idleOffsetMm: number,
): PointMm {
  const bulge = a.bulge ?? 0;
  if (Math.abs(bulge) > 1e-6) {
    const apex = arcApex(a, b, bulge);
    if (apex) return apex;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: (a.x + b.x) / 2 + (-dy / len) * idleOffsetMm,
    y: (a.y + b.y) / 2 + (dx / len) * idleOffsetMm,
  };
}

export function arcLengthMm(a: PointMm, b: PointMm, bulge: number): number {
  const arc = arcFromBulge(a, b, bulge);
  if (!arc) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
  return arc.r * Math.abs(arc.sweep);
}

/** Chord or arc length of the outgoing edge from `a` toward `b`. */
export function edgeLengthMm(a: PointMm, b: PointMm): number {
  const bulge = a.bulge ?? 0;
  if (Math.abs(bulge) > 1e-6) return arcLengthMm(a, b, bulge);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function flattenArc(
  a: PointMm,
  b: PointMm,
  bulge: number,
  stepMm: number,
): PointMm[] {
  const arc = arcFromBulge(a, b, bulge);
  if (!arc) return [];
  const arcLen = arc.r * Math.abs(arc.sweep);
  const steps = Math.max(2, Math.ceil(arcLen / Math.max(20, stepMm)));
  const pts: PointMm[] = [];
  for (let i = 1; i < steps; i++) {
    const ang = arc.startAng + arc.sweep * (i / steps);
    pts.push({
      x: arc.cx + arc.r * Math.cos(ang),
      y: arc.cy + arc.r * Math.sin(ang),
    });
  }
  return pts;
}

/** Vertices along one edge, including endpoints. Straight edges stay two points. */
export function flattenEdge(
  a: PointMm,
  b: PointMm,
  stepMm = ARC_FLATTEN_STEP_MM,
): PointMm[] {
  const bulge = a.bulge ?? 0;
  if (Math.abs(bulge) < 1e-6) return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
  return [
    { x: a.x, y: a.y },
    ...flattenArc(a, b, bulge, stepMm),
    { x: b.x, y: b.y },
  ];
}

/**
 * Closed outline with arcs tessellated to line segments.
 * Vertex bulge is dropped on the result (dense polyline).
 */
export function flattenClosedOutline(
  outline: PointMm[],
  stepMm = ARC_FLATTEN_STEP_MM,
): PointMm[] {
  if (outline.length < 2) return outline.map((p) => ({ x: p.x, y: p.y }));
  if (!outlineHasArcs(outline)) {
    return outline.map((p) => ({ x: p.x, y: p.y }));
  }
  const n = outline.length;
  const out: PointMm[] = [];
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    out.push({ x: a.x, y: a.y });
    const bulge = a.bulge ?? 0;
    if (Math.abs(bulge) > 1e-6) {
      out.push(...flattenArc(a, b, bulge, stepMm));
    }
  }
  return out;
}
