import { prisma } from "@pool-design/db";
import { type TakeoffResult } from "@pool-design/shared";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicProposalClient } from "@/components/PublicProposalClient";

type PageProps = { params: Promise<{ token: string }> };

async function loadShare(token: string) {
  const share = await prisma.projectShare.findUnique({
    where: { token },
    select: {
      revokedAt: true,
      expiresAt: true,
      includeEstimate: true,
      estimateSnapshotJson: true,
      previewVideoUrl: true,
      project: {
        select: {
          name: true,
          clientName: true,
          address: true,
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
  const share = await prisma.projectShare.findUnique({
    where: { token },
    select: {
      revokedAt: true,
      expiresAt: true,
      project: {
        select: {
          name: true,
          company: { select: { name: true } },
        },
      },
    },
  });
  if (
    !share ||
    share.revokedAt ||
    (share.expiresAt && share.expiresAt.getTime() < Date.now())
  ) {
    return { title: "Proposal unavailable" };
  }
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
    <PublicProposalClient
      token={token}
      company={{
        name: company.name,
        logoUrl: company.logoUrl,
        region: company.region,
      }}
      project={{
        name: project.name,
        clientName: project.clientName,
        address: project.address,
      }}
      initialHasPreview={false}
      initialPreviewVideoUrl={share.previewVideoUrl}
      shareIncludesEstimate={share.includeEstimate}
      estimate={estimate}
      expiresAt={share.expiresAt ? share.expiresAt.toISOString() : null}
    />
  );
}
