-- Migration 003: Load cell weight support
-- Adds calories_per_100g to food_items for weight-based calorie calculation.
-- Adds terminal_calibration table for ML model coefficients per vendor.
-- calories column is kept — NULL on calories_per_100g means fixed-calorie mode (old behaviour).

ALTER TABLE food_items
  ADD COLUMN IF NOT EXISTS calories_per_100g NUMERIC(8,2);

CREATE TABLE IF NOT EXISTS terminal_calibration (
    calibration_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       UUID REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    scale_factor    NUMERIC(12,6) NOT NULL,  -- grams per ADC unit (from linear regression)
    tare_offset     INTEGER NOT NULL,         -- ADC reading at zero load
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (vendor_id)
);
