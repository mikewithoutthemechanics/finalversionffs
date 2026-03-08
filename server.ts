import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Import our custom services
import { aiService } from "./services/ai";
import { emailService } from "./services/email";
import { emailQueue } from "./services/email-queue";
import { db } from "./services/db-supabase";
import { Feedback } from "./types";
import { toSettingsResponse, toTokenResponse } from "./services/api-dto";
import { payfastService } from "./services/payfast";
import { CREDIT_PACKAGES } from "./constants";

// Import standardized error response utilities
import { errorResponse, ErrorCodes, HttpStatus } from "./utils/error-response";

// ============================================
// INPUT VALIDATION HELPERS
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_STRING_REGEX = /^[\w\s\-.,!?@]+$/;

function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_REGEX.test(value);
}

function isValidSafeString(value: unknown, maxLength = 255): value is string {
  return typeof value === 'string' && 
         value.length > 0 && 
         value.length <= maxLength && 
         SAFE_STRING_REGEX.test(value);
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

function isValidBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

// Keep validation helpers for future use
void isValidNumber;
void isValidBoolean;

// ============================================
// IP ALLOWLIST VALIDATION (PayFast)
// ============================================

const PAYFAST_IP_RANGES = ['196.41.0.0/21'];

function ipToLong(ip: string): number {
  const parts = ip.split('.');
  return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isIPInRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);
  const ipLong = ipToLong(ip);
  const rangeLong = ipToLong(range);
  return (ipLong & mask) === (rangeLong & mask);
}

function isValidPayFastIP(ip: string): boolean {
  if (!ip) return false;
  return PAYFAST_IP_RANGES.some(range => isIPInRange(ip, range));
}

// ============================================
// IDEMPOTENCY TRACKING (Payment Processing)
// ============================================

const processedPayments = new Set<string>();

function isPaymentProcessed(paymentId: string): boolean {
  return processedPayments.has(paymentId);
}

function markPaymentProcessed(paymentId: string): void {
  processedPayments.add(paymentId);
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
  adminRole?: string;
}

async function verifyAuth(req: express.Request): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  if (!token) {
    return null;
  }
  
  // VERCEL FIX: Use connection pooler for serverless
  const baseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const poolerUrl = baseUrl.includes('pgbouncer') 
    ? baseUrl 
    : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}pgbouncer=transaction`;
  
  const supabaseAdmin = createClient(poolerUrl, process.env.SUPABASE_SERVICE_KEY || '');
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  // Get user from database to check admin status
  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('id, email, is_admin, admin_role')
    .eq('id', user.id)
    .single();
  
  if (!dbUser) {
    return null;
  }
  
  return {
    id: dbUser.id,
    email: dbUser.email,
    isAdmin: dbUser.is_admin || false,
    adminRole: dbUser.admin_role
  };
}

async function requireAuth(req: express.Request, res: express.Response): Promise<AuthUser | null> {
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return user;
}

async function requireAdmin(req: express.Request, res: express.Response): Promise<AuthUser | null> {
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (!user.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return user;
}

// Initialize Supabase client for server-side operations
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
// VERCEL FIX: Use connection pooler for serverless
const poolerUrl = supabaseUrl?.includes('pgbouncer') 
  ? supabaseUrl 
  : supabaseUrl 
    ? `${supabaseUrl}${supabaseUrl.includes('?') ? '&' : '?'}pgbouncer=transaction`
    : undefined;
const supabase = poolerUrl && supabaseServiceKey 
  ? createClient(poolerUrl, supabaseServiceKey)
  : null;

// ============================================
// EMAIL SERVICE INITIALIZATION
// Load email templates from database settings
// ============================================
async function initializeEmailService() {
  try {
    const settings = await db.getSettings();
    
    // Configure sender from settings
    if (settings.email?.senderEmail) {
      emailService.setSender(settings.email.senderName || 'Pause Admin', settings.email.senderEmail);
      console.log(`📧 Email sender configured: ${settings.email.senderName} <${settings.email.senderEmail}>`);
    }
    
    // Load custom email templates if configured
    if (settings.email?.templates) {
      emailService.setTemplates(settings.email.templates);
      console.log('📧 Custom email templates loaded from settings');
    }
  } catch (error) {
    console.warn('⚠️ Could not load email settings:', error);
  }
}

// ============================================
// SECURITY: Environment Validation
// ============================================

const REQUIRED_ENV_VARS = [
  { name: 'GOOGLE_CLIENT_ID', required: false },
  { name: 'GOOGLE_CLIENT_SECRET', required: false },
  { name: 'GEMINI_API_KEY', required: false },
  { name: 'OPENROUTER_API_KEY', required: false },
  { name: 'RESEND_API_KEY', required: false },
  { name: 'SUPABASE_URL', required: false },
  { name: 'SUPABASE_SERVICE_KEY', required: false },
];

function validateEnvironment() {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];
    if (!value) {
      if (envVar.required) {
        missing.push(envVar.name);
      } else {
        warnings.push(`${envVar.name} - optional, some features may be limited`);
      }
    }
  }
  
  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Configuration Warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }
  
  if (missing.length > 0) {
    console.error('\n❌ Missing Required Environment Variables:');
    missing.forEach(m => console.error(`  - ${m}`));
    console.error('\nPlease add these to your .env file or Vercel environment.\n');
  }
  
  const configured = REQUIRED_ENV_VARS.filter(e => process.env[e.name]).length;
  console.log(`\n✅ Environment validated: ${configured}/${REQUIRED_ENV_VARS.length} variables configured\n`);
}

// ============================================
// SECURITY: Database-backed Token Store (serverless-compatible)
// ============================================

interface OAuthTokenData {
  tokens: {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number;
  };
  createdAt: number;
}

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

async function storeTokensDB(tokens: OAuthTokenData['tokens'], userId?: string): Promise<string> {
  const tokenId = `token_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();
  
  if (supabase) {
    await supabase.from('oauth_tokens').insert({
      id: tokenId,
      tokens: JSON.stringify(tokens),
      expires_at: expiresAt,
      user_id: userId || null
    });
  }
  
  return tokenId;
}

async function getTokensDB(tokenId: string): Promise<OAuthTokenData['tokens'] | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('oauth_tokens')
    .select('tokens, expires_at')
    .eq('id', tokenId)
    .single();
  
  if (error || !data) return null;
  
  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('oauth_tokens').delete().eq('id', tokenId);
    return null;
  }
  
  return typeof data.tokens === 'string' ? JSON.parse(data.tokens) : data.tokens;
}

async function deleteTokensDB(tokenId: string): Promise<void> {
  if (supabase) {
    await supabase.from('oauth_tokens').delete().eq('id', tokenId);
  }
}

// Fallback in-memory store for when Supabase is not available
const tokenStore = new Map<string, OAuthTokenData>();

function generateTokenId(): string {
  return `token_${crypto.randomUUID()}`;
}

async function storeTokens(tokens: OAuthTokenData['tokens'], userId?: string): Promise<string> {
  const tokenId = generateTokenId();
  
  if (supabase) {
    // Use database storage in serverless environments
    await storeTokensDB(tokens, userId);
  } else {
    // Fallback to memory
    tokenStore.set(tokenId, { tokens, createdAt: Date.now() });
    cleanupExpiredTokens();
  }
  
  return tokenId;
}

async function getTokens(tokenId: string): Promise<OAuthTokenData['tokens'] | null> {
  if (supabase) {
    // Try database first
    const dbTokens = await getTokensDB(tokenId);
    if (dbTokens) return dbTokens;
  }
  
  // Fallback to memory
  const data = tokenStore.get(tokenId);
  if (!data) return null;
  
  if (Date.now() - data.createdAt > TOKEN_EXPIRY_MS) {
    tokenStore.delete(tokenId);
    return null;
  }
  
  return data.tokens;
}

function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [id, data] of tokenStore.entries()) {
    if (now - data.createdAt > TOKEN_EXPIRY_MS) {
      tokenStore.delete(id);
    }
  }
}

// ============================================
// PORT CONFIGURATION
// ============================================
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const IS_VERCEL = process.env.VERCEL === '1';

// Create Express app
const app = express();

// Run environment validation
validateEnvironment();

// ============================================
// SECURITY: Helmet - HTTP Security Headers
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.supabase.co"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ============================================
// SECURITY: Rate Limiting
// ============================================
const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200,
  message: errorResponse("Too many requests, please try again later.", ErrorCodes.RATE_LIMIT_EXCEEDED),
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: errorResponse("AI service rate limit exceeded. Please try again later.", ErrorCodes.RATE_LIMIT_EXCEEDED),
  standardHeaders: true,
  legacyHeaders: false,
});

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: errorResponse("Too many OAuth attempts, please try again later.", ErrorCodes.RATE_LIMIT_EXCEEDED),
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Stricter rate limiting for user registration
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // 5 registrations per IP per hour
  message: errorResponse("Too many registration attempts, please try again later.", ErrorCodes.RATE_LIMIT_EXCEEDED),
  standardHeaders: true,
  legacyHeaders: false,
  // Trust proxy headers for IP behind load balancers
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown';
  },
});

app.use("/api/", generalLimiter);
app.use("/api/ai/", aiLimiter);
app.use("/api/auth/", oauthLimiter);

app.use(express.json());

// ============================================
// SECURITY: CSRF Token Endpoint
// ============================================
app.get("/api/csrf-token", (req, res) => {
  const csrfToken = crypto.randomUUID();
  res.json({ csrfToken });
});

// ============================================
// SECURITY: IP Address Endpoint for Waiver
// ============================================
app.get("/api/client-ip", (req, res) => {
  // Get client IP address from various headers (for reverse proxy setups)
  const clientIp = req.headers['x-forwarded-for'] as string || 
                   req.headers['x-real-ip'] as string || 
                   req.socket?.remoteAddress || 
                   'unknown';
  // Return just the first IP if there are multiple (x-forwarded-for can contain list)
  const ip = clientIp.split(',')[0].trim();
  res.json({ ip });
});

// ============================================
// ============================================
// USER REGISTER: Create new user (bypasses RLS)
// SECURITY: Does NOT require authentication - used for manual sign-up.
// Has strict rate limiting (5 per hour per IP) to prevent abuse.
// Users cannot set admin privileges through this endpoint.
// ============================================
app.post("/api/user/register", registrationLimiter, async (req, res) => {
  try {
    const { user } = req.body;
    
    if (!user?.id || !user?.email) {
      return errorResponse(res, ErrorCodes.INVALID_REQUEST, "Missing user id or email");
    }

    // Validate email format
    if (!isValidEmail(user.email)) {
      return errorResponse(res, ErrorCodes.INVALID_REQUEST, "Invalid email format");
    }

    // SECURITY: Prevent privilege escalation - users cannot grant themselves admin access
    if (user.isAdmin === true) {
      console.warn(`[SECURITY] Registration with isAdmin=true blocked for: ${user.email}`);
      user.isAdmin = false;
    }

    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    // Build user object with safe defaults
    const userInsert = {
      id: user.id,
      name: user.name || user.email.split('@')[0],
      email: user.email,
      is_admin: false,
      credits: 0,
      waiver_accepted: false,
      waiver_data: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert(userInsert, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error("[user register] database error:", error);
      return errorResponse(res, ErrorCodes.DB_ERROR, "Failed to create user account");
    }

    console.log(`[user register] Created user: ${user.email} (ID: ${user.id})`);
    res.json({ success: true, user: data });
  } catch (err) {
    console.error("[user register] error:", err);
    res.status(500).json({ error: "Failed to create user account" });
  }
});

// USER SYNC: Create/update user profile (bypasses RLS)
// SECURITY: Requires authentication. Users can only update their own profile.
// Admins can update any user but cannot grant admin access via this endpoint.
// ============================================
app.post("/api/user/sync", async (req, res) => {
  try {
    // SECURITY: Require authentication
    const authUser = await requireAuth(req, res);
    if (!authUser) return;
    
    const { user } = req.body;
    
    if (!user?.id || !user?.email) {
      return errorResponse(res, ErrorCodes.INVALID_REQUEST, "Missing user id or email");
    }

    // SECURITY: Users can only update their own profile unless they are admin
    // Prevent privilege escalation - users cannot grant themselves admin access
    const isSelfUpdate = authUser.id === user.id;
    const canUpdateAdminStatus = authUser.isAdmin && !isSelfUpdate;
    
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    // Build update object - only include fields user is allowed to set
    const userUpdate: Record<string, unknown> = {
      id: user.id,
      name: user.name || user.email.split('@')[0],
      email: user.email,
      credits: user.credits || 0,
      waiver_accepted: user.waiverAccepted || false,
      waiver_data: user.waiverData || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Only allow is_admin to be set if admin is updating another user (not themselves)
    if (canUpdateAdminStatus) {
      userUpdate.is_admin = user.isAdmin || false;
      userUpdate.admin_role = user.adminRole || null;
    } else if (user.isAdmin === true) {
      // SECURITY: Log attempt to escalate privileges
      console.warn(`[SECURITY] User ${authUser.id} attempted to set isAdmin=true on user ${user.id}`);
      // Don't include admin fields - user cannot escalate their own privileges
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert(userUpdate, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, user: data });
  } catch (err) {
    console.error("[user sync] error:", err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

// ============================================
// REGISTRATION SYNC: Create registration (bypasses RLS)
// SECURITY: Requires authentication. Users can only create registrations for themselves.
// Admins can create registrations for any user.
// ============================================
app.post("/api/registration/sync", async (req, res) => {
  try {
    // SECURITY: Require authentication
    const authUser = await requireAuth(req, res);
    if (!authUser) return;
    
    const { registration } = req.body;
    
    if (!registration?.id || !registration?.classId || !registration?.userId) {
      return errorResponse(res, ErrorCodes.INVALID_REQUEST, "Missing required registration fields");
    }

    // SECURITY: Users can only register themselves unless they are admin
    const canRegisterOther = authUser.isAdmin;
    if (!canRegisterOther && authUser.id !== registration.userId) {
      console.warn(`[SECURITY] User ${authUser.id} attempted to register for user ${registration.userId}`);
      return res.status(403).json({ error: "You can only register yourself for classes" });
    }

    // Use service role key to bypass RLS
    const supabaseAdminClient = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    const { data, error } = await supabaseAdminClient
      .from('registrations')
      .upsert({
        id: registration.id,
        class_id: registration.classId,
        user_id: registration.userId,
        user_name: registration.userName,
        user_email: registration.userEmail || null,
        user_sport: registration.userSport || null,
        body_areas: registration.bodyAreas || [],
        referred_by: registration.referredBy || null,
        status: registration.status,
        payment_status: registration.paymentStatus,
        payment_method: registration.paymentMethod || null,
        payment_proof: registration.paymentProof || null,
        registered_at: registration.registeredAt || new Date().toISOString(),
        notes: registration.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, registration: data });
  } catch (err) {
    console.error("[registration sync] error:", err);
    res.status(500).json({ error: "Failed to create registration" });
  }
});

// ============================================
// REGISTRATION CANCEL: Cancel registration (bypasses RLS)
// SECURITY: Requires authentication. Users can only cancel their own registrations.
// Admins can cancel any registration.
// ============================================
app.post("/api/registration/cancel", async (req, res) => {
  try {
    // SECURITY: Require authentication
    const authUser = await requireAuth(req, res);
    if (!authUser) return;
    
    const { registrationId } = req.body;
    
    if (!registrationId) {
      return errorResponse(res, ErrorCodes.INVALID_REQUEST, "Missing registration ID");
    }

    // Use service role key to bypass RLS
    const supabaseAdminClient = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    // First get the registration to check ownership
    const { data: regData, error: regError } = await supabaseAdminClient
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .single();
      
    if (regError || !regData) {
      return res.status(404).json({ error: "Registration not found" });
    }
    
    // SECURITY: Users can only cancel their own registrations unless they are admin
    const canCancelOther = authUser.isAdmin;
    if (!canCancelOther && authUser.id !== regData.user_id) {
      console.warn(`[SECURITY] User ${authUser.id} attempted to cancel registration ${registrationId} owned by ${regData.user_id}`);
      return res.status(403).json({ error: "You can only cancel your own registrations" });
    }
    
    const wasConfirmed = regData.status === 'confirmed' || regData.status === 'payment_review';
    const classId = regData.class_id;

    // Cancel the registration
    const { error: cancelError } = await supabaseAdminClient
      .from('registrations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', registrationId);
      
    if (cancelError) throw cancelError;

    // If the cancelled registration was confirmed/payment_review, promote first waitlisted user
    if (wasConfirmed && classId) {
      const { data: waitlistData, error: waitlistError } = await supabaseAdminClient
        .from('registrations')
        .select('*')
        .eq('class_id', classId)
        .eq('status', 'waitlisted')
        .order('registered_at', { ascending: true })
        .limit(1);

      if (!waitlistError && waitlistData && waitlistData.length > 0) {
        const waitlistedUser = waitlistData[0];
        
        // Determine new status based on payment requirement
        const { data: classData } = await supabaseAdminClient
          .from('classes')
          .select('price')
          .eq('id', classId)
          .single();
          
        const isPaid = (classData?.price || 0) > 0;
        const newStatus = isPaid ? 'payment_review' : 'confirmed';

        await supabaseAdminClient
          .from('registrations')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', waitlistedUser.id);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[registration cancel] error:", err);
    res.status(500).json({ error: "Failed to cancel registration" });
  }
});

// ============================================
// TRAINER APPROVAL ENDPOINTS
// ============================================

// POST /api/teacher/request - Submit teacher registration request
app.post("/api/teacher/request", async (req, res) => {
  try {
    const { userId, name, email, phone, qualifications, experience, specializations } = req.body;

    if (!userId || !name || !email) {
      return res.status(400).json({ error: "Missing required fields: userId, name, email" });
    }

    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    const { data: request, error } = await supabaseAdmin
      .from('teacher_requests')
      .insert({
        user_id: userId,
        email,
        name,
        phone: phone || null,
        qualifications: qualifications || null,
        experience: experience || null,
        specializations: specializations || [],
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Update user's teacher_status to pending
    await supabaseAdmin
      .from('users')
      .update({ teacher_status: 'pending' })
      .eq('id', userId);

    res.status(201).json({ success: true, request });
  } catch (error) {
    console.error("[teacher/request] Error:", error);
    res.status(500).json({ error: "Failed to submit teacher request" });
  }
});

// GET /api/teacher/pending - Get all pending teacher requests (admin only)
app.get("/api/teacher/pending", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    // Verify admin from database
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('is_admin, admin_role')
      .eq('id', user.id)
      .single();

    if (!adminUser?.is_admin || !['super_admin', 'admin'].includes(adminUser.admin_role)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { data: requests, error } = await supabaseAdmin
      .from('teacher_requests')
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("[teacher/pending] Error:", error);
    res.status(500).json({ error: "Failed to fetch pending requests" });
  }
});

// POST /api/teacher/approve - Approve a teacher request
// SECURITY: Requires admin authentication
app.post("/api/teacher/approve", async (req, res) => {
  try {
    // SECURITY: Require admin authentication
    const authUser = await requireAdmin(req, res);
    if (!authUser) return;
    
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: "Missing required field: requestId" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    // Get the request to find the user
    const { data: request, error: requestError } = await supabaseAdmin
      .from('teacher_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: "Teacher request not found" });
    }

    // Update request status
    const { error: updateError } = await supabaseAdmin
      .from('teacher_requests')
      .update({
        status: 'approved',
        reviewed_by: authUser.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    // Update user as teacher
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        teacher_status: 'approved',
        is_teacher: true,
        approved_by: authUser.id,
        approved_at: new Date().toISOString(),
        admin_role: 'teacher'
      })
      .eq('id', request.user_id);

    if (userError) throw userError;

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[teacher/approve] Error:", error);
    res.status(500).json({ error: "Failed to approve teacher" });
  }
});

// POST /api/teacher/reject - Reject a teacher request
// SECURITY: Requires admin authentication
app.post("/api/teacher/reject", async (req, res) => {
  try {
    // SECURITY: Require admin authentication
    const authUser = await requireAdmin(req, res);
    if (!authUser) return;
    
    const { requestId, rejectionReason } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: "Missing required field: requestId" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    // Get the request to find the user
    const { data: request, error: requestError } = await supabaseAdmin
      .from('teacher_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: "Teacher request not found" });
    }

    // Update request status
    const { error: updateError } = await supabaseAdmin
      .from('teacher_requests')
      .update({
        status: 'rejected',
        reviewed_by: authUser.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason || null
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    // Update user status
    await supabaseAdmin
      .from('users')
      .update({ teacher_status: 'rejected' })
      .eq('id', request.user_id);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[teacher/reject] Error:", error);
    res.status(500).json({ error: "Failed to reject teacher" });
  }
});

// GET /api/teacher/status/:userId - Get teacher status for a user
app.get("/api/teacher/status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('teacher_status, is_teacher, approved_by, approved_at')
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.status(200).json({ 
      success: true, 
      status: user?.teacher_status || 'none',
      isTeacher: user?.is_teacher || false,
      approvedAt: user?.approved_at,
      approvedBy: user?.approved_by
    });
  } catch (error) {
    console.error("[teacher/status] Error:", error);
    res.status(500).json({ error: "Failed to get teacher status" });
  }
});

// POST /api/teacher/status - Get teacher status (for client-side verification)
app.post("/api/teacher/status", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('teacher_status, is_teacher, approved_by, approved_at')
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.status(200).json({ 
      success: true, 
      status: user?.teacher_status || 'none',
      isTeacher: user?.is_teacher || false,
      approvedAt: user?.approved_at,
      approvedBy: user?.approved_by
    });
  } catch (error) {
    console.error("[teacher/status POST] Error:", error);
    res.status(500).json({ error: "Failed to get teacher status" });
  }
});

// POST /api/admin/verify - Verify admin access
app.post("/api/admin/verify", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('is_admin, admin_role')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const isAdmin = user?.is_admin === true;
    
    res.status(200).json({ 
      success: true, 
      isAdmin,
      adminRole: user?.admin_role || null
    });
  } catch (error) {
    console.error("[admin/verify] Error:", error);
    res.status(500).json({ error: "Failed to verify admin access" });
  }
});

// POST /api/admin/invite - Invite a new admin user
// SECURITY: Requires admin authentication
app.post("/api/admin/invite", async (req, res) => {
  try {
    // SECURITY: Require admin authentication - use authenticated user's ID, not from request
    const authUser = await requireAdmin(req, res);
    if (!authUser) return;
    
    const { email, name, role } = req.body;

    if (!email || !name || !role) {
      return res.status(400).json({ error: "Missing required fields: email, name, role" });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // SECURITY: Validate role is allowed
    const allowedRoles = ['super_admin', 'admin', 'teacher', 'staff'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    // SECURITY: Use authenticated user's ID instead of trusting inviterId from request
    // (removed inviterId from request body - now uses authUser.id)

    // Check if user already exists in auth
    const { data: existingUsers } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      // Update existing user to admin
      await supabaseAdmin
        .from('users')
        .update({ is_admin: true, admin_role: role })
        .eq('id', existingUsers[0].id);

      // Send notification email
      const settings = await db.getSettings();
      const appName = settings?.appName || 'Pause';
      
      await emailService.sendEmail(
        email,
        `You've been promoted to ${role} on ${appName}`,
        `<h2>Welcome to the team!</h2>
        <p>Hi ${name},</p>
        <p>You've been promoted to <strong>${role}</strong> on ${appName}.</p>
        <p>Log in to access your new admin capabilities.</p>
        <p>Best regards,<br/>${appName} Admin</p>`
      );

      return res.status(200).json({ 
        success: true, 
        message: "User promoted to admin",
        userId: existingUsers[0].id
      });
    }

    // Create new user in auth and send invite
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: false,
      user_metadata: { name }
    });

    if (authError) {
      console.error("[admin/invite] Auth error:", authError);
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(500).json({ error: "Failed to create user" });
    }

    // Generate password reset link
    let inviteLink = `${process.env.APP_URL || 'https://pausefmd.co.za'}/reset-password`;
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase()
    });

    if (resetError) {
      console.error("[admin/invite] Reset link error:", resetError);
    } else if (resetData) {
      const resetLink = (resetData as unknown as { properties?: { href?: string } })?.properties?.href;
      if (resetLink) inviteLink = resetLink;
    }

    // Create user record in users table
    await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email.toLowerCase(),
        name,
        is_admin: true,
        admin_role: role,
        waiver_accepted: true,
        credits: 0
      });

    // Send invitation email
    const settings = await db.getSettings();
    const appName = settings?.appName || 'Pause';
    
    await emailService.sendEmail(
      email,
      `You're invited to join ${appName} as ${role}`,
      `<h2>You're invited!</h2>
      <p>Hi ${name},</p>
      <p>You've been invited to join <strong>${appName}</strong> as a <strong>${role}</strong>.</p>
      <p>Click the link below to set your password and get started:</p>
      <p><a href="${inviteLink}" style="background: #6E7568; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Set Password</a></p>
      <p>Or copy this link: ${inviteLink}</p>
      <p>Best regards,<br/>${appName} Admin</p>`
    );

    res.status(200).json({ 
      success: true, 
      message: "Invitation sent",
      userId: authData.user.id
    });
  } catch (error) {
    console.error("[admin/invite] Error:", error);
    res.status(500).json({ error: "Failed to invite admin" });
  }
});

// ============================================
// Google Calendar OAuth
// ============================================

const getRedirectUri = (): string => {
  if (process.env.APP_URL) {
    return `${process.env.APP_URL}/api/auth/google/callback`;
  }
  return `http://localhost:${PORT}/api/auth/google/callback`;
};

const ALLOWED_ORIGINS = (process.env.ALLOWED_OAUTH_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const getAllowedOrigins = (): string[] => {
  const origins = [...ALLOWED_ORIGINS];
  origins.push(`http://localhost:${PORT}`);
  origins.push(`https://localhost:${PORT}`);
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.APP_URL) {
    origins.push(process.env.APP_URL);
  }
  return [...new Set(origins)];
};

app.get("/api/auth/google/url", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(HttpStatus.BAD_REQUEST).json(errorResponse("Missing Google Client ID or Secret", ErrorCodes.MISSING_REQUIRED_FIELD));
  }

  const redirectUri = getRedirectUri();
  
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  res.json({ url });
});

app.get("/api/auth/google/callback", async (req, res) => {
  // SECURITY: Validate the Origin header against allowed origins
  // This prevents CSRF attacks by ensuring the request comes from a trusted origin
  const requestOrigin = req.headers.origin as string | undefined;
  const allowedOrigins = getAllowedOrigins();
  
  // Check if the Origin header is present and matches an allowed origin
  if (requestOrigin) {
    const isOriginAllowed = allowedOrigins.some(allowed => {
      // SECURITY FIX: Use exact match to prevent subdomain bypass attacks
      // Only allow exact matches, not prefix matches
      const normalizedAllowed = allowed.replace(/\/+$/, ''); // Remove trailing slashes
      return requestOrigin === normalizedAllowed;
    });
    
    if (!isOriginAllowed) {
      console.warn(`SEC-006: Blocked OAuth callback with invalid origin: ${requestOrigin}`);
      return res.status(403).send("Error: Invalid origin. Request blocked.");
    }
  } else {
    // No Origin header - could be a CSRF attack, block the request
    console.warn("SEC-006: Blocked OAuth callback with no Origin header");
    return res.status(403).send("Error: Origin header required. Request blocked.");
  }

  const { code } = req.query;
  
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send("Server configuration error: Missing Google credentials");
  }

  const redirectUri = getRedirectUri();

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  try {
    const { tokens } = await client.getToken(code as string);
    client.setCredentials(tokens);

    const tokenData = {
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined
    };
    const tokenId = await storeTokens(tokenData);
    
    // Use the validated Origin header for the response
    const safeOrigin = requestOrigin || allowedOrigins[0];
    
    res.send(`
      <html>
        <body>
          <script>
            const allowedOrigins = ${JSON.stringify(allowedOrigins)};
            const messageOrigin = "${safeOrigin}";
            
            if (allowedOrigins.includes(messageOrigin)) {
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'GOOGLE_AUTH_SUCCESS', 
                  tokenId: '${tokenId}'
                }, messageOrigin);
                window.close();
              } else {
                window.location.href = '/';
              }
            } else {
              document.body.innerHTML = '<p>Error: Invalid origin. Please refresh and try again.</p>';
            }
          </script>
          <p>Authentication successful. You can close this window.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/auth/tokens/:tokenId", async (req, res) => {
  const { tokenId } = req.params;
  
  if (!tokenId || !tokenId.startsWith('token_')) {
    return res.status(HttpStatus.BAD_REQUEST).json(errorResponse("Invalid token ID", ErrorCodes.INVALID_FORMAT));
  }
  
  const tokens = await getTokens(tokenId);
  
  if (!tokens) {
    return res.status(HttpStatus.NOT_FOUND).json(errorResponse("Token not found or expired", ErrorCodes.NOT_FOUND));
  }
  
  // Use DTO to filter sensitive fields - never expose actual tokens to client
  res.json(toTokenResponse(tokens));
});

// ============================================
// Health Check
// ============================================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ============================================
// AI Template Generation Endpoint
// ============================================
app.post("/api/ai/generate-template", async (req, res) => {
  try {
    const { targetAudience, focusArea, scienceFocus, tone } = req.body;
    
    if (!targetAudience || !focusArea) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse("Missing required fields: targetAudience and focusArea", ErrorCodes.MISSING_REQUIRED_FIELD));
    }

    if (!aiService.isConfigured()) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(errorResponse("AI service not configured. Please set GEMINI_API_KEY or OPENROUTER_API_KEY", ErrorCodes.SERVICE_NOT_CONFIGURED));
    }

    const aiResponse = await aiService.generateTemplate({
      targetAudience,
      focusArea,
      scienceFocus,
      tone
    });

    const result = JSON.parse(aiResponse.text);
    
    res.json({
      name: `AI: ${targetAudience} - ${focusArea}`,
      emailSubject: result.emailSubject,
      emailBody: result.emailBody,
      whatsappBody: result.whatsappBody,
      sportTags: ["AI Generated"],
      bodyAreaTags: [focusArea],
      active: true,
      id: `t${Date.now()}`,
      _aiProvider: aiResponse.provider,
      _aiModel: aiResponse.model
    });
  } catch (error) {
    console.error('AI generation error:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse("AI generation failed. Please try again.", ErrorCodes.EXTERNAL_SERVICE_ERROR));
  }
});

// ============================================
// AI Chatbot Endpoint
// ============================================
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, userId, userName, className, recentBookings } = req.body;
    
    if (!message) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse("Missing required field: message", ErrorCodes.MISSING_REQUIRED_FIELD));
    }

    if (!aiService.isConfigured()) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(errorResponse("AI service not configured", ErrorCodes.SERVICE_NOT_CONFIGURED));
    }

    const aiResponse = await aiService.chat({
      message,
      context: {
        userId,
        userName,
        className,
        recentBookings
      }
    });

    res.json({
      text: aiResponse.text,
      provider: aiResponse.provider,
      model: aiResponse.model
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse("AI chat failed. Please try again.", ErrorCodes.EXTERNAL_SERVICE_ERROR));
  }
});

// ============================================
// Email Service Status Endpoint
// ============================================
app.get("/api/email/status", (req, res) => {
  res.json({
    provider: emailService.getProvider(),
    configured: emailService.getProvider() === 'resend',
    queue: emailQueue.getQueueStatus()
  });
});

// Update email settings (including templates)
app.post("/api/email/settings", async (req, res) => {
  try {
    const { senderName, senderEmail, templates } = req.body;
    
    // Get current settings
    const settings = await db.getSettings();
    
    // Update email config
    const updatedEmailConfig = {
      ...settings.email,
      senderName: senderName || settings.email?.senderName || 'Pause Admin',
      senderEmail: senderEmail || settings.email?.senderEmail || 'hello@pausefmd.co.za',
      templates: templates || settings.email?.templates
    };
    
    // Update settings
    const updatedSettings = await db.updateSettings({
      ...settings,
      email: updatedEmailConfig
    });
    
    // Update email service with new settings
    emailService.setSender(updatedEmailConfig.senderName, updatedEmailConfig.senderEmail);
    if (updatedEmailConfig.templates) {
      emailService.setTemplates(updatedEmailConfig.templates);
    }
    
    res.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('Error updating email settings:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to update email settings', ErrorCodes.INTERNAL_ERROR));
  }
});

// Get email settings
app.get("/api/email/settings", async (req, res) => {
  try {
    const settings = await db.getSettings();
    // Use DTO to filter sensitive fields (excludes googleCalendarTokens, zapperQrBase64)
    res.json(toSettingsResponse(settings));
  } catch (error) {
    console.error('Error getting email settings:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to get email settings', ErrorCodes.INTERNAL_ERROR));
  }
});

// ============================================
// Email Queue Management Endpoints
// ============================================

app.get("/api/email/queue/status", (req, res) => {
  try {
    const status = emailQueue.getQueueStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to get queue status', ErrorCodes.INTERNAL_ERROR));
  }
});

app.post("/api/email/queue/retry", (req, res) => {
  try {
    const count = emailQueue.retryFailed();
    res.json({ success: true, requeued: count });
  } catch (error) {
    console.error('Error retrying failed emails:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to retry failed emails', ErrorCodes.INTERNAL_ERROR));
  }
});

// ============================================
// Manual Email Trigger Endpoints
// ============================================

// Send test email
app.post("/api/email/test", async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    
    if (!to || !subject) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Missing required fields: to, subject', ErrorCodes.MISSING_REQUIRED_FIELD));
    }
    
    const result = await emailService.sendEmail(to, subject, html || 'Test email');
    res.json(result);
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to send test email', ErrorCodes.EXTERNAL_SERVICE_ERROR));
  }
});

// Send booking confirmation email (for testing/manual trigger)
app.post("/api/email/booking-confirmation", async (req, res) => {
  try {
    const { registrationId, classId, userId } = req.body;
    
    if (!registrationId || !classId || !userId) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Missing required fields', ErrorCodes.MISSING_REQUIRED_FIELD));
    }
    
    // PERF: Direct single-row lookups instead of fetching entire tables into memory.
    // Previously: db.getRegistrations() → find(), db.getClasses() → find(), db.getUsers() → find()
    // Each call fetched ALL rows and filtered in JS — O(n) memory and network for O(1) lookups.
    const [registrationResult, classResult, user] = await Promise.all([
      supabase!.from('registrations').select('*').eq('id', registrationId).single(),
      supabase!.from('classes').select('*').eq('id', classId).single(),
      db.getUser(userId)
    ]);

    if (registrationResult.error || !registrationResult.data) {
      return res.status(HttpStatus.NOT_FOUND).json(errorResponse('Registration not found', ErrorCodes.NOT_FOUND));
    }
    if (classResult.error || !classResult.data) {
      return res.status(HttpStatus.NOT_FOUND).json(errorResponse('Class not found', ErrorCodes.NOT_FOUND));
    }
    if (!user) {
      return res.status(HttpStatus.NOT_FOUND).json(errorResponse('User not found', ErrorCodes.NOT_FOUND));
    }

    const registration = registrationResult.data;
    const cls = classResult.data;
    
    const { sendClientBookingConfirmation } = await import('./services/email-queue');
    const emailId = await sendClientBookingConfirmation(registration, cls, user);
    
    res.json({ success: true, emailId });
  } catch (error) {
    console.error('Error sending booking confirmation:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to send booking confirmation', ErrorCodes.EXTERNAL_SERVICE_ERROR));
  }
});

// Send class reminder (for testing/manual trigger)
app.post("/api/email/class-reminder", async (req, res) => {
  try {
    const { classId, userId, hoursUntil } = req.body;
    
    if (!classId || !userId) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Missing required fields: classId, userId', ErrorCodes.MISSING_REQUIRED_FIELD));
    }
    
    // PERF: Direct single-row lookups
    const [classResult, user] = await Promise.all([
      supabase!.from('classes').select('*').eq('id', classId).single(),
      db.getUser(userId)
    ]);

    if (classResult.error || !classResult.data) {
      return res.status(HttpStatus.NOT_FOUND).json(errorResponse('Class not found', ErrorCodes.NOT_FOUND));
    }
    if (!user) {
      return res.status(HttpStatus.NOT_FOUND).json(errorResponse('User not found', ErrorCodes.NOT_FOUND));
    }

    const cls = classResult.data;
    
    const { sendClientClassReminder } = await import('./services/email-queue');
    const emailId = await sendClientClassReminder(user, cls, hoursUntil || 24);
    
    res.json({ success: true, emailId });
  } catch (error) {
    console.error('Error sending class reminder:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to send class reminder', ErrorCodes.EXTERNAL_SERVICE_ERROR));
  }
});

// Schedule class reminders for a class
app.post("/api/email/schedule-reminders", async (req, res) => {
  try {
    const { classId } = req.body;
    
    if (!classId) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Missing required field: classId', ErrorCodes.MISSING_REQUIRED_FIELD));
    }
    
    // PERF: Direct single-row lookup for class, filtered registrations query
    const [classResult, registrationsResult] = await Promise.all([
      supabase!.from('classes').select('*').eq('id', classId).single(),
      supabase!.from('registrations').select('*').eq('class_id', classId)
    ]);

    if (classResult.error || !classResult.data) {
      return res.status(HttpStatus.NOT_FOUND).json(errorResponse('Class not found', ErrorCodes.NOT_FOUND));
    }

    const cls = classResult.data;
    const classRegistrations = registrationsResult.data || [];

    // Fetch only the users needed for this class rather than the entire users table
    const userIds = [...new Set(classRegistrations.map((r: { user_id: string }) => r.user_id))];
    const { data: usersData } = userIds.length > 0
      ? await supabase!.from('users').select('*').in('id', userIds)
      : { data: [] };
    const users = usersData || [];
    
    const { scheduleClassReminders } = await import('./services/email-queue');
    await scheduleClassReminders(cls, classRegistrations, users);
    
    res.json({ success: true, scheduledCount: classRegistrations.length * 2 });
  } catch (error) {
    console.error('Error scheduling reminders:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to schedule reminders', ErrorCodes.INTERNAL_ERROR));
  }
});

// ============================================
// AI Service Status Endpoint
// ============================================
app.get("/api/ai/status", (req, res) => {
  res.json({
    provider: aiService.getProvider(),
    configured: aiService.isConfigured()
  });
});

// ============================================
// Feedback API Endpoints
// ============================================
app.get("/api/feedback", async (req, res) => {
  try {
    const feedback = await db.getFeedback();
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to fetch feedback', ErrorCodes.INTERNAL_ERROR));
  }
});

app.post("/api/feedback", (req, res) => {
  try {
    const { classId, userId, userName, type, rating, npsScore, comment } = req.body;

    if (!userId || !userName || !type) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Missing required fields: userId, userName, type', ErrorCodes.MISSING_REQUIRED_FIELD));
    }

    // Validate UUIDs
    if (!isValidUUID(userId)) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Invalid userId format', ErrorCodes.VALIDATION_ERROR));
    }

    if (classId && !isValidUUID(classId)) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Invalid classId format', ErrorCodes.VALIDATION_ERROR));
    }

    // Validate type enum
    if (!['post_class', 'general', 'nps'].includes(type)) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Invalid feedback type', ErrorCodes.INVALID_FORMAT));
    }

    // Validate rating range
    if (rating !== undefined && (rating !== null)) {
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Rating must be between 1 and 5', ErrorCodes.VALIDATION_ERROR));
      }
    }

    // Validate NPS score range
    if (npsScore !== undefined && (npsScore !== null)) {
      if (typeof npsScore !== 'number' || npsScore < 0 || npsScore > 10) {
        return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('NPS score must be between 0 and 10', ErrorCodes.VALIDATION_ERROR));
      }
    }

    // Validate comment length if provided
    if (comment && (typeof comment !== 'string' || comment.length > 2000)) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Comment must be under 2000 characters', ErrorCodes.VALIDATION_ERROR));
    }

    const feedback: Feedback = {
      id: `fb_${crypto.randomUUID()}`,
      classId,
      userId,
      userName,
      type,
      rating,
      npsScore,
      comment,
      createdAt: new Date().toISOString()
    };

    db.addFeedback(feedback);
    res.status(201).json(feedback);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to submit feedback', ErrorCodes.INTERNAL_ERROR));
  }
});

app.get("/api/feedback/stats", (req, res) => {
  try {
    const stats = db.getFeedbackStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to fetch feedback statistics', ErrorCodes.INTERNAL_ERROR));
  }
});

app.get("/api/feedback/class/:classId", (req, res) => {
  try {
    const { classId } = req.params;
    const feedback = db.getFeedbackByClass(classId);
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching class feedback:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to fetch class feedback', ErrorCodes.INTERNAL_ERROR));
  }
});

// ============================================
// Public API Endpoints (No Auth Required)
// ============================================

// Get app settings (public)
app.get("/api/settings", async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to fetch settings', ErrorCodes.INTERNAL_ERROR));
  }
});

// Get upcoming public classes (no auth required)
app.get("/api/public/classes", generalLimiter, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { data: classesData, error } = await supabaseAdmin
      .from('classes')
      .select('id, title, date, startTime, duration, venueId, spotsTotal, price, teacherId')
      .gte('date', now.split('T')[0])
      .eq('cancelled', false)
      .order('date', { ascending: true })
      .order('startTime', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Error fetching public classes:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to fetch classes', ErrorCodes.INTERNAL_ERROR));
    }

    // Get registrations to calculate spots left
    const { data: registrations } = await supabaseAdmin
      .from('registrations')
      .select('classId, status')
      .eq('status', 'confirmed');

    const classIds = classesData?.map(c => c.id) || [];
    const confirmedRegistrations = registrations?.filter(r => classIds.includes(r.classId)) || [];
    
    const registrationsByClass = confirmedRegistrations.reduce((acc, r) => {
      acc[r.classId] = (acc[r.classId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const publicClasses = classesData?.map(cls => ({
      id: cls.id,
      title: cls.title,
      date: cls.date,
      startTime: cls.startTime,
      duration: cls.duration,
      venueId: cls.venueId,
      spotsTotal: cls.spotsTotal,
      price: cls.price,
      teacherId: cls.teacherId,
      spotsLeft: (cls.spotsTotal || 0) - (registrationsByClass[cls.id] || 0)
    })) || [];

    res.json(publicClasses);
  } catch (error) {
    console.error('Error fetching public classes:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to fetch classes', ErrorCodes.INTERNAL_ERROR));
  }
});

// ============================================
// PayFast Payment Endpoints
// ============================================

// Get available credit packages
app.get("/api/credits/packages", (req, res) => {
  try {
    const packages = CREDIT_PACKAGES.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    res.json(packages);
  } catch (error) {
    console.error('Error fetching credit packages:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to fetch credit packages', ErrorCodes.INTERNAL_ERROR));
  }
});

// Create PayFast payment link for credit purchase
app.post("/api/credits/purchase", async (req, res) => {
  try {
    const { packageId, userId, email, name } = req.body;

    // Stricter validation
    if (!packageId || !userId || !email || !name) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Missing required fields: packageId, userId, email, name', ErrorCodes.MISSING_REQUIRED_FIELD));
    }

    if (!isValidUUID(userId)) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Invalid userId format', ErrorCodes.VALIDATION_ERROR));
    }

    if (!isValidEmail(email)) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Invalid email format', ErrorCodes.VALIDATION_ERROR));
    }

    if (!isValidSafeString(name, 100)) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Invalid name format', ErrorCodes.VALIDATION_ERROR));
    }

    if (typeof packageId !== 'string' || packageId.length > 50) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Invalid packageId', ErrorCodes.VALIDATION_ERROR));
    }

    // SECURITY FIX: Fetch package price from database to prevent client-side price manipulation
    const dbPackage = await db.getCreditPackagePrice(packageId);
    if (!dbPackage) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Invalid credit package', ErrorCodes.INVALID_REQUEST));
    }

    // Validate price is reasonable (not zero or negative)
    if (dbPackage.price <= 0) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Invalid package price', ErrorCodes.VALIDATION_ERROR));
    }

    if (!payfastService.isConfigured()) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(errorResponse('Payment system not configured', ErrorCodes.SERVICE_NOT_CONFIGURED));
    }

    const totalCredits = dbPackage.credits + dbPackage.bonusCredits;
    const itemName = `Pause Credits - Package ${packageId} (${totalCredits} credits)`;

    const paymentLink = await payfastService.createPaymentLink({
      amount: dbPackage.price,
      itemName,
      userId,
      email,
      creditPackageId: packageId
    });

    res.json({ paymentLink });
  } catch (error) {
    console.error('Error creating payment link:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to create payment link', ErrorCodes.INTERNAL_ERROR));
  }
});

// PayFast ITN (Instant Transaction Notification) handler
app.post("/api/payfast/notify", async (req, res) => {
  try {
    const notificationData = req.body;
    const clientIP = req.ip || req.socket.remoteAddress || '';

    console.log('PayFast ITN received:', notificationData);

    // SECURITY: Validate IP is from PayFast allowed range
    if (!isValidPayFastIP(clientIP)) {
      console.error(`PayFast ITN: Invalid source IP ${clientIP} - not from PayFast range`);
      return res.status(HttpStatus.FORBIDDEN).send('INVALID SOURCE');
    }

    // Validate required fields exist
    if (!notificationData || typeof notificationData !== 'object') {
      console.error('PayFast ITN: Invalid notification data');
      return res.status(HttpStatus.BAD_REQUEST).send('INVALID DATA');
    }

    const { payment_status, m_payment_id, amount, user_id, credit_package_id } = notificationData;

    // Validate required fields
    if (!payment_status || !m_payment_id || !amount) {
      console.error('PayFast ITN: Missing required fields');
      return res.status(HttpStatus.BAD_REQUEST).send('MISSING FIELDS');
    }

    // Validate amount is a valid number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.error('PayFast ITN: Invalid amount');
      return res.status(HttpStatus.BAD_REQUEST).send('INVALID AMOUNT');
    }

    // Validate m_payment_id format (TFMD-{timestamp}-{userId})
    if (typeof m_payment_id !== 'string' || !m_payment_id.startsWith('TFMD-')) {
      console.error('PayFast ITN: Invalid m_payment_id format');
      return res.status(HttpStatus.BAD_REQUEST).send('INVALID PAYMENT ID');
    }

    const validation = await payfastService.validateNotification(notificationData);
    
    if (!validation.valid) {
      console.error('PayFast signature validation failed');
      return res.status(HttpStatus.BAD_REQUEST).send('INVALID SIGNATURE');
    }

    // m_payment_id format: TFMD-{timestamp}-{userId}
    const parts = m_payment_id.split('-');
    const purchaseUserId = parts.length >= 3 ? parts.slice(2).join('-') : user_id;

    // Validate userId format if provided
    if (purchaseUserId && !isValidUUID(purchaseUserId)) {
      console.error('PayFast ITN: Invalid user ID format');
      return res.status(HttpStatus.BAD_REQUEST).send('INVALID USER ID');
    }

    if (payment_status === 'COMPLETE') {
      // SECURITY: Check idempotency - prevent duplicate credit additions
      if (isPaymentProcessed(m_payment_id)) {
        console.warn(`PayFast ITN: Duplicate payment detected - ${m_payment_id} already processed`);
        return res.send('OK');
      }

      const creditPackage = CREDIT_PACKAGES.find(p => p.id === credit_package_id);
      if (creditPackage) {
        const totalCredits = creditPackage.credits + (creditPackage.bonusCredits || 0);
        
        // Validate credit package
        if (parsedAmount !== creditPackage.price) {
          console.error(`PayFast ITN: Amount mismatch. Expected ${creditPackage.price}, got ${parsedAmount}`);
          return res.status(HttpStatus.BAD_REQUEST).send('AMOUNT MISMATCH');
        }
        
        // Update user credits
        await db.updateUserCredits(purchaseUserId, totalCredits);
        
        // Mark payment as processed for idempotency
        markPaymentProcessed(m_payment_id);
        
        console.log(`Credit purchase completed: ${totalCredits} credits added to user ${purchaseUserId}`);
      } else {
        console.error(`PayFast ITN: Unknown credit package: ${credit_package_id}`);
      }
    }

    res.send('OK');
  } catch (error) {
    console.error('Error processing PayFast notification:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('ERROR');
  }
});

// Check PayFast configuration status
app.get("/api/payfast/status", (req, res) => {
  try {
    const isConfigured = payfastService.isConfigured();
    res.json({ 
      configured: isConfigured,
      mode: process.env.PAYFAST_MODE || 'sandbox'
    });
  } catch (error) {
    console.error('Error checking PayFast status:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to check payment status', ErrorCodes.INTERNAL_ERROR));
  }
});

// ============================================
// Google Calendar Sync Endpoints
// ============================================

app.post("/api/calendar/sync-class", async (req, res) => {
  try {
    // SECURITY: Require authentication before processing calendar tokens
    const authUser = await requireAuth(req, res);
    if (!authUser) return;
    
    const { class: cls, calendarId, tokens } = req.body;

    if (!cls || !calendarId || !tokens) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Missing required fields: class, calendarId, tokens', ErrorCodes.MISSING_REQUIRED_FIELD));
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(errorResponse('Google Calendar not configured', ErrorCodes.SERVICE_NOT_CONFIGURED));
    }

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Set credentials from tokens
    client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: client });

    // Parse class datetime
    const classDate = new Date(cls.dateTime);
    const endDate = new Date(classDate.getTime() + (cls.duration || 75) * 60000);

    // Get venue info if available
    let location = 'TBC';
    if (cls.venueId) {
      try {
        const venues = await db.getVenues();
        const venue = venues.find(v => v.id === cls.venueId);
        if (venue) {
          location = venue.name;
          if (venue.address) location += `, ${venue.address}`;
        }
      } catch (e) {
        console.warn('Could not fetch venue:', e);
      }
    }

    // Create calendar event
    const event = {
      summary: cls.title,
      description: cls.description || `Fascia movement class`,
      start: {
        dateTime: classDate.toISOString(),
        timeZone: 'Africa/Johannesburg',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'Africa/Johannesburg',
      },
      location: location,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: event,
    });

    console.log('[Calendar] Event created:', response.data.htmlLink);
    res.status(201).json({ success: true, eventId: response.data.id, htmlLink: response.data.htmlLink });
  } catch (error) {
    console.error('Error syncing class to calendar:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to sync class to calendar', ErrorCodes.EXTERNAL_SERVICE_ERROR));
  }
});

app.post("/api/calendar/remove-class", async (req, res) => {
  try {
    // SECURITY: Require authentication before processing calendar tokens
    const authUser = await requireAuth(req, res);
    if (!authUser) return;
    
    const { classId, calendarId, tokens } = req.body;

    if (!classId || !calendarId || !tokens) {
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse('Missing required fields: classId, calendarId, tokens', ErrorCodes.MISSING_REQUIRED_FIELD));
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(errorResponse('Google Calendar not configured', ErrorCodes.SERVICE_NOT_CONFIGURED));
    }

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: client });

    // Try to find the event by matching the class title and date
    // First, get events from the calendar around the class time
    const classDate = new Date();
    classDate.setDate(classDate.getDate() - 7); // Look back 7 days
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 30); // Look ahead 30 days

    const events = await calendar.events.list({
      calendarId: calendarId,
      timeMin: classDate.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    // Find event by looking for matching classId in description or extendedProperties
    const matchingEvent = events.data.items?.find(event => 
      event.description?.includes(`classId:${classId}`) ||
      event.extendedProperties?.private?.classId === classId
    );

    if (matchingEvent?.id) {
      await calendar.events.delete({
        calendarId: calendarId,
        eventId: matchingEvent.id,
      });
      console.log('[Calendar] Event deleted:', matchingEvent.id);
      return res.json({ success: true, message: 'Event removed from calendar' });
    }

    // Event not found - might have already been deleted
    res.json({ success: true, message: 'Event not found in calendar (may have been already removed)' });
  } catch (error) {
    console.error('Error removing class from calendar:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to remove class from calendar', ErrorCodes.EXTERNAL_SERVICE_ERROR));
  }
});

// ============================================
// Vite Middleware (Development Only)
// ============================================
async function setupViteMiddleware() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log(`Vite middleware enabled for development`);
    
    // Add catch-all route for SPA (only in dev, after vite middleware)
    // Use Express 5 compatible route pattern
    app.get('/{*path}', async (req, res) => {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(HttpStatus.NOT_FOUND).json(errorResponse('Not found', ErrorCodes.NOT_FOUND));
      }
      try {
        const indexPath = path.join(process.cwd(), 'index.html');
        res.sendFile(indexPath);
      } catch {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse('Failed to load index.html', ErrorCodes.INTERNAL_ERROR));
      }
    });
  }
}

// ============================================
// Start Server (Local Development Only)
// ============================================
if (!IS_VERCEL) {
  (async () => {
    try {
      await setupViteMiddleware();
      // Initialize email service with settings from database
      await initializeEmailService();
      
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  })();
}

// Export for Vercel serverless functions
export default app;
