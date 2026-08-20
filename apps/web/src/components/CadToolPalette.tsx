"use client";

import { useEffect, useState } from "react";
import {
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
  isCoverAccessoryId,
  isSunshelfLayoutId,
  fenceKindLabel,
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

function PlaceList({
  items,
  tool,
  placeItemId,
  group,
  onPlace,
  tall,
}: {
  items: PlaceableItem[];
  tool: ToolId;
  placeItemId: string | null;
  group: ToolGroupId;
  onPlace: (id: string, group: ToolGroupId) => void;
  tall?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`cad-compact-list${tall ? " cad-compact-list-tall" : ""}`}>
      {items.map((item) => {
        const active = tool === "place" && placeItemId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`cad-place-row${active ? " active" : ""}`}
            onClick={() => onPlace(item.id, group)}
          >
            {item.name}
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  tool: ToolId;
  waterKind: WaterBodyKind;
  coverKind: PatioCoverKind;
  fenceKind: FenceKind;
  gateKind: GateKind;
  openingKind: BuildingOpeningKind;
  planStoryFilter: "all" | number;
  houseStories: number;
  placeItemId: string | null;
  placeLibrary: PlaceableItem[];
  poolFixtureLibrary: PlaceableItem[];
  spaFixtureLibrary: PlaceableItem[];
  toolHelp: string;
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
  onPlanStoryFilter: (v: "all" | number) => void;
  onHouseStories: (n: number) => void;
  onPlaceItemId: (id: string) => void;
  onFinishDraft: () => void;
};

export function CadToolPalette({
  tool,
  waterKind,
  coverKind,
  fenceKind,
  gateKind,
  openingKind,
  planStoryFilter,
  houseStories,
  placeItemId,
  placeLibrary,
  poolFixtureLibrary,
  spaFixtureLibrary,
  toolHelp,
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
  onPlanStoryFilter,
  onHouseStories,
  onPlaceItemId,
  onFinishDraft,
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
          : tool === "property_line"
            ? "Trace the lot line from the survey. Close near start, or Finish for an open run."
            : tool === "easement"
              ? "Trace the easement centerline. Set the recorded width in Properties."
          : tool === "cover_rect"
            ? coverKind === "roof"
              ? "Patio roof: side, then depth."
              : "Pergola: side, then depth."
            : toolHelp;

  return (
    <div className="cad-tab-panel" role="tabpanel">
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
                title={group.hint}
                aria-expanded={open}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="cad-tool-group-icon">{group.icon}</span>
                <span className="cad-tool-group-text">
                  <strong>{group.label}</strong>
                </span>
                <span className="cad-tool-group-chevron" aria-hidden>
                  {open ? "▾" : "▸"}
                </span>
              </button>

              {open && (
                <div className="cad-tool-group-body">
                  {group.id === "pad" && (
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
                  )}

                  {group.id === "furniture" && (
                    <PlaceList
                      items={placeLibrary}
                      tool={tool}
                      placeItemId={placeItemId}
                      group="furniture"
                      onPlace={activatePlace}
                      tall
                    />
                  )}

                  {group.id === "patio" && (
                    <>
                      <div className="cad-icon-toolbar cad-icon-toolbar-3">
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "patio_rect" ? "active" : ""}`}
                          title="Patio rectangle"
                          aria-label="Patio rectangle"
                          onClick={() => activateDraw("patio_rect")}
                        >
                          {toolMeta("patio_rect").icon}
                          <ToolTooltip label="Patio rectangle" />
                        </button>
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "patio" ? "active" : ""}`}
                          title="Patio polygon"
                          aria-label="Patio polygon"
                          onClick={() => activateDraw("patio")}
                        >
                          {toolMeta("patio").icon}
                          <ToolTooltip label="Patio polygon" />
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
                    </>
                  )}

                  {group.id === "site" && (
                    <>
                      <div className="cad-icon-toolbar cad-icon-toolbar-2">
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "property_line" ? "active" : ""}`}
                          title="Property line"
                          aria-label="Property line"
                          onClick={() => activateDraw("property_line")}
                        >
                          {toolMeta("property_line").icon}
                          <ToolTooltip label="Property line" />
                        </button>
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "easement" ? "active" : ""}`}
                          title="Easement"
                          aria-label="Easement"
                          onClick={() => activateDraw("easement")}
                        >
                          {toolMeta("easement").icon}
                          <ToolTooltip label="Easement" />
                        </button>
                      </div>
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
                      <strong className="cad-tool-subgroup-label">
                        Fans & lights
                      </strong>
                      <PlaceList
                        items={placeLibrary.filter((item) =>
                          isCoverAccessoryId(item.id),
                        )}
                        tool={tool}
                        placeItemId={placeItemId}
                        group="cover"
                        onPlace={activatePlace}
                      />
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
                      <PlaceList
                        items={poolFixtureLibrary}
                        tool={tool}
                        placeItemId={placeItemId}
                        group="pool"
                        onPlace={activatePlace}
                      />
                      <strong className="cad-tool-subgroup-label">
                        Sunshelf
                      </strong>
                      <PlaceList
                        items={placeLibrary.filter((item) =>
                          isSunshelfLayoutId(item.id),
                        )}
                        tool={tool}
                        placeItemId={placeItemId}
                        group="pool"
                        onPlace={activatePlace}
                      />
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
                      <PlaceList
                        items={spaFixtureLibrary}
                        tool={tool}
                        placeItemId={placeItemId}
                        group="spa"
                        onPlace={activatePlace}
                      />
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
                        <button
                          type="button"
                          className={`tool-icon-btn ${tool === "roof_ridge" ? "active" : ""}`}
                          title="Roof ridge / peak"
                          aria-label="Roof ridge / peak"
                          onClick={() => activateDraw("roof_ridge")}
                        >
                          {toolMeta("roof_ridge").icon}
                          <ToolTooltip label="Roof ridge" />
                        </button>
                      </div>
                      <p
                        className="muted"
                        style={{ margin: 0, fontSize: "0.75rem" }}
                      >
                        Draw peak / ridge lines only (not hips or eaves). Run
                        a ridge to the walls for a gable; stop short for a hip.
                        Edit pitch and shingles in Properties.
                      </p>
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
                            else onPlanStoryFilter(Number(v));
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
                          selectable. New doors and windows go on this story
                          (ground floor when All).
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

      <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
        {isPadEquipTool(tool) ? toolHelp : helpText}
      </p>
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
