"use client";

import { useEffect, useRef } from "react";
import {
  getPatioFinish,
  getWaterlineTile,
  PATIO_FINISH_PATTERN_LABELS,
  WATERLINE_TILE_PATTERN_LABELS,
} from "@pool-design/shared";
import { getPatioFinishPreviewCanvas } from "@/lib/cad3d/patioFinishTextures";
import { getWaterlineTilePreviewCanvas } from "@/lib/cad3d/waterlineTileTextures";

type Props = {
  waterlineTileId: string;
  patioMaterialId: string;
  /** Material swatches only — used beside the 3D still so we don't draw a second pool. */
  compact?: boolean;
};

const W = 720;
const H = 420;

/** Rounded-rect pool outline in preview coordinates. */
function poolPath(ctx: CanvasRenderingContext2D) {
  const x = W * 0.18;
  const y = H * 0.22;
  const w = W * 0.64;
  const h = H * 0.52;
  const r = Math.min(w, h) * 0.18;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  return { x, y, w, h, r };
}

function fillPattern(
  ctx: CanvasRenderingContext2D,
  patternCanvas: HTMLCanvasElement,
  tilePx: number,
) {
  const scale = tilePx / patternCanvas.width;
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.round(patternCanvas.width * scale));
  off.height = Math.max(1, Math.round(patternCanvas.height * scale));
  const octx = off.getContext("2d")!;
  octx.imageSmoothingEnabled = true;
  octx.drawImage(patternCanvas, 0, 0, off.width, off.height);
  const pat = ctx.createPattern(off, "repeat");
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
  }
}

function paintSwatch(
  canvas: HTMLCanvasElement | null,
  src: HTMLCanvasElement | null,
  fallback: string,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  if (src) {
    const scale = size / 2.2 / src.width;
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(src.width * scale));
    off.height = Math.max(1, Math.round(src.height * scale));
    const octx = off.getContext("2d")!;
    octx.imageSmoothingEnabled = true;
    octx.drawImage(src, 0, 0, off.width, off.height);
    const pat = ctx.createPattern(off, "repeat");
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, size, size);
      return;
    }
  }
  ctx.fillStyle = fallback;
  ctx.fillRect(0, 0, size, size);
}

/**
 * Patio + waterline preview. Full scene, or compact material swatches
 * when shown beside the designer's 3D still.
 */
export function FinishCombinationPreview({
  waterlineTileId,
  patioMaterialId,
  compact = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tileSwatchRef = useRef<HTMLCanvasElement | null>(null);
  const patioSwatchRef = useRef<HTMLCanvasElement | null>(null);
  const tile = getWaterlineTile(waterlineTileId);
  const patio = getPatioFinish(patioMaterialId);

  useEffect(() => {
    if (compact) {
      paintSwatch(
        tileSwatchRef.current,
        getWaterlineTilePreviewCanvas(waterlineTileId),
        "#4a7a9a",
      );
      paintSwatch(
        patioSwatchRef.current,
        getPatioFinishPreviewCanvas(patioMaterialId),
        "#c4b8a8",
      );
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const patioSrc = getPatioFinishPreviewCanvas(patioMaterialId);
    const tileSrc = getWaterlineTilePreviewCanvas(waterlineTileId);

    ctx.clearRect(0, 0, W, H);

    // 1) Patio deck — real pattern from 3D material generator
    if (patioSrc) {
      fillPattern(ctx, patioSrc, W / 3.2);
    } else {
      ctx.fillStyle = "#c4b8a8";
      ctx.fillRect(0, 0, W, H);
    }

    const vig = ctx.createRadialGradient(
      W * 0.5,
      H * 0.48,
      H * 0.15,
      W * 0.5,
      H * 0.48,
      H * 0.72,
    );
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(30,40,35,0.12)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    const pool = poolPath(ctx);
    const band = Math.max(18, Math.round(pool.h * 0.11));

    // 2) Water body (clipped)
    ctx.save();
    poolPath(ctx);
    ctx.clip();
    const water = ctx.createLinearGradient(0, pool.y, 0, pool.y + pool.h);
    water.addColorStop(0, "#7ec8e8");
    water.addColorStop(0.45, "#3a9bc4");
    water.addColorStop(1, "#1e6f96");
    ctx.fillStyle = water;
    ctx.fillRect(pool.x, pool.y, pool.w, pool.h);
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 7; i++) {
      const yy = pool.y + pool.h * (0.22 + i * 0.1);
      ctx.beginPath();
      ctx.ellipse(
        pool.x + pool.w * 0.5,
        yy,
        pool.w * (0.28 + (i % 3) * 0.05),
        6 + (i % 2) * 3,
        0,
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 3) Waterline course on the pool rim (outside clip so full band shows)
    let bandPat: CanvasPattern | null = null;
    if (tileSrc) {
      const tileScale = (pool.w / 8) / tileSrc.width;
      const tw = Math.max(1, Math.round(tileSrc.width * tileScale));
      const th = Math.max(1, Math.round(tileSrc.height * tileScale));
      const tileSheet = document.createElement("canvas");
      tileSheet.width = tw;
      tileSheet.height = th;
      const tctx = tileSheet.getContext("2d")!;
      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(tileSrc, 0, 0, tw, th);
      bandPat = ctx.createPattern(tileSheet, "repeat");
    }
    poolPath(ctx);
    ctx.lineWidth = band;
    ctx.lineJoin = "round";
    ctx.strokeStyle = bandPat ?? "#4a7a9a";
    ctx.stroke();

    // Thin coping highlight outside the tile band
    poolPath(ctx);
    ctx.lineWidth = band + 5;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.stroke();
    poolPath(ctx);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(35, 45, 40, 0.4)";
    ctx.stroke();

    // Labels
    ctx.fillStyle = "rgba(20, 28, 24, 0.55)";
    ctx.fillRect(12, H - 36, 168, 24);
    ctx.fillRect(W - 180, H - 36, 168, 24);
    ctx.fillStyle = "#fff";
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillText("Patio deck", 22, H - 20);
    ctx.fillText("Waterline band", W - 168, H - 20);
  }, [compact, waterlineTileId, patioMaterialId]);

  const meta = (
    <div className="client-finish-preview-meta">
      <div>
        <span className="muted">Waterline</span>
        <strong>{tile.name}</strong>
        <div className="muted" style={{ fontSize: "0.78rem" }}>
          {WATERLINE_TILE_PATTERN_LABELS[tile.pattern]} · {tile.colorName}
        </div>
      </div>
      <div>
        <span className="muted">Patio</span>
        <strong>{patio.name}</strong>
        <div className="muted" style={{ fontSize: "0.78rem" }}>
          {PATIO_FINISH_PATTERN_LABELS[patio.pattern]} · {patio.colorName}
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div
        className="client-finish-preview is-compact"
        aria-live="polite"
        aria-label={`Selected: ${patio.name} patio with ${tile.name} waterline`}
      >
        <div className="client-finish-swatches">
          <canvas
            ref={tileSwatchRef}
            className="client-finish-swatch"
            width={96}
            height={96}
          />
          <canvas
            ref={patioSwatchRef}
            className="client-finish-swatch"
            width={96}
            height={96}
          />
        </div>
        {meta}
      </div>
    );
  }

  return (
    <div className="client-finish-preview" aria-live="polite">
      <canvas
        ref={canvasRef}
        className="client-finish-preview-canvas"
        width={W}
        height={H}
        role="img"
        aria-label={`Preview: ${patio.name} patio with ${tile.name} waterline`}
      />
      {meta}
    </div>
  );
}
