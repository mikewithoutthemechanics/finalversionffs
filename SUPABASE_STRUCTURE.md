# Supabase Client Structure

> **Last Updated:** March 8, 2026  
> **Status:** Consolidated ✅

## Overview

The Supabase client layer has been consolidated from 5 files to 4 files. Legacy `supabase-db.ts` has been removed.

## File Structure

```
services/
├── supabase-client.ts      # Foundation client with retry logic
├── db-supabase.ts          # Main database service (1900+ lines)
└── supabase-types.ts       # TypeScript type definitions

lib/
└── supabase.ts             # Browser auth (magic links, OAuth)
```

## When to Use Each File

### 1. `lib/supabase.ts` - Browser Auth Only
**Use for:** Authentication operations in the browser

```typescript
import { signInWithMagicLink, signInWithGoogle, signOut } from './lib/supabase';

// Magic link sign-in
await signInWithMagicLink(email);

// OAuth sign-in
await signInWithGoogle();

// Check if Supabase is configured
const isConfigured = isSupabaseConfigured();
```

**Exports:**
- `supabase` - Browser Supabase client
- `signInWithMagicLink()` - Email magic link auth
- `signInWithGoogle()` - Google OAuth
- `signInWithFacebook()` - Facebook OAuth
- `signInWithApple()` - Apple OAuth
- `signOut()` - Sign out
- `getCurrentUser()` - Get current user
- `onAuthStateChange()` - Auth state listener
- `isSupabaseConfigured()` - Check config status
- `exchangeCodeForSession()` - PKCE code exchange

---

### 2. `services/supabase-client.ts` - Foundation Client
**Use for:** Creating Supabase clients with proper configuration

```typescript
import { supabase, withRetry, testConnection } from './services/supabase-client';

// Direct Supabase client (with retry logic built-in)
const { data, error } = await supabase
  .from('users')
  .select('*');

// Test connection
const isConnected = await testConnection();
```

**Features:**
- Connection pooling for Vercel serverless
- Automatic retry logic
- Error handling
- Works in both browser and Node.js

**Exports:**
- `supabase` - Universal Supabase client
- `withRetry()` - Retry wrapper
- `testConnection()` - Connection test
- `isConfigured` - Configuration status

---

### 3. `services/db-supabase.ts` - Main Database Service
**Use for:** All database CRUD operations

```typescript
import { db } from './services/db-supabase';

// Users
const users = await db.getUsers();
const user = await db.getUserById(id);

// Classes
const classes = await db.getClasses();
const classData = await db.getClassById(id);

// Bookings/Registrations
await db.registerForClass(userId, classId);
await db.cancelRegistration(registrationId);

// Settings
const settings = await db.getSettings();
await db.updateSettings(settings);

// Calendar
await db.saveCalendarTokens(tokens);
await db.syncClassToCalendar(classData, settings);
```

**This is the main file you import from 99% of the time.**

**Exports:**
- `db` - Main database service object with all CRUD methods
- `isSupabaseError()` - Type guard
- `isNotFoundError()` - Type guard
- `isTableNotFoundError()` - Type guard
- Type guards: `isString()`, `isNumber()`, `isBoolean()`

---

### 4. `services/supabase-types.ts` - Type Definitions
**Use for:** TypeScript types when needed

```typescript
import type { Database, Tables, Enums } from './services/supabase-types';
```

**Exports:**
- `Database` - Full database schema type
- `Tables` - Table-specific types
- `Enums` - Database enum types
- `SupabaseError` - Error type

---

## Quick Reference

| Task | Import From |
|------|-------------|
| Sign in with magic link | `lib/supabase` |
| Sign in with Google | `lib/supabase` |
| Get current user | `lib/supabase` |
| Query database | `services/db-supabase` |
| Update user | `services/db-supabase` |
| Book a class | `services/db-supabase` |
| Get settings | `services/db-supabase` |
| Sync calendar | `services/db-supabase` |
| Direct Supabase client | `services/supabase-client` |
| Type definitions | `services/supabase-types` |

---

## What Was Removed

### `services/supabase-db.ts` (Legacy)
- **Status:** ❌ Deleted (March 8, 2026)
- **Reason:** Redundant - all functionality already in `db-supabase.ts`
- **Contents:** Manual REST API calls using `fetch()` instead of Supabase SDK
- **Impact:** None - no files were importing it

---

## Future Refactoring

The `db-supabase.ts` file (1900+ lines) could be split into domain modules:

```
services/supabase/
├── client.ts          # Re-export from supabase-client.ts
├── types.ts           # Re-export from supabase-types.ts
├── auth.ts            # Auth helpers (from lib/supabase.ts)
├── users.ts           # User CRUD
├── classes.ts         # Class CRUD
├── bookings.ts        # Booking/registration CRUD
├── payments.ts        # Credits/payments
├── calendar.ts        # Google Calendar sync
├── settings.ts        # App settings
└── index.ts           # Barrel export as `db`
```

**Status:** Not urgent - current structure works fine. Consider when adding comprehensive tests.

---

## Migration Notes

If you were using `services/supabase-db.ts` (unlikely - it wasn't imported anywhere):

**Before:**
```typescript
import { settingsService, calendarService } from './services/supabase-db';
```

**After:**
```typescript
import { db } from './services/db-supabase';

// Use db.settingsService or db.calendarService
const settings = await db.getSettings();
```

---

*Document maintained by development team. Update when structure changes.*
