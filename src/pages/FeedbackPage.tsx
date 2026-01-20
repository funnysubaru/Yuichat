/**
 * 1.2.29: YUIChat 项目 - 意见反馈页面
 * 使用 Google Form 收集用户反馈
 * 1.2.31: 配置实际的 Google Form 链接，支持多语言动态切换
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MessageCircle } from 'lucide-react';

export function FeedbackPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  
  // 1.2.32: 多语言 Google Form 表单链接
  // 根据当前应用语言动态显示对应的表单
  const formUrls: Record<string, string> = {
    // 日文表单：YUIChatご意見
    ja: 'https://docs.google.com/forms/d/e/1FAIpQLSeke9qiUUCD7llMwo5w0ulpiiXX798o0M3_Tmx65KALDJ3FHw/viewform?embedded=true',
    // 中文表单：YUIChat 用户反馈
    zh: 'https://docs.google.com/forms/d/e/1FAIpQLSdO4-BycxG0tq6_mwTuGsrjwRbFFSrNasoo-96-LGeFYm5RUQ/viewform?embedded=true',
    // 英文表单：YUIChat User Feedback
    en: 'https://docs.google.com/forms/d/e/1FAIpQLSeWLbDOU5ij5RUCuKI8_Elgi_ml5MCBUxAI0qTRV4w92xVSZw/viewform?embedded=true',
  };
  
  // 根据当前语言获取对应的表单链接，默认使用中文
  const googleFormUrl = formUrls[i18n.language] || formUrls.zh;
  
  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-6">
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
            <MessageCircle className="w-8 h-8" />
            {t('feedback')}
          </h1>
          <p className="text-gray-600 mt-2">{t('feedbackDescription')}</p>
        </div>
        
        {/* Google Form 嵌入区域 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <iframe
            src={googleFormUrl}
            width="100%"
            height="800"
            frameBorder="0"
            marginHeight={0}
            marginWidth={0}
            className="w-full"
          >
            {t('loading')}...
          </iframe>
        </div>
        
        {/* 提示信息 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">{t('note')}:</span> {t('feedbackNote')}
          </p>
        </div>
      </div>
    </div>
  );
}
