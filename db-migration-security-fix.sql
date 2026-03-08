-- =============================================================================
-- SECURITY FIX: Database migrations for credit handling
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fix 1: Create credit_packages table for price verification
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price INTEGER NOT NULL,
  bonus_credits INTEGER DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert credit packages (matching constants.ts)
INSERT INTO credit_packages (id, name, credits, price, bonus_credits, description, is_active, sort_order) VALUES
  ('credits-1', 'Single Session', 1, 350, 0, 'Perfect for trying out a single class', true, 1),
  ('credits-3', '3-Class Pack', 3, 990, 0, 'Save R60 - Great for getting started', true, 2),
  ('credits-5', '5-Class Pack', 5, 1500, 1, 'Save R250 - Get 1 bonus class!', true, 3),
  ('credits-10', '10-Class Pack', 10, 2800, 2, 'Save R700 - Best value! 2 bonus classes', true, 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  credits = EXCLUDED.credits,
  price = EXCLUDED.price,
  bonus_credits = EXCLUDED.bonus_credits,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Enable RLS on credit_packages
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

-- Allow public read access to credit packages
CREATE POLICY "Anyone can read credit packages" ON credit_packages
  FOR SELECT USING (true);

-- -----------------------------------------------------------------------------
-- Fix 2: Atomic credit deduction function (prevents race conditions)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deduct_user_credits(user_id UUID, amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
  DECLARE
    current_credits INTEGER;
    deducted_amount INTEGER;
  BEGIN
    -- Lock the row for update to prevent concurrent modifications
    SELECT credits INTO current_credits
    FROM users
    WHERE id = user_id
    FOR UPDATE;
    
    -- Calculate how many credits can be deducted
    deducted_amount := LEAST(current_credits, amount);
    
    -- Update only if there are credits available
    IF deducted_amount > 0 THEN
      UPDATE users 
      SET credits = credits - deducted_amount,
          updated_at = NOW()
      WHERE id = user_id;
    END IF;
    
    RETURN deducted_amount;
  END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION deduct_user_credits TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_user_credits TO anon;

-- -----------------------------------------------------------------------------
-- Fix 3: Atomic credit addition function (prevents race conditions)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_user_credits(user_id UUID, amount INTEGER)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users 
  SET credits = credits + amount,
      updated_at = NOW()
  WHERE id = user_id;
$$;

GRANT EXECUTE ON FUNCTION increment_user_credits TO authenticated;
GRANT EXECUTE ON FUNCTION increment_user_credits TO anon;

-- =============================================================================
-- Verify the setup
-- =============================================================================
SELECT 'credit_packages table:' as status;
SELECT * FROM credit_packages WHERE is_active = true ORDER BY sort_order;

SELECT 'deduct_user_credits function:' as status;
SELECT proname, prosrc FROM pg_proc WHERE proname = 'deduct_user_credits';

SELECT 'increment_user_credits function:' as status;
SELECT proname, prosrc FROM pg_proc WHERE proname = 'increment_user_credits';
