import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@pool-design/db";
import { DESIGN_LEVEL_LABELS, type DesignLevel } from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { CreateProjectForm } from "@/components/CreateProjectForm";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "platform_owner") redirect("/platform");
  if (!user.companyId) redirect("/login");

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
            <div className="stack" style={{ marginTop: "1rem" }}>
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/app/projects/${project.id}`}
                  className="card-link"
                >
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong>{project.name}</strong>
                    <span className="badge">
                      {DESIGN_LEVEL_LABELS[project.designLevel]}
                    </span>
                  </div>
                  <div className="muted">
                    {project.clientName || "No client"} ·{" "}
                    {project.address || "No address"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
