"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_POOL_DEEP_MM,
  DEFAULT_POOL_SHALLOW_MM,
  DESIGN_LEVEL_LABELS,
  axisAlignedRect,
  formatLength,
  parseLengthToMm,
  polygonAreaMm2,
  polygonPerimeterMm,
  polylineLengthMm,
  segmentLengthMm,
  snapMm,
  type DesignDocument,
  type DesignLevel,
  type PatioRegion,
  type PointMm,
  type PoolBody,
  type PlumbingRun,
  type UnitSystem,
} from "@pool-design/shared";
import { EstimatePanel } from "@/components/EstimatePanel";

type WorkspaceView = "design" | "estimate";
type Tool = "select" | "pool_rect" | "pool_poly" | "patio" | "plumbing";
type Selection =
  | { kind: "pool"; id: string }
  | { kind: "patio"; id: string }
  | { kind: "run"; id: string }
  | null;

type Props = {
  projectId: string;
  projectName: string;
  designLevel: DesignLevel;
  unitSystem: UnitSystem;
  initialDesign: DesignDocument;
};

const PX_PER_MM = 0.05;
const ORIGIN = { x: 80, y: 80 };
const CLOSE_TOLERANCE_MM = 150;

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

function formatArea(mm2: number, unitSystem: UnitSystem): string {
  if (unitSystem === "metric") {
    const m2 = mm2 / 1_000_000;
    return `${m2.toFixed(2)} m²`;
  }
  const sqFt = mm2 / 92903.04;
  return `${sqFt.toFixed(1)} ft²`;
}

function layerVisible(design: DesignDocument, id: string): boolean {
  return design.layers.find((l) => l.id === id)?.visible !== false;
}

export function CadWorkspace({
  projectId,
  projectName,
  designLevel,
  unitSystem,
  initialDesign,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<WorkspaceView>("design");
  const [design, setDesign] = useState<DesignDocument>(initialDesign);
  const [past, setPast] = useState<DesignDocument[]>([]);
  const [future, setFuture] = useState<DesignDocument[]>([]);
  const [tool, setTool] = useState<Tool>("pool_rect");
  const [ortho, setOrtho] = useState(true);
  const [draftPoints, setDraftPoints] = useState<PointMm[]>([]);
  const [cursor, setCursor] = useState<PointMm | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const previewPoint = cursor;

  const draftSegmentMm =
    draftPoints.length > 0 && previewPoint
      ? segmentLengthMm(draftPoints[draftPoints.length - 1], previewPoint)
      : 0;

  const draftTotalMm = useMemo(() => {
    if (draftPoints.length === 0) return 0;
    const open = polylineLengthMm(draftPoints);
    if (!previewPoint) return open;
    return open + draftSegmentMm;
  }, [draftPoints, previewPoint, draftSegmentMm]);

  const selectedPool = useMemo(
    () =>
      selection?.kind === "pool"
        ? design.poolBodies.find((p) => p.id === selection.id) ?? null
        : null,
    [design.poolBodies, selection],
  );

  const selectedPatio = useMemo(
    () =>
      selection?.kind === "patio"
        ? design.patios.find((p) => p.id === selection.id) ?? null
        : null,
    [design.patios, selection],
  );

  const selectedRun = useMemo(
    () =>
      selection?.kind === "run"
        ? design.plumbingRuns.find((r) => r.id === selection.id) ?? null
        : null,
    [design.plumbingRuns, selection],
  );

  const persist = useCallback(
    async (next: DesignDocument) => {
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
    },
    [projectId],
  );

  const commitDesign = useCallback(
    (next: DesignDocument) => {
      setPast((p) => [...p.slice(-49), design]);
      setFuture([]);
      setDesign(next);
      void persist(next);
    },
    [design, persist],
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [design, ...f].slice(0, 50));
      setDesign(prev);
      void persist(prev);
      return p.slice(0, -1);
    });
  }, [design, persist]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const [next, ...rest] = f;
      setPast((p) => [...p, design].slice(-50));
      setDesign(next);
      void persist(next);
      return rest;
    });
  }, [design, persist]);

  const drawScene = useCallback(() => {
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

    if (layerVisible(design, "patio") || layerVisible(design, "deck")) {
      for (const patio of design.patios) {
        drawPolygon(
          ctx,
          patio.outline,
          selection?.kind === "patio" && selection.id === patio.id,
          "#c4a574",
          "rgba(196,165,116,0.28)",
          unitSystem,
          true,
        );
      }
    }

    if (layerVisible(design, "pool") || layerVisible(design, "pools")) {
      for (const pool of design.poolBodies) {
        drawPolygon(
          ctx,
          pool.outline,
          selection?.kind === "pool" && selection.id === pool.id,
          "#1f8a70",
          "rgba(31,138,112,0.28)",
          unitSystem,
          true,
        );
      }
    }

    if (layerVisible(design, "plumbing")) {
      for (const run of design.plumbingRuns) {
        drawRun(
          ctx,
          run,
          selection?.kind === "run" && selection.id === run.id,
          unitSystem,
        );
      }
    }

    if (draftPoints.length) {
      const draftClosed =
        tool === "pool_poly" || tool === "patio" || tool === "pool_rect";
      ctx.strokeStyle = tool === "patio" ? "#8a6a2f" : "#146353";
      ctx.lineWidth = 2.5;
      ctx.setLineDash(tool === "plumbing" ? [] : [7, 5]);
      ctx.beginPath();
      const pts =
        tool === "pool_rect" && draftPoints.length === 1 && previewPoint
          ? axisAlignedRect(draftPoints[0], previewPoint)
          : draftPoints;
      pts.forEach((p, i) => {
        const c = toCanvas(p);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      if (tool === "pool_rect" && draftPoints.length === 1 && previewPoint) {
        ctx.closePath();
      } else if (previewPoint && tool !== "pool_rect") {
        const c = toCanvas(previewPoint);
        ctx.lineTo(c.x, c.y);
        if (draftClosed && draftPoints.length >= 2) {
          const first = toCanvas(draftPoints[0]);
          ctx.lineTo(first.x, first.y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      for (const p of draftPoints) {
        const c = toCanvas(p);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (draftPoints.length > 0 && previewPoint && tool !== "pool_rect") {
        drawEdgeLabel(
          ctx,
          draftPoints[draftPoints.length - 1],
          previewPoint,
          unitSystem,
        );
      }
      if (tool === "pool_rect" && draftPoints.length === 1 && previewPoint) {
        const rectPts = axisAlignedRect(draftPoints[0], previewPoint);
        for (let i = 0; i < 4; i++) {
          drawEdgeLabel(ctx, rectPts[i], rectPts[(i + 1) % 4], unitSystem);
        }
      }
    }

    if (
      design.poolBodies.length === 0 &&
      design.patios.length === 0 &&
      draftPoints.length === 0
    ) {
      ctx.fillStyle = "rgba(20,32,41,0.45)";
      ctx.font = "14px Source Sans 3, sans-serif";
      ctx.fillText(
        "Choose Pool rectangle and click two opposite corners to start",
        ORIGIN.x,
        ORIGIN.y - 16,
      );
    }
  }, [design, draftPoints, previewPoint, selection, tool, unitSystem]);

  useEffect(() => {
    drawScene();
    const onResize = () => drawScene();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawScene]);

  function pointerPoint(e: React.PointerEvent<HTMLCanvasElement>): PointMm {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let point = fromCanvas(e.clientX - rect.left, e.clientY - rect.top, unitSystem);
    const useOrtho = ortho || e.shiftKey;
    if (useOrtho && draftPoints.length > 0 && tool !== "pool_rect") {
      point = applyOrtho(draftPoints[draftPoints.length - 1], point);
    }
    if (useOrtho && tool === "pool_rect" && draftPoints.length === 1) {
      // free second corner; ortho not needed for axis-aligned rect
    }
    return point;
  }

  function finishPolygon(kind: "pool" | "patio") {
    if (draftPoints.length < 3) {
      setDraftPoints([]);
      return;
    }
    if (kind === "pool") {
      const pool: PoolBody = {
        id: newId("pool"),
        name: `Pool ${design.poolBodies.length + 1}`,
        outline: draftPoints,
        depthShallowMm: DEFAULT_POOL_SHALLOW_MM,
        depthDeepMm: DEFAULT_POOL_DEEP_MM,
      };
      const next = { ...design, poolBodies: [...design.poolBodies, pool] };
      commitDesign(next);
      setSelection({ kind: "pool", id: pool.id });
    } else {
      const patio: PatioRegion = {
        id: newId("patio"),
        name: `Patio ${design.patios.length + 1}`,
        outline: draftPoints,
      };
      const next = { ...design, patios: [...design.patios, patio] };
      commitDesign(next);
      setSelection({ kind: "patio", id: patio.id });
    }
    setDraftPoints([]);
  }

  function finishPlumbing() {
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
    commitDesign(next);
    setSelection({ kind: "run", id: run.id });
    setDraftPoints([]);
  }

  function finishDraft() {
    if (tool === "plumbing") finishPlumbing();
    else if (tool === "pool_poly") finishPolygon("pool");
    else if (tool === "patio") finishPolygon("patio");
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const point = pointerPoint(e);

    if (tool === "select") {
      const hit = hitTest(design, point);
      setSelection(hit);
      return;
    }

    if (tool === "pool_rect") {
      if (draftPoints.length === 0) {
        setDraftPoints([point]);
        return;
      }
      const outline = axisAlignedRect(draftPoints[0], point);
      const pool: PoolBody = {
        id: newId("pool"),
        name: `Pool ${design.poolBodies.length + 1}`,
        outline,
        depthShallowMm: DEFAULT_POOL_SHALLOW_MM,
        depthDeepMm: DEFAULT_POOL_DEEP_MM,
      };
      commitDesign({ ...design, poolBodies: [...design.poolBodies, pool] });
      setSelection({ kind: "pool", id: pool.id });
      setDraftPoints([]);
      return;
    }

    if (tool === "pool_poly" || tool === "patio" || tool === "plumbing") {
      if (
        (tool === "pool_poly" || tool === "patio") &&
        draftPoints.length >= 3 &&
        segmentLengthMm(point, draftPoints[0]) <= CLOSE_TOLERANCE_MM
      ) {
        finishPolygon(tool === "patio" ? "patio" : "pool");
        return;
      }
      setDraftPoints((pts) => [...pts, point]);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    setCursor(pointerPoint(e));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    if (e.key === "Escape") setDraftPoints([]);
    if (e.key === "Enter") finishDraft();
    if (e.key === "o" || e.key === "O") setOrtho((v) => !v);
    if (e.key === "Delete" || e.key === "Backspace") {
      if (!selection || draftPoints.length > 0) return;
      e.preventDefault();
      deleteSelection();
    }
  }

  function deleteSelection() {
    if (!selection) return;
    if (selection.kind === "pool") {
      commitDesign({
        ...design,
        poolBodies: design.poolBodies.filter((p) => p.id !== selection.id),
      });
    } else if (selection.kind === "patio") {
      commitDesign({
        ...design,
        patios: design.patios.filter((p) => p.id !== selection.id),
      });
    } else if (selection.kind === "run") {
      commitDesign({
        ...design,
        plumbingRuns: design.plumbingRuns.filter((r) => r.id !== selection.id),
      });
    }
    setSelection(null);
  }

  function toggleLayer(layerId: string) {
    const next = {
      ...design,
      layers: design.layers.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l,
      ),
    };
    commitDesign(next);
  }

  function updateSelectedPoolDepths(shallowMm: number, deepMm: number) {
    if (!selectedPool) return;
    const next = {
      ...design,
      poolBodies: design.poolBodies.map((p) =>
        p.id === selectedPool.id
          ? { ...p, depthShallowMm: shallowMm, depthDeepMm: deepMm }
          : p,
      ),
    };
    commitDesign(next);
  }

  const toolHelp =
    tool === "pool_rect"
      ? "Click two opposite corners for an axis-aligned pool."
      : tool === "pool_poly" || tool === "patio"
        ? "Click corners. Click near the first point (or Enter) to close."
        : tool === "plumbing"
          ? "Click segments. Enter finishes the run. Ortho/Shift for straight lines."
          : "Click a pool, patio, or plumbing run to select it.";

  return (
    <div className="stack" style={{ gap: "0.85rem" }}>
      <div className="panel row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="muted">Project</div>
          <strong>{projectName}</strong>{" "}
          <span className="badge">{DESIGN_LEVEL_LABELS[designLevel]}</span>
        </div>
        <div className="row">
          <button
            type="button"
            className={`btn ${view === "design" ? "" : "secondary"}`}
            onClick={() => setView("design")}
          >
            Design
          </button>
          <button
            type="button"
            className={`btn ${view === "estimate" ? "" : "secondary"}`}
            onClick={() => setView("estimate")}
          >
            Estimate / BOM
          </button>
        </div>
      </div>

      {view === "estimate" ? (
        <EstimatePanel
          projectId={projectId}
          design={design}
          unitSystem={unitSystem}
        />
      ) : (
    <div className="cad-layout" onKeyDown={onKeyDown} tabIndex={0}>
      <aside className="panel stack">
        <div>
          <div className="muted">Drawing tools</div>
        </div>

        <div className="cad-toolbar">
          {(
            [
              ["select", "Select"],
              ["pool_rect", "Pool rect"],
              ["pool_poly", "Pool poly"],
              ["patio", "Patio"],
              ["plumbing", "Plumbing"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn ${tool === id ? "" : "secondary"}`}
              onClick={() => {
                setTool(id);
                setDraftPoints([]);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="row">
          <button
            type="button"
            className={`btn ${ortho ? "" : "secondary"}`}
            onClick={() => setOrtho((v) => !v)}
          >
            Ortho {ortho ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={undo}
            disabled={past.length === 0}
          >
            Undo
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={redo}
            disabled={future.length === 0}
          >
            Redo
          </button>
        </div>

        <p className="muted" style={{ fontSize: "0.9rem" }}>
          {toolHelp}
        </p>

        {(tool === "pool_poly" || tool === "patio" || tool === "plumbing") && (
          <button
            type="button"
            className="btn secondary"
            onClick={finishDraft}
            disabled={
              tool === "plumbing" ? draftPoints.length < 2 : draftPoints.length < 3
            }
          >
            {tool === "plumbing" ? "Finish run" : "Close shape"}
          </button>
        )}

        <div>
          <strong>Layers</strong>
          <div className="stack" style={{ marginTop: "0.5rem" }}>
            {design.layers.map((layer) => (
              <label key={layer.id} className="row" style={{ gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={layer.visible}
                  onChange={() => toggleLayer(layer.id)}
                />
                <span style={{ textTransform: "capitalize" }}>{layer.name}</span>
              </label>
            ))}
          </div>
        </div>

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
            onDoubleClick={() => {
              if (tool === "plumbing" || tool === "pool_poly" || tool === "patio") {
                finishDraft();
              }
            }}
          />
          <div className="hud">
            <div>
              Segment:{" "}
              {draftPoints.length > 0
                ? formatLength(draftSegmentMm, unitSystem)
                : "—"}
            </div>
            <div>
              {tool === "plumbing" ? "Run total" : "Path"}:{" "}
              {draftPoints.length > 0
                ? formatLength(draftTotalMm, unitSystem)
                : selectedRun
                  ? formatLength(polylineLengthMm(selectedRun.points), unitSystem)
                  : "—"}
            </div>
          </div>
        </div>
      </section>

      <aside className="panel stack">
        <h2>Properties</h2>
        {!selection && (
          <p className="muted">Select a pool, patio, or plumbing run.</p>
        )}

        {selectedPool && (
          <div className="stack">
            <strong>{selectedPool.name}</strong>
            <div className="muted">
              Perimeter {formatLength(polygonPerimeterMm(selectedPool.outline), unitSystem)}
              <br />
              Area {formatArea(polygonAreaMm2(selectedPool.outline), unitSystem)}
            </div>
            <div className="field">
              <label htmlFor="shallow">Shallow depth</label>
              <input
                id="shallow"
                defaultValue={formatLength(selectedPool.depthShallowMm, unitSystem)}
                key={`shallow-${selectedPool.id}-${selectedPool.depthShallowMm}`}
                onBlur={(e) => {
                  const mm = parseDepthInput(e.target.value, unitSystem);
                  if (mm != null) {
                    updateSelectedPoolDepths(mm, selectedPool.depthDeepMm);
                  }
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="deep">Deep depth</label>
              <input
                id="deep"
                defaultValue={formatLength(selectedPool.depthDeepMm, unitSystem)}
                key={`deep-${selectedPool.id}-${selectedPool.depthDeepMm}`}
                onBlur={(e) => {
                  const mm = parseDepthInput(e.target.value, unitSystem);
                  if (mm != null) {
                    updateSelectedPoolDepths(selectedPool.depthShallowMm, mm);
                  }
                }}
              />
            </div>
            <button type="button" className="btn danger" onClick={deleteSelection}>
              Delete pool
            </button>
          </div>
        )}

        {selectedPatio && (
          <div className="stack">
            <strong>{selectedPatio.name}</strong>
            <div className="muted">
              Perimeter{" "}
              {formatLength(polygonPerimeterMm(selectedPatio.outline), unitSystem)}
              <br />
              Area {formatArea(polygonAreaMm2(selectedPatio.outline), unitSystem)}
            </div>
            <button type="button" className="btn danger" onClick={deleteSelection}>
              Delete patio
            </button>
          </div>
        )}

        {selectedRun && (
          <div className="stack">
            <strong>{selectedRun.name}</strong>
            <div className="muted">{selectedRun.circuit}</div>
            <div>
              Total length{" "}
              {formatLength(polylineLengthMm(selectedRun.points), unitSystem)}
            </div>
            <button type="button" className="btn danger" onClick={deleteSelection}>
              Delete run
            </button>
          </div>
        )}

        <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />

        <h2>Objects</h2>
        <div className="stack">
          {design.poolBodies.map((pool) => (
            <button
              key={pool.id}
              type="button"
              className="card-link"
              style={{
                textAlign: "left",
                borderColor:
                  selection?.kind === "pool" && selection.id === pool.id
                    ? "var(--accent)"
                    : undefined,
              }}
              onClick={() => setSelection({ kind: "pool", id: pool.id })}
            >
              <strong>{pool.name}</strong>
              <div className="muted">
                {formatArea(polygonAreaMm2(pool.outline), unitSystem)}
              </div>
            </button>
          ))}
          {design.patios.map((patio) => (
            <button
              key={patio.id}
              type="button"
              className="card-link"
              style={{
                textAlign: "left",
                borderColor:
                  selection?.kind === "patio" && selection.id === patio.id
                    ? "var(--accent)"
                    : undefined,
              }}
              onClick={() => setSelection({ kind: "patio", id: patio.id })}
            >
              <strong>{patio.name}</strong>
              <div className="muted">Patio</div>
            </button>
          ))}
          {design.plumbingRuns.map((run) => (
            <button
              key={run.id}
              type="button"
              className="card-link"
              style={{
                textAlign: "left",
                borderColor:
                  selection?.kind === "run" && selection.id === run.id
                    ? "var(--accent)"
                    : undefined,
              }}
              onClick={() => setSelection({ kind: "run", id: run.id })}
            >
              <strong>{run.name}</strong>
              <div>
                {formatLength(polylineLengthMm(run.points), unitSystem)}
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
      )}
    </div>
  );
}

function parseDepthInput(input: string, unitSystem: UnitSystem): number | null {
  return parseLengthToMm(input, unitSystem);
}

function hitTest(design: DesignDocument, point: PointMm): Selection {
  const tol = 120;
  for (let i = design.plumbingRuns.length - 1; i >= 0; i--) {
    const run = design.plumbingRuns[i];
    for (let j = 1; j < run.points.length; j++) {
      if (distToSegment(point, run.points[j - 1], run.points[j]) <= tol) {
        return { kind: "run", id: run.id };
      }
    }
  }
  for (let i = design.poolBodies.length - 1; i >= 0; i--) {
    if (pointInPolygon(point, design.poolBodies[i].outline)) {
      return { kind: "pool", id: design.poolBodies[i].id };
    }
  }
  for (let i = design.patios.length - 1; i >= 0; i--) {
    if (pointInPolygon(point, design.patios[i].outline)) {
      return { kind: "patio", id: design.patios[i].id };
    }
  }
  return null;
}

function distToSegment(p: PointMm, a: PointMm, b: PointMm): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return segmentLengthMm(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
  );
  return segmentLengthMm(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function pointInPolygon(point: PointMm, polygon: PointMm[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  outline: PointMm[],
  selected: boolean,
  stroke: string,
  fill: string,
  unitSystem: UnitSystem,
  withDims: boolean,
) {
  if (outline.length < 2) return;
  ctx.beginPath();
  outline.forEach((p, i) => {
    const c = toCanvas(p);
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
      drawEdgeLabel(
        ctx,
        outline[i],
        outline[(i + 1) % outline.length],
        unitSystem,
      );
    }
  }
}

function drawRun(
  ctx: CanvasRenderingContext2D,
  run: PlumbingRun,
  selected: boolean,
  unitSystem: UnitSystem,
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
  for (let i = 1; i < run.points.length; i++) {
    drawEdgeLabel(ctx, run.points[i - 1], run.points[i], unitSystem);
  }
}

function drawEdgeLabel(
  ctx: CanvasRenderingContext2D,
  a: PointMm,
  b: PointMm,
  unitSystem: UnitSystem,
) {
  const len = segmentLengthMm(a, b);
  if (len < 80) return;
  const mid = toCanvas({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const label = formatLength(len, unitSystem);
  ctx.font = "11px Source Sans 3, sans-serif";
  ctx.fillStyle = "rgba(20,32,41,0.75)";
  ctx.fillText(label, mid.x + 4, mid.y - 4);
}
