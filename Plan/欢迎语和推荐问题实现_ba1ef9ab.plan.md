---
name: 欢迎语和推荐问题实现
overview: 在项目设置中配置AI头像、欢迎语和推荐问题，并在内部chat和外部chat中实现。推荐问题支持从项目配置读取，如果未设置则使用高频问题。支持根据系统语言切换。
todos:
  - id: add-db-fields
    content: 在Supabase的knowledge_bases表中添加chat_config JSON字段（包含avatar_url、welcome_message、recommended_questions）
    status: completed
  - id: update-settings-page
    content: 在SettingsPage.tsx中添加AI头像上传（图片上传）、欢迎语、推荐问题的配置表单
    status: completed
    dependencies:
      - add-db-fields
  - id: implement-internal-chat
    content: 在ChatInterface.tsx中实现欢迎界面，从项目配置读取并支持语言切换
    status: completed
    dependencies:
      - add-db-fields
  - id: implement-external-chat-api
    content: 在backend_py/app.py中添加/api/chat-config端点，返回项目的聊天配置
    status: completed
    dependencies:
      - add-db-fields
  - id: implement-external-chat-chainlit
    content: 在Chainlit的start函数中实现欢迎界面和推荐问题，支持动态配置和语言切换
    status: completed
    dependencies:
      - implement-external-chat-api
  - id: implement-frequent-questions
    content: 实现高频问题获取逻辑（当项目未配置推荐问题时使用）
    status: completed
    dependencies:
      - add-db-fields
---

# 欢迎语和推荐问题实现

## 概述

在项目设置中配置AI头像、欢迎语和推荐问题，并在内部chat（ChatInterface）和外部chat（Chainlit）中实现。如果项目未设置推荐问题，则使用高频问题。支持根据系统语言自动切换。

## 需求

1. **项目设置中配置**：AI头像（上传图片文件）、欢迎语、推荐问题（JSON数组，最多3个）
2. **不显示免责提示**
3. **内部chat和外部chat都实现**
4. **根据系统语言，自动切换语言**

## 数据库设计

在 `knowledge_bases` 表中添加 `chat_config` JSON字段：

```json
{
  "avatar_url": "https://example.com/avatar.png",
  "welcome_message": {
    "zh": "您好,我是您的小助理机器人,有什么问题可以问我,我会尽力为您解答!",
    "en": "Hello, I am your assistant robot, what questions can you ask me, I will try my best to answer them for you!",
    "ja": "こんにちは、私はあなたの小さなアシスタントロボットです。質問があれば私に聞いてください。できる限りお答えします！"
  },
  "recommended_questions": {
    "zh": ["问题1", "问题2", "问题3"],
    "en": ["Question 1", "Question 2", "Question 3"],
    "ja": ["質問1", "質問2", "質問3"]
  }
}
```

## 实现方案

### 1. 数据库迁移

在 `knowledge_bases` 表添加 `chat_config` JSONB字段：

```sql
ALTER TABLE knowledge_bases 
ADD COLUMN IF NOT EXISTS chat_config JSONB DEFAULT '{}'::jsonb;
```

### 2. 项目设置页面 (`src/pages/SettingsPage.tsx`)

在现有设置页面添加聊天配置部分：

- **AI头像**：
  - 图片上传：支持上传图片文件（png, jpg, jpeg, gif, webp）
  - 上传到 Supabase Storage（`knowledge-base-files` bucket，路径：`{kb_id}/avatars/avatar.png`）
  - 预览：圆形头像预览，显示当前头像或占位符
  - 上传后获取公开URL，保存到 `chat_config.avatar_url`
  - 支持拖拽上传和点击选择文件

- **欢迎语**（多语言）：
  - 支持中文、英文、日文
  - 根据系统语言自动填充当前语言

- **推荐问题**（多语言）：
  - 每个语言最多3个问题
  - 动态添加/删除问题
  - 如果留空，系统将使用高频问题

### 3. 内部Chat实现 (`src/components/ChatInterface.tsx`)

修改欢迎界面（252-258行）：

- 从项目配置读取 `chat_config`
- 根据系统语言（`i18n.language`）选择对应的欢迎语和推荐问题
- 显示AI头像（如果配置了）
- 显示推荐问题按钮（可点击发送）
- 如果未配置推荐问题，调用后端API获取高频问题

### 4. 后端API (`backend_py/app.py`)

#### 4.1 获取聊天配置 API

```python
@fastapi_app.get("/api/chat-config")
async def get_chat_config(request: Request):
    """
    获取项目的聊天配置（欢迎语、推荐问题等）
    """
    kb_token = request.query_params.get("kb_id")
    language = request.query_params.get("language", "zh")
    
    # 从数据库读取 chat_config
    # 如果未配置推荐问题，返回高频问题
```

#### 4.2 获取高频问题 API

```python
@fastapi_app.get("/api/frequent-questions")
async def get_frequent_questions(request: Request):
    """
    获取高频问题（当项目未配置推荐问题时使用）
    可以通过分析向量库中的问题来生成
    """
    kb_token = request.query_params.get("kb_id")
    language = request.query_params.get("language", "zh")
    
    # 从向量库检索相关问题，或返回默认问题
```

### 5. 外部Chat实现 (`backend_py/app.py` - `@cl.on_chat_start`)

修改 `start()` 函数（约573行）：

- 从数据库读取项目的 `chat_config`
- 根据系统语言或URL参数选择对应语言
- 使用 `cl.Message` 发送欢迎语（带头像）
- 使用 `cl.ActionButton` 或自定义HTML显示推荐问题

注意：Chainlit支持使用自定义HTML和CSS来显示推荐问题按钮。

### 6. 语言切换支持

- **前端**：使用 `i18n.language` 或 `navigator.language` 检测系统语言
- **后端**：通过URL参数 `language` 或请求头 `Accept-Language` 检测语言
- **默认语言**：如果检测不到或未支持，使用中文（zh）

## 文件变更清单

1. **数据库迁移**：添加 `chat_config` 字段到 `knowledge_bases` 表
2. **src/pages/SettingsPage.tsx**：添加聊天配置表单
3. **src/components/ChatInterface.tsx**：修改欢迎界面，支持配置和语言切换
4. **src/i18n.ts**：添加相关翻译键（如需要）
5. **backend_py/app.py**：

   - 添加 `/api/chat-config` 端点
   - 添加 `/api/frequent-questions` 端点
   - 修改 `@cl.on_chat_start` 函数

6. **backend_py/public/custom.js**（可选）：如需在Chainlit中自定义推荐问题UI

## 实现细节

### 项目设置页面示例

```typescript
// SettingsPage.tsx 新增部分
const [chatConfig, setChatConfig] = useState({
  avatar_url: '',
  welcome_message: { zh: '', en: '', ja: '' },
  recommended_questions: { zh: [], en: [], ja: [] }
});
const [avatarFile, setAvatarFile] = useState<File | null>(null);
const [avatarPreview, setAvatarPreview] = useState<string>('');

// 上传头像
const handleAvatarUpload = async (file: File) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `avatar.${fileExt}`;
  const filePath = `${kb.id}/avatars/${fileName}`;
  
  // 上传到 Supabase Storage
  const { data, error } = await supabase.storage
    .from('knowledge-base-files')
    .upload(filePath, file, { upsert: true });
  
  if (error) throw error;
  
  // 获取公开URL
  const { data: { publicUrl } } = supabase.storage
    .from('knowledge-base-files')
    .getPublicUrl(filePath);
  
  setChatConfig(prev => ({ ...prev, avatar_url: publicUrl }));
  setAvatarPreview(publicUrl);
};

// 保存配置
const handleSaveChatConfig = async () => {
  if (avatarFile) {
    await handleAvatarUpload(avatarFile);
  }
  
  await supabase
    .from('knowledge_bases')
    .update({ chat_config: chatConfig })
    .eq('id', kb.id);
};
```

### 内部Chat读取配置

```typescript
// ChatInterface.tsx
const [chatConfig, setChatConfig] = useState(null);

useEffect(() => {
  if (currentKb && messages.length === 0) {
    // 从currentKb读取chat_config
    const config = currentKb.chat_config || {};
    const lang = i18n.language.split('-')[0]; // zh, en, ja
    
    setChatConfig({
      avatarUrl: config.avatar_url || '',
      welcomeMessage: config.welcome_message?.[lang] || config.welcome_message?.zh || '',
      recommendedQuestions: config.recommended_questions?.[lang] || []
    });
    
    // 如果未配置推荐问题，获取高频问题
    if (!config.recommended_questions?.[lang]) {
      fetchFrequentQuestions(lang);
    }
  }
}, [currentKb, messages.length, i18n.language]);
```

### Chainlit欢迎界面

```python
# app.py - @cl.on_chat_start
async def start():
    # ... 现有代码 ...
    
    # 读取 chat_config
    chat_config = result.data.get("chat_config", {})
    language = "zh"  # 从请求头或参数获取
    
    # 欢迎语
    welcome_msg = chat_config.get("welcome_message", {}).get(language, "")
    if welcome_msg:
        avatar_url = chat_config.get("avatar_url", "")
        await cl.Message(content=welcome_msg, author=avatar_url).send()
    
    # 推荐问题
    questions = chat_config.get("recommended_questions", {}).get(language, [])
    if not questions:
        # 获取高频问题
        questions = await get_frequent_questions(kb_id, language)
    
    # 使用HTML显示推荐问题按钮
    if questions:
        questions_html = "".join([
            f'<button class="recommended-question-btn" data-question="{q}">{q}</button>'
            for q in questions[:3]
        ])
        await cl.Message(content=f"<div class='recommended-questions'>{questions_html}</div>").send()
```

## 注意事项

1. **数据验证**：

   - 头像文件：限制文件大小（建议2MB）、格式（png, jpg, jpeg, gif, webp）
   - 推荐问题数量限制为最多3个
   - 欢迎语长度限制

2. **头像存储**：

   - 使用现有的 `knowledge-base-files` Storage bucket
   - 存储路径：`{knowledge_base_id}/avatars/avatar.{ext}`
   - 支持覆盖上传（upsert: true）
   - 获取公开URL后保存到数据库

3. **向后兼容**：

   - `chat_config` 字段默认为空JSON `{}`
   - 如果字段为空，使用默认值或高频问题

4. **性能优化**：

   - 缓存高频问题结果
   - 避免重复查询数据库

5. **多语言支持**：

   - 确保所有支持的语言都有对应的默认值
   - 语言代码标准化（zh, en, ja）

6. **Chainlit限制**：

   - Chainlit对自定义HTML的支持有限，可能需要使用 `cl.ActionButton` 或通过 `custom.js` 实现交互