-- ============================================================
-- Smart Night Market System — Seed Data
-- Version: 2.3
-- Run in Supabase SQL Editor AFTER schema.sql and both migrations.
-- Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
-- All vendor passwords = password123
-- ============================================================

-- ============================================================
-- VENDOR CARDS
-- password_hash = bcrypt('password123', 10)
-- ============================================================

INSERT INTO cards (uid, owner_name, owner_email, phone_number, password_hash, points_balance, calorie_limit, role, is_active)
VALUES
  ('VENDOR001', 'Ahmad Razif', 'ahmad.razif@nightmarket.my', '0123456789',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVwES7RvA.', 50.00, 2000, 'VENDOR', true),
  ('VENDOR002', 'Siti Hajar', 'siti.hajar@nightmarket.my', '0187654321',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVwES7RvA.', 80.00, 2000, 'VENDOR', true),
  ('VENDOR003', 'Ramu Krishnan', 'ramu.krishnan@nightmarket.my', '0112345678',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVwES7RvA.', 30.00, 2000, 'VENDOR', true)
ON CONFLICT (uid) DO NOTHING;

-- ============================================================
-- VENDORS
-- ============================================================

INSERT INTO vendors (vendor_id, owner_card_uid, business_name, ssm_registration_number, phone_number, category, description, grid_x, grid_y, is_active)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'VENDOR001',
   'Nasi Lemak Pak Razif', '001234567-A', '0123456789',
   'Rice Dishes', 'Famous nasi lemak with sambal tempoyak and ayam goreng berempah.', 1, 1, true),

  ('a1000000-0000-0000-0000-000000000002', 'VENDOR002',
   'Mee Goreng Siti', '007654321-B', '0187654321',
   'Noodles', 'Wok-fried mee goreng mamak style with fresh prawns and squid.', 3, 1, true),

  ('a1000000-0000-0000-0000-000000000003', 'VENDOR003',
   'Roti Canai Ramu', '009988776-C', '0112345678',
   'Indian', 'Crispy roti canai with dal curry, teh tarik, and milo ais.', 5, 2, true)
ON CONFLICT (vendor_id) DO NOTHING;

-- ============================================================
-- FOOD ITEMS (requires migration 002_add_macros.sql)
-- ============================================================

INSERT INTO food_items (vendor_id, name, calories, price_in_points, protein_g, carbs_g, fat_g, is_available)
VALUES
  -- Nasi Lemak Pak Razif
  ('a1000000-0000-0000-0000-000000000001', 'Nasi Lemak Ayam',     620, 8.00, 28.0, 72.0, 22.0, true),
  ('a1000000-0000-0000-0000-000000000001', 'Nasi Lemak Telur',    480, 5.50, 14.0, 68.0, 18.0, true),
  ('a1000000-0000-0000-0000-000000000001', 'Nasi Lemak Ikan Bilis',520, 6.00, 18.0, 70.0, 20.0, true),

  -- Mee Goreng Siti
  ('a1000000-0000-0000-0000-000000000002', 'Mee Goreng Udang',    580, 7.50, 22.0, 78.0, 18.0, true),
  ('a1000000-0000-0000-0000-000000000002', 'Mee Goreng Biasa',    520, 6.00, 14.0, 76.0, 16.0, true),
  ('a1000000-0000-0000-0000-000000000002', 'Kuey Teow Goreng',    560, 7.00, 18.0, 80.0, 17.0, true),

  -- Roti Canai Ramu
  ('a1000000-0000-0000-0000-000000000003', 'Roti Canai',          310, 2.50,  8.0, 48.0, 10.0, true),
  ('a1000000-0000-0000-0000-000000000003', 'Roti Telur',          380, 3.50, 12.0, 46.0, 16.0, true),
  ('a1000000-0000-0000-0000-000000000003', 'Teh Tarik',           150, 2.00,  3.0, 26.0,  4.0, true),
  ('a1000000-0000-0000-0000-000000000003', 'Milo Ais',            180, 2.50,  4.0, 32.0,  5.0, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- KIOSKS
-- ============================================================

INSERT INTO kiosks (kiosk_id, label, grid_x, grid_y, is_active)
VALUES
  ('k1000000-0000-0000-0000-000000000001', 'Main Entrance Kiosk', 0, 0, true),
  ('k1000000-0000-0000-0000-000000000002', 'Centre Kiosk',        3, 3, true)
ON CONFLICT (kiosk_id) DO NOTHING;

-- ============================================================
-- CAMPAIGNS
-- ============================================================

INSERT INTO campaigns (campaign_id, name, description, condition_type, condition_threshold, reward_type, reward_value, valid_from, valid_until, is_active)
VALUES
  ('c1000000-0000-0000-0000-000000000001',
   'Jelajah Bazaar',
   'Visit 3 different stalls in one night and earn a RM 5 discount voucher!',
   'VISIT_STALLS', 3, 'VOUCHER_DISCOUNT', 5.00,
   NOW(), NOW() + INTERVAL '30 days', true),

  ('c1000000-0000-0000-0000-000000000002',
   'Selera Rakyat',
   'Spend RM 20 across any stalls and get RM 3 off your next purchase.',
   'SPEND_POINTS', 20, 'VOUCHER_DISCOUNT', 3.00,
   NOW(), NOW() + INTERVAL '30 days', true)
ON CONFLICT (campaign_id) DO NOTHING;

-- ============================================================
-- CONSUMER TEST CARD
-- email: ahmad.farid@email.com | password: password123
-- ============================================================

INSERT INTO cards (uid, owner_name, owner_email, phone_number, password_hash, points_balance, calorie_limit, role, is_active)
VALUES
  ('TESTCARD001', 'Ahmad Farid', 'ahmad.farid@email.com', '0123456789',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVwES7RvA.', 50.00, 2000, 'CONSUMER', true)
ON CONFLICT (uid) DO NOTHING;
