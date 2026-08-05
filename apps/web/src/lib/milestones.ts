import { prisma } from "@pool-design/db";
import { STUCK_THRESHOLD_DAYS } from "@pool-design/shared";

export async function getCompanyMilestones(companyId: string) {
  const rows = await prisma.companyMilestoneStatus.findMany({
    where: { companyId },
    include: { milestone: true },
    orderBy: { milestone: { sortOrder: "asc" } },
  });

  const stuckMs = STUCK_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return rows.map((row) => {
    const inactive =
      row.state === "pending" || row.state === "in_progress";
    const age = now - row.updatedAt.getTime();
    const stuck = inactive && age > stuckMs;
    return {
      ...row,
      displayState: stuck ? ("stuck" as const) : row.state,
    };
  });
}

export function summarizeMilestones(
  items: Awaited<ReturnType<typeof getCompanyMilestones>>,
) {
  const actionable = items.filter((i) => i.state !== "dismissed");
  const done = actionable.filter((i) => i.state === "completed").length;
  const total = actionable.length;
  const stuck = items.find((i) => i.displayState === "stuck");
  const next = items.find(
    (i) => i.state === "pending" || i.state === "in_progress",
  );
  return {
    done,
    total,
    label: `${done}/${total}`,
    stuckOn: stuck?.milestone.title ?? null,
    nextStep: next?.milestone.title ?? null,
    fullyOnboarded: done === total && total > 0,
  };
}
