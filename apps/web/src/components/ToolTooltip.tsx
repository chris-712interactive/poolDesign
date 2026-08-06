"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portals to document.body with fixed positioning so tooltips aren't clipped
 * by overflow:auto ancestors (e.g. the tools rail).
 */
export function ToolTooltip({ label }: { label: string }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{
    left: number;
    top: number;
    placeAbove: boolean;
  } | null>(null);

  useEffect(() => {
    const btn = anchorRef.current?.closest("button");
    if (!btn) return;

    let visible = false;

    const show = () => {
      visible = true;
      const r = btn.getBoundingClientRect();
      const placeAbove = r.bottom + 36 > window.innerHeight;
      setCoords({
        left: r.left + r.width / 2,
        top: placeAbove ? r.top - 6 : r.bottom + 6,
        placeAbove,
      });
    };
    const hide = () => {
      visible = false;
      setCoords(null);
    };
    const onScroll = () => {
      if (visible) show();
    };

    btn.addEventListener("mouseenter", show);
    btn.addEventListener("mouseleave", hide);
    btn.addEventListener("focus", show);
    btn.addEventListener("blur", hide);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", hide);

    return () => {
      btn.removeEventListener("mouseenter", show);
      btn.removeEventListener("mouseleave", hide);
      btn.removeEventListener("focus", show);
      btn.removeEventListener("blur", hide);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", hide);
    };
  }, [label]);

  return (
    <>
      <span ref={anchorRef} className="tool-tooltip-anchor" aria-hidden />
      {coords &&
        createPortal(
          <span
            className={`tool-tooltip-portal ${coords.placeAbove ? "above" : "below"}`}
            style={{ left: coords.left, top: coords.top }}
            role="tooltip"
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
