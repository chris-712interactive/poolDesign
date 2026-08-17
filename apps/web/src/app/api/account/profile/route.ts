import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  if (email !== user.email) {
    const taken = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (taken && taken.id !== user.id) {
      return NextResponse.json(
        { error: "That email is already in use." },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name, email },
    select: { name: true, email: true },
  });

  return NextResponse.json(updated);
}
