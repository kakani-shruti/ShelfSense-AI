-- ShelfSense AI Phase 3: maintain one current prediction per inventory item.
-- This supports deterministic upserts and prevents duplicate rows during concurrent refreshes.

delete from public.predictions older
using public.predictions newer
where older.inventory_item_id = newer.inventory_item_id
  and (older.predicted_at, older.id) < (newer.predicted_at, newer.id);

create unique index if not exists predictions_inventory_item_unique_idx
  on public.predictions(inventory_item_id);
