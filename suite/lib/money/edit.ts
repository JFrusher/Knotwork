import type { Team } from "@/lib/model/types";

type Raw = Record<string, unknown>;

/** The money a team carries, which the Money page is the one place to change. */
export type TeamMoney = Partial<Pick<Team, "cost" | "deposit" | "depositPaidOn" | "balanceDueOn" | "balancePaidOn">>;

/**
 * Changes to the crew slice as stored: one team's money, or the budget.
 * Everything else in the slice — the people, the jobs, a field only
 * Delegation knows — is copied, not rebuilt.
 */
export function changeTeam(crew: Raw, teamId: string, change: TeamMoney): Raw {
  const teams = Array.isArray(crew["teams"]) ? (crew["teams"] as Raw[]) : [];
  if (!teams.some((team) => team["id"] === teamId)) throw new Error(`No team ${teamId} in the crew.`);
  return { ...crew, teams: teams.map((team) => (team["id"] === teamId ? { ...team, ...change } : team)) };
}

export function changeBudget(crew: Raw, budget: number | null): Raw {
  return { ...crew, budget };
}
