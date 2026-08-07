import * as THREE from "three";
import {
  getPatioFinish,
  type PatioFinish,
  type PatioFinishPattern,
} from "@pool-design/shared";

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
  repeat: [number, number],
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

function drawBroomed(finish: PatioFinish, size: number): PatioTexPair {
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
      // Control joints
      c.strokeStyle = `rgba(${finish.accent.r},${finish.accent.g},${finish.accent.b},0.45)`;
      c.lineWidth = 3;
      const step = s / 4;
      for (let i = 1; i < 4; i++) {
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
    [5, 5],
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
    [3, 3],
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
    [4, 4],
  );
}

function drawStampedAshlar(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#d0d0d0";
      r.fillRect(0, 0, s, s);
      const rows = 6;
      const cols = 5;
      const tw = s / cols;
      const th = s / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ox = (row % 2) * (tw * 0.35);
          const n = fbm(col, row, 44, 2);
          const pad = 2;
          c.fillStyle = tint(finish.color, (n - 0.5) * 30);
          c.fillRect(col * tw + ox + pad, row * th + pad, tw - pad * 2, th - pad * 2);
          r.fillStyle = `rgb(${90 + n * 50},${90 + n * 50},${90 + n * 50})`;
          r.fillRect(col * tw + ox + pad, row * th + pad, tw - pad * 2, th - pad * 2);
        }
      }
    },
    [3, 3],
  );
}

function drawStampedCobble(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      const rand = mulberry32(0xc0bb);
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#d8d8d8";
      r.fillRect(0, 0, s, s);
      for (let i = 0; i < 220; i++) {
        const x = rand() * s;
        const y = rand() * s;
        const rx = 8 + rand() * 16;
        const ry = 7 + rand() * 14;
        c.beginPath();
        c.fillStyle = tint(finish.color, (rand() - 0.5) * 35);
        c.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = `rgba(${finish.accent.r},${finish.accent.g},${finish.accent.b},0.5)`;
        c.lineWidth = 1.5;
        c.stroke();
      }
    },
    [2.5, 2.5],
  );
}

function drawStampedPlank(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      const plankH = s / 8;
      for (let row = 0; row < 8; row++) {
        const n = fbm(row, 0, 66, 2);
        c.fillStyle = tint(finish.color, (n - 0.5) * 28);
        c.fillRect(0, row * plankH, s, plankH - 2);
        r.fillStyle = `rgb(${120 + n * 40},${120 + n * 40},${120 + n * 40})`;
        r.fillRect(0, row * plankH, s, plankH - 2);
        // Grain
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
    [2, 3],
  );
}

function drawRunningBond(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#c8c8c8";
      r.fillRect(0, 0, s, s);
      const rows = 10;
      const cols = 6;
      const th = s / rows;
      const tw = s / cols;
      for (let row = 0; row < rows; row++) {
        const offset = (row % 2) * (tw * 0.5);
        for (let col = -1; col <= cols; col++) {
          const n = fbm(col * 0.4, row * 0.4, 71, 2);
          const pad = 1.8;
          const x = col * tw + offset + pad;
          const y = row * th + pad;
          c.fillStyle = tint(finish.color, (n - 0.5) * 22);
          c.fillRect(x, y, tw - pad * 2, th - pad * 2);
          r.fillStyle = `rgb(${55 + n * 40},${55 + n * 40},${55 + n * 40})`;
          r.fillRect(x, y, tw - pad * 2, th - pad * 2);
        }
      }
    },
    [4, 4],
  );
}

function drawHerringbone(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      r.fillStyle = "#c0c0c0";
      r.fillRect(0, 0, s, s);
      const unit = s / 10;
      for (let row = -1; row < 12; row++) {
        for (let col = -1; col < 12; col++) {
          const n = fbm(col, row, 88, 2);
          c.save();
          c.translate(col * unit * 1.4, row * unit * 1.4);
          c.rotate(((col + row) % 2 === 0 ? 1 : -1) * (Math.PI / 4));
          c.fillStyle = tint(finish.color, (n - 0.5) * 24);
          c.fillRect(-unit * 0.9, -unit * 0.28, unit * 1.8, unit * 0.5);
          r.fillStyle = `rgb(${60 + n * 45},${60 + n * 45},${60 + n * 45})`;
          r.fillRect(-unit * 0.9, -unit * 0.28, unit * 1.8, unit * 0.5);
          c.restore();
        }
      }
    },
    [3.5, 3.5],
  );
}

function drawBasketweave(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      const cell = s / 6;
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
          const horiz = (row + col) % 2 === 0;
          const n = fbm(col, row, 99, 2);
          const x0 = col * cell;
          const y0 = row * cell;
          const pad = 2;
          if (horiz) {
            for (let k = 0; k < 2; k++) {
              c.fillStyle = tint(finish.color, (n - 0.5) * 20 + k * 4);
              c.fillRect(
                x0 + pad,
                y0 + pad + k * (cell / 2),
                cell - pad * 2,
                cell / 2 - pad,
              );
            }
          } else {
            for (let k = 0; k < 2; k++) {
              c.fillStyle = tint(finish.color, (n - 0.5) * 20 + k * 4);
              c.fillRect(
                x0 + pad + k * (cell / 2),
                y0 + pad,
                cell / 2 - pad,
                cell - pad * 2,
              );
            }
          }
        }
      }
    },
    [3, 3],
  );
}

function drawStackBond(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      const rows = 8;
      const cols = 8;
      const tw = s / cols;
      const th = s / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const n = fbm(col * 0.5, row * 0.5, 12, 2);
          const pad = 2;
          c.fillStyle = tint(finish.color, (n - 0.5) * 18);
          c.fillRect(col * tw + pad, row * th + pad, tw - pad * 2, th - pad * 2);
          r.fillStyle = `rgb(${50 + n * 35},${50 + n * 35},${50 + n * 35})`;
          r.fillRect(col * tw + pad, row * th + pad, tw - pad * 2, th - pad * 2);
        }
      }
    },
    [4, 4],
  );
}

function drawModular(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      c.fillStyle = tint(finish.accent, 0);
      c.fillRect(0, 0, s, s);
      const layouts = [
        [0, 0, 0.5, 0.5],
        [0.5, 0, 0.5, 0.5],
        [0, 0.5, 0.33, 0.5],
        [0.33, 0.5, 0.67, 0.5],
      ];
      const cell = s / 3;
      for (let gy = 0; gy < 3; gy++) {
        for (let gx = 0; gx < 3; gx++) {
          for (const [u, v, w, h] of layouts) {
            const n = fbm(gx + u, gy + v, 33, 2);
            c.fillStyle = tint(finish.color, (n - 0.5) * 26);
            c.fillRect(
              gx * cell + u * cell + 2,
              gy * cell + v * cell + 2,
              w * cell - 4,
              h * cell - 4,
            );
          }
        }
      }
    },
    [2.5, 2.5],
  );
}

function drawTravertine(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      const img = c.createImageData(s, s);
      const rimg = r.createImageData(s, s);
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const n = fbm(x / 65, y / 30, 63, 5);
          const vein = Math.pow(
            Math.abs(Math.sin((x + n * 40) * 0.035 + y * 0.012)),
            10,
          );
          const pit = hash2(x >> 1, y >> 1, 91) > 0.993 ? 20 : 0;
          const i = (y * s + x) * 4;
          img.data[i] = finish.color.r + n * 22 - vein * 30 - pit;
          img.data[i + 1] = finish.color.g + n * 18 - vein * 28 - pit;
          img.data[i + 2] = finish.color.b + n * 12 - vein * 22 - pit;
          img.data[i + 3] = 255;
          const rv = 95 + n * 60 + vein * 40;
          rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rv;
          rimg.data[i + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
      r.putImageData(rimg, 0, 0);
      // Large format joints
      c.strokeStyle = `rgba(${finish.accent.r},${finish.accent.g},${finish.accent.b},0.35)`;
      c.lineWidth = 3;
      c.strokeRect(s * 0.02, s * 0.02, s * 0.96, s * 0.96);
      c.beginPath();
      c.moveTo(s / 2, 0);
      c.lineTo(s / 2, s);
      c.moveTo(0, s / 2);
      c.lineTo(s, s / 2);
      c.stroke();
    },
    [2.2, 2.2],
  );
}

function drawBluestone(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      const img = c.createImageData(s, s);
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const n = fbm(x / 45, y / 45, 19, 5);
          const cleft = fbm(x / 12, y / 12, 27, 2);
          const i = (y * s + x) * 4;
          img.data[i] = finish.color.r + n * 20 + cleft * 10;
          img.data[i + 1] = finish.color.g + n * 22 + cleft * 12;
          img.data[i + 2] = finish.color.b + n * 26 + cleft * 14;
          img.data[i + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
      c.strokeStyle = `rgba(${finish.accent.r},${finish.accent.g},${finish.accent.b},0.4)`;
      c.lineWidth = 4;
      const rows = 3;
      const cols = 3;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          c.strokeRect(
            (col / cols) * s + 3,
            (row / rows) * s + 3,
            s / cols - 6,
            s / rows - 6,
          );
        }
      }
    },
    [2, 2],
  );
}

function drawPorcelain(finish: PatioFinish, size: number): PatioTexPair {
  return makePair(
    size,
    (c, r, s) => {
      const img = c.createImageData(s, s);
      const rimg = r.createImageData(s, s);
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const n = fbm(x / 80, y / 80, 5, 3);
          const i = (y * s + x) * 4;
          img.data[i] = finish.color.r + n * 10;
          img.data[i + 1] = finish.color.g + n * 10;
          img.data[i + 2] = finish.color.b + n * 10;
          img.data[i + 3] = 255;
          const rv = 35 + n * 25;
          rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rv;
          rimg.data[i + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
      r.putImageData(rimg, 0, 0);
      c.strokeStyle = `rgba(${finish.accent.r},${finish.accent.g},${finish.accent.b},0.5)`;
      c.lineWidth = 3;
      c.strokeRect(4, 4, s - 8, s - 8);
    },
    [1.6, 1.6],
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
      // Pits
      for (let i = 0; i < 400; i++) {
        c.beginPath();
        c.fillStyle = tint(finish.accent, -20);
        c.arc(rand() * s, rand() * s, 1 + rand() * 2.5, 0, Math.PI * 2);
        c.fill();
      }
    },
    [3, 3],
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
  const cached = cache.get(finish.id);
  if (cached) return cached;
  if (typeof document === "undefined") {
    // SSR stub — empty canvases
    const empty = makePair(4, () => {}, [1, 1]);
    return empty;
  }
  const pair = generators[finish.pattern](finish, 512);
  cache.set(finish.id, pair);
  return pair;
}

export function preloadPatioFinishTextures(ids: string[]) {
  for (const id of ids) getPatioFinishTexture(id);
}
