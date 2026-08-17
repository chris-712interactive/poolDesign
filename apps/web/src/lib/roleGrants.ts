import type { UserRole } from "@pool-design/db";
import { prisma } from "@pool-design/db";
import {
  alsoDesignerFromGrants,
  isCompanyStaffRole,
  primaryRoleFromGrants,
  type CompanyStaffRole,
} from "@pool-design/shared";

export async function ensureRoleGrants(opts: {
  userId: string;
  companyId: string;
  role: string;
  alsoDesigner?: boolean;
}): Promise<CompanyStaffRole[]> {
  const existing = await prisma.userRoleGrant.findMany({
    where: { userId: opts.userId },
    select: { role: true },
  });
  if (existing.length > 0) {
    return existing
      .map((row) => row.role)
      .filter(isCompanyStaffRole);
  }
  if (opts.role === "platform_owner" || !opts.companyId) return [];
  const roles = new Set<CompanyStaffRole>();
  if (isCompanyStaffRole(opts.role)) roles.add(opts.role);
  if (opts.alsoDesigner) roles.add("designer");
  if (roles.size === 0) return [];
  await prisma.userRoleGrant.createMany({
    data: [...roles].map((role) => ({
      userId: opts.userId,
      companyId: opts.companyId,
      role,
    })),
  });
  return [...roles];
}

export async function grantRoles(opts: {
  userId: string;
  companyId: string;
  roles: readonly CompanyStaffRole[];
}): Promise<CompanyStaffRole[]> {
  const unique = [...new Set(opts.roles.filter(isCompanyStaffRole))];
  if (unique.length === 0) {
    throw new Error("Choose at least one role.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.userRoleGrant.deleteMany({ where: { userId: opts.userId } });
    await tx.userRoleGrant.createMany({
      data: unique.map((role) => ({
        userId: opts.userId,
        companyId: opts.companyId,
        role,
      })),
    });
    const primary = primaryRoleFromGrants(unique) as UserRole;
    await tx.user.update({
      where: { id: opts.userId },
      data: {
        role: primary,
        alsoDesigner: alsoDesignerFromGrants(unique),
      },
    });
  });
  return unique;
}

export async function addRoleGrant(opts: {
  userId: string;
  companyId: string;
  role: CompanyStaffRole;
}): Promise<CompanyStaffRole[]> {
  const current = await prisma.userRoleGrant.findMany({
    where: { userId: opts.userId },
    select: { role: true },
  });
  const roles = new Set(
    current.map((row) => row.role).filter(isCompanyStaffRole),
  );
  roles.add(opts.role);
  return grantRoles({
    userId: opts.userId,
    companyId: opts.companyId,
    roles: [...roles],
  });
}

export async function designerUserIdsOldestFirst(
  companyId: string,
): Promise<string[]> {
  const grants = await prisma.userRoleGrant.findMany({
    where: { companyId, role: "designer" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return grants.map((row) => row.userId);
}

export async function countAdmins(companyId: string): Promise<number> {
  return prisma.userRoleGrant.count({
    where: { companyId, role: "company_admin" },
  });
}
