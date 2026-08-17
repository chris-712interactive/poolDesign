import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@pool-design/db";
import { getSessionUser, setSessionCookie } from "@/lib/auth";

const MIN_PASSWORD = 8;

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
  const current = String(body.currentPassword || "");
  const next = String(body.newPassword || "");
  const confirm = String(body.confirmPassword || "");

  if (!current || !next || !confirm) {
    return NextResponse.json(
      { error: "Fill in all password fields." },
      { status: 400 },
    );
  }
  if (next.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_PASSWORD} characters.` },
      { status: 400 },
    );
  }
  if (next !== confirm) {
    return NextResponse.json(
      { error: "New password and confirmation do not match." },
      { status: 400 },
    );
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await bcrypt.compare(current, row.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });
  await setSessionCookie(user.id);

  return NextResponse.json({ ok: true });
}
