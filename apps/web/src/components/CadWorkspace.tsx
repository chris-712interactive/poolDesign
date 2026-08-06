"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PATIO_ROOF_HEIGHT_MM,
  DEFAULT_PERGOLA_HEIGHT_MM,
  DEFAULT_POOL_DEEP_MM,
  DEFAULT_POOL_SHALLOW_MM,
  DEFAULT_SPA_DEPTH_MM,
  DEFAULT_SPA_SHELL_HEIGHT_MM,
  DEFAULT_SPA_WALL_THICKNESS_MM,
  DEFAULT_SUNSHELF_DEPTH_MM,
  DESIGN_LEVEL_LABELS,
  applySpaPackage,
  attachFixturePlumbing,
  axisAlignedRect,
  buildBodyPlumbingRuns,
  buildSpaPackage,
  connectBodiesToEquipment,
  isPlumbingFixtureId,
  normalizeDesignDocument,
  obstaclesFromDesign,
  rebuildBodyPlumbing,
  syncAllBodiesPlumbing,
  syncPlumbingAfterObjectChange,
  syncPlumbingAfterObjectRemoved,
  pointAtRectDepth,
  rectFromThreePoints,
  designGuideSteps,
  formatLength,
  insideBoundsFromOutside,
  insideOutlineFromOutside,
  isAxisAlignedRect,
  isPadEquipmentId,
  isPoolFixtureId,
  isSpaFixtureId,
  isWaterFixtureId,
  objectFootprint,
  objectLibraryForLevel,
  outlineBounds,
  parseLengthToMm,
  polygonAreaMm2,
  polygonPerimeterMm,
  polylineLengthMm,
  poolCount,
  relayoutSpaPackage,
  resetSpaPackage,
  resizeAxisAlignedOutline,
  resolveEquipmentConnection,
  segmentLengthMm,
  snapMm,
  spaCount,
  spaShellHeightMm,
  spaWallThicknessMm,
  stripBodyChildren,
  clampOpeningT,
  defaultOpeningSize,
  openingKindLabel,
  waterBodyKind,
  type Building,
  type BuildingOpening,
  type BuildingOpeningKind,
  type DesignDocument,
  type DesignLevel,
  type PatioCover,
  type PatioCoverKind,
  type PatioRegion,
  type PlaceableItem,
  type PlacedObject,
  type PointMm,
  type PoolBody,
  type PoolFeature,
  type PoolFeatureKind,
  type PlumbingRun,
  type UnitSystem,
  type WaterBodyKind,
} from "@pool-design/shared";
import { EstimatePanel } from "@/components/EstimatePanel";
import {
  catalogIdForPadTool,
  isPadEquipTool,
  type ToolId,
} from "@/components/CadToolIcons";
import { CadToolPalette } from "@/components/CadToolPalette";
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
  drawBuilding,
  drawDraft,
  drawFeature,
  drawGrid,
  drawMeasure,
  drawPatioCover,
  drawPlacedObject,
  drawPolygon,
  drawRun,
  drawEdgeLabel,
  openingEndpoints,
} from "@/lib/cad/draw";

type WorkspaceView = "design" | "estimate";
type SideTab = "tools" | "properties" | "layers";
type Tool = ToolId;
type Selection =
  | { kind: "pool"; id: string }
  | { kind: "patio"; id: string }
  | { kind: "building"; id: string }
  | { kind: "opening"; buildingId: string; id: string }
  | { kind: "cover"; id: string }
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
      kind: "pool" | "patio" | "building" | "cover" | "run" | "feature";
      id: string;
      index: number;
    }
  | {
      mode: "move";
      kind: "pool" | "patio" | "building" | "cover" | "run" | "object" | "feature";
      id: string;
      last: PointMm;
    }
  | {
      mode: "opening";
      buildingId: string;
      id: string;
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
    normalizeDesignDocument(initialDesign, { designLevel, unitSystem }),
  );
  designRef.current = design;
  const [measurePoints, setMeasurePoints] = useState<PointMm[]>([]);
  const [past, setPast] = useState<DesignDocument[]>([]);
  const [future, setFuture] = useState<DesignDocument[]>([]);
  const [vp, setVp] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [tool, setTool] = useState<Tool>("pool_rect");
  const [waterKind, setWaterKind] = useState<WaterBodyKind>("pool");
  const [coverKind, setCoverKind] = useState<PatioCoverKind>("pergola");
  const [openingKind, setOpeningKind] =
    useState<BuildingOpeningKind>("door");
  const [houseStories, setHouseStories] = useState(2);
  const [placeItemId, setPlaceItemId] = useState<string | null>(null);
  const [ortho, setOrtho] = useState(false);
  const [angleSnap, setAngleSnap] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [shiftDown, setShiftDown] = useState(false);
  /** Hold Z to zoom; sticky unlock via toolbar button. */
  const [zDown, setZDown] = useState(false);
  const [zoomUnlocked, setZoomUnlocked] = useState(false);
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
  const placeLibrary = useMemo(
    () => library.filter((i) => i.category !== "equipment"),
    [library],
  );
  const poolFixtureLibrary = useMemo(
    () => library.filter((i) => isPoolFixtureId(i.id)),
    [library],
  );
  const spaFixtureLibrary = useMemo(
    () => library.filter((i) => isSpaFixtureId(i.id)),
    [library],
  );
  const placeItem = useMemo(() => {
    if (isPadEquipTool(tool)) {
      return (
        library.find((i) => i.id === catalogIdForPadTool(tool)) ?? null
      );
    }
    if (tool === "place") {
      return library.find((i) => i.id === placeItemId) ?? null;
    }
    return null;
  }, [library, placeItemId, tool]);

  const isPlacingObject = tool === "place" || isPadEquipTool(tool);

  const selectedPool = useMemo(
    () =>
      selection?.kind === "pool"
        ? design.poolBodies.find((p) => p.id === selection.id) ?? null
        : null,
    [design.poolBodies, selection],
  );
  const selectedPoolChildren = useMemo(() => {
    if (!selectedPool) {
      return {
        features: [] as PoolFeature[],
        objects: [] as PlacedObject[],
        runs: [] as PlumbingRun[],
      };
    }
    const id = selectedPool.id;
    return {
      features: (design.features ?? []).filter((f) => f.poolBodyId === id),
      objects: (design.objects ?? []).filter((o) => o.parentBodyId === id),
      runs: design.plumbingRuns.filter((r) => r.parentBodyId === id),
    };
  }, [design, selectedPool]);
  const selectedPatio = useMemo(
    () =>
      selection?.kind === "patio"
        ? design.patios.find((p) => p.id === selection.id) ?? null
        : null,
    [design.patios, selection],
  );
  const selectedBuilding = useMemo(
    () =>
      selection?.kind === "building"
        ? (design.buildings ?? []).find((b) => b.id === selection.id) ?? null
        : null,
    [design.buildings, selection],
  );
  const selectedOpening = useMemo(() => {
    if (selection?.kind !== "opening") return null;
    const building = (design.buildings ?? []).find(
      (b) => b.id === selection.buildingId,
    );
    if (!building) return null;
    const opening = (building.openings ?? []).find(
      (o) => o.id === selection.id,
    );
    if (!opening) return null;
    return { building, opening };
  }, [design.buildings, selection]);
  const selectedCover = useMemo(
    () =>
      selection?.kind === "cover"
        ? (design.patioCovers ?? []).find((c) => c.id === selection.id) ?? null
        : null,
    [design.patioCovers, selection],
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

  useEffect(() => {
    const clearModifiers = () => {
      setShiftDown(false);
      setSpaceDown(false);
      setZDown(false);
    };
    const onWinKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "z" || e.key === "Z") setZDown(true);
    };
    const onWinKeyUp = (e: KeyboardEvent) => {
      if (e.key === "z" || e.key === "Z") setZDown(false);
    };
    window.addEventListener("blur", clearModifiers);
    window.addEventListener("keydown", onWinKeyDown);
    window.addEventListener("keyup", onWinKeyUp);
    return () => {
      window.removeEventListener("blur", clearModifiers);
      window.removeEventListener("keydown", onWinKeyDown);
      window.removeEventListener("keyup", onWinKeyUp);
    };
  }, []);

  const zoomEnabled = zoomUnlocked || zDown;

  /** Sticky Ortho, or hold Shift for temporary 90° (H/V) while drawing. */
  const wantOrtho = ortho || shiftDown;

  const constrainPoint = useCallback(
    (from: PointMm | null, to: PointMm, forceOrtho?: boolean) => {
      if (!from) return to;
      let next = to;
      const useOrtho = forceOrtho ?? wantOrtho;
      if (useOrtho) next = applyOrtho(from, next);
      else if (angleSnap) next = applyAngleSnap(from, next, 15);
      return {
        x: snapMm(next.x, unitSystem),
        y: snapMm(next.y, unitSystem),
      };
    },
    [angleSnap, unitSystem, wantOrtho],
  );

  const previewPoint = useMemo(() => {
    if (!cursor) return null;
    if (draftPoints.length === 0) return cursor;
    // Third click of rect tools: free cursor — depth is perpendicular to first side.
    if (
      (tool === "pool_rect" ||
        tool === "house_rect" ||
        tool === "cover_rect") &&
      draftPoints.length >= 2
    ) {
      return cursor;
    }
    return constrainPoint(draftPoints[draftPoints.length - 1], cursor);
  }, [constrainPoint, cursor, draftPoints, tool]);

  const draftSegmentMm = useMemo(() => {
    if (!previewPoint || draftPoints.length === 0) return 0;
    if (
      (tool === "pool_rect" ||
        tool === "house_rect" ||
        tool === "cover_rect") &&
      draftPoints.length === 2
    ) {
      const a = draftPoints[0];
      const b = draftPoints[1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return 0;
      const px = -dy / len;
      const py = dx / len;
      return Math.abs(
        (previewPoint.x - a.x) * px + (previewPoint.y - a.y) * py,
      );
    }
    return segmentLengthMm(
      draftPoints[draftPoints.length - 1],
      previewPoint,
    );
  }, [draftPoints, previewPoint, tool]);

  const persist = useCallback(
    async (next: DesignDocument) => {
      setSaveState("saving");
      const normalized = normalizeDesignDocument(next, {
        designLevel,
        unitSystem,
      });
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ design: normalized }),
        });
        if (!res.ok) throw new Error("save failed");
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [projectId, designLevel, unitSystem],
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

    if (layerVisible(design, "house") || layerVisible(design, "building")) {
      for (const building of design.buildings ?? []) {
        const openingSelectedId =
          selection?.kind === "opening" &&
          selection.buildingId === building.id
            ? selection.id
            : null;
        drawBuilding(
          ctx,
          vp,
          building,
          selection?.kind === "building" && selection.id === building.id,
          unitSystem,
          openingSelectedId,
        );
      }
    }

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

    if (layerVisible(design, "covers")) {
      for (const cover of design.patioCovers ?? []) {
        drawPatioCover(
          ctx,
          vp,
          cover,
          selection?.kind === "cover" && selection.id === cover.id,
          unitSystem,
        );
      }
    }

    if (layerVisible(design, "pool") || layerVisible(design, "pools")) {
      for (const pool of design.poolBodies) {
        const isSpa = waterBodyKind(pool) === "spa";
        const selected =
          selection?.kind === "pool" && selection.id === pool.id;
        drawPolygon(
          ctx,
          vp,
          pool.outline,
          selected,
          isSpa ? "#1a6b8a" : "#1f8a70",
          isSpa ? "rgba(26,107,138,0.22)" : "rgba(31,138,112,0.28)",
          unitSystem,
          true,
          selected,
        );
        if (isSpa) {
          const inside = insideOutlineFromOutside(
            pool.outline,
            spaWallThicknessMm(pool),
          );
          drawPolygon(
            ctx,
            vp,
            inside,
            false,
            "#0d4f66",
            "rgba(26,107,138,0.2)",
            unitSystem,
            false,
            false,
          );
        }
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

    if (isPlacingObject && placeItem && previewPoint) {
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
      (tool === "steps" || tool === "bench" || tool === "sunshelf") &&
      draftPoints.length === 1 &&
      previewPoint
    ) {
      const rectPts = axisAlignedRect(draftPoints[0], previewPoint);
      const stroke =
        tool === "steps"
          ? "#2f6f9f"
          : tool === "sunshelf"
            ? "#1a8a9a"
            : "#6b4f9a";
      drawPolygon(
        ctx,
        vp,
        rectPts,
        true,
        stroke,
        tool === "sunshelf"
          ? "rgba(26,138,154,0.2)"
          : "rgba(31,138,112,0.15)",
        unitSystem,
        true,
        false,
      );
    } else if (
      (tool === "pool_rect" ||
        tool === "house_rect" ||
        tool === "cover_rect") &&
      draftPoints.length >= 1 &&
      previewPoint
    ) {
      const stroke =
        tool === "house_rect"
          ? "#7a6550"
          : tool === "cover_rect"
            ? coverKind === "roof"
              ? "#5c5346"
              : "#8a6a3a"
            : waterKind === "spa"
              ? "#1a6b8a"
              : "#146353";
      const fill =
        tool === "house_rect"
          ? "rgba(122,101,80,0.2)"
          : tool === "cover_rect"
            ? coverKind === "roof"
              ? "rgba(92,83,70,0.28)"
              : "rgba(138,106,58,0.18)"
            : waterKind === "spa"
              ? "rgba(26,107,138,0.15)"
              : "rgba(31,138,112,0.15)";
      if (draftPoints.length === 1) {
        drawDraft(ctx, vp, draftPoints, previewPoint, stroke, false, false);
      } else {
        const rectPts = rectFromThreePoints(
          draftPoints[0],
          draftPoints[1],
          previewPoint,
        );
        drawPolygon(
          ctx,
          vp,
          rectPts,
          true,
          stroke,
          fill,
          unitSystem,
          true,
          false,
        );
      }
    } else if (draftPoints.length) {
      drawDraft(
        ctx,
        vp,
        draftPoints,
        previewPoint,
        tool === "patio"
          ? "#8a6a2f"
          : tool === "house_poly"
            ? "#7a6550"
            : "#146353",
        tool !== "plumbing",
        tool === "pool_poly" || tool === "patio" || tool === "house_poly",
      );
      if (
        draftPoints.length > 0 &&
        previewPoint &&
        tool !== "pool_rect" &&
        tool !== "house_rect" &&
        tool !== "cover_rect"
      ) {
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
      !(design.buildings ?? []).length &&
      !(design.patioCovers ?? []).length &&
      !draftPoints.length
    ) {
      ctx.fillStyle = "rgba(20,32,41,0.45)";
      ctx.font = "14px Source Sans 3, sans-serif";
      ctx.fillText(
        "Tip: draw the house, place pad equipment, then pool/spa — plumbing auto-routes",
        16,
        28,
      );
    }
  }, [
    coverKind,
    design,
    draftPoints,
    measurePoints,
    isPlacingObject,
    placeItem,
    previewPoint,
    selection,
    tool,
    unitSystem,
    vp,
    waterKind,
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

  function commitWaterBody(outline: PointMm[]) {
    if (waterKind === "spa") {
      const pkg = buildSpaPackage(
        outline,
        spaCount(design) + 1,
        DEFAULT_SPA_WALL_THICKNESS_MM,
        design,
      );
      commitDesign(applySpaPackage(design, pkg));
      setSelection({ kind: "pool", id: pkg.body.id });
    } else {
      const pool: PoolBody = {
        id: newId("pool"),
        name: `Pool ${poolCount(design) + 1}`,
        kind: "pool",
        outline,
        depthShallowMm: DEFAULT_POOL_SHALLOW_MM,
        depthDeepMm: DEFAULT_POOL_DEEP_MM,
      };
      let next: DesignDocument = {
        ...design,
        poolBodies: [...design.poolBodies, pool],
      };
      const bounds = outlineBounds(outline);
      const connection = resolveEquipmentConnection(next, {
        x: bounds.cx,
        y: bounds.cy,
      });
      if (connection) {
        next = {
          ...next,
          plumbingRuns: [
            ...next.plumbingRuns,
            ...buildBodyPlumbingRuns({
              body: pool,
              connection,
              suctionStart: {
                x: bounds.cx,
                y: bounds.cy,
              },
              returnEnds: [{ x: bounds.cx, y: bounds.cy }],
              obstacles: obstaclesFromDesign(next),
            }),
          ],
        };
      }
      commitDesign(next);
      setSelection({ kind: "pool", id: pool.id });
    }
    setDraftPoints([]);
    setLengthBuffer("");
  }

  function commitBuilding(outline: PointMm[]) {
    const stories = Math.max(1, Math.round(houseStories) || 1);
    const building: Building = {
      id: newId("house"),
      name: `House ${(design.buildings ?? []).length + 1}`,
      outline,
      stories,
      kind: "house",
    };
    let layers = design.layers;
    if (
      !layers.some((l) => l.id === "house") &&
      !layers.some((l) => l.id === "building")
    ) {
      layers = [{ id: "house", name: "house", visible: true }, ...layers];
    }
    commitDesign({
      ...design,
      layers,
      buildings: [...(design.buildings ?? []), building],
    });
    setSelection({ kind: "building", id: building.id });
    setDraftPoints([]);
    setLengthBuffer("");
  }

  function commitPatioCover(outline: PointMm[]) {
    const kind = coverKind;
    const n =
      (design.patioCovers ?? []).filter((c) => c.kind === kind).length + 1;
    const cover: PatioCover = {
      id: newId(kind === "roof" ? "roof" : "pergola"),
      name: kind === "roof" ? `Patio roof ${n}` : `Pergola ${n}`,
      kind,
      outline,
      patioId: nearestPatioId(design.patios, outline),
      heightMm:
        kind === "roof"
          ? DEFAULT_PATIO_ROOF_HEIGHT_MM
          : DEFAULT_PERGOLA_HEIGHT_MM,
    };
    let layers = design.layers;
    if (!layers.some((l) => l.id === "covers")) {
      layers = [...layers, { id: "covers", name: "covers", visible: true }];
    }
    commitDesign({
      ...design,
      layers,
      patioCovers: [...(design.patioCovers ?? []), cover],
    });
    setSelection({ kind: "cover", id: cover.id });
    setDraftPoints([]);
    setLengthBuffer("");
  }

  function commitOpeningOnWall(point: PointMm) {
    const hit = nearestBuildingEdge(design.buildings ?? [], point, 900);
    if (!hit) return false;
    const building = (design.buildings ?? []).find((b) => b.id === hit.buildingId);
    if (!building) return false;
    const size = defaultOpeningSize(openingKind);
    const edgeLen = segmentLengthMm(hit.edgeA, hit.edgeB);
    if (edgeLen < size.widthMm * 0.5) return false;
    const t = clampOpeningT(edgeLen, size.widthMm, hit.t);
    const opening: BuildingOpening = {
      id: newId(openingKind === "window" ? "win" : "door"),
      kind: openingKind,
      edgeIndex: hit.edgeIndex,
      t,
      widthMm: size.widthMm,
      heightMm: size.heightMm,
    };
    commitDesign({
      ...design,
      buildings: (design.buildings ?? []).map((b) =>
        b.id === building.id
          ? { ...b, openings: [...(b.openings ?? []), opening] }
          : b,
      ),
    });
    setSelection({
      kind: "opening",
      buildingId: building.id,
      id: opening.id,
    });
    return true;
  }

  function finishPolygon(kind: "pool" | "patio" | "house") {
    if (draftPoints.length < 3) {
      setDraftPoints([]);
      return;
    }
    if (kind === "pool") {
      commitWaterBody(draftPoints);
    } else if (kind === "house") {
      commitBuilding(draftPoints);
    } else {
      const patio: PatioRegion = {
        id: newId("patio"),
        name: `Patio ${design.patios.length + 1}`,
        outline: draftPoints,
      };
      commitDesign({ ...design, patios: [...design.patios, patio] });
      setSelection({ kind: "patio", id: patio.id });
      setDraftPoints([]);
      setLengthBuffer("");
    }
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
    else if (tool === "house_poly") finishPolygon("house");
  }

  function commitTypedLength() {
    if (!lengthBuffer || draftPoints.length === 0 || !previewPoint) return;
    const mm = parseLengthToMm(lengthBuffer, unitSystem);
    if (mm == null || mm <= 0) return;

    // Rect tools: after two corners of one side, typed length = box depth.
    if (
      (tool === "pool_rect" ||
        tool === "house_rect" ||
        tool === "cover_rect") &&
      draftPoints.length === 2
    ) {
      const depthPoint = pointAtRectDepth(
        draftPoints[0],
        draftPoints[1],
        previewPoint,
        mm,
      );
      const outline = rectFromThreePoints(
        draftPoints[0],
        draftPoints[1],
        depthPoint,
      );
      if (tool === "house_rect") commitBuilding(outline);
      else if (tool === "cover_rect") commitPatioCover(outline);
      else commitWaterBody(outline);
      return;
    }

    const from = draftPoints[draftPoints.length - 1];
    const toward = constrainPoint(from, previewPoint);
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
    | {
        kind: "pool" | "patio" | "building" | "cover" | "run" | "feature";
        id: string;
        index: number;
      }
    | null {
    const tol = VERTEX_HIT_PX / vp.scale;
    const check = (
      kind: "pool" | "patio" | "building" | "cover" | "run" | "feature",
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
    if (selection?.kind === "building" && selectedBuilding) {
      const hit = check(
        "building",
        selectedBuilding.id,
        selectedBuilding.outline,
      );
      if (hit) return hit;
    }
    if (selection?.kind === "cover" && selectedCover) {
      const hit = check("cover", selectedCover.id, selectedCover.outline);
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
    const objectHitMm = Math.max(180, 12 / vp.scale);
    const openingHitMm = Math.max(220, 14 / vp.scale);
    for (let i = (design.objects ?? []).length - 1; i >= 0; i--) {
      const obj = design.objects[i];
      const nearCenter = segmentLengthMm(point, obj.position) <= objectHitMm;
      if (nearCenter || pointInPolygon(point, objectFootprint(obj))) {
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
    for (let i = (design.patioCovers ?? []).length - 1; i >= 0; i--) {
      if (pointInPolygon(point, design.patioCovers[i].outline)) {
        return { kind: "cover", id: design.patioCovers[i].id };
      }
    }
    for (let i = (design.buildings ?? []).length - 1; i >= 0; i--) {
      const building = design.buildings[i];
      for (let j = (building.openings ?? []).length - 1; j >= 0; j--) {
        const opening = building.openings![j];
        const geom = openingEndpoints(building.outline, opening);
        if (
          geom &&
          distToSegment(point, geom.a, geom.b) <= openingHitMm
        ) {
          return {
            kind: "opening",
            buildingId: building.id,
            id: opening.id,
          };
        }
      }
    }
    for (let i = design.patios.length - 1; i >= 0; i--) {
      if (pointInPolygon(point, design.patios[i].outline)) {
        return { kind: "patio", id: design.patios[i].id };
      }
    }
    for (let i = (design.buildings ?? []).length - 1; i >= 0; i--) {
      if (pointInPolygon(point, design.buildings[i].outline)) {
        return { kind: "building", id: design.buildings[i].id };
      }
    }
    return null;
  }

  function deleteSelection() {
    if (!selection) return;
    if (selection.kind === "pool") {
      const stripped = stripBodyChildren(design, selection.id);
      commitDesign({
        ...stripped,
        poolBodies: stripped.poolBodies.filter((p) => p.id !== selection.id),
      });
    } else if (selection.kind === "patio") {
      commitDesign({
        ...design,
        patios: design.patios.filter((p) => p.id !== selection.id),
        patioCovers: (design.patioCovers ?? []).map((c) =>
          c.patioId === selection.id ? { ...c, patioId: undefined } : c,
        ),
      });
    } else if (selection.kind === "building") {
      commitDesign({
        ...design,
        buildings: (design.buildings ?? []).filter(
          (b) => b.id !== selection.id,
        ),
      });
    } else if (selection.kind === "opening") {
      commitDesign({
        ...design,
        buildings: (design.buildings ?? []).map((b) =>
          b.id === selection.buildingId
            ? {
                ...b,
                openings: (b.openings ?? []).filter(
                  (o) => o.id !== selection.id,
                ),
              }
            : b,
        ),
      });
    } else if (selection.kind === "cover") {
      commitDesign({
        ...design,
        patioCovers: (design.patioCovers ?? []).filter(
          (c) => c.id !== selection.id,
        ),
      });
    } else if (selection.kind === "run") {
      commitDesign({
        ...design,
        plumbingRuns: design.plumbingRuns.filter((r) => r.id !== selection.id),
      });
    } else if (selection.kind === "object") {
      const removed = design.objects.find((o) => o.id === selection.id);
      let next: DesignDocument = {
        ...design,
        objects: design.objects.filter((o) => o.id !== selection.id),
      };
      if (removed) next = syncPlumbingAfterObjectRemoved(next, removed);
      commitDesign(next);
    } else if (selection.kind === "feature") {
      commitDesign({
        ...design,
        features: (design.features ?? []).filter((f) => f.id !== selection.id),
      });
    }
    setSelection(null);
  }

  function addRectFeature(
    kind: Extract<PoolFeatureKind, "steps" | "bench" | "sunshelf">,
    a: PointMm,
    b: PointMm,
  ) {
    const outline = axisAlignedRect(a, b);
    // Prefer a pool body over spa when linking sunshelf / in-pool features.
    const nearestPool =
      design.poolBodies.find((p) => (p.kind ?? "pool") !== "spa")?.id ??
      design.poolBodies[0]?.id;
    const count =
      (design.features ?? []).filter((f) => f.kind === kind).length + 1;
    const feature: PoolFeature = {
      id: newId(kind === "sunshelf" ? "shelf" : kind),
      kind,
      name:
        kind === "steps"
          ? `Steps ${count}`
          : kind === "sunshelf"
            ? `Sunshelf ${count}`
            : `Bench ${count}`,
      outline,
      poolBodyId: nearestPool,
      riserCount: kind === "steps" ? 3 : undefined,
      depthMm: kind === "sunshelf" ? DEFAULT_SUNSHELF_DEPTH_MM : undefined,
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
      if (hit?.kind === "opening") {
        dragOriginRef.current = structuredClone(design);
        setDrag({
          mode: "opening",
          buildingId: hit.buildingId,
          id: hit.id,
        });
      } else if (hit) {
        dragOriginRef.current = structuredClone(design);
        setDrag({ mode: "move", kind: hit.kind, id: hit.id, last: point });
      }
      return;
    }

    if (tool === "opening") {
      commitOpeningOnWall(point);
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

    if (isPlacingObject) {
      if (!placeItem) return;
      const parentBodyId = isWaterFixtureId(placeItem.id)
        ? nearestWaterBodyId(design.poolBodies, point)
        : undefined;
      const placed = placeLibraryItem(design, placeItem, point, parentBodyId);
      let next = placed.design;
      // Pad gear: rebuild all body trenches to the new pad location.
      if (isPadEquipmentId(placeItem.id)) {
        next = syncAllBodiesPlumbing(next);
      }
      // Bubblers / jets / drains: rebuild that body's plumbing endpoints.
      if (isPlumbingFixtureId(placeItem.id) && parentBodyId) {
        next = attachFixturePlumbing(next, {
          bodyId: parentBodyId,
          position: point,
          catalogItemId: placeItem.id,
        });
      }
      commitDesign(next);
      setSelection({ kind: "object", id: placed.object.id });
      return;
    }

    if (tool === "steps" || tool === "bench" || tool === "sunshelf") {
      if (!draftPoints.length) {
        setDraftPoints([point]);
        return;
      }
      addRectFeature(tool, draftPoints[0], point);
      return;
    }

    if (
      tool === "pool_rect" ||
      tool === "house_rect" ||
      tool === "cover_rect"
    ) {
      setShiftDown(e.shiftKey);
      if (!draftPoints.length) {
        setDraftPoints([point]);
        return;
      }
      if (draftPoints.length === 1) {
        const next = constrainPoint(draftPoints[0], point, ortho || e.shiftKey);
        setDraftPoints([draftPoints[0], next]);
        setLengthBuffer("");
        return;
      }
      const outline = rectFromThreePoints(
        draftPoints[0],
        draftPoints[1],
        point,
      );
      if (tool === "house_rect") commitBuilding(outline);
      else if (tool === "cover_rect") commitPatioCover(outline);
      else commitWaterBody(outline);
      return;
    }

    if (
      tool === "pool_poly" ||
      tool === "patio" ||
      tool === "house_poly" ||
      tool === "plumbing"
    ) {
      const from = draftPoints[draftPoints.length - 1] ?? null;
      setShiftDown(e.shiftKey);
      const next = constrainPoint(from, point, ortho || e.shiftKey);
      if (
        (tool === "pool_poly" ||
          tool === "patio" ||
          tool === "house_poly") &&
        draftPoints.length >= 3 &&
        segmentLengthMm(next, draftPoints[0]) <= CLOSE_TOLERANCE_MM
      ) {
        finishPolygon(
          tool === "patio" ? "patio" : tool === "house_poly" ? "house" : "pool",
        );
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
    setShiftDown(e.shiftKey);
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
      let snapped = {
        x: snapMm(raw.x, unitSystem),
        y: snapMm(raw.y, unitSystem),
      };
      // Shift / Ortho: keep edited edge horizontal or vertical from previous vertex.
      if (ortho || e.shiftKey) {
        const pts =
          drag.kind === "pool"
            ? designRef.current.poolBodies.find((p) => p.id === drag.id)?.outline
            : drag.kind === "patio"
              ? designRef.current.patios.find((p) => p.id === drag.id)?.outline
              : drag.kind === "building"
                ? (designRef.current.buildings ?? []).find(
                    (b) => b.id === drag.id,
                  )?.outline
                : drag.kind === "cover"
                  ? (designRef.current.patioCovers ?? []).find(
                      (c) => c.id === drag.id,
                    )?.outline
                  : drag.kind === "feature"
                    ? (designRef.current.features ?? []).find(
                        (f) => f.id === drag.id,
                      )?.outline
                    : designRef.current.plumbingRuns.find((r) => r.id === drag.id)
                        ?.points;
        if (pts && pts.length > 1) {
          const prev = pts[(drag.index - 1 + pts.length) % pts.length];
          snapped = constrainPoint(prev, snapped, true);
        }
      }
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
        if (drag.kind === "building") {
          return {
            ...d,
            buildings: (d.buildings ?? []).map((b) =>
              b.id === drag.id
                ? {
                    ...b,
                    outline: b.outline.map((pt, i) =>
                      i === drag.index ? snapped : pt,
                    ),
                  }
                : b,
            ),
          };
        }
        if (drag.kind === "cover") {
          return {
            ...d,
            patioCovers: (d.patioCovers ?? []).map((c) =>
              c.id === drag.id
                ? {
                    ...c,
                    outline: c.outline.map((pt, i) =>
                      i === drag.index ? snapped : pt,
                    ),
                  }
                : c,
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

    if (drag.mode === "opening") {
      setDesign((d) => {
        const building = (d.buildings ?? []).find(
          (b) => b.id === drag.buildingId,
        );
        const opening = building?.openings?.find((o) => o.id === drag.id);
        if (!building || !opening || building.outline.length < 2) return d;
        const n = building.outline.length;
        const edgeIndex = ((opening.edgeIndex % n) + n) % n;
        const edgeA = building.outline[edgeIndex];
        const edgeB = building.outline[(edgeIndex + 1) % n];
        const edgeLen = segmentLengthMm(edgeA, edgeB);
        if (edgeLen < 1e-6) return d;
        const tRaw =
          ((point.x - edgeA.x) * (edgeB.x - edgeA.x) +
            (point.y - edgeA.y) * (edgeB.y - edgeA.y)) /
          (edgeLen * edgeLen);
        const t = clampOpeningT(edgeLen, opening.widthMm, tRaw);
        return {
          ...d,
          buildings: (d.buildings ?? []).map((b) =>
            b.id === drag.buildingId
              ? {
                  ...b,
                  openings: (b.openings ?? []).map((o) =>
                    o.id === drag.id ? { ...o, t } : o,
                  ),
                }
              : b,
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
      drag?.mode === "opening" ||
      drag?.mode === "rotate"
    ) {
      let next = designRef.current;
      // After reshaping a spa shell, reflow benches/equipment/plumbing inside.
      if (drag.mode === "vertex" && drag.kind === "pool") {
        const body = next.poolBodies.find((p) => p.id === drag.id);
        if (body && waterBodyKind(body) === "spa") {
          next = relayoutSpaPackage(next, body);
          setDesign(next);
          designRef.current = next;
        }
      }
      // After moving pad gear or water fixtures, re-route body plumbing once.
      if (drag.mode === "move" && drag.kind === "object") {
        const synced = syncPlumbingAfterObjectChange(next, drag.id);
        if (synced !== next) {
          next = synced;
          setDesign(next);
          designRef.current = next;
        }
      }
      // Pool/spa shell move: rebuild that body's auto runs to the pad.
      if (drag.mode === "move" && drag.kind === "pool") {
        next = rebuildBodyPlumbing(next, drag.id);
        setDesign(next);
        designRef.current = next;
      }
      const origin = dragOriginRef.current;
      if (origin) {
        setPast((p) => [...p.slice(-49), origin]);
        setFuture([]);
      }
      dragOriginRef.current = null;
      void persist(next);
    }
    setDrag(null);
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    // Always block browser/page zoom gestures over the canvas.
    e.preventDefault();
    if (!zoomEnabled) return;
    const local = canvasLocal(e);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setVp((v) => zoomAt(v, local.x, local.y, factor));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Never treat form-field keystrokes as canvas shortcuts (e.g. Backspace in name).
    const typingTarget = e.target as HTMLElement | null;
    const isTypingInField =
      !!typingTarget &&
      (typingTarget.tagName === "INPUT" ||
        typingTarget.tagName === "TEXTAREA" ||
        typingTarget.tagName === "SELECT" ||
        typingTarget.isContentEditable);

    if (e.key === "Shift") {
      setShiftDown(true);
      return;
    }
    if (isTypingInField) return;

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
    // Plain Z (not typing a length): hold to temporarily enable scroll-zoom.
    if (
      (e.key === "z" || e.key === "Z") &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !lengthBuffer
    ) {
      e.preventDefault();
      setZDown(true);
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
    // Backspace only edits the typed-length buffer while drawing — never deletes objects.
    // Object removal is via the Properties "Delete" button only.
    if (e.key === "Backspace" && lengthBuffer) {
      e.preventDefault();
      setLengthBuffer((b) => b.slice(0, -1));
      return;
    }

    // Typed length while drawing
    if (
      draftPoints.length > 0 &&
      (tool === "plumbing" ||
        tool === "pool_poly" ||
        tool === "patio" ||
        tool === "pool_rect" ||
        tool === "house_poly" ||
        tool === "house_rect" ||
        tool === "cover_rect") &&
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
    if (e.key === "Shift") setShiftDown(false);
    if (e.code === "Space") setSpaceDown(false);
    if (e.key === "z" || e.key === "Z") setZDown(false);
  }

  const toolHelp =
    tool === "house_rect"
      ? draftPoints.length === 0
        ? "House footprint: click first corner of one side, then second, then depth."
        : draftPoints.length === 1
          ? "Second corner of this side (Shift = 90°). Set stories below."
          : "Click to set the house depth. Stories can be changed in Properties."
      : tool === "house_poly"
        ? "Trace the house footprint. Hold Shift for 90°. Close near start. Set stories below."
        : tool === "opening"
          ? `Click a house wall to place a ${openingKindLabel(openingKind).toLowerCase()}. Edit width/height in Properties; drag to slide along the wall.`
          : tool === "cover_rect"
          ? draftPoints.length === 0
            ? coverKind === "roof"
              ? "Patio roof: click first corner of one side, then second, then depth."
              : "Pergola: click first corner of one side, then second, then depth."
            : draftPoints.length === 1
              ? "Second corner of this side (Shift = 90°). Type length + Enter for exact width."
              : "Click to set depth (or type length + Enter). Links to the nearest patio when possible."
          : tool === "pool_rect"
            ? draftPoints.length === 0
              ? waterKind === "spa"
                ? "Click first corner of one side. Then second corner, then depth."
                : "Click first corner of one side. Then second corner, then depth to finish the box."
              : draftPoints.length === 1
                ? "Click the second corner of this side (Shift = 90°). Type length + Enter for exact width."
                : "Click to set the box depth (or type length + Enter). Package / pool is created on this click."
            : tool === "steps" || tool === "bench" || tool === "sunshelf"
              ? tool === "sunshelf"
                ? "Click two corners for a sunshelf / tanning ledge inside the pool. Set water depth in Properties."
                : "Click two corners for an in-pool steps or bench rectangle."
              : tool === "pool_poly"
                ? waterKind === "spa"
                  ? "Trace spa outline. Hold Shift for 90° lines. Close near start."
                  : "Click pool corners. Hold Shift for 90° lines. Type length + Enter. Close near start."
                : tool === "patio"
                  ? "Click corners. Hold Shift for 90° lines. Type length + Enter. Close near start."
                  : tool === "plumbing"
                    ? "Click segments. Hold Shift (or Ortho) for 90° lines. Type length + Enter."
                    : isPadEquipTool(tool)
                      ? `Click to place ${placeItem?.name ?? "equipment"}. Pools/spas auto-route plumbing to the pad.`
                      : tool === "place"
                        ? "Pick furniture/fixture, then click to place. R rotates 15°."
                        : tool === "measure"
                          ? "Click two points to measure distance. Esc clears."
                          : "Select to move/edit. Hold Shift while dragging a vertex for 90° edges.";

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
                    tool === "patio" ||
                    tool === "house_poly"
                  ) {
                    finishDraft();
                  }
                }}
              />
              <div className="hud">
                <div>
                  {(tool === "pool_rect" ||
                    tool === "house_rect" ||
                    tool === "cover_rect") &&
                  draftPoints.length === 2
                    ? "Depth"
                    : "Segment"}
                  :{" "}
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
              <div className="cad-tools-scroll">
                <CadToolPalette
                  tool={tool}
                  waterKind={waterKind}
                  coverKind={coverKind}
                  openingKind={openingKind}
                  houseStories={houseStories}
                  placeItemId={placeItemId}
                  placeLibrary={placeLibrary}
                  poolFixtureLibrary={poolFixtureLibrary}
                  spaFixtureLibrary={spaFixtureLibrary}
                  toolHelp={toolHelp}
                  ortho={ortho}
                  angleSnap={angleSnap}
                  zoomUnlocked={zoomUnlocked}
                  zDown={zDown}
                  canUndo={past.length > 0}
                  canRedo={future.length > 0}
                  lengthBuffer={lengthBuffer}
                  showFinishDraft={
                    tool === "pool_poly" ||
                    tool === "patio" ||
                    tool === "house_poly" ||
                    tool === "plumbing"
                  }
                  finishDraftLabel={
                    tool === "plumbing" ? "Finish run" : "Close shape"
                  }
                  canFinishDraft={
                    tool === "plumbing"
                      ? draftPoints.length >= 2
                      : draftPoints.length >= 3
                  }
                  onTool={(next) => {
                    setTool(next);
                    setDraftPoints([]);
                    setLengthBuffer("");
                    if (next !== "measure") setMeasurePoints([]);
                  }}
                  onWaterKind={setWaterKind}
                  onCoverKind={setCoverKind}
                  onOpeningKind={setOpeningKind}
                  onHouseStories={setHouseStories}
                  onPlaceItemId={setPlaceItemId}
                  onOrtho={() => setOrtho((v) => !v)}
                  onAngleSnap={() => setAngleSnap((v) => !v)}
                  onUndo={undo}
                  onRedo={redo}
                  onToggleZoom={() => setZoomUnlocked((v) => !v)}
                  onFinishDraft={finishDraft}
                  setVp={setVp}
                />
                <div className="stack cad-side-section">
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
                    <div>Hold Z + scroll to zoom · Space-drag pan</div>
                    <div>Zoom button unlocks free scroll-zoom</div>
                    <div>Shift — temporary 90° lines while drawing/editing</div>
                    <div>O — sticky Ortho · A — 15° snap</div>
                    <div>R / handle — rotate furniture</div>
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
              <div className="cad-tools-scroll cad-tab-panel" role="tabpanel">
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
                      {waterBodyKind(selectedPool) === "spa" ? "Spa" : "Pool"} ·{" "}
                      {formatArea(
                        polygonAreaMm2(selectedPool.outline),
                        unitSystem,
                      )}
                    </div>
                    <div className="cad-kind-toggle" role="group" aria-label="Type">
                      {(
                        [
                          ["pool", "Pool"],
                          ["spa", "Spa"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={`cad-kind-btn ${waterBodyKind(selectedPool) === id ? "active" : ""}`}
                          onClick={() => {
                            if (waterBodyKind(selectedPool) === id) return;
                            if (id === "spa") {
                              const updated: PoolBody = {
                                ...selectedPool,
                                kind: "spa",
                                name: selectedPool.name.startsWith("Pool")
                                  ? selectedPool.name.replace(/^Pool/, "Spa")
                                  : selectedPool.name,
                                depthShallowMm: DEFAULT_SPA_DEPTH_MM,
                                depthDeepMm: DEFAULT_SPA_DEPTH_MM,
                                wallThicknessMm:
                                  selectedPool.wallThicknessMm ??
                                  DEFAULT_SPA_WALL_THICKNESS_MM,
                                shellHeightMm:
                                  selectedPool.shellHeightMm ??
                                  DEFAULT_SPA_SHELL_HEIGHT_MM,
                              };
                              const withKind = {
                                ...design,
                                poolBodies: design.poolBodies.map((p) =>
                                  p.id === selectedPool.id ? updated : p,
                                ),
                              };
                              commitDesign(resetSpaPackage(withKind, updated));
                            } else {
                              // Drop spa package (benches/jets/spa runs), then
                              // re-route standard pool plumbing to pad equipment.
                              const asPool: PoolBody = {
                                ...selectedPool,
                                kind: "pool",
                                name: selectedPool.name.startsWith("Spa")
                                  ? selectedPool.name.replace(/^Spa/, "Pool")
                                  : selectedPool.name,
                                depthShallowMm: DEFAULT_POOL_SHALLOW_MM,
                                depthDeepMm: DEFAULT_POOL_DEEP_MM,
                              };
                              const stripped = stripBodyChildren(
                                design,
                                selectedPool.id,
                              );
                              const withPool: DesignDocument = {
                                ...stripped,
                                poolBodies: stripped.poolBodies.map((p) =>
                                  p.id === selectedPool.id ? asPool : p,
                                ),
                              };
                              commitDesign(connectBodiesToEquipment(withPool));
                            }
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <DepthFields
                      key={`${selectedPool.id}-${waterBodyKind(selectedPool)}`}
                      shallowMm={selectedPool.depthShallowMm}
                      deepMm={selectedPool.depthDeepMm}
                      unitSystem={unitSystem}
                      spa={waterBodyKind(selectedPool) === "spa"}
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
                    {waterBodyKind(selectedPool) === "spa" && (
                      <SpaDimensionFields
                        key={`spa-dims-${selectedPool.id}-${selectedPool.outline.map((p) => `${p.x},${p.y}`).join("|")}-${spaWallThicknessMm(selectedPool)}-${spaShellHeightMm(selectedPool)}`}
                        body={selectedPool}
                        unitSystem={unitSystem}
                        onOutsideSize={(widthMm, depthMm) => {
                          const outline = resizeAxisAlignedOutline(
                            selectedPool.outline,
                            widthMm,
                            depthMm,
                          );
                          const updated = { ...selectedPool, outline };
                          commitDesign(
                            relayoutSpaPackage(
                              {
                                ...design,
                                poolBodies: design.poolBodies.map((p) =>
                                  p.id === selectedPool.id ? updated : p,
                                ),
                              },
                              updated,
                            ),
                          );
                        }}
                        onWallThickness={(wallThicknessMm) => {
                          const updated = {
                            ...selectedPool,
                            wallThicknessMm,
                          };
                          commitDesign(
                            relayoutSpaPackage(
                              {
                                ...design,
                                poolBodies: design.poolBodies.map((p) =>
                                  p.id === selectedPool.id ? updated : p,
                                ),
                              },
                              updated,
                            ),
                          );
                        }}
                        onShellHeight={(shellHeightMm) =>
                          commitDesign({
                            ...design,
                            poolBodies: design.poolBodies.map((p) =>
                              p.id === selectedPool.id
                                ? { ...p, shellHeightMm }
                                : p,
                            ),
                          })
                        }
                      />
                    )}
                    {waterBodyKind(selectedPool) === "spa" && (
                      <div className="stack" style={{ gap: "0.4rem" }}>
                        <strong style={{ fontSize: "0.9rem" }}>
                          Spa package
                        </strong>
                        <p
                          className="muted"
                          style={{ margin: 0, fontSize: "0.8rem" }}
                        >
                          Outside shell dims drive layout. Package items sit on
                          the inside waterline and reflow when you resize.
                        </p>
                        {[
                          ...selectedPoolChildren.features.map((f) => ({
                            id: f.id,
                            kind: "feature" as const,
                            label: f.name,
                          })),
                          ...selectedPoolChildren.objects.map((o) => ({
                            id: o.id,
                            kind: "object" as const,
                            label: o.name,
                          })),
                          ...selectedPoolChildren.runs.map((r) => ({
                            id: r.id,
                            kind: "run" as const,
                            label: r.name,
                          })),
                        ].map((item) => (
                          <button
                            key={`${item.kind}-${item.id}`}
                            type="button"
                            className="card-link"
                            style={{
                              textAlign: "left",
                              padding: "0.5rem 0.65rem",
                              fontSize: "0.85rem",
                            }}
                            onClick={() =>
                              setSelection({ kind: item.kind, id: item.id })
                            }
                          >
                            {item.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() =>
                            commitDesign(
                              resetSpaPackage(design, selectedPool),
                            )
                          }
                        >
                          Reset spa package
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn danger"
                      onClick={deleteSelection}
                    >
                      Delete
                      {waterBodyKind(selectedPool) === "spa"
                        ? " spa & package"
                        : ""}
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
                {selectedOpening && (
                  <div className="stack">
                    <strong>
                      {openingKindLabel(selectedOpening.opening.kind)}
                    </strong>
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      On {selectedOpening.building.name}
                    </div>
                    <div className="field">
                      <label htmlFor="opening-kind">Type</label>
                      <select
                        id="opening-kind"
                        value={selectedOpening.opening.kind}
                        onChange={(e) => {
                          const kind = e.target.value as BuildingOpeningKind;
                          const defaults = defaultOpeningSize(kind);
                          commitDesign({
                            ...design,
                            buildings: (design.buildings ?? []).map((b) =>
                              b.id === selectedOpening.building.id
                                ? {
                                    ...b,
                                    openings: (b.openings ?? []).map((o) =>
                                      o.id === selectedOpening.opening.id
                                        ? {
                                            ...o,
                                            kind,
                                            widthMm: defaults.widthMm,
                                            heightMm: defaults.heightMm,
                                            t: clampOpeningT(
                                              (() => {
                                                const n = b.outline.length;
                                                const i =
                                                  ((o.edgeIndex % n) + n) % n;
                                                return segmentLengthMm(
                                                  b.outline[i],
                                                  b.outline[(i + 1) % n],
                                                );
                                              })(),
                                              defaults.widthMm,
                                              o.t,
                                            ),
                                          }
                                        : o,
                                    ),
                                  }
                                : b,
                            ),
                          });
                        }}
                      >
                        <option value="door">Door</option>
                        <option value="sliding_door">Sliding door</option>
                        <option value="window">Window</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="opening-width">Width</label>
                      <input
                        id="opening-width"
                        key={`opening-w-${selectedOpening.opening.id}-${selectedOpening.opening.widthMm}`}
                        defaultValue={formatLength(
                          selectedOpening.opening.widthMm,
                          unitSystem,
                        )}
                        onBlur={(e) => {
                          const mm = parseLengthToMm(
                            e.target.value,
                            unitSystem,
                          );
                          if (mm == null || mm <= 0) return;
                          const b = selectedOpening.building;
                          const n = b.outline.length;
                          const i =
                            ((selectedOpening.opening.edgeIndex % n) + n) % n;
                          const edgeLen = segmentLengthMm(
                            b.outline[i],
                            b.outline[(i + 1) % n],
                          );
                          const widthMm = Math.min(mm, edgeLen);
                          commitDesign({
                            ...design,
                            buildings: (design.buildings ?? []).map((bld) =>
                              bld.id === b.id
                                ? {
                                    ...bld,
                                    openings: (bld.openings ?? []).map((o) =>
                                      o.id === selectedOpening.opening.id
                                        ? {
                                            ...o,
                                            widthMm,
                                            t: clampOpeningT(
                                              edgeLen,
                                              widthMm,
                                              o.t,
                                            ),
                                          }
                                        : o,
                                    ),
                                  }
                                : bld,
                            ),
                          });
                        }}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="opening-height">Height</label>
                      <input
                        id="opening-height"
                        key={`opening-h-${selectedOpening.opening.id}-${selectedOpening.opening.heightMm}`}
                        defaultValue={formatLength(
                          selectedOpening.opening.heightMm,
                          unitSystem,
                        )}
                        onBlur={(e) => {
                          const mm = parseLengthToMm(
                            e.target.value,
                            unitSystem,
                          );
                          if (mm == null || mm <= 0) return;
                          commitDesign({
                            ...design,
                            buildings: (design.buildings ?? []).map((bld) =>
                              bld.id === selectedOpening.building.id
                                ? {
                                    ...bld,
                                    openings: (bld.openings ?? []).map((o) =>
                                      o.id === selectedOpening.opening.id
                                        ? { ...o, heightMm: mm }
                                        : o,
                                    ),
                                  }
                                : bld,
                            ),
                          });
                        }}
                      />
                    </div>
                    <p
                      className="muted"
                      style={{ margin: 0, fontSize: "0.78rem" }}
                    >
                      Defaults: door 3′×6′8″, sliding 6′×6′8″, window 3′×4′.
                      Drag on the plan to slide along the wall.
                    </p>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={deleteSelection}
                    >
                      Delete
                    </button>
                  </div>
                )}
                {selectedBuilding && (
                  <div className="stack">
                    <strong>{selectedBuilding.name}</strong>
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      {formatArea(
                        polygonAreaMm2(selectedBuilding.outline),
                        unitSystem,
                      )}{" "}
                      footprint
                    </div>
                    <div className="field">
                      <label htmlFor="bldg-name">Name</label>
                      <input
                        id="bldg-name"
                        key={`bldg-name-${selectedBuilding.id}`}
                        defaultValue={selectedBuilding.name}
                        onBlur={(e) => {
                          const name = e.target.value.trim();
                          if (!name) return;
                          commitDesign({
                            ...design,
                            buildings: (design.buildings ?? []).map((b) =>
                              b.id === selectedBuilding.id
                                ? { ...b, name }
                                : b,
                            ),
                          });
                        }}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="bldg-stories">Stories</label>
                      <input
                        id="bldg-stories"
                        type="number"
                        min={1}
                        max={12}
                        step={1}
                        key={`bldg-stories-${selectedBuilding.id}-${selectedBuilding.stories}`}
                        defaultValue={selectedBuilding.stories}
                        onBlur={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n) || n < 1) return;
                          commitDesign({
                            ...design,
                            buildings: (design.buildings ?? []).map((b) =>
                              b.id === selectedBuilding.id
                                ? {
                                    ...b,
                                    stories: Math.min(12, Math.round(n)),
                                  }
                                : b,
                            ),
                          });
                        }}
                      />
                    </div>
                    <p
                      className="muted"
                      style={{ margin: 0, fontSize: "0.78rem" }}
                    >
                      Use 2+ for multi-story homes. Footprint stays the same;
                      story count is noted on the plan.
                      {(selectedBuilding.openings ?? []).length > 0
                        ? ` ${(selectedBuilding.openings ?? []).length} opening(s) on walls — select an opening to edit size.`
                        : " Use the Door / window tool to click openings onto walls."}
                    </p>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={deleteSelection}
                    >
                      Delete
                    </button>
                  </div>
                )}
                {selectedCover && (
                  <div className="stack">
                    <strong>{selectedCover.name}</strong>
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      {formatArea(
                        polygonAreaMm2(selectedCover.outline),
                        unitSystem,
                      )}{" "}
                      {selectedCover.kind === "roof" ? "roof" : "pergola"}
                    </div>
                    <div className="field">
                      <label htmlFor="cover-name">Name</label>
                      <input
                        id="cover-name"
                        key={`cover-name-${selectedCover.id}`}
                        defaultValue={selectedCover.name}
                        onBlur={(e) => {
                          const name = e.target.value.trim();
                          if (!name) return;
                          commitDesign({
                            ...design,
                            patioCovers: (design.patioCovers ?? []).map((c) =>
                              c.id === selectedCover.id ? { ...c, name } : c,
                            ),
                          });
                        }}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="cover-kind">Type</label>
                      <select
                        id="cover-kind"
                        value={selectedCover.kind}
                        onChange={(e) => {
                          const kind = e.target.value as PatioCoverKind;
                          commitDesign({
                            ...design,
                            patioCovers: (design.patioCovers ?? []).map((c) =>
                              c.id === selectedCover.id
                                ? {
                                    ...c,
                                    kind,
                                    heightMm:
                                      c.heightMm ??
                                      (kind === "roof"
                                        ? DEFAULT_PATIO_ROOF_HEIGHT_MM
                                        : DEFAULT_PERGOLA_HEIGHT_MM),
                                  }
                                : c,
                            ),
                          });
                        }}
                      >
                        <option value="pergola">Pergola</option>
                        <option value="roof">Solid patio roof</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="cover-height">Height above deck</label>
                      <input
                        id="cover-height"
                        key={`cover-height-${selectedCover.id}-${selectedCover.heightMm}`}
                        defaultValue={formatLength(
                          selectedCover.heightMm ??
                            (selectedCover.kind === "roof"
                              ? DEFAULT_PATIO_ROOF_HEIGHT_MM
                              : DEFAULT_PERGOLA_HEIGHT_MM),
                          unitSystem,
                        )}
                        onBlur={(e) => {
                          const mm = parseLengthToMm(e.target.value, unitSystem);
                          if (mm == null || mm <= 0) return;
                          commitDesign({
                            ...design,
                            patioCovers: (design.patioCovers ?? []).map((c) =>
                              c.id === selectedCover.id
                                ? { ...c, heightMm: mm }
                                : c,
                            ),
                          });
                        }}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="cover-patio">Linked patio</label>
                      <select
                        id="cover-patio"
                        value={selectedCover.patioId ?? ""}
                        onChange={(e) => {
                          const patioId = e.target.value || undefined;
                          commitDesign({
                            ...design,
                            patioCovers: (design.patioCovers ?? []).map((c) =>
                              c.id === selectedCover.id
                                ? { ...c, patioId }
                                : c,
                            ),
                          });
                        }}
                      >
                        <option value="">None</option>
                        {design.patios.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
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
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      {selectedFeature.kind === "sunshelf"
                        ? "Sunshelf / tanning ledge"
                        : selectedFeature.kind === "steps"
                          ? "Steps"
                          : "Bench"}
                      {" · "}
                      {formatArea(
                        polygonAreaMm2(selectedFeature.outline),
                        unitSystem,
                      )}
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
                    {selectedFeature.kind === "sunshelf" && (
                      <div className="field">
                        <label htmlFor="sunshelf-depth">Water depth</label>
                        <input
                          id="sunshelf-depth"
                          key={`shelf-d-${selectedFeature.id}-${selectedFeature.depthMm}`}
                          defaultValue={formatLength(
                            selectedFeature.depthMm ??
                              DEFAULT_SUNSHELF_DEPTH_MM,
                            unitSystem,
                          )}
                          onBlur={(e) => {
                            const mm = parseLengthToMm(
                              e.target.value,
                              unitSystem,
                            );
                            if (mm == null || mm <= 0) return;
                            commitDesign({
                              ...design,
                              features: (design.features ?? []).map((f) =>
                                f.id === selectedFeature.id
                                  ? { ...f, depthMm: mm }
                                  : f,
                              ),
                            });
                          }}
                        />
                        <p
                          className="muted"
                          style={{
                            margin: "0.25rem 0 0",
                            fontSize: "0.75rem",
                          }}
                        >
                          Typical sunshelf depth is about 9″. Footprint area
                          rolls into the estimate.
                        </p>
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
              <div className="cad-tools-scroll cad-tab-panel" role="tabpanel">
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

function SpaDimensionFields({
  body,
  unitSystem,
  onOutsideSize,
  onWallThickness,
  onShellHeight,
}: {
  body: PoolBody;
  unitSystem: UnitSystem;
  onOutsideSize: (widthMm: number, depthMm: number) => void;
  onWallThickness: (wallThicknessMm: number) => void;
  onShellHeight: (shellHeightMm: number) => void;
}) {
  const outside = outlineBounds(body.outline);
  const wall = spaWallThicknessMm(body);
  const shellHeight = spaShellHeightMm(body);
  const inside = insideBoundsFromOutside(body.outline, wall);
  const rect = isAxisAlignedRect(body.outline);

  return (
    <div className="stack" style={{ gap: "0.55rem" }}>
      <strong style={{ fontSize: "0.9rem" }}>Outside dimensions</strong>
      <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
        You draw and edit the outside shell. Inside waterline = outside − wall
        thickness on each side.
      </p>
      {rect ? (
        <>
          <div className="field">
            <label htmlFor="spa-out-w">Outside width</label>
            <input
              id="spa-out-w"
              defaultValue={formatLength(outside.width, unitSystem)}
              onBlur={(e) => {
                const mm = parseLengthToMm(e.target.value, unitSystem);
                if (mm != null && mm > wall * 2 + 50) {
                  onOutsideSize(mm, outside.height);
                }
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="spa-out-d">Outside length</label>
            <input
              id="spa-out-d"
              defaultValue={formatLength(outside.height, unitSystem)}
              onBlur={(e) => {
                const mm = parseLengthToMm(e.target.value, unitSystem);
                if (mm != null && mm > wall * 2 + 50) {
                  onOutsideSize(outside.width, mm);
                }
              }}
            />
          </div>
        </>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
          Drag shell vertices to resize — package reflows when you release.
        </p>
      )}
      <div className="field">
        <label htmlFor="spa-wall">Wall thickness</label>
        <input
          id="spa-wall"
          defaultValue={formatLength(wall, unitSystem)}
          onBlur={(e) => {
            const mm = parseLengthToMm(e.target.value, unitSystem);
            if (mm != null && mm >= 0) onWallThickness(mm);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="spa-shell-h">Shell height (above deck)</label>
        <input
          id="spa-shell-h"
          defaultValue={formatLength(shellHeight, unitSystem)}
          onBlur={(e) => {
            const mm = parseLengthToMm(e.target.value, unitSystem);
            if (mm != null && mm >= 0) onShellHeight(mm);
          }}
        />
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
        Raised spa wall height above the surrounding deck — set per customer.
      </p>
      <div className="muted" style={{ fontSize: "0.8rem" }}>
        Inside waterline: {formatLength(inside.width, unitSystem)} ×{" "}
        {formatLength(inside.height, unitSystem)}
      </div>
    </div>
  );
}

function DepthFields({
  shallowMm,
  deepMm,
  unitSystem,
  onChange,
  spa = false,
}: {
  shallowMm: number;
  deepMm: number;
  unitSystem: UnitSystem;
  onChange: (shallowMm: number, deepMm: number) => void;
  spa?: boolean;
}) {
  if (spa) {
    return (
      <div className="field">
        <label htmlFor="spa-depth">Water depth</label>
        <input
          id="spa-depth"
          defaultValue={formatLength(shallowMm, unitSystem)}
          onBlur={(e) => {
            const mm = parseLengthToMm(e.target.value, unitSystem);
            if (mm != null) onChange(mm, mm);
          }}
        />
      </div>
    );
  }
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

function nearestWaterBodyId(
  bodies: PoolBody[],
  point: PointMm,
): string | undefined {
  for (let i = bodies.length - 1; i >= 0; i--) {
    if (pointInPolygon(point, bodies[i].outline)) return bodies[i].id;
  }
  // Fallback: nearest body center if click is just outside the shell
  let best: { id: string; d: number } | null = null;
  for (const body of bodies) {
    const b = outlineBounds(body.outline);
    const d = Math.hypot(point.x - b.cx, point.y - b.cy);
    if (!best || d < best.d) best = { id: body.id, d };
  }
  return best && best.d < 3000 ? best.id : undefined;
}

function placeLibraryItem(
  design: DesignDocument,
  item: PlaceableItem,
  position: PointMm,
  parentBodyId?: string,
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
    parentBodyId,
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

function nearestBuildingEdge(
  buildings: Building[],
  point: PointMm,
  maxDistMm: number,
): {
  buildingId: string;
  edgeIndex: number;
  t: number;
  edgeA: PointMm;
  edgeB: PointMm;
  dist: number;
} | null {
  let best: {
    buildingId: string;
    edgeIndex: number;
    t: number;
    edgeA: PointMm;
    edgeB: PointMm;
    dist: number;
  } | null = null;
  for (const building of buildings) {
    const outline = building.outline;
    if (outline.length < 2) continue;
    for (let i = 0; i < outline.length; i++) {
      const edgeA = outline[i];
      const edgeB = outline[(i + 1) % outline.length];
      const edgeLen = segmentLengthMm(edgeA, edgeB);
      if (edgeLen < 1e-6) continue;
      const tRaw =
        ((point.x - edgeA.x) * (edgeB.x - edgeA.x) +
          (point.y - edgeA.y) * (edgeB.y - edgeA.y)) /
        (edgeLen * edgeLen);
      const tClamped = Math.min(1, Math.max(0, tRaw));
      const proj = {
        x: edgeA.x + (edgeB.x - edgeA.x) * tClamped,
        y: edgeA.y + (edgeB.y - edgeA.y) * tClamped,
      };
      const dist = segmentLengthMm(point, proj);
      if (dist > maxDistMm) continue;
      if (!best || dist < best.dist) {
        best = {
          buildingId: building.id,
          edgeIndex: i,
          t: tClamped,
          edgeA,
          edgeB,
          dist,
        };
      }
    }
  }
  return best;
}

function nearestPatioId(
  patios: PatioRegion[],
  outline: PointMm[],
): string | undefined {
  if (!patios.length) return undefined;
  const { cx, cy } = outlineBounds(outline);
  const center = { x: cx, y: cy };
  for (const patio of patios) {
    if (pointInPolygon(center, patio.outline)) return patio.id;
  }
  let bestId: string | undefined;
  let bestDist = Infinity;
  for (const patio of patios) {
    const pb = outlineBounds(patio.outline);
    const d = Math.hypot(cx - pb.cx, cy - pb.cy);
    if (d < bestDist) {
      bestDist = d;
      bestId = patio.id;
    }
  }
  return bestId;
}

function translateDesign(
  d: DesignDocument,
  kind: "pool" | "patio" | "building" | "cover" | "run" | "object" | "feature",
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
      features: (d.features ?? []).map((f) =>
        f.poolBodyId === id ? { ...f, outline: f.outline.map(shift) } : f,
      ),
      objects: d.objects.map((o) =>
        o.parentBodyId === id ? { ...o, position: shift(o.position) } : o,
      ),
      plumbingRuns: d.plumbingRuns.map((r) =>
        r.parentBodyId === id ? { ...r, points: r.points.map(shift) } : r,
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
  if (kind === "building") {
    return {
      ...d,
      buildings: (d.buildings ?? []).map((b) =>
        b.id === id ? { ...b, outline: b.outline.map(shift) } : b,
      ),
    };
  }
  if (kind === "cover") {
    return {
      ...d,
      patioCovers: (d.patioCovers ?? []).map((c) =>
        c.id === id ? { ...c, outline: c.outline.map(shift) } : c,
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
