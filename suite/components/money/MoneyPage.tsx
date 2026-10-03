"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Check } from "lucide-react";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { readCrew } from "@/lib/model/slices";
import { money, type Payment } from "@/lib/money/money";
import { daysUntil, longDate, todayIso } from "@/lib/dates";
import { changeBudget, changeTeam, type TeamMoney } from "@/lib/money/edit";
import { Button, Empty } from "@/components/ui/controls";
import { ToolUndo } from "@/components/shell/ToolUndo";
import { NumberInput } from "@/components/ui/NumberInput";

const CONTROL = "rounded border border-charcoal/15 bg-parchment px-2 py-1 text-sm text-charcoal tabular-nums focus:border-gold";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function storedCrew(): Record<string, unknown> {
  const { raw } = useKnotworkStore.getState();
  return isRecord(raw["crew"]) ? raw["crew"] : {};
}

const amount = (n: number) => n.toLocaleString();

/**
 * What the wedding costs, what has been paid, and what is still to pay.
 *
 * The one place money is changed: each supplier's cost and deposit, the dates
 * they were paid and fall due, and the budget. Delegation keeps who the
 * suppliers are and what they do. Like the Guests page it keeps no copy — it
 * reads the crew and writes it, on the one undo stack.
 */
export function MoneyPage() {
  const status = useKnotworkStore((s) => s.status);
  const doc = useKnotworkStore((s) => s.doc);

  const crew = readCrew(doc);
  const accounts = useMemo(() => money(crew), [crew]);
  const today = todayIso();

  if (status !== "ready") return <div className="mx-auto mt-10 h-40 max-w-5xl animate-pulse rounded-lg bg-stone" />;

  const write = (next: Record<string, unknown>, label: string) =>
    useKnotworkStore.getState().setSlice("crew", next, { label });
  const change = (teamId: string, what: TeamMoney) => write(changeTeam(storedCrew(), teamId, what), "money");
  const paid = (payment: Payment) =>
    change(payment.teamId, payment.kind === "deposit" ? { depositPaidOn: today } : { balancePaidOn: today });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ToolUndo />

      <h1 className="font-display text-3xl text-charcoal">Money</h1>
      <p className="mt-1 text-sm text-slate">What the suppliers cost, what has been paid, and what is still to pay.</p>

      <section aria-label="In all" data-tour="money.totals" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-charcoal/10 bg-parchment p-4">
          <span aria-hidden className="block text-xs tracking-widest text-slate uppercase">
            Budget
          </span>
          <NumberInput
            label="Budget"
            value={accounts.budget}
            onCommit={(budget) => write(changeBudget(storedCrew(), budget), "the budget")}
            className={`${CONTROL} mt-2 w-full text-2xl`}
          />
        </div>
        <Figure label="Committed" value={amount(accounts.committed)}>
          {accounts.left === null ? null : accounts.left < 0 ? (
            <span className="text-danger">{amount(-accounts.left)} over the budget</span>
          ) : (
            `${amount(accounts.left)} of the budget left`
          )}
        </Figure>
        <Figure label="Paid" value={amount(accounts.paid)} />
        <Figure label="Still to pay" value={amount(accounts.owed)} />
      </section>

      {crew.teams.length === 0 ? (
        <div className="mt-10">
          <Empty>
            No suppliers yet. They are added in{" "}
            <Link href="/delegation" className="underline">
              Delegation
            </Link>
            , with the jobs they do; their costs are kept here.
          </Empty>
        </div>
      ) : (
        <>
          <section aria-labelledby="to-pay" className="mt-10">
            <h2 id="to-pay" className="mb-3 text-sm tracking-[0.14em] text-slate uppercase">
              To pay
            </h2>
            {accounts.toPay.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-slate">
                <Check size={16} aria-hidden className="text-ok" />
                {accounts.suppliers.length === 0 ? "No costs agreed yet — add one below." : "Everything agreed has been paid."}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {accounts.toPay.map((payment) => {
                  const days = payment.dueOn ? daysUntil(payment.dueOn, today) : null;
                  return (
                    <li
                      key={`${payment.teamId}-${payment.kind}`}
                      className="flex flex-wrap items-center gap-3 rounded border border-charcoal/10 bg-parchment px-4 py-2 text-sm"
                    >
                      <span className={`w-40 ${days !== null && days < 0 ? "text-danger" : "text-slate"}`}>
                        {payment.dueOn ? `${days !== null && days < 0 ? "Was due" : "Due"} ${longDate(payment.dueOn)}` : "No date"}
                      </span>
                      <span className="min-w-0 flex-1 text-charcoal">
                        {payment.team} — {payment.kind}
                      </span>
                      <span className="text-charcoal tabular-nums">{amount(payment.amount)}</span>
                      <Button onClick={() => paid(payment)}>Paid today</Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="suppliers" className="mt-10">
            <h2 id="suppliers" className="mb-3 text-sm tracking-[0.14em] text-slate uppercase">
              Suppliers
            </h2>
            <div data-tour="money.suppliers" className="overflow-x-auto rounded-lg border border-charcoal/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone/60 text-xs tracking-wide text-slate uppercase">
                  <tr>
                    {["Supplier", "Cost", "Deposit", "Deposit paid", "Balance", "Balance due", "Balance paid"].map((heading) => (
                      <th key={heading} scope="col" className="px-3 py-2 font-normal">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {crew.teams.map((team) => {
                    const balance = team.cost === null ? null : team.cost - (team.deposit ?? 0);
                    return (
                      <tr key={team.id} className="border-t border-charcoal/10">
                        <th scope="row" className="px-3 py-1.5 font-normal text-charcoal">
                          {team.name}
                        </th>
                        <td className="px-3 py-1.5">
                          <NumberInput label={`${team.name}: cost`} value={team.cost} onCommit={(cost) => change(team.id, { cost })} className={`${CONTROL} w-24`} />
                        </td>
                        <td className="px-3 py-1.5">
                          <NumberInput label={`${team.name}: deposit`} value={team.deposit} onCommit={(deposit) => change(team.id, { deposit })} className={`${CONTROL} w-24`} />
                        </td>
                        <td className="px-3 py-1.5">
                          <DateInput label={`${team.name}: deposit paid on`} value={team.depositPaidOn} onChange={(depositPaidOn) => change(team.id, { depositPaidOn })} />
                        </td>
                        <td className="px-3 py-1.5 text-charcoal tabular-nums">{balance === null ? "—" : amount(balance)}</td>
                        <td className="px-3 py-1.5">
                          <DateInput label={`${team.name}: balance due on`} value={team.balanceDueOn} onChange={(balanceDueOn) => change(team.id, { balanceDueOn })} />
                        </td>
                        <td className="px-3 py-1.5">
                          <DateInput label={`${team.name}: balance paid on`} value={team.balancePaidOn} onChange={(balancePaidOn) => change(team.id, { balancePaidOn })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate">
              Suppliers, and what they do on the day, are kept in{" "}
              <Link href="/delegation" className="underline">
                Delegation
              </Link>
              . A team with no cost is friends doing a job, and counts for nothing here.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Figure({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-parchment p-4">
      <span className="block text-xs tracking-widest text-slate uppercase">{label}</span>
      <span className="mt-2 block text-2xl text-charcoal tabular-nums">{value}</span>
      {children ? <span className="mt-1 block text-xs text-slate">{children}</span> : null}
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <input type="date" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={CONTROL} />;
}
