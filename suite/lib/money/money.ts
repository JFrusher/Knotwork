import type { Crew, Team } from "@/lib/model/types";

/**
 * What the wedding costs and where the paying has got to, from what the crew
 * slice holds: each supplier's agreed cost, a deposit and when it was paid,
 * and when the rest falls due and was paid.
 *
 * The balance is the cost less the deposit — nobody writes it down twice, so
 * it cannot disagree with them.
 */

export interface SupplierMoney {
  team: Team;
  /** What is left after the deposit, or null when no cost is agreed. */
  balance: number | null;
  paid: number;
  /** Still to pay: the cost less whatever has been paid. */
  owed: number;
}

export interface Payment {
  teamId: string;
  team: string;
  kind: "deposit" | "balance";
  amount: number;
  /** ISO date, or "" where nothing says when. */
  dueOn: string;
}

export interface Money {
  budget: number | null;
  committed: number;
  paid: number;
  owed: number;
  /** The budget less what is committed; negative when over, null with no budget. */
  left: number | null;
  suppliers: SupplierMoney[];
  /** What is still to be paid, soonest first; anything with no date last. */
  toPay: Payment[];
}

function supplier(team: Team): SupplierMoney {
  const deposit = team.deposit ?? 0;
  const balance = team.cost === null ? null : team.cost - deposit;
  const paid = (team.depositPaidOn !== "" ? deposit : 0) + (team.balancePaidOn !== "" && balance !== null ? balance : 0);
  return { team, balance, paid, owed: Math.max(0, (team.cost ?? 0) - paid) };
}

export function money(crew: Crew): Money {
  // A team with no money agreed and none paid is friends doing a job, not a supplier.
  const suppliers = crew.teams
    .filter((team) => team.cost !== null || team.deposit !== null)
    .map(supplier);
  const committed = suppliers.reduce((sum, s) => sum + (s.team.cost ?? 0), 0);
  const paid = suppliers.reduce((sum, s) => sum + s.paid, 0);

  const toPay: Payment[] = [];
  for (const { team, balance } of suppliers) {
    if (team.deposit !== null && team.deposit > 0 && team.depositPaidOn === "") {
      toPay.push({ teamId: team.id, team: team.name, kind: "deposit", amount: team.deposit, dueOn: "" });
    }
    if (balance !== null && balance > 0 && team.balancePaidOn === "") {
      toPay.push({ teamId: team.id, team: team.name, kind: "balance", amount: balance, dueOn: team.balanceDueOn });
    }
  }
  toPay.sort((a, b) => (a.dueOn === "" ? 1 : 0) - (b.dueOn === "" ? 1 : 0) || a.dueOn.localeCompare(b.dueOn));

  return {
    budget: crew.budget,
    committed,
    paid,
    owed: committed - paid,
    left: crew.budget === null ? null : crew.budget - committed,
    suppliers,
    toPay,
  };
}

/** Days from `today` to an ISO date: negative once it has passed. */
export function daysUntil(iso: string, today: string): number {
  return Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

/** How far ahead a balance counts as due soon, in What is left. */
export const DUE_SOON_DAYS = 30;

/** Today's date where the user is, as ISO. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "18 May 2028". */
export function longDate(iso: string): string {
  const when = new Date(`${iso}T12:00:00`);
  return Number.isNaN(when.getTime())
    ? iso
    : when.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
