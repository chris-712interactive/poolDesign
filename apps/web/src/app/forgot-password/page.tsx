import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingHeader } from "@/components/MarketingHeader";
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
            Email password reset is not on yet. If you still have access, change
            the password under Account settings. If you are locked out, ask a
            company admin to invite you again, or write support.
          </p>
          {email && mailto ? (
            <p>
              Support:{" "}
              <a href={mailto}>{email}</a>
            </p>
          ) : (
            <p className="muted">
              If you are the company admin, sign in from another device if you
              can, or contact the person who deployed PoolShape.
            </p>
          )}
          <p className="muted">
            <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
