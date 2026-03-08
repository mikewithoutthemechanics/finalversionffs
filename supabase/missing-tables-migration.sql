-- Migration: Create missing CRM and Disclaimers tables
-- Run this in the Supabase SQL Editor to create the 6 missing tables

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
-- INDEXES FOR NEW TABLES
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
-- TRIGGERS FOR NEW TABLES
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