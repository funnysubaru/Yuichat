// 1.0.0: YUIChat 项目 - 认证服务
// 1.0.1: 支持无 Supabase 配置的 UI 预览模式
import { supabase, isSupabaseAvailable } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export interface AuthError {
  message: string;
  code?: string;
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return {
        user: null,
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      };
    }

    return {
      user: data.user,
      error: null,
    };
  } catch (error: any) {
    return {
      user: null,
      error: {
        message: error.message || '注册失败，请重试',
      },
    };
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        user: null,
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      };
    }

    return {
      user: data.user,
      error: null,
    };
  } catch (error: any) {
    return {
      user: null,
      error: {
        message: error.message || '登录失败，请重试',
      },
    };
  }
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(): Promise<{ error: AuthError | null }> {
  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (error) {
      return {
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      };
    }

    return { error: null };
  } catch (error: any) {
    return {
      error: {
        message: error.message || 'Google 登录失败，请重试',
      },
    };
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      };
    }

    return { error: null };
  } catch (error: any) {
    return {
      error: {
        message: error.message || '登出失败，请重试',
      },
    };
  }
}

/**
 * Get current user
 * 1.0.1: 支持无 Supabase 配置模式
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseAvailable) {
    // UI preview mode: return null (no user)
    return null;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      logger.error('Error getting current user:', error);
      return null;
    }
    
    return user;
  } catch (error) {
    logger.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Subscribe to auth state changes
 * 1.0.1: 支持无 Supabase 配置模式
 */
export function onAuthStateChange(
  callback: (user: User | null) => void
): { unsubscribe: () => void } {
  if (!isSupabaseAvailable) {
    // UI preview mode: return a no-op unsubscribe function
    callback(null);
    return {
      unsubscribe: () => {},
    };
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });

  return {
    unsubscribe: () => {
      subscription.unsubscribe();
    },
  };
}

