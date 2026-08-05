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

/** Parse simple length input into mm (supports 10'6", 10'6.5", 3.2m, 3200mm, 12.5") */
export function parseLengthToMm(input: string, unitSystem: UnitSystem): number | null {
  const raw = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return null;

  const meters = raw.match(/^(-?\d+(?:\.\d+)?)m$/);
  if (meters) return parseFloat(meters[1]) * 1000;

  const cm = raw.match(/^(-?\d+(?:\.\d+)?)cm$/);
  if (cm) return parseFloat(cm[1]) * 10;

  const mm = raw.match(/^(-?\d+(?:\.\d+)?)mm$/);
  if (mm) return parseFloat(mm[1]);

  const feetInches = raw.match(/^(-?)(?:(\d+)')?(?:(-?\d+(?:\.\d+)?)(?:"|in)?)?$/);
  if (feetInches && (feetInches[2] || feetInches[3])) {
    const sign = feetInches[1] === "-" ? -1 : 1;
    const ft = feetInches[2] ? parseInt(feetInches[2], 10) : 0;
    const inch = feetInches[3] ? parseFloat(feetInches[3]) : 0;
    return sign * inchesToMm(ft * 12 + inch);
  }

  const bare = Number(raw);
  if (!Number.isFinite(bare)) return null;
  return unitSystem === "metric" ? bare : inchesToMm(bare);
}
