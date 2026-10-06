"use client";

import { useState } from "react";
import { FileSpreadsheet, ListChecks, RotateCcw } from "lucide-react";
import { Button, Check, Panel, Segmented, SelectField } from "@/components/ui/controls";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToolUndo } from "@/components/shell/ToolUndo";
import {
  chooseKind,
  resetMix,
  setCrowd,
  setFigure,
  setHave,
  setPeople,
  setPrice,
  setShare,
  setShop,
  setWholeCases,
} from "@/lib/bar/actions";
import { CROWD_NAMES, FIGURE_DEFAULTS, KIND_NAMES, LINES, MIXES, SHOP_NAMES } from "@/lib/bar/defaults";
import { buyWords, forWords, shoppingCsv, shoppingList, spendWords } from "@/lib/bar/rows";
import { barSum, figure, mixOf, type LineSum } from "@/lib/bar/sum";
import { download } from "@/lib/data/file";
import { useBar, useEvent, useStatus, useWriters } from "@/lib/model/useSuite";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { BAR_KINDS, CROWDS, POURS, SHOPS, type Bar, type BarKind, type Figure, type MixedPart, type Pour } from "@/lib/model/types";

const CONTROL = "rounded border border-charcoal/15 bg-parchment px-2 py-1 text-sm text-charcoal tabular-nums focus:border-gold";

const number = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 1 });
const money = (n: number) => Math.round(n).toLocaleString("en-GB");

const PART_WORDS: Record<MixedPart, string> = { reception: "at the reception", evening: "in the evening" };

const pourName = (kind: BarKind, pour: Pour): string =>
  ({ fizz: "Fizz", wine: "Wine", beer: "Beer and cider", spirit: kind === "cocktails" ? "Cocktails" : "Spirits" })[pour];

/**
 * The drinks a couple buys themselves: how much of each, in what a UK shop
 * sells, and roughly what it costs. Every figure the sum uses is on screen,
 * changeable, and put back in one click. It keeps no copy: the amounts are
 * worked out from the guest list and the figures on every render.
 */
export function BarBoard() {
  const status = useStatus();
  const bar = useBar();
  const sum = useKnotworkStore((s) => barSum(s.doc));
  const event = useEvent();
  const { setBar } = useWriters();
  const [note, setNote] = useState<string | null>(null);

  if (status !== "ready") return null;

  const stem = (event.coupleNames || "wedding").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wedding";
  const print = async () => {
    setNote(null);
    try {
      const [{ renderShoppingList }, { browserFontSource }] = await Promise.all([
        import("@/lib/bar/render/pdf/shoppingList"),
        import("@/lib/pdf/fontSource"),
      ]);
      const bytes = await renderShoppingList(shoppingList(bar, sum), {
        fontSource: browserFontSource(),
        coupleNames: event.coupleNames,
        forWhom: forWords(sum),
        spend: spendWords(sum),
        generatedOn: `Made with Knotwork, ${new Date().toLocaleDateString()}`,
      });
      download(`${stem}-drinks.pdf`, new Blob([bytes as BlobPart], { type: "application/pdf" }));
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "The page could not be made.");
    }
  };

  const write = (next: Bar, label: string) => setBar(next, { label });
  const { heads, each } = sum;

  const field = (id: Figure) => (
    <FigureField
      key={id}
      bar={bar}
      id={id}
      onChange={(value) => write(setFigure(bar, id, value), value === null ? "putting a figure back" : "a figure for the bar")}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-var(--shell-header-h))]">
      <ToolUndo />
      <div data-tour="bar.figures" className="w-[26rem] shrink-0 overflow-y-auto border-r border-charcoal/10 p-4">
        <h2 className="mb-4 font-display text-2xl text-charcoal">The figures</h2>
        <Panel title="Who">
          <div className="flex items-center justify-between gap-2 text-sm text-charcoal">
            <span>Coming</span>
            <NumberInput
              label="How many are coming"
              value={bar.people}
              placeholder={String(heads.listed)}
              onCommit={(people) => write(setPeople(bar, people), "how many are coming")}
              className={`${CONTROL} w-20`}
            />
          </div>
          <p className="mt-1 text-xs text-slate">
            {heads.typed ? (
              <>
                Typed: the guest list has {heads.listed}.{" "}
                <button type="button" onClick={() => write(setPeople(bar, null), "how many are coming")} className="underline hover:text-charcoal">
                  Use the guest list
                </button>
              </>
            ) : (
              "From the guest list: everyone who has not said no."
            )}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {field("eveningGuests")}
            {field("notDrinkingPct")}
          </div>
          <p className="mt-2 text-xs text-slate">
            {heads.drinking} drinking alcohol, {heads.notDrinking} on soft drinks — children, drivers, and anyone who doesn&rsquo;t.
          </p>
        </Panel>

        <Panel title="The bar">
          <SelectField
            label="What kind of bar"
            value={bar.kind}
            onChange={(kind) => write(chooseKind(bar, kind), "the kind of bar")}
            options={BAR_KINDS.map((kind) => ({ value: kind, label: KIND_NAMES[kind] }))}
          />
          <p className="mt-3 mb-1 text-xs text-slate">How much this crowd drinks</p>
          <Segmented value={bar.crowd} onChange={(crowd) => write(setCrowd(bar, crowd), "the crowd")} options={CROWDS.map((crowd) => ({ value: crowd, label: CROWD_NAMES[crowd] }))} />
        </Panel>

        <Panel title="The day">
          <p className="mb-2 text-xs text-slate">Drinks each, for those drinking. Set a part to nothing if you are not buying for it — a venue&rsquo;s own bar.</p>
          <div className="flex flex-col gap-2">
            {field("receptionHours")}
            {field("receptionPerHour")}
            <Each>{number(each.reception)} each at the reception</Each>
            {field("toastGlasses")}
            {field("mealGlasses")}
            {field("eveningHours")}
            {field("eveningPerHour")}
            <Each>{number(each.evening)} each in the evening</Each>
          </div>
        </Panel>

        <Panel title="What is poured">
          <p className="mb-2 text-xs text-slate">The toast is fizz and the meal is wine. The reception and the evening pour a mix, in shares.</p>
          {(["reception", "evening"] as const).map((part) => (
            <MixFields key={part} bar={bar} part={part} onChange={write} />
          ))}
        </Panel>

        <Panel title="Glasses and measures">
          <div className="flex flex-col gap-2">
            {field("fizzGlassMl")}
            {field("wineGlassMl")}
            {field("redPct")}
            {field("spiritMl")}
            {field("mixerMl")}
            {field("softMl")}
            {field("iceKg")}
          </div>
        </Panel>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl text-charcoal">What to buy</h2>
          <Check
            label="Round up to whole cases, for sale or return"
            checked={bar.wholeCases}
            onChange={(on) => write(setWholeCases(bar, on), "whole cases")}
          />
        </div>

        {heads.people + heads.evening === 0 ? (
          <p className="mt-4 text-sm text-slate">Nobody to buy for yet. Add the guests, or type how many are coming.</p>
        ) : (
          <>
            <table aria-label="What to buy" className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 text-left text-xs tracking-wide text-slate">
                  <th className="py-1.5 font-normal">Drink</th>
                  <th className="py-1.5 font-normal whitespace-nowrap">Comes to</th>
                  <th className="py-1.5 font-normal">Have</th>
                  <th className="py-1.5 font-normal">To buy</th>
                  <th className="py-1.5 font-normal">Price</th>
                  <th className="py-1.5 text-right font-normal">Cost</th>
                  <th className="py-1.5 pl-3 font-normal">Where</th>
                </tr>
              </thead>
              <tbody>
                {sum.lines.map((line) => (
                  <LineRow key={line.line} bar={bar} line={line} onChange={write} />
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-sm text-charcoal">{spendWords(sum)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button icon={ListChecks} onClick={() => void print()}>
                Shopping list
              </Button>
              <Button icon={FileSpreadsheet} onClick={() => download(`${stem}-drinks.csv`, shoppingCsv(shoppingList(bar, sum)), "text/csv")}>
                CSV
              </Button>
            </div>
            {note && (
              <p role="status" className="mt-2 text-xs text-danger">
                {note}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Each({ children }: { children: React.ReactNode }) {
  return <p className="-mt-1 text-right text-xs text-slate">{children}</p>;
}

/** One figure: its value, and — when changed — what it usually is, and a way back to it. */
function FigureField({ bar, id, onChange }: { bar: Bar; id: Figure; onChange: (value: number | null) => void }) {
  const info = FIGURE_DEFAULTS[id];
  const changed = bar.figures[id] !== undefined;
  return (
    <div className="flex items-center gap-2 text-sm text-charcoal">
      <span className="min-w-0 flex-1">{info.label}</span>
      {changed && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={`Put ${info.label.toLowerCase()} back to ${info.value}`}
          title={`Usually ${info.value}`}
          className="inline-flex items-center gap-1 text-xs text-slate hover:text-charcoal"
        >
          <RotateCcw size={11} aria-hidden />
          {info.value}
        </button>
      )}
      <NumberInput
        label={info.label}
        value={figure(bar, id)}
        step={info.step}
        onCommit={onChange}
        className={`${CONTROL} w-20 ${changed ? "border-gold" : ""}`}
      />
      <span className="w-12 text-xs text-slate">{info.unit}</span>
    </div>
  );
}

function MixFields({ bar, part, onChange }: { bar: Bar; part: MixedPart; onChange: (next: Bar, label: string) => void }) {
  const mix = mixOf(bar, part);
  const total = POURS.reduce((sum, pour) => sum + mix[pour], 0);
  const changed = bar.mix[part] !== undefined;
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs text-slate">
        <span>Poured {PART_WORDS[part]}</span>
        {changed && (
          <button type="button" onClick={() => onChange(resetMix(bar, part), "what is poured")} className="inline-flex items-center gap-1 hover:text-charcoal">
            <RotateCcw size={11} aria-hidden />
            {KIND_NAMES[bar.kind]}&rsquo;s mix
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {POURS.map((pour) => (
          <label key={pour} className="text-xs text-slate">
            {pourName(bar.kind, pour)}
            <NumberInput
              label={`${pourName(bar.kind, pour)} ${PART_WORDS[part]}, in percent`}
              value={mix[pour]}
              onCommit={(value) => onChange(setShare(bar, part, pour, value ?? MIXES[bar.kind][part][pour]), "what is poured")}
              className={`${CONTROL} mt-0.5 w-full ${changed ? "border-gold" : ""}`}
            />
          </label>
        ))}
      </div>
      {total !== 100 && total > 0 && <p className="mt-1 text-xs text-slate">These add up to {total}: each is taken as its share of that.</p>}
      {total === 0 && <p className="mt-1 text-xs text-slate">Nothing poured {PART_WORDS[part]}.</p>}
    </div>
  );
}

function LineRow({ bar, line, onChange }: { bar: Bar; line: LineSum; onChange: (next: Bar, label: string) => void }) {
  const info = LINES[line.line];
  const { amount, cases } = buyWords(bar, line);
  return (
    <tr className="border-b border-charcoal/5 align-middle">
      <td className="py-1.5 pr-2 text-charcoal">{line.name}</td>
      <td className="py-1.5 pr-2 text-slate tabular-nums">{line.needed === 0 ? "None" : number(line.needed)}</td>
      <td className="py-1.5 pr-2">
        <NumberInput
          label={`${line.name} you already have, in ${info.units}`}
          value={line.have === 0 ? null : line.have}
          onCommit={(have) => onChange(setHave(bar, line.line, have), "what you already have")}
          className={`${CONTROL} w-16`}
        />
      </td>
      <td className="py-1.5 pr-2 text-charcoal tabular-nums">
        {amount || "—"}
        {cases && <span className="block text-xs text-slate">{cases}</span>}
      </td>
      <td className="py-1.5 pr-2 whitespace-nowrap">
        <NumberInput
          label={`Price of ${line.name.toLowerCase()}, ${info.priceWords}`}
          value={line.price}
          step={0.01}
          onCommit={(price) => onChange(setPrice(bar, line.line, price), "a price")}
          className={`${CONTROL} w-20`}
        />
        <span className="ml-1 text-xs text-slate">{info.per}</span>
      </td>
      <td className="py-1.5 text-right text-charcoal tabular-nums">{line.cost === null ? "" : money(line.cost)}</td>
      <td className="py-1.5 pl-3">
        <select
          aria-label={`Where ${line.name.toLowerCase()} is bought`}
          value={line.shop}
          onChange={(event) => onChange(setShop(bar, line.line, event.target.value as typeof line.shop), "where it is bought")}
          className={CONTROL}
        >
          {SHOPS.map((shop) => (
            <option key={shop} value={shop}>
              {SHOP_NAMES[shop]}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
