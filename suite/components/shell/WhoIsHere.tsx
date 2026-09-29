"use client";

import { usePresence, type Here } from "@/lib/documents/live";

/** Past this many, the rest are a count. */
const SHOWN = 3;

const said = ({ email, where }: Here) => (where ? `${email}, in ${where}` : email);

/**
 * Who else has the wedding open, in the header: a partner's or the planner's
 * initial, and on hover or to a screen reader, who and where. Nothing at all
 * when nobody else is here, which is most of the time.
 */
export function WhoIsHere() {
  const others = usePresence((s) => s.others);
  if (others.length === 0) return null;

  const hidden = others.slice(SHOWN);
  return (
    <ul aria-label="Also here" className="flex shrink-0 items-center -space-x-1.5">
      {others.slice(0, SHOWN).map((person) => (
        <li
          key={person.email}
          title={said(person)}
          className="flex size-6 items-center justify-center rounded-full border-2 border-parchment bg-stone text-xs font-medium text-charcoal uppercase"
        >
          <span aria-hidden>{person.email[0]}</span>
          <span className="sr-only">{said(person)}</span>
        </li>
      ))}
      {hidden.length > 0 ? (
        <li
          title={hidden.map(said).join("\n")}
          className="flex size-6 items-center justify-center rounded-full border-2 border-parchment bg-stone text-xs text-slate"
        >
          <span aria-hidden>+{hidden.length}</span>
          <span className="sr-only">{hidden.map(said).join("; ")}</span>
        </li>
      ) : null}
    </ul>
  );
}
