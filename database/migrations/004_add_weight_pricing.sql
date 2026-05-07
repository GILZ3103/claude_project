-- Migration 004: Weight-based pricing support
-- Adds price_per_100g to food_items for weight-proportional pricing.
-- When price_per_100g is set on a food item and weight_g is sent with a tap,
-- the charge scales: cost = (weight_g / 100) * price_per_100g
-- Items without price_per_100g continue to use flat price_in_points.
-- Also adds weight_g column to tap_events for audit trail.

ALTER TABLE food_items
  ADD COLUMN IF NOT EXISTS price_per_100g NUMERIC(10,2);

ALTER TABLE tap_events
  ADD COLUMN IF NOT EXISTS weight_g NUMERIC(8,2);
