-- The library keeps bar settings too: the kind of bar, the figures, the mix,
-- the prices and the shops, without how many are coming or what a couple
-- already has, which the application strips before it is saved.
--
-- Widened in place, as the boxes were: every saved item is one of the kinds
-- already allowed, and dropping by name lets the migration run twice.
alter table public.library_items drop constraint if exists library_items_kind_check;
alter table public.library_items
  add constraint library_items_kind_check
  check (kind in ('cards', 'day', 'room', 'checklist', 'processional', 'boxes', 'bar'));
