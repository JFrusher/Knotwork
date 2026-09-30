-- Two grants the hosted project had lost, and one it never needed.
--
-- On 2026-09-30 the hosted project's `is_wedding_member(uuid)` and
-- `delete_my_account()` could be executed by `postgres` and `service_role`
-- only. Every version of 20260902000001_accounts.sql grants both to
-- `authenticated`, and no migration revokes them; what did is not in the
-- project's logs. Without the first, every policy that asks it — the wedding,
-- its members, its document, its history, its links, its files — refuses a
-- signed-in reader with "permission denied for function is_wedding_member",
-- which is what signing in on 2026-09-29 met. Without the second, deleting an
-- account fails. Both are granted again. Where they were never lost, this
-- changes nothing.
--
-- `announce_wedding_document()` is a trigger function: no one calls it, and
-- Postgres refuses it outside a trigger. Supabase's default privileges left it
-- executable by `anon` and `authenticated`, as 20260929000008 describes for
-- the rest; it is revoked from both, so it is plainly no part of the API.

grant execute on function public.is_wedding_member(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.announce_wedding_document() from anon, authenticated;
