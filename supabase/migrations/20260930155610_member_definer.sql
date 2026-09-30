-- The membership check runs as its owner again.
--
-- On 2026-09-30 the hosted project's `is_wedding_member(uuid)` was `security
-- invoker`; 20260902000001_accounts.sql creates it `security definer`, and no
-- migration changes that. Run as its caller, its read of `wedding_members` is
-- bound by that table's policy, which asks `is_wedding_member` — which reads
-- `wedding_members` again, without end. Once 20260930155142_member_grants let
-- signed-in people call it, every read of a wedding failed with "stack depth
-- limit exceeded". As its owner, which row-level security does not bind, it
-- reads the table once. The accounts migration explains why it must.

alter function public.is_wedding_member(uuid) security definer;
