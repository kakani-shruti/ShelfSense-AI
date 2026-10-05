-- ShelfSense AI Phase 6: repair schema drift found during production testing.
-- Safe to run after migrations 001-008, including when Phase 4 columns already exist.

-- The prediction engine stores named, explainable factors as a JSON object.
-- Earlier schema history incorrectly constrained this column to an array.
alter table public.predictions
  drop constraint if exists predictions_contributing_factors_check;

alter table public.predictions
  alter column contributing_factors set default '{}'::jsonb;

update public.predictions
set contributing_factors = '{}'::jsonb
where contributing_factors is null
   or jsonb_typeof(contributing_factors) <> 'object';

alter table public.predictions
  alter column contributing_factors set not null,
  add constraint predictions_contributing_factors_check
    check (jsonb_typeof(contributing_factors) = 'object');

-- Keep prediction upserts deterministic even if migration 006 was missed.
delete from public.predictions older
using public.predictions newer
where older.inventory_item_id = newer.inventory_item_id
  and (older.predicted_at, older.id) < (newer.predicted_at, newer.id);

create unique index if not exists predictions_inventory_item_unique_idx
  on public.predictions(inventory_item_id);

-- Repair incomplete Phase 4 installations without disturbing existing recipe data.
alter table public.recipes
  add column if not exists cook_time_minutes integer check (cook_time_minutes >= 0),
  add column if not exists difficulty text check (difficulty in ('Easy', 'Medium')),
  add column if not exists servings integer check (servings > 0),
  add column if not exists rescue_reason text,
  add column if not exists waste_reduction text,
  add column if not exists ai_insight text,
  add column if not exists source_inventory_item_ids uuid[] not null default '{}',
  add column if not exists context_signature text,
  add column if not exists generation_id uuid,
  add column if not exists generated_at timestamptz not null default timezone('utc', now());

create index if not exists recipes_user_generated_at_idx
  on public.recipes(user_id, generated_at desc);

create index if not exists recipes_user_context_signature_idx
  on public.recipes(user_id, context_signature, generated_at desc)
  where generated_by = 'gemini';

-- Ask PostgREST to expose the repaired schema immediately.
notify pgrst, 'reload schema';
