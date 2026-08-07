import * as THREE from "three";

/** Deterministic PRNG so textures don't reshuffle every mount. */
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

function fbm(
  x: number,
  y: number,
  seed: number,
  octaves = 5,
): number {
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

type TexPair = {
  color: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
};

function canvasPair(
  size: number,
  draw: (
    color: CanvasRenderingContext2D,
    rough: CanvasRenderingContext2D,
    size: number,
  ) => void,
  anisotropy = 8,
): TexPair {
  const colorCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  colorCanvas.width = roughCanvas.width = size;
  colorCanvas.height = roughCanvas.height = size;
  const cctx = colorCanvas.getContext("2d")!;
  const rctx = roughCanvas.getContext("2d")!;
  // Default mid roughness
  rctx.fillStyle = "#a0a0a0";
  rctx.fillRect(0, 0, size, size);
  draw(cctx, rctx, size);

  const color = new THREE.CanvasTexture(colorCanvas);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  for (const tex of [color, roughness]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = anisotropy;
    tex.needsUpdate = true;
  }
  color.colorSpace = THREE.SRGBColorSpace;
  roughness.colorSpace = THREE.NoColorSpace;
  return { color, roughness };
}

function setPixel(
  img: ImageData,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
) {
  const i = (y * img.width + x) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = a;
}

/** Quartz plaster / pool interior finish. */
export function makePlasterTexture(): TexPair {
  return canvasPair(512, (cctx, rctx, size) => {
    const cImg = cctx.createImageData(size, size);
    const rImg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm(x / 48, y / 48, 11, 6);
        const m = fbm(x / 12, y / 12, 29, 3);
        const speck = hash2(x, y, 77) > 0.985 ? 18 : 0;
        const base = 232 + n * 14 + m * 6 - speck;
        const r = Math.min(255, base + 2);
        const g = Math.min(255, base + 4);
        const b = Math.min(255, base);
        setPixel(cImg, x, y, r, g, b);
        const rough = 140 + n * 50 + m * 30;
        setPixel(rImg, x, y, rough, rough, rough);
      }
    }
    cctx.putImageData(cImg, 0, 0);
    rctx.putImageData(rImg, 0, 0);
  });
}

/** Pebble-tec style aggregate floor. */
export function makePebbleFloorTexture(): TexPair {
  return canvasPair(512, (cctx, rctx, size) => {
    const rand = mulberry32(0x5eed);
    // Deep teal base
    cctx.fillStyle = "#1e4f5c";
    cctx.fillRect(0, 0, size, size);
    rctx.fillStyle = "#b0b0b0";
    rctx.fillRect(0, 0, size, size);

    const palette = [
      [40, 95, 110],
      [55, 120, 130],
      [30, 70, 85],
      [70, 140, 145],
      [90, 150, 140],
      [45, 85, 95],
      [110, 160, 155],
    ];
    for (let i = 0; i < 4200; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const rad = 1.2 + rand() * 3.8;
      const [pr, pg, pb] = palette[Math.floor(rand() * palette.length)];
      const j = (rand() - 0.5) * 28;
      cctx.beginPath();
      cctx.fillStyle = `rgb(${pr + j},${pg + j},${pb + j * 0.6})`;
      cctx.ellipse(x, y, rad, rad * (0.7 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
      cctx.fill();
      const rv = 90 + rand() * 100;
      rctx.beginPath();
      rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rctx.ellipse(x, y, rad * 0.9, rad * 0.7, 0, 0, Math.PI * 2);
      rctx.fill();
    }
    // Soft overlay variation
    const overlay = cctx.getImageData(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm(x / 64, y / 64, 41, 3);
        const i = (y * size + x) * 4;
        overlay.data[i] = Math.min(255, overlay.data[i] * (0.92 + n * 0.16));
        overlay.data[i + 1] = Math.min(255, overlay.data[i + 1] * (0.92 + n * 0.16));
        overlay.data[i + 2] = Math.min(255, overlay.data[i + 2] * (0.92 + n * 0.16));
      }
    }
    cctx.putImageData(overlay, 0, 0);
  });
}

/** Glass mosaic waterline tile. */
export function makeWaterlineTileTexture(): TexPair {
  return canvasPair(512, (cctx, rctx, size) => {
    const cols = 16;
    const rows = 8;
    const tw = size / cols;
    const th = size / rows;
    const palette = [
      "#9ec4d4",
      "#b7d6e4",
      "#7faebe",
      "#cfe4ee",
      "#8eb8c8",
      "#a8cddc",
      "#6f9eae",
      "#d8ebf2",
    ];
    // Grout
    cctx.fillStyle = "#d5ddd8";
    cctx.fillRect(0, 0, size, size);
    rctx.fillStyle = "#c8c8c8";
    rctx.fillRect(0, 0, size, size);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const n = fbm(col * 0.7, row * 0.7, 55, 2);
        const idx = Math.floor((n * palette.length + col + row * 3) % palette.length);
        const pad = 1.5;
        cctx.fillStyle = palette[idx];
        cctx.fillRect(col * tw + pad, row * th + pad, tw - pad * 2, th - pad * 2);
        // Specular sheen stripe per tile
        cctx.fillStyle = "rgba(255,255,255,0.18)";
        cctx.fillRect(col * tw + pad + 2, row * th + pad + 2, tw * 0.35, th * 0.2);
        const rv = 40 + n * 50;
        rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
        rctx.fillRect(col * tw + pad, row * th + pad, tw - pad * 2, th - pad * 2);
      }
    }
  });
}

/** Travertine / limestone coping. */
export function makeStoneCopingTexture(): TexPair {
  return canvasPair(512, (cctx, rctx, size) => {
    const cImg = cctx.createImageData(size, size);
    const rImg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm(x / 70, y / 28, 63, 5);
        const vein = Math.pow(Math.abs(Math.sin((x + n * 40) * 0.04 + y * 0.01)), 12);
        const pit = hash2(x >> 1, y >> 1, 91) > 0.992 ? 22 : 0;
        const base = 210 + n * 28 - vein * 35 - pit;
        setPixel(
          cImg,
          x,
          y,
          Math.min(255, base + 8),
          Math.min(255, base + 2),
          Math.min(255, base - 12),
        );
        const rough = 100 + n * 70 + vein * 40 + pit;
        setPixel(rImg, x, y, rough, rough, rough);
      }
    }
    cctx.putImageData(cImg, 0, 0);
    rctx.putImageData(rImg, 0, 0);
    // Soft joint band
    cctx.strokeStyle = "rgba(150,135,115,0.22)";
    cctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const y = (i / 4) * size;
      cctx.beginPath();
      cctx.moveTo(0, y);
      for (let x = 0; x < size; x += 8) {
        cctx.lineTo(x, y + Math.sin(x * 0.05) * 2);
      }
      cctx.stroke();
    }
  });
}

/** Stained exterior door wood — warm brown vertical grain. */
export function makeDoorWoodTexture(): TexPair {
  const pair = canvasPair(512, (cctx, rctx, size) => {
    const cImg = cctx.createImageData(size, size);
    const rImg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const grain = fbm(x / 12, y / 100, 41, 5);
        const pore = hash2(x >> 1, y, 58) > 0.991 ? 28 : 0;
        const band = Math.sin(x * 0.04 + grain * 3) * 12;
        const n = grain * 0.55 + 0.45;
        const r = Math.min(255, 95 + n * 70 + band - pore);
        const g = Math.min(255, 52 + n * 38 + band * 0.4 - pore);
        const b = Math.min(255, 22 + n * 18 - pore);
        setPixel(cImg, x, y, r, g, b);
        const rough = 110 + grain * 80 + pore;
        setPixel(rImg, x, y, rough, rough, rough);
      }
    }
    cctx.putImageData(cImg, 0, 0);
    rctx.putImageData(rImg, 0, 0);
  });
  pair.color.repeat.set(1, 1);
  pair.roughness.repeat.set(1, 1);
  return pair;
}

/** White / cream vinyl or painted window & door casing. */
export function makeTrimTexture(): TexPair {
  const pair = canvasPair(256, (cctx, rctx, size) => {
    const cImg = cctx.createImageData(size, size);
    const rImg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm(x / 40, y / 40, 63, 3);
        const base = 232 + n * 12;
        setPixel(cImg, x, y, base, base - 1, base - 4);
        const rough = 55 + n * 35;
        setPixel(rImg, x, y, rough, rough, rough);
      }
    }
    cctx.putImageData(cImg, 0, 0);
    rctx.putImageData(rImg, 0, 0);
  });
  pair.color.repeat.set(2, 2);
  pair.roughness.repeat.set(2, 2);
  return pair;
}

/** Broomed concrete patio with control joints. */
export function makeDeckTexture(): TexPair {
  const pair = canvasPair(512, (cctx, rctx, size) => {
    const cImg = cctx.createImageData(size, size);
    const rImg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm(x / 55, y / 55, 17, 4);
        const broom = (Math.sin(y * 0.9 + n * 3) * 0.5 + 0.5) * 12;
        const agg = hash2(x, y, 33) > 0.97 ? 20 : 0;
        const base = 155 + n * 35 + broom - agg;
        setPixel(
          cImg,
          x,
          y,
          Math.min(255, base + 6),
          Math.min(255, base - 2),
          Math.min(255, base - 14),
        );
        const rough = 160 + n * 50 + broom + agg;
        setPixel(rImg, x, y, rough, rough, rough);
      }
    }
    cctx.putImageData(cImg, 0, 0);
    rctx.putImageData(rImg, 0, 0);

    // Control joints
    cctx.strokeStyle = "rgba(95,82,70,0.4)";
    cctx.lineWidth = 3;
    rctx.strokeStyle = "#e0e0e0";
    rctx.lineWidth = 3;
    const step = size / 4;
    for (let i = 1; i < 4; i++) {
      cctx.beginPath();
      rctx.beginPath();
      cctx.moveTo(i * step, 0);
      rctx.moveTo(i * step, 0);
      cctx.lineTo(i * step, size);
      rctx.lineTo(i * step, size);
      cctx.stroke();
      rctx.stroke();
      cctx.beginPath();
      rctx.beginPath();
      cctx.moveTo(0, i * step);
      rctx.moveTo(0, i * step);
      cctx.lineTo(size, i * step);
      rctx.lineTo(size, i * step);
      cctx.stroke();
      rctx.stroke();
    }
  });
  pair.color.repeat.set(5, 5);
  pair.roughness.repeat.set(5, 5);
  return pair;
}

/** Lawn turf. */
export function makeGroundTexture(): TexPair {
  const pair = canvasPair(512, (cctx, rctx, size) => {
    const cImg = cctx.createImageData(size, size);
    const rImg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm(x / 36, y / 36, 7, 5);
        const blade = hash2(x, y, 19);
        const g = 85 + n * 70 + blade * 25;
        setPixel(
          cImg,
          x,
          y,
          Math.min(255, g * 0.45),
          Math.min(255, g),
          Math.min(255, g * 0.38),
        );
        const rough = 200 + n * 40;
        setPixel(rImg, x, y, rough, rough, rough);
      }
    }
    cctx.putImageData(cImg, 0, 0);
    rctx.putImageData(rImg, 0, 0);
  }, 4);
  pair.color.repeat.set(14, 14);
  pair.roughness.repeat.set(14, 14);
  return pair;
}

/** House stucco. */
export function makeStuccoTexture(): TexPair {
  return canvasPair(512, (cctx, rctx, size) => {
    const cImg = cctx.createImageData(size, size);
    const rImg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm(x / 40, y / 40, 101, 5);
        const base = 190 + n * 30;
        setPixel(
          cImg,
          x,
          y,
          Math.min(255, base + 8),
          Math.min(255, base - 2),
          Math.min(255, base - 18),
        );
        const rough = 150 + n * 60;
        setPixel(rImg, x, y, rough, rough, rough);
      }
    }
    cctx.putImageData(cImg, 0, 0);
    rctx.putImageData(rImg, 0, 0);
  });
}

/** Outdoor teak / eucalyptus furniture wood — warm horizontal grain. */
export function makeTeakWoodTexture(): TexPair {
  const pair = canvasPair(512, (cctx, rctx, size) => {
    const cImg = cctx.createImageData(size, size);
    const rImg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const grain = fbm(x / 90, y / 14, 77, 5);
        const ring = Math.sin(y * 0.035 + grain * 4) * 14;
        const pore = hash2(x, y >> 1, 91) > 0.993 ? 22 : 0;
        const n = grain * 0.5 + 0.5;
        const r = Math.min(255, 140 + n * 55 + ring - pore);
        const g = Math.min(255, 95 + n * 40 + ring * 0.5 - pore);
        const b = Math.min(255, 48 + n * 22 - pore * 0.5);
        setPixel(cImg, x, y, r, g, b);
        const rough = 95 + grain * 90 + pore;
        setPixel(rImg, x, y, rough, rough, rough);
      }
    }
    cctx.putImageData(cImg, 0, 0);
    rctx.putImageData(rImg, 0, 0);
  });
  pair.color.repeat.set(2, 2);
  pair.roughness.repeat.set(2, 2);
  return pair;
}

/** Woven outdoor cushion / sling fabric. */
export function makeOutdoorCushionTexture(): TexPair {
  const pair = canvasPair(256, (cctx, rctx, size) => {
    const cImg = cctx.createImageData(size, size);
    const rImg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const weave =
          ((Math.floor(x / 3) + Math.floor(y / 3)) % 2) * 10 +
          fbm(x / 28, y / 28, 112, 3) * 18;
        // Sage outdoor fabric
        const r = Math.min(255, 72 + weave);
        const g = Math.min(255, 98 + weave * 0.85);
        const b = Math.min(255, 88 + weave * 0.55);
        setPixel(cImg, x, y, r, g, b);
        const rough = 145 + weave * 2.5;
        setPixel(rImg, x, y, rough, rough, rough);
      }
    }
    cctx.putImageData(cImg, 0, 0);
    rctx.putImageData(rImg, 0, 0);
  });
  pair.color.repeat.set(3, 3);
  pair.roughness.repeat.set(3, 3);
  return pair;
}

/** Market umbrella canvas — fine weave with subtle fade. */
export function makeUmbrellaCanvasTexture(): TexPair {
  const pair = canvasPair(256, (cctx, rctx, size) => {
    const cImg = cctx.createImageData(size, size);
    const rImg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const yarn = ((x + y) % 4 === 0 ? 8 : 0) + fbm(x / 35, y / 35, 130, 3) * 16;
        const r = Math.min(255, 118 + yarn);
        const g = Math.min(255, 108 + yarn * 0.7);
        const b = Math.min(255, 88 + yarn * 0.4);
        setPixel(cImg, x, y, r, g, b);
        const rough = 120 + yarn * 3;
        setPixel(rImg, x, y, rough, rough, rough);
      }
    }
    cctx.putImageData(cImg, 0, 0);
    rctx.putImageData(rImg, 0, 0);
  });
  pair.color.repeat.set(2, 2);
  pair.roughness.repeat.set(2, 2);
  return pair;
}

/** Soft caustic-ish pattern for water surface tint (low contrast). */
export function makeWaterSurfaceTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n =
        0.55 +
        0.25 * Math.sin(x * 0.09 + fbm(x / 40, y / 40, 3, 3) * 6) *
          Math.cos(y * 0.08 + fbm(x / 50, y / 50, 8, 3) * 5);
      const v = Math.floor(n * 255);
      setPixel(img, x, y, v, v + 8, v + 12, 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
