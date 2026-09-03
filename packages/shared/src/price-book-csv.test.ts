import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogForLevel } from "./catalog";
import {
  applyPriceBookCsv,
  parsePriceBookCsv,
  priceBookToCsv,
} from "./price-book-csv";

const catalog = catalogForLevel("residential");

describe("priceBookToCsv / parsePriceBookCsv", () => {
  it("round-trips catalog ids, names, and dollar prices", () => {
    const csv = priceBookToCsv([
      {
        catalogItemId: "gunite_shotcrete",
        name: "Gunite / shotcrete shell",
        unit: "sf",
        unitPriceCents: 1850,
        overridden: true,
      },
      {
        catalogItemId: "excavation_pool",
        name: "Pool excavation",
        unit: "cy",
        unitPriceCents: 4500,
        overridden: false,
      },
    ]);
    assert.match(csv, /catalogItemId,name,unit,unitPriceUSD,overridden/);
    const rows = parsePriceBookCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.catalogItemId, "gunite_shotcrete");
    assert.equal(rows[0]?.unitPriceCents, 1850);
    assert.equal(rows[0]?.overridden, true);
    assert.equal(rows[1]?.overridden, false);
  });

  it("parses quoted names, dollar signs, and BOM", () => {
    const csv =
      '\uFEFFcatalogItemId,name,unit,unitPriceUSD,overridden\n' +
      'gunite_shotcrete,"Gunite / shotcrete, shell",sf,"$18.50",true\n';
    const rows = parsePriceBookCsv(csv);
    assert.equal(rows[0]?.name, "Gunite / shotcrete, shell");
    assert.equal(rows[0]?.unitPriceCents, 1850);
  });
});

describe("applyPriceBookCsv", () => {
  it("upserts changed prices and matches by name when id is missing", () => {
    const gunite = catalog.find((i) => i.id === "gunite_shotcrete")!;
    const csv = [
      "catalogItemId,name,unit,unitPriceUSD,overridden",
      `gunite_shotcrete,${gunite.name},${gunite.unit},22.00,true`,
      `,Pool excavation,cy,99.00,true`,
    ].join("\n");
    const result = applyPriceBookCsv(csv, catalog);
    const ids = result.upserts.map((u) => u.catalogItemId).sort();
    assert.deepEqual(ids, ["excavation_pool", "gunite_shotcrete"]);
    assert.equal(
      result.upserts.find((u) => u.catalogItemId === "gunite_shotcrete")
        ?.unitPriceCents,
      2200,
    );
    assert.equal(result.skipped.length, 0);
  });

  it("skips unknown ids and does not create free-form SKUs", () => {
    const csv = [
      "catalogItemId,name,unit,unitPriceUSD,overridden",
      "custom_tile_sku,Mystery tile,sf,12.00,true",
    ].join("\n");
    const result = applyPriceBookCsv(csv, catalog);
    assert.equal(result.upserts.length, 0);
    assert.equal(result.skipped[0]?.reason, "Unknown catalog item");
  });

  it("clears an override when overridden is false and the price is the default", () => {
    const gunite = catalog.find((i) => i.id === "gunite_shotcrete")!;
    const csv = [
      "catalogItemId,name,unit,unitPriceUSD,overridden",
      `gunite_shotcrete,${gunite.name},${gunite.unit},${(gunite.unitPriceCents / 100).toFixed(2)},false`,
    ].join("\n");
    const result = applyPriceBookCsv(csv, catalog);
    assert.deepEqual(result.clears, ["gunite_shotcrete"]);
    assert.equal(result.upserts.length, 0);
  });
});
