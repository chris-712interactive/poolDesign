"use client";

import { useState } from "react";

type Props = {
  projectId: string;
  /** Capture a PNG data URL from the live 3D view when available. */
  capturePreview?: () => string | null;
  /** Switch to 3D before capture (optional). */
  ensure3d?: () => void;
};

export function ShareProposalButton({
  projectId,
  capturePreview,
  ensure3d,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  async function shareWithClient() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      ensure3d?.();
      // Give the 3D canvas a moment to mount if we just switched views.
      await new Promise((r) => setTimeout(r, ensure3d ? 400 : 0));

      let previewImageUrl: string | null = null;
      const dataUrl = capturePreview?.() ?? null;
      if (dataUrl) {
        const up = await fetch(`/api/projects/${projectId}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        if (up.ok) {
          const json = (await up.json()) as { url?: string };
          previewImageUrl = json.url ?? null;
        }
      }

      const res = await fetch(`/api/projects/${projectId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeEstimate: true,
          previewImageUrl,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || "Could not create share link");
      }
      const json = (await res.json()) as { url: string };
      setLastUrl(json.url);
      try {
        await navigator.clipboard.writeText(json.url);
        setMessage("Client link copied to clipboard");
      } catch {
        setMessage("Share link ready — copy below");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: "0.35rem", alignItems: "flex-end" }}>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() => void shareWithClient()}
        title="Create a read-only link for the homeowner"
      >
        {busy ? "Sharing…" : "Share with client"}
      </button>
      {message ? <span className="muted">{message}</span> : null}
      {error ? <span style={{ color: "var(--danger)" }}>{error}</span> : null}
      {lastUrl ? (
        <a className="muted" href={lastUrl} target="_blank" rel="noreferrer">
          {lastUrl}
        </a>
      ) : null}
    </div>
  );
}
