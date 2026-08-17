"use client";

import { useRef, useState } from "react";
import type { DesignDocument } from "@pool-design/shared";
import { importSurveyUnderlayFromFile } from "@/lib/surveyUnderlayUpload";

type Props = {
  projectId: string;
  design: DesignDocument;
  onImported: (next: DesignDocument) => void;
  onSkip: () => void;
};

export function ImportSurveyPrompt({
  projectId,
  design,
  onImported,
  onSkip,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const next = await importSurveyUnderlayFromFile(projectId, file, design);
      onImported(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cad-survey-prompt" role="dialog" aria-labelledby="import-survey-title">
      <div className="panel stack" style={{ maxWidth: 440, margin: "0 auto" }}>
        <h2 id="import-survey-title">Import a survey?</h2>
        <p className="muted" style={{ margin: 0 }}>
          Upload a PNG or JPG of the plat so you can trace lot lines and the
          house at real scale. You can add one later from Layers if you skip.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onFile(file);
          }}
        />
        {error ? <p className="error">{error}</p> : null}
        <div className="row" style={{ gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Uploading…" : "Choose survey file"}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={onSkip}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
