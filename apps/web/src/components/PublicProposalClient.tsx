"use client";

import { useCallback, useEffect, useState } from "react";
import type { LiveSessionState, TakeoffResult } from "@pool-design/shared";
import { ClientLiveSessionPanel } from "@/components/ClientLiveSessionPanel";
import { ProposalDesignPreview } from "@/components/ProposalDesignPreview";
import { ProposalEstimateSection } from "@/components/ProposalEstimateSection";

type Company = {
  name: string;
  logoUrl: string | null;
  region: string | null;
};

type Project = {
  name: string;
  clientName: string | null;
  address: string | null;
};

type Props = {
  token: string;
  company: Company;
  project: Project;
  initialPreviewImageUrl: string | null;
  initialPreviewVideoUrl: string | null;
  shareIncludesEstimate: boolean;
  estimate: TakeoffResult | null;
  expiresAt: string | null;
};

/**
 * Public proposal shell. When a live session is on, drops the duplicate
 * still and uses a wide side-by-side preview + finish picker layout.
 */
export function PublicProposalClient({
  token,
  company,
  project,
  initialPreviewImageUrl,
  initialPreviewVideoUrl,
  shareIncludesEstimate,
  estimate,
  expiresAt,
}: Props) {
  const [liveActive, setLiveActive] = useState(false);
  const [liveState, setLiveState] = useState<LiveSessionState | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(
    initialPreviewImageUrl,
  );
  const [showEstimateInLive, setShowEstimateInLive] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/p/${token}/live`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      active: boolean;
      previewImageUrl?: string | null;
      state: LiveSessionState;
    };
    setLiveActive(json.active);
    setLiveState(json.state);
    setShowEstimateInLive(Boolean(json.state?.showEstimate));
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
    <div className={`proposal-page${liveActive ? " is-live" : ""}`}>
      <header className="proposal-hero">
        <div className="proposal-hero-inner">
          <div className="proposal-brand">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" className="proposal-logo" />
            ) : null}
            <div>
              <div className="proposal-company">{company.name}</div>
              {company.region ? (
                <div className="proposal-region">{company.region}</div>
              ) : null}
            </div>
          </div>
          <div className="proposal-hero-copy">
            <p className="proposal-eyebrow">
              {liveActive ? "Live design session" : "Residential proposal"}
            </p>
            <h1>{project.name}</h1>
            {(project.clientName || project.address) && (
              <p className="proposal-meta">
                {[project.clientName, project.address]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="proposal-main">
        {liveActive ? (
          <ClientLiveSessionPanel
            token={token}
            projectName={project.name}
            state={liveState}
            previewImageUrl={previewImageUrl}
            showEstimate={showEstimateInLive}
            estimate={shareIncludesEstimate ? estimate : null}
            onPatched={(next) => {
              setLiveState(next);
              const url = next.previewImageUrl;
              if (url) setPreviewImageUrl(url);
            }}
          />
        ) : (
          <>
            <ProposalDesignPreview
              projectName={project.name}
              previewImageUrl={previewImageUrl}
              previewVideoUrl={initialPreviewVideoUrl}
            />
            {shareIncludesEstimate ? (
              <ProposalEstimateSection estimate={estimate} />
            ) : null}
          </>
        )}

        <p className="proposal-footer muted">
          Shared by {company.name}
          {expiresAt
            ? ` · Link expires ${new Date(expiresAt).toLocaleDateString()}`
            : ""}
          . Powered by PoolShape.
        </p>
      </main>
    </div>
  );
}
