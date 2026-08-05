import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import {
  getCompanyMilestones,
  summarizeMilestones,
} from "@/lib/milestones";

export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getSessionUser();
  if (!user || user.role !== "platform_owner") redirect("/login");

  const params = await searchParams;
  const filter = params.filter || "all";

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, projects: true } } },
  });

  const rows = await Promise.all(
    companies.map(async (company) => {
      const milestones = await getCompanyMilestones(company.id);
      const summary = summarizeMilestones(milestones);
      return { company, summary, milestones };
    }),
  );

  const filtered = rows.filter((row) => {
    if (filter === "stuck") return Boolean(row.summary.stuckOn);
    if (filter === "on_track")
      return !row.summary.stuckOn && !row.summary.fullyOnboarded;
    if (filter === "onboarded") return row.summary.fullyOnboarded;
    return true;
  });

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page stack">
        <div className="panel">
          <h1>Platform owner console</h1>
          <p className="muted">
            Manage companies, subscriptions, and onboarding progress.
          </p>
          <div className="row" style={{ marginTop: "1rem" }}>
            <Link
              className={`btn ${filter === "all" ? "" : "secondary"}`}
              href="/platform"
            >
              All
            </Link>
            <Link
              className={`btn ${filter === "stuck" ? "" : "secondary"}`}
              href="/platform?filter=stuck"
            >
              Stuck
            </Link>
            <Link
              className={`btn ${filter === "on_track" ? "" : "secondary"}`}
              href="/platform?filter=on_track"
            >
              On track
            </Link>
            <Link
              className={`btn ${filter === "onboarded" ? "" : "secondary"}`}
              href="/platform?filter=onboarded"
            >
              Fully onboarded
            </Link>
          </div>
        </div>

        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Onboarding</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ company, summary }) => (
                <tr key={company.id}>
                  <td>
                    <Link href={`/platform/companies/${company.id}`}>
                      <strong>{company.name}</strong>
                    </Link>
                    <div className="muted">{company.slug}.localhost</div>
                  </td>
                  <td>{company.planKey}</td>
                  <td>
                    <span
                      className={`badge ${
                        company.subscriptionStatus === "past_due" ||
                        company.subscriptionStatus === "suspended"
                          ? "warn"
                          : ""
                      }`}
                    >
                      {company.subscriptionStatus}
                    </span>
                  </td>
                  <td>
                    <div>{summary.label}</div>
                    {summary.stuckOn ? (
                      <div className="badge warn">Stuck on {summary.stuckOn}</div>
                    ) : summary.nextStep ? (
                      <div className="muted">Next: {summary.nextStep}</div>
                    ) : (
                      <div className="badge">Onboarded</div>
                    )}
                  </td>
                  <td className="muted">
                    {company._count.users} users · {company._count.projects}{" "}
                    projects
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
