-- The library keeps a processional too: its order, who walks by what they are
-- to the couple, how, and the music — nobody by name, as the application
-- strips guests, families and the wedding's own roles before it is saved.
--
-- The kinds are widened in place. Every item already saved is one of the four
-- it held, so none is refused by the new rule; dropped by name so the
-- migration can run twice.
alter table public.library_items drop constraint if exists library_items_kind_check;
alter table public.library_items
  add constraint library_items_kind_check
  check (kind in ('cards', 'day', 'room', 'checklist', 'processional'));
