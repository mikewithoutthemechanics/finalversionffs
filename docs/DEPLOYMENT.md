# Deployment Guide

_Last updated: March 6, 2026 at 8:50 AM (SAST)_

This guide covers deploying the TFMD Booking App to production using Vercel.

## Prerequisites

- Vercel account
- Supabase project (production)
- Domain (optional, for custom domain)

## Environment Setup

### 1. Supabase Production Setup

1. Create a production Supabase project at [supabase.com](https://supabase.com)
2. Run the database schema:
   ```bash
   # Connect to your production database and run:
   psql -h db.YOUR_PROJECT.ref.supabase.co -U postgres -f supabase/schema.sql
   ```
3. Apply security migrations:
   ```bash
   psql -h db.YOUR_PROJECT.ref.supabase.co -U postgres -f supabase/security-fixes-migration.sql
   ```

### 2. Configure Environment Variables

Create `.env.production` with:

```env
# Required
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key

# App
APP_URL=https://yourdomain.com

# Google OAuth (for calendar integration)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Email (Resend)
RESEND_API_KEY=re_xxxxx

# AI (optional)
GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key  # Fallback AI

# Redis (optional - for email queue)
REDIS_URL=redis://localhost:6379

# Admin
ADMIN_EMAIL=admin@pausefmd.co.za

# PayFast (South African payments)
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_PASSPHRASE=your_passphrase
PAYFAST_MODE=live
PAYFAST_RETURN_URL=https://yourdomain.com
PAYFAST_CANCEL_URL=https://yourdomain.com
PAYFAST_NOTIFY_URL=https://yourdomain.com/api/payfast/notify
```

### 3. Vercel Deployment

#### Option A: CLI Deployment

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

#### Option B: Git Integration

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

### 4. Environment Variables in Vercel

In Vercel dashboard, go to Settings → Environment Variables and add:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | From Supabase settings |
| `VITE_SUPABASE_ANON_KEY` | From Supabase API settings |
| `SUPABASE_SERVICE_KEY` | From Supabase (service_role) |
| `APP_URL` | Your production URL |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `RESEND_API_KEY` | From Resend dashboard |
| `GEMINI_API_KEY` | From Google AI Studio |
| `OPENROUTER_API_KEY` | From OpenRouter (optional) |
| `REDIS_URL` | Redis connection (optional) |
| `ADMIN_EMAIL` | Admin notification email |
| `PAYFAST_MERCHANT_ID` | From PayFast merchant account |
| `PAYFAST_MERCHANT_KEY` | From PayFast merchant account |
| `PAYFAST_PASSPHRASE` | Your PayFast passphrase |
| `PAYFAST_MODE` | `live` |

## Post-Deployment Checklist

### 1. Supabase Configuration

- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Configure authentication providers (Google, Email)
- [ ] Set up auth redirect URLs in Supabase

### 2. Google OAuth

- [ ] Add production URL to Google OAuth authorized redirect URIs:
  ```
  https://yourdomain.com/api/auth/google/callback
  ```
- [ ] Add to authorized JavaScript origins:
  ```
  https://yourdomain.com
  ```

### 3. PayFast Configuration

- [ ] Log in to PayFast merchant account
- [ ] Set notification URL (ITN):
  ```
  https://yourdomain.com/api/payfast/notify
  ```
- [ ] Set return/cancel URLs

### 4. Email Deliverability

- [ ] Verify sender domain in Resend
- [ ] Check email deliverability settings
- [ ] Test booking confirmation emails

### 5. Security

- [ ] Enable production mode in Supabase
- [ ] Restrict API keys (use anon key for client)
- [ ] Enable RLS policies
- [ ] Test rate limiting

### 6. Performance

- [ ] Test page load times
- [ ] Verify lazy loading works
- [ ] Check CDN caching

## Troubleshooting

### Build Failures

If the build fails:
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Environment Variable Issues

Ensure all required variables are set in Vercel:
- Check Settings → Environment Variables
- Redeploy after adding new variables

### Database Connection

If database queries fail:
1. Check Supabase project status
2. Verify connection string
3. Ensure RLS policies are configured

### Payment Issues

If PayFast payments fail:
1. Check merchant ID and key
2. Verify mode (sandbox vs live)
3. Check notification URL is accessible

## Monitoring

### Vercel Analytics
Enable in Vercel dashboard for performance monitoring.

### Supabase Logs
Check in Supabase dashboard under → Logs.

### Application Logs
Check Vercel dashboard → Functions → Logs.

## Rollback

If you need to rollback:
```bash
# List deployments
vercel list

# Rollback to previous
vercel rollback [deployment-url]
```

## Support

For issues:
1. Check Vercel status: vercel status
2. Check Supabase status: status.supabase.com
3. Review application logs in Vercel dashboard
