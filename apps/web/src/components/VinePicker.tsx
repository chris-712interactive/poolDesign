"use client";

import type { CSSProperties } from "react";
import {
  VINE_GROUPS,
  VINE_GROUP_LABELS,
  vineCssColor,
  vineDisplayName,
  vinesInGroup,
  resolveVineId,
} from "@pool-design/shared";

type Props = {
  vineId?: string | null;
  onChange: (vineId: string) => void;
};

const chip = (active: boolean): CSSProperties => ({
  appearance: "none",
  cursor: "pointer",
  padding: "0.35rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.2rem",
  borderRadius: 8,
  border: active
    ? "2px solid var(--accent, #1f8a70)"
    : "1px solid rgba(20,32,41,0.12)",
  background: active ? "white" : "transparent",
});

export function VinePicker({ vineId, onChange }: Props) {
  const selected = resolveVineId(vineId);
  return (
    <div className="stack" style={{ gap: "0.65rem" }}>
      <div className="muted" style={{ fontSize: "0.8rem" }}>
        Florida vine
      </div>
      {VINE_GROUPS.map((group) => {
        const vines = vinesInGroup(group);
        if (vines.length === 0) return null;
        return (
          <div key={group} className="stack" style={{ gap: "0.3rem" }}>
            <div
              className="muted"
              style={{ fontSize: "0.75rem", fontWeight: 700 }}
            >
              {VINE_GROUP_LABELS[group]}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(5.4rem, 1fr))",
                gap: "0.3rem",
              }}
            >
              {vines.map((vine) => {
                const active = vine.id === selected;
                return (
                  <button
                    key={vine.id}
                    type="button"
                    style={chip(active)}
                    title={
                      vine.botanical +
                      (vine.description ? ` — ${vine.description}` : "")
                    }
                    onClick={() => onChange(vine.id)}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: "100%",
                        height: 22,
                        borderRadius: 4,
                        background: `linear-gradient(90deg, ${vineCssColor(vine.foliage)}, ${vineCssColor(vine.flower)})`,
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
                      }}
                    />
                    <span style={{ fontSize: "0.7rem", lineHeight: 1.2 }}>
                      {vineDisplayName(vine)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
