import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@pool-design/db";
import {
  isLocalTrialActive,
  needsCompanySetup,
  type DesignLevel,
} from "@pool-design/shared";
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
  const trialActive = isLocalTrialActive(company);
  const isAdmin = user.role === "company_admin";

  const projects = await prisma.project.findMany({
    where: { companyId: user.companyId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page stack">
        {projects.length === 0 ? (
          <div className="panel first-job">
            <div className="first-job-copy">
              <p className="muted first-job-kicker">{company.name}</p>
              <h1>Open the first job</h1>
              <p>
                Name the backyard, pick a design level, and set the job-site
                city and state. Next you will drop the survey on the sheet — the
                same drawing drives 3D and takeoff.
              </p>
              {isAdmin ? (
                <p className="muted">
                  Need a teammate on CAD?{" "}
                  <Link href="/app/admin?section=team">Invite a designer</Link>
                  {trialActive
                    ? " Extra seats are free during the trial."
                    : " Extra designer seats bill with your plan."}
                </p>
              ) : null}
            </div>
            <CreateProjectForm
              enabledLevels={enabled}
              heading="Job details"
              submitLabel="Create and open"
            />
          </div>
        ) : (
          <>
            <div className="panel grid-2">
              <div>
                <h1>{company.name}</h1>
                <p className="muted">
                  Projects for designers and estimators. Choose a design level
                  when creating a job.
                </p>
                {isAdmin ? (
                  <p className="muted">
                    <Link href="/app/admin?section=markets">
                      See where jobs are coming from
                    </Link>
                    {trialActive ? (
                      <>
                        {" · "}
                        <Link href="/app/admin?section=team">Invite a designer</Link>
                        {" — extra seats are free during the trial."}
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <CreateProjectForm enabledLevels={enabled} />
            </div>

            <div className="panel">
              <h2>Projects</h2>
              <ProjectList
                projects={projects.map((project) => ({
                  id: project.id,
                  name: project.name,
                  clientName: project.clientName,
                  address: project.address,
                  city: project.city,
                  state: project.state,
                  designLevel: project.designLevel as DesignLevel,
                }))}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
