"use client";

type Props = {
  projectName: string;
  previewImageUrl: string | null;
  previewVideoUrl: string | null;
};

/** Static design still/video on the public proposal (non-live). */
export function ProposalDesignPreview({
  projectName,
  previewImageUrl,
  previewVideoUrl,
}: Props) {
  return (
    <section className="proposal-panel">
      <h2>Design preview</h2>
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
          A 3D still has not been attached to this link yet. Ask your designer
          to start a live session or update the still.
        </p>
      )}
      {previewVideoUrl ? (
        <video
          className="proposal-preview"
          src={previewVideoUrl}
          controls
          playsInline
        />
      ) : null}
    </section>
  );
}
