"use client";

import {
  DESIGN_STATUS_LABELS,
  REVIEW_KIND_LABELS,
  parseDesignStatus,
  parseReviewKind,
  type DesignStatus,
} from "@pool-design/shared";

export type ReviewRow = {
  id: string;
  kind: string;
  noteText: string | null;
  voiceUrl: string | null;
  createdAt: string;
};

type Props = {
  designStatus: DesignStatus;
  reviews: ReviewRow[];
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ProjectReviewTimeline({ designStatus, reviews }: Props) {
  const status = parseDesignStatus(designStatus);
  return (
    <section className="stack" style={{ gap: "0.75rem" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>Client review</strong>
        <span
          className={`badge ${
            status === "approved"
              ? "ok"
              : status === "changes_requested"
                ? "warn"
                : status === "awaiting_approval"
                  ? ""
                  : "muted"
          }`}
        >
          {DESIGN_STATUS_LABELS[status]}
        </span>
      </div>
      {reviews.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          When the client approves or requests changes from a share link, it
          lands here with the date and time — including any text or voice note.
        </p>
      ) : (
        <ol className="review-timeline">
          {reviews.map((r) => {
            const kind = parseReviewKind(r.kind);
            return (
              <li key={r.id} className="review-timeline-item">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>
                    {kind ? REVIEW_KIND_LABELS[kind] : r.kind}
                  </strong>
                  <span className="muted">{formatWhen(r.createdAt)}</span>
                </div>
                {r.noteText ? <p style={{ margin: "0.35rem 0 0" }}>{r.noteText}</p> : null}
                {r.voiceUrl ? (
                  <audio
                    className="review-timeline-audio"
                    controls
                    src={r.voiceUrl}
                    preload="metadata"
                  />
                ) : null}
                {!r.noteText && !r.voiceUrl ? (
                  <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                    No note attached.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
