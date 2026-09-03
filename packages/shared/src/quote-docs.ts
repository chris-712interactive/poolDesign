/**
 * Quote / takeoff export helpers (CSV + print HTML).
 */

import { formatMoney } from "./catalog";
import { formatProjectMetaLine } from "./address";
import { formatQuantity, type TakeoffResult } from "./takeoff";

export type QuoteDocMeta = {
  companyName: string;
  companyLogoUrl?: string | null;
  companyRegion?: string | null;
  projectName: string;
  clientName?: string | null;
  phone?: string | null;
  address?: string | null;
  generatedAt?: string;
  planLabel?: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV of active takeoff lines (estimator-friendly). */
export function takeoffToCsv(takeoff: TakeoffResult): string {
  const header = [
    "Item",
    "Category",
    "Quantity",
    "Unit",
    "UnitPriceUSD",
    "TotalUSD",
    "Note",
    "LineKey",
  ];
  const rows = takeoff.lines.map((line) => [
    csvCell(line.name),
    csvCell(line.category),
    csvCell(line.quantity),
    csvCell(line.unit),
    csvCell((line.unitPriceCents / 100).toFixed(2)),
    csvCell((line.totalCents / 100).toFixed(2)),
    csvCell(line.note ?? ""),
    csvCell(line.lineKey),
  ]);
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/** Printable HTML quote (open in browser → Print → Save as PDF). */
export function buildQuoteHtml(
  meta: QuoteDocMeta,
  takeoff: TakeoffResult,
): string {
  const when = meta.generatedAt
    ? new Date(meta.generatedAt).toLocaleString()
    : new Date().toLocaleString();
  const rows = takeoff.lines
    .map(
      (line) => `<tr>
  <td><strong>${esc(line.name)}</strong>${
    line.note ? `<div class="muted">${esc(line.note)}</div>` : ""
  }</td>
  <td>${esc(line.category)}</td>
  <td>${esc(formatQuantity(line.quantity, line.unit))}</td>
  <td>${esc(formatMoney(line.unitPriceCents))}</td>
  <td>${esc(formatMoney(line.totalCents))}</td>
</tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Quote — ${esc(meta.projectName)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "Source Serif 4", Georgia, serif; margin: 0; color: #1a2420; background: #f7f4ef; }
    .sheet { max-width: 880px; margin: 0 auto; padding: 2rem 1.5rem 3rem; background: #fff; }
    header { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 2px solid #1a2420; padding-bottom: 1rem; margin-bottom: 1.25rem; }
    .brand { display: flex; gap: 0.85rem; align-items: center; }
    .logo { max-height: 48px; max-width: 140px; object-fit: contain; }
    h1 { font-size: 1.55rem; margin: 0 0 0.25rem; font-family: "Fraunces", Georgia, serif; }
    .muted { color: #5c6b64; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid #d9e0db; vertical-align: top; font-size: 0.92rem; }
    th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #5c6b64; }
    .total { text-align: right; font-size: 1.15rem; margin-top: 1rem; }
    .disclaimer { margin-top: 1.75rem; font-size: 0.8rem; color: #5c6b64; border-top: 1px solid #d9e0db; padding-top: 0.85rem; }
    .no-print-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    button.print { appearance: none; border: 1px solid #1a2420; background: #1a2420; color: #fff; padding: 0.4rem 0.85rem; border-radius: 8px; font-weight: 650; cursor: pointer; }
    @page { size: letter; margin: 0.6in; }
    @media print {
      body { background: #fff; }
      .sheet { max-width: none; padding: 0; }
      .no-print { display: none !important; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="no-print no-print-actions">
      <button type="button" class="print" onclick="window.print()">Print / Save as PDF</button>
      <span class="muted">Letter · in the print dialog, choose “Save as PDF”.</span>
    </div>
    <header>
      <div class="brand">
        ${
          meta.companyLogoUrl
            ? `<img class="logo" src="${esc(meta.companyLogoUrl)}" alt="" />`
            : ""
        }
        <div>
          <div><strong>${esc(meta.companyName)}</strong></div>
          ${meta.companyRegion ? `<div class="muted">${esc(meta.companyRegion)}</div>` : ""}
        </div>
      </div>
      <div style="text-align:right">
        <div class="muted">Itemized quote</div>
        <div class="muted">${esc(when)}</div>
      </div>
    </header>
    <h1>${esc(meta.projectName)}</h1>
    <p class="muted">
      ${esc(formatProjectMetaLine({
        clientName: meta.clientName,
        phone: meta.phone,
        address: meta.address,
      }) || "—")}
    </p>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Category</th>
          <th>Qty</th>
          <th>Unit price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="5" class="muted">No line items</td></tr>`}
      </tbody>
    </table>
    <div class="total"><strong>Subtotal ${esc(formatMoney(takeoff.subtotalCents))}</strong></div>
    <p class="disclaimer">
      Indicative construction takeoff from the PoolShape design model. Final pricing,
      taxes, permits, and site conditions may change. Not a binding contract.
      ${meta.planLabel ? `Plan: ${esc(meta.planLabel)}.` : ""}
    </p>
  </div>
</body>
</html>`;
}
