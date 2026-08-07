export type UnitSystem = "imperial" | "metric";

/** Canonical storage unit: millimeters */
export const MM_PER_INCH = 25.4;
export const MM_PER_FOOT = 304.8;

/** Imperial snap: 1/32 inch in mm */
export const IMPERIAL_SNAP_MM = MM_PER_INCH / 32;

/** Metric snap: 1 mm */
export const METRIC_SNAP_MM = 1;

export function snapMm(valueMm: number, unitSystem: UnitSystem): number {
  const step = unitSystem === "imperial" ? IMPERIAL_SNAP_MM : METRIC_SNAP_MM;
  return Math.round(valueMm / step) * step;
}

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export function inchesToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

export function mmToFeet(mm: number): number {
  return mm / MM_PER_FOOT;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Format length for display from canonical millimeters */
export function formatLength(mm: number, unitSystem: UnitSystem): string {
  if (unitSystem === "metric") {
    if (Math.abs(mm) >= 1000) {
      return `${(mm / 1000).toFixed(3)} m`;
    }
    if (Math.abs(mm) >= 100) {
      return `${(mm / 10).toFixed(1)} cm`;
    }
    return `${Math.round(mm)} mm`;
  }

  const totalInches = mmToInches(mm);
  const sign = totalInches < 0 ? "-" : "";
  const abs = Math.abs(totalInches);
  const feet = Math.floor(abs / 12);
  const inches = abs - feet * 12;
  const thirtySeconds = Math.round(inches * 32);
  const whole = Math.floor(thirtySeconds / 32);
  let numer = thirtySeconds % 32;
  let denom = 32;

  if (numer === 0) {
    if (feet === 0) return `${sign}${whole}"`;
    if (whole === 0) return `${sign}${feet}'-0"`;
    return `${sign}${feet}'-${whole}"`;
  }

  const g = gcd(numer, denom);
  numer /= g;
  denom /= g;
  const inchPart = whole > 0 ? `${whole} ${numer}/${denom}` : `${numer}/${denom}`;
  if (feet === 0) return `${sign}${inchPart}"`;
  return `${sign}${feet}'-${inchPart}"`;
}

/** Parse a mixed-number inch token: 8, 8.5, 8 1/2, 1/2 */
function parseInchToken(token: string): number | null {
  const t = token.trim();
  if (!t) return null;
  const mixed = t.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = parseInt(mixed[1], 10);
    const numer = parseInt(mixed[2], 10);
    const denom = parseInt(mixed[3], 10);
    if (!denom) return null;
    const sign = whole < 0 ? -1 : 1;
    return sign * (Math.abs(whole) + numer / denom);
  }
  const frac = t.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const numer = parseInt(frac[1], 10);
    const denom = parseInt(frac[2], 10);
    if (!denom) return null;
    return numer / denom;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse length input into mm.
 * Accepts architectural forms that {@link formatLength} emits, e.g. 6'-8", 3'-0",
 * plus 6' 8", 6ft 8in, 36", 36 in, 3/4", 2.5m, 2500mm, and bare numbers
 * (inches in imperial, mm in metric).
 */
export function parseLengthToMm(
  input: string,
  unitSystem: UnitSystem,
): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Normalize: collapse whitespace, unify dashes between feet/inches.
  let raw = trimmed
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-");

  const sign = raw.startsWith("-") ? -1 : 1;
  if (raw.startsWith("-") || raw.startsWith("+")) raw = raw.slice(1).trim();

  // Explicit metric units
  const meters = raw.match(/^(\d+(?:\.\d+)?)\s*m$/);
  if (meters) return sign * parseFloat(meters[1]) * 1000;

  const cm = raw.match(/^(\d+(?:\.\d+)?)\s*cm$/);
  if (cm) return sign * parseFloat(cm[1]) * 10;

  const mmOnly = raw.match(/^(\d+(?:\.\d+)?)\s*mm$/);
  if (mmOnly) return sign * parseFloat(mmOnly[1]);

  // Feet + inches: 6'-8", 6'8", 6' 8", 6ft-8in, 6 ft 8 in, 6'-8 1/2"
  const feetInches = raw.match(
    /^(\d+(?:\.\d+)?)\s*(?:'|ft)\s*-?\s*(?:(\d+(?:\.\d+)?(?:\s+\d+\s*\/\s*\d+)?|\d+\s*\/\s*\d+))?\s*(?:"|in|inch|inches)?$/,
  );
  if (feetInches) {
    const ft = parseFloat(feetInches[1]);
    const inchPart = feetInches[2] ? parseInchToken(feetInches[2]) : 0;
    if (inchPart == null || !Number.isFinite(ft)) return null;
    return sign * inchesToMm(ft * 12 + inchPart);
  }

  // Feet only: 6', 6ft
  const feetOnly = raw.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft)$/);
  if (feetOnly) return sign * inchesToMm(parseFloat(feetOnly[1]) * 12);

  // Inches with mark / word: 36", 36in, 8 1/2", 3/4"
  const inchesOnly = raw.match(
    /^(\d+(?:\.\d+)?(?:\s+\d+\s*\/\s*\d+)?|\d+\s*\/\s*\d+)\s*(?:"|in|inch|inches)$/,
  );
  if (inchesOnly) {
    const inch = parseInchToken(inchesOnly[1]);
    if (inch == null) return null;
    return sign * inchesToMm(inch);
  }

  // Mixed number without unit mark when imperial (e.g. "8 1/2")
  if (unitSystem === "imperial") {
    const mixedBare = raw.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixedBare) {
      const inch = parseInchToken(raw);
      if (inch != null) return sign * inchesToMm(inch);
    }
    const fracBare = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fracBare) {
      const inch = parseInchToken(raw);
      if (inch != null) return sign * inchesToMm(inch);
    }
  }

  // Bare number: inches (imperial) or mm (metric)
  const bare = Number(raw.replace(/\s+/g, ""));
  if (!Number.isFinite(bare)) return null;
  return sign * (unitSystem === "metric" ? bare : inchesToMm(bare));
}
