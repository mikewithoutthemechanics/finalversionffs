# TFMD Booking App - Quick Reference

## 🌐 URLs

| Environment | URL |
|-------------|-----|
| **Production** | https://tfmdbooking.vercel.app |
| **Staging** | https://tfmd-staging.vercel.app |

---

## 🚀 One-Line Commands

### Deploy
```bash
vercel --prod     # Production
vercel            # Staging
```

### Test
```bash
npx playwright test e2e/critical-paths.spec.ts
```

### Logs
```bash
vercel logs tfmdbooking
```

### Database
```bash
supabase sql "SELECT * FROM users LIMIT 5"
```

---

## 🧪 SQL Injection Test (Tomorrow)

```powershell
# Quick test
Invoke-WebRequest -Uri "https://tfmd-staging.vercel.app/api/health"

# Full test suite
npx playwright test e2e/critical-paths.spec.ts
```

---

## 📱 File Cheat Sheet

| File | What's In It |
|------|--------------|
| `DEPLOYMENT-FINAL-REPORT.md` | Everything that was done tonight |
| `SQL-INJECTION-TEST-PLAN.md` | Security test procedures |
| `TOKENS-AND-PATS.md` | API keys and token reference |
| `QUICK-REFERENCE.md` | This file |

---

## ✅ Status: DEPLOYED & READY

**Sleep well!** 🛌
