import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingHeader } from "@/components/MarketingHeader";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="mkt">
      <MarketingHeader user={null} />
      <main className="mkt-doc">
        <div className="panel stack">
          <h1>Choose a new password</h1>
          <p className="muted">
            This link works once and expires after an hour. You will be signed
            in afterward.
          </p>
          <ResetPasswordForm token={token} />
          <p className="muted">
            <Link href="/forgot-password">Request a new link</Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
