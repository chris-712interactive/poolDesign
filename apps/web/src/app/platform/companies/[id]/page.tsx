import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@pool-design/db";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { getCompanyMilestones, summarizeMilestones } from "@/lib/milestones";

async function updateMilestoneAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user || user.role !== "platform_owner") redirect("/login");

  const statusId = String(formData.get("statusId") || "");
  const action = String(formData.get("action") || "");
  const note = String(formData.get("note") || "") || null;
  const companyId = String(formData.get("companyId") || "");

  const now = new Date();
  if (action === "complete") {
    await prisma.companyMilestoneStatus.update({
      where: { id: statusId },
      data: {
        state: "completed",
        source: "owner",
        note,
        updatedBy: user.id,
        completedAt: now,
        dismissedAt: null,
      },
    });
  } else if (action === "dismiss") {
    await prisma.companyMilestoneStatus.update({
      where: { id: statusId },
      data: {
        state: "dismissed",
        source: "owner",
        note,
        updatedBy: user.id,
        dismissedAt: now,
        completedAt: null,
      },
    });
  } else if (action === "undo") {
    await prisma.companyMilestoneStatus.update({
      where: { id: statusId },
      data: {
        state: "pending",
        source: null,
        note,
        updatedBy: user.id,
        completedAt: null,
        dismissedAt: null,
      },
    });
  }

  revalidatePath(`/platform/companies/${companyId}`);
  revalidatePath("/platform");
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user || user.role !== "platform_owner") redirect("/login");

  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: { _count: { select: { users: true, projects: true } } },
  });
  if (!company) notFound();

  const milestones = await getCompanyMilestones(company.id);
  const summary = summarizeMilestones(milestones);

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page stack">
        <div className="panel">
          <Link href="/platform" className="muted">
            ← All companies
          </Link>
          <h1 style={{ marginTop: "0.75rem" }}>{company.name}</h1>
          <p className="muted">
            {company.slug} · {company.planKey} · {company.subscriptionStatus}
          </p>
          <div className="muted" style={{ marginTop: "0.5rem" }}>
            Stripe customer: {company.stripeCustomerId || "—"}
            <br />
            Subscription: {company.stripeSubscriptionId || "—"}
            {company.trialEndsAt ? (
              <>
                <br />
                Trial ends: {company.trialEndsAt.toLocaleDateString()}
              </>
            ) : null}
          </div>
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <span className="badge">{summary.label} milestones</span>
            {summary.stuckOn && (
              <span className="badge warn">Stuck on {summary.stuckOn}</span>
            )}
          </div>
        </div>

        <div className="panel">
          <h2>Onboarding milestones</h2>
          <p className="muted">
            Complete or dismiss steps that do not apply. Stuck steps are idle
            longer than 7 days.
          </p>
          <div style={{ marginTop: "1rem" }}>
            {milestones.map((item) => (
              <div className="milestone" key={item.id}>
                <span className={`dot ${item.displayState}`} />
                <div>
                  <strong>{item.milestone.title}</strong>
                  <div className="muted">{item.milestone.description}</div>
                  {item.note && (
                    <div className="muted">Note: {item.note}</div>
                  )}
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {item.displayState}
                    {item.source ? ` · ${item.source}` : ""}
                  </div>
                </div>
                <form action={updateMilestoneAction} className="stack">
                  <input type="hidden" name="statusId" value={item.id} />
                  <input type="hidden" name="companyId" value={company.id} />
                  <input
                    name="note"
                    placeholder="Optional note"
                    defaultValue={item.note ?? ""}
                  />
                  <div className="row">
                    {item.state !== "completed" && (
                      <button
                        className="btn"
                        name="action"
                        value="complete"
                        type="submit"
                      >
                        Complete
                      </button>
                    )}
                    {item.state !== "dismissed" && (
                      <button
                        className="btn secondary"
                        name="action"
                        value="dismiss"
                        type="submit"
                      >
                        Dismiss
                      </button>
                    )}
                    {(item.state === "completed" || item.state === "dismissed") && (
                      <button
                        className="btn secondary"
                        name="action"
                        value="undo"
                        type="submit"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </form>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
