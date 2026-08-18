/**
 * Find the small rotation that makes a survey scan's strongest lines
 * horizontal/vertical. Plats are mostly axis-aligned ink; a diagonal scan
 * shows up as a peak a few degrees off 0° or 90°.
 */

const MAX_SIDE = 360;
const THETA_STEP = 0.5;
const MAG_MIN = 32;

export type SurveySkewHint = {
  /** Line direction in the bitmap (0 = top edge). */
  imageLineDeg: number;
  /** Peak votes / runner-up. Higher is more trustworthy. */
  confidence: number;
};

function grayscale(data: Uint8ClampedArray, i: number): number {
  return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
}

/**
 * Dominant near-axis line in the survey bitmap.
 * Returns null when the sheet is too faint or not a slight skew.
 */
export function detectSurveyImageSkew(
  image: CanvasImageSource,
  pixelWidth: number,
  pixelHeight: number,
): SurveySkewHint | null {
  const srcW = Math.max(1, pixelWidth);
  const srcH = Math.max(1, pixelHeight);
  const scale = MAX_SIDE / Math.max(srcW, srcH);
  const w = Math.max(8, Math.round(srcW * scale));
  const h = Math.max(8, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, w, h);
  let pixels: ImageData;
  try {
    pixels = ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
  const { data } = pixels;

  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const gx =
        -grayscale(data, ((y - 1) * w + (x - 1)) * 4) +
        grayscale(data, ((y - 1) * w + (x + 1)) * 4) +
        -2 * grayscale(data, (y * w + (x - 1)) * 4) +
        2 * grayscale(data, (y * w + (x + 1)) * 4) +
        -grayscale(data, ((y + 1) * w + (x - 1)) * 4) +
        grayscale(data, ((y + 1) * w + (x + 1)) * 4);
      const gy =
        -grayscale(data, ((y - 1) * w + (x - 1)) * 4) +
        -2 * grayscale(data, ((y - 1) * w + x) * 4) +
        -grayscale(data, ((y - 1) * w + (x + 1)) * 4) +
        grayscale(data, ((y + 1) * w + (x - 1)) * 4) +
        2 * grayscale(data, ((y + 1) * w + x) * 4) +
        grayscale(data, ((y + 1) * w + (x + 1)) * 4);
      mag[y * w + x] = Math.hypot(gx, gy);
    }
  }

  const thetaCount = Math.round(180 / THETA_STEP);
  const diag = Math.hypot(w, h);
  const rhoMax = Math.ceil(diag);
  const rhoCount = rhoMax * 2 + 1;
  const acc = new Float32Array(thetaCount * rhoCount);
  const marginX = Math.round(w * 0.06);
  const marginY = Math.round(h * 0.06);

  for (let y = marginY; y < h - marginY; y++) {
    for (let x = marginX; x < w - marginX; x++) {
      const m = mag[y * w + x];
      if (m < MAG_MIN) continue;
      for (let t = 0; t < thetaCount; t++) {
        const thetaDeg = t * THETA_STEP;
        const d0 = Math.min(thetaDeg, 180 - thetaDeg);
        const d90 = Math.abs(thetaDeg - 90);
        if (d0 > 25 && d90 > 25) continue;
        const theta = (thetaDeg * Math.PI) / 180;
        const rho = x * Math.cos(theta) + y * Math.sin(theta);
        const r = Math.round(rho + rhoMax);
        if (r < 0 || r >= rhoCount) continue;
        acc[t * rhoCount + r] += m;
      }
    }
  }

  let best = 0;
  let bestVal = 0;
  let second = 0;
  for (let i = 0; i < acc.length; i++) {
    const v = acc[i];
    if (v > bestVal) {
      second = bestVal;
      bestVal = v;
      best = i;
    } else if (v > second) {
      second = v;
    }
  }
  if (bestVal < 1) return null;
  const thetaBin = Math.floor(best / rhoCount);
  const thetaDeg = thetaBin * THETA_STEP;
  // θ is the normal; the line itself is 90° from that.
  const imageLineDeg = thetaDeg - 90;
  const confidence = second > 0 ? bestVal / second : 4;
  const skew = Math.abs((((imageLineDeg % 90) + 90) % 90));
  const distToAxis = Math.min(skew, 90 - skew);
  if (distToAxis > 22) return null;
  if (confidence < 1.08 && distToAxis > 1) return null;
  return { imageLineDeg, confidence };
}
