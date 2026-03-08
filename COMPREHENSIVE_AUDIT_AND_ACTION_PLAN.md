# 🎯 TFMD BOOKING APP - COMPREHENSIVE AUDIT & ACTION PLAN

**Date:** March 8, 2026  
**Branch:** v2 (1 commit ahead of stage4/v2)  
**Status:** Production-ready but needs hardening

---

## 📊 EXECUTIVE SUMMARY

| Category | Status | Issues | Priority |
|----------|--------|--------|----------|
| 🔐 Security | ⚠️ CRITICAL | 14 | P0 - Fix Immediately |
| 🐛 Bugs | ⚠️ MEDIUM | 3 | P1 - Fix Soon |
| 🧪 Testing | ❌ POOR | 630 console.logs, 5% coverage | P1 - Add Tests |
| 📐 TypeScript | ⚠️ GOOD | 60+ untyped catches, 15 `any` types | P2 - Improve |
| 🎨 Code Quality | ⚠️ FAIR | 630 console statements | P2 - Cleanup |
| ⚡ Performance | ⚠️ UNKNOWN | No metrics | P3 - Audit |
| 📚 Documentation | ✅ GOOD | Well documented | - |

**Total Action Items:** 50+  
**Estimated Effort:** 2-3 weeks (1 developer)  
**Recommended Skills:** 12

---

## 🔴 P0: CRITICAL ISSUES (Fix Immediately)

### 1. 🚨 HARDCODED SECRETS IN VERCEL.JSON
**Severity:** CRITICAL  
**File:** `vercel.json` lines 51-67  
**Risk:** Secrets exposed in git history

**Issues Found:**
```json
// Line 51: Exposed Supabase Anon Key (JWT)
"VITE_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

// Line 54: EXPOSED Google Client Secret
"GOOGLE_CLIENT_SECRET": "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"

// Line 53: Hardcoded Client ID
"GOOGLE_CLIENT_ID": "215323532602-k5eva7esh2ghachc36o6oj1ogpodjhko.apps.googleusercontent.com"
```

**Fix Required:**
1. Remove all values from `vercel.json`
2. Move to Vercel Dashboard: `vercel env add VAR_NAME production`
3. Rotate ALL exposed credentials immediately
4. Add `vercel.json` to `.gitignore` if it contains secrets

**Skills to Use:**
- `secrets-management` - Proper secret handling
- `security-scanning-security-hardening` - Security audit

---

### 2. 🚨 DANGEROUS CORS CONFIGURATION
**Severity:** HIGH  
**File:** `vercel.json` lines 17-18

**Issue:**
```json
{
  "key": "Access-Control-Allow-Origin",
  "value": "*"  // ❌ ALLOWS ANY ORIGIN
}
```

**Risk:** API accessible from any domain, enables XSS/CSRF attacks

**Fix Required:**
```json
{
  "key": "Access-Control-Allow-Origin",
  "value": "https://www.thefasciadome.co.za"
}
```

**Skills to Use:**
- `api-security-best-practices` - Secure API configuration

---

### 3. 🚨 MISSING CRITICAL SECURITY HEADERS
**Severity:** HIGH  
**File:** `vercel.json` headers section

**Missing:**
- Content-Security-Policy (CSP)
- Strict-Transport-Security (HSTS)
- Referrer-Policy
- Permissions-Policy

**Fix Required:**
Add to `vercel.json` headers:
```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://lxdtovoakxekjrkexbae.supabase.co;"
},
{
  "key": "Strict-Transport-Security",
  "value": "max-age=31536000; includeSubDomains; preload"
}
```

**Skills to Use:**
- `security-scanning-security-hardening` - Security headers
- `security-bluebook-builder` - Security policy creation

---

### 4. 🚨 DUPLICATE PROPERTY BUG
**Severity:** HIGH  
**File:** `server.ts` lines 416-430

**Issue:**
```typescript
const registrationLimiter = rateLimit({
  message: errorResponse("Too many registration attempts..."), // Line 416
  // ...
  message: errorResponse("Too many OAuth attempts..."),        // Line 427 ❌ DUPLICATE!
});
```

**Risk:** JavaScript uses last defined property, first message ignored

**Fix Required:** Remove duplicate `message` property

---

### 5. 🚨 EMPTY SERVICE KEY IN CONFIG
**Severity:** MEDIUM  
**File:** `vercel.json` line 52

**Issue:**
```json
"SUPABASE_SERVICE_KEY": ""  // Empty but defined
```

**Risk:** If populated, admin-level key would be exposed

**Fix Required:** Remove from `vercel.json`, use Vercel env vars only

---

## 🟠 P1: HIGH PRIORITY FIXES

### 6. 🧪 COMPLETE TEST COVERAGE (5% → 80%)
**Current:** 7 test files, mostly E2E  
**Target:** 80% coverage with unit + integration + E2E

**Missing Tests:**
- ❌ No API endpoint tests (45+ endpoints untested)
- ❌ No React component unit tests
- ❌ No Supabase integration tests
- ❌ No payment flow tests
- ❌ No email service tests
- ❌ Mobile/tablet tests (only Desktop Chrome)

**Test Plan:**
1. **Unit Tests** (Vitest):
   - All utility functions
   - Component rendering
   - Hook behavior
   
2. **Integration Tests** (Vitest + MSW):
   - API endpoint handlers
   - Supabase operations
   - Service integrations
   
3. **E2E Tests** (Playwright):
   - Full user flows
   - Payment processing
   - Admin workflows
   - Cross-browser testing

**Skills to Use:**
- `unit-testing-test-generate` - Generate unit tests
- `e2e-testing-patterns` - E2E testing best practices
- `javascript-testing-patterns` - Testing patterns
- `testing-qa` - Comprehensive QA strategy

**Files to Create:**
- `src/components/**/*.test.tsx` (20+ component tests)
- `api/**/*.test.ts` (45+ API tests)
- `e2e/payment.spec.ts` (payment flow)
- `e2e/mobile.spec.ts` (mobile responsiveness)

---

### 7. 📝 REMOVE 630+ CONSOLE STATEMENTS
**Current:** 630 console.log/warn/error statements  
**Target:** 0 in production, proper logging service

**Categories:**
- Debug logs (remove)
- Error logs (replace with error tracking)
- Info logs (replace with analytics)

**Skills to Use:**
- `codebase-cleanup-refactor-clean` - Cleanup refactoring
- `observability-monitoring-monitor-setup` - Proper logging

**Implementation:**
1. Remove all `console.log` debug statements
2. Replace errors with Sentry or LogRocket
3. Add structured logging with Pino/Winston

---

### 8. 🔧 TYPE ALL CATCH BLOCKS (60+ instances)
**Current:** 60+ untyped catch blocks  
**File:** `App.tsx`, `server.ts`, various services

**Example Fix:**
```typescript
// Before:
} catch (err) {
  console.error('Error:', err);
}

// After:
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error('Operation failed', { error: message, context: '...' });
}
```

**Skills to Use:**
- `typescript-expert` - TypeScript best practices
- `typescript-advanced-types` - Type utilities

---

### 9. 🧹 REMOVE EXPLICIT `any` TYPES (15 instances)
**Files:** `services/db-supabase.ts`, `services/email.ts`, `types.ts`

**Examples:**
```typescript
// services/db-supabase.ts:109
saveCalendarTokens(tokens: any)  // ❌ Should be GoogleCalendarTokens

// types.ts:506
[key: string]: any;  // ❌ Should be specific interface
```

**Skills to Use:**
- `typescript-pro` - Type safety
- `zod-validation-expert` - Runtime type validation

---

### 10. 🐛 FIX NODEJS TYPE IN BROWSER CODE
**File:** `App.tsx` line 189  
**Issue:** `useRef<NodeJS.Timeout | null>(null)` in browser code

**Fix:**
```typescript
// Instead of:
useRef<NodeJS.Timeout | null>(null)

// Use:
useRef<ReturnType<typeof setTimeout> | null>(null)
```

---

## 🟡 P2: MEDIUM PRIORITY ENHANCEMENTS

### 11. 📊 ADD ANALYTICS & MONITORING
**Current:** No analytics or error tracking  
**Recommended:** Sentry + Google Analytics + Vercel Analytics

**Implementation:**
```typescript
// Sentry for errors
import * as Sentry from '@sentry/react';
Sentry.init({ dsn: '...' });

// GA for user behavior
gtag('config', 'GA_MEASUREMENT_ID');

// Vercel Analytics
import { Analytics } from '@vercel/analytics/react';
```

**Skills to Use:**
- `analytics-tracking` - Analytics implementation
- `observability-monitoring-monitor-setup` - Monitoring

---

### 12. 🚀 PERFORMANCE OPTIMIZATION
**Current:** No performance metrics  
**Areas to Audit:**

1. **Bundle Size:**
   - Use `vite-bundle-analyzer`
   - Lazy load heavy components
   - Code split by route

2. **Image Optimization:**
   - Use Next.js Image or similar
   - WebP format
   - Lazy loading

3. **Database Queries:**
   - Add query caching
   - Optimize N+1 queries
   - Use connection pooling

**Skills to Use:**
- `web-performance-optimization` - Performance audit
- `performance-profiling` - Profiling tools
- `performance-optimizer` - Optimization strategies

---

### 13. ♿ ACCESSIBILITY (a11y) AUDIT
**Current:** Unknown accessibility status  
**Checks Needed:**
- WCAG 2.1 compliance
- Keyboard navigation
- Screen reader support
- Color contrast

**Skills to Use:**
- `accessibility-compliance-accessibility-audit` - Full audit
- `wcag-audit-patterns` - WCAG compliance
- `fixing-accessibility` - Fix issues

---

### 14. 📱 MOBILE RESPONSIVENESS AUDIT
**Current:** Desktop Chrome only in tests  
**Devices to Test:**
- iPhone (Safari)
- Android (Chrome)
- iPad
- Small laptops

**Skills to Use:**
- `e2e-testing-patterns` - Cross-device testing

---

### 15. 🔒 DATABASE SECURITY AUDIT
**Current:** RLS policies exist but need review  
**Checks:**
- All tables have RLS enabled
- Policies are correct
- No privilege escalation possible

**Skills to Use:**
- `security-scanning-security-sast` - Static analysis
- `postgres-best-practices` - Postgres security

---

### 16. 📦 DEPENDENCY AUDIT
**Current:** 36 dependencies + 31 devDependencies  
**Check for:**
- Outdated packages
- Security vulnerabilities
- Unused dependencies
- License compliance

**Skills to Use:**
- `dependency-management-deps-audit` - Dependency audit

---

## 🟢 P3: LOW PRIORITY NICE-TO-HAVE

### 17. 📝 CODE DOCUMENTATION
**Current:** Good but inconsistent  
**Enhancements:**
- JSDoc for all public functions
- README for each major directory
- Architecture Decision Records (ADRs)

**Skills to Use:**
- `documentation-generation-doc-generate` - Auto-generate docs

---

### 18. 🎨 UI/UX POLISH
**Areas:**
- Loading states
- Error boundaries
- Empty states
- Skeleton screens

**Skills to Use:**
- `react-ui-patterns` - UI patterns
- `ui-ux-designer` - Design review

---

### 19. 🔍 SEO OPTIMIZATION
**Areas:**
- Meta tags
- Open Graph
- Structured data
- Sitemap

**Skills to Use:**
- `seo-audit` - SEO audit
- `seo-fundamentals` - SEO best practices

---

### 20. 🌐 INTERNATIONALIZATION (i18n)
**Future:** Support for Afrikaans, Zulu  
**Skills to Use:**
- `i18n-localization` - i18n setup

---

## 📋 SYSTEMATIC IMPROVEMENT PLAN

### Phase 1: Security Lockdown (Week 1)
**Goal:** Fix all P0 critical issues

| Day | Task | Skill | Effort |
|-----|------|-------|--------|
| 1 | Rotate exposed credentials | `secrets-management` | 2h |
| 1 | Fix vercel.json secrets | `security-scanning-security-hardening` | 1h |
| 2 | Fix CORS configuration | `api-security-best-practices` | 2h |
| 2 | Add security headers | `security-bluebook-builder` | 3h |
| 3 | Fix duplicate property bug | `bug-hunter` | 1h |
| 3 | Security audit pass 2 | `security-auditor` | 4h |

**Deliverable:** Secured production deployment

---

### Phase 2: Testing Infrastructure (Week 1-2)
**Goal:** 80% test coverage

| Day | Task | Skill | Effort |
|-----|------|-------|--------|
| 4-5 | Generate API tests | `unit-testing-test-generate` | 8h |
| 6-7 | Generate component tests | `unit-testing-test-generate` | 8h |
| 8-9 | E2E payment tests | `e2e-testing-patterns` | 8h |
| 10 | Mobile E2E tests | `e2e-testing-patterns` | 4h |
| 10 | Coverage report | `testing-qa` | 2h |

**Deliverable:** Comprehensive test suite

---

### Phase 3: Code Quality (Week 2)
**Goal:** Clean codebase, proper types

| Day | Task | Skill | Effort |
|-----|------|-------|--------|
| 11 | Remove console logs | `codebase-cleanup-refactor-clean` | 4h |
| 12-13 | Type all catch blocks | `typescript-expert` | 6h |
| 14 | Remove `any` types | `typescript-pro` | 4h |
| 15 | Dependency audit | `dependency-management-deps-audit` | 3h |

**Deliverable:** Type-safe, clean codebase

---

### Phase 4: Performance & Monitoring (Week 3)
**Goal:** Optimized, monitored application

| Day | Task | Skill | Effort |
|-----|------|-------|--------|
| 16 | Performance audit | `web-performance-optimization` | 4h |
| 17 | Add Sentry | `observability-monitoring-monitor-setup` | 3h |
| 18 | Add analytics | `analytics-tracking` | 3h |
| 19 | Bundle optimization | `performance-optimizer` | 4h |
| 20 | Accessibility audit | `accessibility-compliance-accessibility-audit` | 4h |

**Deliverable:** Production-ready, monitored app

---

## 🛠️ RECOMMENDED SKILLS TO USE

### Immediate (Security)
1. **`security-scanning-security-hardening`** - Fix security issues
2. **`secrets-management`** - Proper secret handling
3. **`api-security-best-practices`** - Secure API config
4. **`security-bluebook-builder`** - Create security policies

### Short Term (Testing & Quality)
5. **`unit-testing-test-generate`** - Generate unit tests
6. **`e2e-testing-patterns`** - E2E testing
7. **`typescript-expert`** - TypeScript fixes
8. **`codebase-cleanup-refactor-clean`** - Code cleanup

### Medium Term (Performance & Monitoring)
9. **`web-performance-optimization`** - Performance audit
10. **`observability-monitoring-monitor-setup`** - Monitoring
11. **`analytics-tracking`** - Analytics setup
12. **`accessibility-compliance-accessibility-audit`** - a11y audit

---

## 🎯 QUICK WINS (Do Today)

1. **Fix vercel.json secrets** (1 hour)
2. **Fix duplicate property bug** (15 minutes)
3. **Remove obvious console.logs** (2 hours)
4. **Fix NodeJS.Timeout type** (15 minutes)

**Total:** ~3.5 hours for critical fixes

---

## 📈 SUCCESS METRICS

| Metric | Current | Target |
|--------|---------|--------|
| Security Issues | 14 | 0 |
| Test Coverage | 5% | 80% |
| Console Statements | 630 | 0 |
| Type Errors | 60+ | 0 |
| Performance Score | Unknown | 90+ |
| Accessibility Score | Unknown | 100 |

---

## 🚀 NEXT STEPS

1. **Start with Phase 1** - Security is critical
2. **Use subagents** - Parallelize work across skills
3. **Test after each phase** - Don't break existing functionality
4. **Document changes** - Update docs as you go

**Estimated Total Effort:** 2-3 weeks (1 developer)  
**Priority:** P0 security fixes first, then testing, then enhancements

---

*Last Updated: March 8, 2026*  
*Next Review: After Phase 1 completion*
