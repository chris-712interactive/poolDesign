import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";

/** Company admin: take or drop a designer seat on your own account. */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    alsoDesigner?: boolean;
  };
  if (typeof body.alsoDesigner !== "boolean") {
    return NextResponse.json({ error: "alsoDesigner is required" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { alsoDesigner: body.alsoDesigner },
    select: { alsoDesigner: true },
  });

  return NextResponse.json(updated);
}
