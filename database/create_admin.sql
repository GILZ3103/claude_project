-- ============================================================
-- Create Admin Account
-- Run in Supabase SQL Editor.
-- CHANGE the values below before running.
-- Default password is: password123
-- ============================================================

INSERT INTO cards (
  uid,
  owner_name,
  owner_email,
  phone_number,
  password_hash,
  role,
  authority_id,
  department,
  is_active
)
VALUES (
  'ADMIN001',                                -- unique card UID (no spaces)
  'Admin Name',                              -- full name
  'admin@nightmarket.my',                    -- login email
  '0123456789',                              -- phone (optional, can be NULL)
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVwES7RvA.',  -- password123
  'ADMIN',
  'AUTH-001',                                -- authority_id used at login
  'Market Operations',                       -- department (optional)
  true
)
ON CONFLICT (uid) DO NOTHING;

-- Verify the insert
SELECT uid, owner_name, owner_email, role, authority_id, department, is_active
FROM cards
WHERE role = 'ADMIN';
