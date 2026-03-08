-- ============================================
-- ADD ADMIN COLUMN + SET 3 ADMIN USERS
-- Run this once in Supabase SQL Editor
-- ============================================

-- Step 1: Add isAdmin column if not exists
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN DEFAULT false;

-- Step 2: Set 3 users as admins (upsert pattern)
INSERT INTO public.users (id, email, name, "isAdmin", "waiverAccepted", created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'zelda@thefasciadome.co.za', 'Zelda', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'jo@thefasciadome.co.za', 'Jo', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'michaelgraemek@gmail.com', 'Michael Graeme', true, true, NOW(), NOW())
ON CONFLICT (email) 
DO UPDATE SET "isAdmin" = true, updated_at = NOW();

-- Step 3: Verify (optional - view results)
SELECT email, name, "isAdmin" FROM public.users 
WHERE email IN (
  'zelda@thefasciadome.co.za',
  'jo@thefasciadome.co.za',
  'michaelgraemek@gmail.com'
);
