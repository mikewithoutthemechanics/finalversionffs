# Admin Setup Guide for Supabase

## 🔑 How to Set Admin Users

### Method 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - URL: https://app.supabase.com
   - Select your project: `lxdtovoakxekjrkexbae`

2. **Navigate to Table Editor**
   - Click "Table Editor" in left sidebar
   - Find and click on `users` table

3. **Find the User**
   - Search for the user by email
   - Click on the row to edit

4. **Set isAdmin to true**
   - Find the `isAdmin` column
   - Change value from `false` to `true`
   - Click "Save"

### Method 2: Using SQL Editor

1. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

2. **Run this SQL:**
```sql
-- Set specific user as admin
UPDATE users 
SET isAdmin = true 
WHERE email = 'admin@yourdomain.com';

-- Or set by user ID
UPDATE users 
SET isAdmin = true 
WHERE id = 'user-uuid-here';
```

3. **Click "Run"**

### Method 3: Using Supabase CLI

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref lxdtovoakxekjrkexbae

# Run SQL
supabase sql "UPDATE users SET isAdmin = true WHERE email = 'admin@yourdomain.com'"
```

---

## 👤 Creating the First Admin

### Step 1: Sign Up as Regular User
1. Go to your app: https://tfmdbooking.vercel.app
2. Click "Get Your Free Pass"
3. Enter name and email
4. Complete onboarding and waiver

### Step 2: Set as Admin (via Dashboard)
1. Go to Supabase Dashboard
2. Table Editor → users
3. Find your email
4. Set `isAdmin` = `true`

### Step 3: Login as Admin
1. Go to app
2. Click "Admin Portal"
3. Login with same email/password
4. You should now see the admin dashboard

---

## 🔐 Admin Login Flow

```
User clicks "Admin Portal"
    ↓
Enters email/password
    ↓
Supabase Auth validates
    ↓
API checks: /api/admin/verify
    ↓
Database checks isAdmin flag
    ↓
If isAdmin = true → Access granted
If isAdmin = false → "You do not have admin access"
```

---

## ⚠️ Troubleshooting

### "You do not have admin access" Error

**Cause:** User's `isAdmin` flag is `false` in database

**Fix:**
```sql
-- Check current status
SELECT email, isAdmin FROM users WHERE email = 'user@example.com';

-- Set as admin
UPDATE users SET isAdmin = true WHERE email = 'user@example.com';
```

### Admin Login Redirects to Client Page

**Cause:** Fixed in latest deployment. The `handleSignIn` function now checks `isAdmin` flag.

**Fix:** Redeploy with latest fixes:
```bash
cd C:\Users\Personal\Desktop\NEW-CODE
vercel --prod
```

### Can't Find Users Table

**Check:** Make sure you're in the correct Supabase project:
- Project ID: `lxdtovoakxekjrkexbae`
- URL: https://lxdtovoakxekjrkexbae.supabase.co

---

## 📝 User Roles Reference

| Role | isAdmin | isTeacher | Access |
|------|---------|-----------|--------|
| Regular User | false | false | Client app only |
| Teacher | false | true | Teacher portal |
| Admin | true | false | Full admin access |
| Admin+Teacher | true | true | Both portals |

---

## 🔍 Quick SQL Commands

```sql
-- List all admins
SELECT id, email, name, isAdmin 
FROM users 
WHERE isAdmin = true;

-- List all teachers
SELECT id, email, name, isTeacher 
FROM users 
WHERE isTeacher = true;

-- Make user both admin and teacher
UPDATE users 
SET isAdmin = true, isTeacher = true 
WHERE email = 'user@example.com';

-- Remove admin access
UPDATE users 
SET isAdmin = false 
WHERE email = 'user@example.com';
```

---

## ✅ Verification

After setting admin:
1. Go to https://tfmdbooking.vercel.app
2. Click "Admin Portal"
3. Enter credentials
4. Should redirect to admin dashboard
5. Should see: Dashboard, Classes, Attendees, etc.

---

## 🆘 Emergency Admin Access

If locked out:
```sql
-- Direct database access
UPDATE users SET isAdmin = true WHERE email = 'your-email@domain.com';

-- Or create new admin directly
INSERT INTO users (id, email, name, isAdmin, waiverAccepted) 
VALUES ('admin-' || gen_random_uuid(), 'newadmin@domain.com', 'Admin User', true, true);
```

---

## 📞 Support

If issues persist:
1. Check browser console for errors
2. Verify Supabase connection: https://lxdtovoakxekjrkexbae.supabase.co
3. Check Vercel logs: `vercel logs tfmdbooking`
4. Review network tab in DevTools
