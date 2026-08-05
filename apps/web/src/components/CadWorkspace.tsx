"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DESIGN_LEVEL_LABELS,
  formatLength,
  polylineLengthMm,
  segmentLengthMm,
  snapMm,
  type DesignDocument,
  type DesignLevel,
  type PointMm,
  type PlumbingRun,
  type UnitSystem,
} from "@pool-design/shared";

type Tool = "select" | "plumbing";

type Props = {
  projectId: string;
  projectName: string;
  designLevel: DesignLevel;
  unitSystem: UnitSystem;
  initialDesign: DesignDocument;
};

const PX_PER_MM = 0.05; // 20mm per pixel → ~1" ≈ 1.27px; zoomable later
const ORIGIN = { x: 80, y: 80 };

function toCanvas(p: PointMm) {
  return { x: ORIGIN.x + p.x * PX_PER_MM, y: ORIGIN.y + p.y * PX_PER_MM };
}

function fromCanvas(x: number, y: number, unitSystem: UnitSystem): PointMm {
  return {
    x: snapMm((x - ORIGIN.x) / PX_PER_MM, unitSystem),
    y: snapMm((y - ORIGIN.y) / PX_PER_MM, unitSystem),
  };
}

function applyOrtho(from: PointMm, to: PointMm): PointMm {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx >= dy) return { x: to.x, y: from.y };
  return { x: from.x, y: to.y };
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function CadWorkspace({
  projectId,
  projectName,
  designLevel,
  unitSystem,
  initialDesign,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [design, setDesign] = useState<DesignDocument>(initialDesign);
  const [tool, setTool] = useState<Tool>("plumbing");
  const [ortho, setOrtho] = useState(true);
  const [draftPoints, setDraftPoints] = useState<PointMm[]>([]);
  const [cursor, setCursor] = useState<PointMm | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const activeRun = useMemo(
    () => design.plumbingRuns.find((r) => r.id === selectedRunId) ?? null,
    [design.plumbingRuns, selectedRunId],
  );

  const previewPoint = cursor;

  const draftSegmentMm =
    draftPoints.length > 0 && previewPoint
      ? segmentLengthMm(draftPoints[draftPoints.length - 1], previewPoint)
      : 0;

  const draftTotalMm =
    polylineLengthMm(draftPoints) +
    (draftPoints.length > 0 && previewPoint ? draftSegmentMm : 0);

  const selectedTotalMm = activeRun ? polylineLengthMm(activeRun.points) : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#eef3f1";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // grid every 1 foot / 250mm-ish
    const gridMm = unitSystem === "imperial" ? 304.8 : 250;
    ctx.strokeStyle = "rgba(20,32,41,0.06)";
    ctx.lineWidth = 1;
    for (let x = ORIGIN.x; x < rect.width; x += gridMm * PX_PER_MM) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    for (let y = ORIGIN.y; y < rect.height; y += gridMm * PX_PER_MM) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }

    // sample pool rectangle if empty visual cue
    if (design.poolBodies.length === 0) {
      ctx.strokeStyle = "rgba(31,138,112,0.35)";
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(
        toCanvas({ x: 0, y: 0 }).x,
        toCanvas({ x: 0, y: 0 }).y,
        6096 * PX_PER_MM,
        3658 * PX_PER_MM,
      );
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(31,138,112,0.55)";
      ctx.font = "14px Source Sans 3, sans-serif";
      ctx.fillText("Sample 20' × 12' pool guide", ORIGIN.x + 8, ORIGIN.y - 12);
    }

    for (const run of design.plumbingRuns) {
      drawRun(ctx, run, run.id === selectedRunId);
    }

    if (draftPoints.length) {
      ctx.strokeStyle = "#146353";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      draftPoints.forEach((p, i) => {
        const c = toCanvas(p);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      if (previewPoint) {
        const c = toCanvas(previewPoint);
        ctx.lineTo(c.x, c.y);
      }
      ctx.stroke();
      for (const p of draftPoints) {
        const c = toCanvas(p);
        ctx.fillStyle = "#146353";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [design, draftPoints, previewPoint, selectedRunId, unitSystem]);

  async function persist(next: DesignDocument) {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function commitPlumbingRun() {
    if (draftPoints.length < 2) {
      setDraftPoints([]);
      return;
    }
    const run: PlumbingRun = {
      id: newId("run"),
      name: `Run ${design.plumbingRuns.length + 1}`,
      circuit: "return",
      points: draftPoints,
    };
    const next = {
      ...design,
      plumbingRuns: [...design.plumbingRuns, run],
    };
    setDesign(next);
    setSelectedRunId(run.id);
    setDraftPoints([]);
    void persist(next);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || tool !== "plumbing") return;
    const rect = canvas.getBoundingClientRect();
    let point = fromCanvas(e.clientX - rect.left, e.clientY - rect.top, unitSystem);
    const useOrtho = ortho || e.shiftKey;
    if (useOrtho && draftPoints.length > 0) {
      point = applyOrtho(draftPoints[draftPoints.length - 1], point);
    }
    setDraftPoints((pts) => [...pts, point]);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let point = fromCanvas(e.clientX - rect.left, e.clientY - rect.top, unitSystem);
    const useOrtho = ortho || e.shiftKey;
    if (useOrtho && draftPoints.length > 0) {
      point = applyOrtho(draftPoints[draftPoints.length - 1], point);
    }
    setCursor(point);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setDraftPoints([]);
    }
    if (e.key === "Enter") {
      commitPlumbingRun();
    }
    if (e.key === "o" || e.key === "O") {
      setOrtho((v) => !v);
    }
    if ((e.key === "Shift" || e.code === "ShiftLeft") && !ortho) {
      // hold-shift feel: already using toggle; Shift also forces ortho while drawing via flag
    }
  }

  return (
    <div className="cad-layout" onKeyDown={onKeyDown} tabIndex={0}>
      <aside className="panel stack">
        <div>
          <div className="muted">Project</div>
          <strong>{projectName}</strong>
          <div>
            <span className="badge">{DESIGN_LEVEL_LABELS[designLevel]}</span>
          </div>
        </div>
        <div className="cad-toolbar">
          <button
            type="button"
            className={`btn ${tool === "plumbing" ? "" : "secondary"}`}
            onClick={() => setTool("plumbing")}
          >
            Plumbing line
          </button>
          <button
            type="button"
            className={`btn ${ortho ? "" : "secondary"}`}
            onClick={() => setOrtho((v) => !v)}
          >
            Ortho {ortho ? "ON" : "OFF"}
          </button>
        </div>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Click to place straight segments. Hold direction with Ortho for
          horizontal/vertical. Enter finishes the run, Esc cancels. Press O to
          toggle ortho.
        </p>
        <button
          type="button"
          className="btn secondary"
          onClick={commitPlumbingRun}
          disabled={draftPoints.length < 2}
        >
          Finish run
        </button>
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          Units: {unitSystem} · Snap:{" "}
          {unitSystem === "imperial" ? '1/32"' : "1 mm"}
          <br />
          Save: {saveState}
        </div>
      </aside>

      <section className="panel" style={{ padding: "0.85rem" }}>
        <div className="cad-canvas-wrap">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onDoubleClick={commitPlumbingRun}
          />
          <div className="hud">
            <div>
              Segment:{" "}
              {draftPoints.length > 0
                ? formatLength(draftSegmentMm, unitSystem)
                : "—"}
            </div>
            <div>
              Run total:{" "}
              {draftPoints.length > 0
                ? formatLength(draftTotalMm, unitSystem)
                : activeRun
                  ? formatLength(selectedTotalMm, unitSystem)
                  : "—"}
            </div>
          </div>
        </div>
      </section>

      <aside className="panel stack">
        <h2>Plumbing runs</h2>
        {design.plumbingRuns.length === 0 && (
          <p className="muted">No runs yet. Draw a polyline on the canvas.</p>
        )}
        {design.plumbingRuns.map((run) => {
          const total = polylineLengthMm(run.points);
          return (
            <button
              key={run.id}
              type="button"
              className="card-link"
              style={{
                textAlign: "left",
                borderColor: run.id === selectedRunId ? "var(--accent)" : undefined,
              }}
              onClick={() => setSelectedRunId(run.id)}
            >
              <strong>{run.name}</strong>
              <div className="muted">{run.circuit}</div>
              <div>{formatLength(total, unitSystem)}</div>
            </button>
          );
        })}
      </aside>
    </div>
  );
}

function drawRun(
  ctx: CanvasRenderingContext2D,
  run: PlumbingRun,
  selected: boolean,
) {
  if (run.points.length < 2) return;
  ctx.strokeStyle = selected ? "#0f5c4a" : "#1f8a70";
  ctx.lineWidth = selected ? 3 : 2;
  ctx.beginPath();
  run.points.forEach((p, i) => {
    const c = toCanvas(p);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.stroke();
}
