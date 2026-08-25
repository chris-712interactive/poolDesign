import {
  clampOpeningStory,
  clampOpeningT,
  depthProfileForBody,
  depthStationPlanPoint,
  diningTableShape,
  diningChairSlotsMm,
  formatLength,
  gateEndpoints,
  houseExteriorPlanFill,
  houseExteriorPlanStroke,
  isCoverAccessoryId,
  isDiningSetId,
  objectFootprint,
  objectPlanSizeMm,
  resolveHouseExteriorColor,
  segmentLengthMm,
  edgeLengthMm,
  flattenClosedOutline,
  bulgeHandlePoint,
  siteLineEdgeTag,
  siteLineSegments,
  bearingToUnitVector,
  getFloridaVine,
  getFloridaPlant,
  isFloridaPlantId,
  isTrellisId,
  plantCssColor,
  vineCssColor,
  vineDisplayName,
  type Building,
  type BuildingOpening,
  type FenceGate,
  type FenceRun,
  type SiteLine,
  type GradeSample,
  type PatioCover,
  type FlowerBedRegion,
  type PlacedObject,
  type PlumbingRun,
  type PointMm,
  type PoolBody,
  type PoolFeature,
  type RetainingSegment,
  type PatioEdgeGradeResolved,
  type UnitSystem,
  resolveSpaSpillovers,
  listSpaSpilloverEdges,
  resolveInfinityEdges,
  listInfinityEdgeCandidates,
  infinityTroughPolygon,
  type SurveyUnderlay,
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

export function drawSurveyUnderlay(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  underlay: SurveyUnderlay,
  image: CanvasImageSource,
) {
  const origin = worldToScreen(underlay.origin, vp);
  const w = underlay.widthMm * vp.scale;
  const h = underlay.heightMm * vp.scale;
  if (w < 2 || h < 2) return;
  ctx.save();
  ctx.globalAlpha = underlay.opacity;
  ctx.translate(origin.x, origin.y);
  ctx.rotate((underlay.rotationDeg * Math.PI) / 180);
  ctx.drawImage(image, 0, 0, w, h);
  ctx.restore();
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
  const ring = flattenClosedOutline(outline);
  ring.forEach((p, i) => {
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
    const n = outline.length;
    const idleOff = 14 / vp.scale;
    for (let i = 0; i < n; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % n];
      const mid = worldToScreen(
        { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        vp,
      );
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#0f5c4a";
      ctx.lineWidth = 1.5;
      ctx.fillRect(mid.x - 4, mid.y - 4, 8, 8);
      ctx.strokeRect(mid.x - 4, mid.y - 4, 8, 8);
      const handle = worldToScreen(bulgeHandlePoint(a, b, idleOff), vp);
      ctx.fillStyle = Math.abs(a.bulge ?? 0) > 1e-6 ? "#e8f6f2" : "#fff";
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

export function drawFlowerBed(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  bed: FlowerBedRegion,
  selected: boolean,
  unitSystem: UnitSystem,
) {
  if (bed.outline.length < 2) return;
  const raised = bed.style === "raised";
  const stroke = raised ? "#6b4a28" : "#5a3d24";
  const fill = raised ? "rgba(92, 58, 32, 0.42)" : "rgba(110, 72, 38, 0.38)";
  drawPolygon(
    ctx,
    vp,
    bed.outline,
    selected,
    stroke,
    fill,
    unitSystem,
    selected,
    selected,
  );

  const ring = flattenClosedOutline(bed.outline);
  if (ring.length < 3) return;
  ctx.save();
  ctx.beginPath();
  ring.forEach((p, i) => {
    const c = worldToScreen(p, vp);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.closePath();
  ctx.clip();
  const xs = ring.map((p) => worldToScreen(p, vp).x);
  const ys = ring.map((p) => worldToScreen(p, vp).y);
  const minX = Math.min(...xs) - 8;
  const maxX = Math.max(...xs) + 8;
  const minY = Math.min(...ys) - 8;
  const maxY = Math.max(...ys) + 8;
  ctx.strokeStyle = raised ? "rgba(62, 38, 18, 0.35)" : "rgba(72, 46, 24, 0.55)";
  ctx.lineWidth = raised ? 1 : 1.25;
  const step = raised ? 7 : 5;
  for (let x = minX - (maxY - minY); x < maxX + (maxY - minY); x += step) {
    ctx.beginPath();
    ctx.moveTo(x, minY);
    ctx.lineTo(x + (maxY - minY), maxY);
    ctx.stroke();
  }
  ctx.restore();

  if (raised) {
    ctx.beginPath();
    ring.forEach((p, i) => {
      const c = worldToScreen(p, vp);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.strokeStyle = selected ? "#0f5c4a" : "#8a6234";
    ctx.lineWidth = selected ? 5 : 4;
    ctx.stroke();
    ctx.strokeStyle = selected ? "#d8c4a0" : "#c4a574";
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.stroke();
  }
}

/** Plan cues for spa→pool spillover weirs (editable when selected). */
export function drawSpaSpillover(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  spa: PoolBody,
  pools: PoolBody[],
  opts?: { selected?: boolean },
) {
  const selected = opts?.selected === true;
  const spills = resolveSpaSpillovers(spa, pools);
  const candidates = listSpaSpilloverEdges(spa, pools);
  if (!candidates.length && !spills.length) return;

  const drawSeg = (a: PointMm, b: PointMm, width: number, color: string) => {
    const sa = worldToScreen(a, vp);
    const sb = worldToScreen(b, vp);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
  };

  const drawHandle = (p: PointMm) => {
    const c = worldToScreen(p, vp);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#0d4f66";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  // Faint full pool-facing span for candidates (shows editable range).
  if (selected) {
    for (const edge of candidates) {
      const len =
        Math.hypot(edge.edgeB.x - edge.edgeA.x, edge.edgeB.y - edge.edgeA.y) ||
        1;
      const ux = (edge.edgeB.x - edge.edgeA.x) / len;
      const uy = (edge.edgeB.y - edge.edgeA.y) / len;
      const oa = {
        x: edge.edgeA.x + ux * edge.overlapT0,
        y: edge.edgeA.y + uy * edge.overlapT0,
      };
      const ob = {
        x: edge.edgeA.x + ux * edge.overlapT1,
        y: edge.edgeA.y + uy * edge.overlapT1,
      };
      ctx.setLineDash([6, 5]);
      drawSeg(oa, ob, 1.5, "rgba(13,79,102,0.35)");
      ctx.setLineDash([]);
    }
  }

  for (const spill of spills) {
    drawSeg(spill.a, spill.b, selected ? 6 : 5, "#7ec8e3");
    drawSeg(spill.a, spill.b, selected ? 2.5 : 2, "#0d4f66");

    const len =
      Math.hypot(spill.b.x - spill.a.x, spill.b.y - spill.a.y) || 1;
    const tx = (spill.b.x - spill.a.x) / len;
    const ty = (spill.b.y - spill.a.y) / len;
    const nx = -ty;
    const ny = tx;
    const tickMm = 180;
    for (const p of [spill.a, spill.b]) {
      drawSeg(
        { x: p.x - nx * tickMm, y: p.y - ny * tickMm },
        { x: p.x + nx * tickMm, y: p.y + ny * tickMm },
        2,
        "#0d4f66",
      );
    }

    if (spill.style === "scuppers") {
      for (const o of spill.openings) {
        drawSeg(o.a, o.b, 3.5, "#b8e6f5");
      }
    }

    if (selected) {
      drawHandle(spill.a);
      drawHandle(spill.b);
      const mid = {
        x: (spill.a.x + spill.b.x) / 2,
        y: (spill.a.y + spill.b.y) / 2,
      };
      drawHandle(mid);
    }
  }
}

/** Plan cues for pool infinity / vanishing edges + catch trough. */
export function drawInfinityEdge(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  pool: PoolBody,
  opts?: { selected?: boolean },
) {
  const selected = opts?.selected === true;
  const edges = resolveInfinityEdges(pool);
  const candidates = listInfinityEdgeCandidates(pool);
  if (!candidates.length && !edges.length) return;
  if (pool.infinityEdge?.enabled !== true) return;

  const drawSeg = (a: PointMm, b: PointMm, width: number, color: string) => {
    const sa = worldToScreen(a, vp);
    const sb = worldToScreen(b, vp);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
  };

  const drawHandle = (p: PointMm) => {
    const c = worldToScreen(p, vp);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#0f5c4a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  // Faint full-edge span when selected (editable range).
  if (selected) {
    for (const edge of candidates) {
      ctx.setLineDash([6, 5]);
      drawSeg(edge.edgeA, edge.edgeB, 1.5, "rgba(15,92,74,0.3)");
      ctx.setLineDash([]);
    }
  }

  for (const edge of edges) {
    // Catch trough outline.
    const trough = infinityTroughPolygon(edge);
    const screen = trough.map((p) => worldToScreen(p, vp));
    ctx.fillStyle = "rgba(15,92,74,0.12)";
    ctx.strokeStyle = "rgba(15,92,74,0.55)";
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(screen[0].x, screen[0].y);
    for (let i = 1; i < screen.length; i++) {
      ctx.lineTo(screen[i].x, screen[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    drawSeg(edge.a, edge.b, selected ? 6 : 5, "#7ed9c0");
    drawSeg(edge.a, edge.b, selected ? 2.5 : 2, "#0f5c4a");

    // Outward ticks toward trough.
    for (const p of [edge.a, edge.b]) {
      drawSeg(
        p,
        {
          x: p.x + edge.nx * 180,
          y: p.y + edge.ny * 180,
        },
        2,
        "#0f5c4a",
      );
    }

    if (edge.style === "scuppers") {
      for (const o of edge.openings) {
        drawSeg(o.a, o.b, 3.5, "#b8f0de");
      }
    }

    if (selected) {
      drawHandle(edge.a);
      drawHandle(edge.b);
      drawHandle({
        x: (edge.a.x + edge.b.x) / 2,
        y: (edge.a.y + edge.b.y) / 2,
      });
    }
  }
}

/** Depth axis + station handles for a selected pool. */
export function drawDepthProfile(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  body: PoolBody,
  unitSystem: UnitSystem,
) {
  const profile = depthProfileForBody(body);
  if (profile.stations.length < 2) return;
  const start = depthStationPlanPoint(body.outline, profile.axis, 0);
  const end = depthStationPlanPoint(body.outline, profile.axis, 1);
  const a = worldToScreen(start, vp);
  const b = worldToScreen(end, vp);

  ctx.save();
  ctx.strokeStyle = "rgba(15, 92, 74, 0.65)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < profile.stations.length; i++) {
    const s = profile.stations[i];
    const p = depthStationPlanPoint(body.outline, profile.axis, s.t);
    const c = worldToScreen(p, vp);
    const isEnd = i === 0 || i === profile.stations.length - 1;
    ctx.fillStyle = s.transition === "dropoff" ? "#b45309" : "#0f5c4a";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (isEnd) {
      ctx.rect(c.x - 6, c.y - 6, 12, 12);
    } else {
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    const label = formatLength(s.depthMm, unitSystem);
    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#142029";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.strokeText(label, c.x + 10, c.y - 8);
    ctx.fillText(label, c.x + 10, c.y - 8);
    if (i === 0) {
      ctx.fillStyle = "#0f5c4a";
      ctx.fillText("S", c.x + 10, c.y + 8);
    } else if (i === profile.stations.length - 1) {
      ctx.fillStyle = "#0f5c4a";
      ctx.fillText("D", c.x + 10, c.y + 8);
    }
  }
  ctx.restore();
}

export function drawFence(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  fence: FenceRun,
  selected: boolean,
  unitSystem: UnitSystem,
  showVertices: boolean,
  selectedGateId?: string | null,
) {
  if (fence.points.length < 2) return;
  // Plan stroke stays high-contrast; finish color is 3D-only.
  const stroke = selected ? "#0f5c4a" : "#3a4550";
  const isGlass = fence.kind === "glass";
  const isChain = fence.kind === "chain_link";

  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = selected ? 3.5 : isGlass ? 2.25 : 2.75;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  if (isChain) ctx.setLineDash([5, 4]);
  if (isGlass) ctx.globalAlpha = 0.85;

  ctx.beginPath();
  fence.points.forEach((p, i) => {
    const c = worldToScreen(p, vp);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Post ticks at vertices (skip glass — posts are sparse frames).
  if (!isGlass) {
    for (const p of fence.points) {
      const c = worldToScreen(p, vp);
      ctx.fillStyle = stroke;
      ctx.beginPath();
      ctx.arc(c.x, c.y, selected ? 3.5 : 2.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 1; i < fence.points.length; i++) {
    drawEdgeLabel(ctx, vp, fence.points[i - 1], fence.points[i], unitSystem);
  }

  for (const gate of fence.gates ?? []) {
    drawFenceGate(
      ctx,
      vp,
      fence.points,
      gate,
      selectedGateId === gate.id || selected,
      stroke,
    );
  }

  if (showVertices) {
    for (const p of fence.points) {
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
  ctx.restore();
}

export function drawSiteLine(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  line: SiteLine,
  selected: boolean,
  unitSystem: UnitSystem,
  showVertices: boolean,
) {
  const segs = siteLineSegments(line);
  if (segs.length === 0) return;
  const isEasement = line.kind === "easement";
  const stroke = selected ? "#0f5c4a" : isEasement ? "#6b3fa0" : "#1c2430";
  const tag = siteLineEdgeTag(line.kind);

  ctx.save();
  if (isEasement && (line.widthMm ?? 0) > 8) {
    ctx.strokeStyle = selected
      ? "rgba(15,92,74,0.22)"
      : "rgba(107,63,160,0.2)";
    ctx.lineWidth = Math.max(4, (line.widthMm ?? 0) * vp.scale);
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.beginPath();
    line.points.forEach((p, i) => {
      const c = worldToScreen(p, vp);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    if (line.closed) ctx.closePath();
    ctx.stroke();
  }

  ctx.strokeStyle = stroke;
  ctx.lineWidth = selected ? 3 : isEasement ? 2.25 : 2.5;
  ctx.setLineDash(isEasement ? [7, 5] : [12, 7]);
  ctx.beginPath();
  line.points.forEach((p, i) => {
    const c = worldToScreen(p, vp);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  if (line.closed) ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  for (const [a, b] of segs) {
    drawEdgeLabel(ctx, vp, a, b, unitSystem);
    const mid = worldToScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vp);
    ctx.font = "700 10px Source Sans 3, sans-serif";
    ctx.fillStyle = stroke;
    ctx.fillText(tag, mid.x + 6, mid.y + 12);
  }

  const verts = showVertices ? line.points : [];
  for (const p of verts) {
    const c = worldToScreen(p, vp);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#0f5c4a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFenceGate(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  points: PointMm[],
  gate: FenceGate,
  selected: boolean,
  fenceStroke: string,
) {
  const geom = gateEndpoints(points, gate);
  if (!geom) return;
  const { a, b, center, edgeA, edgeB } = geom;
  const edgeLen = segmentLengthMm(edgeA, edgeB);
  if (edgeLen < 1e-6) return;
  const ux = (edgeB.x - edgeA.x) / edgeLen;
  const uy = (edgeB.y - edgeA.y) / edgeLen;
  const nx = -uy;
  const ny = ux;
  const tickMm = gate.kind === "sliding" ? 220 : 320;
  const sa = worldToScreen(a, vp);
  const sb = worldToScreen(b, vp);
  const sc = worldToScreen(center, vp);

  // Gap in fence stroke
  ctx.strokeStyle = "#eef3f1";
  ctx.lineWidth = selected ? 6 : 5;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();

  const stroke = selected ? "#1f5f8a" : fenceStroke;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = selected ? 2.5 : 1.75;
  ctx.lineCap = "square";

  const tickA = worldToScreen(
    { x: a.x + nx * tickMm, y: a.y + ny * tickMm },
    vp,
  );
  const tickB = worldToScreen(
    { x: b.x + nx * tickMm, y: b.y + ny * tickMm },
    vp,
  );

  // Jambs
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(tickA.x, tickA.y);
  ctx.moveTo(sb.x, sb.y);
  ctx.lineTo(tickB.x, tickB.y);
  ctx.stroke();

  if (gate.kind === "sliding") {
    const offset = {
      x: ux * (segmentLengthMm(a, b) * 0.15),
      y: uy * (segmentLengthMm(a, b) * 0.15),
    };
    const p1 = worldToScreen(
      {
        x: a.x + nx * tickMm * 0.35 + offset.x,
        y: a.y + ny * tickMm * 0.35 + offset.y,
      },
      vp,
    );
    const p2 = worldToScreen(
      {
        x: b.x + nx * tickMm * 0.35 - offset.x,
        y: b.y + ny * tickMm * 0.35 - offset.y,
      },
      vp,
    );
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  } else if (gate.kind === "double_swing") {
    const mid = worldToScreen(
      { x: center.x + nx * tickMm * 0.55, y: center.y + ny * tickMm * 0.55 },
      vp,
    );
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(mid.x, mid.y);
    ctx.moveTo(sb.x, sb.y);
    ctx.lineTo(mid.x, mid.y);
    ctx.stroke();
  } else {
    // Swing arc hint
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    const swing = worldToScreen(
      { x: a.x + nx * tickMm, y: a.y + ny * tickMm },
      vp,
    );
    ctx.beginPath();
    ctx.arc(
      sa.x,
      sa.y,
      Math.hypot(sb.x - sa.x, sb.y - sa.y),
      Math.atan2(swing.y - sa.y, swing.x - sa.x),
      Math.atan2(sb.y - sa.y, sb.x - sa.x),
    );
    ctx.stroke();
  }

  if (selected) {
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, 4, 0, Math.PI * 2);
    ctx.fill();
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
  const circuitColor =
    run.circuit === "suction"
      ? "#2f6f9f"
      : run.circuit === "return"
        ? "#1f8a70"
        : run.circuit === "gas"
          ? "#b45309"
          : "#6b7280";
  ctx.strokeStyle = selected ? "#0f5c4a" : circuitColor;
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

function isWaterFixture(obj: PlacedObject): boolean {
  return (
    obj.catalogItemId === "spa_drain" ||
    obj.catalogItemId === "pool_drain" ||
    obj.catalogItemId === "pool_skimmer" ||
    obj.catalogItemId === "pool_return" ||
    obj.catalogItemId === "spa_bubbler" ||
    obj.catalogItemId === "pool_bubbler" ||
    obj.catalogItemId === "spa_jet" ||
    obj.catalogItemId === "light_standard" ||
    obj.catalogItemId === "light_color"
  );
}

function isPadEquipment(obj: PlacedObject): boolean {
  return (
    obj.catalogItemId === "equip_pad" ||
    obj.catalogItemId === "pump_variable_speed" ||
    obj.catalogItemId === "filter_cartridge" ||
    obj.catalogItemId === "heater_gas" ||
    obj.catalogItemId === "salt_chlorinator"
  );
}

export function drawPlacedObject(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  obj: PlacedObject,
  selected: boolean,
  preview = false,
) {
  const center = worldToScreen(obj.position, vp);

  if (obj.catalogItemId === "person_scale") {
    const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
    const w = obj.widthMm * vp.scale;
    const d = obj.depthMm * vp.scale;
    const headR = Math.max(3, w * 0.22);
    const sex = obj.personSex === "male" ? "male" : "female";
    const outfit =
      obj.personOutfitId === "casual" ||
      obj.personOutfitId === "athletic" ||
      obj.personOutfitId === "coverup" ||
      obj.personOutfitId === "swimsuit"
        ? obj.personOutfitId
        : "swimsuit";
    const colors =
      sex === "female"
        ? outfit === "swimsuit"
          ? { fill: "rgba(196,91,106,0.45)", stroke: "#a04555" }
          : { fill: "rgba(122,158,181,0.45)", stroke: "#4a6f85" }
        : outfit === "swimsuit"
          ? { fill: "rgba(31,79,109,0.45)", stroke: "#1f4f6d" }
          : { fill: "rgba(61,107,138,0.45)", stroke: "#3d6b8a" };
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rad);
    ctx.fillStyle = selected || preview
      ? colors.fill.replace("0.45", "0.6")
      : colors.fill;
    ctx.strokeStyle = selected || preview ? "#1f5f8a" : colors.stroke;
    ctx.lineWidth = selected ? 2.2 : 1.4;
    if (preview) ctx.setLineDash([5, 4]);
    // Shoulders / torso
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.42, d * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Head
    ctx.beginPath();
    ctx.arc(0, -d * 0.55, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Facing tick
    ctx.beginPath();
    ctx.moveTo(0, d * 0.15);
    ctx.lineTo(0, d * 0.55);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (selected || preview) {
      const hMm = obj.heightMm && obj.heightMm > 0 ? obj.heightMm : 1625.6;
      ctx.fillStyle = "rgba(20,32,41,0.8)";
      ctx.font = "10px Source Sans 3, sans-serif";
      ctx.fillText(
        formatLength(hMm, "imperial"),
        center.x + w * 0.35,
        center.y + 3,
      );
    }
    return;
  }

  if (isCoverAccessoryId(obj.catalogItemId) || obj.catalogItemId === "umbrella_sleeve") {
    const r = Math.max(
      5,
      Math.min(obj.widthMm, obj.depthMm) * vp.scale * 0.45,
    );
    const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rad);
    if (preview) ctx.setLineDash([5, 4]);
    ctx.lineWidth = selected ? 2.2 : 1.4;
    if (obj.catalogItemId === "cover_fan") {
      ctx.fillStyle = selected || preview
        ? "rgba(70,90,110,0.35)"
        : "rgba(70,90,110,0.22)";
      ctx.strokeStyle = selected || preview ? "#2a3f55" : "#4a6078";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(a) * r * 0.42,
          Math.sin(a) * r * 0.42,
          r * 0.38,
          r * 0.12,
          a,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    } else if (obj.catalogItemId === "cover_light") {
      ctx.fillStyle = selected || preview
        ? "rgba(230,200,80,0.45)"
        : "rgba(230,200,80,0.28)";
      ctx.strokeStyle = selected || preview ? "#8a6a10" : "#b89620";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (const a of [0, Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
        ctx.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = selected || preview
        ? "rgba(138,122,98,0.45)"
        : "rgba(138,122,98,0.28)";
      ctx.strokeStyle = selected || preview ? "#5a4a32" : "#8a7a62";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
    if (selected || preview) {
      ctx.fillStyle = "rgba(20,32,41,0.8)";
      ctx.font = "10px Source Sans 3, sans-serif";
      ctx.fillText(obj.name, center.x + r + 3, center.y + 3);
    }
    return;
  }

  if (isWaterFixture(obj)) {
    const r = Math.max(4, Math.min(obj.widthMm, obj.depthMm) * vp.scale * 0.45);
    const isLight =
      obj.catalogItemId === "light_standard" ||
      obj.catalogItemId === "light_color";
    const isBubbler =
      obj.catalogItemId === "spa_bubbler" ||
      obj.catalogItemId === "pool_bubbler";
    const stroke = selected || preview
      ? isLight
        ? "#8a6a10"
        : "#0f5c4a"
      : isLight
        ? obj.catalogItemId === "light_color"
          ? "#7a4aaa"
          : "#b89620"
        : "#1a6b8a";
    const fill =
      obj.catalogItemId === "spa_drain" || obj.catalogItemId === "pool_drain"
        ? "rgba(26,107,138,0.55)"
        : obj.catalogItemId === "pool_skimmer"
          ? "rgba(40,50,58,0.55)"
          : isBubbler
            ? obj.catalogItemId === "pool_bubbler"
              ? "rgba(26,160,170,0.5)"
              : "rgba(45,140,160,0.45)"
            : obj.catalogItemId === "light_color"
              ? "rgba(140,90,200,0.45)"
              : obj.catalogItemId === "light_standard"
                ? "rgba(230,200,80,0.5)"
                : "rgba(20,90,110,0.5)";
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = selected ? 2.5 : 1.5;
    if (preview) ctx.setLineDash([5, 4]);
    if (obj.catalogItemId === "pool_skimmer") {
      const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(rad);
      ctx.beginPath();
      ctx.rect(-r * 0.35, -r * 1.15, r * 0.7, r * 2.3);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (
      obj.catalogItemId === "spa_drain" ||
      obj.catalogItemId === "pool_drain"
    ) {
      ctx.beginPath();
      ctx.moveTo(center.x - r * 0.55, center.y);
      ctx.lineTo(center.x + r * 0.55, center.y);
      ctx.moveTo(center.x, center.y - r * 0.55);
      ctx.lineTo(center.x, center.y + r * 0.55);
      ctx.stroke();
    } else if (
      obj.catalogItemId === "spa_jet" ||
      obj.catalogItemId === "pool_return"
    ) {
      const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(
        center.x + Math.cos(rad) * r * 0.85,
        center.y + Math.sin(rad) * r * 0.85,
      );
      ctx.lineTo(center.x, center.y);
      ctx.stroke();
    } else if (isBubbler) {
      // Small concentric rings = rising bubbles
      ctx.beginPath();
      ctx.arc(center.x, center.y, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isLight) {
      // Rays for lights; multi-hue tick for color-changing
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(center.x + Math.cos(a) * r * 0.35, center.y + Math.sin(a) * r * 0.35);
        ctx.lineTo(center.x + Math.cos(a) * r * 0.95, center.y + Math.sin(a) * r * 0.95);
        ctx.stroke();
      }
      if (obj.catalogItemId === "light_color") {
        ctx.strokeStyle = selected || preview ? "#8a6a10" : "#2a9a8a";
        ctx.beginPath();
        ctx.arc(center.x, center.y, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Beam direction into the vessel (matches spa jet convention).
      const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(
        center.x + Math.cos(rad) * r * 1.35,
        center.y + Math.sin(rad) * r * 1.35,
      );
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (selected || preview) {
      ctx.fillStyle = "rgba(20,32,41,0.8)";
      ctx.font = "10px Source Sans 3, sans-serif";
      ctx.fillText(obj.name, center.x + r + 3, center.y + 3);
    }
    return;
  }

  if (isTrellisId(obj.catalogItemId)) {
    const vine = getFloridaVine(obj.vineId);
    const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
    const w = obj.widthMm * vp.scale;
    const d = Math.max(obj.depthMm * vp.scale, 6);
    const arbor = obj.catalogItemId === "trellis_arbor";
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rad);
    if (preview) ctx.setLineDash([5, 4]);
    const flower = vineCssColor(vine.flower);
    const leaf = vineCssColor(vine.foliage);
    ctx.fillStyle = selected || preview
      ? leaf.replace("rgb(", "rgba(").replace(")", ",0.42)")
      : leaf.replace("rgb(", "rgba(").replace(")", ",0.28)");
    ctx.strokeStyle = selected || preview ? "#4a3a22" : "#6a5438";
    ctx.lineWidth = selected ? 2.2 : 1.4;
    ctx.beginPath();
    ctx.rect(-w / 2, -d / 2, w, d);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = flower;
    ctx.lineWidth = 1.1;
    const innerW = w * 0.82;
    const innerD = d * 0.55;
    for (let i = 0; i <= 4; i++) {
      const x = -innerW / 2 + (i / 4) * innerW;
      ctx.beginPath();
      ctx.moveTo(x, -innerD / 2);
      ctx.lineTo(x, innerD / 2);
      ctx.stroke();
    }
    for (let i = 0; i <= (arbor ? 3 : 2); i++) {
      const y = -innerD / 2 + (i / (arbor ? 3 : 2)) * innerD;
      ctx.beginPath();
      ctx.moveTo(-innerW / 2, y);
      ctx.lineTo(innerW / 2, y);
      ctx.stroke();
    }
    ctx.fillStyle = flower;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 5; i++) {
      const x = -innerW * 0.35 + i * innerW * 0.175;
      ctx.beginPath();
      ctx.arc(x, 0, Math.max(1.6, w * 0.03), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.restore();
    if (selected || preview) {
      ctx.fillStyle = "rgba(20,32,41,0.8)";
      ctx.font = "10px Source Sans 3, sans-serif";
      ctx.fillText(
        vineDisplayName(vine),
        center.x + w * 0.4,
        center.y + 3,
      );
    }
    return;
  }

  if (isFloridaPlantId(obj.catalogItemId)) {
    const plant = getFloridaPlant(obj.catalogItemId);
    if (plant) {
      const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
      const w = obj.widthMm * vp.scale;
      const d = obj.depthMm * vp.scale;
      const rx = Math.max(4, w * 0.48);
      const ry = Math.max(4, d * 0.48);
      const leaf = plantCssColor(plant.foliage);
      const flower = plant.flower ? plantCssColor(plant.flower) : leaf;
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(rad);
      if (preview) ctx.setLineDash([5, 4]);
      ctx.fillStyle = selected || preview
        ? leaf.replace("rgb(", "rgba(").replace(")", ",0.42)")
        : leaf.replace("rgb(", "rgba(").replace(")", ",0.28)");
      ctx.strokeStyle = selected || preview ? "#2a4a32" : "#3d6b45";
      ctx.lineWidth = selected ? 2.2 : 1.4;
      ctx.beginPath();
      if (plant.group === "palms") {
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * rx * 0.92, Math.sin(a) * ry * 0.92);
        }
        ctx.stroke();
        ctx.fillStyle = selected ? "#5a4a32" : "#6a5a40";
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2, Math.min(rx, ry) * 0.12), 0, Math.PI * 2);
        ctx.fill();
      } else if (plant.group === "tropical" || plant.group === "shrubs") {
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (plant.flower) {
          ctx.fillStyle = flower;
          ctx.globalAlpha = 0.85;
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            ctx.beginPath();
            ctx.arc(
              Math.cos(a) * rx * 0.35,
              Math.sin(a) * ry * 0.35,
              Math.max(1.4, Math.min(rx, ry) * 0.12),
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      } else {
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = selected ? "#5a4a32" : "#6a5a40";
        ctx.beginPath();
        ctx.rect(-Math.min(rx, ry) * 0.08, 0, Math.min(rx, ry) * 0.16, ry * 0.55);
        ctx.fill();
      }
      ctx.setLineDash([]);
      ctx.restore();
      if (selected || preview) {
        ctx.fillStyle = "rgba(20,32,41,0.8)";
        ctx.font = "10px Source Sans 3, sans-serif";
        ctx.fillText(plant.name, center.x + rx + 3, center.y + 3);
      }
      return;
    }
  }

  const outline = objectFootprint(obj);
  ctx.beginPath();
  outline.forEach((p, i) => {
    const c = worldToScreen(p, vp);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.closePath();
  const pad = isPadEquipment(obj);
  const dining = isDiningSetId(obj.catalogItemId);
  ctx.fillStyle = pad
    ? preview
      ? "rgba(70,90,110,0.22)"
      : "rgba(70,90,110,0.32)"
    : preview
      ? "rgba(196,122,44,0.25)"
      : "rgba(196,122,44,0.35)";
  ctx.fill();
  ctx.strokeStyle = pad
    ? selected || preview
      ? "#2a3f55"
      : "#4a6078"
    : selected || preview
      ? "#8a4f12"
      : "#c47a2c";
  ctx.lineWidth = selected ? 2.5 : 1.5;
  if (preview) ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Pad equipment: simple plan icons so pieces read as pump / filter / heater / cell.
  if (pad && !preview) {
    const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
    const w = obj.widthMm * vp.scale;
    const d = obj.depthMm * vp.scale;
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rad);
    ctx.strokeStyle = selected ? "#1a2838" : "#3a5068";
    ctx.fillStyle = selected ? "rgba(30,50,70,0.55)" : "rgba(50,70,90,0.45)";
    ctx.lineWidth = 1.4;
    const id = obj.catalogItemId;
    if (id === "equip_pad") {
      ctx.beginPath();
      ctx.rect(-w * 0.42, -d * 0.42, w * 0.84, d * 0.84);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -d * 0.4);
      ctx.lineTo(0, d * 0.4);
      ctx.stroke();
    } else if (id === "pump_variable_speed") {
      ctx.beginPath();
      ctx.ellipse(-w * 0.18, 0, w * 0.22, d * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(w * 0.02, -d * 0.22, w * 0.32, d * 0.44);
      ctx.fill();
      ctx.stroke();
    } else if (id === "filter_cartridge") {
      const r = Math.min(w, d) * 0.32;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    } else if (id === "heater_gas") {
      ctx.beginPath();
      ctx.rect(-w * 0.35, -d * 0.35, w * 0.7, d * 0.7);
      ctx.fill();
      ctx.stroke();
      for (const x of [-0.18, 0, 0.18]) {
        ctx.beginPath();
        ctx.moveTo(w * x, -d * 0.28);
        ctx.lineTo(w * x, d * 0.28);
        ctx.stroke();
      }
    } else if (id === "salt_chlorinator") {
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.38, d * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(-w * 0.12, -d * 0.12, w * 0.24, d * 0.24);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Dining: draw tabletop inside the larger chair-clearance footprint.
  if (dining) {
    const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
    const shape = diningTableShape(obj.catalogItemId);
    const slots = diningChairSlotsMm(shape, obj.widthMm, obj.depthMm);
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rad);
    ctx.strokeStyle = selected || preview ? "#6a3a0a" : "#a06028";
    ctx.lineWidth = selected ? 1.8 : 1.2;
    if (shape === "round") {
      const r = (Math.max(obj.widthMm, obj.depthMm) / 2) * vp.scale;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const hw = (obj.widthMm / 2) * vp.scale;
      const hd = (obj.depthMm / 2) * vp.scale;
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
    }
    // Chair footprints around the tabletop
    const chairW = 16 * vp.scale;
    const chairD = 14 * vp.scale;
    ctx.fillStyle = selected
      ? "rgba(120,70,30,0.45)"
      : "rgba(160,100,50,0.35)";
    ctx.strokeStyle = selected || preview ? "#6a3a0a" : "#8a5a28";
    ctx.lineWidth = 1;
    for (const s of slots) {
      const x = s.xMm * vp.scale;
      const y = s.yMm * vp.scale;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.yawRad);
      ctx.beginPath();
      ctx.rect(-chairW / 2, -chairD / 2, chairW, chairD);
      ctx.fill();
      ctx.stroke();
      // Seat back tick
      ctx.beginPath();
      ctx.moveTo(-chairW * 0.4, -chairD * 0.45);
      ctx.lineTo(chairW * 0.4, -chairD * 0.45);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  ctx.fillStyle = "rgba(20,32,41,0.8)";
  ctx.font = "11px Source Sans 3, sans-serif";
  ctx.fillText(obj.name, center.x - 24, center.y + 4);

  if (selected && !preview) {
    const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
    const plan = objectPlanSizeMm(obj);
    const dist = plan.depthMm / 2 + 400;
    const handle = worldToScreen(
      {
        x: obj.position.x - Math.sin(rad) * dist,
        y: obj.position.y - Math.cos(rad) * dist,
      },
      vp,
    );
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

export function drawGradeSample(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  sample: GradeSample,
  selected: boolean,
  unitSystem: UnitSystem,
  showRotateHandle = selected,
) {
  const c = worldToScreen(sample.position, vp);
  const r = selected ? 7 : 5.5;
  // Same heading as the walk / rotation handle (0° = up on the plan).
  const heading = bearingToUnitVector(sample.rotationDeg || 0);
  const along =
    sample.dropMm >= 0 ? heading : { x: -heading.x, y: -heading.y };
  ctx.save();
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = selected ? "#1f6b8a" : "#2a7a9a";
  ctx.fill();
  ctx.strokeStyle = selected ? "#0d3a4a" : "#1a5a6a";
  ctx.lineWidth = selected ? 2.2 : 1.4;
  ctx.stroke();
  ctx.beginPath();
  const tail = 12;
  const tip = 14;
  const barb = 5;
  const hx = along.x * tip;
  const hy = along.y * tip;
  const px = -along.y;
  const py = along.x;
  ctx.moveTo(c.x - along.x * tail, c.y - along.y * tail);
  ctx.lineTo(c.x + hx, c.y + hy);
  ctx.moveTo(c.x + hx - along.x * barb + px * 4, c.y + hy - along.y * barb + py * 4);
  ctx.lineTo(c.x + hx, c.y + hy);
  ctx.lineTo(c.x + hx - along.x * barb - px * 4, c.y + hy - along.y * barb - py * 4);
  ctx.stroke();
  const label =
    sample.dropMm >= 0
      ? `↓ ${formatLength(sample.dropMm, unitSystem)}`
      : `↑ ${formatLength(-sample.dropMm, unitSystem)}`;
  ctx.fillStyle = "rgba(20,32,41,0.85)";
  ctx.font = "11px Source Sans 3, sans-serif";
  ctx.fillText(label, c.x + 10, c.y + 4);

  if (showRotateHandle) {
    const dist = 600 * vp.scale;
    const handle = {
      x: c.x + heading.x * dist,
      y: c.y + heading.y * dist,
    };
    ctx.strokeStyle = "#1a5a6a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(handle.x, handle.y);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRetainingEdges(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  segments: RetainingSegment[],
) {
  if (!segments.length) return;
  ctx.save();
  ctx.strokeStyle = "#8a3a1a";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  for (const seg of segments) {
    const a = worldToScreen(seg.a, vp);
    const b = worldToScreen(seg.b, vp);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPatioGradeEdges(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  edges: PatioEdgeGradeResolved[],
  opts?: { selected?: boolean },
) {
  if (!edges.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.font = "11px Source Sans 3, sans-serif";
  for (const edge of edges) {
    const a = worldToScreen(edge.a, vp);
    const b = worldToScreen(edge.b, vp);
    if (edge.grade === "retaining") {
      ctx.strokeStyle = "#8a3a1a";
      ctx.lineWidth = 3.6;
      ctx.setLineDash([]);
    } else if (edge.grade === "fill") {
      ctx.strokeStyle = "#b0894a";
      ctx.lineWidth = 2.4;
      ctx.setLineDash([7, 5]);
    } else {
      if (!opts?.selected) continue;
      ctx.strokeStyle = "rgba(80,110,90,0.55)";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([3, 5]);
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    if (opts?.selected) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const label =
        edge.grade === "retaining"
          ? "Wall"
          : edge.grade === "fill"
            ? "Fill"
            : "Open";
      ctx.setLineDash([]);
      ctx.fillStyle =
        edge.grade === "retaining"
          ? "#8a3a1a"
          : edge.grade === "fill"
            ? "#7a5a28"
            : "#3d5c48";
      ctx.fillText(label, mx + 6, my - 6);
    }
  }
  ctx.restore();
}

export function drawPatioCover(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  cover: PatioCover,
  selected: boolean,
  unitSystem: UnitSystem,
  selectedSupportId?: string | null,
) {
  const isPergola = cover.kind !== "roof";
  drawPolygon(
    ctx,
    vp,
    cover.outline,
    selected && !selectedSupportId,
    selected && !selectedSupportId
      ? "#6b4f2a"
      : isPergola
        ? "#8a6a3a"
        : "#5c5346",
    // Solid roofs read opaque on plan; pergolas stay light lattice fill.
    isPergola ? "rgba(138,106,58,0.18)" : "rgba(70,64,56,0.55)",
    unitSystem,
    true,
    selected && !selectedSupportId,
  );
  // Pergola lattice hint
  if (isPergola && cover.outline.length >= 4) {
    ctx.save();
    ctx.beginPath();
    cover.outline.forEach((p, i) => {
      const c = worldToScreen(p, vp);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = "rgba(107,79,42,0.35)";
    ctx.lineWidth = 1;
    const a = worldToScreen(cover.outline[0], vp);
    const b = worldToScreen(cover.outline[2] ?? cover.outline[1], vp);
    const minX = Math.min(a.x, b.x) - 20;
    const maxX = Math.max(a.x, b.x) + 20;
    const minY = Math.min(a.y, b.y) - 20;
    const maxY = Math.max(a.y, b.y) + 20;
    for (let x = minX; x < maxX; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x, maxY);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const support of cover.supports ?? []) {
    const foot =
      support.footingSizeMm && support.footingSizeMm > 0
        ? support.footingSizeMm
        : 406.4;
    const post =
      support.postSizeMm && support.postSizeMm > 0
        ? support.postSizeMm
        : 152.4;
    const sc = worldToScreen(support.position, vp);
    const footPx = Math.max(6, (foot * vp.scale) / 2);
    const postPx = Math.max(3, (post * vp.scale) / 2);
    const active = selectedSupportId === support.id;
    ctx.fillStyle = active ? "rgba(31,95,138,0.35)" : "rgba(160,150,130,0.55)";
    ctx.strokeStyle = active ? "#1f5f8a" : "#5c5346";
    ctx.lineWidth = active ? 2 : 1.25;
    ctx.beginPath();
    ctx.rect(sc.x - footPx, sc.y - footPx, footPx * 2, footPx * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = active ? "#3d6f8f" : "#6b5340";
    ctx.fillRect(sc.x - postPx, sc.y - postPx, postPx * 2, postPx * 2);
  }

  if (cover.outline.length) {
    let cx = 0;
    let cy = 0;
    for (const p of cover.outline) {
      cx += p.x;
      cy += p.y;
    }
    cx /= cover.outline.length;
    cy /= cover.outline.length;
    const c = worldToScreen({ x: cx, y: cy }, vp);
    ctx.fillStyle = "rgba(20,32,41,0.85)";
    ctx.font = "11px Source Sans 3, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(cover.name, c.x, c.y);
    ctx.textAlign = "start";
  }
}

/** Drop duplicate closing vertex so edge indices match open-ring wall loops. */
/** Open footprint ring (duplicate closing vertex stripped). */
export function openOutlineRing(outline: PointMm[]): PointMm[] {
  if (outline.length < 2) return outline;
  const first = outline[0];
  const last = outline[outline.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) < 1) {
    return outline.slice(0, -1);
  }
  return outline;
}

/**
 * Map a stored opening.edgeIndex onto the open footprint ring.
 * Closed outlines (duplicate end point) otherwise shift wall cuts vs glass.
 */
export function resolveOpeningEdge(
  outline: PointMm[],
  edgeIndex: number,
): { ring: PointMm[]; edgeIndex: number; edgeA: PointMm; edgeB: PointMm; edgeLen: number } | null {
  const ring = openOutlineRing(outline);
  const n = ring.length;
  if (n < 2) return null;

  const rawN = outline.length;
  const rawA = outline[((edgeIndex % rawN) + rawN) % rawN];
  const rawB = outline[(((edgeIndex + 1) % rawN) + rawN) % rawN];
  const rawLen = segmentLengthMm(rawA, rawB);

  let bestI = ((edgeIndex % n) + n) % n;
  if (rawLen >= 1) {
    let bestScore = Infinity;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      const d =
        Math.hypot(a.x - rawA.x, a.y - rawA.y) +
        Math.hypot(b.x - rawB.x, b.y - rawB.y);
      const dRev =
        Math.hypot(a.x - rawB.x, a.y - rawB.y) +
        Math.hypot(b.x - rawA.x, b.y - rawA.y);
      const score = Math.min(d, dRev);
      if (score < bestScore) {
        bestScore = score;
        bestI = i;
      }
    }
  } else {
    // Degenerate closing edge — treat as the last real wall.
    bestI = n - 1;
  }

  const edgeA = ring[bestI];
  const edgeB = ring[(bestI + 1) % n];
  const edgeLen = segmentLengthMm(edgeA, edgeB);
  if (edgeLen < 1e-6) return null;
  return { ring, edgeIndex: bestI, edgeA, edgeB, edgeLen };
}

export function openingEndpoints(
  outline: PointMm[],
  opening: BuildingOpening,
): { a: PointMm; b: PointMm; center: PointMm; edgeA: PointMm; edgeB: PointMm } | null {
  const resolved = resolveOpeningEdge(outline, opening.edgeIndex);
  if (!resolved) return null;
  const { edgeA, edgeB, edgeLen } = resolved;
  const t = clampOpeningT(edgeLen, opening.widthMm, opening.t);
  const half = Math.min(opening.widthMm / 2, edgeLen / 2);
  const ux = (edgeB.x - edgeA.x) / edgeLen;
  const uy = (edgeB.y - edgeA.y) / edgeLen;
  const center = {
    x: edgeA.x + (edgeB.x - edgeA.x) * t,
    y: edgeA.y + (edgeB.y - edgeA.y) * t,
  };
  return {
    edgeA,
    edgeB,
    center,
    a: { x: center.x - ux * half, y: center.y - uy * half },
    b: { x: center.x + ux * half, y: center.y + uy * half },
  };
}

export function drawBuildingOpening(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  outline: PointMm[],
  opening: BuildingOpening,
  selected: boolean,
) {
  const geom = openingEndpoints(outline, opening);
  if (!geom) return;
  const { a, b, center, edgeA, edgeB } = geom;
  const edgeLen = segmentLengthMm(edgeA, edgeB);
  if (edgeLen < 1e-6) return;
  const ux = (edgeB.x - edgeA.x) / edgeLen;
  const uy = (edgeB.y - edgeA.y) / edgeLen;
  // Outward-ish perpendicular (screen-independent); flip for swing tick.
  const nx = -uy;
  const ny = ux;
  const tickMm = opening.kind === "window" ? 180 : 350;
  const sa = worldToScreen(a, vp);
  const sb = worldToScreen(b, vp);
  const sc = worldToScreen(center, vp);
  const tickA = worldToScreen(
    { x: a.x + nx * tickMm, y: a.y + ny * tickMm },
    vp,
  );
  const tickB = worldToScreen(
    { x: b.x + nx * tickMm, y: b.y + ny * tickMm },
    vp,
  );

  // Cover wall stroke with background so the opening reads as a gap.
  ctx.strokeStyle = "#eef3f1";
  ctx.lineWidth = selected ? 5 : 4;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();

  const stroke = selected
    ? "#1f5f8a"
    : opening.kind === "window"
      ? "#3d6f8f"
      : "#2f4a3a";
  ctx.strokeStyle = stroke;
  ctx.lineWidth = selected ? 2.5 : 1.75;
  ctx.lineCap = "square";

  // End jambs
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(tickA.x, tickA.y);
  ctx.moveTo(sb.x, sb.y);
  ctx.lineTo(tickB.x, tickB.y);
  ctx.stroke();

  if (opening.kind === "window") {
    // Sill + mullion
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.moveTo(sc.x, sc.y);
    ctx.lineTo(
      worldToScreen({ x: center.x + nx * tickMm * 0.7, y: center.y + ny * tickMm * 0.7 }, vp).x,
      worldToScreen({ x: center.x + nx * tickMm * 0.7, y: center.y + ny * tickMm * 0.7 }, vp).y,
    );
    ctx.stroke();
  } else if (opening.kind === "sliding_door") {
    // Double track / panels
    const mid = {
      x: center.x + nx * tickMm * 0.45,
      y: center.y + ny * tickMm * 0.45,
    };
    const sm = worldToScreen(mid, vp);
    const offset = {
      x: ux * (segmentLengthMm(a, b) * 0.12),
      y: uy * (segmentLengthMm(a, b) * 0.12),
    };
    const p1 = worldToScreen(
      { x: a.x + nx * tickMm * 0.2 + offset.x, y: a.y + ny * tickMm * 0.2 + offset.y },
      vp,
    );
    const p2 = worldToScreen(
      { x: b.x + nx * tickMm * 0.2 - offset.x, y: b.y + ny * tickMm * 0.2 - offset.y },
      vp,
    );
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(sm.x, sm.y);
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(sm.x, sm.y);
    ctx.stroke();
  } else {
    // Swing door arc hint
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    const hinge = a;
    const swing = worldToScreen(
      {
        x: hinge.x + nx * tickMm + ux * (segmentLengthMm(a, b) * 0.85),
        y: hinge.y + ny * tickMm + uy * (segmentLengthMm(a, b) * 0.85),
      },
      vp,
    );
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.quadraticCurveTo(
      worldToScreen({ x: hinge.x + nx * tickMm, y: hinge.y + ny * tickMm }, vp).x,
      worldToScreen({ x: hinge.x + nx * tickMm, y: hinge.y + ny * tickMm }, vp).y,
      swing.x,
      swing.y,
    );
    ctx.stroke();
  }

  if (selected) {
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const story = opening.story ?? 1;
  if (story > 1) {
    ctx.fillStyle = selected ? stroke : "rgba(20,32,41,0.72)";
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`L${story}`, sc.x, sc.y - 6);
  }
}

export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  building: Building,
  selected: boolean,
  unitSystem: UnitSystem,
  selectedOpeningId?: string | null,
  /** When set, only draw openings on this story (1 = ground). */
  planStoryFilter?: number | "all" | null,
) {
  const exterior = resolveHouseExteriorColor(
    building.exteriorFinishId,
    building.exteriorColor,
  );
  drawPolygon(
    ctx,
    vp,
    building.outline,
    selected,
    houseExteriorPlanStroke(exterior, selected),
    houseExteriorPlanFill(exterior),
    unitSystem,
    true,
    selected,
  );
  const stories = Math.max(1, building.stories || 1);
  for (const opening of building.openings ?? []) {
    if (
      planStoryFilter != null &&
      planStoryFilter !== "all" &&
      clampOpeningStory(opening.story, stories) !== planStoryFilter
    ) {
      continue;
    }
    drawBuildingOpening(
      ctx,
      vp,
      building.outline,
      opening,
      selectedOpeningId === opening.id,
    );
  }
  if (building.outline.length) {
    let cx = 0;
    let cy = 0;
    for (const p of building.outline) {
      cx += p.x;
      cy += p.y;
    }
    cx /= building.outline.length;
    cy /= building.outline.length;
    const c = worldToScreen({ x: cx, y: cy }, vp);
    const stories = Math.max(1, building.stories || 1);
    ctx.fillStyle = "rgba(20,32,41,0.85)";
    ctx.font = "12px Source Sans 3, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `${building.name} · ${stories}-stor${stories === 1 ? "y" : "ies"}`,
      c.x,
      c.y,
    );
    ctx.textAlign = "start";
  }
  if (
    building.roof?.style === "pitched" ||
    (building.roof?.ridges?.length ?? 0) > 0
  ) {
    drawBuildingRoofRidges(ctx, vp, building, selected);
  }
}

export function drawBuildingRoofRidges(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  building: Building,
  selected: boolean,
) {
  const ridges = building.roof?.ridges ?? [];
  for (const ridge of ridges) {
    if (ridge.points.length < 2) continue;
    ctx.save();
    ctx.strokeStyle = selected ? "#7a2f1a" : "#8a4a2a";
    ctx.lineWidth = selected ? 2.75 : 2;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    ridge.points.forEach((p, i) => {
      const c = worldToScreen(p, vp);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    const mid = ridge.points[Math.floor(ridge.points.length / 2)]!;
    const mc = worldToScreen(mid, vp);
    ctx.fillStyle = selected ? "#7a2f1a" : "rgba(122,47,26,0.9)";
    ctx.font = "11px Source Sans 3, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Ridge", mc.x, mc.y - 8);
    if (selected) {
      for (const p of ridge.points) {
        const c = worldToScreen(p, vp);
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#7a2f1a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

export function drawFeature(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  feature: PoolFeature,
  selected: boolean,
  unitSystem: UnitSystem,
) {
  const stroke =
    feature.kind === "steps"
      ? "#2f6f9f"
      : feature.kind === "sunshelf"
        ? "#1a8a9a"
        : "#6b4f9a";
  const fill =
    feature.kind === "steps"
      ? "rgba(47,111,159,0.28)"
      : feature.kind === "sunshelf"
        ? "rgba(26,138,154,0.32)"
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
  // Sunshelf: light hatch to read as a shallow ledge
  if (feature.kind === "sunshelf" && feature.outline.length >= 3) {
    ctx.save();
    ctx.beginPath();
    feature.outline.forEach((p, i) => {
      const c = worldToScreen(p, vp);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = "rgba(26,138,154,0.35)";
    ctx.lineWidth = 1;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of feature.outline) {
      const c = worldToScreen(p, vp);
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y);
    }
    for (let x = minX - (maxY - minY); x < maxX + (maxY - minY); x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x + (maxY - minY), maxY);
      ctx.stroke();
    }
    ctx.restore();
  }
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
  const len = edgeLengthMm(a, b);
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
    if (closePreview && points.length >= 3) {
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

/** Screen-space north arrow. `northDeg` is clockwise from drawing-up. */
export function drawNorthArrow(
  ctx: CanvasRenderingContext2D,
  width: number,
  northDeg = 0,
) {
  const cx = width - 28;
  const cy = 32;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((northDeg * Math.PI) / 180);
  ctx.fillStyle = "#152018";
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(-6, 10);
  ctx.lineTo(0, 4);
  ctx.lineTo(6, 10);
  ctx.closePath();
  ctx.fill();
  ctx.font = "700 11px Source Sans 3, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 0, -22);
  ctx.restore();
}
