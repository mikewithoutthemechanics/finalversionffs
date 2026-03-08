# Testing Guide for Supabase Migration

_Last updated: March 6, 2026 at 8:53 AM (SAST)_

This guide covers how to set up and test the TFMD Booking App with Supabase, including staging environment setup, data migration, and deployment testing.

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Setup](#environment-setup)
- [Staging Environment](#staging-environment)
- [Running Tests](#running-tests)
- [Data Migration](#data-migration)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Install dependencies (includes new dev dependencies)
npm install

# 2. Set up staging environment
npm run setup:staging

# 3. Run tests
npm run test:staging
```

---

## Environment Setup

### 1. Environment Files

We use three environment configurations:

| File | Purpose |
|------|---------|
| `.env.local` | Local development |
| `.env.staging.local` | Staging environment |
| `.env.production.local` | Production environment |

### 2. Create Staging Environment

```bash
# Copy the staging template
cp .env.staging .env.staging.local

# Edit with your staging credentials
nano .env.staging.local
```

Required variables:

```env
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_staging_anon_key
SUPABASE_SERVICE_KEY=your_staging_service_key
APP_URL=https://your-app-staging.vercel.app
```

### 3. Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your staging project
3. Go to **Project Settings** → **API**
4. Copy:
   - `URL` → `VITE_SUPABASE_URL`
   - `anon public` → `VITE_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_KEY`

⚠️ **Never commit service keys to git!** They are already in `.gitignore`.

---

## Staging Environment

### One-Command Setup

```bash
npm run setup:staging
```

This command will:
1. ✅ Check environment configuration
2. ✅ Test Supabase connection
3. ✅ Verify database schema
4. ✅ Run CRUD tests
5. 🌱 Seed test data (optional)

### Manual Setup Steps

If you prefer manual control:

```bash
# 1. Apply database schema
npx tsx apply-schema-via-api.cjs

# 2. Seed test data
npm run seed:staging

# 3. Run tests
npm run test:staging
```

### Setup Options

```bash
# Skip tests during setup
npm run setup:staging -- --skip-tests

# Skip seeding test data
npm run setup:staging -- --skip-seed

# Reset data before seeding
npm run setup:staging -- --reset

# Verbose output
npm run setup:staging -- --verbose
```

---

## Running Tests

### Full Test Suite

```bash
# Test all services against staging
npm run test:staging
```

Tests cover all 10 services:
- ✅ User Service (CRUD)
- ✅ Venue Service (CRUD)
- ✅ Teacher/Instructor Service (CRUD)
- ✅ Class Service (CRUD)
- ✅ Registration Service (CRUD)
- ✅ Template Service (CRUD)
- ✅ Feedback Service (CRUD)
- ✅ CRM Service (CRUD)
- ✅ Disclaimer Service (CRUD)
- ✅ Settings Service (Read)

### Test Options

```bash
# Test specific service only
npx tsx scripts/test-supabase-crud.ts --service=user

# Verbose output (show all test details)
npm run test:staging -- --verbose

# Keep test data after tests (for debugging)
npm run test:staging -- --keep-data
```

### Test Output Example

```
🔹 User Service
   ✅ Create user (245ms)
   ✅ Read user (123ms)
   ✅ Update user (189ms)
   ✅ List users (156ms)
   4 passed, 0 failed

🔹 Venue Service
   ✅ Create venue (234ms)
   ✅ Read venue (98ms)
   ✅ Update venue (167ms)
   3 passed, 0 failed

══════════════════════════════════════════════════════════════════
                     TEST SUMMARY
══════════════════════════════════════════════════════════════════

⏱️  Duration: 5.23s
📝 Total tests: 47
✅ Passed: 47
❌ Failed: 0

🎉 All tests passed!
```

---

## Data Migration

### Export localStorage Data

Before migrating, export your localStorage data from the browser:

```javascript
// In browser console on your old app
copy(JSON.stringify({
  users: JSON.parse(localStorage.getItem('tfmd_users') || '[]'),
  classes: JSON.parse(localStorage.getItem('tfmd_classes') || '[]'),
  registrations: JSON.parse(localStorage.getItem('tfmd_registrations') || '[]'),
  venues: JSON.parse(localStorage.getItem('tfmd_venues') || '[]'),
  instructors: JSON.parse(localStorage.getItem('tfmd_instructors') || '[]'),
  templates: JSON.parse(localStorage.getItem('tfmd_templates') || '[]'),
  feedback: JSON.parse(localStorage.getItem('tfmd_feedback') || '[]'),
}, null, 2));
```

Save the copied JSON to a file (e.g., `localstorage-export.json`).

### Run Migration

```bash
# Dry run (see what would happen without making changes)
npm run migrate:data -- --input=./localstorage-export.json --dry-run

# Actual migration
npm run migrate:data -- --input=./localstorage-export.json

# Verbose output
npm run migrate:data -- --input=./localstorage-export.json --verbose
```

### Migration Order

Data is migrated in the correct order to respect foreign key constraints:

1. Users
2. Venues
3. Teachers (instructors)
4. Classes
5. Registrations
6. Templates
7. Feedback

### Migration Summary

After migration, you'll see a summary:

```
╔══════════════════════════════════════════════════════════════════╗
║                      MIGRATION SUMMARY                           ║
╚══════════════════════════════════════════════════════════════════╝

⏱️  Duration: 3.45s

📊 users:
   ✅ Imported: 45
   ⏭️  Skipped:  0
   ❌ Errors:   0

📊 classes:
   ✅ Imported: 12
   ⏭️  Skipped:  2
   ❌ Errors:   0

🎉 Migration completed successfully!
```

---

## Switching Between Environments

### Environment Variable

```bash
# Set environment for any command
export NODE_ENV=staging    # or development, production
```

### Local Development

```bash
# Uses .env.local
npm run dev
```

### Staging

```bash
# Uses .env.staging.local
export NODE_ENV=staging
npm run dev
```

### Production

```bash
# Uses .env.production.local
export NODE_ENV=production
npm run build
```

---

## Production Deployment

### Pre-Deployment Checklist

Before deploying to production:

```bash
# 1. Run full test suite
npm run test:staging

# 2. Verify all tests pass
# Look for: "🎉 All tests passed!"

# 3. Check for TypeScript errors
npm run lint

# 4. Build successfully
npm run build
```

### Testing Checklist

| Test | Command | Expected Result |
|------|---------|-----------------|
| CRUD Tests | `npm run test:staging` | All pass |
| User can register | Manual test | Success |
| User can book class | Manual test | Success |
| Waitlist works | Manual test | Success |
| Admin can manage | Manual test | Success |
| Data persists | Refresh page | Data remains |

### Deploy to Production

```bash
# 1. Switch to production environment
export NODE_ENV=production

# 2. Build for production
npm run build

# 3. Deploy (requires Vercel CLI)
npm run deploy:production
```

Or use Vercel Git integration for automatic deployments.

---

## Troubleshooting

### Common Issues

#### "Cannot find module 'dotenv'"

```bash
npm install
```

#### "Missing Supabase credentials"

Check your `.env.staging.local` file has all required variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`

#### "Table does not exist" errors

Apply the schema first:
```bash
npx tsx apply-schema-via-api.cjs
```

#### Connection timeouts

Check your network and Supabase project status:
```bash
# Test connection
curl -I $VITE_SUPABASE_URL
```

#### Test failures

Run with verbose mode to see details:
```bash
npm run test:staging -- --verbose
```

### Reset Staging Data

To completely reset staging:

```bash
# 1. Truncate all tables (be careful!)
# Run in Supabase SQL Editor:
# TRUNCATE users, classes, registrations, venues, instructors, templates, feedback CASCADE;

# 2. Re-seed with fresh data
npm run seed:staging -- --reset
```

### Getting Help

1. Check Supabase logs: Supabase Dashboard → Logs
2. Check Vercel logs: Vercel Dashboard → Deployments
3. Run tests with verbose: `--verbose` flag
4. Check browser console for client-side errors

---

## Test Data Reference

When you seed staging, the following test accounts are created:

| Email | Role | Password |
|-------|------|----------|
| admin@test.com | Super Admin | Set via Supabase Auth |
| [various]@test.com | Regular Users | N/A (use magic link) |

### Sample Data Created

- **20 Users** (1 admin + 19 regular)
- **3 Venues** (Rosebank, Sandton, Fourways)
- **4 Instructors** with specialties
- **15 Classes** (mix of published, draft, cancelled)
- **50 Registrations** (various statuses)
- **3 Templates** (welcome, waitlist, reminder)
- **30 Feedback entries** (ratings and NPS)

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [MIGRATION.md](./MIGRATION.md) - Migration details
- [ENVIRONMENT.md](./docs/ENVIRONMENT.md) - Environment setup
