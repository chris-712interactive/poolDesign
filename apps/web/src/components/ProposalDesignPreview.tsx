"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  token: string;
  projectName: string;
  /** Still from share at page load (fallback). */
  initialPreviewImageUrl: string | null;
  initialPreviewVideoUrl: string | null;
};

/**
 * Design still that updates during a live session when the designer
 * captures a new preview — no page reload required.
 */
export function ProposalDesignPreview({
  token,
  projectName,
  initialPreviewImageUrl,
  initialPreviewVideoUrl,
}: Props) {
  const [previewImageUrl, setPreviewImageUrl] = useState(
    initialPreviewImageUrl,
  );
  const [liveActive, setLiveActive] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/p/${token}/live`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      active: boolean;
      previewImageUrl?: string | null;
      state?: { previewImageUrl?: string | null };
    };
    setLiveActive(json.active);
    const next =
      json.previewImageUrl || json.state?.previewImageUrl || null;
    if (next) setPreviewImageUrl(next);
  }, [token]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <section className="proposal-panel">
      <div className="row" style={{ justifyContent: "space-between", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Design preview</h2>
        {liveActive ? (
          <span className="badge">Live · updates automatically</span>
        ) : null}
      </div>
      {previewImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={previewImageUrl}
          src={previewImageUrl}
          alt={`3D preview of ${projectName}`}
          className="proposal-preview"
        />
      ) : (
        <p className="muted">
          {liveActive
            ? "Waiting for your designer to send a 3D still…"
            : "A 3D still has not been attached to this link yet. Ask your designer to start a live session or update the still."}
        </p>
      )}
      {initialPreviewVideoUrl ? (
        <video
          className="proposal-preview"
          src={initialPreviewVideoUrl}
          controls
          playsInline
        />
      ) : null}
    </section>
  );
}
