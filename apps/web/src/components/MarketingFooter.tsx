import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-footer-inner">
        <div className="mkt-footer-brand">
          <img
            src="/brand/mark.svg"
            alt=""
            width={28}
            height={28}
            className="mkt-brand-mark"
          />
          <div>
            <strong>PoolShape</strong>
            <p>Design software for production pool companies.</p>
          </div>
        </div>
        <nav aria-label="Footer">
          <Link href="/#product">Product</Link>
          <Link href="/#workflow">Workflow</Link>
          <Link href="/#plans">Plans</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </div>
      <p className="mkt-footer-note">
        Draft permit packets and takeoffs are for professional review. They are
        not PE-stamped.
      </p>
    </footer>
  );
}
