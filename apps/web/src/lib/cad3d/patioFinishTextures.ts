import * as THREE from "three";
import {
  getPatioFinish,
  type PatioFinish,
  type PatioFinishPattern,
} from "@pool-design/shared";

/** Inches → meters (plan UVs on patio extrudes are world meters). */
const IN = 0.0254;

/**
 * Industry sizes used for patio hardscape (US residential):
 * - Brick / concrete paver: nominal 4″ × 8″ (≈100 × 200 mm)
 * - French / Versailles / ashlar set: 8×8, 8×16, 16×16, 16×24 on a 16″ module
 * - Large-format porcelain: commonly 24″ × 24″
 * - Bluestone / cut stone: often ~18–24″ squares
 * Joints: ~⅛″–³⁄₁₆″ tumbled stone; ~⅛″ brick with sand
 */
const BRICK_W_IN = 8;
const BRICK_H_IN = 4;
const FRENCH_MODULE_IN = 48; // 48″ × 48″ = 16 sf (two standard 8 sf sets)
const PORCELAIN_IN = 24;
const BLUESTONE_IN = 24;
const JOINT_IN = 0.15; // ~⅛″+

/**
 * Gap-free French / Versailles layout for a 48″ × 48″ tileable module.
 * Matches the common 16 sf kit: 4×8×8, 2×8×16, 4×16×16, 2×16×24.
 * Coords in inches [x, y, w, h].
 */
const FRENCH_48_IN: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 16, 16],
  [16, 0, 16, 16],
  [32, 0, 8, 16],
  [40, 0, 8, 8],
  [40, 8, 8, 8],
  [0, 16, 16, 16],
  [16, 16, 24, 16], // 16×24 turned
  [40, 16, 8, 16],
  [0, 32, 24, 16], // 16×24 turned
  [24, 32, 16, 16],
  [40, 32, 8, 8],
  [40, 40, 8, 8],
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + seed;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return (n >>> 0) / 4294967296;
}

function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const x0 = Math.floor(x * freq);
    const y0 = Math.floor(y * freq);
    const fx = x * freq - x0;
    const fy = y * freq - y0;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash2(x0, y0, seed + i * 1013);
    const b = hash2(x0 + 1, y0, seed + i * 1013);
    const c = hash2(x0, y0 + 1, seed + i * 1013);
    const d = hash2(x0 + 1, y0 + 1, seed + i * 1013);
    sum +=
      amp *
      (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function tint(
  base: { r: number; g: number; b: number },
  delta: number,
): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(base.r + delta)},${clamp(base.g + delta)},${clamp(base.b + delta)})`;
}

function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** UV is meters → one texture spans `coverageM` meters on each axis. */
function repeatForMeters(coverageM: number): [number, number] {
  const r = 1 / Math.max(0.05, coverageM);
  return [r, r];
}

export type PatioTexPair = {
  color: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
};

function makePair(
  size: number,
  draw: (
    c: CanvasRenderingContext2D,
    r: CanvasRenderingContext2D,
    size: number,
  ) => void,
  coverageM: number,
): PatioTexPair {
  const cc = document.createElement("canvas");
  const rc = document.createElement("canvas");
  cc.width = rc.width = size;
  cc.height = rc.height = size;
  const cctx = cc.getContext("2d")!;
  const rctx = rc.getContext("2d")!;
  rctx.fillStyle = "#b0b0b0";
  rctx.fillRect(0, 0, size, size);
  draw(cctx, rctx, size);
  const color = new THREE.CanvasTexture(cc);
  const roughness = new THREE.CanvasTexture(rc);
  const repeat = repeatForMeters(coverageM);
  for (const t of [color, roughness]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 8;
    t.needsUpdate = true;
  }
  color.colorSpace = THREE.SRGBColorSpace;
  roughness.colorSpace = THREE.NoColorSpace;
  return { color, roughness };
}

function pxPerInch(canvasSize: number, moduleIn: number): number {
  return canvasSize / moduleIn;
}

function fillStone(
  c: CanvasRenderingContext2D,
  r: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  finish: PatioFinish,
  n: number,
  opts?: { mottled?: boolean; cooler?: boolean },
) {
  // Variegation like silver/grey travertine: light silver, mid grey, cool blue-grey.
  const light = mixRgb(finish.color, { r: 232, g: 234, b: 236 }, 0.55);
  const mid = finish.color;
  const cool = mixRgb(finish.color, { r: 140, g: 150, b: 160 }, 0.4);
  const dark = mixRgb(finish.color, finish.accent, 0.45);
  const pick =
    n < 0.28 ? light : n < 0.55 ? mid : n < 0.78 ? cool : dark;
  const delta = opts?.mottled ? (n - 0.5) * 28 : (n - 0.5) * 18;
  c.fillStyle = tint(pick, delta);
  c.fillRect(x, y, w, h);
  if (opts?.mottled) {
    const vein = fbm(x * 0.02, y * 0.015, 63, 3);
    c.fillStyle = tint(cool, -12 + vein * 20);
    c.globalAlpha = 0.18;
    c.fillRect(x, y, w, h * 0.35);
    c.globalAlpha = 1;
  }
  const rv = 70 + n * 55;
  r.fillStyle = `rgb(${rv},${rv},${rv})`;
  r.fillRect(x, y, w, h);
}

function drawFrenchPattern(
  finish: PatioFinish,
  size: number,
  mottled: boolean,
): PatioTexPair {
  const moduleIn = FRENCH_MODULE_IN;
  const coverageM = moduleIn * IN;
  return makePair(
    size,
    (c, r, s) => {
      const ppi = pxPerInch(s, moduleIn);
      const joint = Math.max(1.2, JOINT_IN * ppi);
      c.fillStyle = tint(finish.accent, -8);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#d4d4d4";
      r.fillRect(0, 0, s, s);
      for (const [ix, iy, iw, ih] of FRENCH_48_IN) {
        const n = fbm(ix * 0.07, iy * 0.07, 41, 3);
        const x = ix * ppi + joint * 0.5;
        const y = iy * ppi + joint * 0.5;
        const w = iw * ppi - joint;
        const h = ih * ppi - joint;
        fillStone(c, r, x, y, w, h, finish, n, { mottled });
      }
    },
    coverageM,
  );
}

function drawBroomed(finish: PatioFinish, size: number): PatioTexPair {
  // Control joints ~8–10′ — texture covers 10′ × 10′.
  const coverageM = 10 * 12 * IN;
  return makePair(
    size,
    (c, r, s) => {
      const img = c.createImageData(s, s);
      const rimg = r.createImageData(s, s);
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const n = fbm(x / 50, y / 50, 17, 4);
          const broom = (Math.sin(y * 0.95 + n * 2.5) * 0.5 + 0.5) * 14;
          const i = (y * s + x) * 4;
          img.data[i] = finish.color.r + n * 18 + broom - 8;
          img.data[i + 1] = finish.color.g + n * 16 + broom - 10;
          img.data[i + 2] = finish.color.b + n * 14 + broom - 12;
          img.data[i + 3] = 255;
          const rv = 150 + n * 50 + broom;
          rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rv;
          rimg.data[i + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
      r.putImageData(rimg, 0, 0);
      c.strokeStyle = `rgba(${finish.accent.r},${finish.accent.g},${finish.accent.b},0.45)`;
      c.lineWidth = 3;
      const step = s / 2;
      for (let i = 1; i < 2; i++) {
        c.beginPath();
        c.moveTo(i * step, 0);
        c.lineTo(i * step, s);
        c.stroke();
        c.beginPath();
        c.moveTo(0, i * step);
        c.lineTo(s, i * step);
        c.stroke();
      }
    },
    coverageM,
  );
}

function drawSmooth(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      const img = c.createImageData(s, s);
      const rimg = r.createImageData(s, s);
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const n = fbm(x / 70, y / 70, 21, 3);
          const i = (y * s + x) * 4;
          img.data[i] = finish.color.r + n * 12;
          img.data[i + 1] = finish.color.g + n * 10;
          img.data[i + 2] = finish.color.b + n * 8;
          img.data[i + 3] = 255;
          const rv = 70 + n * 40;
          rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rv;
          rimg.data[i + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
      r.putImageData(rimg, 0, 0);
    },
    8 * 12 * IN,
  );
}

function drawExposedAggregate(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      const rand = mulberry32(0xa990);
      c.fillStyle = tint(finish.color, -8);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#c0c0c0";
      r.fillRect(0, 0, s, s);
      for (let i = 0; i < 5000; i++) {
        const x = rand() * s;
        const y = rand() * s;
        const rad = 1 + rand() * 3.2;
        const d = (rand() - 0.5) * 40;
        c.beginPath();
        c.fillStyle = tint(finish.color, d);
        c.arc(x, y, rad, 0, Math.PI * 2);
        c.fill();
        const rv = 100 + rand() * 100;
        r.beginPath();
        r.fillStyle = `rgb(${rv},${rv},${rv})`;
        r.arc(x, y, rad * 0.9, 0, Math.PI * 2);
        r.fill();
      }
    },
    4 * 12 * IN,
  );
}

function drawStampedAshlar(finish: PatioFinish, size: number): PatioTexPair {
  return drawFrenchPattern(finish, size, false);
}

function drawStampedCobble(finish: PatioFinish, size: number): PatioTexPair {
  // Cobbles ~4–6″ across — module 24″.
  const coverageM = 24 * IN;
  return makePair(
    size,
    (c, r, s) => {
      const rand = mulberry32(0xc0bb);
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#d8d8d8";
      r.fillRect(0, 0, s, s);
      const ppi = pxPerInch(s, 24);
      for (let i = 0; i < 55; i++) {
        const x = rand() * s;
        const y = rand() * s;
        const rx = (2 + rand() * 2) * ppi;
        const ry = (1.8 + rand() * 2) * ppi;
        c.beginPath();
        c.fillStyle = tint(finish.color, (rand() - 0.5) * 35);
        c.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = `rgba(${finish.accent.r},${finish.accent.g},${finish.accent.b},0.5)`;
        c.lineWidth = 1.5;
        c.stroke();
      }
    },
    coverageM,
  );
}

function drawStampedPlank(finish: PatioFinish, size: number): PatioTexPair {
  // Stamped plank ~6″ wide boards.
  const plankIn = 6;
  const cols = 8;
  const coverageM = cols * plankIn * IN;
  return makePair(
    size,
    (c, r, s) => {
      const plankH = s / cols;
      for (let row = 0; row < cols; row++) {
        const n = fbm(row, 0, 66, 2);
        c.fillStyle = tint(finish.color, (n - 0.5) * 28);
        c.fillRect(0, row * plankH, s, plankH - 2);
        r.fillStyle = `rgb(${120 + n * 40},${120 + n * 40},${120 + n * 40})`;
        r.fillRect(0, row * plankH, s, plankH - 2);
        c.strokeStyle = `rgba(${finish.accent.r},${finish.accent.g},${finish.accent.b},0.25)`;
        c.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
          const y = row * plankH + 3 + k * (plankH / 6);
          c.beginPath();
          c.moveTo(0, y);
          for (let x = 0; x < s; x += 6) {
            c.lineTo(x, y + Math.sin(x * 0.08 + row) * 1.2);
          }
          c.stroke();
        }
      }
    },
    coverageM,
  );
}

function drawRunningBond(finish: PatioFinish, size: number): PatioTexPair {
  // Nominal 4″ × 8″ brick; module 8 bricks × 16 courses = 64″ × 64″.
  const cols = 8;
  const rows = 16;
  const coverageM = cols * BRICK_W_IN * IN;
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#c8c8c8";
      r.fillRect(0, 0, s, s);
      const tw = s / cols;
      const th = s / rows;
      const joint = Math.max(1, (JOINT_IN / BRICK_W_IN) * tw);
      for (let row = 0; row < rows; row++) {
        const offset = (row % 2) * (tw * 0.5);
        for (let col = -1; col <= cols; col++) {
          const n = fbm(col * 0.4, row * 0.4, 71, 2);
          const x = col * tw + offset + joint * 0.5;
          const y = row * th + joint * 0.5;
          c.fillStyle = tint(finish.color, (n - 0.5) * 22);
          c.fillRect(x, y, tw - joint, th - joint);
          r.fillStyle = `rgb(${55 + n * 40},${55 + n * 40},${55 + n * 40})`;
          r.fillRect(x, y, tw - joint, th - joint);
        }
      }
    },
    coverageM,
  );
}

function drawHerringbone(finish: PatioFinish, size: number): PatioTexPair {
  // 4×8 brick herringbone; module ~36″.
  const coverageM = 36 * IN;
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#c0c0c0";
      r.fillRect(0, 0, s, s);
      const ppi = pxPerInch(s, 36);
      const bw = BRICK_W_IN * ppi;
      const bh = BRICK_H_IN * ppi;
      const step = (BRICK_W_IN / Math.SQRT2) * ppi;
      for (let row = -2; row < 20; row++) {
        for (let col = -2; col < 20; col++) {
          const n = fbm(col, row, 88, 2);
          c.save();
          c.translate(col * step * 2, row * step * 2);
          c.rotate(((col + row) % 2 === 0 ? 1 : -1) * (Math.PI / 4));
          c.fillStyle = tint(finish.color, (n - 0.5) * 24);
          c.fillRect(-bw * 0.5, -bh * 0.5, bw, bh);
          r.fillStyle = `rgb(${60 + n * 45},${60 + n * 45},${60 + n * 45})`;
          r.fillRect(-bw * 0.5, -bh * 0.5, bw, bh);
          c.restore();
        }
      }
    },
    coverageM,
  );
}

function drawBasketweave(finish: PatioFinish, size: number): PatioTexPair {
  // Two 4×8 bricks per 8″ × 8″ cell → module 4×4 cells = 32″.
  const cells = 4;
  const coverageM = cells * BRICK_W_IN * IN;
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      const cell = s / cells;
      const joint = Math.max(1, (JOINT_IN / BRICK_W_IN) * (cell / 2));
      for (let row = 0; row < cells; row++) {
        for (let col = 0; col < cells; col++) {
          const horiz = (row + col) % 2 === 0;
          const n = fbm(col, row, 99, 2);
          const x0 = col * cell;
          const y0 = row * cell;
          if (horiz) {
            for (let k = 0; k < 2; k++) {
              c.fillStyle = tint(finish.color, (n - 0.5) * 20 + k * 4);
              c.fillRect(
                x0 + joint,
                y0 + joint + k * (cell / 2),
                cell - joint * 2,
                cell / 2 - joint,
              );
            }
          } else {
            for (let k = 0; k < 2; k++) {
              c.fillStyle = tint(finish.color, (n - 0.5) * 20 + k * 4);
              c.fillRect(
                x0 + joint + k * (cell / 2),
                y0 + joint,
                cell / 2 - joint,
                cell - joint * 2,
              );
            }
          }
        }
      }
    },
    coverageM,
  );
}

function drawStackBond(finish: PatioFinish, size: number): PatioTexPair {
  // 16″ × 16″ stack-bond patio pavers; 3×3 module = 48″.
  const tileIn = 16;
  const count = 3;
  const coverageM = count * tileIn * IN;
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      const tw = s / count;
      const joint = Math.max(1.5, (JOINT_IN / tileIn) * tw);
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          const n = fbm(col * 0.5, row * 0.5, 12, 2);
          fillStone(
            c,
            r,
            col * tw + joint * 0.5,
            row * tw + joint * 0.5,
            tw - joint,
            tw - joint,
            finish,
            n,
          );
        }
      }
    },
    coverageM,
  );
}

function drawModular(finish: PatioFinish, size: number): PatioTexPair {
  return drawFrenchPattern(finish, size, true);
}

function drawTravertine(finish: PatioFinish, size: number): PatioTexPair {
  return drawFrenchPattern(finish, size, true);
}

function drawBluestone(finish: PatioFinish, size: number): PatioTexPair {
  const tileIn = BLUESTONE_IN;
  const count = 2;
  const coverageM = count * tileIn * IN;
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      const tw = s / count;
      const joint = Math.max(2, (0.25 / tileIn) * tw); // ~¼″ cleft joint look
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          const n = fbm(col + 0.2, row + 0.2, 19, 4);
          fillStone(
            c,
            r,
            col * tw + joint * 0.5,
            row * tw + joint * 0.5,
            tw - joint,
            tw - joint,
            finish,
            n,
            { mottled: true },
          );
        }
      }
    },
    coverageM,
  );
}

function drawPorcelain(finish: PatioFinish, size: number): PatioTexPair {
  const tileIn = PORCELAIN_IN;
  const count = 2;
  const coverageM = count * tileIn * IN;
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      const tw = s / count;
      const joint = Math.max(1.5, (JOINT_IN / tileIn) * tw);
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          const n = fbm(col * 0.3, row * 0.3, 5, 3);
          fillStone(
            c,
            r,
            col * tw + joint * 0.5,
            row * tw + joint * 0.5,
            tw - joint,
            tw - joint,
            finish,
            n,
          );
        }
      }
    },
    coverageM,
  );
}

function drawCoral(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      const rand = mulberry32(0xc0a1);
      c.fillStyle = tint(finish.color, 0);
      c.fillRect(0, 0, s, s);
      for (let i = 0; i < 3500; i++) {
        const x = rand() * s;
        const y = rand() * s;
        const rad = 0.8 + rand() * 4;
        c.beginPath();
        c.fillStyle = tint(finish.color, (rand() - 0.5) * 45);
        c.arc(x, y, rad, 0, Math.PI * 2);
        c.fill();
      }
      for (let i = 0; i < 400; i++) {
        c.beginPath();
        c.fillStyle = tint(finish.accent, -20);
        c.arc(rand() * s, rand() * s, 1 + rand() * 2.5, 0, Math.PI * 2);
        c.fill();
      }
    },
    36 * IN,
  );
}

const generators: Record<
  PatioFinishPattern,
  (f: PatioFinish, size: number) => PatioTexPair
> = {
  broomed: drawBroomed,
  smooth: drawSmooth,
  exposed_aggregate: drawExposedAggregate,
  stamped_ashlar: drawStampedAshlar,
  stamped_cobble: drawStampedCobble,
  stamped_plank: drawStampedPlank,
  running_bond: drawRunningBond,
  herringbone: drawHerringbone,
  basketweave: drawBasketweave,
  stack_bond: drawStackBond,
  modular: drawModular,
  travertine: drawTravertine,
  bluestone: drawBluestone,
  porcelain: drawPorcelain,
  coral: drawCoral,
};

const cache = new Map<string, PatioTexPair>();

export function getPatioFinishTexture(finishId: string | undefined): PatioTexPair {
  const finish = getPatioFinish(finishId);
  // Bust stale tiny-pattern caches when generators change.
  const cacheKey = `${finish.id}@v2-scale`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  if (typeof document === "undefined") {
    const empty = makePair(4, () => {}, 1);
    return empty;
  }
  const pair = generators[finish.pattern](finish, 1024);
  cache.set(cacheKey, pair);
  return pair;
}

/** Source canvas used by the 3D patio material — for 2D finish previews. */
export function getPatioFinishPreviewCanvas(
  finishId: string | undefined,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const img = getPatioFinishTexture(finishId).color.image;
  return img instanceof HTMLCanvasElement ? img : null;
}

export function preloadPatioFinishTextures(ids: string[]) {
  for (const id of ids) getPatioFinishTexture(id);
}
