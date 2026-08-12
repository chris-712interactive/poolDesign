import { prisma } from "@pool-design/db";
import {
  formatMoney,
  formatQuantity,
  type TakeoffResult,
} from "@pool-design/shared";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ClientLiveSessionPanel } from "@/components/ClientLiveSessionPanel";

type PageProps = { params: Promise<{ token: string }> };

async function loadShare(token: string) {
  const share = await prisma.projectShare.findUnique({
    where: { token },
    include: {
      project: {
        include: {
          company: {
            select: {
              name: true,
              logoUrl: true,
              region: true,
              slug: true,
            },
          },
        },
      },
    },
  });
  if (!share || share.revokedAt) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;
  return share;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const share = await loadShare(token);
  if (!share) return { title: "Proposal unavailable" };
  const title = `${share.project.name} · ${share.project.company.name}`;
  return {
    title,
    description: `Residential pool proposal from ${share.project.company.name}`,
  };
}

export default async function PublicProposalPage({ params }: PageProps) {
  const { token } = await params;
  const share = await loadShare(token);
  if (!share) notFound();

  const estimate = share.estimateSnapshotJson
    ? (JSON.parse(share.estimateSnapshotJson) as TakeoffResult)
    : null;
  const company = share.project.company;
  const project = share.project;

  return (
    <div className="proposal-page">
      <header className="proposal-hero">
        <div className="proposal-hero-inner">
          <div className="proposal-brand">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl}
                alt=""
                className="proposal-logo"
              />
            ) : null}
            <div>
              <div className="proposal-company">{company.name}</div>
              {company.region ? (
                <div className="proposal-region">{company.region}</div>
              ) : null}
            </div>
          </div>
          <p className="proposal-eyebrow">Residential proposal</p>
          <h1>{project.name}</h1>
          {(project.clientName || project.address) && (
            <p className="proposal-meta">
              {[project.clientName, project.address].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </header>

      <main className="proposal-main">
        <section className="proposal-panel">
          <h2>Design preview</h2>
          {share.previewImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={share.previewImageUrl}
              alt={`3D preview of ${project.name}`}
              className="proposal-preview"
            />
          ) : (
            <p className="muted">
              A 3D still has not been attached to this link yet. Ask your
              designer to refresh the preview from the CAD workspace.
            </p>
          )}
          {share.previewVideoUrl ? (
            <video
              className="proposal-preview"
              src={share.previewVideoUrl}
              controls
              playsInline
            />
          ) : null}
        </section>

        {share.includeEstimate && estimate ? (
          <section className="proposal-panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>Estimate summary</h2>
              <strong>{formatMoney(estimate.subtotalCents)}</strong>
            </div>
            <p className="muted">
              Indicative takeoff at share time. Final pricing may change.
            </p>
            <div className="proposal-table-wrap">
              <table className="proposal-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.lines.map((line) => (
                    <tr key={line.lineKey}>
                      <td>
                        <div>{line.name}</div>
                        {line.note ? (
                          <div className="muted">{line.note}</div>
                        ) : null}
                      </td>
                      <td>
                        {formatQuantity(line.quantity, line.unit)}
                      </td>
                      <td>{formatMoney(line.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <ClientLiveSessionPanel token={token} />

        <p className="proposal-footer muted">
          Shared by {company.name}
          {share.expiresAt
            ? ` · Link expires ${share.expiresAt.toLocaleDateString()}`
            : ""}
          . Powered by PoolShape.
        </p>
      </main>
    </div>
  );
}
