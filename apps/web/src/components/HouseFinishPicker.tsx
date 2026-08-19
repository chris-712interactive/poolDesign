"use client";

import { useEffect, useState } from "react";
import {
  HOUSE_EXTERIOR_CUSTOM_ID,
  HOUSE_EXTERIOR_FINISHES,
  HOUSE_SIDING_IDS,
  HOUSE_SIDING_LABELS,
  houseExteriorColorFromHex,
  houseExteriorCssColor,
  houseExteriorHex,
  resolveBuildingStoryExterior,
  resolveHouseExteriorColor,
  resolveHouseExteriorFinishId,
  resolveHouseSidingId,
  type BuildingStoryExterior,
  type HouseExteriorColor,
  type HouseSidingId,
} from "@pool-design/shared";

export type HouseFinishChange = {
  exteriorFinishId: string;
  exteriorColor?: HouseExteriorColor;
  exteriorSidingId: HouseSidingId;
  storyExteriors?: BuildingStoryExterior[];
};

type Props = {
  stories?: number;
  finishId?: string | null;
  customColor?: HouseExteriorColor | null;
  sidingId?: string | null;
  storyExteriors?: BuildingStoryExterior[] | null;
  onChange: (next: HouseFinishChange) => void;
};

export function HouseFinishPicker({
  stories = 1,
  finishId,
  customColor,
  sidingId,
  storyExteriors,
  onChange,
}: Props) {
  const storyCount = Math.max(1, stories);
  const [scope, setScope] = useState<"all" | number>("all");

  useEffect(() => {
    if (storyCount <= 1 || (typeof scope === "number" && scope > storyCount)) {
      setScope("all");
    }
  }, [storyCount, scope]);

  const editingAll = scope === "all" || storyCount <= 1;
  const resolved = editingAll
    ? {
        finishId: resolveHouseExteriorFinishId(finishId),
        color: resolveHouseExteriorColor(finishId, customColor),
        sidingId: resolveHouseSidingId(sidingId),
      }
    : resolveBuildingStoryExterior(
        {
          stories: storyCount,
          exteriorFinishId: finishId,
          exteriorColor: customColor,
          exteriorSidingId: sidingId,
          storyExteriors: storyExteriors ?? undefined,
        },
        scope,
      );
  const selectedId = resolved.finishId;
  const isCustom = selectedId === HOUSE_EXTERIOR_CUSTOM_ID;
  const hex = houseExteriorHex(resolved.color);

  function emit(
    nextFinishId: string,
    nextColor: HouseExteriorColor | undefined,
    nextSiding: HouseSidingId,
  ) {
    if (editingAll) {
      onChange({
        exteriorFinishId: nextFinishId,
        exteriorColor: nextColor,
        exteriorSidingId: nextSiding,
        storyExteriors: undefined,
      });
      return;
    }
    const slots: BuildingStoryExterior[] = Array.from(
      { length: storyCount },
      (_, i) => ({ ...(storyExteriors?.[i] ?? {}) }),
    );
    slots[scope - 1] = {
      exteriorFinishId: nextFinishId,
      ...(nextColor ? { exteriorColor: nextColor } : {}),
      exteriorSidingId: nextSiding,
    };
    onChange({
      exteriorFinishId: resolveHouseExteriorFinishId(finishId),
      exteriorColor: customColor ?? undefined,
      exteriorSidingId: resolveHouseSidingId(sidingId),
      storyExteriors: slots,
    });
  }

  return (
    <div className="stack" style={{ gap: "0.45rem" }}>
      {storyCount > 1 && (
        <div className="stack" style={{ gap: "0.3rem" }}>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Apply to
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
            <button
              type="button"
              className={`btn secondary ${editingAll ? "active" : ""}`}
              style={{ padding: "0.3rem 0.5rem" }}
              onClick={() => setScope("all")}
            >
              All stories
            </button>
            {Array.from({ length: storyCount }, (_, i) => i + 1).map((s) => (
              <button
                key={s}
                type="button"
                className={`btn secondary ${scope === s ? "active" : ""}`}
                style={{ padding: "0.3rem 0.5rem" }}
                onClick={() => setScope(s)}
              >
                Story {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="muted" style={{ fontSize: "0.8rem" }}>
        Siding
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
        {HOUSE_SIDING_IDS.map((id) => {
          const active = resolved.sidingId === id;
          return (
            <button
              key={id}
              type="button"
              className={`btn secondary ${active ? "active" : ""}`}
              style={{
                padding: "0.3rem 0.5rem",
                border: active
                  ? "2px solid var(--accent, #1f8a70)"
                  : "1px solid rgba(20,32,41,0.12)",
              }}
              onClick={() => emit(selectedId, isCustom ? resolved.color : undefined, id)}
            >
              {HOUSE_SIDING_LABELS[id]}
            </button>
          );
        })}
      </div>

      <div className="muted" style={{ fontSize: "0.8rem" }}>
        Exterior color
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(4.5rem, 1fr))",
          gap: "0.35rem",
        }}
      >
        {HOUSE_EXTERIOR_FINISHES.map((finish) => {
          const active = !isCustom && finish.id === selectedId;
          const css = houseExteriorCssColor(finish.color);
          return (
            <button
              key={finish.id}
              type="button"
              className={`btn secondary ${active ? "active" : ""}`}
              style={{
                padding: "0.35rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.25rem",
                border: active
                  ? "2px solid var(--accent, #1f8a70)"
                  : "1px solid rgba(20,32,41,0.12)",
              }}
              onClick={() => emit(finish.id, undefined, resolved.sidingId)}
              title={finish.name}
            >
              <span
                aria-hidden
                style={{
                  width: "100%",
                  height: 28,
                  borderRadius: 4,
                  background: css,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
                }}
              />
              <span style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>
                {finish.colorName}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="field"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.55rem",
          marginTop: "0.15rem",
        }}
      >
        <button
          type="button"
          className={`btn secondary ${isCustom ? "active" : ""}`}
          style={{
            padding: "0.35rem 0.55rem",
            border: isCustom
              ? "2px solid var(--accent, #1f8a70)"
              : "1px solid rgba(20,32,41,0.12)",
          }}
          onClick={() =>
            emit(HOUSE_EXTERIOR_CUSTOM_ID, resolved.color, resolved.sidingId)
          }
        >
          Custom
        </button>
        <input
          type="color"
          aria-label="Custom exterior color"
          value={hex}
          onChange={(e) => {
            const color = houseExteriorColorFromHex(e.target.value);
            if (!color) return;
            emit(HOUSE_EXTERIOR_CUSTOM_ID, color, resolved.sidingId);
          }}
          style={{
            width: 42,
            height: 32,
            padding: 0,
            border: "1px solid rgba(20,32,41,0.18)",
            borderRadius: 6,
            background: "transparent",
            cursor: "pointer",
          }}
        />
        <span className="muted" style={{ fontSize: "0.78rem" }}>
          {isCustom ? hex.toUpperCase() : "Or pick any RGB"}
        </span>
      </div>
    </div>
  );
}
