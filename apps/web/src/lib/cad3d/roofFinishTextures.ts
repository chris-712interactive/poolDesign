import * as THREE from "three";
import {
  resolveRoofColor,
  resolveRoofMaterialId,
  type RoofColor,
  type RoofMaterialId,
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

function tint(c: RoofColor, d: number): string {
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(v + d)));
  return `rgb(${k(c.r)},${k(c.g)},${k(c.b)})`;
}

export type RoofFinishTex = {
  color: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  coverageM: number;
  metalness: number;
};

function makePair(
  size: number,
  coverageM: number,
  metalness: number,
  draw: (c: CanvasRenderingContext2D, r: CanvasRenderingContext2D, s: number) => void,
  normalStrength = 3.2,
): RoofFinishTex {
  const cc = document.createElement("canvas");
  const rc = document.createElement("canvas");
  cc.width = rc.width = size;
  cc.height = rc.height = size;
  const c = cc.getContext("2d")!;
  const r = rc.getContext("2d")!;
  r.fillStyle = "#b0b0b0";
  r.fillRect(0, 0, size, size);
  draw(c, r, size);
  const color = new THREE.CanvasTexture(cc);
  const roughness = new THREE.CanvasTexture(rc);
  const normal = normalFromHeightGray(r, size, true, normalStrength);
  const rep = 1 / Math.max(0.25, coverageM);
  for (const t of [color, roughness, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep, rep);
    t.anisotropy = 8;
    t.needsUpdate = true;
  }
  color.colorSpace = THREE.SRGBColorSpace;
  roughness.colorSpace = THREE.NoColorSpace;
  return { color, roughness, normal, coverageM, metalness };
}

function draw3Tab(paint: RoofColor, size: number): RoofFinishTex {
  const rows = 8;
  const coverageM = rows * 5 * IN;
  return makePair(size, coverageM, 0, (c, r, s) => {
    c.fillStyle = tint(paint, -28);
    c.fillRect(0, 0, s, s);
    r.fillStyle = "#9a9a9a";
    r.fillRect(0, 0, s, s);
    const rh = s / rows;
    for (let row = 0; row < rows; row++) {
      const cols = 6;
      const cw = s / cols;
      const ox = (row % 2) * (cw / 2);
      for (let tab = -1; tab <= cols; tab++) {
        const n = fbm(tab, row, 41, 2);
        const x = tab * cw + ox + 1;
        const y = row * rh + 1;
        const w = cw - 2;
        const h = rh - 3;
        c.fillStyle = tint(paint, (n - 0.5) * 18);
        c.fillRect(x, y, w, h);
        c.fillStyle = "rgba(0,0,0,0.28)";
        c.fillRect(x, y + h - 2, w, 2);
        c.fillStyle = "rgba(255,255,255,0.08)";
        c.fillRect(x, y, w, 1.5);
        r.fillStyle = `rgb(${90 + n * 40},${90 + n * 40},${90 + n * 40})`;
        r.fillRect(x, y, w, h);
      }
    }
  });
}

function drawArch(paint: RoofColor, size: number): RoofFinishTex {
  const rows = 7;
  const coverageM = rows * 5.5 * IN;
  return makePair(size, coverageM, 0, (c, r, s) => {
    c.fillStyle = tint(paint, -32);
    c.fillRect(0, 0, s, s);
    r.fillStyle = "#8e8e8e";
    r.fillRect(0, 0, s, s);
    const rh = s / rows;
    for (let row = 0; row < rows; row++) {
      const cols = 5 + (row % 2);
      const cw = s / cols;
      const ox = (row % 2) * cw * 0.4;
      for (let col = -1; col <= cols; col++) {
        const n = fbm(col * 1.3, row, 57, 3);
        const x = col * cw + ox + 2;
        const y = row * rh + 1;
        const w = cw * (0.85 + n * 0.2) - 2;
        const h = rh - 2;
        c.fillStyle = tint(paint, (n - 0.45) * 26);
        c.fillRect(x, y, w, h);
        c.fillStyle = "rgba(0,0,0,0.32)";
        c.fillRect(x, y + h - 3, w, 3);
        r.fillStyle = `rgb(${80 + n * 50},${80 + n * 50},${80 + n * 50})`;
        r.fillRect(x, y, w, h);
      }
    }
  });
}

function drawClay(paint: RoofColor, size: number): RoofFinishTex {
  const rows = 6;
  const coverageM = rows * 8 * IN;
  return makePair(size, coverageM, 0, (c, r, s) => {
    c.fillStyle = tint(paint, -40);
    c.fillRect(0, 0, s, s);
    r.fillStyle = "#7a7a7a";
    r.fillRect(0, 0, s, s);
    const rh = s / rows;
    const cols = 5;
    const cw = s / cols;
    for (let row = 0; row < rows; row++) {
      const ox = (row % 2) * (cw / 2);
      for (let col = -1; col <= cols; col++) {
        const n = fbm(col, row, 63, 2);
        const x = col * cw + ox;
        const y = row * rh;
        for (let k = 0; k < 2; k++) {
          const cx = x + (k + 0.5) * (cw / 2);
          c.fillStyle = tint(paint, (n - 0.5) * 28 + k * 6);
          c.beginPath();
          c.ellipse(cx, y + rh * 0.55, cw * 0.22, rh * 0.42, 0, 0, Math.PI * 2);
          c.fill();
          r.fillStyle = `rgb(${70 + n * 35},${70 + n * 35},${70 + n * 35})`;
          r.beginPath();
          r.ellipse(cx, y + rh * 0.55, cw * 0.22, rh * 0.42, 0, 0, Math.PI * 2);
          r.fill();
        }
      }
    }
  }, 4.2);
}

function drawConcreteTile(paint: RoofColor, size: number): RoofFinishTex {
  const rows = 6;
  const coverageM = rows * 10 * IN;
  return makePair(size, coverageM, 0, (c, r, s) => {
    c.fillStyle = tint(paint, -22);
    c.fillRect(0, 0, s, s);
    r.fillStyle = "#989898";
    r.fillRect(0, 0, s, s);
    const rh = s / rows;
    const cols = 4;
    const cw = s / cols;
    const joint = s * 0.01;
    for (let row = 0; row < rows; row++) {
      const ox = (row % 2) * (cw / 2);
      for (let col = -1; col <= cols; col++) {
        const n = fbm(col, row, 71, 2);
        const x = col * cw + ox + joint;
        const y = row * rh + joint;
        c.fillStyle = tint(paint, (n - 0.5) * 16);
        c.fillRect(x, y, cw - joint * 2, rh - joint * 2);
        c.fillStyle = "rgba(255,255,255,0.1)";
        c.fillRect(x, y, cw - joint * 2, 3);
        r.fillStyle = `rgb(${100 + n * 30},${100 + n * 30},${100 + n * 30})`;
        r.fillRect(x, y, cw - joint * 2, rh - joint * 2);
      }
    }
  });
}

function drawMetal(paint: RoofColor, size: number): RoofFinishTex {
  const pans = 6;
  const coverageM = pans * 16 * IN;
  return makePair(size, coverageM, 0.55, (c, r, s) => {
    c.fillStyle = tint(paint, -8);
    c.fillRect(0, 0, s, s);
    r.fillStyle = "#5a5a5a";
    r.fillRect(0, 0, s, s);
    const pw = s / pans;
    for (let i = 0; i < pans; i++) {
      const n = fbm(i, 2, 88, 2);
      const x = i * pw;
      c.fillStyle = tint(paint, (n - 0.5) * 10);
      c.fillRect(x + 4, 0, pw - 8, s);
      c.fillStyle = tint(paint, 28);
      c.fillRect(x + pw * 0.42, 0, pw * 0.16, s);
      c.fillStyle = "rgba(255,255,255,0.22)";
      c.fillRect(x + pw * 0.46, 0, 3, s);
      r.fillStyle = "#4a4a4a";
      r.fillRect(x + 4, 0, pw - 8, s);
      r.fillStyle = "#d0d0d0";
      r.fillRect(x + pw * 0.42, 0, pw * 0.16, s);
    }
  }, 5.5);
}

function drawMembrane(paint: RoofColor, size: number): RoofFinishTex {
  return makePair(size, 3.2, 0.05, (c, r, s) => {
    const img = c.createImageData(s, s);
    const rimg = r.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = fbm(x / 64, y / 64, 19, 4);
        const i = (y * s + x) * 4;
        const k = (n - 0.5) * 14;
        img.data[i] = Math.max(0, Math.min(255, paint.r + k));
        img.data[i + 1] = Math.max(0, Math.min(255, paint.g + k));
        img.data[i + 2] = Math.max(0, Math.min(255, paint.b + k));
        img.data[i + 3] = 255;
        const g = 140 + n * 40;
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = g;
        rimg.data[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    r.putImageData(rimg, 0, 0);
    c.strokeStyle = "rgba(0,0,0,0.12)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, s * 0.5);
    c.lineTo(s, s * 0.5);
    c.stroke();
  }, 1.4);
}

const generators: Record<
  RoofMaterialId,
  (c: RoofColor, size: number) => RoofFinishTex
> = {
  shingle_3tab: draw3Tab,
  shingle_arch: drawArch,
  tile_clay: drawClay,
  tile_concrete: drawConcreteTile,
  metal_seam: drawMetal,
  membrane: drawMembrane,
};

const cache = new Map<string, RoofFinishTex>();

export function getRoofFinishTexture(
  finishId?: string | null,
  color?: RoofColor | null,
): RoofFinishTex {
  const id = resolveRoofMaterialId(finishId);
  const tintColor = resolveRoofColor(id, color);
  const key = `${id}:${tintColor.r},${tintColor.g},${tintColor.b}@v1`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = generators[id](tintColor, 512);
  cache.set(key, tex);
  return tex;
}
