# SQL Injection Test Plan & Results

**Target:** https://tfmd-staging.vercel.app  
**Date:** March 6, 2026  
**Status:** ⚠️ Environment timeout - Test plan created for manual execution

---

## 🎯 Test Objectives

Verify that the TFMD Booking App is protected against SQL injection attacks on all API endpoints.

---

## 🔍 Endpoints to Test

### 1. Health & Status Endpoints (Safe)
| Endpoint | Method | Expected Result |
|----------|--------|-----------------|
| `/api/health` | GET | `{"status":"ok"}` |
| `/api/csrf-token` | GET | `{"csrfToken":"..."}` |
| `/api/auth/google/url` | GET | `{"url":"https://accounts.google.com/..."}` |

### 2. State-Changing Endpoints (CSRF Protected)
| Endpoint | Method | Protection | Test Priority |
|----------|--------|------------|---------------|
| `/api/feedback` | POST | CSRF Required | 🔴 HIGH |
| `/api/registration/cancel` | POST | CSRF Required | 🔴 HIGH |
| `/api/credits/purchase` | POST | CSRF Required | 🔴 HIGH |
| `/api/payfast/notify` | POST | Signature + Idempotency | 🔴 HIGH |

---

## 🧪 Test Cases

### TEST 1: Basic SQL Injection Detection

#### 1.1 Single Quote Test
```bash
curl -X GET "https://tfmd-staging.vercel.app/api/health'"
```
**Expected:** 404 or 400 error (no SQL error message)

#### 1.2 Boolean OR Test
```bash
curl -X GET "https://tfmd-staging.vercel.app/api/health?test=' OR '1'='1"
```
**Expected:** Normal response, no data leakage

#### 1.3 Comment Test
```bash
curl -X GET "https://tfmd-staging.vercel.app/api/health?test='--"
```
**Expected:** Normal response, comment ignored

### TEST 2: CSRF Protection Verification

#### 2.1 POST Without CSRF Token
```bash
curl -X POST "https://tfmd-staging.vercel.app/api/feedback" \
  -H "Content-Type: application/json" \
  -d '{"rating":5,"comment":"test"}'
```
**Expected:** `{"error":"Invalid or expired CSRF token"}` (403)

#### 2.2 POST With Valid CSRF Token
```bash
# First get token
CSRF=$(curl -s "https://tfmd-staging.vercel.app/api/csrf-token" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

# Then use it
curl -X POST "https://tfmd-staging.vercel.app/api/feedback" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"rating":5,"comment":"test"}'
```
**Expected:** 200 OK or validation error (not CSRF error)

### TEST 3: Payment Webhook SQL Injection

#### 3.1 SQLi in Payment ID
```bash
curl -X POST "https://tfmd-staging.vercel.app/api/payfast/notify" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "payment_status=COMPLETE" \
  -d "m_payment_id=1' OR '1'='1" \
  -d "amount=100"
```
**Expected:** 400 Bad Request (invalid payment ID format)

#### 3.2 SQLi in User ID
```bash
curl -X POST "https://tfmd-staging.vercel.app/api/payfast/notify" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "payment_status=COMPLETE" \
  -d "m_payment_id=TEST-123" \
  -d "user_id='; DROP TABLE users;--"
```
**Expected:** 400 Bad Request or signature validation failure

### TEST 4: Union-Based Extraction Attempt

#### 4.1 Test Search Parameter
```bash
curl -X GET "https://tfmd-staging.vercel.app/api/classes/search?q=' UNION SELECT username,password FROM users--"
```
**Expected:** Empty results or sanitized search term

### TEST 5: Time-Based Blind SQLi

#### 5.1 Delay Test
```bash
curl -X GET "https://tfmd-staging.vercel.app/api/health?test=' AND SLEEP(5)--"
```
**Expected:** Immediate response (no delay), no SQL execution

### TEST 6: Error-Based Extraction

#### 6.1 Cast Error Test
```bash
curl -X GET "https://tfmd-staging.vercel.app/api/health?test=' AND 1=CAST((SELECT version()) AS int)--"
```
**Expected:** Generic error message (no database version leaked)

---

## 🛡️ Security Controls Verification

### Control 1: Parameterized Queries
**Location:** `services/db-supabase.ts`  
**Expected:** All queries use `.eq()`, `.in()`, etc. (Supabase ORM)  
**Status:** ✅ Implemented

### Control 2: Input Validation
**Location:** `middleware/validation.ts`  
**Expected:** UUID validation, email regex, safe string checks  
**Status:** ✅ Implemented

### Control 3: CSRF Tokens
**Location:** `middleware/csrf.ts`  
**Expected:** All POST/PUT/DELETE require valid token  
**Status:** ✅ Implemented

### Control 4: Rate Limiting
**Location:** `server.ts`  
**Expected:** 200 req/hour general, 100 req/hour AI, 10 req/15min OAuth  
**Status:** ✅ Implemented

### Control 5: Error Handling
**Expected:** No SQL error messages exposed to client  
**Status:** ✅ Implemented (generic error messages)

---

## 📝 Expected Results Summary

| Test | Expected Result | Risk if Failed |
|------|-----------------|----------------|
| SQLi payloads | Rejected/sanitized | 🔴 Critical |
| CSRF bypass | 403 Forbidden | 🔴 Critical |
| Error messages | Generic only | 🟡 Medium |
| Data leakage | None | 🔴 Critical |
| Auth bypass | Not possible | 🔴 Critical |

---

## 🔧 Manual Testing Commands (PowerShell)

```powershell
# Test 1: Health endpoint
Invoke-WebRequest -Uri "https://tfmd-staging.vercel.app/api/health" -TimeoutSec 10

# Test 2: CSRF token endpoint
$csrfResp = Invoke-WebRequest -Uri "https://tfmd-staging.vercel.app/api/csrf-token" -TimeoutSec 10
$csrfToken = ($csrfResp.Content | ConvertFrom-Json).csrfToken
Write-Host "CSRF Token: $csrfToken"

# Test 3: POST without CSRF (should fail)
try {
    Invoke-WebRequest -Uri "https://tfmd-staging.vercel.app/api/feedback" -Method POST -ContentType "application/json" -Body '{"rating":5}' -TimeoutSec 10
} catch {
    Write-Host "Expected 403 error: $($_.Exception.Response.StatusCode)"
}

# Test 4: POST with CSRF (should succeed or give validation error, not CSRF error)
try {
    Invoke-WebRequest -Uri "https://tfmd-staging.vercel.app/api/feedback" -Method POST -Headers @{"X-CSRF-Token"=$csrfToken} -ContentType "application/json" -Body '{"rating":5}' -TimeoutSec 10
} catch {
    Write-Host "Response: $($_.Exception.Response.StatusCode)"
}
```

---

## 🚨 Critical Vulnerabilities to Check

### HIGH PRIORITY
1. **Direct SQL in API routes** - Check for raw `.query()` calls
2. **String concatenation** - Search for `+` or template literals in SQL
3. **Dynamic table names** - Verify no user input in table/column names
4. **LIKE clauses** - Check for wildcards (`%`, `_`) handling

### MEDIUM PRIORITY
5. **Error messages** - Ensure SQL errors not exposed
6. **Logging** - Verify no sensitive data in logs
7. **ORM bypass** - Check for raw query methods

---

## ✅ Verification Checklist

- [ ] All endpoints respond without SQL errors
- [ ] CSRF protection active on state-changing endpoints
- [ ] No database version or structure leaked
- [ ] Input validation rejects malicious payloads
- [ ] Rate limiting prevents brute force
- [ ] Error messages are generic
- [ ] No data extraction via UNION possible
- [ ] Time-based blind SQLi not effective

---

## 🎯 Summary

The TFMD Booking App has been designed with security in mind:
- ✅ Uses Supabase ORM (parameterized queries)
- ✅ CSRF protection on all state-changing endpoints
- ✅ Input validation middleware
- ✅ Rate limiting
- ✅ Generic error messages

**Current Status:** Environment timeout during testing. Manual verification required.  
**Risk Level:** LOW (based on code review)  
**Recommendation:** Run manual tests when environment is accessible, or review code audit report.

---

*Generated: March 6, 2026*  
*Next Review: After manual test execution*
