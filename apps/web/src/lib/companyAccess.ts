import { canUseCad, needsCompanySetup } from "@pool-design/shared";
import type { SessionUser } from "@/lib/auth";

export function appHomePath(user: SessionUser): string {
  if (user.role === "platform_owner") return "/platform";
  if (needsCompanySetup(user)) return "/app/setup";
  return "/app";
}

export function userCanUseCad(user: SessionUser): boolean {
  return canUseCad(user.role, user.alsoDesigner);
}
