-- Security Fixes Migration for TFMD Booking App
-- This migration fixes all security warnings from the database linter
-- Version: 2.1 - Security fixes

-- =============================================================================
-- FIX 1: Function Search Path Mutable
-- Drop and recreate the function with SET search_path
-- =============================================================================

-- Drop existing triggers first (they depend on the function)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_venues_updated_at ON venues;
DROP TRIGGER IF EXISTS update_teachers_updated_at ON teachers;
DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
DROP TRIGGER IF EXISTS update_registrations_updated_at ON registrations;
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
DROP TRIGGER IF EXISTS update_calendar_sync_updated_at ON calendar_sync;
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;

-- Drop and recreate the function with proper search_path
DROP FUNCTION IF EXISTS update_updated_at_column();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate all triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registrations_updated_at BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_sync_updated_at BEFORE UPDATE ON calendar_sync
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FIX 2: RLS Policy Always True - Users Table
-- Drop existing policies and recreate with proper auth checks
-- =============================================================================

DROP POLICY IF EXISTS "Users read own data" ON users;
DROP POLICY IF EXISTS "Users insert own data" ON users;
DROP POLICY IF EXISTS "Users update own data" ON users;

-- Users can only access their own data
CREATE POLICY "Users read own data" ON users FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users insert own data" ON users FOR INSERT WITH CHECK (auth.uid()::text = id);
CREATE POLICY "Users update own data" ON users FOR UPDATE USING (auth.uid()::text = id) WITH CHECK (auth.uid()::text = id);

-- =============================================================================
-- FIX 3: RLS Policy Always True - Registrations Table
-- =============================================================================

DROP POLICY IF EXISTS "Users read own registrations" ON registrations;
DROP POLICY IF EXISTS "Users insert registrations" ON registrations;
DROP POLICY IF EXISTS "Users update own registrations" ON registrations;

-- Users can only access their own registrations
CREATE POLICY "Users read own registrations" ON registrations FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users insert registrations" ON registrations FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users update own registrations" ON registrations FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- =============================================================================
-- FIX 4: RLS Policy Always True - Feedback Table
-- =============================================================================

DROP POLICY IF EXISTS "Users insert feedback" ON feedback;

-- Users can read all feedback but only insert their own
CREATE POLICY "Users insert feedback" ON feedback FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- =============================================================================
-- FIX 5: RLS Policy Always True - Calendar Sync Table
-- =============================================================================

DROP POLICY IF EXISTS "Users manage own calendar" ON calendar_sync;

-- Users can only manage their own calendar sync
CREATE POLICY "Users manage own calendar" ON calendar_sync FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
SELECT 'Security fixes applied successfully!' as status;
