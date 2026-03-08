-- Performance Optimization: Database Indexes
-- This migration adds indexes to improve query performance for large datasets
-- Created as part of Phase 3 Performance Audit

-- Classes table indexes
CREATE INDEX IF NOT EXISTS idx_classes_datetime ON classes(date_time);
CREATE INDEX IF NOT EXISTS idx_classes_status ON classes(status);
CREATE INDEX IF NOT EXISTS idx_classes_venue ON classes(venue_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_slug ON classes(slug);

-- Registrations table indexes
CREATE INDEX IF NOT EXISTS idx_registrations_class ON registrations(class_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_class_status ON registrations(class_id, status);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin);

-- Venues table indexes
CREATE INDEX IF NOT EXISTS idx_venues_active ON venues(active);

-- Teachers table indexes
CREATE INDEX IF NOT EXISTS idx_teachers_active ON teachers(active);

-- Feedback table indexes
CREATE INDEX IF NOT EXISTS idx_feedback_class ON feedback(class_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);

-- CRM tables indexes
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assignee ON crm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact ON crm_tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON crm_tasks(due_date);

-- App settings index
CREATE INDEX IF NOT EXISTS idx_app_settings_id ON app_settings(id);

-- Log index creation
DO $$
BEGIN
  RAISE NOTICE 'Performance indexes created successfully';
END $$;
