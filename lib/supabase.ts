import { createClient } from '@supabase/supabase-js';
import type { User } from '../types';

// Environment variable names for Supabase configuration
const SUPABASE_URL_ENV = 'VITE_SUPABASE_URL';
const SUPABASE_ANON_KEY_ENV = 'VITE_SUPABASE_ANON_KEY';

// Get Supabase URL from environment - required
const supabaseUrl = import.meta.env[SUPABASE_URL_ENV] || '';
// Get Supabase anon key from environment - required
const supabaseAnonKey = import.meta.env[SUPABASE_ANON_KEY_ENV] || '';

// Validate configuration and warn about missing environment variables
const validateConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!supabaseUrl) {
    errors.push(`Missing ${SUPABASE_URL_ENV} environment variable`);
  }
  
  if (!supabaseAnonKey) {
    errors.push(`Missing ${SUPABASE_ANON_KEY_ENV} environment variable`);
  }
  
  if (errors.length > 0) {
    console.error('🔒 Security Warning: Supabase configuration issue(s):');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('Please configure these in your .env file or Vercel environment.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validate configuration on module load
const configValidation = validateConfig();

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return configValidation.isValid;
};

// Get configuration validation result for debugging
export const getConfigStatus = () => ({
  isConfigured: configValidation.isValid,
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  errors: configValidation.errors,
  urlConfigured: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET'
});

// Create Supabase client only if configured, otherwise null
const supabase = isSupabaseConfigured() 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // SECURITY: Cookie configuration for enhanced session security
        flowType: 'pkce',
        cookieOptions: {
          secure: window.location.protocol === 'https:',
          sameSite: window.location.protocol === 'https:' ? 'strict' : 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        },
      },
    })
  : null;

export { supabase };

// Google OAuth Sign In
export const signInWithGoogle = async (): Promise<{ user: User | null; error: string | null }> => {
  if (!isSupabaseConfigured()) {
    return { user: null, error: 'Supabase is not configured. Please set up your environment variables.' };
  }

  try {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: false,
      }
    });

    if (error) {
      return { user: null, error: error.message };
    }

    // The OAuth flow will redirect, so we return null here
    // The actual user data will be handled after the redirect
    return { user: null, error: null };
  } catch (err) {
    return { user: null, error: err instanceof Error ? err.message : 'An unknown error occurred' };
  }
};

// Facebook OAuth Sign In
export const signInWithFacebook = async (): Promise<{ user: User | null; error: string | null }> => {
  if (!isSupabaseConfigured()) {
    return { user: null, error: 'Supabase is not configured. Please set up your environment variables.' };
  }

  try {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: false,
      }
    });

    if (error) {
      return { user: null, error: error.message };
    }

    // The OAuth flow will redirect, so we return null here
    // The actual user data will be handled after the redirect
    return { user: null, error: null };
  } catch (err) {
    return { user: null, error: err instanceof Error ? err.message : 'An unknown error occurred' };
  }
};

// Apple OAuth Sign In
export const signInWithApple = async (): Promise<{ user: User | null; error: string | null }> => {
  if (!isSupabaseConfigured()) {
    return { user: null, error: 'Supabase is not configured. Please set up your environment variables.' };
  }

  try {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: false,
      }
    });

    if (error) {
      return { user: null, error: error.message };
    }

    // The OAuth flow will redirect, so we return null here
    // The actual user data will be handled after the redirect
    return { user: null, error: null };
  } catch (err) {
    return { user: null, error: err instanceof Error ? err.message : 'An unknown error occurred' };
  }
};

// Get current session user
export const getCurrentUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return null;
    }

    const { user } = session;
    
    return {
      id: user.id,
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      email: user.email || '',
      isAdmin: false,
      waiverAccepted: false,
    };
  } catch (err) {
    console.error('Error getting current user:', err);
    return null;
  }
};

// Magic Link Sign In (Email)
export const signInWithMagicLink = async (email: string): Promise<{ success: boolean; error: string | null }> => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'An unknown error occurred' };
  }
};

// Sign out
export const signOut = async (): Promise<{ error: string | null }> => {
  if (!isSupabaseConfigured()) {
    return { error: null };
  }

  try {
    if (!supabase) return { error: null };
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'An unknown error occurred' };
  }
};

// Listen for auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (!isSupabaseConfigured()) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }

  if (!supabase) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }

  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      const user: User = {
        id: session.user.id,
        name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
        email: session.user.email || '',
        isAdmin: false,
        waiverAccepted: false,
      };
      callback(user);
    } else if (event === 'SIGNED_OUT') {
      callback(null);
    }
  });
};
