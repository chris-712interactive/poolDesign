/**
 * Host-driven live client session state (finish swaps + approvals).
 * Synced via DB polling — not full CRDT CAD multiplayer.
 */

export type LiveSessionApproval = {
  id: string;
  label: string;
  status: "approved" | "rejected";
  at: string;
  by: "guest" | "host";
};

export type LiveSessionFinishes = {
  /** Apply to every pool/spa body when set. */
  waterlineTileId?: string;
  /** Per-patio material overrides. */
  patioMaterialById?: Record<string, string>;
};

/** Stable key for a finish payload so we can hide Apply after it's consumed. */
export function liveFinishesKey(finishes: LiveSessionFinishes): string {
  const patio = finishes.patioMaterialById
    ? Object.entries(finishes.patioMaterialById)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(",")
    : "";
  return `${finishes.waterlineTileId ?? ""}|${patio}`;
}

export function liveFinishesPending(
  finishes: LiveSessionFinishes,
  appliedFinishesKey?: string | null,
): boolean {
  const has =
    Boolean(finishes.waterlineTileId) ||
    Boolean(
      finishes.patioMaterialById &&
        Object.keys(finishes.patioMaterialById).length > 0,
    );
  if (!has) return false;
  return liveFinishesKey(finishes) !== (appliedFinishesKey ?? "");
}

export type LiveSessionState = {
  version: 1;
  active: boolean;
  hostOnlineAt: string | null;
  guestOnlineAt: string | null;
  finishes: LiveSessionFinishes;
  approvals: LiveSessionApproval[];
  /**
   * When true, the client proposal may show the estimate during a live session.
   * Default false — live preview hides pricing unless the designer opts in.
   */
  showEstimate: boolean;
  /** Latest 3D still URL pushed by the designer for this live session. */
  previewImageUrl?: string | null;
  /**
   * Fingerprint of finishes the designer already applied.
   * Cleared when the client sends a new finish payload.
   */
  appliedFinishesKey?: string | null;
};

export function emptyLiveSessionState(): LiveSessionState {
  return {
    version: 1,
    active: false,
    hostOnlineAt: null,
    guestOnlineAt: null,
    finishes: {},
    approvals: [],
    showEstimate: false,
    previewImageUrl: null,
    appliedFinishesKey: null,
  };
}

export function parseLiveSessionState(raw: unknown): LiveSessionState {
  const base = emptyLiveSessionState();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const finishes =
    o.finishes && typeof o.finishes === "object"
      ? (o.finishes as LiveSessionFinishes)
      : {};
  const approvals = Array.isArray(o.approvals)
    ? (o.approvals as LiveSessionApproval[])
    : [];
  return {
    version: 1,
    active: Boolean(o.active),
    hostOnlineAt:
      typeof o.hostOnlineAt === "string" || o.hostOnlineAt === null
        ? (o.hostOnlineAt as string | null)
        : null,
    guestOnlineAt:
      typeof o.guestOnlineAt === "string" || o.guestOnlineAt === null
        ? (o.guestOnlineAt as string | null)
        : null,
    finishes: {
      waterlineTileId:
        typeof finishes.waterlineTileId === "string"
          ? finishes.waterlineTileId
          : undefined,
      patioMaterialById:
        finishes.patioMaterialById &&
        typeof finishes.patioMaterialById === "object"
          ? finishes.patioMaterialById
          : undefined,
    },
    approvals,
    showEstimate: Boolean(o.showEstimate),
    previewImageUrl:
      typeof o.previewImageUrl === "string"
        ? o.previewImageUrl
        : o.previewImageUrl === null
          ? null
          : base.previewImageUrl,
    appliedFinishesKey:
      typeof o.appliedFinishesKey === "string"
        ? o.appliedFinishesKey
        : o.appliedFinishesKey === null
          ? null
          : base.appliedFinishesKey,
  };
}
