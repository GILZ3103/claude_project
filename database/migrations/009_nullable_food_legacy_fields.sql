-- Migration 009: Make legacy food_items columns nullable
-- Background: migrations 003 & 004 added calories_per_100g and price_per_100g
-- for weight-based items. The original NOT NULL constraints on calories and
-- price_in_points now block inserts for weight-mode items that omit them.

ALTER TABLE food_items
  ALTER COLUMN calories        DROP NOT NULL,
  ALTER COLUMN price_in_points DROP NOT NULL;

-- Also drop the old positive-value CHECK on price_in_points so NULL rows pass.
ALTER TABLE food_items
  DROP CONSTRAINT IF EXISTS food_items_price_in_points_check;
