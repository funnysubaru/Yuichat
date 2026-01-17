// 1.0.0: YUIChat 项目 - Supabase 客户端配置
// 1.0.1: 支持无 Supabase 配置的 UI 预览模式
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

// Check if Supabase is configured
const isSupabaseConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_REF;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return !!(url || projectRef) && !!anonKey;
};

// Get Supabase URL from environment variables
// If VITE_SUPABASE_URL is not set, construct it from VITE_SUPABASE_PROJECT_REF
const getSupabaseUrl = (): string | null => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (url) {
    return url;
  }
  
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_REF;
  if (projectRef) {
    return `https://${projectRef}.supabase.co`;
  }
  
  return null;
};

// Get Supabase anon key from environment variables
const getSupabaseAnonKey = (): string | null => {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || null;
};

// Create Supabase client with auth configuration
// 1.0.1: 如果没有配置，创建一个 mock 客户端（仅用于 UI 预览）
let supabaseInstance: ReturnType<typeof createClient> | null = null;
export const isSupabaseAvailable = isSupabaseConfigured();

if (isSupabaseAvailable) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (url && key) {
    supabaseInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
} else {
  // Mock client for UI preview (will fail on actual API calls, but allows UI to render)
  console.warn('⚠️ Supabase not configured. Running in UI preview mode. Some features will not work.');
  // Create a mock client with dummy values
  supabaseInstance = createClient('https://mock.supabase.co', 'mock-key', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = supabaseInstance!;

// User ID management using localStorage
const ANONYMOUS_USER_ID_KEY = 'anonymous_user_id';

/**
 * Get or create anonymous user ID
 */
export const getAnonymousUserId = (): string => {
  let userId = localStorage.getItem(ANONYMOUS_USER_ID_KEY);
  
  if (!userId) {
    // Generate a simple UUID-like string
    userId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(ANONYMOUS_USER_ID_KEY, userId);
  }
  
  return userId;
};

/**
 * Clear anonymous user ID (useful for testing or reset)
 */
export const clearAnonymousUserId = (): void => {
  localStorage.removeItem(ANONYMOUS_USER_ID_KEY);
};

/**
 * Get user ID (authenticated user ID or anonymous user ID)
 * Priority: authenticated user > anonymous user
 * 1.0.1: 支持无 Supabase 配置模式
 */
export const getUserId = async (): Promise<{ userId: string; isAuthenticated: boolean }> => {
  if (!isSupabaseAvailable) {
    // UI preview mode: return anonymous user ID
    return {
      userId: getAnonymousUserId(),
      isAuthenticated: false,
    };
  }

  try {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      return {
        userId: user.id,
        isAuthenticated: true,
      };
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error getting authenticated user:', error);
    }
  }
  
  // Fall back to anonymous user ID
  return {
    userId: getAnonymousUserId(),
    isAuthenticated: false,
  };
};

