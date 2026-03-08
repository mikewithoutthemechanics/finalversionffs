-- ============================================================================
-- STAGING DATABASE SEED DATA
-- For SQL Injection Testing Environment
-- WARNING: Contains ONLY fake/test data - no real user information
-- ============================================================================

-- Clean existing test data (if re-seeding)
DELETE FROM chat_messages WHERE created_at < NOW();
DELETE FROM processed_payments WHERE processed_at < NOW();
DELETE FROM bookings WHERE created_at < NOW();
DELETE FROM credit_transactions WHERE created_at < NOW();
DELETE FROM user_credits WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@staging.local');
DELETE FROM user_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@staging.local');
DELETE FROM users WHERE email LIKE '%@staging.local' OR email LIKE '%@test.com';
DELETE FROM classes WHERE created_at < NOW() - INTERVAL '1 day';

-- ============================================================================
-- FAKE USERS (For Testing Only)
-- ============================================================================

-- Insert test users with fake data
INSERT INTO users (id, email, email_confirmed_at, created_at, updated_at, raw_user_meta_data) VALUES
  ('test-user-001', 'test@staging.local', NOW(), NOW(), NOW(), '{"name": "Test User 1"}'),
  ('test-user-002', 'admin@staging.local', NOW(), NOW(), NOW(), '{"name": "Admin User"}'),
  ('test-user-003', 'hacker@test.com', NOW(), NOW(), NOW(), '{"name": "Hacker Test"}'),
  ('test-user-004', 'sqlinjector@staging.local', NOW(), NOW(), NOW(), '{"name": "SQL Tester"}'),
  ('test-user-005', 'pentest@test.com', NOW(), NOW(), NOW(), '{"name": "Pen Test"}')
ON CONFLICT (id) DO NOTHING;

-- Add user profiles
INSERT INTO user_profiles (user_id, first_name, last_name, phone, created_at, updated_at) VALUES
  ('test-user-001', 'Test', 'User', '+27123456789', NOW(), NOW()),
  ('test-user-002', 'Admin', 'User', '+27123456790', NOW(), NOW()),
  ('test-user-003', 'Hacker', 'Test', '+27123456791', NOW(), NOW()),
  ('test-user-004', 'SQL', 'Tester', '+27123456792', NOW(), NOW()),
  ('test-user-005', 'Pen', 'Test', '+27123456793', NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- Add user credits
INSERT INTO user_credits (user_id, credits_balance, total_credits_purchased, total_credits_used, created_at, updated_at) VALUES
  ('test-user-001', 50, 100, 50, NOW(), NOW()),
  ('test-user-002', 200, 500, 300, NOW(), NOW()),
  ('test-user-003', 10, 10, 0, NOW(), NOW()),
  ('test-user-004', 25, 50, 25, NOW(), NOW()),
  ('test-user-005', 0, 0, 0, NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- TEST CLASSES
-- ============================================================================

INSERT INTO classes (id, title, description, instructor, date, time, duration_minutes, capacity, credits_required, status, created_at) VALUES
  ('class-001', 'Test Yoga Class', 'Basic yoga for testing', 'Test Instructor', '2026-03-15', '09:00', 60, 10, 2, 'published', NOW()),
  ('class-002', 'SQL Injection Pilates', 'Test class for security testing', 'Pen Tester', '2026-03-16', '10:00', 45, 8, 3, 'published', NOW()),
  ('class-003', 'Staging Bootcamp', 'High intensity test workout', 'Admin Trainer', '2026-03-17', '18:00', 90, 15, 5, 'published', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TEST BOOKINGS
-- ============================================================================

INSERT INTO bookings (id, user_id, class_id, status, credits_used, booked_at, created_at, updated_at) VALUES
  ('booking-001', 'test-user-001', 'class-001', 'confirmed', 2, NOW(), NOW(), NOW()),
  ('booking-002', 'test-user-002', 'class-002', 'confirmed', 3, NOW(), NOW(), NOW()),
  ('booking-003', 'test-user-003', 'class-001', 'cancelled', 2, NOW() - INTERVAL '2 days', NOW(), NOW()),
  ('booking-004', 'test-user-004', 'class-003', 'confirmed', 5, NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TEST PAYMENT RECORDS
-- ============================================================================

INSERT INTO processed_payments (id, processed_at, expires_at) VALUES
  ('pay-test-001', NOW(), NOW() + INTERVAL '24 hours'),
  ('pay-test-002', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '23 hours')
ON CONFLICT (id) DO NOTHING;

-- Credit transactions
INSERT INTO credit_transactions (user_id, amount, type, description, reference_id, created_at) VALUES
  ('test-user-001', 100, 'purchase', 'Test purchase', 'pay-test-001', NOW()),
  ('test-user-002', 500, 'purchase', 'Admin test purchase', 'pay-test-002', NOW()),
  ('test-user-001', -2, 'usage', 'Test booking class-001', 'booking-001', NOW()),
  ('test-user-002', -3, 'usage', 'Test booking class-002', 'booking-002', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TEST CHAT MESSAGES
-- ============================================================================

INSERT INTO chat_messages (user_id, user_email, message, is_from_user, is_read, created_at) VALUES
  ('test-user-001', 'test@staging.local', 'Hello, this is a test message', true, false, NOW()),
  ('test-user-002', 'admin@staging.local', 'Can I book a class?', true, false, NOW() - INTERVAL '1 hour'),
  ('test-user-003', 'hacker@test.com', 'This is a test for SQL injection', true, false, NOW() - INTERVAL '30 minutes'),
  (NULL, 'support@tfmd.local', 'Welcome to TFMD! How can I help?', false, true, NOW() - INTERVAL '29 minutes')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- WAIVERS (Test Data)
-- ============================================================================

INSERT INTO user_waivers (user_id, waiver_data, signed_at, created_at) VALUES
  ('test-user-001', '{"liability": true, "medical": true, "photo": true, "agreements": {"terms": true, "privacy": true}}', NOW(), NOW()),
  ('test-user-002', '{"liability": true, "medical": false, "photo": true, "agreements": {"terms": true, "privacy": true}}', NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify seed data
SELECT 'Users seeded: ' || COUNT(*)::text as status FROM users WHERE email LIKE '%@staging.local' OR email LIKE '%@test.com'
UNION ALL
SELECT 'Classes seeded: ' || COUNT(*)::text as status FROM classes WHERE created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 'Bookings seeded: ' || COUNT(*)::text as status FROM bookings WHERE user_id LIKE 'test-user-%'
UNION ALL
SELECT 'Chat messages seeded: ' || COUNT(*)::text as status FROM chat_messages WHERE user_id LIKE 'test-user-%';
