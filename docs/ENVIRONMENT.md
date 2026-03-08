# Environment Variables Guide

_Last updated: March 6, 2026 at 8:48 AM (SAST)_

This guide documents all environment variables used in the TFMD Booking App.

## Configuration File

Create a `.env` file in the project root (or `.env.local` for local development). Never commit this file to version control.

```bash
cp .env.example .env
```

## Required Variables

### Supabase Configuration

These are required for authentication to work.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |

**How to get these:**

1. Go to [Supabase](https://supabase.com) and create a project
2. Navigate to **Settings** → **API**
3. Copy the **Project URL** (use the `https://*.supabase.co` URL)
4. Copy the **anon public** key

**Example:**
```
VITE_SUPABASE_URL=https://abc123.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Optional Variables

### Google OAuth

Enables Google Calendar integration for admins.

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | No | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth Client Secret |
| `APP_URL` | No | Production app URL (for OAuth redirects) |

**How to get these:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Add your origins:
   - `http://localhost:5173` (development)
   - `https://your-domain.com` (production)
7. Copy the **Client ID** and **Client Secret**

**Example:**
```
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwx
APP_URL=https://your-domain.com
```

---

### AI Services

Powers AI template generation and chatbot features.

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | No* | Google Gemini API key (primary) |
| `OPENROUTER_API_KEY` | No* | OpenRouter API key (fallback) |

*At least one AI provider is recommended for full functionality.

**How to get GEMINI_API_KEY:**

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **Create API Key**
3. Copy the generated key

**How to get OPENROUTER_API_KEY:**

1. Go to [OpenRouter](https://openrouter.ai/)
2. Sign up and navigate to **Settings** → **API Keys**
3. Create a new key

**Behavior:**
- If both are configured, Gemini is used as primary
- If Gemini fails, OpenRouter automatically serves as fallback
- If neither is configured, a mock service is used

**Example:**
```
GEMINI_API_KEY=AIzaSy...
OPENROUTER_API_KEY=sk-or-v1-...
```

---

### Email Service

Powers transactional emails (confirmations, reminders, etc.).

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | No | Resend API key for sending emails |
| `EMAIL_SENDER_NAME` | No | Name displayed in "From" field |
| `EMAIL_SENDER_EMAIL` | No | Email address for sending |

**How to get RESEND_API_KEY:**

1. Go to [Resend](https://resend.com/)
2. Sign up and navigate to **API Keys**
3. Create a new key

**Behavior:**
- If not configured, emails are logged to console (mock mode)
- Configure sender identity in Resend dashboard for production

**Example:**
```
RESEND_API_KEY=re_123456789
EMAIL_SENDER_NAME=Pause Admin
EMAIL_SENDER_EMAIL=hello@pausefmd.co.za
```

---

### Redis (Email Queue)

Powers async email queue (optional - falls back to in-memory if not configured).

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | No | Redis connection URL |
| `REDISCLOUD_URL` | No | Redis Cloud URL (alternative) |

**Behavior:**
- If not configured, uses in-memory queue
- Recommended for production to handle high volume

**Example:**
```
REDIS_URL=redis://localhost:6379
REDISCLOUD_URL=redis://xxx:xxx@redis-cloud-url
```

---

### Supabase Backend (Advanced)

For server-side database operations.

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | No | Supabase project URL (backend) |
| `SUPABASE_SERVICE_KEY` | No | Supabase service role key |

**Note:** The frontend uses `VITE_` prefixed variables. Backend uses standard variables.

---

## Environment-Specific Configuration

### Development (`.env.local`)

```env
# Supabase
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-dev-client-id
GOOGLE_CLIENT_SECRET=your-dev-client-secret

# AI (optional)
GEMINI_API_KEY=your-gemini-key
OPENROUTER_API_KEY=your-openrouter-key

# Email (optional - logs to console)
RESEND_API_KEY=your-resend-key
```

### Production

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key

# Google OAuth
GOOGLE_CLIENT_ID=your-prod-client-id
GOOGLE_CLIENT_SECRET=your-prod-client-secret
APP_URL=https://your-domain.com

# AI
GEMINI_API_KEY=your-gemini-key

# Email
RESEND_API_KEY=your-resend-key
EMAIL_SENDER_NAME=Pause Admin
EMAIL_SENDER_EMAIL=hello@pausefmd.co.za
```

---

## Verifying Configuration

When the server starts, it validates environment variables and reports:

```
✅ Environment validated: 5/10 variables configured
```

Or warnings for missing optional variables:

```
⚠️  Environment Configuration Warnings:
  - GEMINI_API_KEY - optional, some features may be limited
```

---

## Troubleshooting

### "Missing Google Client ID or Secret"

Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in your environment.

### "AI service not configured"

At least one of `GEMINI_API_KEY` or `OPENROUTER_API_KEY` must be set.

### "Email service not configured"

Set `RESEND_API_KEY` to enable email sending. Without it, emails log to console.

### Rate Limiting

If you see rate limit errors:
- AI endpoints: 100 requests/hour
- General API: 200 requests/hour
- OAuth: 10 attempts/15 minutes

Wait and retry, or adjust limits in `server.ts`.
