# Credit System Documentation

_Last updated: March 6, 2026 at 8:57 AM (SAST)_

The TFMD Booking App uses a credit-based booking system where users purchase credits that can be redeemed for classes.

## Overview

Users purchase credit packages through PayFast (South African payment gateway). Credits are stored in their user profile and deducted when booking classes.

## Credit Packages

Defined in `constants.ts`:

| Package ID | Name | Credits | Price (ZAR) | Bonus Credits |
|------------|------|---------|-------------|---------------|
| credits-1 | Single Session | 1 | R150 | 0 |
| credits-3 | 3-Class Pack | 3 | R450 | 0 |
| credits-5 | 5-Class Pack | 5 | R750 | 0 |
| credits-10 | 10-Class Pack | 10 | R1,500 | 0 |

### Package Configuration

```typescript
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'credits-1',
    name: 'Single Session',
    credits: 1,
    price: 150,
    isActive: true,
    sortOrder: 1,
    bonusCredits: 0
  },
  // ... more packages
];
```

## Database Schema

### Users Table

The `credits` field is added to the users table:

```sql
ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0;
```

## API Endpoints

### Get Available Packages

```
GET /api/credits/packages
```

Response:
```json
[
  {
    "id": "credits-1",
    "name": "Single Session",
    "credits": 1,
    "price": 150,
    "isActive": true,
    "sortOrder": 1,
    "bonusCredits": 0
  }
]
```

### Purchase Credits

```
POST /api/credits/purchase
```

Request:
```json
{
  "packageId": "credits-5",
  "userId": "uuid-of-user",
  "email": "user@example.com",
  "name": "John Doe"
}
```

Response:
```json
{
  "paymentLink": "https://sandbox.payfast.co.za/eng/process?..."
}
```

### PayFast Webhook (ITN)

```
POST /api/payfast/notify
```

This endpoint receives payment confirmation from PayFast and credits the user's account.

## Payment Flow

1. **User selects package** → ClientApp displays available packages
2. **User clicks purchase** → Calls `/api/credits/purchase`
3. **Server creates payment link** → Returns PayFast payment URL
4. **User completes payment** → PayFast redirects to success/cancel
5. **PayFast sends ITN** → Server validates and credits account
6. **User credited** → Balance updated in database

## Security

### Purchase Endpoint Validation

The `/api/credits/purchase` endpoint validates:
- UUID format for userId
- Valid email format
- Safe string for name (alphanumeric + basic chars)
- Valid package ID

### Webhook Validation

The `/api/payfast/notify` endpoint:
- Validates PayFast signature
- Validates required fields exist
- Validates amount matches package price
- Validates payment ID format (TFMD-{timestamp}-{userId})
- Validates user ID format

## Implementation Files

| File | Purpose |
|------|---------|
| `constants.ts` | Credit package definitions |
| `services/payfast.ts` | PayFast payment service |
| `services/db-supabase.ts` | `updateUserCredits()` function |
| `server.ts` | API endpoints |
| `screens/ClientApp.tsx` | Purchase UI modal |

## Testing

### Sandbox Testing

1. Set PayFast mode to sandbox in `.env`:
   ```
   PAYFAST_MODE=sandbox
   ```
2. Use PayFast sandbox merchant credentials
3. Test purchase flow

### Credit Update Testing

```javascript
// Test credit update directly
await db.updateUserCredits('user-uuid', 10);
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Invalid credit package | Package ID not found | Check package IDs in constants.ts |
| Payment system not configured | Missing PayFast env vars | Configure PAYFAST_MERCHANT_ID and KEY |
| Amount mismatch | Price tampering detected | Review transaction logs |
| Signature invalid | Possible attack | Review IP and logs |

## User Flow

```
┌─────────────────┐
│  View Packages  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Select Package │──── User picks credits-5
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Payment  │──── Calls /api/credits/purchase
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PayFast Portal  │──── Redirect to PayFast
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│Success│ │Cancel │
└───┬───┘ └───┬───┘
    │         │
    ▼         ▼
┌───────────┐  ┌──────────┐
│  ITN Ntfy │  │ Show Err │
│  +Credits │  └──────────┘
└───────────┘
```

## Future Enhancements

- Credit expiry policies
- Credit packages with time limits
- Referral bonus credits
- Credit transfer between users
- Subscription-based credit auto-reload
