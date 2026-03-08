# PayFast Payment Integration

_Last updated: March 6, 2026 at 8:51 AM (SAST)_

This document covers the PayFast payment gateway integration for the TFMD Booking App.

## Overview

PayFast is a South African payment gateway that enables:
- Credit card payments
- Instant EFT payments
- Zapper payments

## Setup

### 1. PayFast Merchant Account

1. Register at [payfast.co.za](https://payfast.co.za)
2. Complete merchant verification
3. Get merchant ID and key

### 2. Environment Variables

Add to `.env`:

```env
# PayFast Configuration
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_PASSPHRASE=your_secure_passphrase
PAYFAST_MODE=sandbox  # or 'live' for production

# URLs (update for production)
PAYFAST_RETURN_URL=https://yourdomain.com
PAYFAST_CANCEL_URL=https://yourdomain.com
PAYFAST_NOTIFY_URL=https://yourdomain.com/api/payfast/notify
```

### 3. Vercel Configuration

Add these variables in Vercel dashboard:
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_MODE`
- `PAYFAST_RETURN_URL`
- `PAYFAST_CANCEL_URL`
- `PAYFAST_NOTIFY_URL`

## How It Works

### Payment Flow

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  User Buys   │────▶│  Generate   │────▶│  Redirect   │
│   Credits    │     │ Payment URL│     │  to PayFast │
└──────────────┘     └─────────────┘     └──────┬───────┘
                                                │
                                          ┌─────┴─────┐
                                          ▼           ▼
                                    ┌──────────┐ ┌──────────┐
                                    │ Payment  │ │ Payment │
                                    │ Complete │ │  Failed  │
                                    └────┬─────┘ └────┬─────┘
                                         │            │
                                         ▼            ▼
                                   ┌──────────┐ ┌──────────┐
                                   │  ITN     │ │  Return  │
                                   │ Webhook  │ │ to App   │
                                   └────┬─────┘ └──────────┘
                                        │
                                        ▼
                                  ┌──────────┐
                                  │  Credit  │
                                  │   User   │
                                  └──────────┘
```

## Implementation

### Files

| File | Purpose |
|------|---------|
| `services/payfast.ts` | PayFast service class |
| `server.ts` | Payment endpoints |

### PayFast Service

The `PayFastService` class handles:

```typescript
import { payfastService } from './services/payfast';

// Check if configured
if (payfastService.isConfigured()) {
  // Create payment link
  const link = await payfastService.createPaymentLink({
    amount: 250.00,
    itemName: 'Pause Credits - Starter (1 credits)',
    userId: 'user-uuid',
    email: 'user@example.com',
    creditPackageId: 'credits-1'
  });
}

// Validate webhook notification
const validation = await payfastService.validateNotification(data);
```

### API Endpoints

#### 1. Get Payment Status

```
GET /api/payfast/status
```

Response:
```json
{
  "configured": true,
  "mode": "sandbox"
}
```

#### 2. Create Payment Link

```
POST /api/credits/purchase
```

Request:
```json
{
  "packageId": "credits-1",
  "userId": "uuid",
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

#### 3. Webhook Handler (ITN)

```
POST /api/payfast/notify
```

This is called by PayFast when payment completes.

### Payment ID Format

The `m_payment_id` format is:
```
TFMD-{timestamp}-{userId}
```

Example: `TFMD-1704067200000-abc123-def456`

This allows the webhook to extract the user ID for crediting.

## Security

### Signature Validation

All PayFast notifications include a signature that must be validated:

```typescript
const validation = await payfastService.validateNotification(notificationData);
if (!validation.valid) {
  // Reject the notification
}
```

### Security Checks in Webhook

The webhook handler validates:
1. Required fields present
2. Valid amount (not tampered)
3. Valid payment ID format
4. Signature matches
5. Payment status is COMPLETE

### Best Practices

- Never trust payment status from client
- Always validate PayFast signature
- Log all payment attempts
- Verify amount matches expected
- Use HTTPS for all URLs

## Testing

### Sandbox Mode

1. Set `PAYFAST_MODE=sandbox`
2. Use sandbox merchant credentials from PayFast dashboard
3. Test payment flow

### Test Cards

Use PayFast sandbox test card:
- Number: 4000000000000002 (Visa)
- Expiry: Any future date
- CVV: Any 3 digits

### ITN Testing

Use PayFast ITN testing tool to simulate webhook calls.

## Error Codes

| Code | Description |
|------|-------------|
| INVALID SIGNATURE | Signature validation failed |
| MISSING FIELDS | Required fields not present |
| INVALID AMOUNT | Amount is invalid |
| INVALID PAYMENT ID | Payment ID format wrong |
| INVALID USER ID | User ID format wrong |
| AMOUNT MISMATCH | Amount doesn't match package price |

## Troubleshooting

### Payment Not Crediting

1. Check PayFast dashboard for payment status
2. Check server logs for webhook
3. Verify webhook URL is accessible
4. Check signature validation

### 404 on Webhook

- Verify notify URL is correct in PayFast dashboard
- Ensure URL is publicly accessible (not localhost)
- Check Vercel function logs

### Signature Validation Fails

- Verify passphrase matches PayFast dashboard
- Check for URL encoding issues
- Ensure all fields included in signature

## Webhook Retry

PayFast retries failed webhooks up to 5 times. Ensure your endpoint:
- Returns 200 OK on success
- Returns non-200 on failure (triggers retry)

## Refunds

To issue refunds:
1. Log into PayFast merchant dashboard
2. Find the transaction
3. Issue refund

Refunds are not currently implemented via API.

## Migration from Stripe (Future)

If switching to Stripe:
1. Add Stripe service (`services/stripe.ts`)
2. Add Stripe endpoints
3. Update credit purchase UI to support multiple providers
4. Keep PayFast as fallback for South African users

## Resources

- [PayFast Documentation](https://payfast.co.za/documentation)
- [PayFast ITN Guide](https://payfast.co.za/documentation/itn)
- [Sandbox Testing](https://payfast.co.za/documentation/sandbox)
