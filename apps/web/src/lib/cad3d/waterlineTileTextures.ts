import * as THREE from "three";
import {
  getWaterlineTile,
  type WaterlineTile,
  type WaterlineTilePattern,
} from "@pool-design/shared";

function hash2(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + seed;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return (n >>> 0) / 4294967296;
}

function tint(
  base: { r: number; g: number; b: number },
  delta: number,
): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(base.r + delta)},${clamp(base.g + delta)},${clamp(base.b + delta)})`;
}

export type WaterlineTexPair = {
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
  repeat: [number, number],
): WaterlineTexPair {
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

function paletteFor(tile: WaterlineTile): { r: number; g: number; b: number }[] {
  if (tile.blend?.length) return [tile.color, ...tile.blend];
  return [
    tile.color,
    {
      r: Math.min(255, tile.color.r + 18),
      g: Math.min(255, tile.color.g + 18),
      b: Math.min(255, tile.color.b + 18),
    },
    {
      r: Math.max(0, tile.color.r - 22),
      g: Math.max(0, tile.color.g - 22),
      b: Math.max(0, tile.color.b - 22),
    },
  ];
}

function drawChip(
  c: CanvasRenderingContext2D,
  r: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: { r: number; g: number; b: number },
  n: number,
  iridescent: boolean,
) {
  c.fillStyle = tint(color, (n - 0.5) * 28);
  c.fillRect(x, y, w, h);
  if (iridescent) {
    c.fillStyle = "rgba(255,255,255,0.22)";
    c.fillRect(x + w * 0.08, y + h * 0.1, w * 0.4, h * 0.22);
    c.fillStyle = "rgba(180,220,255,0.12)";
    c.fillRect(x + w * 0.45, y + h * 0.45, w * 0.4, h * 0.3);
  } else {
    c.fillStyle = "rgba(255,255,255,0.12)";
    c.fillRect(x + w * 0.1, y + h * 0.12, w * 0.35, h * 0.18);
  }
  const rv = iridescent ? 25 + n * 40 : 55 + n * 50;
  r.fillStyle = `rgb(${rv},${rv},${rv})`;
  r.fillRect(x, y, w, h);
}

function drawGrid(tile: WaterlineTile, size: number): WaterlineTexPair {
  // One texture ≈ four 6″ tiles → ~2′; waterline band is short in V.
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(tile.accent, 0);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#c8c8c8";
      r.fillRect(0, 0, s, s);
      const cols = 4;
      const rows = 4;
      const tw = s / cols;
      const th = s / rows;
      const joint = Math.max(2, s * 0.008);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const n = hash2(col, row, 41);
          drawChip(
            c,
            r,
            col * tw + joint * 0.5,
            row * th + joint * 0.5,
            tw - joint,
            th - joint,
            tile.color,
            n,
            false,
          );
        }
      }
    },
    [6, 1.15],
  );
}

function drawMosaic(
  tile: WaterlineTile,
  size: number,
  offset: boolean,
): WaterlineTexPair {
  const palette = paletteFor(tile);
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(tile.accent, 0);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#c0c0c0";
      r.fillRect(0, 0, s, s);
      const cols = 16;
      const rows = 16;
      const tw = s / cols;
      const th = s / rows;
      const joint = Math.max(1.2, s * 0.004);
      for (let row = 0; row < rows; row++) {
        const ox = offset && row % 2 ? tw * 0.5 : 0;
        for (let col = -1; col <= cols; col++) {
          const n = hash2(col + 3, row + 7, 55);
          const idx = Math.floor(
            (n * palette.length + col + row * 2) % palette.length,
          );
          drawChip(
            c,
            r,
            col * tw + ox + joint * 0.5,
            row * th + joint * 0.5,
            tw - joint,
            th - joint,
            palette[idx],
            n,
            !!tile.iridescent,
          );
        }
      }
    },
    [8, 1.35],
  );
}

function drawBlendBand(tile: WaterlineTile, size: number): WaterlineTexPair {
  const palette = paletteFor(tile);
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(tile.accent, 0);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#c0c0c0";
      r.fillRect(0, 0, s, s);
      const cols = 18;
      const rows = 12;
      const tw = s / cols;
      const th = s / rows;
      const joint = Math.max(1.1, s * 0.0035);
      for (let row = 0; row < rows; row++) {
        const band = row / Math.max(1, rows - 1);
        for (let col = 0; col < cols; col++) {
          const n = hash2(col, row, 77);
          const baseIdx = Math.min(
            palette.length - 1,
            Math.floor(band * (palette.length - 0.01)),
          );
          const jitter = n > 0.72 ? 1 : n < 0.18 ? -1 : 0;
          const idx = Math.max(
            0,
            Math.min(palette.length - 1, baseIdx + jitter),
          );
          drawChip(
            c,
            r,
            col * tw + joint * 0.5,
            row * th + joint * 0.5,
            tw - joint,
            th - joint,
            palette[idx],
            n,
            !!tile.iridescent,
          );
        }
      }
    },
    [7.5, 1.3],
  );
}

function drawRunningBond(tile: WaterlineTile, size: number): WaterlineTexPair {
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(tile.accent, 0);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#c8c8c8";
      r.fillRect(0, 0, s, s);
      const cols = 6;
      const rows = 12;
      const tw = s / cols;
      const th = s / rows;
      const joint = Math.max(1.5, s * 0.006);
      for (let row = 0; row < rows; row++) {
        const ox = (row % 2) * (tw * 0.5);
        for (let col = -1; col <= cols; col++) {
          const n = hash2(col, row, 91);
          drawChip(
            c,
            r,
            col * tw + ox + joint * 0.5,
            row * th + joint * 0.5,
            tw - joint,
            th - joint,
            tile.color,
            n,
            false,
          );
        }
      }
    },
    [7, 1.25],
  );
}

const generators: Record<
  WaterlineTilePattern,
  (t: WaterlineTile, size: number) => WaterlineTexPair
> = {
  grid: drawGrid,
  mosaic: (t, s) => drawMosaic(t, s, false),
  mosaic_offset: (t, s) => drawMosaic(t, s, true),
  blend_band: drawBlendBand,
  running_bond: drawRunningBond,
};

const cache = new Map<string, WaterlineTexPair>();

export function getWaterlineTileTexture(
  tileId: string | undefined,
): WaterlineTexPair {
  const tile = getWaterlineTile(tileId);
  const key = `${tile.id}@v1`;
  const cached = cache.get(key);
  if (cached) return cached;
  if (typeof document === "undefined") {
    return makePair(4, () => {}, [1, 1]);
  }
  const pair = generators[tile.pattern](tile, 768);
  cache.set(key, pair);
  return pair;
}

export function preloadWaterlineTileTextures(ids: string[]) {
  for (const id of ids) getWaterlineTileTexture(id);
}
