"use client";

import { useCallback, useEffect, useState } from "react";
import { LogOut, UserMinus, UserPlus } from "lucide-react";
import type { PersonRecord, Role } from "@/lib/accounts/store";
import { ROLE_CAP } from "@/lib/accounts/store";
import { closeWedding } from "@/lib/store/openWedding";
import { Button, TextField } from "@/components/ui/controls";
import { useConfirm } from "@/components/ui/Confirm";

const ROLE_NAME: Record<Role, string> = { partner: "One of the couple", planner: "Planner" };

async function readJson<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

/**
 * Who has access to the wedding open here, and asking someone else in.
 *
 * The couple always sees everyone who can read their plans, and can remove
 * their planner. Anyone can leave.
 */
export function WeddingPeople({
  weddingId,
  me,
  onNotice,
}: {
  weddingId: string;
  me: string;
  onNotice: (text: string, tone: "ok" | "error") => void;
}) {
  const [people, setPeople] = useState<PersonRecord[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("partner");
  const confirm = useConfirm();

  const load = useCallback(async () => {
    const response = await fetch(`/api/accounts/members?wedding=${encodeURIComponent(weddingId)}`);
    const body = await readJson<{ people?: PersonRecord[]; error?: string }>(response);
    if (response.ok && body?.people) setPeople(body.people);
    else onNotice(body?.error ?? "Could not load who has access.", "error");
  }, [weddingId, onNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!people) return <p className="text-sm text-slate">Loading who has access…</p>;

  const mine = people.find((p) => p.userId === me);
  const full = (r: Role) => people.filter((p) => p.role === r).length >= ROLE_CAP[r];
  const open = (["partner", "planner"] as const).filter((r) => !full(r));
  const inviteRole = open.includes(role) ? role : open[0];

  async function remove(person: PersonRecord) {
    const leaving = person.userId === me;
    const yes = await confirm(
      leaving
        ? {
            title: "Leave this wedding?",
            body: "You lose access to it, and its copy on this device is removed. Anyone else on it keeps it; if you are the last, it is deleted.",
            action: "Leave",
            tone: "danger",
          }
        : {
            title: `Remove ${person.email}?`,
            body: "They lose access at once, on every device.",
            action: "Remove",
            tone: "danger",
          },
    );
    if (!yes) return;
    const response = await fetch("/api/accounts/members", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weddingId, userId: person.userId }),
    });
    const body = await readJson<{ error?: string }>(response);
    if (!response.ok) {
      onNotice(body?.error ?? "That could not be done.", "error");
      return;
    }
    if (leaving) {
      await closeWedding();
      window.location.assign("/");
      return;
    }
    onNotice(`${person.email} no longer has access.`, "ok");
    await load();
  }

  async function invite() {
    if (!inviteRole) return;
    const response = await fetch("/api/accounts/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weddingId, email, role: inviteRole }),
    });
    const body = await readJson<{ error?: string }>(response);
    if (!response.ok) {
      onNotice(body?.error ?? "Could not send the invite.", "error");
      return;
    }
    onNotice(`Invite sent to ${email}.`, "ok");
    setEmail("");
  }

  return (
    <>
      <section className="space-y-3 border-t border-charcoal/10 pt-6 first:border-t-0 first:pt-0">
        <h2 className="text-xs tracking-widest text-slate uppercase">Who has access</h2>
        <ul className="space-y-2">
          {people.map((person) => (
            <li key={person.userId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="text-charcoal">{person.email}</span>
                <span className="text-slate">
                  {" "}
                  · {ROLE_NAME[person.role]}
                  {person.userId === me ? " (you)" : ""}
                </span>
              </span>
              {person.userId === me ? (
                <Button icon={LogOut} onClick={() => void remove(person)}>
                  Leave
                </Button>
              ) : person.role === "planner" && mine?.role === "partner" ? (
                <Button icon={UserMinus} tone="danger" onClick={() => void remove(person)}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {inviteRole ? (
        <section className="space-y-3 border-t border-charcoal/10 pt-6">
          <h2 className="text-xs tracking-widest text-slate uppercase">Invite someone</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void invite();
            }}
            className="space-y-3"
          >
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm text-slate">As</legend>
              {(["partner", "planner"] as const).map((r) => (
                <label key={r} className={`flex items-center gap-2 text-sm ${full(r) ? "text-slate/60" : "text-charcoal"}`}>
                  <input
                    type="radio"
                    name="invite-role"
                    value={r}
                    checked={inviteRole === r}
                    disabled={full(r)}
                    onChange={() => setRole(r)}
                  />
                  {r === "partner" ? "One of the couple" : "Your planner"}
                  {full(r) ? " — already on the wedding" : ""}
                </label>
              ))}
            </fieldset>
            <TextField label="Their email" type="email" value={email} onChange={setEmail} placeholder="name@example.com" />
            <Button onClick={() => void invite()} tone="primary" icon={UserPlus} disabled={!email}>
              Send invite
            </Button>
          </form>
        </section>
      ) : null}
    </>
  );
}
