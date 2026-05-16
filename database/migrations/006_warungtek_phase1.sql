-- Migration 006: WarungTek Phase 1
-- Adds Admin role, identity photo, vendor application workflow, and document fields.
-- Run after migrations 001-005 are applied.

-- 1. Allow ADMIN as a role in cards table
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_role_check;
ALTER TABLE cards ADD CONSTRAINT cards_role_check
  CHECK (role IN ('CONSUMER', 'VENDOR', 'ADMIN'));

-- 2. Identity photo for all roles (verification during signup)
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 3. Admin-specific fields (Authority ID + Department)
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS authority_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- 4. Vendor application workflow
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS application_status VARCHAR(20)
    DEFAULT 'PENDING_REVIEW',
  ADD COLUMN IF NOT EXISTS business_license_url TEXT,
  ADD COLUMN IF NOT EXISTS typhoid_cert_url TEXT,
  ADD COLUMN IF NOT EXISTS food_handling_cert_url TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(20);

-- Drop and re-add the application_status check constraint
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_application_status_check;
ALTER TABLE vendors ADD CONSTRAINT vendors_application_status_check
  CHECK (application_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED'));

-- 5. Auto-approve existing vendors so they keep working
UPDATE vendors SET application_status = 'APPROVED', approved_at = NOW()
  WHERE application_status IS NULL OR application_status = 'PENDING_REVIEW';

-- 6. Index for admin "pending approvals" view
CREATE INDEX IF NOT EXISTS idx_vendors_application_status
  ON vendors(application_status)
  WHERE application_status = 'PENDING_REVIEW';
