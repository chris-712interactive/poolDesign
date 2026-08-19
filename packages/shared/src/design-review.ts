/**
 * Client design review on a proposal share (not live-session finish swaps).
 */

export const DESIGN_STATUSES = [
  "in_design",
  "awaiting_approval",
  "changes_requested",
  "approved",
] as const;

export type DesignStatus = (typeof DESIGN_STATUSES)[number];

export const REVIEW_KINDS = ["approved", "changes_requested"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

export const DESIGN_STATUS_LABELS: Record<DesignStatus, string> = {
  in_design: "In design",
  awaiting_approval: "Awaiting approval",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const REVIEW_KIND_LABELS: Record<ReviewKind, string> = {
  approved: "Approved",
  changes_requested: "Changes requested",
};

export const MAX_REVIEW_NOTE_CHARS = 4000;

export function parseDesignStatus(raw: unknown): DesignStatus {
  return typeof raw === "string" &&
    (DESIGN_STATUSES as readonly string[]).includes(raw)
    ? (raw as DesignStatus)
    : "in_design";
}

export function parseReviewKind(raw: unknown): ReviewKind | null {
  return typeof raw === "string" &&
    (REVIEW_KINDS as readonly string[]).includes(raw)
    ? (raw as ReviewKind)
    : null;
}

export function clientCanApprove(opts: {
  requestClientApproval: boolean;
  designStatus: DesignStatus;
}): boolean {
  return opts.requestClientApproval && opts.designStatus !== "approved";
}

export function applyClientReview(
  kind: ReviewKind,
): { designStatus: DesignStatus; requestClientApproval: boolean } {
  if (kind === "approved") {
    return { designStatus: "approved", requestClientApproval: false };
  }
  return { designStatus: "changes_requested", requestClientApproval: false };
}

export function applyDesignerRequestApproval(
  enabled: boolean,
  current: DesignStatus,
): { designStatus: DesignStatus; requestClientApproval: boolean } {
  if (enabled) {
    return { designStatus: "awaiting_approval", requestClientApproval: true };
  }
  return {
    requestClientApproval: false,
    designStatus: current === "awaiting_approval" ? "in_design" : current,
  };
}

/** Persist only http(s) voice, or a local data:audio URL (Docker). */
export function storedVoiceUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string" || !url) return null;
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  if (url.startsWith("data:audio/") && url.length < 12_000_000) return url;
  return null;
}

export function reviewNoteOk(kind: ReviewKind, noteText: string, hasVoice: boolean) {
  const note = noteText.trim();
  if (kind === "changes_requested") {
    return note.length > 0 || hasVoice;
  }
  return true;
}
