-- The library keeps a set of boxes too: their names and what goes in each,
-- without who takes them, when they are needed or what is packed, which the
-- application strips before it is saved.
--
-- Widened in place, as the processional was: every saved item is one of the
-- kinds already allowed, and dropping by name lets the migration run twice.
alter table public.library_items drop constraint if exists library_items_kind_check;
alter table public.library_items
  add constraint library_items_kind_check
  check (kind in ('cards', 'day', 'room', 'checklist', 'processional', 'boxes'));
