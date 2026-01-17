// 1.0.0: YUIChat 项目 - 认证模态框
// 1.0.1: 支持无 Supabase 配置的 UI 预览模式
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, LogIn, UserPlus, Loader2 } from 'lucide-react';
import { signUpWithEmail, signInWithEmail, signInWithGoogle } from '../services/authService';
import type { AuthError } from '../services/authService';
import { isSupabaseAvailable } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'login' | 'signup';
}

export function AuthModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialMode = 'login' 
}: AuthModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1.0.1: UI 预览模式提示
    // 1.0.2: 使用多语言
    if (!isSupabaseAvailable) {
      setError(t('uiPreviewMode'));
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      let result;
      if (mode === 'signup') {
        result = await signUpWithEmail(email, password);
      } else {
        result = await signInWithEmail(email, password);
      }

      if (result.error) {
        setError(result.error.message);
        setIsLoading(false);
      } else if (result.user) {
        setIsLoading(false);
        onSuccess?.();
        onClose();
        setEmail('');
        setPassword('');
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || t('operationFailed'));
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // 1.0.1: UI 预览模式提示
    // 1.0.2: 使用多语言
    if (!isSupabaseAvailable) {
      setError(t('uiPreviewModeGoogle'));
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setError(result.error.message);
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err.message || t('googleSignInFailed'));
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  {mode === 'login' ? t('login') : t('signup')}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('email')}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('password')}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : mode === 'login' ? (
                      <>
                        <LogIn className="w-5 h-5" />
                        {t('login')}
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        {t('signup')}
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">{t('or')}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="mt-4 w-full py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {t('signInWithGoogle')}
                  </button>
                </div>

                <div className="mt-4 text-center text-sm">
                  <button
                    onClick={switchMode}
                    className="text-primary hover:text-primary-dark"
                  >
                    {mode === 'login' ? t('noAccount') : t('hasAccount')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

