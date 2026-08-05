import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const milestone = await prisma.onboardingMilestone.findUnique({
    where: { key: "first_estimate" },
  });
  if (milestone) {
    await prisma.companyMilestoneStatus.updateMany({
      where: {
        companyId: user.companyId,
        milestoneId: milestone.id,
        state: { in: ["pending", "in_progress"] },
      },
      data: {
        state: "completed",
        source: "system",
        completedAt: new Date(),
      },
    });
  }

  // Also accept price book milestone as in-progress defaults if still pending
  const priceBook = await prisma.onboardingMilestone.findUnique({
    where: { key: "price_book" },
  });
  if (priceBook) {
    await prisma.companyMilestoneStatus.updateMany({
      where: {
        companyId: user.companyId,
        milestoneId: priceBook.id,
        state: "pending",
      },
      data: {
        state: "completed",
        source: "system",
        note: "Default catalog accepted",
        completedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true, projectId: project.id });
}
