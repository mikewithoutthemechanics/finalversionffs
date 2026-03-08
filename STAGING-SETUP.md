# Staging Environment Setup for SQL Injection Testing

**Staging URL:** https://tfmd-staging-ifc5dajkt-michael-s-projects-1c4584cf.vercel.app  
**Short URL:** https://tfmd-staging.vercel.app  
**Status:** ✅ Deployed

---

## Step 1: Create Staging Supabase Project (Manual)

### 1.1 Create New Project
1. Go to https://app.supabase.com
2. Click "New Project"
3. Organization: Select yours
4. Project name: `tfmd-staging`
5. Database password: Generate or create secure password
6. Region: `South Africa (North) - Johannesburg` (closest to your users)
7. Click "Create new project"

### 1.2 Get Credentials
After project creation, go to **Project Settings → API**:

```
Project URL: https://[your-project].supabase.co
anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (KEEP SECRET)
```

---

## Step 2: Run Database Migrations

### 2.1 Open SQL Editor
In Supabase dashboard: **SQL Editor → New Query**

### 2.2 Copy and Run Schema
Use the schema from your existing project or run the migration files in:
```
supabase/migrations/
```

---

## Step 3: Seed Fake Data

### 3.1 Run Seed Script
In Supabase SQL Editor, run this file:
```
staging-seed-data.sql
```

This creates:
- 5 fake test users (no real emails)
- 3 test classes
- Sample bookings
- Test payment records
- Fake chat messages

---

## Step 4: Configure Vercel Environment Variables

### 4.1 Add to Vercel Dashboard
Go to: https://vercel.com/michael-s-projects-1c4584cf/tfmd-staging/settings/environment-variables

Add these variables:

```
VITE_SUPABASE_URL=https://[your-staging-project].supabase.co
VITE_SUPABASE_ANON_KEY=your_staging_anon_key
SUPABASE_SERVICE_KEY=your_staging_service_role_key

# Optional - for full functionality
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
APP_URL=https://tfmd-staging-ifc5dajkt-michael-s-projects-1c4584cf.vercel.app
```

### 4.2 Redeploy
After adding env vars, redeploy:
```bash
cd C:\Users\Personal\Desktop\NEW-CODE
vercel --prod
```

---

## Step 5: Verify Staging Setup

### 5.1 Health Check
Visit: https://tfmd-staging-ifc5dajkt-michael-s-projects-1c4584cf.vercel.app/api/health

Should return:
```json
{"status":"ok"}
```

### 5.2 Test Login
Try logging in with test credentials:
- Email: `test@staging.local`
- Password: `Test123!`

---

## 🎯 Ready for SQL Injection Testing

Once setup is complete, tell me:

```
"Use sql-injection-testing skill on https://tfmd-staging-ifc5dajkt-michael-s-projects-1c4584cf.vercel.app"
```

I'll test these endpoints safely:
- `/api/auth/login` - Authentication bypass attempts
- `/api/classes/search` - Union-based extraction
- `/api/bookings/create` - Blind injection tests
- `/api/payfast/notify` - Parameter tampering

---

## ⚠️ Safety Notes

- ✅ Staging database has ONLY fake data
- ✅ No real customer information
- ✅ Separate from production
- ✅ Can be destroyed/recreated anytime
- ❌ Never test on production URL

---

## Quick Commands

```bash
# Redeploy staging
vercel --prod

# View logs
vercel logs tfmd-staging

# Open dashboard
vercel open
```
