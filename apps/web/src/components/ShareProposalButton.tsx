"use client";

import { useState } from "react";

export type ShareResult = {
  id: string;
  url: string;
  copied: boolean;
};

type Props = {
  projectId: string;
  /** Capture a PNG data URL from the live 3D view when available. */
  capturePreview?: () => string | null;
  /** Switch to 3D before capture (optional). */
  ensure3d?: () => void;
  /** When true, snapshot estimate onto the share (default false). */
  includeEstimate?: boolean;
  onShared?: (result: ShareResult) => void;
  onError?: (message: string) => void;
};

async function uploadPreview(
  projectId: string,
  capturePreview?: () => string | null,
): Promise<string | null> {
  const dataUrl = capturePreview?.() ?? null;
  if (!dataUrl) return null;
  const up = await fetch(`/api/projects/${projectId}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  if (!up.ok) return null;
  const json = (await up.json()) as { url?: string };
  return json.url ?? null;
}

/** Compact share action — feedback belongs in the parent toolbar status strip. */
export function ShareProposalButton({
  projectId,
  capturePreview,
  ensure3d,
  includeEstimate = false,
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

      const previewImageUrl = await uploadPreview(projectId, capturePreview);

      const res = await fetch(`/api/projects/${projectId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeEstimate,
          previewImageUrl,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || "Could not create share link");
      }
      const json = (await res.json()) as { id: string; url: string };
      let copied = false;
      try {
        await navigator.clipboard.writeText(json.url);
        copied = true;
      } catch {
        copied = false;
      }
      onShared?.({ id: json.id, url: json.url, copied });
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

type UpdateStillProps = {
  projectId: string;
  shareId: string;
  capturePreview?: () => string | null;
  ensure3d?: () => void;
  onUpdated?: () => void;
  onError?: (message: string) => void;
};

/** Push a new 3D still (+ design snapshot) to an existing client link. */
export function UpdateShareStillButton({
  projectId,
  shareId,
  capturePreview,
  ensure3d,
  onUpdated,
  onError,
}: UpdateStillProps) {
  const [busy, setBusy] = useState(false);

  async function updateStill() {
    setBusy(true);
    onError?.("");
    try {
      ensure3d?.();
      await new Promise((r) => setTimeout(r, ensure3d ? 400 : 0));

      const previewImageUrl = await uploadPreview(projectId, capturePreview);
      if (!previewImageUrl) {
        throw new Error("Could not capture 3D preview — open Design 3D view first");
      }

      const res = await fetch(
        `/api/projects/${projectId}/shares/${shareId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            previewImageUrl,
            refreshSnapshot: true,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || "Could not update share");
      }
      onUpdated?.();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="btn secondary project-toolbar-strip-btn"
      disabled={busy}
      onClick={() => void updateStill()}
      title="Capture a new 3D still and push it to the existing client link"
    >
      {busy ? "Updating…" : "Update still"}
    </button>
  );
}
