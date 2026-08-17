import { redirect } from "next/navigation";
import { prisma } from "@pool-design/db";
import { needsCompanySetup, type DesignLevel } from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { ProjectList } from "@/components/ProjectList";
import { SubscriptionBlocked } from "@/components/SubscriptionBlocked";
import { companyHasAppAccess } from "@/lib/subscription";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "platform_owner") redirect("/platform");
  if (!user.companyId) redirect("/login");
  if (needsCompanySetup(user)) redirect("/app/setup");

  if (!companyHasAppAccess(user.company)) {
    return <SubscriptionBlocked user={user} />;
  }

  const company = user.company!;
  const enabled = company.enabledDesignLevels.split(",") as DesignLevel[];

  const projects = await prisma.project.findMany({
    where: { companyId: user.companyId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page stack">
        <div className="panel grid-2">
          <div>
            <h1>{company.name}</h1>
            <p className="muted">
              Projects for designers and estimators. Choose a design level when
              creating a job.
            </p>
          </div>
          <CreateProjectForm enabledLevels={enabled} />
        </div>

        <div className="panel">
          <h2>Projects</h2>
          {projects.length === 0 ? (
            <p className="muted">No projects yet. Create your first one.</p>
          ) : (
            <ProjectList
              projects={projects.map((project) => ({
                id: project.id,
                name: project.name,
                clientName: project.clientName,
                address: project.address,
                designLevel: project.designLevel as DesignLevel,
              }))}
            />
          )}
        </div>
      </main>
    </div>
  );
}
