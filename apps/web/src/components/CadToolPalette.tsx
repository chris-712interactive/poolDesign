"use client";

import { useEffect, useState } from "react";
import {
  ACTION_ICONS,
  PAD_EQUIP_TOOLS,
  TOOL_GROUPS,
  TOOL_REALMS,
  ToolTooltip,
  isPadEquipTool,
  realmForGroup,
  toolGroupForTool,
  toolMeta,
  type ToolGroupId,
  type ToolId,
  type ToolRealm,
} from "@/components/CadToolIcons";
import {
  fenceKindLabel,
  formatMoney,
  gateKindLabel,
  openingKindLabel,
  FENCE_KINDS,
  GATE_KINDS,
  type BuildingOpeningKind,
  type FenceKind,
  type GateKind,
  type PatioCoverKind,
  type PlaceableItem,
  type WaterBodyKind,
} from "@pool-design/shared";
import { DEFAULT_VIEWPORT, type Viewport } from "@/lib/cad/math";

type Props = {
  tool: ToolId;
  waterKind: WaterBodyKind;
  coverKind: PatioCoverKind;
  fenceKind: FenceKind;
  gateKind: GateKind;
  openingKind: BuildingOpeningKind;
  openingStory: number;
  planStoryFilter: "all" | number;
  houseStories: number;
  placeItemId: string | null;
  placeLibrary: PlaceableItem[];
  poolFixtureLibrary: PlaceableItem[];
  spaFixtureLibrary: PlaceableItem[];
  toolHelp: string;
  ortho: boolean;
  angleSnap: boolean;
  zoomUnlocked: boolean;
  zDown: boolean;
  canUndo: boolean;
  canRedo: boolean;
  lengthBuffer: string;
  canFinishDraft: boolean;
  finishDraftLabel: string;
  showFinishDraft: boolean;
  onTool: (tool: ToolId) => void;
  onWaterKind: (kind: WaterBodyKind) => void;
  onCoverKind: (kind: PatioCoverKind) => void;
  onFenceKind: (kind: FenceKind) => void;
  onGateKind: (kind: GateKind) => void;
  onOpeningKind: (kind: BuildingOpeningKind) => void;
  onOpeningStory: (n: number) => void;
  onPlanStoryFilter: (v: "all" | number) => void;
  onHouseStories: (n: number) => void;
  onPlaceItemId: (id: string) => void;
  onOrtho: () => void;
  onAngleSnap: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleZoom: () => void;
  onFinishDraft: () => void;
  setVp: (vp: Viewport | ((v: Viewport) => Viewport)) => void;
};

export function CadToolPalette({
  tool,
  waterKind,
  coverKind,
  fenceKind,
  gateKind,
  openingKind,
  openingStory,
  planStoryFilter,
  houseStories,
  placeItemId,
  placeLibrary,
  poolFixtureLibrary,
  spaFixtureLibrary,
  toolHelp,
  ortho,
  angleSnap,
  zoomUnlocked,
  zDown,
  canUndo,
  canRedo,
  lengthBuffer,
  canFinishDraft,
  finishDraftLabel,
  showFinishDraft,
  onTool,
  onWaterKind,
  onCoverKind,
  onFenceKind,
  onGateKind,
  onOpeningKind,
  onOpeningStory,
  onPlanStoryFilter,
  onHouseStories,
  onPlaceItemId,
  onOrtho,
  onAngleSnap,
  onUndo,
  onRedo,
  onToggleZoom,
  onFinishDraft,
  setVp,
}: Props) {
  const activeGroup = toolGroupForTool(tool, waterKind, placeItemId);
  const [realm, setRealm] = useState<ToolRealm>(
    activeGroup ? realmForGroup(activeGroup) : "land",
  );
  const [expandedGroup, setExpandedGroup] = useState<ToolGroupId | null>(
    activeGroup,
  );

  useEffect(() => {
    if (activeGroup) {
      setRealm(realmForGroup(activeGroup));
      setExpandedGroup(activeGroup);
    }
  }, [activeGroup]);

  const groups = TOOL_GROUPS.filter((g) => g.realm === realm);

  function activateDraw(next: ToolId, opts?: { waterKind?: WaterBodyKind }) {
    if (opts?.waterKind) onWaterKind(opts.waterKind);
    onTool(next);
  }

  function activatePlace(catalogItemId: string, group: ToolGroupId) {
    setExpandedGroup(group);
    onPlaceItemId(catalogItemId);
    onTool("place");
  }

  function toggleGroup(id: ToolGroupId) {
    setExpandedGroup((cur) => (cur === id ? null : id));
  }

  const helpText =
    tool === "opening"
      ? `Click a house wall to place a ${openingKindLabel(openingKind).toLowerCase()}.`
      : tool === "gate"
        ? `Click a fence run to place a ${gateKindLabel(gateKind).toLowerCase()} gate.`
        : tool === "fence"
          ? `Draw a ${fenceKindLabel(fenceKind).toLowerCase()} fence path. Finish when ready.`
          : tool === "cover_rect"
            ? coverKind === "roof"
              ? "Patio roof: side, then depth."
              : "Pergola: side, then depth."
            : toolHelp;

  return (
    <div className="cad-tab-panel" role="tabpanel">
      <div className="cad-icon-toolbar cad-icon-toolbar-3 cad-tools-core">
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
      </div>

      <div className="cad-side-tabs" role="tablist" aria-label="Tool realm">
        {TOOL_REALMS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={realm === r.id}
            className={`cad-side-tab ${realm === r.id ? "active" : ""}`}
            onClick={() => {
              setRealm(r.id);
              setExpandedGroup((cur) =>
                cur && realmForGroup(cur) === r.id ? cur : null,
              );
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="cad-tool-groups">
        {groups.map((group) => {
          const open = expandedGroup === group.id;
          const groupActive = activeGroup === group.id;
          return (
            <div
              key={group.id}
              className={`cad-tool-group ${open ? "open" : ""} ${groupActive ? "active" : ""}`}
            >
              <button
                type="button"
                className="cad-tool-group-head"
                aria-expanded={open}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="cad-tool-group-icon">{group.icon}</span>
                <span className="cad-tool-group-text">
                  <strong>{group.label}</strong>
                  <span className="muted">{group.hint}</span>
                </span>
                <span className="cad-tool-group-chevron" aria-hidden>
                  {open ? "▾" : "▸"}
                </span>
              </button>

              {open && (
                <div className="cad-tool-group-body">
                  {group.id === "pad" && (
                    <>
                      <p className="muted cad-tool-group-note">
                        Click a tool, then click the plan to place. Draw
                        pools/spas after for auto plumbing.
                      </p>
                      <div className="cad-icon-toolbar">
                        {PAD_EQUIP_TOOLS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`tool-icon-btn ${tool === item.id ? "active" : ""}`}
                            title={item.label}
                            aria-label={item.label}
                            onClick={() => onTool(item.id)}
                          >
                            {item.icon}
                            <ToolTooltip label={item.label} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {group.id === "furniture" && (
                    <div className="cad-compact-list cad-compact-list-tall">
                      {placeLibrary.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="card-link"
                          style={{
                            textAlign: "left",
                            padding: "0.65rem 0.75rem",
                            borderColor:
                              tool === "place" && placeItemId === item.id
                                ? "var(--accent)"
                                : undefined,
                          }}
                          onClick={() => activatePlace(item.id, "furniture")}
                        >
                          <strong>{item.name}</strong>
                          <div
                            className="muted"
                            style={{
                              fontSize: "0.8rem",
                              textTransform: "capitalize",
                            }}
                          >
                            {item.category === "furniture"
                              ? "Layout only · not billed"
                              : `${item.category} · ${formatMoney(item.unitPriceCents)}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {group.id === "patio" && (
                    <>
                      <div className="cad-icon-toolbar cad-icon-toolbar-3">
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "patio" ? "active" : ""}`}
                          title="Draw patio"
                          aria-label="Draw patio"
                          onClick={() => activateDraw("patio")}
                        >
                          {toolMeta("patio").icon}
                          <ToolTooltip label="Draw patio" />
                        </button>
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "grade_point" ? "active" : ""}`}
                          title="Grade point"
                          aria-label="Grade point"
                          onClick={() => activateDraw("grade_point")}
                        >
                          {toolMeta("grade_point").icon}
                          <ToolTooltip label="Grade point" />
                        </button>
                      </div>
                      <p className="muted cad-tool-group-note">
                        Grade points: drop/rise from house FFE. Set patio strategy
                        for fill and/or retaining.
                      </p>
                    </>
                  )}

                  {group.id === "cover" && (
                    <>
                      <div
                        className="cad-kind-toggle"
                        role="group"
                        aria-label="Cover type"
                      >
                        {(
                          [
                            ["pergola", "Pergola"],
                            ["roof", "Roof"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={`cad-kind-btn ${tool === "cover_rect" && coverKind === id ? "active" : ""}`}
                            onClick={() => {
                              onCoverKind(id);
                              activateDraw("cover_rect");
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="muted cad-tool-group-note">
                        3-click rectangle: side, then depth. Links to nearest
                        patio when possible.
                      </p>
                    </>
                  )}

                  {group.id === "fence" && (
                    <>
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="fence-kind-tool">Fence type</label>
                        <select
                          id="fence-kind-tool"
                          value={fenceKind}
                          onChange={(e) => {
                            onFenceKind(e.target.value as FenceKind);
                            activateDraw("fence");
                          }}
                        >
                          {FENCE_KINDS.map((id) => (
                            <option key={id} value={id}>
                              {fenceKindLabel(id)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="cad-icon-toolbar cad-icon-toolbar-2">
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "fence" ? "active" : ""}`}
                          title="Draw fence"
                          aria-label="Draw fence"
                          onClick={() => activateDraw("fence")}
                        >
                          {toolMeta("fence").icon}
                          <ToolTooltip label="Draw fence" />
                        </button>
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "gate" ? "active" : ""}`}
                          title="Place gate"
                          aria-label="Place gate"
                          onClick={() => activateDraw("gate")}
                        >
                          {toolMeta("gate").icon}
                          <ToolTooltip label="Place gate" />
                        </button>
                      </div>
                      <div
                        className="cad-kind-toggle cad-kind-toggle-3"
                        role="group"
                        aria-label="Gate type"
                      >
                        {GATE_KINDS.map((id) => (
                          <button
                            key={id}
                            type="button"
                            className={`cad-kind-btn ${tool === "gate" && gateKind === id ? "active" : ""}`}
                            onClick={() => {
                              onGateKind(id);
                              activateDraw("gate");
                            }}
                          >
                            {gateKindLabel(id)}
                          </button>
                        ))}
                      </div>
                      <p className="muted cad-tool-group-note">
                        Draw fence as a path, then place gates on fence
                        segments. Color is set in Properties.
                      </p>
                    </>
                  )}

                  {group.id === "pool" && (
                    <>
                      <strong className="cad-tool-subgroup-label">Shape</strong>
                      <div className="cad-icon-toolbar cad-icon-toolbar-5">
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "pool_rect" && waterKind === "pool" ? "active" : ""}`}
                          title="Pool rectangle"
                          aria-label="Pool rectangle"
                          onClick={() =>
                            activateDraw("pool_rect", { waterKind: "pool" })
                          }
                        >
                          {toolMeta("pool_rect").icon}
                          <ToolTooltip label="Pool rectangle" />
                        </button>
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "pool_poly" && waterKind === "pool" ? "active" : ""}`}
                          title="Pool polygon"
                          aria-label="Pool polygon"
                          onClick={() =>
                            activateDraw("pool_poly", { waterKind: "pool" })
                          }
                        >
                          {toolMeta("pool_poly").icon}
                          <ToolTooltip label="Pool polygon" />
                        </button>
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "steps" ? "active" : ""}`}
                          title="Steps"
                          aria-label="Steps"
                          onClick={() => activateDraw("steps")}
                        >
                          {toolMeta("steps").icon}
                          <ToolTooltip label="Steps" />
                        </button>
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "bench" ? "active" : ""}`}
                          title="Bench"
                          aria-label="Bench"
                          onClick={() => activateDraw("bench")}
                        >
                          {toolMeta("bench").icon}
                          <ToolTooltip label="Bench" />
                        </button>
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "sunshelf" ? "active" : ""}`}
                          title="Sunshelf"
                          aria-label="Sunshelf"
                          onClick={() => activateDraw("sunshelf")}
                        >
                          {toolMeta("sunshelf").icon}
                          <ToolTooltip label="Sunshelf" />
                        </button>
                      </div>
                      <strong className="cad-tool-subgroup-label">
                        Fixtures
                      </strong>
                      <div className="cad-compact-list">
                        {poolFixtureLibrary.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="card-link"
                            style={{
                              textAlign: "left",
                              padding: "0.65rem 0.75rem",
                              borderColor:
                                tool === "place" && placeItemId === item.id
                                  ? "var(--accent)"
                                  : undefined,
                            }}
                            onClick={() => activatePlace(item.id, "pool")}
                          >
                            <strong>{item.name}</strong>
                            <div
                              className="muted"
                              style={{ fontSize: "0.8rem" }}
                            >
                              {item.description ?? "Pool"} ·{" "}
                              {formatMoney(item.unitPriceCents)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {group.id === "spa" && (
                    <>
                      <strong className="cad-tool-subgroup-label">Shape</strong>
                      <div className="cad-icon-toolbar cad-icon-toolbar-2">
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "pool_rect" && waterKind === "spa" ? "active" : ""}`}
                          title="Spa rectangle"
                          aria-label="Spa rectangle"
                          onClick={() =>
                            activateDraw("pool_rect", { waterKind: "spa" })
                          }
                        >
                          {toolMeta("pool_rect").icon}
                          <ToolTooltip label="Spa rectangle" />
                        </button>
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "pool_poly" && waterKind === "spa" ? "active" : ""}`}
                          title="Spa polygon"
                          aria-label="Spa polygon"
                          onClick={() =>
                            activateDraw("pool_poly", { waterKind: "spa" })
                          }
                        >
                          {toolMeta("pool_poly").icon}
                          <ToolTooltip label="Spa polygon" />
                        </button>
                      </div>
                      <strong className="cad-tool-subgroup-label">
                        Fixtures
                      </strong>
                      <div className="cad-compact-list">
                        {spaFixtureLibrary.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="card-link"
                            style={{
                              textAlign: "left",
                              padding: "0.65rem 0.75rem",
                              borderColor:
                                tool === "place" && placeItemId === item.id
                                  ? "var(--accent)"
                                  : undefined,
                            }}
                            onClick={() => activatePlace(item.id, "spa")}
                          >
                            <strong>{item.name}</strong>
                            <div
                              className="muted"
                              style={{ fontSize: "0.8rem" }}
                            >
                              {item.description ?? "Spa"} ·{" "}
                              {formatMoney(item.unitPriceCents)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {group.id === "plumbing" && (
                    <div className="cad-icon-toolbar cad-icon-toolbar-2">
                      <button
                        type="button"
                        className={`tool-icon-btn ${tool === "plumbing" ? "active" : ""}`}
                        title="Draw plumbing"
                        aria-label="Draw plumbing"
                        onClick={() => activateDraw("plumbing")}
                      >
                        {toolMeta("plumbing").icon}
                        <ToolTooltip label="Draw plumbing" />
                      </button>
                    </div>
                  )}

                  {group.id === "house" && (
                    <>
                      <div className="cad-icon-toolbar cad-icon-toolbar-2">
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "house_rect" ? "active" : ""}`}
                          title="House rectangle"
                          aria-label="House rectangle"
                          onClick={() => activateDraw("house_rect")}
                        >
                          {toolMeta("house_rect").icon}
                          <ToolTooltip label="House rectangle" />
                        </button>
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "house_poly" ? "active" : ""}`}
                          title="House polygon"
                          aria-label="House polygon"
                          onClick={() => activateDraw("house_poly")}
                        >
                          {toolMeta("house_poly").icon}
                          <ToolTooltip label="House polygon" />
                        </button>
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="house-stories-tool">Stories</label>
                        <input
                          id="house-stories-tool"
                          type="number"
                          min={1}
                          max={12}
                          step={1}
                          value={houseStories}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n)) {
                              onHouseStories(
                                Math.max(1, Math.min(12, Math.round(n))),
                              );
                            }
                          }}
                        />
                        <p
                          className="muted"
                          style={{ margin: "0.25rem 0 0", fontSize: "0.75rem" }}
                        >
                          1-story ranch, 2-story, etc. Editable after drawing.
                        </p>
                      </div>
                    </>
                  )}

                  {group.id === "openings" && (
                    <>
                      <div
                        className="cad-kind-toggle cad-kind-toggle-3"
                        role="group"
                        aria-label="Opening type"
                      >
                        {(
                          [
                            ["door", "Door"],
                            ["sliding_door", "Sliding"],
                            ["window", "Window"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={`cad-kind-btn ${tool === "opening" && openingKind === id ? "active" : ""}`}
                            onClick={() => {
                              onOpeningKind(id);
                              activateDraw("opening");
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="opening-story-tool">Place on story</label>
                        <input
                          id="opening-story-tool"
                          type="number"
                          min={1}
                          max={12}
                          step={1}
                          value={openingStory}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n)) {
                              onOpeningStory(
                                Math.max(1, Math.min(12, Math.round(n))),
                              );
                            }
                          }}
                        />
                        <p
                          className="muted"
                          style={{ margin: "0.25rem 0 0", fontSize: "0.75rem" }}
                        >
                          1 = ground floor. Clamped to the house story count
                          when placed.
                        </p>
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="plan-story-filter-tool">
                          Show on plan
                        </label>
                        <select
                          id="plan-story-filter-tool"
                          value={
                            planStoryFilter === "all"
                              ? "all"
                              : String(planStoryFilter)
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "all") onPlanStoryFilter("all");
                            else {
                              const n = Number(v);
                              onPlanStoryFilter(n);
                              onOpeningStory(n);
                            }
                          }}
                        >
                          <option value="all">All stories</option>
                          {Array.from(
                            { length: Math.max(1, houseStories) },
                            (_, i) => i + 1,
                          ).map((n) => (
                            <option key={n} value={n}>
                              {n === 1
                                ? "Ground floor only"
                                : `Story ${n} only`}
                            </option>
                          ))}
                        </select>
                        <p
                          className="muted"
                          style={{ margin: "0.25rem 0 0", fontSize: "0.75rem" }}
                        >
                          Hide other stories so overlapping windows are
                          selectable.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="cad-action-row">
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
              ortho
                ? "Ortho on (90° sticky)"
                : "Ortho off — hold Shift for 90°"
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
              zoomUnlocked
                ? "Zoom unlocked (scroll)"
                : "Zoom locked — hold Z"
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
      </div>

      <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
        {isPadEquipTool(tool) ? toolHelp : helpText}
      </p>
      {!zoomUnlocked && (
        <p className="muted" style={{ fontSize: "0.78rem", margin: 0 }}>
          {zDown
            ? "Zoom active — scroll to zoom"
            : "Scroll-zoom locked. Hold Z + scroll, or unlock with the zoom button."}
        </p>
      )}
      {lengthBuffer && (
        <div className="badge warn">Length: {lengthBuffer}_</div>
      )}
      {showFinishDraft && (
        <button
          type="button"
          className="btn secondary"
          style={{ width: "100%" }}
          onClick={onFinishDraft}
          disabled={!canFinishDraft}
        >
          {finishDraftLabel}
        </button>
      )}
    </div>
  );
}
