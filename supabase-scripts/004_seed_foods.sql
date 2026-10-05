-- ShelfSense AI Phase 1: representative shared food data.
-- Run after 003_create_rls_policies.sql. Durations are product estimates only and
-- must not be represented as guaranteed food-safety guidance.

insert into public.foods (name, category, default_unit, room_temperature_shelf_life_days, refrigerated_shelf_life_days, frozen_shelf_life_days)
values
  ('Apple', 'Fruits', 'piece', 7, 35, 240),
  ('Banana', 'Fruits', 'piece', 5, 7, 90),
  ('Orange', 'Fruits', 'piece', 10, 28, 180),
  ('Strawberry', 'Fruits', 'g', 1, 5, 240),
  ('Tomato', 'Vegetables', 'g', 7, 10, 180),
  ('Spinach', 'Vegetables', 'g', 1, 5, 300),
  ('Potato', 'Vegetables', 'g', 30, 60, 300),
  ('Onion', 'Vegetables', 'g', 30, 60, 240),
  ('Carrot', 'Vegetables', 'g', 5, 28, 300),
  ('Bell Pepper', 'Vegetables', 'piece', 3, 10, 240),
  ('Milk', 'Dairy', 'ml', null, 7, 90),
  ('Yogurt', 'Dairy', 'g', null, 14, 60),
  ('Cheese', 'Dairy', 'g', null, 21, 180),
  ('Chicken Breast', 'Meat', 'g', null, 2, 270),
  ('Eggs', 'Dairy', 'piece', 14, 35, null),
  ('Salmon', 'Seafood', 'g', null, 2, 180),
  ('Rice', 'Grains', 'g', 730, null, null),
  ('Bread', 'Bakery', 'slice', 5, 10, 90),
  ('Pasta', 'Pantry', 'g', 730, null, null),
  ('Orange Juice', 'Beverages', 'ml', null, 10, 240)
on conflict (name) do update set
  category = excluded.category,
  default_unit = excluded.default_unit,
  room_temperature_shelf_life_days = excluded.room_temperature_shelf_life_days,
  refrigerated_shelf_life_days = excluded.refrigerated_shelf_life_days,
  frozen_shelf_life_days = excluded.frozen_shelf_life_days;

