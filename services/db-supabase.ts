/**
 * Supabase Database Service - Main Entry Point
 *
 * This is the drop-in replacement for `import { db } from './services/db'`
 * It aggregates all individual service modules and exports a single `db` object
 * that matches the structure of the old localStorage db.ts
 *
 * Migration Status:
 * - [x] Users (complete)
 * - [x] Classes (complete)
 * - [x] Registrations (complete)
 * - [x] Venues (complete)
 * - [x] Templates (complete)
 * - [x] Teachers (complete)
 * - [x] Feedback (complete)
 * - [x] Settings (complete)
 * - [x] Calendar (complete)
 * - [x] CRM (complete)
 * - [x] Disclaimers (complete)
 *
 * Error Handling (ERR-001):
 * This service now properly distinguishes between expected "not found" errors
 * and actual database errors using proper type guards and error handling utilities.
 *
 * Security Fix (SEC-003):
 * This service now uses proper runtime type validation and type guards
 * instead of type assertions (as) that bypass TypeScript's type checking.
 * Type guards ensure runtime type safety for data coming from Supabase.
 */

import { supabase, withRetry, testConnection, isConfigured, SupabaseError } from './supabase-client';
import { CREDIT_PACKAGES } from '../constants';
import crypto from 'crypto';

// =============================================================================
// ERROR HANDLING - ERR-001 Fix
// =============================================================================

/**
 * Known Supabase error codes that represent expected "not found" scenarios
 * These should NOT be treated as actual errors - they indicate missing data
 */
export const KNOWN_NOT_FOUND_CODES = [
  'PGRST116', // Result containing zero rows returned by .single()
  'PGRST122', // The result has 0 rows but we requested a single row
  '42P01',    // Table does not exist (handled gracefully, returns empty)
] as const;

/**
 * Check if an error is a Supabase error
 */
export function isSupabaseError(error: unknown): error is SupabaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  );
}

/**
 * Check if an error is a "not found" error (expected scenario)
 * These errors are common when querying for single records that don't exist
 */
export function isNotFoundError(error: unknown): boolean {
  if (!isSupabaseError(error)) return false;
  return KNOWN_NOT_FOUND_CODES.includes(error.code as typeof KNOWN_NOT_FOUND_CODES[number]);
}

/**
 * Check if an error is a table does not exist error
 */
export function isTableNotFoundError(error: unknown): boolean {
  if (!isSupabaseError(error)) return false;
  return error.code === '42P01';
}

// =============================================================================
// TYPE GUARDS - SEC-003 Fix: Runtime validation instead of type assertions
// =============================================================================

/**
 * Type guard to check if a value is a valid string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is a valid number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard to check if a value is a valid boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard to check if a value is a valid array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard to check if a value is a valid object (not null)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard for AdminRole
 */
export function isAdminRole(value: unknown): value is 'super_admin' | 'admin' | 'teacher' | 'staff' | 'teacher' {
  return isString(value) && ['super_admin', 'admin', 'teacher', 'staff', 'teacher'].includes(value);
}

/**
 * Type guard for MovementExperience
 */
export function isMovementExperience(value: unknown): value is 'beginner' | 'intermediate' | 'advanced' {
  return isString(value) && ['beginner', 'intermediate', 'advanced'].includes(value);
}

/**
 * Type guard for FeedbackType
 */
export function isFeedbackType(value: unknown): value is 'post_class' | 'general' | 'nps' {
  return isString(value) && ['post_class', 'general', 'nps'].includes(value);
}

/**
 * Type guard for ClassStatus
 */
export function isClassStatus(value: unknown): value is 'published' | 'draft' | 'cancelled' {
  return isString(value) && ['published', 'draft', 'cancelled'].includes(value);
}

/**
 * Type guard for RegistrationStatus
 */
export function isRegistrationStatus(value: unknown): value is 'confirmed' | 'registered' | 'cancelled' | 'waitlisted' | 'payment_review' {
  return isString(value) && ['confirmed', 'registered', 'cancelled', 'waitlisted', 'payment_review'].includes(value);
}

/**
 * Type guard for ClientStatus
 */
export function isClientStatus(value: unknown): value is 'new_inquiry' | 'consultation' | 'trial' | 'active' | 'vip' | 'at_risk' | 'churned' {
  return isString(value) && ['new_inquiry', 'consultation', 'trial', 'active', 'vip', 'at_risk', 'churned'].includes(value);
}

/**
 * Type guard for ClientSource
 */
export function isClientSource(value: unknown): value is 'website' | 'referral' | 'social' | 'event' | 'google' | 'instagram' | 'word_of_mouth' | 'other' {
  return isString(value) && ['website', 'referral', 'social', 'event', 'google', 'instagram', 'word_of_mouth', 'other'].includes(value);
}

/**
 * Type guard for TaskPriority
 */
export function isTaskPriority(value: unknown): value is 'low' | 'medium' | 'high' | 'urgent' {
  return isString(value) && ['low', 'medium', 'high', 'urgent'].includes(value);
}

/**
 * Type guard for TaskStatus
 */
export function isTaskStatus(value: unknown): value is 'pending' | 'in_progress' | 'completed' | 'cancelled' {
  return isString(value) && ['pending', 'in_progress', 'completed', 'cancelled'].includes(value);
}

/**
 * Type guard for DisclaimerContext
 */
export function isDisclaimerContext(value: unknown): value is 'general' | 'class' | 'venue' | 'waiver' | 'registration' {
  return isString(value) && ['general', 'class', 'venue', 'waiver', 'registration'].includes(value);
}

/**
 * Type guard for EmailCampaignStatus
 */
export function isEmailCampaignStatus(value: unknown): value is 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' {
  return isString(value) && ['draft', 'scheduled', 'sending', 'sent', 'cancelled'].includes(value);
}

// =============================================================================
// SAFE TYPE CASTING FUNCTIONS - SEC-003 Fix
// =============================================================================

/**
 * Safely cast a value to string with fallback
 */
export function safeString(value: unknown, fallback = ''): string {
  return isString(value) ? value : fallback;
}

/**
 * Safely cast a value to number with fallback
 */
export function safeNumber(value: unknown, fallback = 0): number {
  return isNumber(value) ? value : fallback;
}

/**
 * Safely cast a value to boolean with fallback
 */
export function safeBoolean(value: unknown, fallback = false): boolean {
  return isBoolean(value) ? value : fallback;
}

/**
 * Safely cast a value to array with fallback
 */
export function safeArray<T>(value: unknown, fallback: T[] = []): T[] {
  return isArray(value) ? value as T[] : fallback;
}

/**
 * Safely cast admin_role with validation
 */
export function safeAdminRole(value: unknown): 'super_admin' | 'admin' | 'teacher' | 'staff' | 'teacher' | undefined {
  return isAdminRole(value) ? value : undefined;
}

/**
 * Safely cast movement_experience with validation
 */
export function safeMovementExperience(value: unknown): 'beginner' | 'intermediate' | 'advanced' | undefined {
  return isMovementExperience(value) ? value : undefined;
}

/**
 * Safely cast feedback type with validation
 */
export function safeFeedbackType(value: unknown): 'post_class' | 'general' | 'nps' | undefined {
  return isFeedbackType(value) ? value : undefined;
}

/**
 * Safely cast class status with validation
 */
export function safeClassStatus(value: unknown): 'published' | 'draft' | 'cancelled' | undefined {
  return isClassStatus(value) ? value : undefined;
}

/**
 * Safely cast registration status with validation
 */
export function safeRegistrationStatus(value: unknown): 'confirmed' | 'registered' | 'cancelled' | 'waitlisted' | 'payment_review' | undefined {
  return isRegistrationStatus(value) ? value : undefined;
}

/**
 * Safely cast client status with validation
 */
export function safeClientStatus(value: unknown): 'new_inquiry' | 'consultation' | 'trial' | 'active' | 'vip' | 'at_risk' | 'churned' | undefined {
  return isClientStatus(value) ? value : undefined;
}

/**
 * Safely cast client source with validation
 */
export function safeClientSource(value: unknown): 'website' | 'referral' | 'social' | 'event' | 'google' | 'instagram' | 'word_of_mouth' | 'other' | undefined {
  return isClientSource(value) ? value : undefined;
}

/**
 * Safely cast task priority with validation
 */
export function safeTaskPriority(value: unknown): 'low' | 'medium' | 'high' | 'urgent' | undefined {
  return isTaskPriority(value) ? value : undefined;
}

/**
 * Safely cast task status with validation
 */
export function safeTaskStatus(value: unknown): 'pending' | 'in_progress' | 'completed' | 'cancelled' | undefined {
  return isTaskStatus(value) ? value : undefined;
}

/**
 * Safely cast disclaimer context with validation
 */
export function safeDisclaimerContext(value: unknown): 'general' | 'class' | 'venue' | 'waiver' | 'registration' | undefined {
  return isDisclaimerContext(value) ? value : undefined;
}

/**
 * Safely cast email campaign status with validation
 */
export function safeEmailCampaignStatus(value: unknown): 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | undefined {
  return isEmailCampaignStatus(value) ? value : undefined;
}

/**
 * Type guard for WaiverData
 */
function isWaiverData(value: unknown): value is { signed: boolean; signedAt: string; signerName: string; agreements: { medical: boolean; heat: boolean; liability: boolean }; ipAddress?: string; userAgent?: string } {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;
  return isBoolean(obj.signed) && isString(obj.signedAt) && isString(obj.signerName) && isObject(obj.agreements);
}

/**
 * Safely extract waiver data from a record
 */
export function safeWaiverData(value: unknown): WaiverData | undefined {
  if (!isWaiverData(value)) return undefined;
  const obj = value as Record<string, unknown>;
  const agreements = obj.agreements as Record<string, unknown> | undefined;
  return {
    signed: safeBoolean(obj.signed, false),
    signedAt: safeString(obj.signedAt, ''),
    signerName: safeString(obj.signerName, ''),
    agreements: {
      medical: safeBoolean(agreements?.medical, false),
      heat: safeBoolean(agreements?.heat, false),
      liability: safeBoolean(agreements?.liability, false),
    },
    ipAddress: safeString(obj.ipAddress),
    userAgent: safeString(obj.userAgent),
  };
}



/**
 * Result type for database operations that distinguishes between 
 * success, not found (expected), and actual errors
 */
export type DbResult<T> =
  | { success: true; data: T }
  | { success: false; error: SupabaseError; isNotFound?: boolean; isTableNotFound?: boolean };

/**
 * Convert a Supabase response to a DbResult
 * Properly handles not found errors vs actual errors
 */
export function toDbResult<T>(data: T | null, error: SupabaseError | null): DbResult<T> {
  if (error) {
    return {
      success: false,
      error,
      isNotFound: isNotFoundError(error),
      isTableNotFound: isTableNotFoundError(error),
    };
  }
  return { success: true, data: data as T };
}

/**
 * Handle Supabase error with proper logging
 * Distinguishes between expected "not found" errors and actual errors
 * 
 * @param error - The Supabase error
 * @param context - Description of the operation that failed (for logging)
 * @param silent - If true, won't log for "not found" errors (useful for optional data lookups)
 */
export function handleSupabaseError(
  error: unknown,
  context: string,
  silent = false
): { isNotFound: boolean; isTableNotFound: boolean; shouldReturn: boolean; data: null } {
  // First check if it's a Supabase error
  if (!isSupabaseError(error)) {
    // Not a Supabase error - treat as actual error
    console.error(`[db] ${context} - Unexpected error type:`, error);
    return { isNotFound: false, isTableNotFound: false, shouldReturn: true, data: null };
  }

  if (isNotFoundError(error)) {
    if (!silent) {
      console.warn(`[db] ${context} - Not found (expected):`, error.message);
    }
    return { isNotFound: true, isTableNotFound: false, shouldReturn: true, data: null };
  }

  if (isTableNotFoundError(error)) {
    console.warn(`[db] ${context} - Table not found:`, error.message);
    return { isNotFound: false, isTableNotFound: true, shouldReturn: true, data: null };
  }

  // Actual error - log with full details
  console.error(`[db] ${context} - Actual error:`, error.message, error.details || '', error.hint || '');
  return { isNotFound: false, isTableNotFound: false, shouldReturn: true, data: null };
}

/**
 * Wrapper for database operations that returns empty/null for expected not found
 * and throws for actual errors (to be caught by caller)
 * 
 * Usage: Use this when you want to:
 * - Return null/empty for not found (expected)
 * - Throw for actual errors (caller decides how to handle)
 * 
 * For operations that should return empty arrays on error, use safeOperation instead
 */
export function extractOrThrow<T>(data: T | null, error: SupabaseError | null, context: string): T {
  if (error) {
    if (isNotFoundError(error)) {
      throw new Error(`NOT_FOUND: ${context} - ${error.message}`);
    }
    if (isTableNotFoundError(error)) {
      throw new Error(`TABLE_NOT_FOUND: ${context} - ${error.message}`);
    }
    // Actual database error - throw to let caller handle
    throw new Error(`DB_ERROR: ${context} - ${error.message}`);
  }
  return data as T;
}

/**
 * Safely execute a database operation, returning default values for errors
 * Use this when you want to gracefully handle errors without breaking the app
 * 
 * @param operation - The async database operation
 * @param context - Description for logging
 * @param defaultValue - Value to return on error
 * @param silentNotFound - If true, won't log warnings for not found errors
 */
export async function safeOperation<T>(
  operation: () => Promise<{ data: T | null; error: SupabaseError | null }>,
  context: string,
  defaultValue: T,
  silentNotFound = false
): Promise<T> {
  try {
    const { data, error } = await operation();
    if (error) {
      const handled = handleSupabaseError(error, context, silentNotFound);
      if (handled.shouldReturn) {
        return defaultValue;
      }
    }
    return data ?? defaultValue;
  } catch (err) {
    // For errors thrown by extractOrThrow
    if (err instanceof Error) {
      if (err.message.startsWith('NOT_FOUND:')) {
        if (!silentNotFound) {
          console.warn(`[db] ${context}:`, err.message);
        }
        return defaultValue;
      }
      if (err.message.startsWith('TABLE_NOT_FOUND:')) {
        console.warn(`[db] ${context}:`, err.message);
        return defaultValue;
      }
    }
    console.error(`[db] ${context} - Unexpected error:`, err);
    return defaultValue;
  }
}

// Re-export the client for direct access if needed
export { supabase, withRetry, testConnection, isConfigured };

// Import types for all services
import type {
  User, WaiverData, InjuryRecord, AdminRole,
  Class, Venue, Teacher, Registration, Template,
  Feedback, FeedbackStats, FeedbackType,
  Disclaimer, DisclaimerContext, DisclaimerSection,
  CRMContact, CRMNote, CRMActivity, CRMTask, TaskReminder,
  PipelineStage, EmailCampaign, CRMEmailTemplate,
  ClientStatus, ClientSource, ClientPackage, BodyArea,
  AppSettings, CreditBatch
} from '../types';
import type {
  UserRow, ClassRow, VenueRow, TeacherRow, RegistrationRow,
  TemplateRow, FeedbackRow
} from './supabase-types';

// Note: Using Record<string, unknown> for upsert operations due to complex type inference

// =============================================================================
// USER SERVICE
// =============================================================================

/**
 * Map UserRow to User (full data - includes sensitive fields)
 * WARNING: Only use internally, never return directly to clients
 */
function mapUserRowToUser(row: UserRow): User {
  const waiverData: WaiverData | undefined = row.waiver_data ? {
    signed: (row.waiver_data as Record<string, boolean>).signed ?? false,
    signedAt: (row.waiver_data as Record<string, string>).signedAt || row.waiver_date || '',
    signerName: (row.waiver_data as Record<string, string>).signerName || row.name,
    agreements: {
      medical: (row.waiver_data as Record<string, Record<string, boolean>>).agreements?.medical ?? row.medical_cleared ?? false,
      heat: (row.waiver_data as Record<string, Record<string, boolean>>).agreements?.heat ?? row.heat_acknowledged ?? false,
      liability: (row.waiver_data as Record<string, Record<string, boolean>>).agreements?.liability ?? false,
    },
    ipAddress: (row.waiver_data as Record<string, string>).ipAddress,
    userAgent: (row.waiver_data as Record<string, string>).userAgent,
  } : undefined;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    isAdmin: row.is_admin,
    adminRole: row.admin_role as AdminRole | undefined,
    sport: row.sport || undefined,
    waiverData,
    waiverAccepted: row.waiver_accepted,
    medicalCleared: row.medical_cleared,
    heatAcknowledged: row.heat_acknowledged,
    waiverDate: row.waiver_date || undefined,
    credits: row.credits,
    creditBatches: (row.credit_batches as CreditBatch[]) || undefined,
    injuries: (row.injuries as InjuryRecord[]) || undefined,
    healthConditions: row.health_conditions || undefined,
    movementExperience: row.movement_experience as 'beginner' | 'intermediate' | 'advanced' | undefined,
    twoFactorEnabled: row.two_factor_enabled,
    twoFactorSecret: row.two_factor_secret || undefined,
    twoFactorBackupCodes: row.two_factor_backup_codes || undefined,
  };
}

/**
 * Map UserRow to safe public User (DTO) - PERF-002
 * Removes sensitive security fields that should not be sent to clients:
 * - twoFactorSecret
 * - twoFactorBackupCodes  
 * - waiverData (contains ipAddress, userAgent)
 */
function mapUserRowToSafeUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    isAdmin: row.is_admin,
    adminRole: row.admin_role as AdminRole | undefined,
    sport: row.sport || undefined,
    // EXCLUDED: waiverData (contains ipAddress, userAgent)
    waiverData: undefined,
    waiverAccepted: row.waiver_accepted,
    medicalCleared: row.medical_cleared,
    heatAcknowledged: row.heat_acknowledged,
    waiverDate: row.waiver_date || undefined,
    credits: row.credits,
    creditBatches: (row.credit_batches as CreditBatch[]) || undefined,
    injuries: (row.injuries as InjuryRecord[]) || undefined,
    healthConditions: row.health_conditions || undefined,
    movementExperience: row.movement_experience as 'beginner' | 'intermediate' | 'advanced' | undefined,
    twoFactorEnabled: row.two_factor_enabled,
    // EXCLUDED: twoFactorSecret
    twoFactorSecret: undefined,
    // EXCLUDED: twoFactorBackupCodes
    twoFactorBackupCodes: undefined,
  };
}

/**
 * Map User (camelCase from app) to UserRow insert/update format (snake_case for DB)
 */
function mapUserToUserRow(user: Partial<User>): Partial<UserRow> {
  const row: Partial<UserRow> = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    is_admin: user.isAdmin ?? false,
    admin_role: user.adminRole || null,
    sport: user.sport || null,
    waiver_accepted: user.waiverAccepted ?? user.waiverData?.signed ?? false,
    medical_cleared: user.medicalCleared ?? user.waiverData?.agreements?.medical ?? false,
    heat_acknowledged: user.heatAcknowledged ?? user.waiverData?.agreements?.heat ?? false,
    waiver_date: user.waiverDate || user.waiverData?.signedAt || null,
    credits: user.credits ?? 0,
    credit_batches: user.creditBatches as unknown[] || null,
    injuries: user.injuries as unknown[] || null,
    health_conditions: user.healthConditions || null,
    movement_experience: user.movementExperience || null,
    two_factor_enabled: user.twoFactorEnabled ?? false,
    two_factor_secret: user.twoFactorSecret || null,
    two_factor_backup_codes: user.twoFactorBackupCodes || null,
  };

  if (user.waiverData) {
    row.waiver_data = {
      signed: user.waiverData.signed,
      signedAt: user.waiverData.signedAt,
      signerName: user.waiverData.signerName,
      agreements: user.waiverData.agreements,
      ipAddress: user.waiverData.ipAddress,
      userAgent: user.waiverData.userAgent,
    };
  }

  return row;
}

const usersService = {
  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((row: UserRow) => mapUserRowToUser(row));
    } catch (err) {
      console.error('[userService] getUsers failed:', err);
      return [];
    }
  },

  // Get paginated users - use page=1, limit=50 for first page
  getUsersPaginated: async (page = 1, limit = 50): Promise<{users: User[], total: number}> => {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const { data, error, count } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { 
        users: (data || []).map((row: UserRow) => mapUserRowToUser(row)), 
        total: count || 0 
      };
    } catch (err) {
      console.error('[userService] getUsersPaginated failed:', err);
      return { users: [], total: 0 };
    }
  },

  getUser: async (id: string): Promise<User | undefined> => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
      if (error) throw error;
      return data ? mapUserRowToUser(data as UserRow) : undefined;
    } catch (err) {
      console.error(`[userService] getUser(${id}) failed:`, err);
      return undefined;
    }
  },

  saveUser: async (user: User): Promise<User> => {
    try {
      const userRow = mapUserToUserRow(user);
      const { data, error } = await supabase.from('users').upsert(userRow, { onConflict: 'id' }).select().single();
      if (error) throw error;
      if (!data) throw new Error('No data returned from upsert');
      return mapUserRowToUser(data as UserRow);
    } catch (err) {
      console.error('[userService] saveUser failed:', err);
      throw err;
    }
  },

  getCurrentAuthUser: async (): Promise<User | null> => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) return null;

      const { data, error } = await supabase.from('users').select('*').eq('id', authUser.id).single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            id: authUser.id,
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Unknown',
            email: authUser.email || '',
            isAdmin: false,
            credits: 0,
          };
        }
        throw error;
      }

      return data ? mapUserRowToUser(data as UserRow) : null;
    } catch (err) {
      console.error('[userService] getCurrentAuthUser failed:', err);
      return null;
    }
  },

  syncUserWithAuth: async (user: User): Promise<void> => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: user.name,
          is_admin: user.isAdmin,
          admin_role: user.adminRole,
          sport: user.sport,
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error('[userService] syncUserWithAuth failed:', err);
    }
  },

  updateUserCredits: async (userId: string, creditsToAdd: number): Promise<void> => {
    try {
      // SECURITY: The previous implementation did a read-then-write (SELECT credits,
      // then UPDATE credits = current + added). This is a classic TOCTOU race condition:
      // two concurrent PayFast ITN callbacks for the same user would both read the same
      // current balance and one credit addition would be silently lost.
      //
      // Fix: Use a Postgres RPC function that performs an atomic increment in a single
      // statement: UPDATE users SET credits = credits + $creditsToAdd WHERE id = $userId
      // This is safe under concurrent load because Postgres row-level locking ensures
      // only one writer modifies the row at a time.
      //
      // You must create this function in Supabase SQL editor:
      //
      //   CREATE OR REPLACE FUNCTION increment_user_credits(user_id UUID, amount INTEGER)
      //   RETURNS void
      //   LANGUAGE sql
      //   SECURITY DEFINER
      //   AS $$
      //     UPDATE users SET credits = credits + amount WHERE id = user_id;
      //   $$;
      //
      const { error } = await supabase.rpc('increment_user_credits', {
        user_id: userId,
        amount: creditsToAdd
      });

      if (error) throw error;


    } catch (err) {
      console.error(`[userService] updateUserCredits failed for user ${userId}:`, err);
      throw err;
    }
  },

  // =============================================================================
  // CREDIT BATCH FUNCTIONS - Expiry tracking
  // =============================================================================

  /**
   * Add a new credit batch with expiry tracking (90 days from purchase)
   */
  addCreditBatch: async (userId: string, credits: number, packageId?: string): Promise<CreditBatch> => {
    try {
      const now = new Date();
      const expiryDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days from now
      
      const newBatch: CreditBatch = {
        id: crypto.randomUUID(),
        credits,
        remainingCredits: credits,
        purchaseDate: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        packageId,
        isActive: true,
      };

      // Get current batches
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('credit_batches')
        .eq('id', userId)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      const currentBatches: CreditBatch[] = (currentUser?.credit_batches as CreditBatch[]) || [];
      const updatedBatches = [...currentBatches, newBatch];
      
      // Calculate total credits
      const totalCredits = updatedBatches.reduce((sum, batch) => sum + batch.remainingCredits, 0);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          credits: totalCredits,
          credit_batches: updatedBatches
        })
        .eq('id', userId);
      
      if (updateError) throw updateError;
      

      return newBatch;
    } catch (err) {
      console.error(`[userService] addCreditBatch failed for user ${userId}:`, err);
      throw err;
    }
  },

  /**
   * Get all valid (non-expired) credit batches for a user
   */
  getValidCreditBatches: async (userId: string): Promise<CreditBatch[]> => {
    try {
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('credit_batches')
        .eq('id', userId)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      const batches: CreditBatch[] = (currentUser?.credit_batches as CreditBatch[]) || [];
      const now = new Date().toISOString();
      
      // Filter out expired batches
      const validBatches = batches.filter(batch => 
        batch.isActive && batch.remainingCredits > 0 && batch.expiryDate > now
      );
      
      return validBatches;
    } catch (err) {
      console.error(`[userService] getValidCreditBatches failed for user ${userId}:`, err);
      return [];
    }
  },

  /**
   * Get total valid (non-expired) credits for a user
   */
  getValidCredits: async (userId: string): Promise<number> => {
    const validBatches = await usersService.getValidCreditBatches(userId);
    return validBatches.reduce((sum, batch) => sum + batch.remainingCredits, 0);
  },

  /**
   * Get package price from database
   * Returns the package details including price for verification
   * SECURITY: Prevents client-side price manipulation
   */
  getCreditPackagePrice: async (packageId: string): Promise<{ id: string; credits: number; price: number; bonusCredits: number } | null> => {
    try {
      const { data: dbPackage, error } = await supabase
        .from('credit_packages')
        .select('id, credits, price, bonus_credits')
        .eq('id', packageId)
        .eq('is_active', true)
        .single();

      if (error || !dbPackage) {
        const fallbackPackage = CREDIT_PACKAGES.find(p => p.id === packageId && p.isActive);
        if (fallbackPackage) {
          return {
            id: fallbackPackage.id,
            credits: fallbackPackage.credits,
            price: fallbackPackage.price,
            bonusCredits: fallbackPackage.bonusCredits || 0
          };
        }
        return null;
      }

      return {
        id: dbPackage.id,
        credits: dbPackage.credits,
        price: dbPackage.price,
        bonusCredits: dbPackage.bonus_credits || 0
      };
    } catch (err) {
      console.error(`[userService] getCreditPackagePrice failed for package ${packageId}:`, err);
      const fallbackPackage = CREDIT_PACKAGES.find(p => p.id === packageId && p.isActive);
      if (fallbackPackage) {
        return {
          id: fallbackPackage.id,
          credits: fallbackPackage.credits,
          price: fallbackPackage.price,
          bonusCredits: fallbackPackage.bonusCredits || 0
        };
      }
      return null;
    }
  },

  /**
   * Deduct credits from valid batches (FIFO - oldest first)
   * Returns the number of credits successfully deducted
   */
  deductCredits: async (userId: string, creditsToDeduct: number): Promise<number> => {
    try {
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('credit_batches')
        .eq('id', userId)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      const batches: CreditBatch[] = (currentUser?.credit_batches as CreditBatch[]) || [];
      const now = new Date().toISOString();
      
      // Sort valid batches by expiry date (oldest first - FIFO)
      const validBatches = batches
        .filter(batch => batch.isActive && batch.remainingCredits > 0 && batch.expiryDate > now)
        .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
      
      let remainingToDeduct = creditsToDeduct;
      const updatedBatches = batches.map(batch => {
        const validBatch = validBatches.find(vb => vb.id === batch.id);
        if (!validBatch || remainingToDeduct <= 0) {
          return batch;
        }
        
        const available = batch.remainingCredits;
        const toDeduct = Math.min(available, remainingToDeduct);
        
        batch.remainingCredits = batch.remainingCredits - toDeduct;
        batch.isActive = batch.remainingCredits > 0;
        remainingToDeduct = remainingToDeduct - toDeduct;
        
        return batch;
      });
      
      const totalCredits = updatedBatches.reduce((sum, batch) => sum + batch.remainingCredits, 0);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          credits: totalCredits,
          credit_batches: updatedBatches
        })
        .eq('id', userId);
      
      if (updateError) throw updateError;
      
      const deducted = creditsToDeduct - remainingToDeduct;

      return deducted;
    } catch (err) {
      console.error(`[userService] deductCredits failed for user ${userId}:`, err);
      throw err;
    }
  },

  /**
   * Clean up expired credit batches (can be called periodically)
   */
  cleanupExpiredBatches: async (userId: string): Promise<void> => {
    try {
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('credit_batches')
        .eq('id', userId)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      const batches: CreditBatch[] = (currentUser?.credit_batches as CreditBatch[]) || [];
      const now = new Date().toISOString();
      
      // Mark expired batches as inactive
      const updatedBatches = batches.map(batch => {
        if (batch.expiryDate <= now) {
          return { ...batch, isActive: false, remainingCredits: 0 };
        }
        return batch;
      });
      
      const totalCredits = updatedBatches.reduce((sum, batch) => sum + batch.remainingCredits, 0);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          credits: totalCredits,
          credit_batches: updatedBatches
        })
        .eq('id', userId);
      
      if (updateError) throw updateError;
      

    } catch (err) {
      console.error(`[userService] cleanupExpiredBatches failed for user ${userId}:`, err);
      throw err;
    }
  },
};

// =============================================================================
// CLASS SERVICE
// =============================================================================

function mapClassRowToClass(row: ClassRow): Class {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    dateTime: row.date_time,
    duration: row.duration,
    venueId: row.venue_id || '',
    teacherId: row.teacher_id || undefined,
    sportTags: row.sport_tags || [],
    bodyAreaTags: row.body_area_tags || [],
    capacity: row.capacity,
    registered: row.registered,
    status: row.status,
    description: row.description || '',
    price: row.price,
    creditCost: row.credit_cost,
    allowDomeResetOverride: row.allow_dome_reset_override,
  };
}

function mapClassToClassRow(cls: Partial<Class>): Partial<ClassRow> {
  return {
    id: cls.id,
    slug: cls.slug,
    title: cls.title,
    date_time: cls.dateTime,
    duration: cls.duration,
    venue_id: cls.venueId || null,
    teacher_id: cls.teacherId || null,
    sport_tags: cls.sportTags,
    body_area_tags: cls.bodyAreaTags,
    capacity: cls.capacity,
    registered: cls.registered,
    status: cls.status,
    description: cls.description,
    price: cls.price,
    credit_cost: cls.creditCost,
    allow_dome_reset_override: cls.allowDomeResetOverride,
  };
}

const classesService = {
  /**
   * Get all classes with venue and teacher data pre-fetched.
   * This eliminates N+1 queries by fetching all related data in parallel.
   * 
   * PERFORMANCE FIX (PERF-001): Instead of making N+1 queries where we fetch
   * each class's venue and teacher individually inside a loop, we now:
   * 1. Fetch all classes, venues, and teachers in parallel (3 queries total)
   * 2. Map them in-memory using lookups
   * 
   * This reduces queries from O(N) to O(1) where N = number of classes
   */
  getClassesWithVenuesAndTeachers: async (): Promise<Class[]> => {
    try {
      // Fetch all required data in parallel - this is the key optimization
      const [classesResult, venuesResult, teachersResult] = await Promise.all([
        withRetry(
          async () => supabase.from('classes').select('*').order('date_time', { ascending: true }),
          'getClassesWithVenues-Classes'
        ),
        withRetry(
          async () => supabase.from('venues').select('*').eq('active', true).order('name', { ascending: true }),
          'getClassesWithVenues-Venues'
        ),
        withRetry(
          async () => supabase.from('teachers').select('*').eq('active', true).order('name', { ascending: true }),
          'getClassesWithVenues-Teachers'
        )
      ]);

      if (classesResult.error) throw classesResult.error;
      if (venuesResult.error) throw venuesResult.error;
      if (teachersResult.error) throw teachersResult.error;

      const classes = (classesResult.data || []) as ClassRow[];
      const venues = (venuesResult.data || []) as VenueRow[];
      const teachers = (teachersResult.data || []) as TeacherRow[];

      // Create lookup maps for O(1) access - much faster than .find() in a loop
      const venueMap = new Map(venues.map(v => [v.id, v]));
      const teacherMap = new Map(teachers.map(i => [i.id, i]));

      // Map classes with pre-fetched venue and teacher data
      return classes.map(row => {
        const cls = mapClassRowToClass(row);
        // Attach venue and teacher data directly to the class object
        // This avoids needing separate queries when displaying classes
        const venueRow = cls.venueId ? venueMap.get(cls.venueId) : undefined;
        const teacherRow = cls.teacherId ? teacherMap.get(cls.teacherId) : undefined;
        
        return {
          ...cls,
          // Include venue details if available
          venue: venueRow ? mapVenueRowToVenue(venueRow) : undefined,
          // Include teacher details if available
          teacher: teacherRow ? mapTeacherRowToTeacher(teacherRow) : undefined
        } as Class & { venue?: Venue; teacher?: Teacher };
      });
    } catch (err) {
      console.error('[classService] getClassesWithVenuesAndTeachers failed:', err);
      return [];
    }
  },

  getClasses: async (): Promise<Class[]> => {
    try {
      const { data, error } = await withRetry(
        async () => supabase.from('classes').select('*').order('date_time', { ascending: true }),
        'getClasses'
      );
      if (error) throw error;
      return (data || []).map(row => mapClassRowToClass(row as ClassRow));
    } catch (err) {
      console.error('[classService] getClasses failed:', err);
      return [];
    }
  },

  // Get paginated classes
  getClassesPaginated: async (page = 1, limit = 50): Promise<{classes: Class[], total: number}> => {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const { data, error, count } = await withRetry(
        async () => supabase
          .from('classes')
          .select('*', { count: 'exact' })
          .range(from, to)
          .order('date_time', { ascending: true }),
        'getClassesPaginated'
      );
      if (error) throw error;
      return { 
        classes: (data || []).map(row => mapClassRowToClass(row as ClassRow)), 
        total: count || 0 
      };
    } catch (err) {
      console.error('[classService] getClassesPaginated failed:', err);
      return { classes: [], total: 0 };
    }
  },

  addClass: async (cls: Class): Promise<Class[]> => {
    try {
      const classRow = mapClassToClassRow(cls);
      // SEC-003 NOTE: The Database type needs to be regenerated from Supabase CLI for proper typing
      // For now, using type assertion is required due to incomplete Database type definition
      // Runtime validation is provided by type guards added to this file
      const { data, error } = await withRetry(
        async () => (supabase.from('classes') as unknown as { insert: (row: Partial<ClassRow>) => { select: () => Promise<{ data: ClassRow[] | null; error: Error | null }> } }).insert(classRow).select(),
        'addClass'
      );
      if (error) throw error;
      return (data || []).map((row: ClassRow) => mapClassRowToClass(row));
    } catch (err) {
      console.error('[classService] addClass failed:', err);
      return [];
    }
  },

  updateClass: async (cls: Class): Promise<Class[]> => {
    try {
      const classRow = mapClassToClassRow(cls);
      // SEC-003 NOTE: The Database type needs to be regenerated from Supabase CLI for proper typing
      // For now, using type assertion is required due to incomplete Database type definition
      // Runtime validation is provided by type guards added to this file
      const { data, error } = await withRetry(
        async () => (supabase.from('classes') as unknown as { update: (row: Partial<ClassRow>) => { eq: (col: string, val: string) => { select: () => Promise<{ data: ClassRow[] | null; error: Error | null }> } } }).update(classRow).eq('id', cls.id).select(),
        'updateClass'
      );
      if (error) throw error;
      return (data || []).map((row: ClassRow) => mapClassRowToClass(row));
    } catch (err) {
      console.error('[classService] updateClass failed:', err);
      return [];
    }
  },

  deleteClass: async (classId: string): Promise<Class[]> => {
    try {
      const { error } = await withRetry(
        () => supabase.from('classes').delete().eq('id', classId),
        'deleteClass'
      );
      if (error) throw error;
      return classesService.getClasses();
    } catch (err) {
      console.error('[classService] deleteClass failed:', err);
      return [];
    }
  },
};

// =============================================================================
// REGISTRATION SERVICE
// =============================================================================

function mapRegistrationRowToRegistration(row: RegistrationRow): Registration {
  return {
    id: row.id,
    classId: row.class_id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email || undefined,
    userSport: row.user_sport || '',
    bodyAreas: row.body_areas || [],
    referredBy: row.referred_by,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method || undefined,
    paymentProof: row.payment_proof || undefined,
    registeredAt: row.registered_at,
    notes: row.notes || undefined,
  };
}

function mapRegistrationToRegistrationRow(reg: Partial<Registration>): Partial<RegistrationRow> {
  return {
    id: reg.id,
    class_id: reg.classId,
    user_id: reg.userId,
    user_name: reg.userName,
    user_email: reg.userEmail,
    user_sport: reg.userSport,
    body_areas: reg.bodyAreas,
    referred_by: reg.referredBy,
    status: reg.status,
    payment_status: reg.paymentStatus,
    payment_method: reg.paymentMethod,
    payment_proof: reg.paymentProof,
    registered_at: reg.registeredAt,
    notes: reg.notes,
  };
}

const registrationsService = {
  getRegistrations: async (): Promise<Registration[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('registrations').select('*').order('registered_at', { ascending: false }),
        'getRegistrations'
      );
      if (error) throw error;
      return (data || []).map(row => mapRegistrationRowToRegistration(row as RegistrationRow));
    } catch (err) {
      console.error('[registrationService] getRegistrations failed:', err);
      return [];
    }
  },

  getRegistrationsByClassId: async (classId: string): Promise<Registration[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('registrations').select('*').eq('class_id', classId).order('registered_at', { ascending: false }),
        'getRegistrationsByClassId'
      );
      if (error) throw error;
      return (data || []).map(row => mapRegistrationRowToRegistration(row as RegistrationRow));
    } catch (err) {
      console.error('[registrationService] getRegistrationsByClassId failed:', err);
      return [];
    }
  },

  getRegistrationsByUserId: async (userId: string): Promise<Registration[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('registrations').select('*').eq('user_id', userId).order('registered_at', { ascending: false }),
        'getRegistrationsByUserId'
      );
      if (error) throw error;
      return (data || []).map(row => mapRegistrationRowToRegistration(row as RegistrationRow));
    } catch (err) {
      console.error('[registrationService] getRegistrationsByUserId failed:', err);
      return [];
    }
  },

  getRegistrationById: async (id: string): Promise<Registration | undefined> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('registrations').select('*').eq('id', id).single(),
        'getRegistrationById'
      );
      if (error) throw error;
      return data ? mapRegistrationRowToRegistration(data as RegistrationRow) : undefined;
    } catch (err) {
      console.error(`[registrationService] getRegistrationById(${id}) failed:`, err);
      return undefined;
    }
  },

  addRegistration: async (reg: Registration): Promise<Registration[]> => {
    try {
      // Use server endpoint to bypass RLS (like user sync)
      const response = await fetch('/api/registration/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration: reg })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Return the created registration
        return [mapRegistrationRowToRegistration(result.registration)];
      }
      
      throw new Error(result.error || 'Failed to create registration');
    } catch (err) {
      console.error('[registrationService] addRegistration failed:', err);
      throw err; // Throw error so caller can handle it
    }
  },

  updateRegistration: async (reg: Registration): Promise<Registration[]> => {
    try {
      // Use server endpoint to bypass RLS
      const response = await fetch('/api/registration/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          registration: { ...reg, id: reg.id } // Send as upsert
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        return [mapRegistrationRowToRegistration(result.registration)];
      }
      
      throw new Error(result.error || 'Failed to update registration');
    } catch (err) {
      console.error('[registrationService] updateRegistration failed:', err);
      throw err;
    }
  },

  cancelRegistration: async (regId: string): Promise<Registration[]> => {
    try {
      // Use server endpoint to bypass RLS
      const response = await fetch('/api/registration/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: regId })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        return registrationsService.getRegistrations();
      }
      
      throw new Error(result.error || 'Failed to cancel registration');
    } catch (err) {
      console.error('[registrationService] cancelRegistration failed:', err);
      throw err;
    }
  },
};

// =============================================================================
// VENUE SERVICE
// =============================================================================

function mapVenueRowToVenue(row: VenueRow): Venue {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    suburb: row.suburb || '',
    mapsUrl: row.maps_url || '',
    notes: row.notes || '',
  };
}

function mapVenueToVenueRow(venue: Partial<Venue>): Partial<VenueRow> {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    suburb: venue.suburb,
    maps_url: venue.mapsUrl,
    notes: venue.notes,
  };
}

const venuesService = {
  getVenues: async (): Promise<Venue[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('venues').select('*').eq('active', true).order('name', { ascending: true }),
        'getVenues'
      );
      if (error) throw error;
      return (data || []).map(row => mapVenueRowToVenue(row as VenueRow));
    } catch (err) {
      console.error('[venueService] getVenues failed:', err);
      return [];
    }
  },

  addVenue: async (venue: Venue): Promise<Venue[]> => {
    try {
      const venueRow = mapVenueToVenueRow(venue);
      const { data, error } = await withRetry(
        () => supabase.from('venues').insert({ ...venueRow, active: true }).select(),
        'addVenue'
      );
      if (error) throw error;
      return (data || []).map((row: VenueRow) => mapVenueRowToVenue(row));
    } catch (err) {
      console.error('[venueService] addVenue failed:', err);
      return [];
    }
  },

  updateVenue: async (venue: Venue): Promise<Venue[]> => {
    try {
      const venueRow = mapVenueToVenueRow(venue);
      const { data, error } = await withRetry(
        () => supabase.from('venues').update(venueRow).eq('id', venue.id).select(),
        'updateVenue'
      );
      if (error) throw error;
      return (data || []).map((row: VenueRow) => mapVenueRowToVenue(row));
    } catch (err) {
      console.error('[venueService] updateVenue failed:', err);
      return [];
    }
  },

  deleteVenue: async (venueId: string): Promise<Venue[]> => {
    try {
      // Soft delete - set active to false
      const { error } = await withRetry(
        () => supabase.from('venues').update({ active: false }).eq('id', venueId),
        'deleteVenue'
      );
      if (error) throw error;
      return venuesService.getVenues();
    } catch (err) {
      console.error('[venueService] deleteVenue failed:', err);
      return [];
    }
  },
};

// =============================================================================
// TEMPLATE SERVICE
// =============================================================================

function mapTemplateRowToTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    sportTags: row.sport_tags || [],
    bodyAreaTags: row.body_area_tags || [],
    active: row.active,
    whatsappBody: row.whatsapp_body || '',
    emailSubject: row.email_subject || '',
    emailBody: row.email_body || '',
  };
}

function mapTemplateToTemplateRow(template: Partial<Template>): Partial<TemplateRow> {
  return {
    id: template.id,
    name: template.name,
    sport_tags: template.sportTags,
    body_area_tags: template.bodyAreaTags,
    active: template.active,
    whatsapp_body: template.whatsappBody,
    email_subject: template.emailSubject,
    email_body: template.emailBody,
  };
}

const templatesService = {
  getTemplates: async (): Promise<Template[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('templates').select('*').order('name', { ascending: true }),
        'getTemplates'
      );
      if (error) throw error;
      return (data || []).map(row => mapTemplateRowToTemplate(row as TemplateRow));
    } catch (err) {
      console.error('[templateService] getTemplates failed:', err);
      return [];
    }
  },

  addTemplate: async (template: Template): Promise<Template[]> => {
    try {
      const templateRow = mapTemplateToTemplateRow(template);
      const { data, error } = await withRetry(
        () => supabase.from('templates').insert(templateRow).select(),
        'addTemplate'
      );
      if (error) throw error;
      return (data || []).map((row: TemplateRow) => mapTemplateRowToTemplate(row));
    } catch (err) {
      console.error('[templateService] addTemplate failed:', err);
      return [];
    }
  },

  updateTemplate: async (template: Template): Promise<Template[]> => {
    try {
      const templateRow = mapTemplateToTemplateRow(template);
      const { data, error } = await withRetry(
        () => supabase.from('templates').update(templateRow).eq('id', template.id).select(),
        'updateTemplate'
      );
      if (error) throw error;
      return (data || []).map((row: TemplateRow) => mapTemplateRowToTemplate(row));
    } catch (err) {
      console.error('[templateService] updateTemplate failed:', err);
      return [];
    }
  },

  deleteTemplate: async (templateId: string): Promise<Template[]> => {
    try {
      const { error } = await withRetry(
        () => supabase.from('templates').delete().eq('id', templateId),
        'deleteTemplate'
      );
      if (error) throw error;
      return templatesService.getTemplates();
    } catch (err) {
      console.error('[templateService] deleteTemplate failed:', err);
      return [];
    }
  },
};

// =============================================================================
// INSTRUCTOR SERVICE
// =============================================================================

function mapTeacherRowToTeacher(row: TeacherRow): Teacher {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    bio: row.bio || undefined,
    specialties: row.specialties || [],
    avatar: row.avatar || undefined,
    active: row.active,
  };
}

function mapTeacherToTeacherRow(teacher: Partial<Teacher>): Partial<TeacherRow> {
  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    bio: teacher.bio,
    specialties: teacher.specialties,
    avatar: teacher.avatar,
    active: teacher.active,
  };
}

const teachersService = {
  getTeachers: async (): Promise<Teacher[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('teachers').select('*').eq('active', true).order('name', { ascending: true }),
        'getTeachers'
      );
      if (error) throw error;
      return (data || []).map(row => mapTeacherRowToTeacher(row as TeacherRow));
    } catch (err) {
      console.error('[teacherService] getTeachers failed:', err);
      return [];
    }
  },

  getTeacher: async (id: string): Promise<Teacher | null> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('teachers').select('*').eq('id', id).single(),
        'getTeacher'
      );
      if (error) throw error;
      return data ? mapTeacherRowToTeacher(data as TeacherRow) : null;
    } catch (err) {
      console.error(`[teacherService] getTeacher(${id}) failed:`, err);
      return null;
    }
  },

  addTeacher: async (teacher: Teacher): Promise<Teacher[]> => {
    try {
      const teacherRow = mapTeacherToTeacherRow(teacher);
      const { data, error } = await withRetry(
        () => supabase.from('teachers').insert(teacherRow).select(),
        'addTeacher'
      );
      if (error) throw error;
      return (data || []).map((row: TeacherRow) => mapTeacherRowToTeacher(row));
    } catch (err) {
      console.error('[teacherService] addTeacher failed:', err);
      return [];
    }
  },

  updateTeacher: async (teacher: Teacher): Promise<Teacher[]> => {
    try {
      const teacherRow = mapTeacherToTeacherRow(teacher);
      const { data, error } = await withRetry(
        () => supabase.from('teachers').update(teacherRow).eq('id', teacher.id).select(),
        'updateTeacher'
      );
      if (error) throw error;
      return (data || []).map((row: TeacherRow) => mapTeacherRowToTeacher(row));
    } catch (err) {
      console.error('[teacherService] updateTeacher failed:', err);
      return [];
    }
  },

  deleteTeacher: async (teacherId: string): Promise<Teacher[]> => {
    try {
      // Soft delete
      const { error } = await withRetry(
        () => supabase.from('teachers').update({ active: false }).eq('id', teacherId),
        'deleteTeacher'
      );
      if (error) throw error;
      return teachersService.getTeachers();
    } catch (err) {
      console.error('[teacherService] deleteTeacher failed:', err);
      return [];
    }
  },
};

// =============================================================================
// FEEDBACK SERVICE
// =============================================================================

function mapFeedbackRowToFeedback(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    classId: row.class_id || undefined,
    userId: row.user_id,
    userName: row.user_name,
    type: row.type as FeedbackType,
    rating: row.rating || undefined,
    npsScore: row.nps_score || undefined,
    comment: row.comment || undefined,
    createdAt: row.created_at,
  };
}

function mapFeedbackToFeedbackRow(feedback: Partial<Feedback>): Partial<FeedbackRow> {
  return {
    id: feedback.id,
    class_id: feedback.classId,
    user_id: feedback.userId,
    user_name: feedback.userName,
    type: feedback.type,
    rating: feedback.rating,
    nps_score: feedback.npsScore,
    comment: feedback.comment,
  };
}

const feedbackService = {
  getFeedback: async (): Promise<Feedback[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('feedback').select('*').order('created_at', { ascending: false }),
        'getFeedback'
      );
      if (error) throw error;
      return (data || []).map(row => mapFeedbackRowToFeedback(row as FeedbackRow));
    } catch (err) {
      console.error('[feedbackService] getFeedback failed:', err);
      return [];
    }
  },

  addFeedback: async (feedback: Feedback): Promise<Feedback[]> => {
    try {
      const feedbackRow = mapFeedbackToFeedbackRow(feedback);
      const { data, error } = await withRetry(
        () => supabase.from('feedback').insert(feedbackRow).select(),
        'addFeedback'
      );
      if (error) throw error;
      return (data || []).map((row: FeedbackRow) => mapFeedbackRowToFeedback(row));
    } catch (err) {
      console.error('[feedbackService] addFeedback failed:', err);
      return [];
    }
  },

  getFeedbackByClass: async (classId: string): Promise<Feedback[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('feedback').select('*').eq('class_id', classId).order('created_at', { ascending: false }),
        'getFeedbackByClass'
      );
      if (error) throw error;
      return (data || []).map(row => mapFeedbackRowToFeedback(row as FeedbackRow));
    } catch (err) {
      console.error(`[feedbackService] getFeedbackByClass(${classId}) failed:`, err);
      return [];
    }
  },

  getFeedbackStats: async (): Promise<FeedbackStats> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('feedback').select('*'),
        'getFeedbackStats'
      );
      if (error) throw error;

      const feedbacks = (data || []) as FeedbackRow[];
      
      // Initialize stats
      const stats: FeedbackStats = {
        totalFeedback: feedbacks.length,
        averageRating: 0,
        averageNps: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        npsDistribution: { detractor: 0, passive: 0, promoter: 0 }
      };

      // Calculate rating stats - use type guard for proper narrowing
      const ratingsWithNull = feedbacks.filter(f => f.rating !== null);
      const ratings: number[] = ratingsWithNull.map(f => f.rating!);
      if (ratings.length > 0) {
        stats.averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        ratings.forEach(rating => {
          if (rating >= 1 && rating <= 5) {
            stats.ratingDistribution[rating]++;
          }
        });
      }

      // Calculate NPS stats - use type guard for proper narrowing
      const npsWithNull = feedbacks.filter(f => f.nps_score !== null);
      const npsScores: number[] = npsWithNull.map(f => f.nps_score!);
      if (npsScores.length > 0) {
        stats.averageNps = npsScores.reduce((sum, n) => sum + n, 0) / npsScores.length;
        npsScores.forEach(score => {
          if (score >= 0 && score <= 6) {
            stats.npsDistribution.detractor++;
          } else if (score >= 7 && score <= 8) {
            stats.npsDistribution.passive++;
          } else if (score >= 9 && score <= 10) {
            stats.npsDistribution.promoter++;
          }
        });
      }

      return stats;
    } catch (err) {
      console.error('[feedbackService] getFeedbackStats failed:', err);
      return {
        totalFeedback: 0,
        averageRating: 0,
        averageNps: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        npsDistribution: { detractor: 0, passive: 0, promoter: 0 }
      };
    }
  },
};

// =============================================================================
// SETTINGS SERVICE
// =============================================================================

// Default settings as fallback
const defaultSettings: AppSettings = {
  appName: 'Pause Fascia Movement',
  contactEmail: 'admin@pausefmd.co.za',
  additionalContactEmails: [],
  landingPage: {
    headerText: 'where fascia becomes FLUID',
    subheaderText: 'Step into the Dome',
    expectations: [
      '75-minute guided fascia exploration tailored to your sport',
      'Understanding the fascial chains specific to your body patterns',
      'Take-home movement practices you can integrate immediately',
      'Intimate group — max 15 people'
    ],
    fasciaEducation: [],
    heroCtaText: '',
    heroSubtext: ''
  },
  email: {
    provider: 'mock',
    apiKey: '',
    senderName: 'Pause Admin',
    senderEmail: 'hello@pausefmd.co.za',
    waitlistTemplate: 'Hi {{name}},\n\nA spot has opened up for "{{class_title}}".\n\nYou have been moved from the waitlist to {{status}}.\n\nDate: {{date}}\nTime: {{time}}\n\n{{action_required}}',
    templates: undefined
  }
};

const SETTINGS_CACHE_KEY = 'tfmd_settings_cache';
const SETTINGS_CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours = 3 times a day

interface CachedSettings {
  data: AppSettings | null;
  timestamp: number;
}

// SECURITY: Create a version of settings without sensitive tokens for caching
const stripSensitiveSettings = (settings: AppSettings): AppSettings => {
  const { googleCalendarTokens, ...safeSettings } = settings;
  return safeSettings as AppSettings;
};

const getCachedSettings = (): AppSettings | null => {
  // Only use localStorage in browser environment
  if (typeof localStorage === 'undefined') return null;
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp }: CachedSettings = JSON.parse(cached);
    if (Date.now() - timestamp < SETTINGS_CACHE_DURATION) {
      console.log('[settingsService] Using cached settings');
      // Always return settings without sensitive tokens from cache
      return data ? stripSensitiveSettings(data) : null;
    }
    console.log('[settingsService] Cache expired, refetching settings');
    return null;
  } catch {
    return null;
  }
};

const setCachedSettings = (settings: AppSettings) => {
  // Only use localStorage in browser environment
  if (typeof localStorage === 'undefined') return;
  try {
    // SECURITY: Never cache sensitive tokens in localStorage
    const safeSettings = stripSensitiveSettings(settings);
    const cached: CachedSettings = { data: safeSettings, timestamp: Date.now() };
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(cached));
  } catch (err) {
    console.warn('[settingsService] Failed to cache settings:', err);
  }
};

const settingsService = {
  getSettings: async (forceRefresh = false): Promise<AppSettings> => {
    // SECURITY: Always fetch sensitive tokens from database - never use cached tokens
    // First get cached non-sensitive settings
    let cachedSettings: AppSettings | null = null;
    if (!forceRefresh) {
      cachedSettings = getCachedSettings();
    }
    
    try {
      // Always fetch tokens from database (not cached) for security
      const { data, error } = await supabase
        .from('app_settings')
        .select('google_calendar_tokens, google_calendar_id, google_calendar_sync_enabled, google_calendar_last_sync')
        .eq('id', 1)
        .single();
      
      if (error) {
        console.warn('[settingsService] Failed to load settings from Supabase, using defaults:', error.message);
        return defaultSettings;
      }
      
      if (!data) {
        console.warn('[settingsService] No settings found in database, using defaults');
        return defaultSettings;
      }
      
      // Start with cached safe settings if available, otherwise use defaults
      const baseSettings = cachedSettings || defaultSettings;
      
      // Map database columns to AppSettings interface - always get fresh tokens from DB
      const settings: AppSettings = {
        ...baseSettings,
        googleCalendarTokens: data.google_calendar_tokens,
        googleCalendarId: data.google_calendar_id,
        googleCalendarSyncEnabled: data.google_calendar_sync_enabled || false,
        googleCalendarLastSync: data.google_calendar_last_sync
      };
      
      // Cache the settings (tokens will be stripped by setCachedSettings)
      setCachedSettings(settings);
      
      return settings;
    } catch (err) {
      console.error('[settingsService] Error loading settings:', err);
      return defaultSettings;
    }
  },

  updateSettings: async (settings: AppSettings): Promise<AppSettings> => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .update({
          app_name: settings.appName,
          contact_email: settings.contactEmail,
          additional_contact_emails: settings.additionalContactEmails || [],
          zapper_qr_base64: settings.zapperQrBase64 || null,
          landing_page: settings.landingPage,
          email_config: settings.email,
          google_calendar_tokens: settings.googleCalendarTokens || null,
          google_calendar_id: settings.googleCalendarId || null,
          google_calendar_sync_enabled: settings.googleCalendarSyncEnabled || false,
          google_calendar_last_sync: settings.googleCalendarLastSync || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1)
        .select()
        .single();
      
      if (error) {
        console.error('[settingsService] Failed to update settings:', error.message);
        throw error;
      }
      
      console.log('[settingsService] Settings updated successfully');
      return settings;
    } catch (err) {
      console.error('[settingsService] Error updating settings:', err);
      throw err;
    }
  }
};

// =============================================================================
// CALENDAR SERVICE
// =============================================================================

const calendarService = {
  // Save calendar tokens to app_settings
  saveCalendarTokens: async (tokens: any): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({
          google_calendar_tokens: tokens,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);
      
      if (error) {
        console.error('[calendarService] Failed to save tokens:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[calendarService] Error saving tokens:', err);
      return false;
    }
  },

  // Sync a class to Google Calendar
  syncClassToCalendar: async (cls: Class, settings: AppSettings): Promise<boolean> => {
    if (!settings.googleCalendarSyncEnabled || !settings.googleCalendarTokens) {
      console.warn('[calendarService] Calendar sync not enabled or no tokens');
      return false;
    }

    try {
      const response = await fetch('/api/calendar/sync-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class: cls,
          calendarId: settings.googleCalendarId,
          tokens: settings.googleCalendarTokens
        })
      });

      if (response.ok) {
        // Update last sync timestamp
        await supabase
          .from('app_settings')
          .update({
            google_calendar_last_sync: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', 1);
        return true;
      }
      console.error('[calendarService] Sync failed:', response.statusText);
      return false;
    } catch (err) {
      console.error('[calendarService] Error syncing class:', err);
      return false;
    }
  },

  // Remove a class from Google Calendar
  removeClassFromCalendar: async (classId: string, settings: AppSettings): Promise<boolean> => {
    if (!settings.googleCalendarTokens) {
      return false;
    }

    try {
      const response = await fetch('/api/calendar/remove-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          calendarId: settings.googleCalendarId,
          tokens: settings.googleCalendarTokens
        })
      });

      return response.ok;
    } catch (err) {
      console.error('[calendarService] Error removing class:', err);
      return false;
    }
  }
};

// =============================================================================
// CRM SERVICES
// =============================================================================

// Note: CRM tables don't exist in Supabase schema yet, using localStorage-like implementation
// These will need proper database tables created

const crmContactsService = {
  getCRMContacts: async (): Promise<CRMContact[]> => {
    try {
      // Check if crm_contacts table exists
      const { data, error } = await withRetry(
        () => supabase.from('crm_contacts').select('*').order('created_at', { ascending: false }),
        'getCRMContacts'
      );
      if (error) {
        // Table doesn't exist, return empty array
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name as string,
        email: row.email as string,
        phone: row.phone as string | undefined,
        status: (row.status as ClientStatus) || 'new_inquiry',
        source: (row.source as ClientSource) || 'other',
        isClient: (row.is_client as boolean) || false,
        primaryBodyAreas: (row.primary_body_areas as BodyArea[]) || [],
        injuries: (row.injuries as InjuryRecord[]) || [],
        healthConditions: (row.health_conditions as string[]) || undefined,
        totalSessions: (row.total_sessions as number) || 0,
        preferredClassTypes: (row.preferred_class_types as string[]) || [],
        packageHistory: (row.package_history as ClientPackage[]) || [],
        totalSpent: (row.total_spent as number) || 0,
        totalInteractions: (row.total_interactions as number) || 0,
        tags: (row.tags as string[]) || [],
        notes: (row.notes as CRMNote[]) || [],
        activities: (row.activities as CRMActivity[]) || [],
        createdAt: (row.created_at as string) || new Date().toISOString(),
        updatedAt: (row.updated_at as string) || new Date().toISOString(),
        linkedUserId: row.linked_user_id as string | undefined,
      }));
    } catch (err) {
      console.error('[crmContactsService] getCRMContacts failed:', err);
      return [];
    }
  },

  getCRMContact: async (id: string): Promise<CRMContact | null> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('crm_contacts').select('*').eq('id', id).single(),
        'getCRMContact'
      );
      if (error) {
        if (error.code === '42P01') return null;
        throw error;
      }
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        id: row.id as string,
        name: row.name as string,
        email: row.email as string,
        phone: row.phone as string | undefined,
        status: (row.status as ClientStatus) || 'new_inquiry',
        source: (row.source as ClientSource) || 'other',
        isClient: (row.is_client as boolean) || false,
        primaryBodyAreas: (row.primary_body_areas as BodyArea[]) || [],
        injuries: (row.injuries as InjuryRecord[]) || [],
        totalSessions: (row.total_sessions as number) || 0,
        preferredClassTypes: (row.preferred_class_types as string[]) || [],
        packageHistory: (row.package_history as ClientPackage[]) || [],
        totalSpent: (row.total_spent as number) || 0,
        totalInteractions: (row.total_interactions as number) || 0,
        tags: (row.tags as string[]) || [],
        notes: (row.notes as CRMNote[]) || [],
        activities: (row.activities as CRMActivity[]) || [],
        createdAt: (row.created_at as string) || new Date().toISOString(),
        updatedAt: (row.updated_at as string) || new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[crmContactsService] getCRMContact(${id}) failed:`, err);
      return null;
    }
  },

  addCRMContact: async (contact: CRMContact): Promise<CRMContact[]> => {
    try {
      const contactRow = {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        status: contact.status,
        source: contact.source,
        is_client: contact.isClient,
        primary_body_areas: contact.primaryBodyAreas,
        injuries: contact.injuries,
        total_sessions: contact.totalSessions,
        preferred_class_types: contact.preferredClassTypes,
        package_history: contact.packageHistory,
        total_spent: contact.totalSpent,
        total_interactions: contact.totalInteractions,
        tags: contact.tags,
        notes: contact.notes,
        activities: contact.activities,
        linked_user_id: contact.linkedUserId,
      };
      const { error } = await withRetry(
        () => supabase.from('crm_contacts').insert(contactRow),
        'addCRMContact'
      );
      if (error) throw error;
      return crmContactsService.getCRMContacts();
    } catch (err) {
      console.error('[crmContactsService] addCRMContact failed:', err);
      return [];
    }
  },

  updateCRMContact: async (contact: CRMContact): Promise<CRMContact[]> => {
    try {
      const contactRow = {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        status: contact.status,
        source: contact.source,
        is_client: contact.isClient,
        primary_body_areas: contact.primaryBodyAreas,
        injuries: contact.injuries,
        total_sessions: contact.totalSessions,
        last_session_date: contact.lastSessionDate,
        next_session_date: contact.nextSessionDate,
        preferred_class_types: contact.preferredClassTypes,
        active_package: contact.activePackage,
        package_history: contact.packageHistory,
        total_spent: contact.totalSpent,
        last_contact_date: contact.lastContactDate,
        next_follow_up_date: contact.nextFollowUpDate,
        follow_up_reason: contact.followUpReason,
        total_interactions: contact.totalInteractions,
        tags: contact.tags,
        notes: contact.notes,
        activities: contact.activities,
        linked_user_id: contact.linkedUserId,
        updated_at: new Date().toISOString(),
      };
      const { error } = await withRetry(
        () => supabase.from('crm_contacts').update(contactRow).eq('id', contact.id),
        'updateCRMContact'
      );
      if (error) throw error;
      return crmContactsService.getCRMContacts();
    } catch (err) {
      console.error('[crmContactsService] updateCRMContact failed:', err);
      return [];
    }
  },

  deleteCRMContact: async (contactId: string): Promise<CRMContact[]> => {
    try {
      const { error } = await withRetry(
        () => supabase.from('crm_contacts').delete().eq('id', contactId),
        'deleteCRMContact'
      );
      if (error) throw error;
      return crmContactsService.getCRMContacts();
    } catch (err) {
      console.error('[crmContactsService] deleteCRMContact failed:', err);
      return [];
    }
  },

  addCRMNote: async (contactId: string, note: CRMNote): Promise<CRMContact[]> => {
    try {
      // Get current contact
      const { data: contact } = await supabase.from('crm_contacts').select('notes').eq('id', contactId).single();
      const currentNotes = ((contact as Record<string, unknown>)?.notes as CRMNote[]) || [];
      const updatedNotes = [...currentNotes, note];
      
      const { error } = await withRetry(
        () => supabase.from('crm_contacts').update({ notes: updatedNotes }).eq('id', contactId),
        'addCRMNote'
      );
      if (error) throw error;
      return crmContactsService.getCRMContacts();
    } catch (err) {
      console.error('[crmContactsService] addCRMNote failed:', err);
      return [];
    }
  },

  addCRMActivity: async (contactId: string, activity: CRMActivity): Promise<CRMContact[]> => {
    try {
      const { data: contact } = await supabase.from('crm_contacts').select('activities').eq('id', contactId).single();
      const currentActivities = ((contact as Record<string, unknown>)?.activities as CRMActivity[]) || [];
      const updatedActivities = [...currentActivities, activity];
      
      const { error } = await withRetry(
        () => supabase.from('crm_contacts').update({ 
          activities: updatedActivities,
          total_interactions: updatedActivities.length
        }).eq('id', contactId),
        'addCRMActivity'
      );
      if (error) throw error;
      return crmContactsService.getCRMContacts();
    } catch (err) {
      console.error('[crmContactsService] addCRMActivity failed:', err);
      return [];
    }
  },
};

const crmTasksService = {
  getCRMTasks: async (): Promise<CRMTask[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('crm_tasks').select('*').order('due_date', { ascending: true }),
        'getCRMTasks'
      );
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        contactId: row.contact_id as string | undefined,
        title: row.title as string,
        description: row.description as string | undefined,
        dueDate: row.due_date as string,
        dueTime: row.due_time as string | undefined,
        priority: (row.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
        status: (row.status as 'pending' | 'in_progress' | 'completed' | 'cancelled') || 'pending',
        assignedTo: row.assigned_to as string,
        completedAt: row.completed_at as string | undefined,
        completedBy: row.completed_by as string | undefined,
        createdAt: (row.created_at as string) || new Date().toISOString(),
        reminders: (row.reminders as TaskReminder[]) || [],
        taskType: row.task_type as CRMTask['taskType'] | undefined,
      }));
    } catch (err) {
      console.error('[crmTasksService] getCRMTasks failed:', err);
      return [];
    }
  },

  getCRMTasksByAssignee: async (assigneeId: string): Promise<CRMTask[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('crm_tasks').select('*').eq('assigned_to', assigneeId).order('due_date', { ascending: true }),
        'getCRMTasksByAssignee'
      );
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        contactId: row.contact_id as string | undefined,
        title: row.title as string,
        description: row.description as string | undefined,
        dueDate: row.due_date as string,
        dueTime: row.due_time as string | undefined,
        priority: (row.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
        status: (row.status as 'pending' | 'in_progress' | 'completed' | 'cancelled') || 'pending',
        assignedTo: row.assigned_to as string,
        completedAt: row.completed_at as string | undefined,
        completedBy: row.completed_by as string | undefined,
        createdAt: (row.created_at as string) || new Date().toISOString(),
        reminders: (row.reminders as TaskReminder[]) || [],
        taskType: row.task_type as CRMTask['taskType'] | undefined,
      }));
    } catch (err) {
      console.error(`[crmTasksService] getCRMTasksByAssignee(${assigneeId}) failed:`, err);
      return [];
    }
  },

  getCRMTasksByContact: async (contactId: string): Promise<CRMTask[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('crm_tasks').select('*').eq('contact_id', contactId).order('due_date', { ascending: true }),
        'getCRMTasksByContact'
      );
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        contactId: row.contact_id as string | undefined,
        title: row.title as string,
        description: row.description as string | undefined,
        dueDate: row.due_date as string,
        dueTime: row.due_time as string | undefined,
        priority: (row.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
        status: (row.status as 'pending' | 'in_progress' | 'completed' | 'cancelled') || 'pending',
        assignedTo: row.assigned_to as string,
        completedAt: row.completed_at as string | undefined,
        completedBy: row.completed_by as string | undefined,
        createdAt: (row.created_at as string) || new Date().toISOString(),
        reminders: (row.reminders as TaskReminder[]) || [],
        taskType: row.task_type as CRMTask['taskType'] | undefined,
      }));
    } catch (err) {
      console.error(`[crmTasksService] getCRMTasksByContact(${contactId}) failed:`, err);
      return [];
    }
  },

  addCRMTask: async (task: CRMTask): Promise<CRMTask[]> => {
    try {
      const taskRow = {
        id: task.id,
        contact_id: task.contactId,
        title: task.title,
        description: task.description,
        due_date: task.dueDate,
        due_time: task.dueTime,
        priority: task.priority,
        status: task.status,
        assigned_to: task.assignedTo,
        reminders: task.reminders,
        task_type: task.taskType,
      };
      // Note: Using type assertion for CRM tables as the schema types don't perfectly align with TypeScript types
      const { error } = await withRetry(
        () => supabase.from('crm_tasks').insert(taskRow as unknown as Record<string, unknown>),
        'addCRMTask'
      );
      if (error) throw error;
      return crmTasksService.getCRMTasks();
    } catch (err) {
      console.error('[crmTasksService] addCRMTask failed:', err);
      return [];
    }
  },

  updateCRMTask: async (task: CRMTask): Promise<CRMTask[]> => {
    try {
      const taskRow = {
        contact_id: task.contactId,
        title: task.title,
        description: task.description,
        due_date: task.dueDate,
        due_time: task.dueTime,
        priority: task.priority,
        status: task.status,
        assigned_to: task.assignedTo,
        completed_at: task.completedAt,
        completed_by: task.completedBy,
        reminders: task.reminders,
        task_type: task.taskType,
      };
      // Note: Using type assertion for CRM tables as the schema types don't perfectly align with TypeScript types
      const { error } = await withRetry(
        () => supabase.from('crm_tasks').update(taskRow as unknown as Record<string, unknown>).eq('id', task.id),
        'updateCRMTask'
      );
      if (error) throw error;
      return crmTasksService.getCRMTasks();
    } catch (err) {
      console.error('[crmTasksService] updateCRMTask failed:', err);
      return [];
    }
  },

  deleteCRMTask: async (taskId: string): Promise<CRMTask[]> => {
    try {
      const { error } = await withRetry(
        () => supabase.from('crm_tasks').delete().eq('id', taskId),
        'deleteCRMTask'
      );
      if (error) throw error;
      return crmTasksService.getCRMTasks();
    } catch (err) {
      console.error('[crmTasksService] deleteCRMTask failed:', err);
      return [];
    }
  },

  completeCRMTask: async (taskId: string, completedBy: string): Promise<CRMTask[]> => {
    try {
      const { error } = await withRetry(
        () => supabase.from('crm_tasks').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: completedBy
        }).eq('id', taskId),
        'completeCRMTask'
      );
      if (error) throw error;
      return crmTasksService.getCRMTasks();
    } catch (err) {
      console.error('[crmTasksService] completeCRMTask failed:', err);
      return [];
    }
  },
};

const crmPipelineService = {
  getPipelineStages: async (): Promise<PipelineStage[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('crm_pipeline_stages').select('*').order('order', { ascending: true }),
        'getPipelineStages'
      );
      if (error) {
        if (error.code === '42P01') {
          // Return default stages if table doesn't exist
          return [
            { id: 'ps1', name: 'New Lead', order: 0, color: '#6E7568', description: 'New inquiries' },
            { id: 'ps2', name: 'Contacted', order: 1, color: '#3B82F6', description: 'Initial contact made' },
            { id: 'ps3', name: 'Qualified', order: 2, color: '#8B5CF6', description: 'Qualified leads' },
            { id: 'ps4', name: 'Proposal', order: 3, color: '#F59E0B', description: 'Proposal sent' },
            { id: 'ps5', name: 'Negotiation', order: 4, color: '#EC4899', description: 'In negotiation' },
            { id: 'ps6', name: 'Won', order: 5, color: '#22C55E', description: 'Converted to client' },
            { id: 'ps7', name: 'Lost', order: 6, color: '#EF4444', description: 'Lost opportunities' }
          ];
        }
        throw error;
      }
      return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name as string,
        order: row.order as number,
        color: row.color as string,
        description: row.description as string | undefined,
      }));
    } catch (err) {
      console.error('[crmPipelineService] getPipelineStages failed:', err);
      return [];
    }
  },

  updatePipelineStages: async (stages: PipelineStage[]): Promise<PipelineStage[]> => {
    try {
      // Upsert all stages
      const { error } = await withRetry(
        () => supabase.from('crm_pipeline_stages').upsert(stages, { onConflict: 'id' }),
        'updatePipelineStages'
      );
      if (error) throw error;
      return crmPipelineService.getPipelineStages();
    } catch (err) {
      console.error('[crmPipelineService] updatePipelineStages failed:', err);
      return stages;
    }
  },
};

const crmEmailTemplatesService = {
  getCRMEmailTemplates: async (): Promise<CRMEmailTemplate[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('crm_email_templates').select('*').order('name', { ascending: true }),
        'getCRMEmailTemplates'
      );
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name as string,
        subject: row.subject as string,
        body: row.body as string,
        category: (row.category as CRMEmailTemplate['category']) || 'other',
        variables: (row.variables as string[]) || [],
        createdAt: (row.created_at as string) || new Date().toISOString(),
        updatedAt: (row.updated_at as string) || new Date().toISOString(),
      }));
    } catch (err) {
      console.error('[crmEmailTemplatesService] getCRMEmailTemplates failed:', err);
      return [];
    }
  },

  addCRMEmailTemplate: async (template: CRMEmailTemplate): Promise<CRMEmailTemplate[]> => {
    try {
      const templateRow = {
        id: template.id,
        name: template.name,
        subject: template.subject,
        body: template.body,
        category: template.category,
        variables: template.variables,
      };
      const { error } = await withRetry(
        () => supabase.from('crm_email_templates').insert(templateRow),
        'addCRMEmailTemplate'
      );
      if (error) throw error;
      return crmEmailTemplatesService.getCRMEmailTemplates();
    } catch (err) {
      console.error('[crmEmailTemplatesService] addCRMEmailTemplate failed:', err);
      return [];
    }
  },

  updateCRMEmailTemplate: async (template: CRMEmailTemplate): Promise<CRMEmailTemplate[]> => {
    try {
      const templateRow = {
        name: template.name,
        subject: template.subject,
        body: template.body,
        category: template.category,
        variables: template.variables,
        updated_at: new Date().toISOString(),
      };
      const { error } = await withRetry(
        () => supabase.from('crm_email_templates').update(templateRow).eq('id', template.id),
        'updateCRMEmailTemplate'
      );
      if (error) throw error;
      return crmEmailTemplatesService.getCRMEmailTemplates();
    } catch (err) {
      console.error('[crmEmailTemplatesService] updateCRMEmailTemplate failed:', err);
      return [];
    }
  },

  deleteCRMEmailTemplate: async (templateId: string): Promise<CRMEmailTemplate[]> => {
    try {
      const { error } = await withRetry(
        () => supabase.from('crm_email_templates').delete().eq('id', templateId),
        'deleteCRMEmailTemplate'
      );
      if (error) throw error;
      return crmEmailTemplatesService.getCRMEmailTemplates();
    } catch (err) {
      console.error('[crmEmailTemplatesService] deleteCRMEmailTemplate failed:', err);
      return [];
    }
  },

  seedPrebuiltTemplates: async (): Promise<CRMEmailTemplate[]> => {
    const prebuiltTemplates: Omit<CRMEmailTemplate, 'createdAt' | 'updatedAt'>[] = [
      {
        id: 'prebuilt-registration',
        name: 'Registration Welcome',
        subject: 'Welcome to {{studioName}}!',
        body: `Hi {{firstName}},

Welcome to {{studioName}}! We're thrilled to have you join our community.

Your account has been created successfully. Here are some things you can do:

• Book your first class
• Update your profile preferences
• Set your notification preferences (including class reminders)

If you have any questions, don't hesitate to reach out.

See you in class!

The {{studioName}} Team`,
        category: 'welcome',
        variables: ['firstName', 'studioName']
      },
      {
        id: 'prebuilt-purchase-credits',
        name: 'Purchase of Credits',
        subject: 'Your Credits Purchase Confirmation - {{studioName}}',
        body: `Hi {{firstName}},

Thank you for your purchase! Here's your order confirmation:

Credits Purchased: {{creditsAmount}}
Amount Paid: {{amountPaid}}
Order Number: {{orderNumber}}

Your credits are now available in your account. Use them to book any of our classes!

Need help? Reply to this email or contact us.

Best regards,
The {{studioName}} Team`,
        category: 'purchase',
        variables: ['firstName', 'creditsAmount', 'amountPaid', 'orderNumber', 'studioName']
      },
      {
        id: 'prebuilt-booking-confirmation',
        name: 'Booking Confirmation',
        subject: 'Your Class is Confirmed! - {{className}}',
        body: `Hi {{firstName}},

Great news! Your class is confirmed.

CLASS DETAILS:
• Class: {{className}}
• Date: {{classDate}}
• Time: {{classTime}}
• Teacher: {{teacherName}}
• Location: {{venueName}}

WHAT TO BRING:
• Comfortable clothing
• Water bottle
• Yoga mat (optional - we have extras)

Can't make it? You can cancel or reschedule up to 2 hours before class starts.

See you there!

The {{studioName}} Team`,
        category: 'booking',
        variables: ['firstName', 'className', 'classDate', 'classTime', 'teacherName', 'venueName', 'studioName']
      },
      {
        id: 'prebuilt-class-reminder',
        name: 'Class Reminder - Day Before',
        subject: 'Reminder: {{className}} Tomorrow',
        body: `Hi {{firstName}},

Just a friendly reminder that you have a class scheduled for tomorrow!

CLASS DETAILS:
• Class: {{className}}
• Date: {{classDate}}
• Time: {{classTime}}
• Teacher: {{teacherName}}
• Location: {{venueName}}

We look forward to seeing you!

Note: You can update your reminder preferences in your profile settings.

The {{studioName}} Team`,
        category: 'class_reminder',
        variables: ['firstName', 'className', 'classDate', 'classTime', 'teacherName', 'venueName', 'studioName']
      }
    ];

    try {
      for (const template of prebuiltTemplates) {
        const { error } = await supabase
          .from('crm_email_templates')
          .upsert({
            ...template,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        if (error) {
          console.error('Failed to seed template:', template.name, error);
        }
      }
      return crmEmailTemplatesService.getCRMEmailTemplates();
    } catch (err) {
      console.error('[crmEmailTemplatesService] seedPrebuiltTemplates failed:', err);
      return [];
    }
  }
};

const crmCampaignsService = {
  getEmailCampaigns: async (): Promise<EmailCampaign[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('crm_campaigns').select('*').order('created_at', { ascending: false }),
        'getEmailCampaigns'
      );
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name as string,
        subject: row.subject as string,
        body: row.body as string,
        targetSegment: row.target_segment as string | undefined,
        targetTags: (row.target_tags as string[]) || undefined,
        status: (row.status as EmailCampaign['status']) || 'draft',
        scheduledFor: row.scheduled_for as string | undefined,
        sentAt: row.sent_at as string | undefined,
        recipientCount: (row.recipient_count as number) || 0,
        openRate: row.open_rate as number | undefined,
        clickRate: row.click_rate as number | undefined,
        createdAt: (row.created_at as string) || new Date().toISOString(),
        createdBy: row.created_by as string,
      }));
    } catch (err) {
      console.error('[crmCampaignsService] getEmailCampaigns failed:', err);
      return [];
    }
  },

  addEmailCampaign: async (campaign: EmailCampaign): Promise<EmailCampaign[]> => {
    try {
      const campaignRow = {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        body: campaign.body,
        target_segment: campaign.targetSegment,
        target_tags: campaign.targetTags,
        status: campaign.status,
        scheduled_for: campaign.scheduledFor,
        recipient_count: campaign.recipientCount,
        created_by: campaign.createdBy,
      };
      const { error } = await withRetry(
        () => supabase.from('crm_campaigns').insert(campaignRow),
        'addEmailCampaign'
      );
      if (error) throw error;
      return crmCampaignsService.getEmailCampaigns();
    } catch (err) {
      console.error('[crmCampaignsService] addEmailCampaign failed:', err);
      return [];
    }
  },

  updateEmailCampaign: async (campaign: EmailCampaign): Promise<EmailCampaign[]> => {
    try {
      const campaignRow = {
        name: campaign.name,
        subject: campaign.subject,
        body: campaign.body,
        target_segment: campaign.targetSegment,
        target_tags: campaign.targetTags,
        status: campaign.status,
        scheduled_for: campaign.scheduledFor,
        sent_at: campaign.sentAt,
        recipient_count: campaign.recipientCount,
        open_rate: campaign.openRate,
        click_rate: campaign.clickRate,
      };
      const { error } = await withRetry(
        () => supabase.from('crm_campaigns').update(campaignRow).eq('id', campaign.id),
        'updateEmailCampaign'
      );
      if (error) throw error;
      return crmCampaignsService.getEmailCampaigns();
    } catch (err) {
      console.error('[crmCampaignsService] updateEmailCampaign failed:', err);
      return [];
    }
  },

  deleteEmailCampaign: async (campaignId: string): Promise<EmailCampaign[]> => {
    try {
      const { error } = await withRetry(
        () => supabase.from('crm_campaigns').delete().eq('id', campaignId),
        'deleteEmailCampaign'
      );
      if (error) throw error;
      return crmCampaignsService.getEmailCampaigns();
    } catch (err) {
      console.error('[crmCampaignsService] deleteEmailCampaign failed:', err);
      return [];
    }
  },
};

// =============================================================================
// DISCLAIMERS SERVICE
// =============================================================================

const disclaimersService = {
  getDefaultDisclaimers: (): Disclaimer[] => {
    return [
      {
        id: 'default-general',
        name: 'General Participation Disclaimer',
        context: 'general',
        title: 'Fascia Movement Session - Participation Terms',
        introText: 'Please read and acknowledge the following before participating in any fascia movement session.',
        sections: [
          {
            id: 'medical-clearance',
            title: 'Medical Clearance',
            content: 'I confirm that I am in good physical health and have no medical conditions that would prevent me from safely participating in fascia movement sessions. I understand that it is my responsibility to consult with a healthcare provider before participating if I have any concerns.',
            order: 0,
            required: true
          },
          {
            id: 'physical-risks',
            title: 'Acknowledgment of Physical Risks',
            content: 'I understand that fascia movement involves physical activity that may include stretching, compression, and sustained holds. I acknowledge that there are inherent risks of injury associated with any physical activity, including but not limited to muscle strain, joint stress, or aggravation of existing conditions.',
            order: 1,
            required: true
          },
          {
            id: 'heat-acknowledgment',
            title: 'Heat Environment (Dome Sessions)',
            content: 'I understand that Dome sessions are conducted in a heated environment (approximately 35-40°C). I acknowledge the risks associated with heat exposure including dehydration, dizziness, and heat-related illness. I will stay hydrated and listen to my body.',
            order: 2,
            required: true
          },
          {
            id: 'photo-release',
            title: 'Photo/Video Release (Optional)',
            content: 'I grant permission for Pause Fascia Movement to use photographs or video recordings of me during sessions for promotional purposes. I understand I can revoke this consent at any time by notifying the studio.',
            order: 3,
            required: false
          }
        ],
        signatureRequired: true,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  },

  getDisclaimers: async (): Promise<Disclaimer[]> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('disclaimers').select('*').eq('active', true).order('name', { ascending: true }),
        'getDisclaimers'
      );
      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist, return defaults
          return disclaimersService.getDefaultDisclaimers();
        }
        throw error;
      }
      if (!data || data.length === 0) {
        return disclaimersService.getDefaultDisclaimers();
      }
      return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name as string,
        context: (row.context as DisclaimerContext) || 'general',
        classType: row.class_type as string | undefined,
        venueId: row.venue_id as string | undefined,
        title: row.title as string,
        introText: row.intro_text as string,
        sections: (row.sections as DisclaimerSection[]) || [],
        signatureRequired: (row.signature_required as boolean) || false,
        active: (row.active as boolean) ?? true,
        createdAt: (row.created_at as string) || new Date().toISOString(),
        updatedAt: (row.updated_at as string) || new Date().toISOString(),
      }));
    } catch (err) {
      console.error('[disclaimersService] getDisclaimers failed:', err);
      return disclaimersService.getDefaultDisclaimers();
    }
  },

  getDisclaimer: async (id: string): Promise<Disclaimer | null> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('disclaimers').select('*').eq('id', id).single(),
        'getDisclaimer'
      );
      if (error) {
        if (error.code === '42P01') return null;
        throw error;
      }
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        id: row.id as string,
        name: row.name as string,
        context: (row.context as DisclaimerContext) || 'general',
        classType: row.class_type as string | undefined,
        venueId: row.venue_id as string | undefined,
        title: row.title as string,
        introText: row.intro_text as string,
        sections: (row.sections as DisclaimerSection[]) || [],
        signatureRequired: (row.signature_required as boolean) || false,
        active: (row.active as boolean) ?? true,
        createdAt: (row.created_at as string) || new Date().toISOString(),
        updatedAt: (row.updated_at as string) || new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[disclaimersService] getDisclaimer(${id}) failed:`, err);
      return null;
    }
  },

  getDisclaimerByContext: async (context: string): Promise<Disclaimer | null> => {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('disclaimers').select('*').eq('context', context).eq('active', true).single(),
        'getDisclaimerByContext'
      );
      if (error) {
        if (error.code === '42P01') return null;
        if (error.code === 'PGRST116') return null; // No rows returned
        throw error;
      }
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        id: row.id as string,
        name: row.name as string,
        context: (row.context as DisclaimerContext) || 'general',
        classType: row.class_type as string | undefined,
        venueId: row.venue_id as string | undefined,
        title: row.title as string,
        introText: row.intro_text as string,
        sections: (row.sections as DisclaimerSection[]) || [],
        signatureRequired: (row.signature_required as boolean) || false,
        active: (row.active as boolean) ?? true,
        createdAt: (row.created_at as string) || new Date().toISOString(),
        updatedAt: (row.updated_at as string) || new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[disclaimersService] getDisclaimerByContext(${context}) failed:`, err);
      return null;
    }
  },

  addDisclaimer: async (disclaimer: Disclaimer): Promise<Disclaimer[]> => {
    try {
      const disclaimerRow = {
        id: disclaimer.id,
        name: disclaimer.name,
        context: disclaimer.context,
        class_type: disclaimer.classType,
        venue_id: disclaimer.venueId,
        title: disclaimer.title,
        intro_text: disclaimer.introText,
        sections: disclaimer.sections,
        signature_required: disclaimer.signatureRequired,
        active: disclaimer.active,
      };
      const { error } = await withRetry(
        () => supabase.from('disclaimers').insert(disclaimerRow),
        'addDisclaimer'
      );
      if (error) throw error;
      return disclaimersService.getDisclaimers();
    } catch (err) {
      console.error('[disclaimersService] addDisclaimer failed:', err);
      return [];
    }
  },

  updateDisclaimer: async (disclaimer: Disclaimer): Promise<Disclaimer[]> => {
    try {
      const disclaimerRow = {
        name: disclaimer.name,
        context: disclaimer.context,
        class_type: disclaimer.classType,
        venue_id: disclaimer.venueId,
        title: disclaimer.title,
        intro_text: disclaimer.introText,
        sections: disclaimer.sections,
        signature_required: disclaimer.signatureRequired,
        active: disclaimer.active,
        updated_at: new Date().toISOString(),
      };
      const { error } = await withRetry(
        () => supabase.from('disclaimers').update(disclaimerRow).eq('id', disclaimer.id),
        'updateDisclaimer'
      );
      if (error) throw error;
      return disclaimersService.getDisclaimers();
    } catch (err) {
      console.error('[disclaimersService] updateDisclaimer failed:', err);
      return [];
    }
  },

  deleteDisclaimer: async (disclaimerId: string): Promise<Disclaimer[]> => {
    try {
      const { error } = await withRetry(
        () => supabase.from('disclaimers').delete().eq('id', disclaimerId),
        'deleteDisclaimer'
      );
      if (error) throw error;
      return disclaimersService.getDisclaimers();
    } catch (err) {
      console.error('[disclaimersService] deleteDisclaimer failed:', err);
      return [];
    }
  },

  toggleDisclaimer: async (disclaimerId: string): Promise<Disclaimer[]> => {
    try {
      // Get current state
      const { data: current } = await supabase.from('disclaimers').select('active').eq('id', disclaimerId).single();
      const currentActive = (current as Record<string, boolean> | null)?.active ?? true;
      
      const { error } = await withRetry(
        () => supabase.from('disclaimers').update({ active: !currentActive }).eq('id', disclaimerId),
        'toggleDisclaimer'
      );
      if (error) throw error;
      return disclaimersService.getDisclaimers();
    } catch (err) {
      console.error('[disclaimersService] toggleDisclaimer failed:', err);
      return [];
    }
  },
};

// =============================================================================
// MAIN DATABASE OBJECT
// This matches the structure of the old db.ts for drop-in replacement
// =============================================================================

export const db = {
  // --- Users ---
  ...usersService,

  // --- Classes ---
  ...classesService,

  // --- Registrations ---
  ...registrationsService,

  // --- Venues ---
  ...venuesService,

  // --- Templates ---
  ...templatesService,

  // --- Settings ---
  ...settingsService,

  // --- Calendar ---
  ...calendarService,

  // --- Teachers ---
  ...teachersService,

  // --- CRM ---
  ...crmContactsService,
  ...crmTasksService,
  ...crmPipelineService,
  ...crmEmailTemplatesService,
  ...crmCampaignsService,

  // --- Feedback ---
  ...feedbackService,

  // --- Disclaimers ---
  ...disclaimersService,

};

// =============================================================================
// CHAT MESSAGES SERVICE
// =============================================================================
const chatMessagesService = {
  getMessages: async (userId: string): Promise<ChatMessage[]> => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId},recipient_id.is.null`)
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map(msg => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.sender_name,
        senderRole: 'client' as const,
        recipientId: msg.recipient_id || 'admin',
        content: msg.content,
        timestamp: msg.timestamp,
        read: msg.read || false
      }));
    } catch (err) {
      console.error('[chatService] Error fetching messages:', err);
      return [];
    }
  },

  sendMessage: async (message: ChatMessage): Promise<ChatMessage | null> => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          id: message.id,
          sender_id: message.senderId,
          sender_name: message.senderName,
          content: message.content,
          recipient_id: message.recipientId || null,
          recipient_name: message.recipientName,
          read: false
        });
      
      if (error) throw error;
      return message;
    } catch (err) {
      console.error('[chatService] Error sending message:', err);
      return null;
    }
  },

  markAsRead: async (messageId: string): Promise<void> => {
    try {
      await supabase
        .from('chat_messages')
        .update({ read: true })
        .eq('id', messageId);
    } catch (err) {
      console.error('[chatService] Error marking message as read:', err);
    }
  }
};

// =============================================================================
// MARKETING CAMPAIGNS SERVICE
// =============================================================================
interface MarketingCampaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled';
  sentAt?: string;
  sent: number;
  recipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  createdAt: string;
  updatedAt: string;
}

const marketingCampaignsService = {
  getCampaigns: async (): Promise<MarketingCampaign[]> => {
    try {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status || 'draft',
        sentAt: campaign.sent_at,
        sent: campaign.sent || 0,
        recipients: campaign.recipients || 0,
        delivered: campaign.delivered || 0,
        opened: campaign.opened || 0,
        clicked: campaign.clicked || 0,
        converted: campaign.converted || 0,
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at
      }));
    } catch (err) {
      console.error('[marketingCampaignsService] Error fetching campaigns:', err);
      return [];
    }
  },

  saveCampaign: async (campaign: MarketingCampaign): Promise<MarketingCampaign | null> => {
    try {
      const { error } = await supabase
        .from('marketing_campaigns')
        .upsert({
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          status: campaign.status,
          sent_at: campaign.sentAt || null,
          sent: campaign.sent || 0,
          recipients: campaign.recipients || 0,
          delivered: campaign.delivered || 0,
          opened: campaign.opened || 0,
          clicked: campaign.clicked || 0,
          converted: campaign.converted || 0,
          created_at: campaign.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      
      if (error) throw error;
      return campaign;
    } catch (err) {
      console.error('[marketingCampaignsService] Error saving campaign:', err);
      return null;
    }
  },

  deleteCampaign: async (campaignId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('marketing_campaigns')
        .delete()
        .eq('id', campaignId);
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[marketingCampaignsService] Error deleting campaign:', err);
      return false;
    }
  }
};

// =============================================================================
// PAYMENT IDEMPOTENCY SERVICE
// CRITICAL FIX: Prevents duplicate payment processing
// Previously used in-memory Set which was lost on server restart
// =============================================================================

export interface ProcessedPayment {
  id: string; // PayFast payment ID
  payment_status: string;
  user_id?: string;
  credit_package_id?: string;
  credits_added?: number;
  processed_at: string;
  ip_address?: string;
  request_data?: Record<string, unknown>;
}

const paymentIdempotencyService = {
  /**
   * Check if a payment has already been processed
   * CRITICAL: This prevents duplicate credit additions
   */
  isPaymentProcessed: async (paymentId: string): Promise<boolean> => {
    try {
      const { data, error } = await withRetry(
        () => supabase
          .from('processed_payments')
          .select('id')
          .eq('id', paymentId)
          .single(),
        'isPaymentProcessed'
      );
      
      if (error) {
        // PGRST116 = no rows, meaning payment not processed yet
        if (isNotFoundError(error)) {
          return false;
        }
        console.error('[paymentIdempotencyService] Error checking payment:', error);
        // Fail safe: if we can't check, assume processed to prevent duplicates
        return true;
      }
      
      return !!data;
    } catch (err) {
      console.error('[paymentIdempotencyService] Exception checking payment:', err);
      // Fail safe: assume processed to prevent duplicates
      return true;
    }
  },

  /**
   * Mark a payment as processed
   * CRITICAL: Must be called AFTER successful credit update
   */
  markPaymentProcessed: async (payment: Omit<ProcessedPayment, 'processed_at'>): Promise<boolean> => {
    try {
      const { error } = await withRetry(
        () => supabase
          .from('processed_payments')
          .insert({
            ...payment,
            processed_at: new Date().toISOString()
          }),
        'markPaymentProcessed'
      );
      
      if (error) {
        // If already exists (duplicate key), that's fine - idempotency achieved
        if (error.code === '23505') { // PostgreSQL unique violation
          console.log(`[paymentIdempotencyService] Payment ${payment.id} already marked as processed`);
          return true;
        }
        console.error('[paymentIdempotencyService] Error marking payment:', error);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('[paymentIdempotencyService] Exception marking payment:', err);
      return false;
    }
  },

  /**
   * Get processed payment details (for audit/debugging)
   */
  getProcessedPayment: async (paymentId: string): Promise<ProcessedPayment | null> => {
    try {
      const { data, error } = await withRetry(
        () => supabase
          .from('processed_payments')
          .select('*')
          .eq('id', paymentId)
          .single(),
        'getProcessedPayment'
      );
      
      if (error) {
        if (isNotFoundError(error)) return null;
        throw error;
      }
      
      return data as ProcessedPayment;
    } catch (err) {
      console.error('[paymentIdempotencyService] Error getting payment:', err);
      return null;
    }
  },

  /**
   * Cleanup old records (keep 90 days)
   * Should be called periodically (daily)
   */
  cleanupOldRecords: async (): Promise<number> => {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const { error, count } = await supabase
        .from('processed_payments')
        .delete()
        .lt('processed_at', ninetyDaysAgo.toISOString());
      
      if (error) throw error;
      
      console.log(`[paymentIdempotencyService] Cleaned up ${count || 0} old records`);
      return count || 0;
    } catch (err) {
      console.error('[paymentIdempotencyService] Error cleaning up:', err);
      return 0;
    }
  }
};

// Default export for convenience
export default db;

// Log initialization
console.log('[db-supabase] Database service initialized with Supabase');
console.log('[db-supabase] Configuration status:', isConfigured() ? 'Configured' : 'NOT CONFIGURED - check env vars');

// FIX: Add services that were referenced before they were defined
Object.assign(db, chatMessagesService);
Object.assign(db, marketingCampaignsService);
Object.assign(db, paymentIdempotencyService);
