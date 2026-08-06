"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_POOL_DEEP_MM,
  DEFAULT_POOL_SHALLOW_MM,
  DESIGN_LEVEL_LABELS,
  axisAlignedRect,
  designGuideSteps,
  formatLength,
  formatMoney,
  objectFootprint,
  objectLibraryForLevel,
  parseLengthToMm,
  polygonAreaMm2,
  polygonPerimeterMm,
  polylineLengthMm,
  segmentLengthMm,
  snapMm,
  type DesignDocument,
  type DesignLevel,
  type PatioRegion,
  type PlaceableItem,
  type PlacedObject,
  type PointMm,
  type PoolBody,
  type PoolFeature,
  type PlumbingRun,
  type UnitSystem,
} from "@pool-design/shared";
import { EstimatePanel } from "@/components/EstimatePanel";
import { ACTION_ICONS, TOOL_META } from "@/components/CadToolIcons";
import {
  DEFAULT_VIEWPORT,
  applyAngleSnap,
  applyOrtho,
  pointAtLength,
  screenToWorld,
  zoomAt,
  type Viewport,
} from "@/lib/cad/math";
import {
  drawDraft,
  drawFeature,
  drawGrid,
  drawMeasure,
  drawPlacedObject,
  drawPolygon,
  drawRun,
  drawEdgeLabel,
} from "@/lib/cad/draw";

type WorkspaceView = "design" | "estimate";
type SideTab = "tools" | "properties" | "layers";
type Tool =
  | "select"
  | "pool_rect"
  | "pool_poly"
  | "steps"
  | "bench"
  | "patio"
  | "plumbing"
  | "place"
  | "measure";
type Selection =
  | { kind: "pool"; id: string }
  | { kind: "patio"; id: string }
  | { kind: "run"; id: string }
  | { kind: "object"; id: string }
  | { kind: "feature"; id: string }
  | null;

type DragState =
  | {
      mode: "pan";
      startX: number;
      startY: number;
      originPanX: number;
      originPanY: number;
    }
  | {
      mode: "vertex";
      kind: "pool" | "patio" | "run" | "feature";
      id: string;
      index: number;
    }
  | {
      mode: "move";
      kind: "pool" | "patio" | "run" | "object" | "feature";
      id: string;
      last: PointMm;
    }
  | {
      mode: "rotate";
      id: string;
    };

type Props = {
  projectId: string;
  projectName: string;
  designLevel: DesignLevel;
  unitSystem: UnitSystem;
  initialDesign: DesignDocument;
};

const CLOSE_TOLERANCE_MM = 150;
const VERTEX_HIT_PX = 10;

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatArea(mm2: number, unitSystem: UnitSystem): string {
  if (unitSystem === "metric") return `${(mm2 / 1_000_000).toFixed(2)} m²`;
  return `${(mm2 / 92903.04).toFixed(1)} ft²`;
}

function layerVisible(design: DesignDocument, id: string): boolean {
  return design.layers.find((l) => l.id === id)?.visible !== false;
}

function normalizeDesign(doc: DesignDocument): DesignDocument {
  return {
    ...doc,
    objects: doc.objects ?? [],
    features: doc.features ?? [],
    layers: doc.layers.some((l) => l.id === "features")
      ? doc.layers
      : [...doc.layers, { id: "features", name: "features", visible: true }],
  };
}

function rotationHandleWorld(obj: PlacedObject): PointMm {
  const rad = ((obj.rotationDeg || 0) * Math.PI) / 180;
  const dist = obj.depthMm / 2 + 400;
  return {
    x: obj.position.x - Math.sin(rad) * dist,
    y: obj.position.y - Math.cos(rad) * dist,
  };
}

export function CadWorkspace({
  projectId,
  projectName,
  designLevel,
  unitSystem,
  initialDesign,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragOriginRef = useRef<DesignDocument | null>(null);
  const designRef = useRef<DesignDocument>(initialDesign);
  const [view, setView] = useState<WorkspaceView>("design");
  const [sideTab, setSideTab] = useState<SideTab>("tools");
  const [design, setDesign] = useState<DesignDocument>(() =>
    normalizeDesign(initialDesign),
  );
  designRef.current = design;
  const [measurePoints, setMeasurePoints] = useState<PointMm[]>([]);
  const [past, setPast] = useState<DesignDocument[]>([]);
  const [future, setFuture] = useState<DesignDocument[]>([]);
  const [vp, setVp] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [tool, setTool] = useState<Tool>("pool_rect");
  const [placeItemId, setPlaceItemId] = useState<string | null>(null);
  const [ortho, setOrtho] = useState(true);
  const [angleSnap, setAngleSnap] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [draftPoints, setDraftPoints] = useState<PointMm[]>([]);
  const [cursor, setCursor] = useState<PointMm | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [lengthBuffer, setLengthBuffer] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const library = useMemo(() => objectLibraryForLevel(designLevel), [designLevel]);
  const placeItem = useMemo(
    () => library.find((i) => i.id === placeItemId) ?? null,
    [library, placeItemId],
  );

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
  const selectedObject = useMemo(
    () =>
      selection?.kind === "object"
        ? design.objects.find((o) => o.id === selection.id) ?? null
        : null,
    [design.objects, selection],
  );
  const selectedFeature = useMemo(
    () =>
      selection?.kind === "feature"
        ? (design.features ?? []).find((f) => f.id === selection.id) ?? null
        : null,
    [design.features, selection],
  );
  const guideSteps = useMemo(() => designGuideSteps(design), [design]);

  useEffect(() => {
    if (selection) setSideTab("properties");
  }, [selection]);

  const constrainPoint = useCallback(
    (from: PointMm | null, to: PointMm, shiftKey: boolean) => {
      if (!from) return to;
      let next = to;
      if (ortho || shiftKey) next = applyOrtho(from, next);
      else if (angleSnap) next = applyAngleSnap(from, next, 15);
      return {
        x: snapMm(next.x, unitSystem),
        y: snapMm(next.y, unitSystem),
      };
    },
    [angleSnap, ortho, unitSystem],
  );

  const previewPoint = useMemo(() => {
    if (!cursor) return null;
    if (draftPoints.length === 0) return cursor;
    return constrainPoint(draftPoints[draftPoints.length - 1], cursor, false);
  }, [constrainPoint, cursor, draftPoints]);

  const draftSegmentMm =
    draftPoints.length > 0 && previewPoint
      ? segmentLengthMm(draftPoints[draftPoints.length - 1], previewPoint)
      : 0;

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
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [design, ...f].slice(0, 50));
      setDesign(prev);
      void persist(prev);
      return p.slice(0, -1);
    });
  }, [design, persist]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
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

    drawGrid(ctx, rect.width, rect.height, vp, unitSystem);

    if (layerVisible(design, "patio") || layerVisible(design, "deck")) {
      for (const patio of design.patios) {
        drawPolygon(
          ctx,
          vp,
          patio.outline,
          selection?.kind === "patio" && selection.id === patio.id,
          "#c4a574",
          "rgba(196,165,116,0.28)",
          unitSystem,
          true,
          selection?.kind === "patio" && selection.id === patio.id,
        );
      }
    }

    if (layerVisible(design, "pool") || layerVisible(design, "pools")) {
      for (const pool of design.poolBodies) {
        drawPolygon(
          ctx,
          vp,
          pool.outline,
          selection?.kind === "pool" && selection.id === pool.id,
          "#1f8a70",
          "rgba(31,138,112,0.28)",
          unitSystem,
          true,
          selection?.kind === "pool" && selection.id === pool.id,
        );
      }
    }

    if (layerVisible(design, "features")) {
      for (const feature of design.features ?? []) {
        drawFeature(
          ctx,
          vp,
          feature,
          selection?.kind === "feature" && selection.id === feature.id,
          unitSystem,
        );
      }
    }

    if (layerVisible(design, "plumbing")) {
      for (const run of design.plumbingRuns) {
        drawRun(
          ctx,
          vp,
          run,
          selection?.kind === "run" && selection.id === run.id,
          unitSystem,
          selection?.kind === "run" && selection.id === run.id,
        );
      }
    }

    for (const obj of design.objects ?? []) {
      const hasLayer = design.layers.some((l) => l.id === obj.layerId);
      if (hasLayer && !layerVisible(design, obj.layerId)) continue;
      drawPlacedObject(
        ctx,
        vp,
        obj,
        selection?.kind === "object" && selection.id === obj.id,
      );
    }

    if (tool === "place" && placeItem && previewPoint) {
      drawPlacedObject(
        ctx,
        vp,
        {
          id: "preview",
          catalogItemId: placeItem.id,
          name: placeItem.name,
          position: previewPoint,
          rotationDeg: 0,
          layerId: placeItem.layerId,
          widthMm: placeItem.widthMm,
          depthMm: placeItem.depthMm,
        },
        true,
        true,
      );
    }

    if (measurePoints.length === 1 && previewPoint) {
      drawMeasure(ctx, vp, measurePoints[0], previewPoint, unitSystem);
    } else if (measurePoints.length === 2) {
      drawMeasure(ctx, vp, measurePoints[0], measurePoints[1], unitSystem);
    }

    if (
      (tool === "pool_rect" || tool === "steps" || tool === "bench") &&
      draftPoints.length === 1 &&
      previewPoint
    ) {
      const rectPts = axisAlignedRect(draftPoints[0], previewPoint);
      const stroke =
        tool === "steps" ? "#2f6f9f" : tool === "bench" ? "#6b4f9a" : "#146353";
      drawPolygon(
        ctx,
        vp,
        rectPts,
        true,
        stroke,
        "rgba(31,138,112,0.15)",
        unitSystem,
        true,
        false,
      );
    } else if (draftPoints.length) {
      drawDraft(
        ctx,
        vp,
        draftPoints,
        previewPoint,
        tool === "patio" ? "#8a6a2f" : "#146353",
        tool !== "plumbing",
        tool === "pool_poly" || tool === "patio",
      );
      if (draftPoints.length > 0 && previewPoint && tool !== "pool_rect") {
        drawEdgeLabel(
          ctx,
          vp,
          draftPoints[draftPoints.length - 1],
          previewPoint,
          unitSystem,
        );
      }
    }

    if (
      !design.poolBodies.length &&
      !design.patios.length &&
      !draftPoints.length
    ) {
      ctx.fillStyle = "rgba(20,32,41,0.45)";
      ctx.font = "14px Source Sans 3, sans-serif";
      ctx.fillText(
        "Start with Pool rect — scroll to zoom, hold Space + drag to pan",
        16,
        28,
      );
    }
  }, [
    design,
    draftPoints,
    measurePoints,
    placeItem,
    previewPoint,
    selection,
    tool,
    unitSystem,
    vp,
  ]);

  useEffect(() => {
    drawScene();
    const onResize = () => drawScene();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawScene]);

  function canvasLocal(e: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function worldFromEvent(
    e: { clientX: number; clientY: number },
    snap = true,
  ): PointMm {
    const { x, y } = canvasLocal(e);
    return screenToWorld(x, y, vp, unitSystem, snap);
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
      commitDesign({ ...design, poolBodies: [...design.poolBodies, pool] });
      setSelection({ kind: "pool", id: pool.id });
    } else {
      const patio: PatioRegion = {
        id: newId("patio"),
        name: `Patio ${design.patios.length + 1}`,
        outline: draftPoints,
      };
      commitDesign({ ...design, patios: [...design.patios, patio] });
      setSelection({ kind: "patio", id: patio.id });
    }
    setDraftPoints([]);
    setLengthBuffer("");
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
    commitDesign({
      ...design,
      plumbingRuns: [...design.plumbingRuns, run],
    });
    setSelection({ kind: "run", id: run.id });
    setDraftPoints([]);
    setLengthBuffer("");
  }

  function finishDraft() {
    if (tool === "plumbing") finishPlumbing();
    else if (tool === "pool_poly") finishPolygon("pool");
    else if (tool === "patio") finishPolygon("patio");
  }

  function commitTypedLength() {
    if (!lengthBuffer || draftPoints.length === 0 || !previewPoint) return;
    const mm = parseLengthToMm(lengthBuffer, unitSystem);
    if (mm == null || mm <= 0) return;
    const from = draftPoints[draftPoints.length - 1];
    const toward = constrainPoint(from, previewPoint, false);
    const point = {
      x: snapMm(pointAtLength(from, toward, mm).x, unitSystem),
      y: snapMm(pointAtLength(from, toward, mm).y, unitSystem),
    };
    setDraftPoints((pts) => [...pts, point]);
    setLengthBuffer("");
  }

  function hitVertex(
    point: PointMm,
  ):
    | { kind: "pool" | "patio" | "run" | "feature"; id: string; index: number }
    | null {
    const tol = VERTEX_HIT_PX / vp.scale;
    const check = (
      kind: "pool" | "patio" | "run" | "feature",
      id: string,
      pts: PointMm[],
    ) => {
      for (let i = 0; i < pts.length; i++) {
        if (segmentLengthMm(point, pts[i]) <= tol) return { kind, id, index: i };
      }
      return null;
    };
    if (selection?.kind === "pool" && selectedPool) {
      const hit = check("pool", selectedPool.id, selectedPool.outline);
      if (hit) return hit;
    }
    if (selection?.kind === "patio" && selectedPatio) {
      const hit = check("patio", selectedPatio.id, selectedPatio.outline);
      if (hit) return hit;
    }
    if (selection?.kind === "run" && selectedRun) {
      const hit = check("run", selectedRun.id, selectedRun.points);
      if (hit) return hit;
    }
    if (selection?.kind === "feature" && selectedFeature) {
      const hit = check("feature", selectedFeature.id, selectedFeature.outline);
      if (hit) return hit;
    }
    return null;
  }

  function hitRotateHandle(point: PointMm): string | null {
    if (!selectedObject) return null;
    const handle = rotationHandleWorld(selectedObject);
    const tol = (VERTEX_HIT_PX + 4) / vp.scale;
    if (segmentLengthMm(point, handle) <= tol) return selectedObject.id;
    return null;
  }

  function hitTest(point: PointMm): Selection {
    for (let i = (design.objects ?? []).length - 1; i >= 0; i--) {
      const obj = design.objects[i];
      if (pointInPolygon(point, objectFootprint(obj))) {
        return { kind: "object", id: obj.id };
      }
    }
    for (let i = (design.features ?? []).length - 1; i >= 0; i--) {
      const feature = design.features[i];
      if (pointInPolygon(point, feature.outline)) {
        return { kind: "feature", id: feature.id };
      }
    }
    for (let i = design.plumbingRuns.length - 1; i >= 0; i--) {
      const run = design.plumbingRuns[i];
      for (let j = 1; j < run.points.length; j++) {
        if (distToSegment(point, run.points[j - 1], run.points[j]) <= 120) {
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
    } else if (selection.kind === "object") {
      commitDesign({
        ...design,
        objects: design.objects.filter((o) => o.id !== selection.id),
      });
    } else if (selection.kind === "feature") {
      commitDesign({
        ...design,
        features: (design.features ?? []).filter((f) => f.id !== selection.id),
      });
    }
    setSelection(null);
  }

  function addRectFeature(kind: "steps" | "bench", a: PointMm, b: PointMm) {
    const outline = axisAlignedRect(a, b);
    const nearestPool = design.poolBodies[0]?.id;
    const feature: PoolFeature = {
      id: newId(kind),
      kind,
      name:
        kind === "steps"
          ? `Steps ${(design.features ?? []).filter((f) => f.kind === "steps").length + 1}`
          : `Bench ${(design.features ?? []).filter((f) => f.kind === "bench").length + 1}`,
      outline,
      poolBodyId: nearestPool,
      riserCount: kind === "steps" ? 3 : undefined,
    };
    commitDesign({
      ...design,
      features: [...(design.features ?? []), feature],
    });
    setSelection({ kind: "feature", id: feature.id });
    setDraftPoints([]);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const local = canvasLocal(e);
    const point = worldFromEvent(e);

    if (e.button === 1 || spaceDown || (e.button === 0 && e.altKey)) {
      setDrag({
        mode: "pan",
        startX: local.x,
        startY: local.y,
        originPanX: vp.panX,
        originPanY: vp.panY,
      });
      return;
    }

    if (tool === "select") {
      const rotateId = hitRotateHandle(point);
      if (rotateId) {
        dragOriginRef.current = structuredClone(design);
        setDrag({ mode: "rotate", id: rotateId });
        return;
      }
      const vertex = hitVertex(point);
      if (vertex) {
        dragOriginRef.current = structuredClone(design);
        setDrag({ mode: "vertex", ...vertex });
        return;
      }
      const hit = hitTest(point);
      setSelection(hit);
      if (hit) {
        dragOriginRef.current = structuredClone(design);
        setDrag({ mode: "move", kind: hit.kind, id: hit.id, last: point });
      }
      return;
    }

    if (tool === "measure") {
      if (measurePoints.length >= 2) {
        setMeasurePoints([point]);
      } else {
        setMeasurePoints((pts) => [...pts, point]);
      }
      return;
    }

    if (tool === "place") {
      if (!placeItem) return;
      const placed = placeLibraryItem(design, placeItem, point);
      commitDesign(placed.design);
      setSelection({ kind: "object", id: placed.object.id });
      return;
    }

    if (tool === "pool_rect" || tool === "steps" || tool === "bench") {
      if (!draftPoints.length) {
        setDraftPoints([point]);
        return;
      }
      if (tool === "steps" || tool === "bench") {
        addRectFeature(tool, draftPoints[0], point);
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
      const from = draftPoints[draftPoints.length - 1] ?? null;
      const next = constrainPoint(from, point, e.shiftKey);
      if (
        (tool === "pool_poly" || tool === "patio") &&
        draftPoints.length >= 3 &&
        segmentLengthMm(next, draftPoints[0]) <= CLOSE_TOLERANCE_MM
      ) {
        finishPolygon(tool === "patio" ? "patio" : "pool");
        return;
      }
      setDraftPoints((pts) => [...pts, next]);
      setLengthBuffer("");
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const local = canvasLocal(e);
    const raw = worldFromEvent(e, false);
    const point = worldFromEvent(e, true);
    setCursor(point);

    if (!drag) return;

    if (drag.mode === "pan") {
      setVp((v) => ({
        ...v,
        panX: drag.originPanX + (local.x - drag.startX),
        panY: drag.originPanY + (local.y - drag.startY),
      }));
      return;
    }

    if (drag.mode === "rotate") {
      const obj = designRef.current.objects.find((o) => o.id === drag.id);
      if (!obj) return;
      const angle =
        (Math.atan2(raw.y - obj.position.y, raw.x - obj.position.x) * 180) /
          Math.PI +
        90;
      const snapped = Math.round(angle / 15) * 15;
      setDesign((d) => ({
        ...d,
        objects: d.objects.map((o) =>
          o.id === drag.id ? { ...o, rotationDeg: snapped } : o,
        ),
      }));
      return;
    }

    if (drag.mode === "vertex") {
      const snapped = {
        x: snapMm(raw.x, unitSystem),
        y: snapMm(raw.y, unitSystem),
      };
      setDesign((d) => {
        if (drag.kind === "pool") {
          return {
            ...d,
            poolBodies: d.poolBodies.map((p) =>
              p.id === drag.id
                ? {
                    ...p,
                    outline: p.outline.map((pt, i) =>
                      i === drag.index ? snapped : pt,
                    ),
                  }
                : p,
            ),
          };
        }
        if (drag.kind === "patio") {
          return {
            ...d,
            patios: d.patios.map((p) =>
              p.id === drag.id
                ? {
                    ...p,
                    outline: p.outline.map((pt, i) =>
                      i === drag.index ? snapped : pt,
                    ),
                  }
                : p,
            ),
          };
        }
        if (drag.kind === "feature") {
          return {
            ...d,
            features: (d.features ?? []).map((f) =>
              f.id === drag.id
                ? {
                    ...f,
                    outline: f.outline.map((pt, i) =>
                      i === drag.index ? snapped : pt,
                    ),
                  }
                : f,
            ),
          };
        }
        return {
          ...d,
          plumbingRuns: d.plumbingRuns.map((r) =>
            r.id === drag.id
              ? {
                  ...r,
                  points: r.points.map((pt, i) =>
                    i === drag.index ? snapped : pt,
                  ),
                }
              : r,
          ),
        };
      });
      return;
    }

    if (drag.mode === "move") {
      const dx = point.x - drag.last.x;
      const dy = point.y - drag.last.y;
      if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return;
      setDesign((d) => translateDesign(d, drag.kind, drag.id, dx, dy, unitSystem));
      setDrag({ ...drag, last: point });
    }
  }

  function onPointerUp() {
    if (
      drag?.mode === "vertex" ||
      drag?.mode === "move" ||
      drag?.mode === "rotate"
    ) {
      const origin = dragOriginRef.current;
      if (origin) {
        setPast((p) => [...p.slice(-49), origin]);
        setFuture([]);
      }
      dragOriginRef.current = null;
      void persist(designRef.current);
    }
    setDrag(null);
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const local = canvasLocal(e);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setVp((v) => zoomAt(v, local.x, local.y, factor));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.code === "Space") {
      e.preventDefault();
      setSpaceDown(true);
      return;
    }
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
    if (e.key === "Escape") {
      setDraftPoints([]);
      setLengthBuffer("");
      setMeasurePoints([]);
      return;
    }
    if ((e.key === "r" || e.key === "R") && selectedObject) {
      e.preventDefault();
      commitDesign({
        ...design,
        objects: design.objects.map((o) =>
          o.id === selectedObject.id
            ? { ...o, rotationDeg: (o.rotationDeg + 15) % 360 }
            : o,
        ),
      });
      return;
    }
    if (e.key === "Enter") {
      if (lengthBuffer) {
        e.preventDefault();
        commitTypedLength();
        return;
      }
      finishDraft();
      return;
    }
    if (e.key === "o" || e.key === "O") setOrtho((v) => !v);
    if (e.key === "a" || e.key === "A") setAngleSnap((v) => !v);
    if (e.key === "?" || (e.shiftKey && e.key === "/")) setShowHelp((v) => !v);
    if (e.key === "Delete" || e.key === "Backspace") {
      if (lengthBuffer) {
        setLengthBuffer((b) => b.slice(0, -1));
        return;
      }
      if (!selection || draftPoints.length > 0) return;
      e.preventDefault();
      deleteSelection();
      return;
    }

    // Typed length while drawing
    if (
      draftPoints.length > 0 &&
      (tool === "plumbing" || tool === "pool_poly" || tool === "patio") &&
      !e.metaKey &&
      !e.ctrlKey
    ) {
      if (/^[0-9.'"/mcm\-]$/i.test(e.key) || e.key === "Backspace") {
        e.preventDefault();
        if (e.key === "Backspace") setLengthBuffer((b) => b.slice(0, -1));
        else setLengthBuffer((b) => b + e.key);
      }
    }
  }

  function onKeyUp(e: React.KeyboardEvent) {
    if (e.code === "Space") setSpaceDown(false);
  }

  const toolHelp =
    tool === "pool_rect"
      ? "Click two opposite corners. Scroll zoom · Space-drag pan."
      : tool === "steps" || tool === "bench"
        ? "Click two corners for an in-pool steps or bench rectangle."
        : tool === "pool_poly" || tool === "patio"
          ? "Click corners. Type a length + Enter for exact segment. Close near start."
          : tool === "plumbing"
            ? "Click segments. Type length + Enter. Ortho/Shift for straight lines."
            : tool === "place"
              ? "Pick a library item, then click to place. R rotates selection 15°."
              : tool === "measure"
                ? "Click two points to measure distance. Esc clears."
                : "Select to move/edit. Drag the circle handle to rotate furniture.";

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
        <div
          className="cad-layout"
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          tabIndex={0}
        >
          <section className="panel cad-canvas-panel">
            <div
              className="cad-canvas-wrap"
              style={{
                cursor: spaceDown || drag?.mode === "pan" ? "grab" : "crosshair",
              }}
            >
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                onWheel={onWheel}
                onDoubleClick={() => {
                  if (
                    tool === "plumbing" ||
                    tool === "pool_poly" ||
                    tool === "patio"
                  ) {
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
                    ? formatLength(
                        polylineLengthMm(draftPoints) + draftSegmentMm,
                        unitSystem,
                      )
                    : selectedRun
                      ? formatLength(
                          polylineLengthMm(selectedRun.points),
                          unitSystem,
                        )
                      : "—"}
                </div>
                {lengthBuffer && <div>Typed: {lengthBuffer}</div>}
              </div>
            </div>
          </section>

          <aside className="panel cad-right-rail stack">
            <div className="cad-side-tabs" role="tablist" aria-label="Side panel">
              {(
                [
                  ["tools", "Tools"],
                  ["properties", "Properties"],
                  ["layers", "Layers"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={sideTab === id}
                  className={`cad-side-tab ${sideTab === id ? "active" : ""}`}
                  onClick={() => setSideTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {sideTab === "tools" && (
              <div className="cad-tab-panel" role="tabpanel">
                <div className="cad-icon-toolbar">
                  {TOOL_META.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`tool-icon-btn ${tool === item.id ? "active" : ""}`}
                      title={item.label}
                      aria-label={item.label}
                      onClick={() => {
                        setTool(item.id);
                        setDraftPoints([]);
                        setLengthBuffer("");
                        if (item.id !== "measure") setMeasurePoints([]);
                        if (item.id === "place" && !placeItemId && library[0]) {
                          setPlaceItemId(library[0].id);
                        }
                      }}
                    >
                      {item.icon}
                    </button>
                  ))}
                </div>
                <div className="cad-action-row">
                  <button
                    type="button"
                    className={`tool-icon-btn ${ortho ? "active" : ""}`}
                    title={`Ortho ${ortho ? "on" : "off"}`}
                    aria-label="Toggle ortho"
                    onClick={() => setOrtho((v) => !v)}
                  >
                    {ACTION_ICONS.ortho}
                  </button>
                  <button
                    type="button"
                    className={`tool-icon-btn ${angleSnap ? "active" : ""}`}
                    title={`15° snap ${angleSnap ? "on" : "off"}`}
                    aria-label="Toggle angle snap"
                    onClick={() => setAngleSnap((v) => !v)}
                  >
                    {ACTION_ICONS.angle}
                  </button>
                  <button
                    type="button"
                    className="tool-icon-btn"
                    title="Undo"
                    aria-label="Undo"
                    onClick={undo}
                    disabled={!past.length}
                  >
                    {ACTION_ICONS.undo}
                  </button>
                  <button
                    type="button"
                    className="tool-icon-btn"
                    title="Redo"
                    aria-label="Redo"
                    onClick={redo}
                    disabled={!future.length}
                  >
                    {ACTION_ICONS.redo}
                  </button>
                  <button
                    type="button"
                    className="tool-icon-btn"
                    title="Reset view"
                    aria-label="Reset view"
                    onClick={() => setVp(DEFAULT_VIEWPORT)}
                  >
                    {ACTION_ICONS.reset}
                  </button>
                </div>
                <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                  {toolHelp}
                </p>
                {lengthBuffer && (
                  <div className="badge warn">Length: {lengthBuffer}_</div>
                )}
                {(tool === "pool_poly" ||
                  tool === "patio" ||
                  tool === "plumbing") && (
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ width: "100%" }}
                    onClick={finishDraft}
                    disabled={
                      tool === "plumbing"
                        ? draftPoints.length < 2
                        : draftPoints.length < 3
                    }
                  >
                    {tool === "plumbing" ? "Finish run" : "Close shape"}
                  </button>
                )}

                {tool === "place" && (
                  <div className="stack">
                    <strong>Furniture library</strong>
                    <div className="cad-compact-list">
                      {library.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="card-link"
                          style={{
                            textAlign: "left",
                            padding: "0.65rem 0.75rem",
                            borderColor:
                              placeItemId === item.id
                                ? "var(--accent)"
                                : undefined,
                          }}
                          onClick={() => setPlaceItemId(item.id)}
                        >
                          <strong>{item.name}</strong>
                          <div
                            className="muted"
                            style={{
                              fontSize: "0.8rem",
                              textTransform: "capitalize",
                            }}
                          >
                            {item.category} · {formatMoney(item.unitPriceCents)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="stack">
                  <strong>Checklist</strong>
                  {guideSteps.map((step) => (
                    <div key={step.id} className="row" style={{ gap: "0.4rem" }}>
                      <span
                        className={`dot ${step.done ? "completed" : ""}`}
                        style={{ marginTop: 2 }}
                      />
                      <span
                        style={{
                          fontSize: "0.88rem",
                          textDecoration: step.done ? "line-through" : "none",
                          opacity: step.done ? 0.6 : 1,
                        }}
                      >
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn secondary"
                  style={{ width: "100%" }}
                  onClick={() => setShowHelp((v) => !v)}
                >
                  {showHelp ? "Hide shortcuts" : "Shortcuts"}
                </button>
                {showHelp && (
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    <div>Scroll zoom · Space-drag pan</div>
                    <div>R / handle — rotate furniture</div>
                    <div>Edit size on Properties tab</div>
                    <div>Type length + Enter while drawing</div>
                  </div>
                )}
                <div className="muted" style={{ fontSize: "0.8rem" }}>
                  {unitSystem} ·{" "}
                  {(vp.scale / DEFAULT_VIEWPORT.scale).toFixed(1)}x · {saveState}
                </div>
              </div>
            )}

            {sideTab === "properties" && (
              <div className="cad-tab-panel" role="tabpanel">
                {!selection && (
                  <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                    Select an item on the plan to edit it. Furniture supports
                    rotation and custom width/depth.
                  </p>
                )}
                {selectedPool && (
                  <div className="stack">
                    <strong>{selectedPool.name}</strong>
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      {formatArea(
                        polygonAreaMm2(selectedPool.outline),
                        unitSystem,
                      )}
                    </div>
                    <DepthFields
                      key={selectedPool.id}
                      shallowMm={selectedPool.depthShallowMm}
                      deepMm={selectedPool.depthDeepMm}
                      unitSystem={unitSystem}
                      onChange={(shallowMm, deepMm) =>
                        commitDesign({
                          ...design,
                          poolBodies: design.poolBodies.map((p) =>
                            p.id === selectedPool.id
                              ? {
                                  ...p,
                                  depthShallowMm: shallowMm,
                                  depthDeepMm: deepMm,
                                }
                              : p,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn danger"
                      onClick={deleteSelection}
                    >
                      Delete
                    </button>
                  </div>
                )}
                {selectedPatio && (
                  <div className="stack">
                    <strong>{selectedPatio.name}</strong>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={deleteSelection}
                    >
                      Delete
                    </button>
                  </div>
                )}
                {selectedRun && (
                  <div className="stack">
                    <strong>{selectedRun.name}</strong>
                    <div>
                      {formatLength(
                        polylineLengthMm(selectedRun.points),
                        unitSystem,
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={deleteSelection}
                    >
                      Delete
                    </button>
                  </div>
                )}
                {selectedObject && (
                  <FurnitureFields
                    key={`${selectedObject.id}-${selectedObject.widthMm}-${selectedObject.depthMm}-${selectedObject.rotationDeg}`}
                    object={selectedObject}
                    unitSystem={unitSystem}
                    onRotate={(deg) =>
                      commitDesign({
                        ...design,
                        objects: design.objects.map((o) =>
                          o.id === selectedObject.id
                            ? {
                                ...o,
                                rotationDeg: ((deg % 360) + 360) % 360,
                              }
                            : o,
                        ),
                      })
                    }
                    onDimensions={(widthMm, depthMm) =>
                      commitDesign({
                        ...design,
                        objects: design.objects.map((o) =>
                          o.id === selectedObject.id
                            ? { ...o, widthMm, depthMm }
                            : o,
                        ),
                      })
                    }
                    onDelete={deleteSelection}
                  />
                )}
                {selectedFeature && (
                  <div className="stack">
                    <strong>{selectedFeature.name}</strong>
                    <div
                      className="muted"
                      style={{ textTransform: "capitalize" }}
                    >
                      {selectedFeature.kind}
                    </div>
                    {selectedFeature.kind === "steps" && (
                      <div className="field">
                        <label htmlFor="risers">Riser count</label>
                        <input
                          id="risers"
                          type="number"
                          min={1}
                          max={12}
                          defaultValue={selectedFeature.riserCount ?? 3}
                          onBlur={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isFinite(n) || n < 1) return;
                            commitDesign({
                              ...design,
                              features: (design.features ?? []).map((f) =>
                                f.id === selectedFeature.id
                                  ? { ...f, riserCount: Math.round(n) }
                                  : f,
                              ),
                            });
                          }}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn danger"
                      onClick={deleteSelection}
                    >
                      Delete
                    </button>
                  </div>
                )}
                {tool === "measure" && measurePoints.length === 2 && (
                  <div>
                    <strong>Measurement</strong>
                    <div>
                      {formatLength(
                        segmentLengthMm(measurePoints[0], measurePoints[1]),
                        unitSystem,
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {sideTab === "layers" && (
              <div className="cad-tab-panel" role="tabpanel">
                <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                  Show or hide drawing layers on the plan.
                </p>
                <div className="stack">
                  {design.layers.map((layer) => (
                    <label
                      key={layer.id}
                      className="row"
                      style={{ gap: "0.5rem" }}
                    >
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        onChange={() =>
                          commitDesign({
                            ...design,
                            layers: design.layers.map((l) =>
                              l.id === layer.id
                                ? { ...l, visible: !l.visible }
                                : l,
                            ),
                          })
                        }
                      />
                      <span style={{ textTransform: "capitalize" }}>
                        {layer.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function DepthFields({
  shallowMm,
  deepMm,
  unitSystem,
  onChange,
}: {
  shallowMm: number;
  deepMm: number;
  unitSystem: UnitSystem;
  onChange: (shallowMm: number, deepMm: number) => void;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor="shallow">Shallow depth</label>
        <input
          id="shallow"
          defaultValue={formatLength(shallowMm, unitSystem)}
          onBlur={(e) => {
            const mm = parseLengthToMm(e.target.value, unitSystem);
            if (mm != null) onChange(mm, deepMm);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="deep">Deep depth</label>
        <input
          id="deep"
          defaultValue={formatLength(deepMm, unitSystem)}
          onBlur={(e) => {
            const mm = parseLengthToMm(e.target.value, unitSystem);
            if (mm != null) onChange(shallowMm, mm);
          }}
        />
      </div>
    </>
  );
}

function FurnitureFields({
  object,
  unitSystem,
  onRotate,
  onDimensions,
  onDelete,
}: {
  object: PlacedObject;
  unitSystem: UnitSystem;
  onRotate: (deg: number) => void;
  onDimensions: (widthMm: number, depthMm: number) => void;
  onDelete: () => void;
}) {
  return (
    <div className="stack">
      <strong>{object.name}</strong>
      <div className="field">
        <label htmlFor="furn-width">Width</label>
        <input
          id="furn-width"
          defaultValue={formatLength(object.widthMm, unitSystem)}
          placeholder={unitSystem === "imperial" ? `e.g. 6'` : "e.g. 1.8m"}
          onBlur={(e) => {
            const mm = parseLengthToMm(e.target.value, unitSystem);
            if (mm != null && mm > 0) onDimensions(mm, object.depthMm);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="furn-depth">Depth / length</label>
        <input
          id="furn-depth"
          defaultValue={formatLength(object.depthMm, unitSystem)}
          placeholder={unitSystem === "imperial" ? `e.g. 3'` : "e.g. 0.9m"}
          onBlur={(e) => {
            const mm = parseLengthToMm(e.target.value, unitSystem);
            if (mm != null && mm > 0) onDimensions(object.widthMm, mm);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="furn-rot">Rotation (degrees)</label>
        <input
          id="furn-rot"
          type="number"
          step={15}
          defaultValue={Math.round(object.rotationDeg || 0)}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onRotate(n);
          }}
        />
      </div>
      <div className="row">
        <button
          type="button"
          className="btn secondary"
          title="Rotate -15°"
          onClick={() => onRotate((object.rotationDeg || 0) - 15)}
        >
          −15°
        </button>
        <button
          type="button"
          className="btn secondary"
          title="Rotate +15°"
          onClick={() => onRotate((object.rotationDeg || 0) + 15)}
        >
          +15°
        </button>
      </div>
      <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
        Or drag the circle handle on the plan. Press R for +15°.
      </p>
      <button type="button" className="btn danger" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

function placeLibraryItem(
  design: DesignDocument,
  item: PlaceableItem,
  position: PointMm,
): { design: DesignDocument; object: PlacedObject } {
  const object: PlacedObject = {
    id: newId("obj"),
    catalogItemId: item.id,
    name: item.name,
    position,
    rotationDeg: 0,
    layerId: item.layerId,
    widthMm: item.widthMm,
    depthMm: item.depthMm,
  };
  let layers = design.layers;
  if (!layers.some((l) => l.id === item.layerId)) {
    layers = [...layers, { id: item.layerId, name: item.layerId, visible: true }];
  }
  return {
    object,
    design: { ...design, layers, objects: [...(design.objects ?? []), object] },
  };
}

function translateDesign(
  d: DesignDocument,
  kind: "pool" | "patio" | "run" | "object" | "feature",
  id: string,
  dx: number,
  dy: number,
  unitSystem: UnitSystem,
): DesignDocument {
  const shift = (p: PointMm): PointMm => ({
    x: snapMm(p.x + dx, unitSystem),
    y: snapMm(p.y + dy, unitSystem),
  });
  if (kind === "pool") {
    return {
      ...d,
      poolBodies: d.poolBodies.map((p) =>
        p.id === id ? { ...p, outline: p.outline.map(shift) } : p,
      ),
    };
  }
  if (kind === "patio") {
    return {
      ...d,
      patios: d.patios.map((p) =>
        p.id === id ? { ...p, outline: p.outline.map(shift) } : p,
      ),
    };
  }
  if (kind === "run") {
    return {
      ...d,
      plumbingRuns: d.plumbingRuns.map((r) =>
        r.id === id ? { ...r, points: r.points.map(shift) } : r,
      ),
    };
  }
  if (kind === "feature") {
    return {
      ...d,
      features: (d.features ?? []).map((f) =>
        f.id === id ? { ...f, outline: f.outline.map(shift) } : f,
      ),
    };
  }
  return {
    ...d,
    objects: d.objects.map((o) =>
      o.id === id ? { ...o, position: shift(o.position) } : o,
    ),
  };
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
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
