import { notFound } from "next/navigation";
import { prisma } from "@pool-design/db";
import { AcceptInviteForm } from "@/components/AcceptInviteForm";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.companyInvite.findUnique({
    where: { token },
    include: { company: { select: { name: true } } },
  });
  if (!invite || invite.acceptedAt) notFound();
  const expired = invite.expiresAt.getTime() < Date.now();

  return (
    <div className="app-shell">
      <main className="page" style={{ maxWidth: 480, margin: "3rem auto" }}>
        <div className="panel stack">
          <h1>Join {invite.company.name}</h1>
          <p className="muted">
            You were invited as <strong>{invite.name}</strong> ({invite.email}).
            Use the temporary password from your invite email (or from your
            admin) to create your account.
          </p>
          {expired ? (
            <p style={{ color: "var(--danger)" }}>
              This invite has expired. Ask your admin to send a new one.
            </p>
          ) : (
            <AcceptInviteForm token={token} />
          )}
        </div>
      </main>
    </div>
  );
}
