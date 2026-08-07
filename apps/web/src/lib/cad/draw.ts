import {
  clampOpeningT,
  depthProfileForBody,
  depthStationPlanPoint,
  diningTableShape,
  formatLength,
  isDiningSetId,
  objectFootprint,
  objectPlanSizeMm,
  segmentLengthMm,
  type Building,
  type BuildingOpening,
  type PatioCover,
  type PlacedObject,
  type PlumbingRun,
  type PointMm,
  type PoolBody,
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
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rad);
    ctx.fillStyle = selected || preview
      ? "rgba(61,107,138,0.55)"
      : "rgba(61,107,138,0.4)";
    ctx.strokeStyle = selected || preview ? "#1f5f8a" : "#3d6b8a";
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
      ctx.fillStyle = "rgba(20,32,41,0.8)";
      ctx.font = "10px Source Sans 3, sans-serif";
      ctx.fillText("5′8″", center.x + w * 0.35, center.y + 3);
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
      obj.catalogItemId === "spa_drain"
        ? "rgba(26,107,138,0.55)"
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
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (obj.catalogItemId === "spa_drain") {
      ctx.beginPath();
      ctx.moveTo(center.x - r * 0.55, center.y);
      ctx.lineTo(center.x + r * 0.55, center.y);
      ctx.moveTo(center.x, center.y - r * 0.55);
      ctx.lineTo(center.x, center.y + r * 0.55);
      ctx.stroke();
    } else if (obj.catalogItemId === "spa_jet") {
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
    }
    ctx.setLineDash([]);
    if (selected || preview) {
      ctx.fillStyle = "rgba(20,32,41,0.8)";
      ctx.font = "10px Source Sans 3, sans-serif";
      ctx.fillText(obj.name, center.x + r + 3, center.y + 3);
    }
    return;
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

  // Dining: draw tabletop inside the larger chair-clearance footprint.
  if (dining) {
    const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
    const shape = diningTableShape(obj.catalogItemId);
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

export function openingEndpoints(
  outline: PointMm[],
  opening: BuildingOpening,
): { a: PointMm; b: PointMm; center: PointMm; edgeA: PointMm; edgeB: PointMm } | null {
  if (outline.length < 2) return null;
  const n = outline.length;
  const edgeIndex = ((opening.edgeIndex % n) + n) % n;
  const edgeA = outline[edgeIndex];
  const edgeB = outline[(edgeIndex + 1) % n];
  const edgeLen = segmentLengthMm(edgeA, edgeB);
  if (edgeLen < 1e-6) return null;
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
) {
  drawPolygon(
    ctx,
    vp,
    building.outline,
    selected,
    selected ? "#5c4a3a" : "#7a6550",
    "rgba(122,101,80,0.35)",
    unitSystem,
    true,
    selected,
  );
  for (const opening of building.openings ?? []) {
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
