# Assistant planners on a wedding

Issue #86. Decided with the maintainer on 2026-10-07: not an agency entity, but assistants on a wedding. Free, as every role is.

## The shape

- A wedding keeps **one lead planner** (`wedding_members_one_planner` stays).
- A new role, **`assistant`**, for the lead's assistant or day-of coordinator. Any number per wedding.
- No agency or team table. A planner who works with the same assistant adds them to each wedding.

## What an assistant can do

- Read and edit the wedding, as a planner can.
- **Not** invite anyone, remove anyone, or delete the wedding. Those stay with the couple and the lead planner.

## What the couple sees

- Every member by name and role, assistants included, on the account page where they see their planner today.
- They can remove an assistant, as they can remove their planner.
- The lead planner can also remove an assistant they invited.

## The library

Stays per planner. An assistant has their own, which is empty unless they are also a planner elsewhere. Sharing a library is the agency idea, and is not built.

## Database

- `wedding_members.role` and `invites.role` checks gain `'assistant'`.
- `create_invite` and `accept_invite` (`supabase/migrations/20260928000001_roles.sql`) accept `'assistant'` only from a lead planner, and need no count cap.
- The delete-wedding, invite and remove-member paths check the caller's role is not `assistant`.
- RLS on documents and history treats an assistant as a member, which it already does for any row in `wedding_members`.
- Tested against PGlite, as the roles migration is.
