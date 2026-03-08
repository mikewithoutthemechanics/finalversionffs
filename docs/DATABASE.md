# Database Schema

_Last updated: March 6, 2026 at 8:47 AM (SAST)_

The TFMD Booking App uses Supabase (PostgreSQL) as its database. This document outlines the schema and structure.

## Overview

- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth (Google OAuth + Email)
- **Storage**: Supabase Storage (if needed)
- **RLS**: Row Level Security enabled on all tables

## Schema Files

| File | Description |
|------|-------------|
| `supabase/schema.sql` | Main schema with tables and indexes |
| `supabase/security-fixes-migration.sql` | RLS policies |
| `supabase/missing-tables-migration.sql` | Additional tables |

## Tables

### users

Main user table for clients and admins.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | User ID (UUID format) |
| `name` | TEXT | User's full name |
| `email` | TEXT | Email (unique) |
| `phone` | TEXT | Phone number |
| `is_admin` | BOOLEAN | Admin flag |
| `admin_role` | TEXT | Role: super_admin, admin, teacher, staff |
| `sport` | TEXT | User's sport/activity |
| `waiver_accepted` | BOOLEAN | Waiver signed |
| `medical_cleared` | BOOLEAN | Medical clearance |
| `heat_acknowledged` | BOOLEAN | Heat policy acknowledged |
| `waiver_date` | TEXT | When waiver was signed |
| `credits` | INTEGER | Credit balance (default 0) |
| `waiver_data` | JSONB | Waiver details |
| `injuries` | JSONB | Injury records |
| `movement_goals` | TEXT[] | User's goals |
| `health_conditions` | TEXT[] | Health conditions |
| `movement_experience` | TEXT | beginner, intermediate, advanced |
| `two_factor_enabled` | BOOLEAN | 2FA enabled |
| `two_factor_secret` | TEXT | 2FA secret |
| `two_factor_backup_codes` | TEXT[] | Backup codes |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

### venues

Class locations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Venue ID |
| `name` | TEXT | Venue name |
| `address` | TEXT | Full address |
| `suburb` | TEXT | Suburb |
| `maps_url` | TEXT | Google Maps link |
| `notes` | TEXT | Notes |
| `active` | BOOLEAN | Is active |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

### teachers

Class instructors (aliased as "instructors" in UI).

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Instructor ID |
| `name` | TEXT | Name |
| `email` | TEXT | Email (unique) |
| `phone` | TEXT | Phone |
| `bio` | TEXT | Biography |
| `specialties` | TEXT[] | Specialties |
| `avatar` | TEXT | Avatar URL |
| `active` | BOOLEAN | Is active |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

### classes

Class sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Class ID |
| `slug` | TEXT | URL slug (unique) |
| `title` | TEXT | Class title |
| `date_time` | TEXT | ISO date string |
| `duration` | INTEGER | Duration in minutes (default 75) |
| `venue_id` | TEXT | FK to venues |
| `teacher_id` | TEXT | FK to teachers |
| `sport_tags` | TEXT[] | Sport tags |
| `body_area_tags` | TEXT[] | Body area tags |
| `capacity` | INTEGER | Max attendees (default 15) |
| `registered` | INTEGER | Current registrations |
| `status` | TEXT | published, draft, cancelled |
| `description` | TEXT | Class description |
| `price` | INTEGER | Price in ZAR |
| `credit_cost` | INTEGER | Credit cost for booking |
| `allow_dome_reset_override` | BOOLEAN | Allow credit override |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

### registrations

User class bookings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Registration ID |
| `class_id` | TEXT | FK to classes |
| `user_id` | TEXT | FK to users |
| `user_name` | TEXT | User's name at time of booking |
| `user_email` | TEXT | User's email |
| `user_sport` | TEXT | User's sport |
| `status` | TEXT | confirmed, registered, waitlisted, cancelled, payment_review |
| `payment_status` | TEXT | paid, pending, free, credits |
| `cancelled_at` | TEXT | Cancellation timestamp |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### feedback

User feedback for classes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Feedback ID |
| `class_id` | TEXT | FK to classes |
| `user_id` | TEXT | FK to users |
| `user_name` | TEXT | User's name |
| `type` | TEXT | post_class, general, nps |
| `rating` | INTEGER | 1-5 rating |
| `nps_score` | INTEGER | 0-10 NPS score |
| `comment` | TEXT | Feedback comment |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### templates

Email templates.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Template ID |
| `name` | TEXT | Template name |
| `sport_tags` | TEXT[] | Sport tags |
| `body_area_tags` | TEXT[] | Body area tags |
| `active` | BOOLEAN | Is active |
| `whatsapp_body` | TEXT | WhatsApp message body |
| `email_subject` | TEXT | Email subject |
| `email_body` | TEXT | Email body |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

### app_settings

Application settings.

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT (PK) | Setting key |
| `value` | JSONB | Setting value |
| `updated_at` | TIMESTAMPTZ | Last update |

### calendar_sync

Google Calendar integration tokens.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Token ID |
| `user_id` | TEXT | FK to users |
| `calendar_id` | TEXT | Google Calendar ID |
| `tokens` | TEXT | Encrypted OAuth tokens |
| `expires_at` | TIMESTAMPTZ | Token expiry |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### oauth_tokens

OAuth tokens storage.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Token ID |
| `user_id` | TEXT | FK to users |
| `tokens` | TEXT | Encrypted tokens |
| `expires_at` | TIMESTAMPTZ | Token expiry |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### disclaimers

Legal disclaimers shown during onboarding.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Disclaimer ID |
| `title` | TEXT | Title |
| `content` | TEXT | Content |
| `type` | TEXT | Type |
| `order` | INTEGER | Display order |
| `active` | BOOLEAN | Is active |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

### chat_messages

Chat messages between users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Message ID |
| `sender_id` | TEXT | FK to users |
| `recipient_id` | TEXT | FK to users |
| `content` | TEXT | Message content |
| `read` | BOOLEAN | Read status |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### crm_contacts

CRM contacts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Contact ID |
| `name` | TEXT | Name |
| `email` | TEXT | Email |
| `phone` | TEXT | Phone |
| `company` | TEXT | Company |
| `status` | TEXT | Contact status |
| `source` | TEXT | Lead source |
| `assigned_to` | TEXT | Assigned user |
| `notes` | TEXT | Notes |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

### crm_tasks

CRM tasks.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Task ID |
| `title` | TEXT | Task title |
| `description` | TEXT | Description |
| `status` | TEXT | Status |
| `priority` | TEXT | Priority |
| `due_date` | TEXT | Due date |
| `assigned_to` | TEXT | Assigned user |
| `contact_id` | TEXT | FK to crm_contacts |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

### marketing_campaigns

Email campaigns.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Campaign ID |
| `name` | TEXT | Campaign name |
| `status` | TEXT | draft, scheduled, sent |
| `subject` | TEXT | Email subject |
| `template_id` | TEXT | FK to templates |
| `scheduled_at` | TEXT | Scheduled time |
| `sent_at` | TEXT | Sent time |
| `recipients_count` | INTEGER | Recipients |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

## Row Level Security (RLS)

All tables have RLS enabled. Policies:

### Users
- Users can read/update own data
- Admins have full access

### Classes (Public Read)
- Anyone can read published classes
- Only admins can insert/update

### Registrations
- Users can read own registrations
- Users can insert registrations
- Users can update/cancel own registrations

### Venues, Teachers, Templates
- Public read access
- Admin full access

### Feedback
- Public read
- Users can insert their own

### Chat Messages
- Users can read own messages
- Authenticated users can insert
- Users can update/delete own

### CRM Tables
- Admin full access only

## Indexes

Key indexes for performance:

```sql
-- Classes
CREATE INDEX idx_classes_date_time ON classes(date_time);
CREATE INDEX idx_classes_status ON classes(status);
CREATE INDEX idx_classes_venue ON classes(venue_id);

-- Registrations
CREATE INDEX idx_registrations_class ON registrations(class_id);
CREATE INDEX idx_registrations_user ON registrations(user_id);
CREATE INDEX idx_registrations_status ON registrations(status);

-- Feedback
CREATE INDEX idx_feedback_class ON feedback(class_id);
CREATE INDEX idx_feedback_user ON feedback(user_id);

-- Users
CREATE INDEX idx_users_email ON users(email);
```

## Migrations

### Running Migrations

1. Connect to Supabase SQL Editor
2. Run schema.sql
3. Run security-fixes-migration.sql
4. Run missing-tables-migration.sql (if needed)

### Adding New Tables

1. Add table to schema.sql
2. Add RLS policies to security-fixes-migration.sql
3. Test in staging before production

## TypeScript Types

Types are defined in `types.ts` and `services/supabase-types.ts`:

```typescript
// Example: User type
interface User {
  id: string;
  name: string;
  email: string;
  credits: number;
  // ... other fields
}
```

## Testing Database

```bash
# Test Supabase connection
node test-supabase-connection.js

# Seed test data
npm run seed:staging

# Run CRUD tests
npm run test:staging
```

## Backup & Restore

Supabase handles automatic backups. For manual:
1. Export via Supabase dashboard
2. Or use pg_dump:
```bash
pg_dump -h db.PROJECT.ref.supabase.co -U postgres -f backup.sql
```
