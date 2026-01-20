/**
 * 1.2.29: YUIChat 项目 - 账号中心页面
 * 显示用户信息，支持修改用户名和密码
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Mail, Lock, Eye, EyeOff, Save, ArrowLeft, UserCircle } from 'lucide-react';
import { getCurrentUser, updateUserProfile, updateUserPassword, getUserProviders } from '../services/authService';
import { isSupabaseAvailable } from '../lib/supabase';
import { logger } from '../utils/logger';

export function AccountCenterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 表单状态
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI 状态
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  
  useEffect(() => {
    loadUserInfo();
  }, []);
  
  const loadUserInfo = async () => {
    if (!isSupabaseAvailable) {
      setIsLoading(false);
      return;
    }
    
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        // 设置显示名称（优先使用 user_metadata.full_name 或 user_metadata.name，否则使用邮箱前缀）
        const metadata = currentUser.user_metadata || {};
        const name = metadata.full_name || metadata.name || currentUser.email?.split('@')[0] || '';
        setDisplayName(name);
        
        // 获取登录方式
        const userProviders = getUserProviders(currentUser);
        setProviders(userProviders);
      }
    } catch (error) {
      logger.error('Error loading user info:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUpdateProfile = async () => {
    if (!displayName.trim()) {
      setProfileMessage(t('pleaseEnterName'));
      return;
    }
    
    setIsSavingProfile(true);
    setProfileMessage('');
    
    try {
      const { error } = await updateUserProfile({ full_name: displayName });
      
      if (error) {
        logger.error('Error updating profile:', error);
        setProfileMessage(t('updateProfileFailed'));
      } else {
        setProfileMessage(t('updateProfileSuccess'));
        // 重新加载用户信息
        await loadUserInfo();
      }
    } catch (error) {
      logger.error('Error updating profile:', error);
      setProfileMessage(t('updateProfileFailed'));
    } finally {
      setIsSavingProfile(false);
    }
  };
  
  const handleUpdatePassword = async () => {
    setPasswordMessage('');
    
    if (!newPassword || !confirmPassword) {
      setPasswordMessage(t('pleaseEnterNewPassword'));
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordMessage(t('passwordMismatch'));
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordMessage(t('passwordRequirement'));
      return;
    }
    
    setIsSavingPassword(true);
    
    try {
      const { error } = await updateUserPassword(newPassword);
      
      if (error) {
        logger.error('Error updating password:', error);
        setPasswordMessage(t('updatePasswordFailed'));
      } else {
        setPasswordMessage(t('updatePasswordSuccess'));
        // 清空密码输入框
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      logger.error('Error updating password:', error);
      setPasswordMessage(t('updatePasswordFailed'));
    } finally {
      setIsSavingPassword(false);
    }
  };
  
  const isThirdPartyLogin = providers.length > 0 && !providers.includes('email');
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">{t('loading')}</div>
      </div>
    );
  }
  
  if (!isSupabaseAvailable || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">{t('pleaseLogin')}</div>
      </div>
    );
  }
  
  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-6">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back')}</span>
        </button>
        
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserCircle className="w-8 h-8" />
            {t('accountCenter')}
          </h1>
          <p className="text-gray-600 mt-2">{t('accountCenterDescription')}</p>
        </div>
        
        {/* 基本信息 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('basicInfo')}</h2>
          
          {/* 用户名 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              {t('displayName')}
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder={t('pleaseEnterName')}
              />
              <button
                onClick={handleUpdateProfile}
                disabled={isSavingProfile}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isSavingProfile ? t('saving') : t('save')}
              </button>
            </div>
            {profileMessage && (
              <p className={`text-sm mt-2 ${profileMessage.includes(t('success')) ? 'text-green-600' : 'text-red-600'}`}>
                {profileMessage}
              </p>
            )}
          </div>
          
          {/* 邮箱 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              {t('email')}
            </label>
            <input
              type="email"
              value={user.email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
            <p className="text-sm text-gray-500 mt-1">{t('emailCannotBeChanged')}</p>
          </div>
          
          {/* 登录方式（仅第三方登录显示） */}
          {isThirdPartyLogin && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('loginMethod')}
              </label>
              <div className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
                <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center">
                  <User className="w-5 h-5 text-orange-600" />
                </div>
                <span className="text-gray-900 font-medium capitalize">
                  {providers.map(p => p === 'google' ? 'Google' : p).join(', ')}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-2">{t('thirdPartyLoginNote')}</p>
            </div>
          )}
        </div>
        
        {/* 密码修改（仅邮箱登录显示） */}
        {!isThirdPartyLogin && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              {t('changePassword')}
            </h2>
            
            {/* 新密码 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('newPassword')}
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={t('pleaseEnterNewPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            {/* 确认密码 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('confirmPassword')}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={t('pleaseConfirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <button
              onClick={handleUpdatePassword}
              disabled={isSavingPassword}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock className="w-4 h-4" />
              {isSavingPassword ? t('updating') : t('updatePassword')}
            </button>
            
            {passwordMessage && (
              <p className={`text-sm mt-3 ${passwordMessage.includes(t('success')) ? 'text-green-600' : 'text-red-600'}`}>
                {passwordMessage}
              </p>
            )}
            
            <p className="text-sm text-gray-500 mt-3">{t('passwordRequirement')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
