import {
  formatLength,
  objectFootprint,
  segmentLengthMm,
  type PlacedObject,
  type PlumbingRun,
  type PointMm,
  type PoolFeature,
  type UnitSystem,
} from "@pool-design/shared";
import { type Viewport, worldToScreen } from "@/lib/cad/math";

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  vp: Viewport,
  unitSystem: UnitSystem,
) {
  ctx.fillStyle = "#eef3f1";
  ctx.fillRect(0, 0, width, height);

  const gridMm = unitSystem === "imperial" ? 304.8 : 250;
  const step = gridMm * vp.scale;
  if (step < 8) return;

  ctx.strokeStyle = "rgba(20,32,41,0.07)";
  ctx.lineWidth = 1;
  const startX = vp.panX % step;
  const startY = vp.panY % step;
  for (let x = startX; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = startY; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

export function drawPolygon(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  outline: PointMm[],
  selected: boolean,
  stroke: string,
  fill: string,
  unitSystem: UnitSystem,
  withDims: boolean,
  showVertices: boolean,
) {
  if (outline.length < 2) return;
  ctx.beginPath();
  outline.forEach((p, i) => {
    const c = worldToScreen(p, vp);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = selected ? "#0f5c4a" : stroke;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.stroke();

  if (withDims) {
    for (let i = 0; i < outline.length; i++) {
      drawEdgeLabel(ctx, vp, outline[i], outline[(i + 1) % outline.length], unitSystem);
    }
  }

  if (showVertices) {
    for (const p of outline) {
      const c = worldToScreen(p, vp);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#0f5c4a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

export function drawRun(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  run: PlumbingRun,
  selected: boolean,
  unitSystem: UnitSystem,
  showVertices: boolean,
) {
  if (run.points.length < 2) return;
  ctx.strokeStyle = selected ? "#0f5c4a" : "#1f8a70";
  ctx.lineWidth = selected ? 3 : 2;
  ctx.beginPath();
  run.points.forEach((p, i) => {
    const c = worldToScreen(p, vp);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.stroke();
  for (let i = 1; i < run.points.length; i++) {
    drawEdgeLabel(ctx, vp, run.points[i - 1], run.points[i], unitSystem);
  }
  if (showVertices) {
    for (const p of run.points) {
      const c = worldToScreen(p, vp);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#0f5c4a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

export function drawPlacedObject(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  obj: PlacedObject,
  selected: boolean,
  preview = false,
) {
  const outline = objectFootprint(obj);
  ctx.beginPath();
  outline.forEach((p, i) => {
    const c = worldToScreen(p, vp);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.closePath();
  ctx.fillStyle = preview ? "rgba(196,122,44,0.25)" : "rgba(196,122,44,0.35)";
  ctx.fill();
  ctx.strokeStyle = selected || preview ? "#8a4f12" : "#c47a2c";
  ctx.lineWidth = selected ? 2.5 : 1.5;
  if (preview) ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  const label = worldToScreen(obj.position, vp);
  ctx.fillStyle = "rgba(20,32,41,0.8)";
  ctx.font = "11px Source Sans 3, sans-serif";
  ctx.fillText(obj.name, label.x - 24, label.y + 4);

  if (selected && !preview) {
    const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
    const dist = obj.depthMm / 2 + 400;
    const handle = worldToScreen(
      {
        x: obj.position.x - Math.sin(rad) * dist,
        y: obj.position.y - Math.cos(rad) * dist,
      },
      vp,
    );
    const center = worldToScreen(obj.position, vp);
    ctx.strokeStyle = "#8a4f12";
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(handle.x, handle.y);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

export function drawFeature(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  feature: PoolFeature,
  selected: boolean,
  unitSystem: UnitSystem,
) {
  const stroke = feature.kind === "steps" ? "#2f6f9f" : "#6b4f9a";
  const fill =
    feature.kind === "steps"
      ? "rgba(47,111,159,0.28)"
      : "rgba(107,79,154,0.28)";
  drawPolygon(
    ctx,
    vp,
    feature.outline,
    selected,
    stroke,
    fill,
    unitSystem,
    true,
    selected,
  );
  if (feature.outline.length) {
    const c = worldToScreen(feature.outline[0], vp);
    ctx.fillStyle = "rgba(20,32,41,0.8)";
    ctx.font = "11px Source Sans 3, sans-serif";
    ctx.fillText(feature.name, c.x + 4, c.y - 6);
  }
}

export function drawMeasure(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  a: PointMm,
  b: PointMm,
  unitSystem: UnitSystem,
) {
  const sa = worldToScreen(a, vp);
  const sb = worldToScreen(b, vp);
  ctx.strokeStyle = "#b33a3a";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#b33a3a";
  ctx.beginPath();
  ctx.arc(sa.x, sa.y, 4, 0, Math.PI * 2);
  ctx.arc(sb.x, sb.y, 4, 0, Math.PI * 2);
  ctx.fill();
  drawEdgeLabel(ctx, vp, a, b, unitSystem);
}

export function drawEdgeLabel(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  a: PointMm,
  b: PointMm,
  unitSystem: UnitSystem,
) {
  const len = segmentLengthMm(a, b);
  if (len * vp.scale < 28) return;
  const mid = worldToScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vp);
  ctx.font = "11px Source Sans 3, sans-serif";
  ctx.fillStyle = "rgba(20,32,41,0.75)";
  ctx.fillText(formatLength(len, unitSystem), mid.x + 4, mid.y - 4);
}

export function drawDraft(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  points: PointMm[],
  preview: PointMm | null,
  stroke: string,
  dashed: boolean,
  closePreview: boolean,
) {
  if (!points.length) return;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.5;
  if (dashed) ctx.setLineDash([7, 5]);
  ctx.beginPath();
  points.forEach((p, i) => {
    const c = worldToScreen(p, vp);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  if (preview) {
    const c = worldToScreen(preview, vp);
    ctx.lineTo(c.x, c.y);
    if (closePreview && points.length >= 2) {
      const first = worldToScreen(points[0], vp);
      ctx.lineTo(first.x, first.y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  for (const p of points) {
    const c = worldToScreen(p, vp);
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
