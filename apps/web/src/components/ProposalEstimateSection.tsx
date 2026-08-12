"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatMoney,
  formatQuantity,
  type TakeoffResult,
} from "@pool-design/shared";

type Props = {
  token: string;
  /** Share was created with an estimate snapshot. */
  shareIncludesEstimate: boolean;
  estimate: TakeoffResult | null;
};

/**
 * Hides the estimate during an active live session unless the designer
 * opts in via live session `showEstimate`.
 */
export function ProposalEstimateSection({
  token,
  shareIncludesEstimate,
  estimate,
}: Props) {
  const [liveActive, setLiveActive] = useState(false);
  const [showEstimateInLive, setShowEstimateInLive] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/p/${token}/live`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      active: boolean;
      state: { showEstimate?: boolean };
    };
    setLiveActive(json.active);
    setShowEstimateInLive(Boolean(json.state?.showEstimate));
  }, [token]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [refresh]);

  if (!shareIncludesEstimate || !estimate) return null;

  // Live preview mode: hide pricing unless designer turned it on.
  if (liveActive && !showEstimateInLive) {
    return (
      <section className="proposal-panel">
        <h2>Estimate</h2>
        <p className="muted" style={{ margin: 0 }}>
          Pricing is hidden during this live preview. Your designer can share
          the estimate when you&apos;re ready to review numbers.
        </p>
      </section>
    );
  }

  return (
    <section className="proposal-panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Estimate summary</h2>
        <strong>{formatMoney(estimate.subtotalCents)}</strong>
      </div>
      <p className="muted">
        Indicative takeoff at share time. Final pricing may change.
      </p>
      <div className="proposal-table-wrap">
        <table className="proposal-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {estimate.lines.map((line) => (
              <tr key={line.lineKey}>
                <td>
                  <div>{line.name}</div>
                  {line.note ? (
                    <div className="muted">{line.note}</div>
                  ) : null}
                </td>
                <td>{formatQuantity(line.quantity, line.unit)}</td>
                <td>{formatMoney(line.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
