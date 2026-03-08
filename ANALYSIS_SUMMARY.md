# NEW-CODE Analysis Summary

_Last updated: March 6, 2026 at 8:55 AM (SAST)_

# Generated: Mar 6 2026

## Status: NOT Ready for Production

### Critical Security Issues (Must Fix Before Deploy)

#### Authentication & Authorization
- [ ] server.ts:326-363 - Add auth middleware to /api/user/sync
- [ ] server.ts:368-412 - Add auth middleware to /api/registration/sync  
- [ ] server.ts:417-488 - Add auth middleware to /api/registration/cancel
- [ ] server.ts:590-696 - Add auth middleware to /api/teacher/approve
- [ ] server.ts:812-943 - Add auth middleware to /api/admin/invite
- [ ] App.tsx:420-428 - Remove hardcoded handleAdminSignIn()
- [ ] App.tsx:844-858 - Remove hardcoded handleTeacherSignIn()
- [ ] api/credits/purchase.ts:72 - Add auth to purchase endpoint
- [ ] api/credits/custom-purchase.ts:57 - Add auth to custom purchase

#### Other Issues
- 34 files with debug code (console.log, alert, console.error)
- Sandbox PayFast credentials (not live)
- No production .env configured

### What's Working
- PayFast integration (sandbox mode)
- Apple Pay / Google Pay support
- AI service (Gemini + OpenRouter)
- Supabase connection
- Build scripts

### Unique Files in NEW-CODE
- ChatWidget.tsx
- SignInScreen.tsx
- TeacherApp.tsx
- Toast.tsx
- ai.ts
- custom-purchase.ts
- db-supabase.ts
- payfast.ts
- purchase.ts
- seed-essential-data.ts

### Dev Login
Not configured. To enable, add to .env:
VITE_TEST_USER_EMAIL=test@example.com
VITE_TEST_USER_NAME=Test User
