import * as THREE from "three";
import type { FlowerBedWallFinish } from "@pool-design/shared";
import { normalFromHeightGray } from "./normalFromHeight";

export type FlowerBedTexPair = {
  color: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
};

type SoilKind = "tilled" | "mulch";

const cache = new Map<string, FlowerBedTexPair>();

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
    const n = a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    sum += n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / (norm || 1);
}

function stubPair(): FlowerBedTexPair {
  const stub = new THREE.DataTexture(new Uint8Array([90, 70, 50, 255]), 1, 1);
  stub.needsUpdate = true;
  return {
    color: stub as unknown as THREE.CanvasTexture,
    roughness: stub.clone() as unknown as THREE.CanvasTexture,
    normal: stub.clone() as unknown as THREE.CanvasTexture,
  };
}

function finishPair(
  color: HTMLCanvasElement,
  roughness: HTMLCanvasElement,
  hctx: CanvasRenderingContext2D,
  size: number,
): FlowerBedTexPair {
  const colorTex = new THREE.CanvasTexture(color);
  const roughTex = new THREE.CanvasTexture(roughness);
  for (const t of [colorTex, roughTex]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = t === colorTex ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
  }
  return {
    color: colorTex,
    roughness: roughTex,
    normal: normalFromHeightGray(hctx, size, false, 2.8),
  };
}

function makeCanvases(size: number) {
  const color = document.createElement("canvas");
  color.width = size;
  color.height = size;
  const height = document.createElement("canvas");
  height.width = size;
  height.height = size;
  const roughness = document.createElement("canvas");
  roughness.width = size;
  roughness.height = size;
  return {
    color,
    height,
    roughness,
    cctx: color.getContext("2d")!,
    hctx: height.getContext("2d")!,
    rctx: roughness.getContext("2d")!,
  };
}

function tilledSoil(size: number): FlowerBedTexPair {
  const { color, roughness, cctx, hctx, rctx } = makeCanvases(size);
  const cdata = cctx.createImageData(size, size);
  const hdata = hctx.createImageData(size, size);
  const rdata = rctx.createImageData(size, size);
  const furrow = size / 14;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const clod = fbm(nx * 7, ny * 7, 41, 4);
      const crumb = fbm(nx * 22, ny * 22, 77, 3);
      const wave = (y + clod * 6) / furrow;
      const furrowT = 0.5 + 0.5 * Math.cos(wave * Math.PI * 2);
      const groove = Math.pow(Math.max(0, 1 - furrowT * 1.15), 1.6);
      const r = 92 + clod * 38 - groove * 28 + crumb * 16;
      const g = 62 + clod * 22 - groove * 18 + crumb * 10;
      const b = 38 + clod * 12 - groove * 10 + crumb * 6;
      const i = (y * size + x) * 4;
      cdata.data[i] = Math.max(0, Math.min(255, r));
      cdata.data[i + 1] = Math.max(0, Math.min(255, g));
      cdata.data[i + 2] = Math.max(0, Math.min(255, b));
      cdata.data[i + 3] = 255;
      const h = 90 + clod * 70 - groove * 80 + crumb * 30;
      hdata.data[i] = hdata.data[i + 1] = hdata.data[i + 2] = Math.max(
        0,
        Math.min(255, h),
      );
      hdata.data[i + 3] = 255;
      const rough = 170 + groove * 50 + crumb * 30;
      rdata.data[i] = rdata.data[i + 1] = rdata.data[i + 2] = Math.max(
        0,
        Math.min(255, rough),
      );
      rdata.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cdata, 0, 0);
  hctx.putImageData(hdata, 0, 0);
  rctx.putImageData(rdata, 0, 0);
  return finishPair(color, roughness, hctx, size);
}

function mulchSoil(size: number): FlowerBedTexPair {
  const { color, roughness, cctx, hctx, rctx } = makeCanvases(size);
  cctx.fillStyle = "#3a2418";
  cctx.fillRect(0, 0, size, size);
  hctx.fillStyle = "#606060";
  hctx.fillRect(0, 0, size, size);
  rctx.fillStyle = "#c8c8c8";
  rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 420; i++) {
    const x = hash2(i, 3, 201) * size;
    const y = hash2(i, 9, 202) * size;
    const w = 8 + hash2(i, 11, 203) * 28;
    const h = 4 + hash2(i, 13, 204) * 10;
    const rot = hash2(i, 17, 205) * Math.PI;
    const shade = hash2(i, 19, 206);
    const r = 70 + shade * 70;
    const g = 38 + shade * 28;
    const b = 22 + shade * 14;
    cctx.save();
    cctx.translate(x, y);
    cctx.rotate(rot);
    cctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    cctx.beginPath();
    cctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    cctx.fill();
    cctx.restore();
    hctx.save();
    hctx.translate(x, y);
    hctx.rotate(rot);
    hctx.fillStyle = `rgb(${(80 + shade * 120) | 0},${(80 + shade * 120) | 0},${(80 + shade * 120) | 0})`;
    hctx.beginPath();
    hctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    hctx.fill();
    hctx.restore();
  }
  return finishPair(color, roughness, hctx, size);
}

function timberWall(size: number): FlowerBedTexPair {
  const { color, roughness, cctx, hctx, rctx } = makeCanvases(size);
  const cdata = cctx.createImageData(size, size);
  const hdata = hctx.createImageData(size, size);
  const rdata = rctx.createImageData(size, size);
  const board = size / 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const boardI = Math.floor(y / board);
      const grain = fbm(x / size * 18, boardI * 3.1 + y / size * 0.4, 11, 4);
      const ring = 0.5 + 0.5 * Math.sin((x / size) * 40 + grain * 6);
      const seam = Math.abs((y % board) - board * 0.04) < 2 ? 1 : 0;
      const r = 118 + grain * 36 - ring * 18 - seam * 40;
      const g = 78 + grain * 22 - ring * 10 - seam * 28;
      const b = 42 + grain * 10 - seam * 16;
      const i = (y * size + x) * 4;
      cdata.data[i] = Math.max(0, Math.min(255, r));
      cdata.data[i + 1] = Math.max(0, Math.min(255, g));
      cdata.data[i + 2] = Math.max(0, Math.min(255, b));
      cdata.data[i + 3] = 255;
      const h = 140 + grain * 50 - seam * 90;
      hdata.data[i] = hdata.data[i + 1] = hdata.data[i + 2] = Math.max(
        0,
        Math.min(255, h),
      );
      hdata.data[i + 3] = 255;
      const rough = 140 + grain * 40 + seam * 60;
      rdata.data[i] = rdata.data[i + 1] = rdata.data[i + 2] = Math.max(
        0,
        Math.min(255, rough),
      );
      rdata.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cdata, 0, 0);
  hctx.putImageData(hdata, 0, 0);
  rctx.putImageData(rdata, 0, 0);
  return finishPair(color, roughness, hctx, size);
}

function blockWall(size: number): FlowerBedTexPair {
  const { color, roughness, cctx, hctx, rctx } = makeCanvases(size);
  const cdata = cctx.createImageData(size, size);
  const hdata = hctx.createImageData(size, size);
  const rdata = rctx.createImageData(size, size);
  const bw = size / 4;
  const bh = size / 8;
  const joint = 5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / bh);
      const offset = row % 2 === 0 ? 0 : bw / 2;
      const lx = ((x + offset) % bw + bw) % bw;
      const ly = y % bh;
      const isJoint = lx < joint || ly < joint;
      const mott = fbm(x / size * 10, y / size * 10, 33, 3);
      const r = isJoint ? 168 : 142 + mott * 22;
      const g = isJoint ? 162 : 138 + mott * 18;
      const b = isJoint ? 152 : 128 + mott * 14;
      const i = (y * size + x) * 4;
      cdata.data[i] = r;
      cdata.data[i + 1] = g;
      cdata.data[i + 2] = b;
      cdata.data[i + 3] = 255;
      const h = isJoint ? 40 : 150 + mott * 40;
      hdata.data[i] = hdata.data[i + 1] = hdata.data[i + 2] = h;
      hdata.data[i + 3] = 255;
      const rough = isJoint ? 200 : 160 + mott * 30;
      rdata.data[i] = rdata.data[i + 1] = rdata.data[i + 2] = rough;
      rdata.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cdata, 0, 0);
  hctx.putImageData(hdata, 0, 0);
  rctx.putImageData(rdata, 0, 0);
  return finishPair(color, roughness, hctx, size);
}

function stoneWall(size: number): FlowerBedTexPair {
  const { color, roughness, cctx, hctx, rctx } = makeCanvases(size);
  const cdata = cctx.createImageData(size, size);
  const hdata = hctx.createImageData(size, size);
  const rdata = rctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const cell = fbm(nx * 6, ny * 8, 55, 2);
      const stone = fbm(nx * 14, ny * 14, 91, 4);
      const mortar = cell < 0.18 || (ny * 9) % 1 < 0.08 ? 1 : 0;
      const r = mortar ? 150 : 118 + stone * 40;
      const g = mortar ? 142 : 112 + stone * 28;
      const b = mortar ? 132 : 102 + stone * 18;
      const i = (y * size + x) * 4;
      cdata.data[i] = r;
      cdata.data[i + 1] = g;
      cdata.data[i + 2] = b;
      cdata.data[i + 3] = 255;
      const h = mortar ? 50 : 130 + stone * 80;
      hdata.data[i] = hdata.data[i + 1] = hdata.data[i + 2] = h;
      hdata.data[i + 3] = 255;
      const rough = mortar ? 210 : 150 + stone * 50;
      rdata.data[i] = rdata.data[i + 1] = rdata.data[i + 2] = rough;
      rdata.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cdata, 0, 0);
  hctx.putImageData(hdata, 0, 0);
  rctx.putImageData(rdata, 0, 0);
  return finishPair(color, roughness, hctx, size);
}

export function getFlowerBedSoilTexture(kind: SoilKind): FlowerBedTexPair {
  const key = `soil:${kind}`;
  const cached = cache.get(key);
  if (cached) return cached;
  if (typeof document === "undefined") return stubPair();
  const pair = kind === "mulch" ? mulchSoil(512) : tilledSoil(512);
  cache.set(key, pair);
  return pair;
}

export function getFlowerBedWallTexture(
  finish: FlowerBedWallFinish,
): FlowerBedTexPair {
  const key = `wall:${finish}`;
  const cached = cache.get(key);
  if (cached) return cached;
  if (typeof document === "undefined") return stubPair();
  const pair =
    finish === "block"
      ? blockWall(512)
      : finish === "stone"
        ? stoneWall(512)
        : timberWall(512);
  cache.set(key, pair);
  return pair;
}
