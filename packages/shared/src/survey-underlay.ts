/**
 * Site-survey underlay placement and two-point scale calibration.
 * The CAD unit is millimeters; a known printed dimension sets mm per pixel.
 */

import type { PointMm, SurveyUnderlay } from "./design-model";
import { normalizeNorthDeg, segmentLengthMm } from "./design-model";
import { MM_PER_FOOT, parseLengthToMm, type UnitSystem } from "./units";

/** Initial uncalibrated width — 80′ so a typical plat is on-screen. */
export const DEFAULT_SURVEY_WIDTH_MM = 80 * MM_PER_FOOT;
export const DEFAULT_SURVEY_OPACITY = 0.45;

export function storedSurveyImageUrl(
  url: string | null | undefined,
): string | null {
  if (typeof url !== "string" || !url) return null;
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  // Local Docker without Blob may round-trip a data URL; cap size.
  if (url.startsWith("data:image/") && url.length < 4_000_000) return url;
  return null;
}

export function surveyAspectHeightMm(
  widthMm: number,
  pixelWidth: number,
  pixelHeight: number,
): number {
  const w = Math.max(1, pixelWidth);
  return widthMm * (Math.max(1, pixelHeight) / w);
}

export function createSurveyUnderlay(opts: {
  imageUrl: string;
  pixelWidth: number;
  pixelHeight: number;
  origin?: PointMm;
}): SurveyUnderlay {
  const pixelWidth = Math.max(1, Math.round(opts.pixelWidth));
  const pixelHeight = Math.max(1, Math.round(opts.pixelHeight));
  const widthMm = DEFAULT_SURVEY_WIDTH_MM;
  return {
    imageUrl: opts.imageUrl,
    pixelWidth,
    pixelHeight,
    widthMm,
    heightMm: surveyAspectHeightMm(widthMm, pixelWidth, pixelHeight),
    origin: opts.origin ?? { x: 0, y: 0 },
    rotationDeg: 0,
    opacity: DEFAULT_SURVEY_OPACITY,
    locked: false,
    calibrated: false,
  };
}

/** Local mm on the bitmap (origin at top-left, +X along the top edge). */
export function worldToSurveyLocal(
  underlay: SurveyUnderlay,
  p: PointMm,
): PointMm {
  const dx = p.x - underlay.origin.x;
  const dy = p.y - underlay.origin.y;
  const rad = (underlay.rotationDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: dx * c + dy * s,
    y: -dx * s + dy * c,
  };
}

export function surveyLocalToWorld(
  underlay: SurveyUnderlay,
  local: PointMm,
): PointMm {
  const rad = (underlay.rotationDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: underlay.origin.x + local.x * c - local.y * s,
    y: underlay.origin.y + local.x * s + local.y * c,
  };
}

export function pointInSurveyUnderlay(
  underlay: SurveyUnderlay,
  p: PointMm,
): boolean {
  const local = worldToSurveyLocal(underlay, p);
  return (
    local.x >= 0 &&
    local.y >= 0 &&
    local.x <= underlay.widthMm &&
    local.y <= underlay.heightMm
  );
}

export function surveyUnderlayCenter(underlay: SurveyUnderlay): PointMm {
  return surveyLocalToWorld(underlay, {
    x: underlay.widthMm / 2,
    y: underlay.heightMm / 2,
  });
}

/**
 * Scale the underlay about `a` so that world distance a→b becomes `knownMm`.
 * That is how a printed dimension (e.g. 50′) is matched to CAD millimeters.
 */
export function calibrateSurveyUnderlay(
  underlay: SurveyUnderlay,
  a: PointMm,
  b: PointMm,
  knownMm: number,
): SurveyUnderlay {
  const d = segmentLengthMm(a, b);
  if (d < 1e-3 || !(knownMm > 0) || !Number.isFinite(knownMm)) return underlay;
  const factor = knownMm / d;
  const widthMm = underlay.widthMm * factor;
  return {
    ...underlay,
    origin: {
      x: a.x + (underlay.origin.x - a.x) * factor,
      y: a.y + (underlay.origin.y - a.y) * factor,
    },
    widthMm,
    heightMm: surveyAspectHeightMm(
      widthMm,
      underlay.pixelWidth,
      underlay.pixelHeight,
    ),
    calibrated: true,
  };
}

export function moveSurveyUnderlay(
  underlay: SurveyUnderlay,
  dx: number,
  dy: number,
): SurveyUnderlay {
  return {
    ...underlay,
    origin: { x: underlay.origin.x + dx, y: underlay.origin.y + dy },
  };
}

/** Smallest signed turn from `fromDeg` to `toDeg` in (-180, 180]. */
export function shortestSignedDeltaDeg(fromDeg: number, toDeg: number): number {
  return ((((toDeg - fromDeg) % 360) + 540) % 360) - 180;
}

/** 0 / 90 / 180 / 270 nearest to `deg` (Y-down plan, 0 = +X). */
export function nearestCardinalDeg(deg: number): number {
  const n = ((deg % 360) + 360) % 360;
  const cards = [0, 90, 180, 270];
  let best = 0;
  let bestDist = Infinity;
  for (const c of cards) {
    const d = Math.abs(shortestSignedDeltaDeg(n, c));
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/** Degrees to rotate so a line at `lineDeg` matches the CAD grid. */
export function axisAlignDeltaDeg(lineDeg: number): number {
  return shortestSignedDeltaDeg(lineDeg, nearestCardinalDeg(lineDeg));
}

/**
 * Rotate the sheet so world segment a→b becomes horizontal or vertical
 * (whichever is closer). House / lot lines then match the CAD grid.
 */
export function alignSurveyUnderlayToAxis(
  underlay: SurveyUnderlay,
  a: PointMm,
  b: PointMm,
): SurveyUnderlay {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 1) return underlay;
  const lineDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const delta = axisAlignDeltaDeg(lineDeg);
  if (Math.abs(delta) < 0.05) return underlay;
  return rotateSurveyUnderlay(underlay, delta);
}

/**
 * `imageLineDeg` is a dominant line in the bitmap (0 = top edge / +X).
 * Rotates the underlay so that line — and the house walls along it — sit on
 * the CAD grid.
 */
export function squareSurveyUnderlayToImageLine(
  underlay: SurveyUnderlay,
  imageLineDeg: number,
): SurveyUnderlay {
  const worldLineDeg = underlay.rotationDeg + imageLineDeg;
  const delta = axisAlignDeltaDeg(worldLineDeg);
  if (Math.abs(delta) < 0.05) return underlay;
  return rotateSurveyUnderlay(underlay, delta);
}

/** Rotate about the image center so the sheet stays put. */
export function rotateSurveyUnderlay(
  underlay: SurveyUnderlay,
  deltaDeg: number,
): SurveyUnderlay {
  const c0 = surveyUnderlayCenter(underlay);
  const next: SurveyUnderlay = {
    ...underlay,
    rotationDeg: normalizeNorthDeg(underlay.rotationDeg + deltaDeg),
  };
  const c1 = surveyUnderlayCenter(next);
  return {
    ...next,
    origin: {
      x: next.origin.x + (c0.x - c1.x),
      y: next.origin.y + (c0.y - c1.y),
    },
  };
}

/** Plan millimeters represented by one image pixel (along width). */
export function surveyMmPerPixel(underlay: SurveyUnderlay): number {
  return underlay.widthMm / Math.max(1, underlay.pixelWidth);
}

export function surveyUnderlayWorldCorners(underlay: SurveyUnderlay): PointMm[] {
  const { widthMm, heightMm } = underlay;
  return [
    surveyLocalToWorld(underlay, { x: 0, y: 0 }),
    surveyLocalToWorld(underlay, { x: widthMm, y: 0 }),
    surveyLocalToWorld(underlay, { x: widthMm, y: heightMm }),
    surveyLocalToWorld(underlay, { x: 0, y: heightMm }),
  ];
}

/**
 * Printed survey callouts are almost always feet or meters.
 * Bare `50` → 50′ (imperial) or 50 m (metric). Also accepts ′ ’ ″ quotes.
 */
export function parseSurveyKnownLengthToMm(
  input: string,
  unitSystem: UnitSystem,
): number | null {
  const normalized = input
    .trim()
    .replace(/[′’]/g, "'")
    .replace(/[″“”]/g, '"');
  if (!normalized) return null;
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    const n = Number(normalized);
    if (!Number.isFinite(n) || n <= 0) return null;
    return unitSystem === "metric" ? n * 1000 : n * MM_PER_FOOT;
  }
  return parseLengthToMm(normalized, unitSystem);
}

export function normalizeSurveyUnderlay(
  raw: SurveyUnderlay | undefined | null,
): SurveyUnderlay | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const imageUrl = storedSurveyImageUrl(raw.imageUrl);
  if (!imageUrl) return undefined;
  const pixelWidth = Math.max(1, Math.round(Number(raw.pixelWidth) || 1));
  const pixelHeight = Math.max(1, Math.round(Number(raw.pixelHeight) || 1));
  const widthMm =
    typeof raw.widthMm === "number" &&
    Number.isFinite(raw.widthMm) &&
    raw.widthMm > 0
      ? raw.widthMm
      : DEFAULT_SURVEY_WIDTH_MM;
  const origin =
    raw.origin &&
    typeof raw.origin.x === "number" &&
    typeof raw.origin.y === "number"
      ? { x: raw.origin.x, y: raw.origin.y }
      : { x: 0, y: 0 };
  const opacity =
    typeof raw.opacity === "number" && Number.isFinite(raw.opacity)
      ? Math.min(1, Math.max(0.08, raw.opacity))
      : DEFAULT_SURVEY_OPACITY;
  return {
    imageUrl,
    pixelWidth,
    pixelHeight,
    widthMm,
    heightMm: surveyAspectHeightMm(widthMm, pixelWidth, pixelHeight),
    origin,
    rotationDeg: normalizeNorthDeg(raw.rotationDeg),
    opacity,
    locked: raw.locked === true,
    calibrated: raw.calibrated === true,
  };
}
