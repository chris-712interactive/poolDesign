import { notFound, redirect } from "next/navigation";
import { prisma } from "@pool-design/db";
import { parseDesignDocument } from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { CadWorkspace } from "@/components/CadWorkspace";
import { SubscriptionBlocked } from "@/components/SubscriptionBlocked";
import { companyHasAppAccess } from "@/lib/subscription";
import { catalogWithCompanyPrices } from "@/lib/shares";
import { entitlementsForCompany } from "@pool-design/shared";

export default async function ProjectCadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "platform_owner") redirect("/platform");
  if (!user.companyId) redirect("/login");

  if (!companyHasAppAccess(user.company)) {
    return <SubscriptionBlocked user={user} />;
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!project) notFound();

  const design = parseDesignDocument(
    project.designJson,
    project.designLevel,
    user.unitSystem,
  );
  const catalog = await catalogWithCompanyPrices(
    user.companyId,
    project.designLevel,
  );
  const entitlements = entitlementsForCompany(user.company);

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page" style={{ paddingTop: "0.85rem" }}>
        <CadWorkspace
          projectId={project.id}
          projectName={project.name}
          designLevel={project.designLevel}
          unitSystem={user.unitSystem}
          initialDesign={design}
          catalog={catalog}
          entitlements={entitlements}
        />
      </main>
    </div>
  );
}
