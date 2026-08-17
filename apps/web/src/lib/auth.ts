import { cookies } from "next/headers";
import { prisma, type User, type Company, type UserRoleGrant } from "@pool-design/db";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";
import { expireStaleTrial } from "@/lib/subscription";
import { ensureRoleGrants } from "@/lib/roleGrants";

const SESSION_COOKIE = "pd_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export type SessionUser = User & {
  company: Company | null;
  roleGrants: UserRoleGrant[];
};

function secret() {
  return process.env.SESSION_SECRET || "dev-session-secret-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  const payload = `${userId}.${ts}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age > MAX_AGE_SECONDS * 1000) return null;
  return userId;
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

function isDatabaseError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (typeof e.code === "string" && e.code.startsWith("P")) return true;
  const msg = e.message ?? "";
  return (
    msg.includes("DATABASE_URL") ||
    msg.includes("does not exist") ||
    msg.includes("Can't reach database") ||
    msg.includes("Prisma")
  );
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true, roleGrants: true },
    });
    if (!user) return null;
    let roleGrants = user.roleGrants;
    if (user.companyId && roleGrants.length === 0 && user.role !== "platform_owner") {
      await ensureRoleGrants({
        userId: user.id,
        companyId: user.companyId,
        role: user.role,
        alsoDesigner: user.alsoDesigner,
      });
      roleGrants = await prisma.userRoleGrant.findMany({
        where: { userId: user.id },
      });
    }
    if (user.company) {
      const company = await expireStaleTrial(user.company);
      return { ...user, roleGrants, company: company ?? user.company };
    }
    return { ...user, roleGrants };
  } catch (err) {
    console.error("getSessionUser failed", err);
    if (isDatabaseError(err)) return null;
    throw err;
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { company: true, roleGrants: true },
  });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}
