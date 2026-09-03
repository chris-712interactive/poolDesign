import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildQuoteHtml, takeoffToCsv } from "./quote-docs";
import type { TakeoffResult } from "./takeoff";

const takeoff: TakeoffResult = {
  lines: [
    {
      catalogItemId: "gunite",
      name: "Gunite / shotcrete shell",
      category: "structure",
      unit: "sf",
      quantity: 10,
      unitPriceCents: 1850,
      totalCents: 18500,
      lineKey: "gunite",
    },
  ],
  removedLines: [],
  subtotalCents: 18500,
  generatedAt: "2026-09-03T12:00:00.000Z",
};

describe("takeoffToCsv", () => {
  it("emits csv header and dollar totals", () => {
    const csv = takeoffToCsv(takeoff);
    assert.match(csv, /^Item,Category/);
    assert.match(csv, /Gunite \/ shotcrete shell/);
    assert.match(csv, /185\.00/);
  });
});

describe("buildQuoteHtml", () => {
  const html = buildQuoteHtml(
    {
      companyName: "Acme Pools",
      companyLogoUrl: "https://cdn.example/logo.png",
      companyRegion: "Tampa, FL",
      projectName: "Kendig Residence Pool",
      clientName: "Chris Kendig",
      address: "123 Palm Ave, Tampa, FL 33602",
      planLabel: "Builder",
    },
    takeoff,
  );

  it("is a letter-sized printable quote with a Print / Save as PDF control", () => {
    assert.match(html, /@page \{\s*size: letter;\s*margin: 0\.6in;\s*\}/);
    assert.match(html, /Print \/ Save as PDF/);
    assert.match(html, /window\.print\(\)/);
    assert.match(html, /class="no-print no-print-actions"/);
    assert.match(html, /\.no-print \{ display: none !important; \}/);
    assert.match(html, /choose “Save as PDF”/);
  });

  it("includes company branding and takeoff totals", () => {
    assert.match(html, /Kendig Residence Pool/);
    assert.match(html, /Acme Pools/);
    assert.match(html, /class="logo" src="https:\/\/cdn.example\/logo.png"/);
    assert.match(html, /Gunite \/ shotcrete shell/);
    assert.match(html, /Subtotal/);
    assert.match(html, /\$185\.00/);
  });
});
