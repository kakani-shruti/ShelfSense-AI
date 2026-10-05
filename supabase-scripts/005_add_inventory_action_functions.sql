-- ShelfSense AI Phase 2: atomic consumption and waste actions.
-- Run after 004_seed_foods.sql. These functions lock the inventory row, reject
-- invalid quantities, update remaining stock, and insert history as one transaction.

create or replace function public.record_consumption(
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_notes text default null
)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_item public.inventory_items;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;

  select * into current_item from public.inventory_items
  where id = p_inventory_item_id and user_id = auth.uid() for update;
  if not found then raise exception 'Inventory item not found'; end if;
  if current_item.status <> 'active' then raise exception 'Inventory item is not active'; end if;
  if p_quantity > current_item.quantity_remaining then raise exception 'Quantity exceeds remaining inventory'; end if;

  insert into public.consumption_logs (user_id, inventory_item_id, quantity_consumed, notes)
  values (auth.uid(), p_inventory_item_id, p_quantity, nullif(trim(p_notes), ''));

  update public.inventory_items set
    quantity_remaining = quantity_remaining - p_quantity,
    status = case when quantity_remaining - p_quantity = 0 then 'consumed' else 'active' end
  where id = p_inventory_item_id
  returning * into current_item;
  return current_item;
end;
$$;

create or replace function public.record_waste(
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_reason text,
  p_notes text default null
)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_item public.inventory_items;
  calculated_value numeric(12, 2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  if p_reason not in ('Spoiled', 'Expired', 'Over-purchased', 'Taste/quality', 'Other') then raise exception 'Invalid waste reason'; end if;

  select * into current_item from public.inventory_items
  where id = p_inventory_item_id and user_id = auth.uid() for update;
  if not found then raise exception 'Inventory item not found'; end if;
  if current_item.status <> 'active' then raise exception 'Inventory item is not active'; end if;
  if p_quantity > current_item.quantity_remaining then raise exception 'Quantity exceeds remaining inventory'; end if;

  calculated_value := case when current_item.purchase_price is null then null
    else round((current_item.purchase_price * p_quantity / current_item.quantity_purchased)::numeric, 2) end;
  insert into public.waste_logs (user_id, inventory_item_id, quantity_wasted, estimated_value, reason, notes)
  values (auth.uid(), p_inventory_item_id, p_quantity, calculated_value, p_reason, nullif(trim(p_notes), ''));

  update public.inventory_items set
    quantity_remaining = quantity_remaining - p_quantity,
    status = case when quantity_remaining - p_quantity = 0 then 'wasted' else 'active' end
  where id = p_inventory_item_id
  returning * into current_item;
  return current_item;
end;
$$;

revoke all on function public.record_consumption(uuid, numeric, text) from public;
revoke all on function public.record_waste(uuid, numeric, text, text) from public;
grant execute on function public.record_consumption(uuid, numeric, text) to authenticated;
grant execute on function public.record_waste(uuid, numeric, text, text) to authenticated;
