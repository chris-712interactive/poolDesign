/**
 * User-traced property lines and easements.
 * Geometry is authored in CAD (typically over a calibrated survey) — never invented.
 */

import type { PointMm, SiteLine, SiteLineKind } from "./design-model";
import { polylineLengthMm, segmentLengthMm } from "./design-model";

export function isSiteLineKind(value: unknown): value is SiteLineKind {
  return value === "property" || value === "easement";
}

export function siteLineKindLabel(kind: SiteLineKind): string {
  return kind === "easement" ? "Easement" : "Property line";
}

export function siteLineEdgeTag(kind: SiteLineKind): string {
  return kind === "easement" ? "ESMT" : "PL";
}

export function siteLineSegments(line: SiteLine): [PointMm, PointMm][] {
  const pts = line.points;
  if (pts.length < 2) return [];
  const segs: [PointMm, PointMm][] = [];
  for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
  if (line.closed && pts.length >= 3) {
    segs.push([pts[pts.length - 1], pts[0]]);
  }
  return segs;
}

export function siteLineLengthMm(line: SiteLine): number {
  const open = polylineLengthMm(line.points);
  if (line.closed && line.points.length >= 3) {
    return open + segmentLengthMm(line.points[line.points.length - 1], line.points[0]);
  }
  return open;
}

export function pointNearSiteLine(
  line: SiteLine,
  point: PointMm,
  tolMm: number,
): boolean {
  for (const [a, b] of siteLineSegments(line)) {
    if (distToSegment(point, a, b) <= tolMm) return true;
  }
  return false;
}

function distToSegment(p: PointMm, a: PointMm, b: PointMm): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return segmentLengthMm(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

export function createSiteLine(opts: {
  id: string;
  kind: SiteLineKind;
  points: PointMm[];
  index: number;
  closed?: boolean;
}): SiteLine {
  const n = Math.max(1, opts.index);
  return {
    id: opts.id,
    name: opts.kind === "easement" ? `Easement ${n}` : `Property line ${n}`,
    kind: opts.kind,
    points: opts.points,
    closed: opts.closed === true && opts.points.length >= 3,
    widthMm: opts.kind === "easement" ? 0 : undefined,
  };
}

export function normalizeSiteLines(
  raw: SiteLine[] | undefined | null,
): SiteLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l) =>
        l &&
        typeof l.id === "string" &&
        Array.isArray(l.points) &&
        l.points.length >= 2,
    )
    .map((l) => {
      const kind: SiteLineKind = isSiteLineKind(l.kind) ? l.kind : "property";
      const widthMm =
        kind === "easement" &&
        typeof l.widthMm === "number" &&
        Number.isFinite(l.widthMm) &&
        l.widthMm > 0
          ? l.widthMm
          : kind === "easement"
            ? 0
            : undefined;
      return {
        id: l.id,
        name:
          typeof l.name === "string" && l.name.trim()
            ? l.name.trim()
            : kind === "easement"
              ? "Easement"
              : "Property line",
        kind,
        points: l.points.map((p) => ({ x: p.x, y: p.y })),
        closed: l.closed === true && l.points.length >= 3,
        widthMm,
        notes:
          typeof l.notes === "string" && l.notes.trim()
            ? l.notes.trim()
            : undefined,
      };
    });
}
