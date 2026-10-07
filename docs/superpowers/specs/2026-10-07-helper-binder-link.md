# A Binder link for day-of helpers

Issue #85. Decided with the maintainer on 2026-10-07: one link per helper, sealed, no dietary needs, expiring after the wedding.

## What a helper's link holds

- The run of the day: the Timeline's blocks, times and places.
- **Their own jobs** from Delegation, and their team's.
- The box list from Boxes, with what is in each and which part of the day it is for.
- The group shots, with the names in each (the person rounding people up needs them).
- Phone numbers of **the crew only**: the people and teams in Delegation, which the couple typed in for that purpose. Never a guest's contact details.

## What it never holds

- Dietary needs, of anyone. They are sometimes medical, and a helper does not need them on the day; the caterer gets them through their own supplier link.
- The guest list, the seating plan, money, notes, or anything from Checklist.

## One link per helper

- Each link is made for one person in Delegation's crew, so it can be revoked alone. A helper who is not in the crew is added there first.
- Revoking shows the same "This link is not live" page a supplier link does.

## Sealed, as supplier links are

- The same mechanism as `supplier_links` (`supabase/migrations/*supplier*`, `suite/lib/suppliers/`): the server stores ciphertext, and the key travels after the `#`, so the server cannot read the sheet.
- A new table, `helper_links`, keyed by wedding and crew person id, with the same columns and RLS shape as `supplier_links`. Publishing is rate-limited with `SHARE_LIMIT` like supplier links.
- The sheet republishes when the day, the jobs or the boxes change, as the guest link does.

## Expiry

- A link stops working at the end of the day after the wedding date. `cron/sweep` is extended to delete expired rows.
- No date set: the link works until revoked.

## Offline

The helper page caches like the Binder (`suite/e2e/binder.spec.ts`), so it works with no signal at the venue.

## Privacy Policy

`suite/lib/legal.ts` gains a paragraph, in the same PR as the feature, saying what a helper link contains, that it is sealed, that it expires the day after the wedding, and that dietary needs and guests' details are never in it. The digest test changes with it.
