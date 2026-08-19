import * as THREE from "three";
import {
  houseExteriorHex,
  type HouseExteriorColor,
  type HouseSidingId,
} from "@pool-design/shared";
import { normalFromHeightGray } from "./normalFromHeight";

const IN = 0.0254;

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
    sum += amp * (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function tint(c: HouseExteriorColor, d: number): string {
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(v + d)));
  return `rgb(${k(c.r)},${k(c.g)},${k(c.b)})`;
}

export type HouseSidingTex = {
  color: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  coverageM: number;
};

function makePair(
  size: number,
  coverageM: number,
  draw: (c: CanvasRenderingContext2D, r: CanvasRenderingContext2D, s: number) => void,
): HouseSidingTex {
  const cc = document.createElement("canvas");
  const rc = document.createElement("canvas");
  cc.width = rc.width = size;
  cc.height = rc.height = size;
  const c = cc.getContext("2d")!;
  const r = rc.getContext("2d")!;
  r.fillStyle = "#a8a8a8";
  r.fillRect(0, 0, size, size);
  draw(c, r, size);
  const color = new THREE.CanvasTexture(cc);
  const roughness = new THREE.CanvasTexture(rc);
  const normal = normalFromHeightGray(r, size, true, 2.6);
  const rep = 1 / Math.max(0.2, coverageM);
  for (const t of [color, roughness, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep, rep);
    t.anisotropy = 8;
    t.needsUpdate = true;
  }
  color.colorSpace = THREE.SRGBColorSpace;
  roughness.colorSpace = THREE.NoColorSpace;
  return { color, roughness, normal, coverageM };
}

function drawStucco(col: HouseExteriorColor, size: number): HouseSidingTex {
  return makePair(size, 2.4, (c, r, s) => {
    const img = c.createImageData(s, s);
    const rimg = r.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = fbm(x / 48, y / 48, 11, 5);
        const speckle = hash2(x >> 1, y >> 1, 77) > 0.97 ? 18 : 0;
        const i = (y * s + x) * 4;
        img.data[i] = col.r + n * 16 + speckle - 8;
        img.data[i + 1] = col.g + n * 14 + speckle - 8;
        img.data[i + 2] = col.b + n * 12 + speckle - 6;
        img.data[i + 3] = 255;
        const rv = 140 + n * 70 + speckle;
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rv;
        rimg.data[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    r.putImageData(rimg, 0, 0);
  });
}

function drawLap(col: HouseExteriorColor, size: number): HouseSidingTex {
  const boards = 12;
  const coverageM = boards * 6 * IN;
  return makePair(size, coverageM, (c, r, s) => {
    const h = s / boards;
    for (let i = 0; i < boards; i++) {
      const n = fbm(i * 0.4, 0, 31, 2);
      const y = i * h;
      c.fillStyle = tint(col, (n - 0.5) * 18);
      c.fillRect(0, y, s, h - 2);
      c.fillStyle = "rgba(255,255,255,0.16)";
      c.fillRect(0, y, s, 3);
      c.fillStyle = "rgba(0,0,0,0.32)";
      c.fillRect(0, y + h - 4, s, 4);
      r.fillStyle = `rgb(${90 + n * 40},${90 + n * 40},${90 + n * 40})`;
      r.fillRect(0, y, s, h - 2);
      r.fillStyle = "#d8d8d8";
      r.fillRect(0, y + h - 4, s, 4);
    }
  });
}

function drawBoardBatten(col: HouseExteriorColor, size: number): HouseSidingTex {
  const boards = 8;
  const coverageM = boards * 12 * IN;
  return makePair(size, coverageM, (c, r, s) => {
    const w = s / boards;
    c.fillStyle = tint(col, -6);
    c.fillRect(0, 0, s, s);
    r.fillStyle = "#9a9a9a";
    r.fillRect(0, 0, s, s);
    for (let i = 0; i < boards; i++) {
      const n = fbm(i, 2, 44, 2);
      const x = i * w;
      c.fillStyle = tint(col, (n - 0.5) * 14);
      c.fillRect(x + 2, 0, w - 4, s);
      const bw = w * 0.18;
      c.fillStyle = tint(col, 10);
      c.fillRect(x + w * 0.41, 0, bw, s);
      c.fillStyle = "rgba(0,0,0,0.22)";
      c.fillRect(x + w * 0.41 + bw - 2, 0, 2, s);
      c.fillStyle = "rgba(255,255,255,0.12)";
      c.fillRect(x + w * 0.41, 0, 2, s);
      r.fillStyle = `rgb(${80 + n * 30},${80 + n * 30},${80 + n * 30})`;
      r.fillRect(x + w * 0.41, 0, bw, s);
    }
  });
}

function drawBrick(paint: HouseExteriorColor, size: number): HouseSidingTex {
  const cols = 8;
  const rows = 16;
  const coverageM = cols * 8 * IN;
  return makePair(size, coverageM, (c, r, s) => {
    c.fillStyle = "rgb(188,180,168)";
    c.fillRect(0, 0, s, s);
    r.fillStyle = "#dcdcdc";
    r.fillRect(0, 0, s, s);
    const tw = s / cols;
    const th = s / rows;
    const joint = Math.max(1.5, s * 0.008);
    for (let row = 0; row < rows; row++) {
      const ox = (row % 2) * tw * 0.5;
      for (let col = -1; col <= cols; col++) {
        const n = fbm(col * 0.5, row * 0.5, 61, 2);
        const x = col * tw + ox + joint * 0.5;
        const y = row * th + joint * 0.5;
        c.fillStyle = tint(paint, (n - 0.5) * 36);
        c.fillRect(x, y, tw - joint, th - joint);
        c.fillStyle = "rgba(255,255,255,0.14)";
        c.fillRect(x, y, tw - joint, 2);
        c.fillStyle = "rgba(0,0,0,0.2)";
        c.fillRect(x, y + th - joint - 2, tw - joint, 2);
        r.fillStyle = `rgb(${70 + n * 40},${70 + n * 40},${70 + n * 40})`;
        r.fillRect(x, y, tw - joint, th - joint);
      }
    }
  });
}

function drawStone(col: HouseExteriorColor, size: number): HouseSidingTex {
  const coverageM = 36 * IN;
  return makePair(size, coverageM, (c, r, s) => {
    c.fillStyle = tint(col, -30);
    c.fillRect(0, 0, s, s);
    r.fillStyle = "#c8c8c8";
    r.fillRect(0, 0, s, s);
    const cells = [
      [0, 0, 0.38, 0.28],
      [0.38, 0, 0.34, 0.22],
      [0.72, 0, 0.28, 0.34],
      [0, 0.28, 0.22, 0.32],
      [0.22, 0.22, 0.5, 0.3],
      [0.72, 0.34, 0.28, 0.26],
      [0, 0.6, 0.4, 0.4],
      [0.4, 0.52, 0.32, 0.24],
      [0.72, 0.6, 0.28, 0.4],
      [0.4, 0.76, 0.32, 0.24],
    ] as const;
    const joint = s * 0.012;
    cells.forEach(([fx, fy, fw, fh], i) => {
      const n = fbm(i, i * 0.7, 73, 3);
      const x = fx * s + joint;
      const y = fy * s + joint;
      const w = fw * s - joint * 2;
      const h = fh * s - joint * 2;
      c.fillStyle = tint(col, (n - 0.5) * 40);
      c.fillRect(x, y, w, h);
      c.fillStyle = "rgba(255,255,255,0.12)";
      c.fillRect(x, y, w, 3);
      c.fillStyle = "rgba(0,0,0,0.18)";
      c.fillRect(x, y + h - 3, w, 3);
      r.fillStyle = `rgb(${85 + n * 50},${85 + n * 50},${85 + n * 50})`;
      r.fillRect(x, y, w, h);
    });
  });
}

function drawShake(paint: HouseExteriorColor, size: number): HouseSidingTex {
  const rows = 10;
  const coverageM = rows * 7 * IN;
  return makePair(size, coverageM, (c, r, s) => {
    c.fillStyle = tint(paint, -24);
    c.fillRect(0, 0, s, s);
    r.fillStyle = "#c4c4c4";
    r.fillRect(0, 0, s, s);
    const rh = s / rows;
    for (let row = 0; row < rows; row++) {
      const cols = 6 + (row % 2);
      const cw = s / cols;
      const ox = (row % 2) * cw * 0.35;
      for (let col = -1; col <= cols; col++) {
        const n = fbm(col, row, 81, 2);
        const x = col * cw + ox + 2;
        const y = row * rh + 2;
        const w = cw - 4;
        const h = rh - 4;
        c.fillStyle = tint(paint, (n - 0.5) * 22);
        c.fillRect(x, y, w, h);
        c.fillStyle = "rgba(0,0,0,0.28)";
        c.fillRect(x, y + h - 3, w, 3);
        r.fillStyle = `rgb(${100 + n * 40},${100 + n * 40},${100 + n * 40})`;
        r.fillRect(x, y, w, h);
      }
    }
  });
}

const generators: Record<
  HouseSidingId,
  (c: HouseExteriorColor, size: number) => HouseSidingTex
> = {
  stucco: drawStucco,
  lap: drawLap,
  board_batten: drawBoardBatten,
  brick: drawBrick,
  stone: drawStone,
  shake: drawShake,
};

const cache = new Map<string, HouseSidingTex>();

export function getHouseSidingTexture(
  sidingId: HouseSidingId,
  color: HouseExteriorColor,
): HouseSidingTex {
  const hex = houseExteriorHex(color);
  const key = `${sidingId}:${hex}@v2-relief`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") {
    const stub = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1);
    stub.needsUpdate = true;
    const t = stub as unknown as THREE.CanvasTexture;
    return { color: t, roughness: t, normal: t, coverageM: 2 };
  }
  const pair = generators[sidingId](color, 1024);
  cache.set(key, pair);
  return pair;
}
