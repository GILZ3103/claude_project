-- Migration 001 — Add authentication fields
-- Run this in the Supabase SQL editor after the initial schema.sql
-- Adds: phone_number + password_hash to cards
--       phone_number + ssm_registration_number to vendors

-- CARDS
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS phone_number        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS password_hash       VARCHAR(255);

-- VENDORS
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS phone_number            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ssm_registration_number VARCHAR(50) UNIQUE;

-- Unique index on SSM number (non-null only)
CREATE UNIQUE INDEX IF NOT EXISTS vendors_ssm_unique
  ON vendors (ssm_registration_number)
  WHERE ssm_registration_number IS NOT NULL;
