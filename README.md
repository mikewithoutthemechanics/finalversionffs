<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TFMD Booking App

_Last updated: March 6, 2026 at 8:52 AM (SAST)_

A full-stack React + TypeScript booking application for "Pause - The Fascia Movement Dome", a premium fascia movement studio. Features class booking, CRM, AI-powered marketing, and comprehensive feedback systems.

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Framer Motion** - Animations
- **Supabase** - Authentication and database

### Backend
- **Express** - API server
- **Node.js** - Runtime

### Integrations
- **Google OAuth** - Calendar integration
- **Resend** - Transactional email service
- **Google Gemini** - AI template generation (primary)
- **OpenRouter** - AI fallback (Claude 3 Haiku)

## Features

### Core Booking
- Class scheduling and management
- Venue management
- Registration and waitlist
- Payment tracking
- Credit-based booking system

### Authentication & Security
- Google OAuth integration
- Supabase authentication
- CSRF protection
- Rate limiting
- Helmet security headers

### AI Services
- AI-generated marketing templates
- AI chatbot for customer support
- Automatic provider fallback

### Email System
- Booking confirmations
- Class reminders
- Waitlist notifications
- Payment verification
- Cancellation confirmations
- Welcome emails

### Feedback System
- Post-class feedback
- NPS scoring
- Rating system
- Analytics and statistics

### CRM
- Client management
- Contact tracking
- Activity logging
- Task management
- Package/membership tracking

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Cloud account (for OAuth)
- Supabase account
- Resend account (for emails)
- Google Gemini API key (optional, for AI)
- OpenRouter API key (optional, for AI fallback)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd TFMD-BOOKING-APP
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables (see [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md))

5. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

## Project Structure

```
TFMD-BOOKING-APP/
├── api/                    # API route handlers
│   ├── credits/          # Credit purchase endpoints
│   └── payfast/         # PayFast webhook handler
├── components/           # React components
│   ├── ui/              # UI primitives
│   └── *.tsx            # Feature components
├── docs/                 # Documentation
│   ├── API-VERIFIED.md  # API endpoints (verified)
│   ├── ENVIRONMENT.md   # Environment variables
│   ├── SECURITY.md      # Security audit
│   ├── DATABASE.md     # Database schema
│   ├── CREDITS.md       # Credit system
│   ├── DEPLOYMENT.md    # Deployment guide
│   └── PAYMENTS.md      # PayFast integration
├── lib/                  # Libraries and utilities
├── public/               # Static assets
├── screens/              # Screen components
├── services/             # Backend services
│   ├── ai.ts            # AI service
│   ├── db-supabase.ts   # Database service
│   ├── email.ts         # Email service
│   └── payfast.ts       # PayFast service
├── supabase/            # Database schema
├── server.ts            # Express API server
├── App.tsx              # Main app component
├── types.ts             # TypeScript types
└── package.json         # dependencies
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/csrf-token` | GET | Get CSRF token |
| `/api/auth/google/url` | GET | Get Google OAuth URL |
| `/api/auth/google/callback` | GET | OAuth callback |
| `/api/ai/generate-template` | POST | Generate marketing template |
| `/api/ai/chat` | POST | AI chatbot |
| `/api/ai/status` | GET | AI service status |
| `/api/email/status` | GET | Email service status |
| `/api/feedback` | GET, POST | Feedback CRUD |
| `/api/feedback/stats` | GET | Feedback statistics |

See [docs/API-VERIFIED.md](docs/API-VERIFIED.md) for detailed API documentation.

## Environment Variables

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for complete setup instructions.

### Required Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `APP_URL` | Production app URL |
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_SENDER_NAME` | Email sender name |
| `EMAIL_SENDER_EMAIL` | Email sender address |

## Security

This application has been audited and includes:
- OAuth token security (server-side storage)
- CSRF protection
- Rate limiting
- Helmet security headers
- Origin validation

See [docs/SECURITY.md](docs/SECURITY.md) for detailed security documentation.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## License

MIT
