# API Documentation (VERIFIED)

_Last updated: March 6, 2026 at 8:57 AM (SAST)_

This document describes all API endpoints available in the TFMD Booking App server.

## Base URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:3000/api` |
| Production | `https://api.pausefmd.co.za/api` |

> **Note:** The production URL may vary based on your deployment configuration.

## Rate Limiting

The API implements rate limiting to prevent abuse:

| Endpoint | Limit |
|----------|-------|
| General (`/api/*`) | 200 requests/hour |
| AI endpoints (`/api/ai/*`) | 100 requests/hour |
| OAuth endpoints (`/api/auth/*`) | 10 requests/15 minutes |

---

## Health & Status Endpoints

### GET /api/health

Health check endpoint to verify the server is running.

**Response:**
```json
{
  "status": "ok"
}
```

---

### GET /api/csrf-token

Returns a CSRF token for form submissions.

**Response:**
```json
{
  "csrfToken": "MTcwNjc0MTYwMC1yYW5kb21fMTIzNDU2Nzg5MA=="
}
```

---

### GET /api/client-ip

Returns the client's IP address.

**Response:**
```json
{
  "ip": "192.168.1.1"
}
```

---

### GET /api/email/status

Returns the email service configuration status.

**Response:**
```json
{
  "provider": "resend",
  "configured": true
}
```

`provider` can be `"resend"` or `"mock"` (if no API key is configured).

---

### GET /api/ai/status

Returns the AI service configuration status.

**Response:**
```json
{
  "provider": "gemini",
  "configured": true
}
```

`provider` can be `"gemini"` or `"openrouter"` (fallback), or `null` if neither is configured.

---

## Authentication Endpoints

### GET /api/auth/google/url

Generates a Google OAuth URL for calendar integration.

**Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=..."
}
```

**Errors:**
- `400` - Missing Google Client ID or Secret

---

### GET /api/auth/google/callback

OAuth callback handler. Exchanges authorization code for tokens.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Authorization code from Google |
| `origin` | string | (Optional) Origin to redirect back to |

**Returns:**
HTML page that sends a postMessage to the opener with the authentication result.

**Security:** Validates the origin against a whitelist of allowed origins before posting the message.

---

### GET /api/auth/tokens/:tokenId

Retrieves stored OAuth tokens by token ID.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenId` | string | Token ID starting with `token_` |

**Response:**
```json
{
  "tokens": {
    "access_token": "ya29.a0...",
    "refresh_token": "1//0g...",
    "expiry_date": 1706745600000
  }
}
```

**Errors:**
- `400` - Invalid token ID format
- `404` - Token not found or expired

---

## User Endpoints

### POST /api/user/sync

Synchronizes user data from Supabase Auth to the users table.

**Request Body:**
```json
{
  "userId": "uuid-of-user"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User's Supabase Auth ID |

**Response:**
```json
{
  "success": true,
  "user": { ... }
}
```

---

## Registration Endpoints

### POST /api/registration/sync

Syncs a registration to the database.

**Request Body:**
```json
{
  "classId": "class-uuid",
  "userId": "user-uuid",
  "userName": "John Doe",
  "userEmail": "john@example.com",
  "userSport": "Running"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `classId` | string | Yes | Class ID |
| `userId` | string | Yes | User ID |
| `userName` | string | Yes | User's name |
| `userEmail` | string | No | User's email |
| `userSport` | string | No | User's sport |

**Response:**
```json
{
  "success": true,
  "registration": { ... }
}
```

---

### POST /api/registration/cancel

Cancels a class registration.

**Request Body:**
```json
{
  "registrationId": "reg-uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `registrationId` | string | Yes | Registration ID to cancel |

**Response:**
```json
{
  "success": true
}
```

---

## Teacher Endpoints

### POST /api/teacher/request

Submit a teacher registration request.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "name": "John Teacher",
  "email": "john@teacher.com",
  "phone": "+27821234567",
  "qualifications": "Fitness certification",
  "experience": "5 years",
  "specializations": ["Yoga", "Pilates"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User ID |
| `name` | string | Yes | Teacher name |
| `email` | string | Yes | Teacher email |
| `phone` | string | No | Phone number |
| `qualifications` | string | No | Qualifications |
| `experience` | string | No | Years of experience |
| `specializations` | string[] | No | Areas of expertise |

**Response:**
```json
{
  "success": true,
  "request": { ... }
}
```

---

### GET /api/teacher/pending

Get all pending teacher requests (admin only).

**Headers:** Requires Authorization header

**Response:**
```json
[
  {
    "id": "request-uuid",
    "user_id": "user-uuid",
    "name": "John Teacher",
    "email": "john@teacher.com",
    "status": "pending"
  }
]
```

---

### POST /api/teacher/approve

Approve a teacher request (admin only).

**Headers:** Requires Authorization header

**Request Body:**
```json
{
  "requestId": "request-uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | string | Yes | Teacher request ID |

**Response:**
```json
{
  "success": true
}
```

---

### POST /api/teacher/reject

Reject a teacher request (admin only).

**Headers:** Requires Authorization header

**Request Body:**
```json
{
  "requestId": "request-uuid",
  "reason": "Not qualified"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | string | Yes | Teacher request ID |
| `reason` | string | No | Rejection reason |

**Response:**
```json
{
  "success": true
}
```

---

### GET /api/teacher/status/:userId

Get teacher status for a user.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | User ID |

**Response:**
```json
{
  "isTeacher": true,
  "status": "approved"
}
```

---

### POST /api/teacher/status

Get teacher status (for client-side verification).

**Request Body:**
```json
{
  "userId": "user-uuid"
}
```

**Response:**
```json
{
  "isTeacher": true,
  "status": "approved"
}
```

---

## Admin Endpoints

### POST /api/admin/verify

Verify admin access.

**Request Body:**
```json
{
  "userId": "user-uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User ID to verify |

**Response:**
```json
{
  "success": true,
  "isAdmin": true,
  "adminRole": "super_admin"
}
```

---

### POST /api/admin/invite

Invite a new admin user (admin only).

**Headers:** Requires Authorization header

**Request Body:**
```json
{
  "email": "newadmin@example.com",
  "name": "New Admin",
  "role": "admin"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Admin email |
| `name` | string | Yes | Admin name |
| `role` | string | Yes | admin_role |

**Response:**
```json
{
  "success": true
}
```

---

## Email Endpoints

### GET /api/email/settings

Get email settings.

**Response:**
```json
{
  "senderName": "Pause Admin",
  "senderEmail": "hello@pausefmd.co.za",
  "templates": { ... }
}
```

---

### POST /api/email/settings

Update email settings (admin only).

**Request Body:**
```json
{
  "senderName": "Pause Admin",
  "senderEmail": "hello@pausefmd.co.za",
  "templates": { ... }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `senderName` | string | No | Sender display name |
| `senderEmail` | string | No | Sender email address |
| `templates` | object | No | Email templates |

**Response:**
```json
{
  "success": true,
  "settings": { ... }
}
```

---

### GET /api/email/queue/status

Get email queue status.

**Response:**
```json
{
  "queueLength": 5,
  "processing": true
}
```

---

### POST /api/email/queue/retry

Retry failed emails in queue.

**Request Body:**
```json
{
  "emailId": "email-uuid"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### POST /api/email/test

Send a test email.

**Request Body:**
```json
{
  "to": "test@example.com",
  "subject": "Test Email",
  "body": "This is a test"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### POST /api/email/booking-confirmation

Send booking confirmation email.

**Request Body:**
```json
{
  "userEmail": "user@example.com",
  "userName": "John",
  "className": "Dome Session",
  "classDate": "2024-03-15",
  "classTime": "10:00",
  "venue": "Rosebank"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### POST /api/email/class-reminder

Send class reminder email.

**Request Body:**
```json
{
  "userEmail": "user@example.com",
  "userName": "John",
  "className": "Dome Session",
  "classDate": "2024-03-15",
  "classTime": "10:00"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### POST /api/email/schedule-reminders

Schedule class reminder emails.

**Request Body:**
```json
{
  "classId": "class-uuid",
  "hoursBefore": 24
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Settings Endpoints

### GET /api/settings

Get application settings (public).

**Response:**
```json
{
  "settings": {
    "key": "value"
  }
}
```

---

### GET /api/public/classes

Get upcoming public classes (no auth required).

**Response:**
```json
[
  {
    "id": "class-uuid",
    "title": "Dome Session",
    "date": "2024-03-15",
    "startTime": "10:00",
    "duration": 75,
    "venueId": "venue-uuid",
    "spotsTotal": 15,
    "price": 250,
    "teacherId": "teacher-uuid"
  }
]
```

---

## Credit Endpoints

### GET /api/credits/packages

Get available credit packages.

**Response:**
```json
[
  {
    "id": "credits-1",
    "name": "Single Session",
    "credits": 1,
    "price": 150,
    "bonusCredits": 0,
    "isActive": true,
    "sortOrder": 1
  }
]
```

---

### POST /api/credits/purchase

Create PayFast payment link for credit purchase.

**Request Body:**
```json
{
  "packageId": "credits-5",
  "userId": "uuid-of-user",
  "email": "user@example.com",
  "name": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `packageId` | string | Yes | Credit package ID |
| `userId` | string | Yes | User UUID |
| `email` | string | Yes | User email |
| `name` | string | Yes | User name |

**Response:**
```json
{
  "paymentLink": "https://sandbox.payfast.co.za/eng/process?..."
}
```

---

## PayFast Endpoints

### POST /api/payfast/notify

PayFast ITN (Instant Transaction Notification) webhook handler.

Called by PayFast when payment completes.

**Request Body:**
```json
{
  "m_payment_id": "TFMD-1234567890-user-uuid",
  "pf_payment_id": "123456",
  "payment_status": "COMPLETE",
  "amount_gross": "350.00"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### GET /api/payfast/status

Get PayFast configuration status.

**Response:**
```json
{
  "configured": true,
  "mode": "sandbox"
}
```

---

## Calendar Endpoints

### POST /api/calendar/sync-class

Sync a class to Google Calendar.

**Request Body:**
```json
{
  "class": {
    "id": "class-uuid",
    "title": "Dome Session",
    "dateTime": "2024-03-15T10:00:00Z",
    "duration": 75,
    "venueId": "venue-uuid"
  },
  "calendarId": "primary",
  "tokens": {
    "access_token": "ya29...",
    "refresh_token": "1//0..."
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `class` | object | Yes | Class object |
| `calendarId` | string | Yes | Google Calendar ID |
| `tokens` | object | Yes | OAuth tokens |

**Response:**
```json
{
  "success": true,
  "eventId": "abc123"
}
```

---

### POST /api/calendar/remove-class

Remove a class from Google Calendar.

**Request Body:**
```json
{
  "eventId": "event-uuid",
  "calendarId": "primary",
  "tokens": {
    "access_token": "ya29..."
  }
}
```

**Response:**
```json
{
  "success": true
}
```

---

## AI Endpoints

### POST /api/ai/generate-template

Generates AI-powered marketing templates for class invitations.

**Request Body:**
```json
{
  "targetAudience": "Office workers",
  "focusArea": "Lower back pain",
  "scienceFocus": "fascial tension",
  "tone": "professional yet friendly"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targetAudience` | string | Yes | Who the template is for |
| `focusArea` | string | Yes | Main pain point or focus |
| `scienceFocus` | string | No | Scientific concept to reference |
| `tone` | string | No | Writing tone |

**Response:**
```json
{
  "name": "AI: Office workers - Lower back pain",
  "emailSubject": "Unlock better movement, {name}! 🧘",
  "emailBody": "Hi there!\n\nAs an office worker...",
  "whatsappBody": "🧘 Hey! Ready to unlock...",
  "sportTags": ["AI Generated"],
  "bodyAreaTags": ["Lower back pain"],
  "active": true,
  "id": "t1706745600000",
  "_aiProvider": "gemini",
  "_aiModel": "gemini-3-flash-preview"
}
```

**Errors:**
- `400` - Missing required fields
- `500` - AI service not configured

---

### POST /api/ai/chat

AI-powered chatbot for customer queries.

**Request Body:**
```json
{
  "message": "How much does a class cost?",
  "userId": "user_123",
  "userName": "John",
  "className": "Dome Session",
  "recentBookings": ["Dome Session - Jan 15"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User's question |
| `userId` | string | No | User ID for context |
| `userName` | string | No | User's name for personalization |
| `className` | string | No | Class user is interested in |
| `recentBookings` | string[] | No | User's recent bookings |

**Response:**
```json
{
  "text": "Thanks for reaching out! Our classes start at R150...",
  "provider": "gemini",
  "model": "gemini-3-flash-preview"
}
```

**Errors:**
- `400` - Missing required field: message
- `500` - AI service not configured

---

## Feedback Endpoints

### GET /api/feedback

Retrieves all feedback entries.

**Response:**
```json
[
  {
    "id": "fb_1706745600000_abc123",
    "classId": "class_123",
    "userId": "user_456",
    "userName": "Jane Doe",
    "type": "post_class",
    "rating": 5,
    "comment": "Amazing class!",
    "createdAt": "2024-02-01T10:00:00.000Z"
  }
]
```

---

### POST /api/feedback

Submit new feedback.

**Request Body:**
```json
{
  "classId": "class_123",
  "userId": "user_456",
  "userName": "Jane Doe",
  "type": "post_class",
  "rating": 5,
  "npsScore": 9,
  "comment": "Amazing class!"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User submitting feedback |
| `userName` | string | Yes | User's name |
| `type` | string | Yes | `post_class`, `general`, or `nps` |
| `classId` | string | No | Class ID (required for `post_class`) |
| `rating` | number | No | 1-5 star rating |
| `npsScore` | number | No | 0-10 NPS score |
| `comment` | string | No | Written feedback |

**Validation:**
- `type` must be one of: `post_class`, `general`, `nps`
- `rating` must be between 1 and 5 (if provided)
- `npsScore` must be between 0 and 10 (if provided)

**Response:**
```json
{
  "id": "fb_1706745600000_abc123",
  "classId": "class_123",
  "userId": "user_456",
  "userName": "Jane Doe",
  "type": "post_class",
  "rating": 5,
  "createdAt": "2024-02-01T10:00:00.000Z"
}
```

**Errors:**
- `400` - Missing required fields or invalid values

---

### GET /api/feedback/stats

Returns aggregated feedback statistics.

**Response:**
```json
{
  "totalFeedback": 150,
  "averageRating": 4.5,
  "averageNps": 8.2,
  "ratingDistribution": {
    "1": 5,
    "2": 10,
    "3": 20,
    "4": 45,
    "5": 70
  },
  "npsDistribution": {
    "detractor": 20,
    "passive": 30,
    "promoter": 100
  }
}
```

**NPS Categories:**
- **Detractor:** Score 0-6
- **Passive:** Score 7-8
- **Promoter:** Score 9-10

---

### GET /api/feedback/class/:classId

Retrieves feedback for a specific class.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `classId` | string | The class ID |

**Response:**
```json
[
  {
    "id": "fb_1706745600000_abc123",
    "classId": "class_123",
    "userId": "user_456",
    "userName": "Jane Doe",
    "type": "post_class",
    "rating": 5,
    "comment": "Great class!",
    "createdAt": "2024-02-01T10:00:00.000Z"
  }
]
```

---

## Error Responses

All endpoints may return errors in the following format:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid auth)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable

---

*Last Verified: March 6, 2026*
