"use client";

import {
  ACTION_ICONS,
  ToolTooltip,
  toolMeta,
  type ToolId,
} from "@/components/CadToolIcons";
import { DEFAULT_VIEWPORT, type Viewport } from "@/lib/cad/math";

type Props = {
  tool: ToolId;
  ortho: boolean;
  angleSnap: boolean;
  zoomUnlocked: boolean;
  zDown: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (tool: ToolId) => void;
  onOrtho: () => void;
  onAngleSnap: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleZoom: () => void;
  setVp: (vp: Viewport | ((v: Viewport) => Viewport)) => void;
};

export function CadDrawRail({
  tool,
  ortho,
  angleSnap,
  zoomUnlocked,
  zDown,
  canUndo,
  canRedo,
  onTool,
  onOrtho,
  onAngleSnap,
  onUndo,
  onRedo,
  onToggleZoom,
  setVp,
}: Props) {
  return (
    <aside className="cad-draw-rail" aria-label="Drawing tools">
      <button
        type="button"
        className={`tool-icon-btn ${tool === "select" ? "active" : ""}`}
        title="Select / edit"
        aria-label="Select / edit"
        onClick={() => onTool("select")}
      >
        {toolMeta("select").icon}
        <ToolTooltip label="Select / edit" />
      </button>
      <button
        type="button"
        className={`tool-icon-btn ${tool === "measure" ? "active" : ""}`}
        title="Measure"
        aria-label="Measure"
        onClick={() => onTool("measure")}
      >
        {toolMeta("measure").icon}
        <ToolTooltip label="Measure" />
      </button>
      <button
        type="button"
        className={`tool-icon-btn ${tool === "survey_calibrate" ? "active" : ""}`}
        title="Calibrate survey"
        aria-label="Calibrate survey"
        onClick={() => onTool("survey_calibrate")}
      >
        {toolMeta("survey_calibrate").icon}
        <ToolTooltip label="Calibrate survey" />
      </button>
      <span className="cad-draw-rail-rule" aria-hidden />
      <button
        type="button"
        className={`tool-icon-btn ${ortho ? "active" : ""}`}
        title={
          ortho
            ? "Ortho on — 90° lines sticky (or hold Shift)"
            : "Ortho off — hold Shift for temporary 90°"
        }
        aria-label="Toggle ortho"
        onClick={onOrtho}
      >
        {ACTION_ICONS.ortho}
        <ToolTooltip
          label={
            ortho ? "Ortho on (90° sticky)" : "Ortho off — hold Shift for 90°"
          }
        />
      </button>
      <button
        type="button"
        className={`tool-icon-btn ${angleSnap ? "active" : ""}`}
        title={`15° snap ${angleSnap ? "on" : "off"}`}
        aria-label="Toggle angle snap"
        onClick={onAngleSnap}
      >
        {ACTION_ICONS.angle}
        <ToolTooltip label={angleSnap ? "15° snap on" : "15° snap off"} />
      </button>
      <button
        type="button"
        className="tool-icon-btn"
        title="Undo"
        aria-label="Undo"
        onClick={onUndo}
        disabled={!canUndo}
      >
        {ACTION_ICONS.undo}
        <ToolTooltip label="Undo" />
      </button>
      <button
        type="button"
        className="tool-icon-btn"
        title="Redo"
        aria-label="Redo"
        onClick={onRedo}
        disabled={!canRedo}
      >
        {ACTION_ICONS.redo}
        <ToolTooltip label="Redo" />
      </button>
      <button
        type="button"
        className={`tool-icon-btn ${zoomUnlocked || zDown ? "active" : ""}`}
        title={
          zoomUnlocked
            ? "Scroll-zoom unlocked — click to lock (or hold Z)"
            : "Scroll-zoom locked — hold Z to zoom, or click to unlock"
        }
        aria-label="Toggle scroll zoom"
        aria-pressed={zoomUnlocked}
        onClick={onToggleZoom}
      >
        {ACTION_ICONS.zoom}
        <ToolTooltip
          label={
            zoomUnlocked ? "Zoom unlocked (scroll)" : "Zoom locked — hold Z"
          }
        />
      </button>
      <button
        type="button"
        className="tool-icon-btn"
        title="Reset view"
        aria-label="Reset view"
        onClick={() => setVp(DEFAULT_VIEWPORT)}
      >
        {ACTION_ICONS.reset}
        <ToolTooltip label="Reset view" />
      </button>
    </aside>
  );
}
