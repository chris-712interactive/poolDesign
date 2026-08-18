import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@pool-design/db";
import {
  entitlementsForCompany,
  needsCompanySetup,
  parseDesignDocument,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { CadWorkspace } from "@/components/CadWorkspace";
import { SubscriptionBlocked } from "@/components/SubscriptionBlocked";
import { companyHasAppAccess } from "@/lib/subscription";
import { userCanUseCad, userHasLicensedCadAccess } from "@/lib/companyAccess";
import { catalogWithCompanyPrices, loadCompanyEstimateRecipe } from "@/lib/shares";

export default async function ProjectCadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ survey?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "platform_owner") redirect("/platform");
  if (!user.companyId) redirect("/login");
  if (needsCompanySetup(user)) redirect("/app/setup");

  if (!companyHasAppAccess(user.company)) {
    return <SubscriptionBlocked user={user} />;
  }

  const { id } = await params;
  const { survey } = await searchParams;
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
  const estimateRecipe = await loadCompanyEstimateRecipe(user.companyId);
  const entitlements = entitlementsForCompany(user.company);

  const hasDesignerRole = userCanUseCad(user);
  const hasLicensedCad = await userHasLicensedCadAccess(user);

  if (!hasDesignerRole || !hasLicensedCad) {
    return (
      <div className="app-shell">
        <AppHeader user={user} />
        <main className="page" style={{ maxWidth: 560 }}>
          <div className="panel stack">
            <h1>
              {hasDesignerRole ? "Designer license needed" : "Designer seat needed"}
            </h1>
            <p>
              {hasDesignerRole
                ? "This account has the designer role, but there is no active Stripe seat covering CAD. Ask a company admin to assign a paid designer license."
                : "CAD is for designer seats. Assign one in Company admin, or invite a designer to open this project."}
            </p>
            {user.role === "company_admin" ? (
              <Link className="btn" href="/app/admin?section=team">
                Open team permissions
              </Link>
            ) : (
              <p className="muted">Ask your company admin to grant CAD access.</p>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader user={user} compact />
      <main className="page page-cad">
        <CadWorkspace
          projectId={project.id}
          projectName={project.name}
          designLevel={project.designLevel}
          unitSystem={user.unitSystem}
          initialDesign={design}
          catalog={catalog}
          estimateRecipe={estimateRecipe}
          entitlements={entitlements}
          promptSurveyImport={survey === "1"}
        />
      </main>
    </div>
  );
}
