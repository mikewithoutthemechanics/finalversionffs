-- TFMD Booking App Database Schema
-- Run this SQL in your Supabase SQL Editor to create the required tables
-- Version: 2.1 - Security fixes for RLS policies and function search_path

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  admin_role TEXT CHECK (admin_role IN ('super_admin', 'admin', 'teacher', 'staff')),
  sport TEXT,
  waiver_accepted BOOLEAN DEFAULT FALSE,
  medical_cleared BOOLEAN DEFAULT FALSE,
  heat_acknowledged BOOLEAN DEFAULT FALSE,
  waiver_date TEXT,
  credits INTEGER DEFAULT 0,
  waiver_data JSONB,
  injuries JSONB DEFAULT '[]'::jsonb,
  movement_goals TEXT[] DEFAULT '{}',
  health_conditions TEXT[] DEFAULT '{}',
  movement_experience TEXT CHECK (movement_experience IN ('beginner', 'intermediate', 'advanced')),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  two_factor_backup_codes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- VENUES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  suburb TEXT,
  maps_url TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INSTRUCTORS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  bio TEXT,
  specialties TEXT[] DEFAULT '{}',
  avatar TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CLASSES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  date_time TEXT NOT NULL,
  duration INTEGER DEFAULT 75,
  venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  sport_tags TEXT[] DEFAULT '{}',
  body_area_tags TEXT[] DEFAULT '{}',
  capacity INTEGER DEFAULT 15,
  registered INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'cancelled')),
  description TEXT,
  price INTEGER DEFAULT 0,
  credit_cost INTEGER DEFAULT 0,
  allow_dome_reset_override BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- REGISTRATIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  user_email TEXT,
  user_sport TEXT,
  body_areas TEXT[] DEFAULT '{}',
  referred_by TEXT,
  status TEXT DEFAULT 'registered' CHECK (status IN ('confirmed', 'registered', 'cancelled', 'waitlisted', 'payment_review')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'unpaid', 'verified')),
  payment_method TEXT CHECK (payment_method IN ('zapper', 'manual', 'free', 'credits')),
  payment_proof TEXT,
  registered_at TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TEMPLATES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sport_tags TEXT[] DEFAULT '{}',
  body_area_tags TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  whatsapp_body TEXT,
  email_subject TEXT,
  email_body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- FEEDBACK TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('post_class', 'general', 'nps')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CALENDAR SYNC TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS calendar_sync (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider IN ('google', 'apple', 'outlook')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expiry_date TIMESTAMPTZ,
  calendar_id TEXT,
  sync_enabled BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- APP SETTINGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  app_name TEXT DEFAULT 'Pause Fascia Movement',
  contact_email TEXT DEFAULT 'admin@pausefmd.co.za',
  additional_contact_emails TEXT[] DEFAULT '{}',
  zapper_qr_base64 TEXT,
  landing_page JSONB,
  email_config JSONB,
  google_calendar_tokens JSONB,
  google_calendar_id TEXT,
  google_calendar_sync_enabled BOOLEAN DEFAULT FALSE,
  google_calendar_last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_classes_venue_id ON classes(venue_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_status ON classes(status);
CREATE INDEX IF NOT EXISTS idx_classes_date_time ON classes(date_time);
CREATE INDEX IF NOT EXISTS idx_registrations_class_id ON registrations(class_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_feedback_class_id ON feedback(class_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_user_id ON calendar_sync(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_active ON teachers(active);

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

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
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read classes" ON classes FOR SELECT USING (status = 'published');
CREATE POLICY "Public read venues" ON venues FOR SELECT USING (true);
CREATE POLICY "Public read teachers" ON teachers FOR SELECT USING (active = true);
CREATE POLICY "Public read templates" ON templates FOR SELECT USING (active = true);

-- Users policies - users can only access their own data
CREATE POLICY "Users read own data" ON users FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users insert own data" ON users FOR INSERT WITH CHECK (auth.uid()::text = id);
CREATE POLICY "Users update own data" ON users FOR UPDATE USING (auth.uid()::text = id) WITH CHECK (auth.uid()::text = id);

-- Registrations policies - users can only access their own registrations
CREATE POLICY "Users read own registrations" ON registrations FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users insert registrations" ON registrations FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users update own registrations" ON registrations FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- Feedback policies - users can read all feedback but only insert their own
CREATE POLICY "Users read feedback" ON feedback FOR SELECT USING (true);
CREATE POLICY "Users insert feedback" ON feedback FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Calendar sync policies - users can only manage their own calendar sync
CREATE POLICY "Users manage own calendar" ON calendar_sync FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- App settings - public read
CREATE POLICY "Public read settings" ON app_settings FOR SELECT USING (true);

-- =============================================================================
-- DEFAULT DATA
-- =============================================================================
INSERT INTO app_settings (id, app_name, contact_email, landing_page, email_config)
VALUES (
  1,
  'Pause Fascia Movement',
  'admin@pausefmd.co.za',
  '{
    "headerText": "where fascia becomes FLUID",
    "subheaderText": "Step into the Dome",
    "expectations": [
      "75-minute guided fascia exploration tailored to your sport",
      "Understanding the fascial chains specific to your body patterns",
      "Take-home movement practices you can integrate immediately",
      "Intimate group — max 15 people"
    ]
  }'::jsonb,
  '{
    "provider": "mock",
    "apiKey": "",
    "senderName": "Pause Admin",
    "senderEmail": "hello@pausefmd.co.za",
    "waitlistTemplate": "Hi {{name}},\n\nA spot has opened up for \"{{class_title}}\".\n\nYou have been moved from the waitlist to {{status}}.\n\nDate: {{date}}\nTime: {{time}}\n\n{{action_required}}"
  }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CRM CONTACTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'new_inquiry' CHECK (status IN ('new_inquiry', 'consultation', 'trial', 'active', 'vip', 'at_risk', 'churned')),
  source TEXT DEFAULT 'other' CHECK (source IN ('website', 'referral', 'social', 'event', 'google', 'instagram', 'word_of_mouth', 'other')),
  is_client BOOLEAN DEFAULT FALSE,
  movement_goals JSONB DEFAULT '[]'::jsonb,
  primary_body_areas JSONB DEFAULT '[]'::jsonb,
  injuries JSONB DEFAULT '[]'::jsonb,
  total_sessions INTEGER DEFAULT 0,
  preferred_class_types JSONB DEFAULT '[]'::jsonb,
  package_history JSONB DEFAULT '[]'::jsonb,
  total_spent INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  notes JSONB DEFAULT '[]'::jsonb,
  activities JSONB DEFAULT '[]'::jsonb,
  linked_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CRM TASKS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS crm_tasks (
  id TEXT PRIMARY KEY,
  contact_id TEXT REFERENCES crm_contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT NOT NULL,
  due_time TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to TEXT NOT NULL,
  completed_at TEXT,
  completed_by TEXT,
  reminders JSONB DEFAULT '[]'::jsonb,
  task_type TEXT CHECK (task_type IN ('follow_up', 'consultation', 'check_in', 'renewal', 'birthday', 'injury_followup', 'feedback')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CRM PIPELINE STAGES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6E7568',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CRM EMAIL TEMPLATES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS crm_email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'other' CHECK (category IN ('follow_up', 'consultation', 'welcome', 'renewal', 'check_in', 'promotion', 'other')),
  variables JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CRM CAMPAIGNS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  target_segment TEXT,
  target_tags JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_for TEXT,
  sent_at TEXT,
  recipient_count INTEGER DEFAULT 0,
  open_rate INTEGER,
  click_rate INTEGER,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- DISCLAIMERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS disclaimers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  context TEXT DEFAULT 'general' CHECK (context IN ('general', 'class', 'venue', 'waiver', 'registration')),
  class_type TEXT,
  venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  intro_text TEXT NOT NULL,
  sections JSONB DEFAULT '[]'::jsonb,
  signature_required BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ADDITIONAL INDEXES FOR CRM TABLES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_source ON crm_contacts(source);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_linked_user_id ON crm_contacts(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact_id ON crm_tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_to ON crm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON crm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_pipeline_stages_order ON crm_pipeline_stages("order");
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_status ON crm_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_disclaimers_context ON disclaimers(context);
CREATE INDEX IF NOT EXISTS idx_disclaimers_active ON disclaimers(active);

-- =============================================================================
-- ADDITIONAL TRIGGERS FOR NEW TABLES
-- =============================================================================
CREATE TRIGGER update_crm_contacts_updated_at BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_pipeline_stages_updated_at BEFORE UPDATE ON crm_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_email_templates_updated_at BEFORE UPDATE ON crm_email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disclaimers_updated_at BEFORE UPDATE ON disclaimers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- =============================================================================
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclaimers ENABLE ROW LEVEL SECURITY;

-- CRM policies - Admin only access
CREATE POLICY "Admin full access crm_contacts" ON crm_contacts FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.is_admin = true)
);

CREATE POLICY "Admin full access crm_tasks" ON crm_tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.is_admin = true)
);

CREATE POLICY "Admin full access crm_pipeline_stages" ON crm_pipeline_stages FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.is_admin = true)
);

CREATE POLICY "Admin full access crm_email_templates" ON crm_email_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.is_admin = true)
);

CREATE POLICY "Admin full access crm_campaigns" ON crm_campaigns FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.is_admin = true)
);

-- Disclaimers - public can read active, admin can manage all
CREATE POLICY "Public read active disclaimers" ON disclaimers FOR SELECT USING (active = true);
CREATE POLICY "Admin full access disclaimers" ON disclaimers FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.is_admin = true)
);

-- =============================================================================
-- CHAT MESSAGES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  recipient_id TEXT,
  recipient_name TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own messages or messages sent to them
CREATE POLICY "Users can read own messages" ON chat_messages FOR SELECT 
  USING (sender_id = auth.uid()::text OR recipient_id = auth.uid()::text OR recipient_id IS NULL);

-- Policy: Authenticated users can insert messages
CREATE POLICY "Authenticated users can insert chat" ON chat_messages FOR INSERT 
  WITH CHECK (sender_id = auth.uid()::text);

-- Policy: Users can update their own messages
CREATE POLICY "Users can update own messages" ON chat_messages FOR UPDATE 
  USING (sender_id = auth.uid()::text);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON chat_messages FOR DELETE 
  USING (sender_id = auth.uid()::text);

-- =============================================================================
-- MARKETING CAMPAIGNS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled')) DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  sent INTEGER DEFAULT 0,
  recipients INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  opened INTEGER DEFAULT 0,
  clicked INTEGER DEFAULT 0,
  converted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can manage campaigns
CREATE POLICY "Admin full access marketing_campaigns" ON marketing_campaigns FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.is_admin = true)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient ON chat_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);

-- =============================================================================
-- OAUTH TOKENS TABLE (for serverless-compatible token storage)
-- =============================================================================
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  tokens JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  user_id TEXT
);

-- Enable RLS
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own tokens
CREATE POLICY "Users can manage own tokens" ON oauth_tokens FOR ALL 
  USING (user_id = auth.uid()::text OR user_id IS NULL);

-- Policy: Service role can manage all tokens
CREATE POLICY "Service role can manage all tokens" ON oauth_tokens FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.is_admin = true)
    OR auth.role() = 'service_role'
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON oauth_tokens(user_id);
