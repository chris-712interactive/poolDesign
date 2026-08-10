"use client";

import {
  fenceFinishCssColor,
  fenceFinishesForKind,
  fenceKindLabel,
  resolveFenceFinish,
  type FenceKind,
} from "@pool-design/shared";

type Props = {
  kind: FenceKind;
  finishId?: string | null;
  onChange: (finishId: string) => void;
};

export function FenceFinishPicker({ kind, finishId, onChange }: Props) {
  const selected = resolveFenceFinish(kind, finishId);
  const options = fenceFinishesForKind(kind);

  return (
    <div className="stack" style={{ gap: "0.45rem" }}>
      <div className="muted" style={{ fontSize: "0.8rem" }}>
        {fenceKindLabel(kind)} color
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(4.5rem, 1fr))",
          gap: "0.35rem",
        }}
      >
        {options.map((finish) => {
          const active = finish.id === selected.id;
          const css = fenceFinishCssColor(finish);
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
              onClick={() => onChange(finish.id)}
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
    </div>
  );
}
