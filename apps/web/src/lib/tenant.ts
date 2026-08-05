import { headers } from "next/headers";
import { prisma } from "@pool-design/db";

/** Resolve company from Host header (subdomain or custom domain). */
export async function resolveTenantFromHost() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "")
    .toLowerCase()
    .split(":")[0];

  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000")
    .toLowerCase()
    .split(":")[0];

  if (!host || host === root || host === "localhost" || host === "127.0.0.1") {
    return null;
  }

  if (host.endsWith(`.${root}`)) {
    const slug = host.slice(0, -(root.length + 1));
    if (!slug || slug === "www" || slug === "admin") return null;
    return prisma.company.findUnique({ where: { slug } });
  }

  return prisma.company.findUnique({ where: { customDomain: host } });
}
