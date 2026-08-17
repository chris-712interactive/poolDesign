import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingHeader } from "@/components/MarketingHeader";

export default function TermsPage() {
  return (
    <div className="mkt">
      <MarketingHeader user={null} />
      <main className="mkt-doc">
        <div className="panel stack">
          <h1>Terms of use</h1>
          <p className="muted">Last updated August 14, 2026</p>
          <p>
            PoolShape is software for pool companies to design, estimate, and
            share projects with clients. It is not a substitute for a licensed
            professional engineer, surveyor, or permitting authority. Draft
            permit packets and takeoffs are for internal and professional
            review only and are not PE-stamped.
          </p>
          <p>
            Company trials last 14 days and do not require a payment method.
            After the trial, continued access requires a paid Sales or Builder
            subscription billed by Stripe. You may cancel in billing settings.
          </p>
          <p>
            You are responsible for the accuracy of designs, prices, and
            materials you enter. Do not upload content you do not have rights
            to use. We may suspend accounts that abuse the service or violate
            the law.
          </p>
          <p>
            Questions: contact the operator of this deployment from your
            company admin profile.
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
