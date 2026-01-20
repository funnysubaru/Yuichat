/**
 * 1.0.1: YUIChat 项目 - 语言切换组件
 * 下拉菜单式语言选择器，参考 ChatMax 风格
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react';

interface Language {
  code: string;
  label: string;
  flag: string; // Emoji flag
}

const languages: Language[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh', label: '简体中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
];

// 1.2.28: 添加 direction prop 控制下拉菜单弹出方向
interface LanguageSwitcherProps {
  direction?: 'up' | 'down'; // 下拉菜单方向：up=向上弹出，down=向下弹出
}

export function LanguageSwitcher({ direction = 'up' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current language code (handle 'zh-CN' -> 'zh')
  const getCurrentLanguageCode = (): string => {
    const lang = i18n.language || 'zh';
    if (lang.startsWith('zh')) return 'zh';
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('en')) return 'en';
    return lang;
  };

  const [currentLang, setCurrentLang] = useState<Language>(
    languages.find(lang => lang.code === getCurrentLanguageCode()) || languages[1] // Default to Chinese
  );

  // Update current language when i18n language changes
  useEffect(() => {
    const langCode = getCurrentLanguageCode();
    const lang = languages.find(l => l.code === langCode) || languages[1];
    setCurrentLang(lang);
  }, [i18n.language]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLanguageChange = async (lang: Language) => {
    await i18n.changeLanguage(lang.code);
    setCurrentLang(lang);
    setIsOpen(false);
  };

  // 1.0.4: 简化按钮样式，适配 Sidebar 用户信息区域
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Language Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 p-1.5 rounded hover:bg-gray-100 transition-colors"
        aria-label="Switch Language"
        title={t('switchLanguage')}
      >
        <span className="text-base leading-none">{currentLang.flag}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {/* 1.0.4: 下拉菜单显示在按钮右上方 */}
      {/* 1.2.28: 根据 direction prop 控制弹出方向 */}
      {isOpen && (
        <div className={`absolute right-0 w-52 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50 ${
          direction === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'
        }`}>
          {languages.map((lang) => {
            const isSelected = lang.code === currentLang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                  isSelected ? '' : ''
                }`}
              >
                {/* Flag Icon - Circular */}
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-base leading-none flex-shrink-0 overflow-hidden">
                  {lang.flag}
                </div>
                
                {/* Language Label */}
                <span
                  className={`flex-1 text-sm text-left ${
                    isSelected ? 'text-primary font-medium' : 'text-gray-600'
                  }`}
                >
                  {lang.label}
                </span>

                {/* Check Icon - Only show for selected */}
                {isSelected && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

