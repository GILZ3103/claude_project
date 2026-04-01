-- ============================================================
-- Smart Night Market System — Seed Data
-- Run AFTER schema.sql. For development only.
-- ============================================================

-- ============================================================
-- CARDS
-- ============================================================

INSERT INTO cards (uid, owner_name, owner_email, points_balance, calorie_limit, role) VALUES
('04:A3:2F:B1', 'Ahmad Razif',     'ahmad@email.com',   50.00, 2000, 'CONSUMER'),
('04:B1:9C:D2', 'Siti Hajar',      'siti@email.com',    30.00, 1800, 'CONSUMER'),
('04:C2:3E:F4', 'Kumar Selvam',    'kumar@email.com',   75.00, 2200, 'CONSUMER'),
('04:D4:7A:11', 'Vendor Owner 1',  'vendor1@email.com', 20.00, 2000, 'VENDOR'),
('04:E5:8B:22', 'Vendor Owner 2',  'vendor2@email.com', 20.00, 2000, 'VENDOR'),
('04:F6:9C:33', 'Vendor Owner 3',  'vendor3@email.com', 20.00, 2000, 'VENDOR');

-- ============================================================
-- VENDORS
-- ============================================================

INSERT INTO vendors (vendor_id, owner_card_uid, terminal_mac_address, business_name, category, description, grid_x, grid_y) VALUES
('a1b2c3d4-0001-0001-0001-000000000001', '04:D4:7A:11', 'AA:BB:CC:DD:EE:01', 'Mak Cik Nasi',      'Rice & Curry',  'Authentic nasi lemak and lauk kampung', 2, 3),
('a1b2c3d4-0002-0002-0002-000000000002', '04:E5:8B:22', 'AA:BB:CC:DD:EE:02', 'Pak Ali Satay',     'Grilled',       'Charcoal grilled satay — chicken and beef', 5, 2),
('a1b2c3d4-0003-0003-0003-000000000003', '04:F6:9C:33', 'AA:BB:CC:DD:EE:03', 'Cincau Pak Hassan', 'Beverages',     'Fresh cincau and air limau', 7, 5);

-- ============================================================
-- FOOD ITEMS
-- ============================================================

-- Mak Cik Nasi
INSERT INTO food_items (food_id, vendor_id, name, calories, price_in_points) VALUES
('f0000001-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'Nasi Lemak',         650, 5.00),
('f0000001-0001-0001-0001-000000000002', 'a1b2c3d4-0001-0001-0001-000000000001', 'Nasi Campur (Biasa)',450, 4.00),
('f0000001-0001-0001-0001-000000000003', 'a1b2c3d4-0001-0001-0001-000000000001', 'Nasi Campur (Khas)', 600, 6.00);

-- Pak Ali Satay
INSERT INTO food_items (food_id, vendor_id, name, calories, price_in_points) VALUES
('f0000002-0002-0002-0002-000000000001', 'a1b2c3d4-0002-0002-0002-000000000002', 'Satay Ayam (10 cucuk)', 480, 5.00),
('f0000002-0002-0002-0002-000000000002', 'a1b2c3d4-0002-0002-0002-000000000002', 'Satay Daging (10 cucuk)', 560, 6.00);

-- Cincau Pak Hassan
INSERT INTO food_items (food_id, vendor_id, name, calories, price_in_points) VALUES
('f0000003-0003-0003-0003-000000000001', 'a1b2c3d4-0003-0003-0003-000000000003', 'Cincau Hijau',  80,  2.00),
('f0000003-0003-0003-0003-000000000002', 'a1b2c3d4-0003-0003-0003-000000000003', 'Air Limau Ais', 120, 2.50);

-- ============================================================
-- CAMPAIGNS (Phase 2)
-- ============================================================

INSERT INTO campaigns (campaign_id, name, description, condition_type, condition_threshold, reward_value, applicable_vendor_ids, is_active) VALUES
(
  'c0000001-0001-0001-0001-000000000001',
  'Jelajah 3 Gerai',
  'Tap at 3 different vendor stalls in one night to earn a RM3 voucher.',
  'VISIT_STALLS',
  3,
  3.00,
  NULL,
  TRUE
),
(
  'c0000002-0002-0002-0002-000000000002',
  'Belanja RM15 Dapat Diskaun',
  'Spend 15 points across any vendors to earn a RM2 voucher.',
  'SPEND_POINTS',
  15.00,
  2.00,
  NULL,
  TRUE
),
(
  'c0000003-0003-0003-0003-000000000003',
  'Rebat Direktori',
  'Tap at the Digital Directory kiosk to instantly earn RM1 rebate.',
  'DIRECTORY_REBATE',
  1,
  1.00,
  NULL,
  TRUE
);

-- ============================================================
-- KIOSKS (Phase 3)
-- ============================================================

INSERT INTO kiosks (kiosk_id, label, grid_x, grid_y) VALUES
('d0000001-0001-0001-0001-000000000001', 'Kiosk Utama (Pintu Masuk)', 0, 0),
('d0000002-0002-0002-0002-000000000002', 'Kiosk Tengah',              4, 4);
