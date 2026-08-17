import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === "platform_owner") {
    return NextResponse.json({ error: "Units do not apply to this account." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    unitSystem?: string;
  };
  if (body.unitSystem !== "imperial" && body.unitSystem !== "metric") {
    return NextResponse.json({ error: "Choose imperial or metric." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { unitSystem: body.unitSystem },
    select: { unitSystem: true },
  });

  return NextResponse.json(updated);
}
