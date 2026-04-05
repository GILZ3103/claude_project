-- Migration 002: Add macronutrient fields to food_items
-- Run this in Supabase SQL Editor

ALTER TABLE food_items
  ADD COLUMN IF NOT EXISTS protein_g NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carbs_g   NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fat_g     NUMERIC(6,2) DEFAULT 0;
