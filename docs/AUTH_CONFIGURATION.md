# 认证配置指南

## 版本: 1.1.6

本文档介绍如何配置 YUIChat 的认证功能，包括邮箱验证、Google SSO 登录和多语言邮件模板配置。

**1.1.6 更新内容**：
- 新增多语言邮件模板配置说明
- 提供中文、英文、日文三种语言的邮件模板示例
- 添加多语言邮件实现方案对比

## 📋 目录

1. [邮箱验证配置](#邮箱验证配置)
2. [多语言邮件模板配置](#多语言邮件模板配置)
3. [Google OAuth 配置](#google-oauth-配置)
4. [测试认证功能](#测试认证功能)

---

## 邮箱验证配置

### 1. 启用邮箱确认

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择您的项目
3. 进入 **Authentication** > **Providers** > **Email**
4. 确保以下设置：
   - ✅ **Enable Email provider**: 打开
   - ✅ **Confirm email**: 打开（强制要求邮箱验证）
   - ✅ **Secure email change**: 打开（推荐）
   - ✅ **Double confirm email changes**: 打开（推荐）

### 2. 配置邮件模板（可选）

⚠️ **注意**：Supabase 原生不支持多语言邮件模板，每个模板类型只能配置一个版本。如需多语言支持，请参考 [多语言邮件模板配置](#多语言邮件模板配置) 章节。

如果您只需要单一语言的验证邮件：

1. 进入 **Authentication** > **Email Templates**
2. 选择 **Confirm signup** 模板
3. 自定义模板内容（以中文为例）：

```html
<h2>欢迎使用 YUIChat!</h2>
<p>感谢您注册 YUIChat 企业知识库服务。</p>
<p>请点击下面的链接验证您的邮箱地址：</p>
<p><a href="{{ .ConfirmationURL }}">验证邮箱</a></p>
<p>如果您没有注册 YUIChat 账号，请忽略此邮件。</p>
```

**英文模板示例**：

```html
<h2>Welcome to YUIChat!</h2>
<p>Thank you for signing up for YUIChat Enterprise Knowledge Base Service.</p>
<p>Please click the link below to verify your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Verify Email</a></p>
<p>If you did not sign up for a YUIChat account, please ignore this email.</p>
```

**日文模板示例**：

```html
<h2>YUIChatへようこそ!</h2>
<p>YUIChat企業ナレッジベースサービスにご登録いただきありがとうございます。</p>
<p>以下のリンクをクリックして、メールアドレスを確認してください：</p>
<p><a href="{{ .ConfirmationURL }}">メールアドレスを確認</a></p>
<p>YUIChatアカウントに登録していない場合は、このメールを無視してください。</p>
```

### 3. 配置重定向 URL

1. 进入 **Authentication** > **URL Configuration**
2. 添加以下 **Redirect URLs**：
   ```
   http://localhost:5179/
   http://localhost:5179/auth
   https://your-domain.com/
   https://your-domain.com/auth
   ```

### 4. SMTP 配置（生产环境）

默认情况下，Supabase 使用内置的邮件服务。对于生产环境，建议配置自己的 SMTP：

1. 进入 **Project Settings** > **Auth** > **SMTP Settings**
2. 填写 SMTP 配置：
   - **SMTP Host**: 您的 SMTP 服务器地址
   - **SMTP Port**: 通常是 587 或 465
   - **SMTP User**: SMTP 用户名
   - **SMTP Pass**: SMTP 密码
   - **SMTP Sender Email**: 发件人邮箱
   - **SMTP Sender Name**: 发件人名称（如"YUIChat Team"）

推荐的 SMTP 服务：
- [SendGrid](https://sendgrid.com)
- [Mailgun](https://www.mailgun.com)
- [Amazon SES](https://aws.amazon.com/ses/)
- [Resend](https://resend.com)

---

## 多语言邮件模板配置

### 背景说明

YUIChat 前端支持中文、日文、英文三种语言（配置在 `src/i18n.ts`），但 Supabase 的邮件模板系统本身**不支持多语言**。每个邮件类型（如注册确认、密码重置等）只能配置一个模板。

### 实现方案对比

#### 方案一：URL参数传递语言（推荐 ⭐）

**原理**：在确认链接中添加语言参数，让用户跳转到对应语言的页面。邮件内容使用通用图标和最简文字。

**优点**：
- ✅ 实现简单，无需额外服务
- ✅ 用户体验好，自动切换到对应语言界面
- ✅ 维护成本低

**缺点**：
- ❌ 邮件正文本身仍然是单语言

**实现步骤**：

1. **修改前端路由**，使其支持语言参数（已支持，无需修改）

2. **配置邮件模板**，使用简洁的多语言友好设计：

```html
<div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #333;">YUIChat</h1>
    <p style="color: #666;">Enterprise Knowledge Base Service</p>
    <p style="color: #666;">企業ナレッジベースサービス</p>
    <p style="color: #666;">企业知识库服务</p>
  </div>
  
  <div style="background: #f5f5f5; padding: 30px; border-radius: 8px; text-align: center;">
    <h2 style="color: #333; margin-bottom: 20px;">✉️ Email Verification / メール確認 / 邮箱验证</h2>
    <p style="color: #666; margin-bottom: 30px;">
      Click the button below to verify your email address.<br/>
      以下のボタンをクリックしてメールアドレスを確認してください。<br/>
      点击下方按钮验证您的邮箱地址。
    </p>
    <a href="{{ .ConfirmationURL }}" 
       style="display: inline-block; padding: 12px 30px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
      Verify Email / メール確認 / 验证邮箱
    </a>
  </div>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px; text-align: center;">
    <p>If you did not create an account, please ignore this email.</p>
    <p>アカウントを作成していない場合は、このメールを無視してください。</p>
    <p>如果您没有创建账号，请忽略此邮件。</p>
  </div>
</div>
```

3. **其他邮件模板**（密码重置、邮箱变更等），采用相同的多语言设计。

#### 方案二：检测用户浏览器语言

**原理**：在邮件中嵌入 JavaScript，根据用户浏览器语言动态显示内容。

**优点**：
- ✅ 邮件内容可以显示对应语言

**缺点**：
- ❌ 大多数邮件客户端不支持 JavaScript
- ❌ 可能被标记为垃圾邮件
- ❌ 不推荐使用

**结论**：不推荐使用此方案。

#### 方案三：使用专业邮件服务（企业级方案）

**原理**：使用 SendGrid、Mailgun 等专业邮件服务的多语言模板功能。

**优点**：
- ✅ 专业的多语言支持
- ✅ 强大的模板编辑器
- ✅ 详细的邮件发送统计
- ✅ 更高的送达率

**缺点**：
- ❌ 需要额外的服务费用
- ❌ 配置相对复杂
- ❌ 需要在应用层面传递语言参数

**实现步骤**（以 SendGrid 为例）：

1. **注册 SendGrid 账号**并创建 API Key

2. **在 Supabase 中配置 SMTP**（参考上文 SMTP 配置）

3. **在 SendGrid 中创建多语言模板**：
   - 创建三个动态模板（中文、英文、日文）
   - 每个模板使用相同的变量名

4. **修改应用代码**，在用户注册时记录语言偏好：

```typescript
// 注册时保存用户语言偏好到 user_metadata
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      language: i18n.language // 'zh', 'ja', or 'en'
    }
  }
});
```

5. **配置 Supabase Edge Function**（需要自定义邮件发送逻辑）：
   - 创建 Edge Function 拦截认证事件
   - 根据用户的 language 参数选择对应的模板
   - 调用 SendGrid API 发送邮件

**注意**：此方案需要升级到 Supabase Pro 计划以使用 Edge Functions 的完整功能。

#### 方案四：选择主要市场语言（最简单）

**原理**：根据目标用户群体，选择一种主要语言作为邮件语言。

**适用场景**：
- 用户群体主要使用一种语言
- 初创项目，资源有限
- 快速上线，后续优化

**实现步骤**：
1. 在 Supabase 邮件模板中选择一种语言（建议英文，国际通用）
2. 确保邮件内容简洁清晰
3. 用户进入应用后会自动切换到对应语言界面

### 推荐配置

对于大多数场景，我们推荐使用 **方案一（URL参数传递语言）**：

**注册确认邮件模板**：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Email - YUIChat</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #4F46E5; font-size: 32px; font-weight: bold;">YUIChat</h1>
              <p style="margin: 10px 0 0; color: #666; font-size: 14px;">Enterprise Knowledge Base Service</p>
              <p style="margin: 5px 0 0; color: #666; font-size: 14px;">企業ナレッジベースサービス | 企业知识库服务</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">✉️</div>
                <h2 style="margin: 0 0 20px; color: #333; font-size: 24px;">
                  Email Verification<br/>
                  <span style="font-size: 18px; color: #666;">メール確認 | 邮箱验证</span>
                </h2>
                <p style="color: #666; line-height: 1.6; margin-bottom: 10px;">
                  Click the button below to verify your email address.<br/>
                  <small>以下のボタンをクリックしてメールアドレスを確認してください。</small><br/>
                  <small>点击下方按钮验证您的邮箱地址。</small>
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Button -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <a href="{{ .ConfirmationURL }}" 
                 style="display: inline-block; padding: 14px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Verify Email / メール確認 / 验证邮箱
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5; text-align: center;">
                If you did not create an account, please ignore this email.<br/>
                アカウントを作成していない場合は、このメールを無視してください。<br/>
                如果您没有创建账号，请忽略此邮件。
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

**密码重置邮件模板**：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - YUIChat</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #4F46E5; font-size: 32px; font-weight: bold;">YUIChat</h1>
              <p style="margin: 10px 0 0; color: #666; font-size: 14px;">Enterprise Knowledge Base Service</p>
              <p style="margin: 5px 0 0; color: #666; font-size: 14px;">企業ナレッジベースサービス | 企业知识库服务</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">🔒</div>
                <h2 style="margin: 0 0 20px; color: #333; font-size: 24px;">
                  Reset Password<br/>
                  <span style="font-size: 18px; color: #666;">パスワードリセット | 重置密码</span>
                </h2>
                <p style="color: #666; line-height: 1.6; margin-bottom: 10px;">
                  Click the button below to reset your password.<br/>
                  <small>以下のボタンをクリックしてパスワードをリセットしてください。</small><br/>
                  <small>点击下方按钮重置您的密码。</small>
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Button -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <a href="{{ .ConfirmationURL }}" 
                 style="display: inline-block; padding: 14px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Reset Password / パスワードリセット / 重置密码
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5; text-align: center;">
                If you did not request a password reset, please ignore this email.<br/>
                パスワードリセットをリクエストしていない場合は、このメールを無視してください。<br/>
                如果您没有请求重置密码，请忽略此邮件。
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

**邮箱变更确认模板**：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Email Change - YUIChat</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #4F46E5; font-size: 32px; font-weight: bold;">YUIChat</h1>
              <p style="margin: 10px 0 0; color: #666; font-size: 14px;">Enterprise Knowledge Base Service</p>
              <p style="margin: 5px 0 0; color: #666; font-size: 14px;">企業ナレッジベースサービス | 企业知识库服务</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">📧</div>
                <h2 style="margin: 0 0 20px; color: #333; font-size: 24px;">
                  Confirm Email Change<br/>
                  <span style="font-size: 18px; color: #666;">メール変更確認 | 确认邮箱变更</span>
                </h2>
                <p style="color: #666; line-height: 1.6; margin-bottom: 10px;">
                  Click the button below to confirm your email change.<br/>
                  <small>以下のボタンをクリックしてメール変更を確認してください。</small><br/>
                  <small>点击下方按钮确认邮箱变更。</small>
                </p>
                <p style="color: #999; font-size: 14px; margin-top: 20px;">
                  From / 変更前 / 原邮箱: {{ .Email }}<br/>
                  To / 変更後 / 新邮箱: {{ .NewEmail }}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Button -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <a href="{{ .ConfirmationURL }}" 
                 style="display: inline-block; padding: 14px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Confirm Change / 変更確認 / 确认变更
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5; text-align: center;">
                If you did not request this change, please contact support immediately.<br/>
                この変更をリクエストしていない場合は、すぐにサポートにご連絡ください。<br/>
                如果您没有请求此变更，请立即联系客服。
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### 配置步骤

1. **登录 Supabase Dashboard**
2. 进入 **Authentication** > **Email Templates**
3. 依次配置以下模板：
   - **Confirm signup**: 使用上面的"注册确认邮件模板"
   - **Reset password**: 使用上面的"密码重置邮件模板"
   - **Confirm email change**: 使用上面的"邮箱变更确认模板"
   - **Magic Link**（如果使用）: 参考上述格式自定义
4. 保存并测试

### 测试多语言邮件

1. 切换前端语言到不同语言
2. 注册新账号
3. 检查收到的邮件是否显示正确
4. 点击邮件中的链接，确认跳转到应用后语言切换正确

---

## Google OAuth 配置

### 1. 创建 Google OAuth 应用

1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. 创建新项目或选择现有项目
3. 启用 **Google+ API**：
   - 导航至 **APIs & Services** > **Library**
   - 搜索 "Google+ API"
   - 点击 **Enable**

### 2. 创建 OAuth 2.0 凭证

1. 进入 **APIs & Services** > **Credentials**
2. 点击 **Create Credentials** > **OAuth client ID**
3. 如果是首次创建，需要先配置 **OAuth consent screen**：
   - User Type: 选择 **External**（外部用户）
   - App name: `YUIChat`
   - User support email: 您的邮箱
   - Developer contact information: 您的邮箱
   - Scopes: 添加 `email` 和 `profile`
   - Test users: 添加测试用户邮箱（开发阶段）

4. 创建 OAuth 客户端 ID：
   - Application type: **Web application**
   - Name: `YUIChat Web Client`
   - Authorized JavaScript origins:
     ```
     http://localhost:5179
     https://your-domain.com
     ```
   - Authorized redirect URIs:
     ```
     https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
     ```
     （将 `<your-supabase-project-ref>` 替换为您的 Supabase 项目 ID）

5. 保存后，您会获得：
   - **Client ID**
   - **Client Secret**

### 3. 在 Supabase 中配置 Google Provider

1. 返回 [Supabase Dashboard](https://app.supabase.com)
2. 进入 **Authentication** > **Providers**
3. 找到 **Google** 并点击展开
4. 填写配置：
   - ✅ **Enable Google provider**: 打开
   - **Client ID**: 粘贴从 Google 获取的 Client ID
   - **Client Secret**: 粘贴从 Google 获取的 Client Secret
   - **Redirect URL**: 复制显示的 URL（已自动填充）
5. 点击 **Save**

### 4. 测试 Google 登录

1. 启动开发服务器：
   ```bash
   npm run dev
   ```

2. 访问 http://localhost:5179
3. 如果已登录，先登出
4. 点击 "使用 Google 登录" 按钮
5. 选择 Google 账号并授权
6. 成功后会自动跳转回应用主页

---

## 测试认证功能

### 邮箱注册流程测试

1. **启动应用**：
   ```bash
   npm run dev
   ```

2. **访问登录页面**：
   - 未登录时会自动显示
   - 或访问 http://localhost:5179/auth

3. **注册新账号**：
   - 切换到"注册"标签
   - 输入邮箱和密码（至少6个字符）
   - 点击"注册"按钮

4. **验证邮箱**：
   - 检查您的邮箱收件箱（包括垃圾邮件）
   - 点击验证链接
   - 应该会跳转回应用并自动登录

5. **登录测试**：
   - 登出账号
   - 使用刚注册的邮箱和密码登录
   - 应该能成功进入主页

### Google SSO 测试

1. 点击"使用 Google 登录"按钮
2. 选择 Google 账号
3. 授权应用访问基本信息
4. 应该自动跳转回主页并登录

### 登出测试

1. 登录后，点击左下角的用户信息区域
2. 点击"登出"按钮
3. 应该返回到登录页面
4. 用户信息应该被清除

---

## 🔧 故障排除

### 邮件未收到

1. **检查垃圾邮件文件夹**
2. **验证邮箱地址是否正确**
3. **查看 Supabase 日志**：
   - Dashboard > Logs > Auth Logs
4. **检查 SMTP 配置**（如果使用自定义 SMTP）

### Google 登录失败

1. **检查 Redirect URI**：
   - 确保在 Google Cloud Console 中配置了正确的回调 URL
   - URL 必须完全匹配，包括协议（https://）

2. **检查 Client ID 和 Secret**：
   - 确保在 Supabase 中正确填写

3. **查看浏览器控制台**：
   - 检查是否有 CORS 错误或其他错误信息

4. **检查 OAuth Consent Screen**：
   - 确保应用状态不是"Testing"时已添加测试用户
   - 或将应用发布到生产环境

### 登出后仍显示已登录

1. **清除浏览器缓存和 Cookies**
2. **检查控制台是否有错误**
3. **刷新页面**（Ctrl/Cmd + Shift + R）

---

## 📝 环境变量检查清单

确保 `.env.local` 文件包含以下配置：

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Python Backend & Chainlit URLs
VITE_PY_BACKEND_URL=http://localhost:8000
```

---

## 🚀 生产环境部署

### 1. 更新 Redirect URLs

在 Supabase Dashboard 中添加生产域名：
```
https://your-domain.com
https://your-domain.com/auth
```

### 2. 更新 Google OAuth

在 Google Cloud Console 中添加生产域名：
- Authorized JavaScript origins
- Authorized redirect URIs

### 3. 配置自定义 SMTP

建议在生产环境使用自定义 SMTP 服务以确保邮件送达率。

### 4. SSL 证书

确保您的生产域名配置了有效的 SSL 证书（HTTPS）。

---

## 📚 相关文档

- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)
- [项目部署指南](./DEPLOYMENT.md)
- [项目状态](./PROJECT_STATUS.md)

---

**最后更新**: 2026-01-17 (v1.1.6)
