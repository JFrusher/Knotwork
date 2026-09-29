import { toCsv } from "@/lib/data/csv";
import type { Bar, Shop } from "@/lib/model/types";
import { SHOPS } from "@/lib/model/types";
import { LINES, SHOP_NAMES } from "./defaults";
import type { BarSum, LineSum } from "./sum";

/** "42 bottles", and "7 cases of 6" when buying whole cases. The page, the list and the CSV all say it this way. */
export function buyWords(bar: Bar, line: LineSum): { amount: string; cases: string } {
  const info = LINES[line.line];
  if (line.buy === 0) return { amount: "", cases: "" };
  const cases = bar.wholeCases && info.caseOf > 1 ? line.buy / info.caseOf : null;
  return {
    amount: `${line.buy} ${line.buy === 1 ? info.unit : info.units}`,
    cases: cases === null ? "" : `${cases} ${cases === 1 ? "case" : "cases"} of ${info.caseOf}`,
  };
}

export interface ShoppingRow {
  name: string;
  amount: string;
  cases: string;
  price: number | null;
  cost: number | null;
}

export interface ShoppingGroup {
  shop: Shop;
  name: string;
  rows: ShoppingRow[];
}

/** What to buy, by where it is bought, leaving out what there is none to buy of. */
export function shoppingList(bar: Bar, sum: BarSum): ShoppingGroup[] {
  return SHOPS.map((shop) => ({
    shop,
    name: SHOP_NAMES[shop],
    rows: sum.lines
      .filter((line) => line.shop === shop && line.buy > 0)
      .map((line) => ({ name: line.name, ...buyWords(bar, line), price: line.price, cost: line.cost })),
  })).filter((group) => group.rows.length > 0);
}

/** "For 100 coming, and 30 in the evening". */
export const forWords = (sum: BarSum): string =>
  `For ${sum.heads.people} coming${sum.heads.evening > 0 ? `, and ${sum.heads.evening} in the evening` : ""}`;

/** "About 1,206 for what has a price; 4 to buy with no price yet." */
export function spendWords(sum: BarSum): string {
  if (sum.spend === 0) return "Type prices for an estimate.";
  const unpriced = sum.unpriced > 0 ? `; ${sum.unpriced} to buy with no price yet` : "";
  return `About ${Math.round(sum.spend).toLocaleString("en-GB")} for what has a price${unpriced}.`;
}

const pounds = (n: number | null) => (n === null ? "" : n.toFixed(2));

/** The shopping list, one line to a row, for a spreadsheet. */
export function shoppingCsv(groups: ShoppingGroup[]): string {
  return toCsv(
    ["Where", "Drink", "To buy", "Cases", "Price", "Cost"],
    groups.flatMap((group) => group.rows.map((row) => [group.name, row.name, row.amount, row.cases, pounds(row.price), pounds(row.cost)])),
  );
}
