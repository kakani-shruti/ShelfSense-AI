-- ShelfSense AI Phase 4: metadata for generated rescue recipes and simple context caching.
-- Existing recipe ownership and RLS policies remain unchanged.

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

