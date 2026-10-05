-- ShelfSense AI Phase 1: indexes for common ownership, inventory, history, and alert queries.
-- Run after 001_create_tables.sql.

create index if not exists inventory_items_user_id_idx on public.inventory_items(user_id);
create index if not exists inventory_items_food_id_idx on public.inventory_items(food_id);
create index if not exists inventory_items_user_status_idx on public.inventory_items(user_id, status);
create index if not exists inventory_items_user_purchase_date_idx on public.inventory_items(user_id, purchase_date desc);

create index if not exists consumption_logs_user_id_idx on public.consumption_logs(user_id);
create index if not exists consumption_logs_inventory_item_id_idx on public.consumption_logs(inventory_item_id);
create index if not exists waste_logs_user_id_idx on public.waste_logs(user_id);
create index if not exists waste_logs_inventory_item_id_idx on public.waste_logs(inventory_item_id);
create index if not exists predictions_user_id_idx on public.predictions(user_id);
create index if not exists predictions_inventory_item_id_idx on public.predictions(inventory_item_id);
create index if not exists recipes_user_id_idx on public.recipes(user_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_inventory_item_id_idx on public.notifications(inventory_item_id);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, created_at desc) where is_read = false;

