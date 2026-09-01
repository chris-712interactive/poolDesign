import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingHeader } from "@/components/MarketingHeader";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { supportEmail, supportMailto } from "@/lib/support";

export default function ForgotPasswordPage() {
  const email = supportEmail();
  const mailto = supportMailto();

  return (
    <div className="mkt">
      <MarketingHeader user={null} />
      <main className="mkt-doc">
        <div className="panel stack">
          <h1>Reset your password</h1>
          <p className="muted">
            Enter the email on your account. If it matches, we send a one-hour
            reset link.
          </p>
          <ForgotPasswordForm />
          {email && mailto ? (
            <p className="muted">
              Still stuck? Write{" "}
              <a href={mailto}>{email}</a>.
            </p>
          ) : null}
          <p className="muted">
            <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
