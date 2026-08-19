import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@pool-design/db";
import {
  needsCompanySetup,
  parseDesignStatus,
  storedVoiceUrl,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { ProjectDetailsForm } from "@/components/ProjectDetailsForm";
import { ProjectReviewTimeline } from "@/components/ProjectReviewTimeline";
import { SubscriptionBlocked } from "@/components/SubscriptionBlocked";
import { companyHasAppAccess } from "@/lib/subscription";
import { userCanUseCad, userHasLicensedCadAccess } from "@/lib/companyAccess";

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "platform_owner") redirect("/platform");
  if (!user.companyId) redirect("/login");
  if (needsCompanySetup(user)) redirect("/app/setup");
  if (!companyHasAppAccess(user.company)) {
    return <SubscriptionBlocked user={user} />;
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      reviews: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) notFound();

  const canOpenCad =
    userCanUseCad(user) && (await userHasLicensedCadAccess(user));

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page" style={{ maxWidth: 640 }}>
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            <Link href="/app">Projects</Link>
            {canOpenCad ? (
              <>
                {" · "}
                <Link href={`/app/projects/${project.id}`}>Open drawing</Link>
              </>
            ) : null}
          </p>
          <h1>Project details</h1>
          <p className="muted">
            Contact and job-site address. City and state feed Markets. Client
            approvals and change requests from the share link are listed below.
          </p>
          <ProjectDetailsForm
            projectId={project.id}
            initial={{
              name: project.name,
              clientName: project.clientName ?? "",
              phone: project.phone ?? "",
              street: project.street,
              city: project.city,
              state: project.state,
              postalCode: project.postalCode,
              country: project.country,
            }}
          />
          <ProjectReviewTimeline
            designStatus={parseDesignStatus(project.designStatus)}
            reviews={project.reviews.map((r) => ({
              id: r.id,
              kind: r.kind,
              noteText: r.noteText,
              voiceUrl: storedVoiceUrl(r.voiceUrl),
              createdAt: r.createdAt.toISOString(),
            }))}
          />
        </div>
      </main>
    </div>
  );
}
