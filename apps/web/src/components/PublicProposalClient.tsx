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
  phone: string | null;
  address: string | null;
};

type Props = {
  token: string;
  company: Company;
  project: Project;
  initialHasPreview: boolean;
  initialPreviewVideoUrl: string | null;
  shareIncludesEstimate: boolean;
  estimate: TakeoffResult | null;
  expiresAt: string | null;
};

function stillSrc(token: string, rev: string | null): string {
  const q = rev ? `?v=${encodeURIComponent(rev)}` : "";
  return `/api/p/${token}/still${q}`;
}

/**
 * Public proposal shell. When a live session is on, drops the duplicate
 * still and uses a wide side-by-side preview + finish picker layout.
 */
export function PublicProposalClient({
  token,
  company,
  project,
  initialHasPreview,
  initialPreviewVideoUrl,
  shareIncludesEstimate,
  estimate,
  expiresAt,
}: Props) {
  const [liveActive, setLiveActive] = useState(false);
  const [liveState, setLiveState] = useState<LiveSessionState | null>(null);
  const [hasPreview, setHasPreview] = useState(initialHasPreview);
  const [previewRev, setPreviewRev] = useState<string | null>(null);
  const [showEstimateInLive, setShowEstimateInLive] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/p/${token}/live`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as {
      active: boolean;
      updatedAt?: string | null;
      hasPreview?: boolean;
      previewImageUrl?: string | null;
      state: LiveSessionState;
    };
    setLiveActive(json.active);
    setLiveState(json.state);
    setShowEstimateInLive(Boolean(json.state?.showEstimate));
    if (typeof json.hasPreview === "boolean") {
      setHasPreview(json.hasPreview);
    } else if (json.previewImageUrl || json.state?.previewImageUrl) {
      setHasPreview(true);
    }
    if (json.updatedAt) setPreviewRev(json.updatedAt);
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
            {(project.clientName || project.phone || project.address) && (
              <p className="proposal-meta">
                {[project.clientName, project.phone, project.address]
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
            previewImageUrl={
              hasPreview ? stillSrc(token, previewRev) : null
            }
            showEstimate={showEstimateInLive}
            estimate={shareIncludesEstimate ? estimate : null}
            onPatched={(next) => {
              setLiveState(next);
              if (next.previewImageUrl) setHasPreview(true);
              setPreviewRev(new Date().toISOString());
            }}
          />
        ) : (
          <>
            <ProposalDesignPreview
              projectName={project.name}
              previewImageUrl={
                hasPreview ? stillSrc(token, previewRev) : null
              }
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
