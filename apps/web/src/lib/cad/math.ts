import { snapMm, type PointMm, type UnitSystem } from "@pool-design/shared";

export type Viewport = {
  /** pixels per mm */
  scale: number;
  /** pan in screen pixels */
  panX: number;
  panY: number;
};

export const DEFAULT_VIEWPORT: Viewport = {
  scale: 0.05,
  panX: 80,
  panY: 80,
};

export function worldToScreen(p: PointMm, vp: Viewport) {
  return {
    x: vp.panX + p.x * vp.scale,
    y: vp.panY + p.y * vp.scale,
  };
}

export function screenToWorld(
  x: number,
  y: number,
  vp: Viewport,
  unitSystem: UnitSystem,
  snap = true,
): PointMm {
  const raw = {
    x: (x - vp.panX) / vp.scale,
    y: (y - vp.panY) / vp.scale,
  };
  if (!snap) return raw;
  return {
    x: snapMm(raw.x, unitSystem),
    y: snapMm(raw.y, unitSystem),
  };
}

export function applyOrtho(from: PointMm, to: PointMm): PointMm {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx >= dy) return { x: to.x, y: from.y };
  return { x: from.x, y: to.y };
}

/** Snap direction to nearest angle step (degrees), keeping distance from `from` to `to`. */
export function applyAngleSnap(
  from: PointMm,
  to: PointMm,
  stepDeg: number,
): PointMm {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return to;
  const angle = Math.atan2(dy, dx);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(angle / step) * step;
  return {
    x: from.x + Math.cos(snapped) * dist,
    y: from.y + Math.sin(snapped) * dist,
  };
}

/** Point at distance `lengthMm` from `from` toward `to` (or along ortho/angle constrained direction). */
export function pointAtLength(
  from: PointMm,
  toward: PointMm,
  lengthMm: number,
): PointMm {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return { x: from.x + lengthMm, y: from.y };
  const ux = dx / dist;
  const uy = dy / dist;
  return { x: from.x + ux * lengthMm, y: from.y + uy * lengthMm };
}

export function zoomAt(
  vp: Viewport,
  screenX: number,
  screenY: number,
  factor: number,
): Viewport {
  const min = 0.01;
  const max = 0.4;
  const nextScale = Math.min(max, Math.max(min, vp.scale * factor));
  const worldX = (screenX - vp.panX) / vp.scale;
  const worldY = (screenY - vp.panY) / vp.scale;
  return {
    scale: nextScale,
    panX: screenX - worldX * nextScale,
    panY: screenY - worldY * nextScale,
  };
}

/** Pan/zoom so the given world points fill the canvas with padding. */
export function viewportToFitWorld(
  points: PointMm[],
  viewW: number,
  viewH: number,
  padding = 48,
): Viewport {
  if (points.length === 0 || viewW < 8 || viewH < 8) return DEFAULT_VIEWPORT;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const innerW = Math.max(8, viewW - padding * 2);
  const innerH = Math.max(8, viewH - padding * 2);
  const scale = Math.min(0.4, Math.max(0.01, Math.min(innerW / w, innerH / h)));
  return {
    scale,
    panX: (viewW - w * scale) / 2 - minX * scale,
    panY: (viewH - h * scale) / 2 - minY * scale,
  };
}
