import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { nodeFontSource } from "@/apps/brigade/render/pdf/nodeFontSource";
import { textOf } from "@/apps/brigade/render/pdf/readPdf";
import { parseCsv } from "@/lib/data/csv";
import { readBar } from "@/lib/model/slices";
import { renderShoppingList } from "./render/pdf/shoppingList";
import { forWords, shoppingCsv, shoppingList, spendWords } from "./rows";
import { barSum } from "./sum";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
const doc = migrate(raw);
const sum = barSum(doc);
const groups = shoppingList(readBar(doc), sum);

describe("the shopping list", () => {
  it("is grouped by where things are bought, and leaves out what there is none to buy", () => {
    expect(groups.map((group) => group.name)).toEqual(["Wine merchant", "Cash and carry", "Supermarket"]);
    expect(groups[0]!.rows[0]).toEqual({ name: "Fizz", amount: "42 bottles", cases: "7 cases of 6", price: 8.5, cost: 357 });
    expect(groups[1]!.rows.map((row) => row.amount)).toEqual(["240 bottles or cans", "1 70cl bottle"]);
    expect(forWords(sum)).toBe("For 100 coming, and 30 in the evening");
    expect(spendWords(sum)).toBe("About 1,206 for what has a price; 4 to buy with no price yet.");
  });

  it("is a spreadsheet, one drink to a row", () => {
    const table = parseCsv(shoppingCsv(groups));
    expect(table.headers).toEqual(["Where", "Drink", "To buy", "Cases", "Price", "Cost"]);
    expect(table.rows).toHaveLength(8);
    expect(table.rows).toContainEqual({ Where: "Cash and carry", Drink: "Beer and cider", "To buy": "240 bottles or cans", Cases: "10 cases of 24", Price: "24.00", Cost: "240.00" });
    expect(table.rows).toContainEqual({ Where: "Supermarket", Drink: "Ice", "To buy": "130 kilos", Cases: "", Price: "", Cost: "" });
  });

  it("is a page to tick off, with every drink and the estimate", async () => {
    const { text, pages } = await textOf(
      await renderShoppingList(groups, { fontSource: nodeFontSource, coupleNames: "Alex & Sam", forWhom: forWords(sum), spend: spendWords(sum) }),
    );
    expect(pages).toBe(1);
    expect(text).toContain("Drinks to buy — Alex & Sam");
    expect(text).toContain("For 100 coming, and 30 in the evening");
    for (const row of groups.flatMap((group) => group.rows)) expect(text).toContain(row.name);
    expect(text).toContain("42 bottles · 7 cases of 6");
    expect(text).toContain("About 1,206 for what has a price");
  });
});
