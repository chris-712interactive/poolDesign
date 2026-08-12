"use client";

import { useState } from "react";

export type ShareResult = {
  url: string;
  copied: boolean;
};

type Props = {
  projectId: string;
  /** Capture a PNG data URL from the live 3D view when available. */
  capturePreview?: () => string | null;
  /** Switch to 3D before capture (optional). */
  ensure3d?: () => void;
  onShared?: (result: ShareResult) => void;
  onError?: (message: string) => void;
};

/** Compact share action — feedback belongs in the parent toolbar status strip. */
export function ShareProposalButton({
  projectId,
  capturePreview,
  ensure3d,
  onShared,
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function shareWithClient() {
    setBusy(true);
    onError?.("");
    try {
      ensure3d?.();
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
      let copied = false;
      try {
        await navigator.clipboard.writeText(json.url);
        copied = true;
      } catch {
        copied = false;
      }
      onShared?.({ url: json.url, copied });
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="btn secondary"
      disabled={busy}
      onClick={() => void shareWithClient()}
      title="Create a read-only link for the homeowner"
    >
      {busy ? "Sharing…" : "Share"}
    </button>
  );
}
