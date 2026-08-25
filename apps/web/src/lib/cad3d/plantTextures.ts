import * as THREE from "three";
import type { FloridaPlant, PlantForm } from "@pool-design/shared";
import { normalFromHeightGray } from "@/lib/cad3d/normalFromHeight";

export type PlantBarkKind =
  | "oak"
  | "pine"
  | "cypress"
  | "gumbo"
  | "crape"
  | "smooth"
  | "palm_smooth"
  | "palm_ringed"
  | "palm_diamond"
  | "palm_fiber"
  | "palm_gold"
  | "pseudostem"
  | "ravenala"
  | "frangipani";

export type PlantBarkTex = {
  color: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
  bumpScale: number;
};

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

function setPx(
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

export function plantBarkKind(plant: Pick<FloridaPlant, "id" | "form">): PlantBarkKind {
  const { id, form } = plant;
  if (form === "live_oak") return "oak";
  if (form === "pine") return "pine";
  if (form === "cypress") return "cypress";
  if (form === "gumbo_limbo") return "gumbo";
  if (form === "crape_myrtle") return "crape";
  if (form === "frangipani") return "frangipani";
  if (form === "coconut_palm") return "palm_ringed";
  if (id === "canary_date" || id === "pygmy_date") return "palm_diamond";
  if (id === "washingtonia") return "palm_fiber";
  if (id === "mahogany") return "oak";
  if (id === "sabal_palmetto" || form === "saw_palmetto") return "palm_fiber";
  if (form === "clumping_palm") return "palm_gold";
  if (form === "banana") return "pseudostem";
  if (form === "travelers") return "ravenala";
  if (
    form === "royal_palm" ||
    form === "foxtail_palm" ||
    form === "feather_palm" ||
    form === "fan_palm"
  ) {
    return "palm_smooth";
  }
  return "smooth";
}

function drawBark(kind: PlantBarkKind): PlantBarkTex {
  const size = 256;
  const cc = document.createElement("canvas");
  const rc = document.createElement("canvas");
  const hc = document.createElement("canvas");
  cc.width = rc.width = hc.width = size;
  cc.height = rc.height = hc.height = size;
  const cctx = cc.getContext("2d")!;
  const rctx = rc.getContext("2d")!;
  const hctx = hc.getContext("2d")!;
  const cImg = cctx.createImageData(size, size);
  const rImg = rctx.createImageData(size, size);
  const hImg = hctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let r = 90;
      let g = 74;
      let b = 58;
      let rough = 140;
      let height = 128;

      if (kind === "oak") {
        const furrow = Math.abs(Math.sin(u * Math.PI * 14 + fbm(u * 8, v * 2, 3, 3) * 2.4));
        const n = fbm(u * 6, v * 18, 11, 4);
        const t = Math.min(1, furrow * 0.75 + n * 0.25);
        r = 48 + t * 38;
        g = 38 + t * 28;
        b = 28 + t * 18;
        rough = 150 + (1 - furrow) * 80;
        height = 40 + t * 180;
      } else if (kind === "pine") {
        const plate = fbm(u * 10, v * 14, 21, 4);
        const crack = hash2(x >> 2, y >> 2, 44) > 0.92 ? 0.25 : 0;
        r = 118 + plate * 50 - crack * 40;
        g = 78 + plate * 28 - crack * 20;
        b = 42 + plate * 16;
        rough = 120 + plate * 90 + crack * 50;
        height = 70 + plate * 140 - crack * 40;
      } else if (kind === "cypress") {
        const fiber = fbm(u * 22, v * 5, 8, 4);
        r = 96 + fiber * 36;
        g = 72 + fiber * 22;
        b = 52 + fiber * 12;
        rough = 160 + fiber * 50;
        height = 80 + fiber * 100;
      } else if (kind === "gumbo") {
        const peel = fbm(u * 5, v * 7, 31, 4);
        const flake = peel > 0.62 ? 1 : peel > 0.48 ? 0.45 : 0;
        r = 186 + flake * 40 - (1 - peel) * 30;
        g = 78 + flake * 50;
        b = 42 + flake * 28;
        rough = 70 + flake * 50;
        height = 150 + flake * 50;
      } else if (kind === "crape") {
        const mott = fbm(u * 7, v * 9, 17, 4);
        r = 150 + mott * 70;
        g = 96 + mott * 40;
        b = 78 + mott * 28;
        rough = 55 + mott * 40;
        height = 140 + mott * 30;
      } else if (kind === "frangipani") {
        const spec = hash2(x, y, 9) > 0.985 ? 0.2 : 0;
        r = 198 - spec * 40;
        g = 190 - spec * 30;
        b = 162 - spec * 20;
        rough = 40 + spec * 40;
        height = 170;
      } else if (kind === "palm_smooth") {
        const ring = 0.5 + 0.5 * Math.sin(v * Math.PI * 28 + fbm(u * 2, v * 8, 5, 2) * 1.2);
        r = 150 + ring * 22;
        g = 146 + ring * 18;
        b = 136 + ring * 14;
        rough = 75 + ring * 30;
        height = 120 + ring * 50;
      } else if (kind === "palm_ringed") {
        const ring = Math.abs(Math.sin(v * Math.PI * 22));
        const n = fbm(u * 4, v * 10, 12, 3);
        r = 128 + ring * 40 + n * 16;
        g = 108 + ring * 28 + n * 10;
        b = 82 + ring * 16;
        rough = 110 + ring * 60;
        height = 60 + ring * 160;
      } else if (kind === "palm_diamond") {
        const du = Math.abs(((u * 8) % 1) - 0.5);
        const dv = Math.abs(((v * 10 + (Math.floor(u * 8) % 2) * 0.5) % 1) - 0.5);
        const diamond = Math.max(0, 1 - (du + dv) * 2.4);
        r = 78 + diamond * 50;
        g = 62 + diamond * 36;
        b = 46 + diamond * 22;
        rough = 130 + diamond * 50;
        height = 50 + diamond * 170;
      } else if (kind === "palm_fiber") {
        const fiber = fbm(u * 28, v * 4, 19, 4);
        const wrap = Math.abs(Math.sin(v * Math.PI * 10));
        r = 108 + fiber * 30 + wrap * 16;
        g = 96 + fiber * 22;
        b = 74 + fiber * 14;
        rough = 150 + fiber * 60;
        height = 70 + fiber * 110 + wrap * 30;
      } else if (kind === "palm_gold") {
        const ring = 0.5 + 0.5 * Math.sin(v * Math.PI * 36);
        r = 176 + ring * 30;
        g = 158 + ring * 22;
        b = 62 + ring * 16;
        rough = 60 + ring * 25;
        height = 130 + ring * 40;
      } else if (kind === "pseudostem") {
        const helix = 0.5 + 0.5 * Math.sin((u * 5.2 + v * 3.4) * Math.PI * 2);
        const n = fbm(u * 6, v * 10, 14, 3);
        const base = Math.max(0, (v < 0.5 ? 1 - v * 2 : 0) * 0.55);
        r = 92 + helix * 38 + n * 18 + base * 50;
        g = 128 + helix * 22 + n * 10 - base * 40;
        b = 42 + helix * 12 - base * 8;
        rough = 48 + helix * 30 + base * 40;
        height = 118 + helix * 70 + n * 20;
      } else if (kind === "ravenala") {
        const band = (v * 11) % 1;
        const chevron = Math.abs(band - Math.abs(u - 0.5) * 0.35 - 0.4);
        const n = fbm(u * 5, v * 9, 8, 3);
        const scar = chevron < 0.07 ? 1 : 0;
        r = 122 + n * 24 - scar * 22;
        g = 112 + n * 18 - scar * 16;
        b = 92 + n * 12 - scar * 10;
        rough = 100 + scar * 50 + n * 30;
        height = 90 + (1 - chevron) * 80 + n * 20;
      } else {
        const n = fbm(u * 8, v * 16, 2, 4);
        r = 86 + n * 40;
        g = 72 + n * 28;
        b = 54 + n * 18;
        rough = 120 + n * 60;
        height = 90 + n * 90;
      }

      setPx(cImg, x, y, r, g, b);
      setPx(rImg, x, y, rough, rough, rough);
      setPx(hImg, x, y, height, height, height);
    }
  }
  cctx.putImageData(cImg, 0, 0);
  rctx.putImageData(rImg, 0, 0);
  hctx.putImageData(hImg, 0, 0);

  const color = new THREE.CanvasTexture(cc);
  const roughness = new THREE.CanvasTexture(rc);
  const bump = normalFromHeightGray(hctx, size, false, 4.2);
  for (const t of [color, roughness, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 3);
    t.anisotropy = 8;
    t.needsUpdate = true;
  }
  color.colorSpace = THREE.SRGBColorSpace;
  roughness.colorSpace = THREE.NoColorSpace;
  const bumpScale =
    kind === "oak" || kind === "palm_diamond" || kind === "palm_ringed"
      ? 0.09
      : kind === "gumbo" || kind === "crape" || kind === "frangipani"
        ? 0.03
        : kind === "pseudostem" || kind === "ravenala"
          ? 0.045
          : 0.055;
  return { color, roughness, bump, bumpScale };
}

const barkCache = new Map<PlantBarkKind, PlantBarkTex>();
const leafCache = new Map<string, THREE.CanvasTexture>();

export function getPlantBarkTexture(kind: PlantBarkKind): PlantBarkTex | null {
  if (typeof document === "undefined") return null;
  const hit = barkCache.get(kind);
  if (hit) return hit;
  const tex = drawBark(kind);
  barkCache.set(kind, tex);
  return tex;
}

/** Grayscale vein overlay — tint with foliage color. */
export function getLeafVeinTexture(kind: "broad" | "palm" | "needle"): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const key = `vein:${kind}`;
  const hit = leafCache.get(key);
  if (hit) return hit;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 2 - 1;
      const v = y / size;
      let tone = 210;
      if (kind === "needle") {
        tone = 190 + fbm(x / 20, y / 8, 4, 2) * 40;
      } else if (kind === "palm") {
        const vein = Math.abs(u) < 0.06 ? 55 : 0;
        const lat = Math.abs(Math.sin(v * Math.PI * 18 + u * 2)) < 0.12 ? 25 : 0;
        tone = 215 - vein - lat;
      } else {
        const mid = Math.abs(u) < 0.07 ? 50 : 0;
        const lat = Math.abs(Math.sin((v * 9 + Math.abs(u) * 2) * Math.PI)) < 0.1 ? 22 : 0;
        const edge = Math.hypot(u, (v - 0.5) * 1.4) > 0.92 ? 35 : 0;
        tone = 218 - mid - lat - edge;
      }
      setPx(img, x, y, tone, tone, tone);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  leafCache.set(key, tex);
  return tex;
}

export type LeafHabit =
  | "oak"
  | "oval"
  | "large_glossy"
  | "palmate"
  | "round"
  | "needle"
  | "linear"
  | "fern"
  | "compound"
  | "toothed";

export function leafHabitFor(plant: Pick<FloridaPlant, "id" | "form">): LeafHabit {
  const f = plant.form as PlantForm;
  if (f === "live_oak") return "oak";
  if (f === "magnolia" || plant.id === "loquat" || plant.id === "gardenia") return "large_glossy";
  if (plant.id === "red_maple" || plant.id === "tabebuia_pink") return "palmate";
  if (f === "sea_grape") return "round";
  if (f === "pine" || f === "cypress") return "needle";
  if (f === "jacaranda") return "fern";
  if (f === "bottlebrush" || plant.id === "oleander") return "linear";
  if (f === "gumbo_limbo" || plant.id === "mahogany") return "compound";
  if (plant.id === "hibiscus") return "toothed";
  if (f === "citrus" || f === "crape_myrtle" || f === "broadleaf" || f === "frangipani") {
    return "oval";
  }
  return "oval";
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Full-color leaf blade with species veins — use with material color white. */
export function getSpeciesLeafTexture(plant: FloridaPlant): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const key = `leaf:${plant.id}:${plant.foliage.r}:${plant.foliage.g}:${plant.foliage.b}`;
  const hit = leafCache.get(key);
  if (hit) return hit;
  const habit = leafHabitFor(plant);
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const f = plant.foliage;
  const alt = plant.foliageAlt ?? f;
  const redVeins = plant.id === "sea_grape";
  const rusty = plant.form === "magnolia";
  const variegated = plant.form === "variegated_shrub" || plant.id === "croton";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 2 - 1;
      const v = y / size;
      const n = fbm(x / 18, y / 18, 7, 3);
      let r = f.r;
      let g = f.g;
      let b = f.b;
      if (variegated && n > 0.55) {
        r = mix(r, alt.r, 0.85);
        g = mix(g, alt.g, 0.85);
        b = mix(b, alt.b, 0.85);
      } else if (rusty && u * u + (v - 0.55) * (v - 0.55) > 0.55) {
        r = mix(r, alt.r, 0.28);
        g = mix(g, alt.g, 0.28);
        b = mix(b, alt.b, 0.28);
      } else {
        r = mix(r, r * 0.82, n * 0.35);
        g = mix(g, Math.min(255, g * 1.06), n * 0.2);
        b = mix(b, b * 0.9, n * 0.25);
      }
      let vein = 0;
      if (plant.form === "banana" || plant.form === "travelers") {
        const mid = Math.abs(u) < 0.07 ? 0.55 : 0;
        const parallel =
          Math.abs(u) > 0.08 && Math.abs(Math.sin(v * Math.PI * 28)) < 0.16 ? 0.22 : 0;
        vein = Math.max(mid, parallel);
      } else if (habit === "needle") {
        vein = Math.abs(u) < 0.12 ? 0.18 : 0;
      } else if (habit === "palmate") {
        const arms = Math.min(
          Math.abs(u),
          Math.abs(u - (v - 0.2) * 0.55),
          Math.abs(u + (v - 0.2) * 0.55),
        );
        vein = arms < 0.045 || Math.abs(u) < 0.04 ? 0.28 : 0;
      } else {
        const mid = Math.abs(u) < 0.055 ? 0.32 : 0;
        const lat =
          Math.abs(Math.sin((v * 8 + Math.abs(u) * 1.8) * Math.PI)) < 0.1 && Math.abs(u) < 0.72
            ? 0.16
            : 0;
        vein = Math.max(mid, lat);
      }
      if (vein > 0) {
        if (plant.form === "banana" || plant.form === "travelers") {
          r = mix(r, 186, vein * 0.55);
          g = mix(g, 198, vein * 0.55);
          b = mix(b, 88, vein * 0.55);
        } else if (redVeins) {
          r = mix(r, 168, vein);
          g = mix(g, 52, vein);
          b = mix(b, 42, vein);
        } else {
          r = mix(r, r * 0.55, vein);
          g = mix(g, g * 0.62, vein);
          b = mix(b, b * 0.5, vein);
        }
      }
      setPx(img, x, y, r, g, b);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  leafCache.set(key, tex);
  return tex;
}
