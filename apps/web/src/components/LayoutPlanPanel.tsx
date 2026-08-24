"use client";

import { useMemo, useState } from "react";
import {
  buildLayoutPlanSvg,
  type DesignDocument,
  type UnitSystem,
} from "@pool-design/shared";

type Props = {
  projectId: string;
  projectName: string;
  design: DesignDocument;
  unitSystem: UnitSystem;
};

export function LayoutPlanPanel({
  projectId,
  projectName,
  design,
  unitSystem,
}: Props) {
  const svg = useMemo(() => {
    try {
      return buildLayoutPlanSvg(design, unitSystem);
    } catch (err) {
      console.error("layout plan svg failed", err);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200"><text x="24" y="40" fill="#666">Could not build layout plan.</text></svg>`;
    }
  }, [design, unitSystem]);
  const empty = svg.includes("No geometry yet");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function downloadSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/[^\w.-]+/g, "_") || "layout"}-layout-plan.svg`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function openPdf() {
    setExportError(null);
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/layout-plan`);
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setExportError(json.error || "Could not open layout plan PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="panel layout-plan-panel stack">
      <div className="layout-plan-panel-head">
        <div>
          <h1>Layout plan</h1>
          <p className="muted" style={{ margin: 0 }}>
            Pool and spa outlines, paver extents, and distances from the house —
            including the nearest house corner to the equipment pad. No furniture,
            grade points, or depth cuts. Not a survey or a permit drawing.
          </p>
        </div>
        {!empty ? (
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn secondary"
              onClick={downloadSvg}
            >
              Download SVG
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void openPdf()}
              disabled={exporting}
              title="Open a printable sheet — Save as PDF from the browser"
            >
              {exporting ? "Opening…" : "Export PDF"}
            </button>
          </div>
        ) : null}
      </div>

      {exportError ? <p className="error">{exportError}</p> : null}

      {empty ? (
        <p className="muted" style={{ margin: 0 }}>
          Draw a house, pool, patio, or equipment pad to see this sheet.
        </p>
      ) : (
        <div
          className="layout-plan-preview"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}
