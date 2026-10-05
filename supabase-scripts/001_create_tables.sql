-- ShelfSense AI Phase 1: core schema.
-- Run first in the Supabase SQL Editor. All shelf-life values are estimates only.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in ('Fruits', 'Vegetables', 'Dairy', 'Meat', 'Seafood', 'Grains', 'Bakery', 'Pantry', 'Beverages', 'Other')),
  default_unit text not null,
  room_temperature_shelf_life_days integer check (room_temperature_shelf_life_days >= 0),
  refrigerated_shelf_life_days integer check (refrigerated_shelf_life_days >= 0),
  frozen_shelf_life_days integer check (frozen_shelf_life_days >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete restrict,
  quantity_purchased numeric(12, 3) not null check (quantity_purchased > 0),
  quantity_remaining numeric(12, 3) not null check (quantity_remaining >= 0 and quantity_remaining <= quantity_purchased),
  unit text not null,
  purchase_date date not null default current_date,
  storage_type text not null check (storage_type in ('room_temperature', 'refrigerator', 'freezer')),
  custom_expiry_date date,
  purchase_price numeric(12, 2) check (purchase_price >= 0),
  status text not null default 'active' check (status in ('active', 'consumed', 'wasted')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id)
);

create table if not exists public.consumption_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid not null,
  quantity_consumed numeric(12, 3) not null check (quantity_consumed > 0),
  consumed_at timestamptz not null default timezone('utc', now()),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (inventory_item_id, user_id) references public.inventory_items(id, user_id) on delete cascade
);

create table if not exists public.waste_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid not null,
  quantity_wasted numeric(12, 3) not null check (quantity_wasted > 0),
  estimated_value numeric(12, 2) check (estimated_value >= 0),
  wasted_at timestamptz not null default timezone('utc', now()),
  reason text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (inventory_item_id, user_id) references public.inventory_items(id, user_id) on delete cascade
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid not null,
  risk_score numeric(5, 2) not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  predicted_at timestamptz not null default timezone('utc', now()),
  explanation text,
  contributing_factors jsonb not null default '{}'::jsonb check (jsonb_typeof(contributing_factors) = 'object'),
  recommendation text,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (inventory_item_id, user_id) references public.inventory_items(id, user_id) on delete cascade
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  instructions jsonb not null default '[]'::jsonb check (jsonb_typeof(instructions) = 'array'),
  prep_time_minutes integer check (prep_time_minutes >= 0),
  generated_by text not null default 'user' check (generated_by in ('user', 'gemini')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid,
  type text not null,
  title text not null,
  message text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (inventory_item_id, user_id) references public.inventory_items(id, user_id) on delete cascade
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists foods_set_updated_at on public.foods;
create trigger foods_set_updated_at before update on public.foods for each row execute function public.set_updated_at();
drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at before update on public.inventory_items for each row execute function public.set_updated_at();

comment on table public.foods is 'Shared food reference data. Shelf-life durations are estimates, not guaranteed food-safety limits.';
