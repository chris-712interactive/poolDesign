import type { CatalogItem } from "./catalog";

export type PriceBookCsvItem = {
  catalogItemId: string;
  name: string;
  unit: string;
  unitPriceCents: number;
  overridden: boolean;
};

export type ParsedPriceBookRow = {
  catalogItemId: string;
  name: string;
  unit: string;
  unitPriceCents: number | null;
  overridden: boolean | null;
};

export type PriceBookSkip = {
  catalogItemId: string;
  name: string;
  reason: string;
};

export type PriceBookCsvApply = {
  upserts: Array<{ catalogItemId: string; unitPriceCents: number }>;
  clears: string[];
  skipped: PriceBookSkip[];
};

const COLUMNS = [
  "catalogItemId",
  "name",
  "unit",
  "unitPriceUSD",
  "overridden",
] as const;

function csvCell(value: string | number | boolean): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function priceBookToCsv(items: PriceBookCsvItem[]): string {
  const header = COLUMNS.join(",");
  const rows = items.map((item) =>
    [
      csvCell(item.catalogItemId),
      csvCell(item.name),
      csvCell(item.unit),
      csvCell((item.unitPriceCents / 100).toFixed(2)),
      csvCell(item.overridden ? "true" : "false"),
    ].join(","),
  );
  return `\uFEFF${[header, ...rows].join("\n")}\n`;
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      row.push(cur);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  return rows;
}

function headerIndex(headers: string[]): Record<(typeof COLUMNS)[number], number> {
  const norm = headers.map((h) => h.trim().toLowerCase().replace(/[\s_]/g, ""));
  const find = (...aliases: string[]) =>
    aliases.reduce((found, alias) => {
      if (found >= 0) return found;
      return norm.findIndex((h) => h === alias);
    }, -1);
  return {
    catalogItemId: find("catalogitemid", "id", "sku"),
    name: find("name"),
    unit: find("unit"),
    unitPriceUSD: find("unitpriceusd", "priceusd", "unitprice", "price"),
    overridden: find("overridden", "override"),
  };
}

export function parseUsdToCents(raw: string): number | null {
  const s = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseBool(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s === "true" || s === "yes" || s === "1") return true;
  if (s === "false" || s === "no" || s === "0") return false;
  return null;
}

export function parsePriceBookCsv(csv: string): ParsedPriceBookRow[] {
  const table = splitCsvRows(csv);
  if (table.length === 0) return [];
  const idx = headerIndex(table[0]!);
  const hasHeader = idx.unitPriceUSD >= 0 || idx.catalogItemId >= 0 || idx.name >= 0;
  const start = hasHeader ? 1 : 0;
  const col = hasHeader
    ? idx
    : {
        catalogItemId: 0,
        name: 1,
        unit: 2,
        unitPriceUSD: 3,
        overridden: 4,
      };
  const rows: ParsedPriceBookRow[] = [];
  for (let i = start; i < table.length; i++) {
    const cells = table[i]!;
    const at = (n: number) => (n >= 0 ? (cells[n] ?? "").trim() : "");
    rows.push({
      catalogItemId: at(col.catalogItemId),
      name: at(col.name),
      unit: at(col.unit),
      unitPriceCents: parseUsdToCents(at(col.unitPriceUSD)),
      overridden: parseBool(at(col.overridden)),
    });
  }
  return rows;
}

function resolveCatalogItem(
  row: ParsedPriceBookRow,
  catalog: CatalogItem[],
): CatalogItem | null {
  const id = row.catalogItemId.trim();
  if (id) {
    const byId = catalog.find((item) => item.id === id);
    if (byId) return byId;
  }
  const name = row.name.trim().toLowerCase();
  if (!name) return null;
  const byName = catalog.filter((item) => item.name.toLowerCase() === name);
  return byName.length === 1 ? byName[0]! : null;
}

/**
 * Map CSV rows onto the existing catalog. Never creates free-form SKUs.
 * Price changes become overrides; `overridden=false` with the default price clears.
 */
export function applyPriceBookCsv(
  csv: string,
  catalog: CatalogItem[],
): PriceBookCsvApply {
  const upserts: PriceBookCsvApply["upserts"] = [];
  const clears: string[] = [];
  const skipped: PriceBookSkip[] = [];
  const seen = new Set<string>();

  for (const row of parsePriceBookCsv(csv)) {
    if (!row.catalogItemId && !row.name) continue;
    const item = resolveCatalogItem(row, catalog);
    if (!item) {
      skipped.push({
        catalogItemId: row.catalogItemId,
        name: row.name,
        reason: "Unknown catalog item",
      });
      continue;
    }
    if (row.unitPriceCents == null) {
      skipped.push({
        catalogItemId: item.id,
        name: item.name,
        reason: "Invalid unitPriceUSD",
      });
      continue;
    }
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const differs = row.unitPriceCents !== item.unitPriceCents;
    if (differs || row.overridden === true) {
      upserts.push({
        catalogItemId: item.id,
        unitPriceCents: row.unitPriceCents,
      });
    } else {
      clears.push(item.id);
    }
  }

  return { upserts, clears, skipped };
}
