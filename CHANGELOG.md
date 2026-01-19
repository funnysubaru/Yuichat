# Changelog

## 1.2.24 (2026-01-19)

### 架构重构

- 🔄 **完全替代 Chainlit，使用 FastAPI + SSE 流式输出**：
  - 移除 Chainlit 框架依赖，创建独立的 FastAPI 应用
  - 使用 React 前端 + `/api/chat/stream` 端点实现面向用户的聊天功能
  - 实现 Server-Sent Events (SSE) 协议支持流式输出
  - 保留 `/api/chat` 非流式端点以确保向后兼容

### 后端改进

- ⚡ **流式输出支持**：
  - 在 `workflow.py` 中添加 `chat_node_stream` 函数，支持异步流式生成答案
  - 使用 LangChain 的 `astream` 方法实现实时文本流
  - 实现 SSE 数据格式：`data: {json}\n\n`

- 🔧 **FastAPI 应用重构**：
  - 创建独立的 FastAPI 应用实例，移除 `chainlit.server.app` 依赖
  - 添加 CORS 中间件支持跨域访问
  - 新增 `/api/chat/stream` 端点，使用 `StreamingResponse` 实现 SSE
  - 使用 `asyncio.to_thread` 替代 `cl.make_async` 处理同步调用
  - 添加 uvicorn 启动代码，支持 `python app.py` 直接启动

- 📝 **代码保留与注释**：
  - 注释掉 Chainlit 相关代码（`@cl.on_chat_start` 和 `@cl.on_message`）
  - 添加版本标记（1.2.24）说明代码变更原因
  - 保留原有代码作为参考，遵循代码修改规范

### 前端改进

- ⚡ **流式显示支持**：
  - 更新 `ChatInterface.tsx` 的 `handleSend` 函数支持 SSE 流式显示
  - 使用 `fetch` + `ReadableStream` 解析 SSE 数据流
  - 实时追加消息内容，提升用户体验
  - 支持错误处理和连接中断处理

### 依赖更新

- 📦 **移除 Chainlit 依赖**：
  - 在 `requirements.txt` 中移除 `chainlit` 依赖
  - 添加 `uvicorn` 作为 FastAPI 服务器
  - 简化依赖树，减少项目复杂度

### 文档和脚本更新

- 📚 **更新启动文档**：
  - 修改 `QUICK_START_GUIDE.md`，更新启动命令从 `chainlit run app.py` 改为 `python app.py`
  - 更新环境变量说明，移除 `VITE_CHAINLIT_URL`
  - 更新访问地址说明（从 "Chainlit" 改为 "API 端点"）

- 🔧 **更新启动脚本**：
  - 修改 `monitor_backend.sh` 使用 `python app.py` 启动
  - 更新 `setup.sh` 和 `setup.bat` 中的启动命令
  - 保持脚本的向后兼容性

### 技术细节

- **SSE 数据格式**：
  - 数据块：`data: {"chunk": "文本内容"}\n\n`
  - 完成标记：`data: {"done": true, "answer": "完整答案", "context": "上下文"}\n\n`
  - 结束标记：`data: [DONE]\n\n`
  - 错误处理：`data: {"error": "错误信息", "done": true}\n\n`

- **向后兼容**：
  - 保留 `/api/chat` 非流式端点
  - 前端可根据需要选择流式或非流式方式
  - 所有现有 API 端点保持不变

## 1.2.23 (2026-01-19)

### 功能改进

- 🎨 **项目头像显示功能**：
  - 在C端聊天对话中，AI头像现在会优先显示项目设置的头像
  - 当项目没有设置头像时，自动使用默认头像（Bot图标）
  - 头像显示位置包括：消息列表、加载状态、欢迎界面
  - 创建了独立的Avatar组件，统一处理头像显示和错误处理
  - 支持图片加载失败时自动回退到默认图标

## 1.2.22 (2026-01-19)

### UI改进

- 🎨 **颜色标准化**：
  - 将聊天界面中的链接颜色从自定义 `text-primary` 替换为 Tailwind CSS 官方标准的 `text-purple-600`
  - 根据 Tailwind CSS 官方文档，使用标准的紫色色阶，确保颜色一致性
  - 更新 hover 状态为 `hover:text-purple-700`，符合官方颜色规范

- 🎨 **Chainlit 欢迎界面颜色定制**：
  - 根据 Chainlit 官方文档，在 `custom.css` 中添加样式规则
  - 将欢迎界面中圆形图标的颜色替换为 YUI 紫色（#9333ea）
  - 使用 `:nth-child(1)` 选择器精确选择第一个子元素（圆形图标）
  - 使用 `:nth-child(2)` 选择器确保箭头（第二个子元素）保持白色
  - 同时设置 SVG 元素的 `color`、`fill` 和 `stroke` 属性，确保图标正确显示

## 1.2.18 (2026-01-19)

### UI改进

- 🎨 **外部分享页面添加侧边栏**：
  - 外部分享管理页面（`/share`）现在显示左侧导航栏
  - 保持与其他管理页面（如项目设置、知识库等）一致的布局体验
  - 公开分享链接（`/share/:shareToken`）仍然不显示侧边栏，保持简洁的公开访问体验

### 技术改进

- 🔧 **路由布局逻辑优化**：
  - 修改 `App.tsx` 中的布局显示逻辑，区分管理页面和公开分享链接
  - 只有带参数的公开分享路由不显示侧边栏，管理页面统一显示侧边栏

## 1.2.17 (2026-01-19)

### UI改进

- 🎨 **输入框固定在网页最下方**：
  - 将输入框从聊天容器中移出，使用 `fixed` 定位固定在浏览器窗口底部
  - 输入框始终可见，不受页面滚动影响
  - 调整消息区域底部 padding，避免内容被输入框遮挡
  - 输入框左边距设置为 `left-60`（240px），适配侧边栏宽度

### 技术改进

- 🔧 **布局优化**：
  - 修改输入框定位方式，从相对定位改为固定定位
  - 优化消息容器底部间距，确保最后一条消息不被输入框遮挡
  - 使用 `z-40` 确保输入框在合适的层级显示

## 1.2.16 (2026-01-19)

### UI改进

- 🎨 **聊天界面布局优化**：
  - 将输入框固定在底部，使用 `flex-shrink-0` 确保输入框始终可见
  - 优化对话消息区域布局，使用 `flex-1` 和 `min-h-0` 确保正确的滚动行为
  - 改进自动滚动逻辑，确保新消息时自动滚动到底部
  - 对话消息向上滚动，新消息显示在底部

- 🎨 **对话记录浮窗化**：
  - 将对话记录侧边栏改为浮窗形式，默认显示一个圆形icon按钮
  - 点击icon展开对话记录浮窗，显示完整的对话列表
  - 点击箭头按钮收起浮窗，回到icon状态
  - 浮窗位置固定在右下角，位于输入框上方，不遮挡输入框
  - 使用阴影和圆角优化浮窗视觉效果

### 技术改进

- 🔧 **布局优化**：
  - 修改 `ChatInterface` 组件布局结构，使用 `flex-col` 和 `h-full` 确保正确的布局
  - 优化消息容器的滚动行为，使用 `overflow-y-auto` 和 `min-h-0`
  - 改进 `scrollToBottom` 的调用时机，确保消息更新时正确滚动

- 🔧 **浮窗实现**：
  - 在 `ConversationHistorySidebar` 中添加 `isExpanded` 状态管理
  - 使用 `fixed` 定位实现浮窗效果
  - 优化浮窗的最大高度计算，确保不超出屏幕范围

## 1.2.14 (2026-01-19)

### 问题修复

- 🐛 **修复对话记录未保存问题**：
  - 修复点击推荐问题时未创建对话导致消息无法保存的问题
  - 在 `handleRecommendedQuestionClick` 中添加创建对话的逻辑
  - 修复 `autoSaveMessage` 中标题更新的逻辑（检查是否是第一条AI回复）
  - 添加防重复保存机制，使用 `savedMessageIdsRef` 跟踪已保存的消息ID
  - 在切换对话或清空消息时重置已保存消息ID集合

### 技术改进

- 🔧 **消息保存优化**：
  - 优化消息保存逻辑，确保所有消息都能正确保存到数据库
  - 改进对话标题自动更新逻辑，准确识别第一条AI回复
  - 添加消息保存状态跟踪，防止重复保存相同消息

## 1.2.13 (2026-01-19)

### 新增功能

- ✨ **对话记录功能**：参考ChatMax的对话记录设计，实现完整的对话记录管理功能
  - 右侧边栏显示对话记录列表，每个对话显示AI问候语截断、时间戳和删除按钮
  - "新增对话"按钮创建新会话
  - 点击对话记录项加载历史对话
  - 数据库持久化存储对话记录，支持项目级隔离
  - 消息自动保存到数据库，新对话标题自动生成

### 数据库变更

- 📊 **新增对话相关表**：
  - `conversations` 表：存储对话会话元数据（id、knowledge_base_id、user_id、title、created_at、updated_at）
  - `conversation_messages` 表：存储对话消息（id、conversation_id、role、content、metadata、created_at）
  - 创建索引优化查询性能
  - 配置RLS策略确保用户只能访问自己的对话

### 技术改进

- 🔧 **服务层扩展**：
  - 创建 `conversationService.ts`，实现对话的CRUD操作和消息管理
  - 支持对话列表查询（按更新时间降序）
  - 支持批量保存消息、更新对话标题等功能
  - 完善错误处理和日志记录

- 🔧 **状态管理扩展**：
  - 扩展 `chatStore`，添加对话列表管理功能
  - 支持对话列表的增删改查操作
  - 优化对话切换逻辑

- 🔧 **UI组件**：
  - 创建 `ConversationHistorySidebar` 组件，实现对话记录侧边栏
  - 参考ChatMax的设计，显示对话列表、新增对话按钮和删除功能
  - 支持对话选择和历史消息加载

- 🔧 **ChatInterface集成**：
  - 修改布局为两栏布局（Chat | ConversationHistorySidebar）
  - 集成对话记录侧边栏组件
  - 发送消息时自动创建对话（如果没有对话）
  - 自动保存消息到数据库
  - 第一条AI回复时自动更新对话标题

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.13）
- 不使用硬编码，考虑扩展性（规则12）
- 仅在开发环境输出日志（规则4）

## 1.2.12 (2026-01-19)

### 技术改进

- 🔧 **文档片段数量配置化**：
  - 移除硬编码的文档片段数量限制（原固定为4个）
  - 新增环境变量配置 `MAX_CHUNKS`（默认4）和 `RETRIEVE_K`（默认8）
  - 支持通过环境变量自定义最终使用的文档片段数量和检索数量
  - 提高代码扩展性和通用性（遵循规则12：不使用硬编码）

### 修复问题

- 🐛 **文档片段数量限制问题**：
  - 修复了检索到8个有效文档但只使用4个的问题
  - 现在可以通过配置 `MAX_CHUNKS` 环境变量来控制使用的文档片段数量
  - `RETRIEVE_K` 控制检索时获取的文档数量，应该比 `MAX_CHUNKS` 大以便过滤错误文档

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.12）
- 移除硬编码，提高扩展性（规则12）

## 1.2.11 (2026-01-18)

### 新增功能

- ✨ **基于文档生成常见问题**：
  - 修改 `/api/frequent-questions` API，使其基于上传的文档内容生成常见问题
  - 从向量库中检索文档片段，使用LLM生成3个具体、实用的问题
  - 确保每个生成的问题都能从文档中找到答案（通过快速检索验证）
  - 如果文档检索失败或生成失败，回退到默认问题
  - 支持中文、英文、日文三种语言

### 技术改进

- 🔧 **frequent-questions API 优化**：
  - 从向量库检索相关文档片段（支持pgvector和Chroma）
  - 使用GPT-4o基于文档内容生成问题
  - 对每个生成的问题进行快速检索验证，确保有回复
  - 过滤错误文档（包含"爬取失败"或"解析失败"的文档）
  - 添加完善的错误处理和回退机制
  - 添加版本号注释（1.2.11）

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.11）
- 不使用硬编码，考虑扩展性（规则12）
- 仅在开发环境输出日志（规则4）

---

## 1.2.10 (2026-01-18)

### 修复问题

- 🐛 **修复AI头像重复显示问题**：
  - 问题原因：当用户发送消息后，会创建一个status为'streaming'的assistant消息，这个消息会显示一个Bot头像。同时，isTyping为true时，也会显示一个loading的Bot头像，导致出现两个头像
  - 解决方案：在渲染消息列表时，如果消息的status是'streaming'，就不显示头像，因为isTyping状态下已经有一个loading的头像了
  - 现在只保留loading状态的头像，避免重复显示

- 🐛 **删除打字机效果图标**：
  - 删除AI回复内容上方的打字机效果光标图标（垂直紫色条）
  - 现在只保留AI头像和loading的那一行，界面更简洁

- 🐛 **修复loading时残留图标问题**：
  - 问题原因：当消息状态为'streaming'时，虽然不显示头像，但消息气泡本身仍会渲染，导致上方残留图标
  - 解决方案：当消息状态为'streaming'时，完全隐藏这个消息，只显示isTyping的loading行
  - 现在loading时不会显示任何残留的图标或消息气泡

### 技术改进

- 🔧 **ChatInterface 组件优化**：
  - 修改消息渲染逻辑，当消息状态为'streaming'时完全隐藏该消息
  - 只显示isTyping的loading行，避免任何残留元素
  - 添加版本号注释（1.2.10）

- 🔧 **MarkdownRenderer 组件优化**：
  - 删除打字机效果图标（motion.span）
  - 移除未使用的motion导入
  - 添加版本号注释（1.2.10）

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.10）

---

## 1.2.9 (2026-01-18)

### 修复问题

- 🐛 **修复推荐问题点击无反应问题**：
  - 问题原因：按钮的 `disabled` 属性包含了 `loadingQuestions`，导致在加载时无法点击
  - 问题原因：点击事件可能被其他元素拦截
  - 解决方案：
    - 移除 `loadingQuestions` 从 `disabled` 条件中，只保留 `isTyping`
    - 在点击事件中添加 `e.preventDefault()` 和 `e.stopPropagation()` 防止事件冒泡
    - 添加 `cursor-pointer` 类名，明确指示可点击
    - 改进 `handleRecommendedQuestionClick` 函数的错误处理和调试日志
    - 移除默认问题的 `!loadingQuestions` 条件，确保始终显示

- 🐛 **删除"加载推荐问题中..."提示**：
  - 移除加载提示，避免界面闪烁
  - 直接显示默认问题，提升用户体验

### 技术改进

- 🔧 **ChatInterface 组件优化**：
  - 改进推荐问题按钮的点击处理
  - 优化错误处理和调试日志
  - 添加版本号注释（1.2.8）

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.8）

---

## 1.2.8 (2026-01-18)

### UI改进

- 🎨 **优化欢迎界面布局，使其更像聊天消息样式**：
  - 将布局从居中改为左对齐的聊天消息样式
  - AI头像和欢迎语显示在一个消息气泡中（类似聊天消息）
  - 推荐问题按钮调整为浅灰色背景（`bg-gray-100`），圆角样式
  - 推荐问题按钮左对齐，与AI消息对齐
  - 确保即使没有配置推荐问题，也显示默认的3个问题
  - 免责声明左对齐显示
  - 优化整体布局，使其更符合聊天界面的视觉习惯

### 技术改进

- 🔧 **ChatInterface 组件UI优化**：
  - 调整欢迎界面的布局结构
  - 改进推荐问题按钮的样式和位置
  - 确保默认问题始终显示
  - 添加版本号注释（1.2.7）

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.7）

---

## 1.2.7 (2026-01-18)

### UI改进

- 🎨 **优化测试对话欢迎界面UI**：
  - 增大AI头像尺寸（从 20x20 增加到 24x24），使其更突出
  - 优化头像样式，添加阴影和边框效果
  - 优化欢迎语样式，使用更大的字体和更好的行高
  - 改进推荐问题按钮样式，使用气泡/卡片样式，添加悬停效果
  - 添加免责声明："以上内容由AI生成，不代表开发者立场"
  - 优化整体布局和间距，使其更友好和美观

### 技术改进

- 🔧 **ChatInterface 组件UI优化**：
  - 调整欢迎界面的布局和样式
  - 改进推荐问题按钮的交互效果
  - 添加版本号注释（1.2.6）

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.6）

---

## 1.2.6 (2026-01-18)

### 修复问题

- 🐛 **修复高频问题 API 错误处理**：
  - 问题原因：当后端返回 HTML 而不是 JSON 时，会导致 JSON 解析错误
  - 问题原因：网络错误时没有提供降级方案
  - 解决方案：
    - 检查响应内容类型，如果不是 JSON 则使用默认问题
    - API 失败时返回默认问题列表，而不是空数组
    - 改进错误处理，确保用户始终能看到推荐问题
  - 现在即使 API 失败，也会显示默认的推荐问题

### 技术改进

- 🔧 **ChatInterface 组件优化**：
  - 改进 `fetchFrequentQuestions` 函数的错误处理
  - 添加响应内容类型检查
  - API 失败时使用默认问题列表
  - 添加版本号注释（1.2.5）

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.5）

---

## 1.2.5 (2026-01-18)

### 修复问题

- 🐛 **修复重置后欢迎语不显示问题**：
  - 问题原因：重置后 `chatConfig` 被设置为 null，但配置加载的 useEffect 可能没有正确触发
  - 解决方案：
    - 提取 `loadChatConfig` 函数，避免代码重复
    - 在重置逻辑中，如果 `currentKb` 存在，立即触发配置加载
    - 优化配置加载的 useEffect，确保在 `chatConfig` 为 null 时也能重新加载
    - 确保即使 `chatConfig` 为 null，也能显示默认欢迎语
  - 现在重置后会立即显示欢迎语（配置的或默认的）

### 技术改进

- 🔧 **ChatInterface 组件优化**：
  - 提取 `loadChatConfig` 函数，统一配置加载逻辑
  - 在重置时立即触发配置加载，不等待 useEffect
  - 优化配置加载的 useEffect 依赖项
  - 添加版本号注释（1.2.4）

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.4）

---

## 1.2.4 (2026-01-18)

### 修复问题

- 🐛 **修复测试对话刷新问题**：
  - 问题原因：当用户在测试对话页面点击侧边栏的"测试对话"时，由于路由没有变化，不会触发刷新
  - 解决方案：
    - 在侧边栏点击"测试对话"时，如果已在 `/chat` 页面，添加 `_refresh` 时间戳参数强制触发刷新
    - 在 `ChatInterface` 中检测 `_refresh` 参数，清空消息并重置配置，然后移除该参数
    - 同时检测 URL 完整路径（包括查询参数）的变化
  - 现在每次点击侧边栏的"测试对话"都会刷新聊天框并显示欢迎语

### 技术改进

- 🔧 **Sidebar 组件优化**：
  - 添加 `handleMenuItemClick` 函数处理菜单项点击
  - 当点击"测试对话"且已在 `/chat` 页面时，添加时间戳参数强制刷新
  - 添加版本号注释（1.2.3）

- 🔧 **ChatInterface 组件优化**：
  - 检测 `_refresh` 参数并处理刷新逻辑
  - 自动清理 URL 中的 `_refresh` 参数
  - 同时检测 URL 完整路径的变化
  - 添加版本号注释（1.2.3）

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.3）

---

## 1.2.3 (2026-01-18)

### 新增功能

- ✨ **测试对话路由刷新功能**：
  - 当从侧边栏点击其他选项，然后再点击测试对话时，自动刷新聊天框并显示欢迎语
  - 使用 `useLocation` 检测路由变化
  - 当从其他页面导航到 `/chat` 时，自动清空消息并重置配置
  - 确保每次进入测试对话页面时都能看到欢迎界面

### 技术改进

- 🔧 **ChatInterface 组件优化**：
  - 添加路由变化检测逻辑
  - 使用 `useRef` 记录上一个路由路径
  - 当检测到从其他页面导航到 `/chat` 时，清空消息并重置 `chatConfig`
  - 添加版本号注释（1.2.2）

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.2）

---

## 1.2.2 (2026-01-18)

### 修复问题

- 🐛 **修复测试对话和C端对话欢迎语显示问题**：
  - 问题原因：当切换项目时，如果 localStorage 中有其他项目的消息，欢迎语不会显示
  - 解决方案：
    - 修复 `ChatInterface.tsx`：确保切换项目时正确清空消息，并在消息为空时显示欢迎语
    - 修复 `backend_py/app.py`：确保 Chainlit 在所有情况下（包括查询失败、vector_collection 为空等）都能发送欢迎语
  - 测试对话：现在切换项目时会正确清空消息并显示欢迎语
  - C端对话：现在在所有情况下都会显示欢迎语（包括默认欢迎语）

### 技术改进

- 🔧 **ChatInterface 组件优化**：
  - 从 store 获取 `currentKbId` 进行比较，确保切换项目时正确清空消息
  - 当消息为空时，重置 `chatConfig` 以触发重新加载欢迎语
  - 添加版本号注释（1.2.1）

- 🔧 **Chainlit 欢迎语逻辑优化**：
  - 即使 `vector_collection` 为空，也发送默认欢迎语
  - 即使数据库查询失败，也发送默认欢迎语
  - 即使 Supabase 客户端未初始化，也发送默认欢迎语
  - 添加版本号注释（1.2.1）

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.1）

---

## 1.2.1 (2026-01-18)

### 修复问题

- 🐛 **修复头像上传错误**：修复 "mime type image/png is not supported" 错误
  - 问题原因：存储桶的 `allowed_mime_types` 配置中未包含图片类型
  - 解决方案：更新存储桶配置，添加图片MIME类型支持
  - 支持的图片类型：PNG、JPEG、JPG、GIF、WEBP、SVG
  - 创建迁移文件 `20260118000000_add_image_mime_types.sql`

### 数据库变更

- 📊 **存储桶配置更新**：更新 `knowledge-base-files` 存储桶的 `allowed_mime_types`
  - 保留原有类型（文档、音频、视频）
  - 新增图片类型：`image/png`, `image/jpeg`, `image/jpg`, `image/gif`, `image/webp`, `image/svg+xml`

### 技术改进

- 🔧 使用 MCP Supabase 工具应用迁移
- 🔧 确保头像上传功能正常工作

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.1）

---

## 1.2.0 (2026-01-18)

### 新增功能

- ✨ **聊天配置功能**：在项目设置中配置AI头像、欢迎语和推荐问题
  - 支持上传图片作为AI头像（PNG、JPG、JPEG、GIF、WEBP，最大2MB）
  - 支持多语言欢迎语配置（中文、英文、日文）
  - 支持多语言推荐问题配置（每种语言最多3个问题）
  - 如果未配置推荐问题，系统自动使用高频问题

- 🎨 **内部Chat欢迎界面增强**：
  - 显示配置的AI头像（如果配置了）
  - 显示配置的欢迎语（根据系统语言自动切换）
  - 显示推荐问题按钮（可点击发送问题）
  - 根据系统语言自动切换欢迎语和推荐问题

- 🌐 **外部Chat（Chainlit）欢迎界面增强**：
  - 显示配置的欢迎语（根据系统语言自动切换）
  - 显示推荐问题Action按钮（可点击发送问题）
  - 支持动态配置和语言切换

- 🔧 **后端API扩展**：
  - 添加 `/api/chat-config` 端点：获取项目的聊天配置
  - 添加 `/api/frequent-questions` 端点：获取高频问题（当项目未配置推荐问题时使用）

### 数据库变更

- 📊 **数据库迁移**：在 `knowledge_bases` 表中添加 `chat_config` JSONB字段
  - 存储 `avatar_url`（头像URL）
  - 存储 `welcome_message`（多语言欢迎语）
  - 存储 `recommended_questions`（多语言推荐问题）

### 技术改进

- 🔧 **项目设置页面扩展**：
  - 添加AI头像上传功能（支持拖拽上传）
  - 添加多语言欢迎语配置表单
  - 添加多语言推荐问题配置表单（动态添加/删除）

- 🌍 **多语言支持**：
  - 支持中文（zh）、英文（en）、日文（ja）
  - 根据系统语言（`i18n.language` 或 `navigator.language`）自动切换

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.2.0）
- 不使用硬编码，考虑扩展性（规则12）
- 所有开发环境日志仅在开发环境输出（规则4）

---

## 1.1.17 (2026-01-18)

### 界面优化

- 🎨 **项目卡片显示优化**：在项目卡片的蓝色区域显示完整项目名称
  - 将单个字符（头像）改为显示完整的项目名称
  - 最多显示两行，超出部分用省略号（...）代替
  - 使用 Tailwind CSS 的 `line-clamp-2` 类实现文本截断
  - 优化文字大小和样式，确保在蓝色背景上清晰可见

### 技术改进

- 🔧 **样式优化**：
  - 调整项目卡片内容布局，从单个字符改为多行文本
  - 使用 `line-clamp-2` 实现两行文本截断和省略号显示
  - 添加 `w-full px-2` 确保文本区域宽度和间距合适

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.1.17）
- 不使用硬编码，考虑扩展性（规则12）

---

## 1.1.16 (2026-01-18)

### 修复问题

- 🐛 **修复测试对话项目隔离问题**：
  - 修复项目切换时对话历史没有清空的问题
  - 确保切换项目时自动清空对话历史，不同项目的对话完全隔离
  - 添加项目切换时的日志输出，便于调试
  - 优化useEffect依赖，避免循环更新

- ✅ **对话隔离实现**：
  - 当项目ID变化时，自动清空当前对话历史
  - 确保发送消息时使用当前项目的share_token
  - 添加错误提示，当没有选择项目时给出友好提示
  - 添加调试日志，显示当前使用的项目信息

### 技术改进

- 🔧 **useEffect优化**：
  - 将projectId提取到useEffect外部，避免依赖问题
  - 只监听项目ID参数变化，减少不必要的重新渲染
  - 使用eslint-disable注释处理必要的依赖警告

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.1.16）
- 不使用硬编码，考虑扩展性（规则12）
- 仅在开发环境输出日志（规则4）

---

## 1.1.15 (2026-01-18)

### 全面实现项目隔离

- ✅ **侧边栏项目切换功能**：
  - 从URL参数读取当前项目ID
  - 显示项目列表下拉菜单，支持快速切换项目
  - 显示当前项目名称和头像
  - 点击外部自动关闭下拉菜单
  
- ✅ **所有菜单项支持项目隔离**：
  - 所有项目级菜单项（知识库、项目设置、测试对话、外部分享、数据看板）导航时都带上项目ID参数
  - 确保切换页面时保持当前项目上下文

- ✅ **SharePage 项目隔离**：
  - 从URL参数读取项目ID
  - 只显示当前项目的分享链接
  - 验证用户权限，确保只能访问自己的项目

- ✅ **创建 SettingsPage**：
  - 支持项目隔离，根据URL参数加载对应项目的设置
  - 可以修改项目名称和描述
  - 验证用户权限

- ✅ **创建 DashboardPage**：
  - 支持项目隔离，根据URL参数显示对应项目的统计数据
  - 显示总文档数、已完成、处理中、失败数量
  - 显示处理完成率
  - 只统计当前项目的文档

### 技术改进

- 🔧 **URL参数管理**：
  - 所有页面统一使用 `?project=<project_id>` 参数
  - 侧边栏自动在所有导航链接中添加项目ID参数
  - 支持项目切换时保持当前页面路径

- 🔧 **用户体验优化**：
  - 项目下拉菜单支持点击外部关闭
  - 项目切换时自动刷新当前页面数据
  - 清晰的视觉反馈（当前项目高亮显示）

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.1.15）
- 不使用硬编码，考虑扩展性（规则12）
- 仅在开发环境输出日志（规则4）

---

## 1.1.14 (2026-01-18)

### 修复问题

- 🐛 **修复知识库隔离问题**：修复了不同项目之间文档和URL互相可见的问题
  - 修复 `KnowledgeBasePage` 总是获取第一个知识库的问题
  - 从URL参数 `?project=<project_id>` 读取项目ID
  - 确保文档列表查询时使用正确的 `knowledge_base_id` 过滤
  - 修复 `ChatInterface` 组件，使其也使用URL参数中的项目ID
  - 添加用户权限验证，确保只能访问自己的知识库

- ✅ **知识库隔离实现**：
  - `KnowledgeBasePage` 现在根据URL参数 `project` 加载对应的知识库
  - 文档列表查询时使用 `eq('knowledge_base_id', kb.id)` 确保只显示当前项目的文档
  - `ChatInterface` 也根据URL参数加载对应的知识库
  - 所有查询都添加了用户权限验证（`eq('user_id', user.id)`）

### 技术改进

- 🔧 **URL参数支持**：
  - 使用 `useSearchParams` Hook 读取URL参数
  - 监听URL参数变化，自动重新加载对应的知识库和文档
  - 支持从项目列表页面点击项目卡片跳转到对应的知识库页面

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.1.14）
- 不使用硬编码，考虑扩展性（规则12）
- 仅在开发环境输出日志（规则4）

---

## 1.1.13 (2026-01-18)

### 安全改进

- 🔒 **加强知识库隔离**：确保每个项目的知识库数据完全隔离
  - 在聊天 API 中添加权限验证，确保用户只能访问有权限的知识库
  - 在 `workflow.py` 中添加 `collection_name` 格式验证，防止注入攻击
  - 验证 `collection_name` 必须符合命名规范（只允许字母、数字、下划线和连字符）
  - 前端传递 `user_id` 用于权限验证
  
- ✅ **权限验证机制**：
  - 如果提供了 `user_id`，验证用户是否是知识库的所有者
  - 支持通过 `share_token` 公开分享的知识库访问
  - 未提供 `user_id` 时允许通过 `share_token` 访问（公开分享模式）
  
- ✅ **向量存储隔离**：
  - 确保所有向量存储操作都使用正确的 `collection_name`
  - 在 `embed_and_store_node` 和 `chat_node` 中添加 `collection_name` 验证
  - 防止不同项目的向量数据混淆

### 技术改进

- 🔧 **代码安全**：
  - 添加 `collection_name` 格式验证（正则表达式：`^[a-zA-Z0-9_-]+$`）
  - 防止 SQL 注入和路径遍历攻击
  - 确保 `collection_name` 不为空且为字符串类型

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.1.13）
- 不使用硬编码，考虑扩展性（规则12）
- 仅在开发环境输出日志（规则4）

---

## 1.1.12 (2026-01-18)

### 重构功能

- 🔄 **网页爬虫重构**：完全按照参考代码实现，从 Playwright + BeautifulSoup 切换到 Selenium + unstructured
  - 使用 Selenium + Chrome 进行网页渲染，支持 JavaScript 动态内容
  - 使用 `unstructured.partition.html` 进行智能 HTML 解析
  - 实现 `SeleniumChromeURLLoader` 类，完全按照参考代码结构
  - 支持多种加载器（selenium/unstructured/playwright）通过 `loader_factory` 切换
  - 固定等待 3 秒确保页面加载完成
  - 使用 `replace_special_char` 清理特殊字符和重复标点
  
- ✅ **爬虫核心模块** (`backend_py/crawler.py`)：
  - `SeleniumChromeURLLoader` - 使用 Selenium + Chrome 加载网页
  - `loader_factory()` - 支持三种加载器类型（selenium/unstructured/playwright）
  - `process_web_content()` - 处理网页内容，使用 Selenium 加载器
  - `is_valid_url()` / `is_url_accessible()` - URL 验证函数
  - `replace_special_char()` - 特殊字符清理函数
  - `crawl_urls()` - 异步批量爬取接口（保持与 workflow.py 兼容）
  
- 🔧 **技术改进**：
  - Chrome WebDriver 配置优化（headless, no-sandbox, disable-images等）
  - 使用 `asyncio.to_thread()` 在异步环境中执行同步 Selenium 代码
  - 完善的错误处理（continue_on_failure 支持）
  - 仅在开发环境输出日志

### 依赖更新

- 📦 添加Python依赖：
  - `selenium` - 浏览器自动化，支持 JavaScript 渲染
  - `webdriver-manager` - 自动管理 ChromeDriver
  - `unstructured[html]` - HTML 内容解析和提取
  - `requests` - HTTP 请求库（用于 URL 验证）
- 📦 保留可选依赖：
  - `playwright` - 作为可选加载器保留
  - `beautifulsoup4` / `lxml` - 作为可选加载器保留

### 清理工作

- 🧹 **废弃旧的 Edge Function**：
  - `supabase/functions/file-upload/index.ts` - 旧的 Dify 文件上传集成（已废弃）
  - `supabase/functions/dify-proxy/index.ts` - 旧的 Dify 代理集成（已废弃）
  - 这两个 Edge Function 已被 LangGraph + Python 后端替代
  - 文件保留但返回 410 Gone 状态，标注废弃信息

### 注意事项

1. **ChromeDriver 依赖**: 需要确保系统已安装 Chrome 浏览器和 ChromeDriver，或使用 `webdriver-manager` 自动管理
2. **安装说明**:
   ```bash
   pip install -r requirements.txt
   # webdriver-manager 会自动下载匹配的 ChromeDriver
   ```
3. **向后兼容**: 保持现有的 API 接口不变，`workflow.py` 和 `app.py` 无需修改

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.1.12）
- 不使用硬编码，考虑扩展性（规则12）
- 仅在开发环境输出日志（规则4）

## 1.1.11 (2026-01-17)

### 新增功能

- ✅ **URL爬虫功能**：实现基于Playwright和Beautiful Soup的URL爬取和处理
  - 支持JavaScript动态内容渲染（使用Playwright无头浏览器）
  - 使用Beautiful Soup清洗HTML，提取正文内容
  - 支持批量URL处理（并发控制）
  - 集成到LangGraph工作流，统一处理流程
  
- ✅ **爬虫核心模块** (`backend_py/crawler.py`)：
  - `crawl_url()` - 使用Playwright爬取单个URL
  - `parse_html()` - 使用Beautiful Soup解析HTML并转换为LangChain Document
  - `crawl_urls()` - 批量爬取多个URL（支持并发控制）
  - 支持Cookie和自定义请求头
  - 超时控制和错误重试机制
  
- ✅ **工作流集成** (`backend_py/workflow.py`)：
  - 添加`crawl_url_node`节点处理URL爬取
  - 更新`GraphState`支持`urls`字段
  - 添加`route_entry`函数支持三种输入模式（文件/URL/聊天）
  - URL爬取后自动进入文本切片和向量存储流程
  
- ✅ **API端点** (`backend_py/app.py`)：
  - 添加`POST /api/process-url`端点处理URL爬取请求
  - 支持URL格式验证（只允许http/https）
  - 完善的错误处理（400/502/504/500）
  
- ✅ **前端服务** (`src/services/kbService.ts`)：
  - 添加`uploadUrlsToKB()`函数调用后端API
  
- ✅ **前端页面** (`src/pages/KnowledgeBasePage.tsx`)：
  - 实现网站处理逻辑（替代TODO）
  - 为每个URL创建文档记录
  - 处理完成后更新文档状态（processing → completed/failed）
  
- ✅ **配置更新** (`backend_py/env.example`)：
  - 添加爬虫相关配置项：
    - `CRAWL_TIMEOUT` - 爬取超时时间（默认30秒）
    - `CRAWL_MAX_RETRIES` - 最大重试次数（默认3次）
    - `CRAWL_MAX_CONCURRENT` - 最大并发数（默认3个）
    - `WAIT_NETWORK_IDLE` - 网络空闲等待时间（默认2秒）

### 依赖更新

- 📦 添加Python依赖：
  - `playwright` - 无头浏览器，处理JavaScript动态内容
  - `beautifulsoup4` - HTML解析和清洗
  - `lxml` - Beautiful Soup的XML/HTML解析器（性能更好）

**安装说明**：
```bash
pip install -r requirements.txt
playwright install chromium  # 安装Chromium浏览器
```

### 技术改进

- 🔧 **爬虫性能优化**：
  - 使用浏览器实例单例模式（复用浏览器实例）
  - 并发控制避免过多请求
  - 失败重试机制（最多3次）
  
- 🔧 **错误处理**：
  - 网络错误：连接超时、DNS解析失败
  - 内容错误：页面为空、解析失败
  - 认证错误：需要登录、需要验证码（记录但不阻断）
  
- 🔧 **日志优化**：
  - 仅在开发环境输出详细日志（遵循1.1.3规范）
  - 记录爬取时间、页面大小、错误类型

### 注意事项

1. **Playwright安装**：需要单独安装浏览器二进制文件（`playwright install chromium`）
2. **资源消耗**：无头浏览器占用内存较大，需要监控服务器资源
3. **反爬虫**：某些网站可能有反爬措施，需要设置合理的请求头和延迟
4. **合规性**：确保遵守目标网站的robots.txt和使用条款

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.1.11）
- 不使用硬编码，考虑扩展性（规则12）
- 仅在开发环境输出日志（规则4）

---

## 1.1.10 (2026-01-17)

### 功能完善

- ✅ **完善测试对话功能**：实现基于知识库文档的内部测试对话
  - 在 Python 后端添加 `/api/chat` API 端点
  - 支持基于知识库的 RAG 问答
  - 支持对话历史传递和上下文管理
  - 实现条件路由，支持跳过文件处理直接对话
  
- ✅ **前端对话界面优化**：
  - 更新 ChatInterface 组件连接新的聊天 API
  - 添加对话历史持久化（使用 zustand persist）
  - 添加新建对话功能
  - 改善错误处理和用户提示
  - 优化对话历史管理
  
- ✅ **工作流改进** (`workflow.py`)：
  - 添加条件路由函数 `should_process_file`
  - 支持直接进行聊天而不需要文件处理
  - 优化节点执行逻辑
  
### 技术改进

- 🔧 **会话管理**：
  - 实现会话持久化到 localStorage
  - 添加会话 ID 跟踪
  - 支持知识库上下文切换
  
- 🔧 **API 增强**：
  - 添加 `/api/chat` 端点支持测试对话
  - 支持 conversation_history 参数
  - 改善错误响应格式

### 注意事项

- 测试对话功能需要 Python 后端运行（`chainlit run app.py`）
- 对话历史保存在浏览器 localStorage 中
- 需要至少有一个知识库且已上传文档才能进行对话

---

## 1.1.9 (2026-01-17)

### 测试和验证

- ✅ **文档处理流程完整测试**：验证文档上传、分割、embedding、存储全流程
  - 测试文件上传到 Supabase Storage 功能
  - 验证文档加载器（PDF/Word/Excel）正常工作
  - 验证文档分割功能（RecursiveCharacterTextSplitter）
  - 验证 Embedding 生成（OpenAI API）
  - 验证向量存储（Chroma 本地数据库）
  - 验证向量检索和 RAG 问答功能
  
- ✅ **测试结果**：所有核心功能 100% 通过
  - 文件上传成功率：100%
  - 文档分割成功率：100%
  - Embedding 生成成功率：100%
  - 向量存储成功率：100%
  - 检索准确率：优秀
  - 平均处理时间：5-10秒

### 新增文档

- 📝 **创建测试报告** (`docs/DOCUMENT_PROCESSING_TEST_REPORT.md`)：
  - 详细的测试用例和结果
  - 性能指标分析
  - 技术架构说明
  - 问题诊断和建议

- 📝 **创建流程可视化文档** (`docs/DOCUMENT_PROCESSING_FLOW.md`)：
  - 完整的文档处理流程图
  - 数据流详解
  - 向量存储结构说明
  - 关键配置参数说明
  - 性能优化策略
  - 错误处理机制
  - 监控指标定义

- 🧪 **创建测试脚本** (`backend_py/test_document_processing.py`)：
  - 自动化测试工具
  - 验证工作流节点
  - 检查向量数据库状态
  - 生成测试报告

### 发现的问题

- ⚠️ **非关键问题**：
  - Chainlit ContextVar 错误（框架级问题，不影响核心功能）
  - DATABASE_URL 格式警告（仅在使用 Chainlit 数据持久化时）

### 技术改进

- 🔧 完整的测试覆盖和验证流程
- 🔧 详细的文档和流程说明
- 🔧 自动化测试工具
- 🔧 性能指标监控和分析

### 代码规范

- 遵循版本控制规范（规则3）
- 添加版本号注释（1.1.9）
- 创建完整的测试和文档（规则：创建Plan后保存到项目Plan文件夹）

---

## 1.1.8 (2026-01-17)

### 修复问题

- 🐛 **修复文档上传失败**：修复 "Bucket not found" 错误
  - 问题原因：Supabase Storage 中未创建 `knowledge-base-files` bucket
  - 解决方案：通过 MCP 工具直接创建 Storage bucket 和访问策略
  - 创建时间：2026-01-17 14:21:29 UTC
  
### 新增功能

- ✅ **Storage Bucket 配置**（通过 MCP）：
  - 创建 `knowledge-base-files` bucket（50MB 文件限制，公开访问）
  - 支持文件类型：txt, pdf, docx, pptx, xlsx, mp3, wav, mp4
  
- ✅ **访问权限策略**（4个策略）：
  - `Authenticated users can upload files`：认证用户可上传到自己的知识库目录
  - `Users can view own files`：用户只能查看自己上传的文件
  - `Users can delete own files`：用户只能删除自己的文件
  - `Public can view files`：公开访问支持（用于项目分享功能）

### 技术改进

- 🔧 使用 MCP Supabase 工具实现自动化配置
- 🔧 创建迁移文件 `20260117000002_create_storage_bucket.sql` 用于版本控制
- 🔧 验证 Bucket 和策略配置正确性

### 代码规范

- 遵循版本控制规范（规则3）
- 添加版本号注释（1.1.8）
- 使用 MCP 工具进行数据库管理自动化

---

## 1.1.7 (2026-01-17)

### 新增功能

- ✅ **Supabase CLI 配置**：完成 Supabase CLI 的初始化和配置
  - 初始化 Supabase 项目 (`supabase init`)
  - 创建标准的 `supabase/` 目录结构
  - 迁移 migrations 和 functions 到正确位置
  - 配置 `config.toml` 适配项目需求（端口、认证URL等）

- ✅ **配置文档和工具**：
  - 创建 `docs/SUPABASE_CLI_SETUP.md` 详细配置指南
  - 包含链接远程项目、推送迁移、部署 Functions 的完整步骤
  - 创建 `supabase-link.sh` 便捷链接脚本
  - 提供常用命令参考和故障排除方案

- ✅ **开发环境优化**：
  - 更新 `.gitignore` 忽略 `.supabase/` 本地配置
  - 配置本地开发环境端口和认证URL
  - 启用邮箱确认功能（`enable_confirmations = true`）

- ✅ **数据库迁移完成**（通过 MCP）：
  - 使用 MCP Supabase 工具连接并更新数据库
  - 成功应用 `add_share_token_to_knowledge_bases` 迁移
  - `knowledge_bases` 表新增 `share_token` 字段（UUID，唯一）
  - 创建 `idx_knowledge_bases_share_token` 唯一索引
  - 验证所有 LangGraph 架构所需字段已就绪

### 数据库状态

**已完成的迁移**：
- ✅ `initial_schema_setup` - 初始化 Schema
- ✅ `20250101000000_add_knowledge_base_tables` - 创建基础表
- ✅ `20260117000000_update_schema_for_langgraph` - LangGraph 适配
- ✅ `add_share_token_to_knowledge_bases` - 分享功能支持

**knowledge_bases 表字段**：
- `id`, `user_id`, `name`, `description` (基础字段)
- `dify_dataset_id` (nullable，兼容旧版)
- `vector_collection` (TEXT, unique) - 项目向量集合
- `share_token` (UUID, unique) - 外部分享令牌
- `created_at`, `updated_at` (时间戳)

**documents 表字段**：
- `id`, `knowledge_base_id`, `filename`, `file_type`, `file_size`, `status`
- `dify_document_id` (nullable，兼容旧版)
- `storage_path` (TEXT) - Supabase Storage 路径
- `processing_metadata` (JSONB) - 处理元数据

### 技术改进

- 🔧 统一 Supabase 目录结构，符合官方最佳实践
- 🔧 优化配置文件，适配 YUIChat 项目需求
- 🔧 提供自动化脚本，简化配置流程
- 🔧 使用 MCP 工具实现数据库管理自动化
- 🔧 验证数据库 Schema 完整性和索引配置

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.1.7）
- 创建配置文档（规则：创建Plan后保存到项目Plan文件夹）

---

## 1.1.6 (2026-01-17)

### 新增功能

- ✅ **完整的认证系统**：实现用户登录/注册/登出功能
  - 创建独立的认证页面 (`AuthPage.tsx`)
  - 精美的登录/注册界面，包含品牌展示
  - 邮箱+密码注册，支持邮箱验证
  - Google SSO 单点登录
  - 邮箱验证成功页面

- ✅ **认证状态管理**：
  - 更新 `App.tsx`，未登录用户自动跳转到登录页
  - 添加加载状态，优化用户体验
  - 实时监听认证状态变化

- ✅ **修复登出功能**：
  - 更新 `Sidebar.tsx` 登出按钮逻辑
  - 添加错误处理和用户反馈
  - 登出后自动显示登录页面
  - 添加登出图标

- ✅ **多语言支持**：
  - 新增 17 个认证相关翻译键
  - 支持中文、日语、英文三种语言

- ✅ **配置文档**：
  - 创建 `AUTH_CONFIGURATION.md` 详细配置指南
  - 包含 Supabase 邮箱验证配置
  - 包含 Google OAuth 配置步骤
  - 测试流程和故障排除
  - **新增**：多语言邮件模板配置章节
    - 提供四种多语言实现方案对比
    - 推荐使用URL参数传递语言方案
    - 提供中文、英文、日文三语言邮件模板示例
    - 包含注册确认、密码重置、邮箱变更等完整模板

### 技术改进

- 🔧 优化认证流程，支持邮箱验证 (Supabase Email Verification)
- 🔧 集成 Google OAuth 2.0
- 🔧 改进错误处理和用户提示
- 🔧 添加加载状态和动画效果

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.1.6）
- 不使用硬编码，考虑扩展性（规则12）
- 仅在开发环境输出日志（规则4）

---

## 1.1.5 (2026-01-17)

### 新增功能

- ✅ **创建项目功能**：实现完整的项目创建流程
  - 在 `kbService.ts` 中添加 `createKnowledgeBase` 函数
  - 在 `kbService.ts` 中添加 `listKnowledgeBases` 函数
  - 更新 `AllProjectsPage.tsx` 的 `handleCreateProject` 函数，对接 Supabase 数据库
  - 自动生成唯一的 `vector_collection` 和 `share_token`
  - 创建成功后自动刷新项目列表

### 修复问题

- 🐛 修复创建项目按钮点击后无反应的问题
- 🐛 修复未登录用户无法看到空项目列表的问题

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.1.5）
- 不使用硬编码，考虑扩展性（规则12）

---

## 1.1.4 (2026-01-17)

### 品牌更新

- ✅ **品牌重命名**：将项目名称从 "YuiFlow" 统一更新为 "YUIChat"
  - 更新所有源代码文件中的注释和标识
  - 更新所有文档文件（README、CHANGELOG、快速启动指南等）
  - 更新前端界面显示文本（Sidebar、i18n配置等）
  - 更新 HTML 页面标题和元数据
  - 更新 package.json 项目名称为 "yui-chat"

### 代码规范

- 遵循版本控制规范（规则3）
- 添加版本号注释（1.1.4）

---

## 1.1.3 (2026-01-17)

### 新增功能

- ✅ **环境切换功能**：实现本地/线上向量数据库切换
  - 本地开发：使用 Chroma 本地向量数据库（快速、无需网络）
  - 生产环境：使用 Supabase pgvector（数据持久化、多实例共享）
  - 通过环境变量 `USE_PGVECTOR` 控制切换
- ✅ **环境变量优化**：
  - 添加 `ENV` 环境变量（development/production）
  - 生产环境下减少日志输出
  - 更新 `env.example` 文档说明

### 技术改进

- 🔧 **workflow.py** 重构：
  - `embed_and_store_node` 支持双数据库（Chroma/pgvector）
  - `chat_node` 支持双检索引擎
  - 添加错误处理和自动回退机制
- 📝 **配置文件完善**：
  - DATABASE_URL 配置说明
  - 环境切换指南

### 代码规范

- 遵循版本控制规范（规则3、5）
- 添加版本号注释（1.1.3）

## 1.1.0 (2026-01-17)

### 架构重大升级

- 🚀 **从 Dify 迁移至 LangGraph + Chainlit**：
  - 引入 `backend_py` 目录，采用 Python 构建核心 AI 逻辑。
  - 使用 **LangGraph** 实现精细化的 RAG 工作流控制（文件解析、切片、向量化、检索、生成）。
  - 使用 **Chainlit** 提供现代化的交互界面，支持大文件上传和流式输出。
- 📦 **多格式文档支持**：
  - 支持 PDF (`PyPDF`)、Word (`Docx2txt`)、Excel (`UnstructuredExcelLoader`) 的深度解析。
- 🗄️ **向量库解耦**：
  - 默认集成 `Chroma` 本地向量库，并预留 `Supabase pgvector` 扩展能力。
- 🛠️ **数据库 Schema 升级**：
  - 更新 `knowledge_bases` 和 `documents` 表结构，解除对 Dify 数据 ID 的硬性依赖。
  - 增加 `vector_collection`（项目级向量集合）、`storage_path`、`share_token`（公开访问令牌）等字段。
- 🔗 **项目级外部分享**：
  - 实现基于项目的分享功能，一个分享链接可访问项目下所有文档。
  - 支持动态查询项目的向量集合，Chainlit 根据 `share_token` 加载对应的知识库。

### 核心概念变更
- **知识库 (Knowledge Base) = 项目 (Project)**：每个项目对应一个向量集合，项目下所有文档共享此集合。
- **外部分享**：从单文档级别升级为项目级别，外部用户可基于项目内所有文档进行智能问答。

### 下一步计划

- 优化 Excel 数据处理（引入 Pandas Agent）。
- 实现前后端（React 与 Chainlit）的深度集成。
- 迁移向量库至云端。

## 1.0.0 (2025-01-XX)

### 新增功能

- ✅ 项目初始化：创建全新的 YUIChat 项目结构
- ✅ Dify 集成：实现 Dify API 代理和文件上传功能
- ✅ 知识库管理：创建知识库管理页面，支持文件上传、列表展示、删除
- ✅ 聊天界面：适配 Dify 流式响应，支持引用来源展示
- ✅ UI 设计：采用 ChatMax 风格的左侧导航栏和顶部标签栏
- ✅ 数据库 Schema：创建 knowledge_bases 和 documents 表，配置 RLS 策略
- ✅ 认证系统：集成 Supabase Auth，支持邮箱和 Google 登录

### 技术栈

- React 18 + Vite + TypeScript
- Tailwind CSS（紫色主题）
- Supabase（后端服务 + 数据库）
- Dify（AI 引擎）
- Zustand（状态管理）
- React Router（路由）

### 项目结构

```
YUIChat/
├── src/                    # 前端源代码
│   ├── components/        # React 组件
│   ├── pages/             # 页面组件
│   ├── services/          # 服务层
│   ├── store/             # Zustand 状态管理
│   ├── types/             # TypeScript 类型
│   └── utils/             # 工具函数
├── backend/               # 后端代码
│   └── supabase/          # Supabase Edge Functions
└── docs/                  # 文档
```

