/**
 * 1.1.5: YUIChat 项目 - 认证页面
 * 用户登出后显示的登录/注册页面
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, UserPlus, Loader2, BookOpen, CheckCircle } from 'lucide-react';
import { signUpWithEmail, signInWithEmail, signInWithGoogle } from '../services/authService';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

type AuthMode = 'login' | 'signup' | 'verify';

export function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let result;
      if (mode === 'signup') {
        // 1.1.5: 注册并发送验证邮件
        result = await signUpWithEmail(email, password);
        
        if (result.error) {
          setError(result.error.message);
        } else {
          // 注册成功，显示验证提示
          setMode('verify');
        }
      } else {
        // 登录
        result = await signInWithEmail(email, password);
        
        if (result.error) {
          setError(result.error.message);
        } else if (result.user) {
          // 登录成功，跳转到主页
          navigate('/');
        }
      }
    } catch (err: any) {
      setError(err.message || t('operationFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setError(result.error.message);
        setIsLoading(false);
      }
      // Google OAuth 会重定向，不需要手动导航
    } catch (err: any) {
      setError(err.message || t('googleSignInFailed'));
      setIsLoading(false);
    }
  };

  // 验证邮件页面
  if (mode === 'verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('verifyYourEmail')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('verificationEmailSent')} <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {t('checkYourInbox')}
          </p>
          <button
            onClick={() => setMode('login')}
            className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            {t('backToLogin')}
          </button>
        </motion.div>
      </div>
    );
  }

  // 登录/注册页面
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      {/* 语言切换按钮 - 右上角 */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full flex"
      >
        {/* 左侧 - 品牌展示 */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-primary to-purple-600 p-12 flex-col justify-between text-white">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <BookOpen className="w-7 h-7" />
              </div>
              <span className="text-3xl font-bold">YUIChat</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">
              {t('welcomeToYUIChat')}
            </h1>
            <p className="text-lg text-white/90">
              {t('enterpriseKnowledgeBaseService')}
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                ✓
              </div>
              <span>{t('aiPoweredQA')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                ✓
              </div>
              <span>{t('multiFileSupport')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                ✓
              </div>
              <span>{t('teamCollaboration')}</span>
            </div>
          </div>
        </div>

        {/* 右侧 - 登录/注册表单 */}
        <div className="w-full md:w-1/2 p-8 md:p-12">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {mode === 'login' ? t('welcomeBack') : t('createAccount')}
            </h2>
            <p className="text-gray-600">
              {mode === 'login' ? t('loginToYourAccount') : t('signupToGetStarted')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-gray-500">
                  {t('passwordRequirement')}
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
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

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">{t('or')}</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3 font-medium"
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

          <div className="mt-6 text-center text-sm">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              className="text-primary hover:text-primary-dark font-medium"
            >
              {mode === 'login' ? t('noAccount') : t('hasAccount')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
