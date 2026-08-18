"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatLength,
  parseSurveyKnownLengthToMm,
  rotateSurveyUnderlay,
  surveyMmPerPixel,
  type DesignDocument,
  type PointMm,
  type SurveyUnderlay,
  type UnitSystem,
} from "@pool-design/shared";
import { importSurveyUnderlayFromFile } from "@/lib/surveyUnderlayUpload";

type Props = {
  projectId: string;
  design: DesignDocument;
  unitSystem: UnitSystem;
  calibrating: boolean;
  aligning: boolean;
  calibratePoints: PointMm[];
  onDesignChange: (next: DesignDocument) => void;
  onStartCalibrate: () => void;
  onStartAlign: () => void;
  onSquareToGrid: () => string | null;
  onApplyCalibrate: (knownMm: number) => boolean;
  onCancelCalibrate: () => void;
};

export function SurveyUnderlayPanel({
  projectId,
  design,
  unitSystem,
  calibrating,
  aligning,
  calibratePoints,
  onDesignChange,
  onStartCalibrate,
  onStartAlign,
  onSquareToGrid,
  onApplyCalibrate,
  onCancelCalibrate,
}: Props) {
  const underlay = design.surveyUnderlay;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [known, setKnown] = useState("");
  const knownRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (calibrating && calibratePoints.length >= 2) {
      knownRef.current?.focus();
      knownRef.current?.select();
    }
  }, [calibrating, calibratePoints.length]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const next = await importSurveyUnderlayFromFile(projectId, file, design);
      onDesignChange(next);
      onStartCalibrate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function patch(next: SurveyUnderlay) {
    onDesignChange({ ...design, surveyUnderlay: next });
  }

  function applyKnown() {
    const mm = parseSurveyKnownLengthToMm(known, unitSystem);
    if (mm == null || mm <= 0) {
      setError(
        unitSystem === "metric"
          ? "Enter the printed length (e.g. 15.24 or 15.24m)."
          : "Enter the printed length (e.g. 50 or 50').",
      );
      return;
    }
    setError(null);
    const ok = onApplyCalibrate(mm);
    if (!ok) {
      setError("Click two ends of a dimension on the survey first.");
      return;
    }
    setKnown("");
  }

  const lengthLabel = unitSystem === "metric" ? "m" : "ft";
  const showCalibrateUi =
    Boolean(underlay) &&
    !aligning &&
    (calibrating || calibratePoints.length > 0);

  function squareToGrid() {
    setError(null);
    const message = onSquareToGrid();
    if (message) setError(message);
  }

  return (
    <div className="stack" style={{ gap: "0.55rem", marginTop: "1.1rem" }}>
      <strong>Survey underlay</strong>
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Upload a PNG/JPG of the plat. If the scan is slightly skewed, use{" "}
        <em>Square to grid</em> or <em>Align a wall</em> so house lines match
        the CAD axes. Then click <em>Calibrate scale</em>, mark both ends of a
        printed dimension, and type that length.
      </p>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {busy ? <p className="muted" style={{ margin: 0 }}>Uploading…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {underlay ? (
        <>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            {underlay.calibrated ? "Scale calibrated to CAD." : "Not calibrated yet."}{" "}
            1 px = {formatLength(surveyMmPerPixel(underlay), unitSystem)}
          </div>
          {!underlay.calibrated ? (
            <p className="cad-survey-panel-callout">
              {calibrating
                ? calibratePoints.length >= 2
                  ? "Enter the printed length of the span you marked, then Apply scale."
                  : "On the plan, mark both ends of a printed scale (scale bar, dimension, or known lot line)."
                : "The sheet is not scaled yet. Click Calibrate scale, then mark both ends of a printed dimension on the survey."}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="survey-opacity">Opacity</label>
            <input
              id="survey-opacity"
              type="range"
              min={0.1}
              max={0.9}
              step={0.05}
              value={underlay.opacity}
              onChange={(e) =>
                patch({ ...underlay, opacity: Number(e.target.value) })
              }
            />
          </div>
          <label className="row" style={{ gap: "0.35rem", fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={Boolean(underlay.locked)}
              onChange={(e) => patch({ ...underlay, locked: e.target.checked })}
            />
            Lock position
          </label>
          <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn secondary"
              onClick={squareToGrid}
            >
              Square to grid
            </button>
            <button
              type="button"
              className={aligning ? "btn" : "btn secondary"}
              onClick={onStartAlign}
            >
              {aligning ? "Click a wall…" : "Align a wall"}
            </button>
          </div>
          <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
            {([-15, -5, -1, 1, 5, 15] as const).map((deg) => (
              <button
                key={deg}
                type="button"
                className="btn secondary"
                onClick={() => patch(rotateSurveyUnderlay(underlay, deg))}
              >
                {deg > 0 ? `+${deg}°` : `−${Math.abs(deg)}°`}
              </button>
            ))}
            <button
              type="button"
              className={calibrating ? "btn" : "btn secondary"}
              onClick={onStartCalibrate}
            >
              {calibrating ? "Calibrating…" : "Calibrate scale"}
            </button>
          </div>
          {aligning ? (
            <div className="stack" style={{ gap: "0.35rem" }}>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {calibratePoints.length === 0
                  ? "On the plan, click two points along a house wall that should be horizontal or vertical."
                  : "Click the other end of that wall."}
              </span>
              <button
                type="button"
                className="btn secondary"
                onClick={onCancelCalibrate}
              >
                Cancel align
              </button>
            </div>
          ) : null}
          {showCalibrateUi ? (
            <div className="stack" style={{ gap: "0.35rem" }}>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {calibratePoints.length === 0
                  ? "Click the first end of a known dimension on the survey."
                  : calibratePoints.length === 1
                    ? "Click the other end of that dimension."
                    : "Type the length printed on the survey, then Apply scale."}
              </span>
              <div className="field">
                <label htmlFor="survey-known">
                  Survey length ({lengthLabel})
                </label>
                <input
                  id="survey-known"
                  ref={knownRef}
                  value={known}
                  disabled={calibratePoints.length < 2}
                  placeholder={unitSystem === "metric" ? "e.g. 15.24" : "e.g. 50"}
                  onChange={(e) => setKnown(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    e.stopPropagation();
                    applyKnown();
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: "0.35rem" }}
                  disabled={calibratePoints.length < 2}
                  onClick={applyKnown}
                >
                  Apply scale
                </button>
              </div>
              <button
                type="button"
                className="btn secondary"
                onClick={onCancelCalibrate}
              >
                Cancel calibrate
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="btn danger"
            onClick={() =>
              onDesignChange({ ...design, surveyUnderlay: undefined })
            }
          >
            Remove underlay
          </button>
        </>
      ) : null}
    </div>
  );
}
