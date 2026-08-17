import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingHeader } from "@/components/MarketingHeader";

export default function PrivacyPage() {
  return (
    <div className="mkt">
      <MarketingHeader user={null} />
      <main className="mkt-doc">
        <div className="panel stack">
          <h1>Privacy policy</h1>
          <p className="muted">Last updated August 14, 2026</p>
          <p>
            We collect the account information you provide at signup (company
            name, your name, email) and the project data your team stores in
            PoolShape. Session cookies keep you signed in.
          </p>
          <p>
            Payment details are collected by Stripe when you subscribe. We do
            not store card numbers. During the free trial we do not collect a
            payment method.
          </p>
          <p>
            Client proposal links are accessible to anyone with the URL until
            you revoke them. Do not put secrets in a public share.
          </p>
          <p>
            We use hosting, database, and file-storage processors to run the
            product. We do not sell personal information or resell homeowner
            leads.
          </p>
          <p>
            <Link href="/">Back to PoolShape</Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
