# Google Form 意见反馈配置指南

## 概述

YUIChat 的意见反馈功能使用 Google Form 来收集用户反馈。本文档说明如何创建和配置 Google Form。

## 多语言支持说明

YUIChat 支持中文、英文、日文三种语言。为了提供最佳用户体验，我们采用**动态多语言表单方案**：

- 为每种语言创建独立的 Google Form
- 应用根据当前界面语言自动显示对应的表单
- 用户切换语言时，表单内容也会自动切换

### 为什么不使用单一表单？

Google Forms 官方不支持原生的多语言切换功能。虽然可以在一个表单中使用双语文本（如"意见/Feedback"），但这会导致：
- 表单显得冗长且杂乱
- 用户需要在多种语言中寻找自己能理解的内容
- 用户体验较差

因此，我们选择为每种语言创建独立表单，确保用户看到的始终是纯净的单一语言界面。

## 配置步骤

### 1. 创建多语言 Google Form

#### 方法一：创建三个独立表单（推荐）

为每种语言创建一个独立的表单：

**中文表单：**
1. 访问 [Google Forms](https://forms.google.com/)
2. 点击"+"创建新表单
3. 设置表单标题："YUIChat 用户反馈"
4. 按照下面的"添加问题字段"部分添加中文问题

**英文表单：**
1. 创建新表单
2. 设置表单标题："YUIChat User Feedback"
3. 添加英文问题字段

**日文表单：**
1. 创建新表单
2. 设置表单标题："YUIChatご意見"
3. 添加日文问题字段

#### 方法二：复制现有表单快速创建

1. 打开已创建的中文表单
2. 点击右上角的"更多"（三个点）
3. 选择"制作副本"
4. 将副本重命名为目标语言版本
5. 逐一修改所有问题和选项的语言

### 2. 添加问题字段

建议添加以下字段：

#### 必填字段
- **姓名/昵称**（短答题）
- **邮箱地址**（短答题，设置为邮箱格式验证）
- **反馈类型**（单选题）
  - 功能建议
  - Bug 反馈
  - 使用问题
  - 其他
- **详细描述**（段落题，必填）

#### 可选字段
- **您使用 YUIChat 的频率**（单选题）
  - 每天
  - 每周几次
  - 偶尔使用
  - 第一次使用
- **您的联系方式**（短答题）
- **截图上传**（文件上传）

### 3. 获取嵌入代码

1. 点击右上角的"发送"按钮
2. 在弹出窗口中，点击"<>"图标（嵌入HTML）
3. 复制 iframe 的 `src` 属性值

示例：
```html
<iframe src="https://docs.google.com/forms/d/e/1FAIpQLSd.../viewform?embedded=true" ...>
```

你需要复制的是 `src` 中的 URL：
```
https://docs.google.com/forms/d/e/1FAIpQLSd.../viewform?embedded=true
```

### 4. 更新代码配置多语言表单

打开 `src/pages/FeedbackPage.tsx` 文件，找到 `formUrls` 配置：

```typescript
const formUrls: Record<string, string> = {
  // 日文表单
  ja: 'https://docs.google.com/forms/d/e/YOUR_JA_FORM_ID/viewform?embedded=true',
  // 中文表单
  zh: 'https://docs.google.com/forms/d/e/YOUR_ZH_FORM_ID/viewform?embedded=true',
  // 英文表单
  en: 'https://docs.google.com/forms/d/e/YOUR_EN_FORM_ID/viewform?embedded=true',
};
```

将三个 `YOUR_XX_FORM_ID` 分别替换为对应语言表单的实际链接。

**示例配置：**
```typescript
const formUrls: Record<string, string> = {
  ja: 'https://docs.google.com/forms/d/e/1FAIpQLSeke9qiUUCD7llMwo5w0ulpiiXX798o0M3_Tmx65KALDJ3FHw/viewform?embedded=true',
  zh: 'https://docs.google.com/forms/d/e/1FAIpQLSdZzX9Y8W7V6U5T4S3R2Q1P0O9N8M7L6K5J4I3H2G1F0E9D/viewform?embedded=true',
  en: 'https://docs.google.com/forms/d/e/1FAIpQLSdA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X/viewform?embedded=true',
};
```

### 5. 测试多语言切换

1. 启动应用
2. 在应用右上角切换语言（中/英/日）
3. 进入"意见反馈"页面
4. 确认表单内容已切换到对应语言

### 5. 配置表单设置（可选）

在 Google Form 的设置中，你可以：

1. **常规设置**
   - 限制每人只能提交一次（需要登录 Google 账号）
   - 编辑提交内容后的选项
   - 查看汇总图表和文本回复

2. **演示文稿**
   - 自定义确认消息
   - 显示进度条
   - 随机排列问题顺序

3. **测验**
   - 如果需要评分功能可以开启

## 查看反馈

1. 打开你的 Google Form
2. 点击"回复"标签页
3. 可以查看：
   - 汇总统计
   - 单个回复
   - 导出到 Google Sheets 进行分析

## 高级配置

### 自动通知

1. 在 Google Form 中点击"回复"标签
2. 点击右上角的三个点
3. 选择"接收新回复的电子邮件通知"

### 集成到 Google Sheets

1. 在"回复"标签中
2. 点击右上角的 Google Sheets 图标
3. 创建或选择现有的 Spreadsheet
4. 所有反馈会自动同步到表格中

### 使用 Google Apps Script 自动化

你可以使用 Google Apps Script 来：
- 自动发送感谢邮件
- 将反馈转发到团队邮件
- 集成到项目管理工具（如 Jira、Trello）
- 自动分类和标记反馈

## 示例表单模板（多语言版本）

### 中文版本

```
标题：YUIChat 用户反馈

欢迎语：
感谢您使用 YUIChat！您的反馈对我们非常重要。请告诉我们您的想法、建议或遇到的问题。

---

1. 您的姓名/昵称 *
   [短答题]

2. 邮箱地址 *
   [短答题 - 邮箱格式]

3. 反馈类型 *
   [单选]
   ○ 功能建议
   ○ Bug 反馈
   ○ 使用问题
   ○ 产品评价
   ○ 其他

4. 详细描述您的反馈 *
   [段落题]

5. 您使用 YUIChat 的频率
   [单选]
   ○ 每天
   ○ 每周几次
   ○ 偶尔使用
   ○ 第一次使用

6. 如果需要我们回复，请留下联系方式
   [短答题]

7. 相关截图（可选）
   [文件上传]

---

确认消息：
感谢您的反馈！我们会认真阅读并考虑您的建议。
```

### 英文版本

```
Title: YUIChat User Feedback

Welcome Message:
Thank you for using YUIChat! Your feedback is very important to us. Please share your thoughts, suggestions, or issues you've encountered.

---

1. Your Name/Nickname *
   [Short Answer]

2. Email Address *
   [Short Answer - Email format]

3. Feedback Type *
   [Multiple Choice]
   ○ Feature Suggestion
   ○ Bug Report
   ○ Usage Question
   ○ Product Review
   ○ Other

4. Detailed Feedback Description *
   [Paragraph]

5. How often do you use YUIChat?
   [Multiple Choice]
   ○ Daily
   ○ Several times a week
   ○ Occasionally
   ○ First time user

6. Contact Information (if you need a response)
   [Short Answer]

7. Relevant Screenshots (Optional)
   [File Upload]

---

Confirmation Message:
Thank you for your feedback! We will carefully read and consider your suggestions.
```

### 日文版本

```
タイトル：YUIChatご意見

ウェルカムメッセージ：
YUIChatをご利用いただきありがとうございます！お客様のフィードバックは私たちにとって非常に重要です。ご意見、ご提案、または問題がございましたらお聞かせください。

---

1. お名前/ニックネーム *
   [記述式]

2. メールアドレス *
   [記述式 - メール形式]

3. フィードバックの種類 *
   [ラジオボタン]
   ○ 機能の提案
   ○ バグ報告
   ○ 使用方法の質問
   ○ 製品レビュー
   ○ その他

4. 詳細なフィードバック内容 *
   [段落]

5. YUIChatの使用頻度
   [ラジオボタン]
   ○ 毎日
   ○ 週に数回
   ○ たまに
   ○ 初めて使用

6. 返信が必要な場合の連絡先
   [記述式]

7. 関連するスクリーンショット（任意）
   [ファイルのアップロード]

---

確認メッセージ：
フィードバックをありがとうございます！お客様のご意見を真剣に読み、検討させていただきます。
```

## 隐私说明

在使用 Google Form 收集用户信息时，请确保：

1. 明确告知用户数据收集的目的
2. 遵守 GDPR 等数据保护法规
3. 不收集敏感个人信息
4. 提供隐私政策链接
5. 定期清理旧的反馈数据

## 故障排除

### 表单无法显示

1. 检查 Google Form 是否设置为"公开访问"
2. 确认嵌入 URL 格式正确（必须包含 `embedded=true`）
3. 检查浏览器是否阻止了 iframe

### 跨域问题

如果遇到跨域错误：
- Google Forms 默认允许嵌入，不应该有跨域问题
- 检查你的网站 CSP（内容安全策略）配置
- 确保允许来自 `docs.google.com` 的 iframe

## 参考资源

- [Google Forms 帮助中心](https://support.google.com/docs/topic/9054603)
- [Google Forms API](https://developers.google.com/forms/api)
- [Google Apps Script](https://developers.google.com/apps-script)

---

更新日期：2026-01-20
版本：1.2.30
