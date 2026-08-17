/** Architectural plan vignette — not a property survey. */
export function MarketingPlanGraphic() {
  return (
    <svg
      className="mkt-plan-svg"
      viewBox="0 0 640 480"
      role="img"
      aria-label="Plan drawing of a freeform pool, spa, and patio"
    >
      <rect width="640" height="480" fill="#f3efe6" />
      <g stroke="#d5cbb8" strokeWidth="1" fill="none">
        {Array.from({ length: 16 }, (_, i) => (
          <line key={`v${i}`} x1={40 * i} y1="0" x2={40 * i} y2="480" />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={40 * i} x2="640" y2={40 * i} />
        ))}
      </g>
      <path
        d="M92 86h456v308H92z"
        fill="none"
        stroke="#085060"
        strokeWidth="1.25"
        strokeDasharray="7 5"
        opacity="0.45"
      />
      <path
        d="M128 128h372c18 0 28 14 28 32v176c0 22-16 36-40 36H168c-28 0-48-16-48-42V160c0-18 12-32 32-32z"
        fill="#e7e1d4"
        stroke="#085060"
        strokeWidth="1.5"
      />
      <path
        d="M188 168c72-28 148-22 214 8 48 22 78 58 74 102-6 62-58 98-128 108-78 12-150-8-186-58-32-44-22-118 26-160z"
        fill="#38b8d0"
        stroke="#085060"
        strokeWidth="2.25"
      />
      <path
        d="M188 168c72-28 148-22 214 8 48 22 78 58 74 102-6 62-58 98-128 108-78 12-150-8-186-58-32-44-22-118 26-160z"
        fill="none"
        stroke="#c9a36a"
        strokeWidth="5"
        opacity="0.85"
      />
      <ellipse
        cx="248"
        cy="188"
        rx="42"
        ry="28"
        fill="#2aa0b8"
        stroke="#085060"
        strokeWidth="1.75"
      />
      <path
        d="M206 188 h84"
        stroke="#085060"
        strokeWidth="1"
        opacity="0.35"
      />
      <g fill="none" stroke="#085060" strokeWidth="1.1">
        <rect x="452" y="168" width="36" height="22" rx="2" />
        <rect x="452" y="198" width="36" height="22" rx="2" />
        <rect x="452" y="228" width="36" height="22" rx="2" />
      </g>
      <g stroke="#085060" strokeWidth="1.25" fill="none">
        <path d="M168 348 h48 v18 h-48z" />
        <path d="M176 348 v18 M184 348 v18 M192 348 v18 M200 348 v18 M208 348 v18" />
      </g>
      <g fill="#085060" fontFamily="ui-serif, Georgia, serif" fontSize="11">
        <text x="40" y="36">
          PLAN · 1/8&quot; = 1&apos;-0&quot;
        </text>
        <text x="40" y="454">
          VESSEL · SPA · DECK
        </text>
        <text x="470" y="454">
          N
        </text>
      </g>
      <g transform="translate(590 430)" fill="none" stroke="#085060" strokeWidth="1.4">
        <line x1="0" y1="12" x2="0" y2="-18" />
        <polyline points="-5,-8 0,-18 5,-8" />
      </g>
    </svg>
  );
}
