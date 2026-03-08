# Admin Setup Complete

## ✅ Pushed to GitHub

**Repository:** https://github.com/mikewithoutthemechanics/PRODUCTION-APP-V1  
**Branch:** v2  
**Commit:** ce7f85c - "Add admin setup SQL and scripts"

## 📁 Saved to Local Codebase

Location: `C:\Users\Personal\Desktop\NEW-CODE`

Files created:
- `SQL-EDITOR-ADMINS.sql` - Ready to run in Supabase SQL Editor
- `set-admins.sql` - Alternative SQL script
- `set-admins.ps1` - PowerShell script (had API issues)
- `ADMIN-SETUP-GUIDE.md` - Full setup instructions

## 👤 Admin Users to Set

| Email | Name |
|-------|------|
| michael@agentcy.co.za | Michael |
| zelda@thefasciadome.co.za | Zelda |
| jo@thefasciadome.co.za | Jo |
| michaelgraemek@gmail.com | Michael Graeme |

## 🔧 How to Set Admins (2 Methods)

### Method 1: Supabase SQL Editor (Easiest)

1. **Go to Supabase Dashboard:**
   - URL: https://app.supabase.com/project/lxdtovoakxekjrkexbae/sql-editor

2. **Open SQL Editor:**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy & Paste SQL:**
   - Open `SQL-EDITOR-ADMINS.sql` from your codebase
   - Copy all the SQL
   - Paste into Supabase SQL Editor

4. **Run the SQL:**
   - Click "Run" button
   - You should see 4 rows updated/inserted

5. **Verify:**
   - The query at the bottom will show all 4 users with `isAdmin = true`

### Method 2: Supabase Table Editor (Manual)

1. Go to: https://app.supabase.com/project/lxdtovoakxekjrkexbae
2. Click "Table Editor" → "users"
3. For each email:
   - Find the user row
   - Click the row to edit
   - Change `isAdmin` from `false` to `true`
   - Click "Save"

## ✅ Verification

After setting admins, they can login at:
- **Production:** https://tfmdbooking.vercel.app
- Click "Admin Portal"
- Enter their email/password
- They should see the admin dashboard

## 📊 What Was Done

1. ✅ Pushed all fixes to GitHub (branch: v2)
2. ✅ Saved all admin setup scripts locally
3. ✅ Created SQL-EDITOR-ADMINS.sql (ready to run)
4. ⏳ Admin users need to be set via SQL Editor (manual step)

## 🆘 If You Need Help

The REST API had permission issues, so manual SQL execution is required. If you need me to try another method, let me know!
