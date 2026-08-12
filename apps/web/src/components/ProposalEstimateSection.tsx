"use client";

import {
  formatMoney,
  formatQuantity,
  type TakeoffResult,
} from "@pool-design/shared";

type Props = {
  estimate: TakeoffResult | null;
  /** Compact body for the live-session sidebar tab. */
  embedded?: boolean;
};

/** Estimate table used on the public proposal and in the live sidebar. */
export function ProposalEstimateSection({
  estimate,
  embedded = false,
}: Props) {
  if (!estimate) {
    if (!embedded) return null;
    return (
      <p className="muted" style={{ margin: 0 }}>
        No estimate is attached to this link yet. Ask your designer to include
        it when they share.
      </p>
    );
  }

  const body = (
    <>
      <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
        {embedded ? (
          <h3 style={{ margin: 0 }}>Estimate</h3>
        ) : (
          <h2>Estimate summary</h2>
        )}
        <strong>{formatMoney(estimate.subtotalCents)}</strong>
      </div>
      <p className="muted" style={{ margin: embedded ? "0.35rem 0 0" : undefined }}>
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
    </>
  );

  if (embedded) {
    return <div className="client-live-estimate">{body}</div>;
  }

  return <section className="proposal-panel">{body}</section>;
}
