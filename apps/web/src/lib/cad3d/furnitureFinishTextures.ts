import * as THREE from "three";
import {
  getFurnitureFinish,
  type FurnitureFinish,
  type FurnitureFinishKind,
} from "@pool-design/shared";

function hash2(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + seed;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return (n >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 1013);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function setPixel(
  img: ImageData,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
) {
  const i = (y * img.width + x) * 4;
  img.data[i] = Math.max(0, Math.min(255, r));
  img.data[i + 1] = Math.max(0, Math.min(255, g));
  img.data[i + 2] = Math.max(0, Math.min(255, b));
  img.data[i + 3] = 255;
}

export type FurnTexPair = {
  color: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
};

function makePair(
  size: number,
  draw: (c: ImageData, r: ImageData, size: number) => void,
  repeat: [number, number],
): FurnTexPair {
  const cc = document.createElement("canvas");
  const rc = document.createElement("canvas");
  cc.width = rc.width = size;
  cc.height = rc.height = size;
  const cctx = cc.getContext("2d")!;
  const rctx = rc.getContext("2d")!;
  const cImg = cctx.createImageData(size, size);
  const rImg = rctx.createImageData(size, size);
  draw(cImg, rImg, size);
  cctx.putImageData(cImg, 0, 0);
  rctx.putImageData(rImg, 0, 0);
  const color = new THREE.CanvasTexture(cc);
  const roughness = new THREE.CanvasTexture(rc);
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

function drawWood(finish: FurnitureFinish): FurnTexPair {
  const base = finish.color;
  const accent = finish.accent;
  return makePair(
    512,
    (cImg, rImg, size) => {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const grain = fbm(x / 90, y / 14, 77, 5);
          const ring = Math.sin(y * 0.035 + grain * 4) * 0.12;
          const pore = hash2(x, y >> 1, 91) > 0.993 ? 0.12 : 0;
          const t = Math.min(1, Math.max(0, grain * 0.55 + 0.35 + ring - pore));
          const r = base.r + (accent.r - base.r) * (1 - t);
          const g = base.g + (accent.g - base.g) * (1 - t);
          const b = base.b + (accent.b - base.b) * (1 - t);
          setPixel(cImg, x, y, r, g, b);
          const rough = 90 + grain * 100 + pore * 80;
          setPixel(rImg, x, y, rough, rough, rough);
        }
      }
    },
    [2, 2],
  );
}

function drawFabric(finish: FurnitureFinish): FurnTexPair {
  const base = finish.color;
  const accent = finish.accent;
  return makePair(
    512,
    (cImg, rImg, size) => {
      const cell = 10;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const bx = Math.floor(x / cell);
          const by = Math.floor(y / cell);
          const lx = x % cell;
          const ly = y % cell;
          const basket = (bx + by) % 2 === 0;
          const thread = basket
            ? lx < cell * 0.55
              ? 0.28
              : 0.06
            : ly < cell * 0.55
              ? 0.24
              : 0.05;
          const yarn = Math.sin((basket ? y : x) * 0.85) * 0.05;
          const n = fbm(x / 42, y / 42, 112, 3) * 0.12;
          const t = Math.min(1, Math.max(0, 0.34 + thread + yarn + n));
          const r = base.r + (accent.r - base.r) * (1 - t);
          const g = base.g + (accent.g - base.g) * (1 - t);
          const b = base.b + (accent.b - base.b) * (1 - t);
          setPixel(cImg, x, y, r, g, b);
          const rough = 105 + thread * 130 + n * 50;
          setPixel(rImg, x, y, rough, rough, rough);
        }
      }
    },
    [6, 6],
  );
}

function drawCanvas(finish: FurnitureFinish): FurnTexPair {
  const base = finish.color;
  const accent = finish.accent;
  return makePair(
    256,
    (cImg, rImg, size) => {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const yarn =
            ((x + y) % 4 === 0 ? 0.06 : 0) + fbm(x / 35, y / 35, 130, 3) * 0.1;
          const t = Math.min(1, Math.max(0, 0.5 + yarn));
          const r = base.r + (accent.r - base.r) * (1 - t);
          const g = base.g + (accent.g - base.g) * (1 - t);
          const b = base.b + (accent.b - base.b) * (1 - t);
          setPixel(cImg, x, y, r, g, b);
          const rough = 115 + yarn * 120;
          setPixel(rImg, x, y, rough, rough, rough);
        }
      }
    },
    [2, 2],
  );
}

const cache = new Map<string, FurnTexPair>();

export function getFurnitureFinishTexture(
  finishId: string | undefined,
  kind: FurnitureFinishKind,
  fallbackId: string,
): FurnTexPair | null {
  if (typeof document === "undefined") return null;
  const finish = getFurnitureFinish(finishId, fallbackId);
  const key = `${finish.id}:${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let pair: FurnTexPair;
  if (kind === "wood") pair = drawWood(finish);
  else if (kind === "canvas") pair = drawCanvas(finish);
  else pair = drawFabric(finish);

  cache.set(key, pair);
  return pair;
}
