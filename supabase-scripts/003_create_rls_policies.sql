-- ShelfSense AI Phase 1: row-level security.
-- Run after 002_create_indexes.sql. Private rows are restricted to auth.uid().

alter table public.profiles enable row level security;
alter table public.foods enable row level security;
alter table public.inventory_items enable row level security;
alter table public.consumption_logs enable row level security;
alter table public.waste_logs enable row level security;
alter table public.predictions enable row level security;
alter table public.recipes enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Authenticated users can read foods" on public.foods;
create policy "Authenticated users can read foods" on public.foods for select to authenticated using (true);

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['inventory_items', 'consumption_logs', 'waste_logs', 'predictions', 'recipes', 'notifications']
  loop
    execute format('drop policy if exists "Users can read own rows" on public.%I', table_name);
    execute format('create policy "Users can read own rows" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name);
    execute format('drop policy if exists "Users can insert own rows" on public.%I', table_name);
    execute format('create policy "Users can insert own rows" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name);
    execute format('drop policy if exists "Users can update own rows" on public.%I', table_name);
    execute format('create policy "Users can update own rows" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format('drop policy if exists "Users can delete own rows" on public.%I', table_name);
    execute format('create policy "Users can delete own rows" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name);
  end loop;
end $$;

