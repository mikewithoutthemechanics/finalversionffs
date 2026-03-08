-- Set admin users for TFMD Booking App
-- Executed: March 6, 2026

-- Ensure users exist and set them as admins
-- This will upsert users (create if not exists, update if exists)

-- Admin 1: michael@agentcy.co.za
INSERT INTO users (id, email, name, isAdmin, waiverAccepted, created_at, updated_at)
VALUES (
    'admin-' || gen_random_uuid(),
    'michael@agentcy.co.za',
    'Michael',
    true,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    isAdmin = true,
    updated_at = NOW();

-- Admin 2: zelda@thefasciadome.co.za
INSERT INTO users (id, email, name, isAdmin, waiverAccepted, created_at, updated_at)
VALUES (
    'admin-' || gen_random_uuid(),
    'zelda@thefasciadome.co.za',
    'Zelda',
    true,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    isAdmin = true,
    updated_at = NOW();

-- Admin 3: jo@thefasciadome.co.za
INSERT INTO users (id, email, name, isAdmin, waiverAccepted, created_at, updated_at)
VALUES (
    'admin-' || gen_random_uuid(),
    'jo@thefasciadome.co.za',
    'Jo',
    true,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    isAdmin = true,
    updated_at = NOW();

-- Admin 4: michaelgraemek@gmail.com
INSERT INTO users (id, email, name, isAdmin, waiverAccepted, created_at, updated_at)
VALUES (
    'admin-' || gen_random_uuid(),
    'michaelgraemek@gmail.com',
    'Michael Graeme',
    true,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    isAdmin = true,
    updated_at = NOW();

-- Verify the changes
SELECT email, name, isAdmin, created_at 
FROM users 
WHERE email IN (
    'michael@agentcy.co.za',
    'zelda@thefasciadome.co.za',
    'jo@thefasciadome.co.za',
    'michaelgraemek@gmail.com'
);
