import crypto from 'crypto';

/**
 * PayFast Custom Credit Purchase Endpoint
 * 
 * Note: Apple Pay and Google Pay are enabled via the PayFast merchant dashboard.
 * See services/payfast.ts for full documentation on enabling these payment methods.
 */

interface CustomCreditPaymentData {
  credits: number;
  userId: string;
  email: string;
}

const CREDIT_PRICE_PER_UNIT = 150;

function getPayFastConfig() {
  return {
    merchantId: process.env.PAYFAST_MERCHANT_ID || '',
    merchantKey: process.env.PAYFAST_MERCHANT_KEY || '',
    passPhrase: process.env.PAYFAST_PASSPHRASE || '',
    mode: (process.env.PAYFAST_MODE as 'sandbox' | 'live') || 'sandbox',
    returnUrl: process.env.PAYFAST_RETURN_URL || '',
    cancelUrl: process.env.PAYFAST_CANCEL_URL || '',
    notifyUrl: process.env.PAYFAST_NOTIFY_URL || ''
  };
}

function getBaseUrl(mode: string): string {
  return mode === 'sandbox' ? 'https://sandbox.payfast.co.za' : 'https://payfast.co.za';
}

function generateSignature(data: Record<string, string | number>, passPhrase: string): string {
  const sortedData = Object.entries(data)
    .filter(([, value]) => value !== '' && value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

  const signatureData = sortedData + (passPhrase ? `&passphrase=${encodeURIComponent(passPhrase)}` : '');
  // SECURITY: MD5 is cryptographically broken. Using SHA-256 for outbound signatures.
  return crypto.createHash('sha256').update(signatureData).digest('hex');
}

export async function POST({ request }: { request: Request }) {
  try {
    // SECURITY: Verify Bearer token and enforce userId ownership
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    // VERCEL FIX: Use connection pooler for serverless
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
    // Append pgbouncer=transaction to enable transaction mode for serverless
    const poolerUrl = supabaseUrl.includes('pgbouncer') 
      ? supabaseUrl 
      : `${supabaseUrl}${supabaseUrl.includes('?') ? '&' : '?'}pgbouncer=transaction`;
    const supabaseAdmin = createClient(poolerUrl, supabaseKey);
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const config = getPayFastConfig();
    
    if (!config.merchantId || !config.merchantKey) {
      return new Response(JSON.stringify({ error: 'Payment system not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { credits, userId, email } = body;

    if (!credits || !userId || !email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // SECURITY: Ensure the userId in the request matches the authenticated user
    if (userId !== authUser.id) {
      return new Response(JSON.stringify({ error: 'userId does not match authenticated user' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }

    const creditCount = parseInt(String(credits), 10);
    if (creditCount < 1 || creditCount > 10) {
      return new Response(JSON.stringify({ error: 'Credit amount must be between 1 and 10' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const amount = creditCount * CREDIT_PRICE_PER_UNIT;
    const mPaymentId = `TFMD-CUSTOM-${Date.now()}-${userId}`;
    
    const data: Record<string, string | number> = {
      merchant_id: config.merchantId,
      merchant_key: config.merchantKey,
      return_url: config.returnUrl,
      cancel_url: config.cancelUrl,
      notify_url: config.notifyUrl,
      m_payment_id: mPaymentId,
      amount: amount.toFixed(2),
      item_name: `Custom Credit Purchase (${creditCount} credits)`,
      email_address: email,
      user_id: userId,
      custom_credits: creditCount
    };

    data.signature = generateSignature(data, config.passPhrase);

    const queryString = Object.entries(data)
      .filter(([, value]) => value !== '' && value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');

    const paymentUrl = `${getBaseUrl(config.mode)}/eng/process?${queryString}`;
    
    return new Response(JSON.stringify({ 
      paymentLink: paymentUrl, 
      mPaymentId,
      credits: creditCount,
      amount 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating custom credit payment link:', error);
    return new Response(JSON.stringify({ error: 'Failed to create payment link' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Vercel serverless handler
export default async function handler(request: Request) {
  switch (request.method) {
    case 'POST':
      return POST({ request });
    default:
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}
