# Chainlit 面向用户聊天界面 kb_id 获取问题修复

## 问题描述

访问 `http://localhost:8000/?kb_id=xxx` 时，Chainlit 聊天界面报错：

```
知识库配置错误：collection_name 无效。请重新访问知识库链接。
```

同时伴随以下错误：
```
ValueError: bad query field: '<PASSWORD>@db.<YOUR_PROJECT_REF>.supabase.co:5432/postgres'
```

## 问题分析

### 问题 1: DATABASE_URL 导致 URL 解析错误

**原因**: Chainlit 会自动检测 `DATABASE_URL` 环境变量并启用数据持久化功能。当数据库密码包含特殊字符（如 `?`, `!`）时，URL 解析会失败。

**错误链路**:
1. Chainlit 读取 `DATABASE_URL` 环境变量
2. 尝试用 `asyncpg` 连接数据库
3. Python 的 `urllib.parse` 将密码中的 `?` 解析为查询参数分隔符
4. 导致 `ValueError: bad query field` 错误

### 问题 2: on_chat_start 中无法获取 kb_id

**原因**: Chainlit 2.3.0 与 Python 3.9 存在 `ContextVar` 兼容性问题。

**错误表现**:
```
LookupError: <ContextVar name='local_steps' at 0x...>
```

这导致 `@cl.on_chat_start` 装饰的函数在执行用户代码前就抛出异常，无法正确设置 `collection_name`。

## 解决方案

### 修复 1: 重命名 DATABASE_URL

将 `DATABASE_URL` 重命名为 `PGVECTOR_DATABASE_URL`，避免 Chainlit 自动检测：

**`.env` 文件修改**:
```env
# 旧的（会被 Chainlit 检测）
# DATABASE_URL=postgresql://postgres:password@...

# 新的（Chainlit 不会检测）
PGVECTOR_DATABASE_URL=postgresql://postgres:password@...
```

**`workflow.py` 修改**:
```python
# 1.1.17: 重命名为 PGVECTOR_DATABASE_URL 避免与 Chainlit 数据持久化冲突
DATABASE_URL = os.getenv("PGVECTOR_DATABASE_URL") or os.getenv("DATABASE_URL")
```

### 修复 2: 在 on_message 中动态获取 kb_id

由于 `on_chat_start` 有 ContextVar 问题，改为在 `on_message` 中动态获取和设置 `collection_name`：

**`app.py` 关键代码**:
```python
@cl.on_message
async def main(message: cl.Message):
    from urllib.parse import urlparse, parse_qs

    messages = cl.user_session.get("messages", [])
    collection_name = cl.user_session.get("collection_name")

    # 1.1.17: 如果 collection_name 无效，尝试从 http_referer 动态获取
    if not collection_name or not isinstance(collection_name, str) or not collection_name.strip():
        http_referer = cl.user_session.get("http_referer")

        kb_id = None
        if http_referer:
            try:
                parsed_url = urlparse(http_referer)
                query_params = parse_qs(parsed_url.query)
                kb_id = query_params.get("kb_id", [None])[0]
            except Exception as e:
                pass

        # 如果获取到 kb_id，从 Supabase 获取 collection_name
        if kb_id and supabase:
            try:
                result = supabase.table("knowledge_bases")\
                    .select("vector_collection")\
                    .eq("share_token", kb_id)\
                    .single()\
                    .execute()

                if result.data and result.data.get("vector_collection"):
                    collection_name = result.data.get("vector_collection").strip()
                    cl.user_session.set("collection_name", collection_name)
                    cl.user_session.set("messages", [])
            except Exception as e:
                pass

    # 继续处理消息...
```

## 修改的文件

| 文件 | 修改内容 |
|------|---------|
| `backend_py/.env` | 将 `DATABASE_URL` 改为 `PGVECTOR_DATABASE_URL`（或注释掉） |
| `backend_py/env.example` | 更新文档说明 |
| `backend_py/workflow.py` | 更新环境变量读取逻辑 |
| `backend_py/app.py` | 在 `on_message` 中添加动态获取 `kb_id` 的逻辑 |

## 技术细节

### http_referer 的来源

Chainlit 在 WebSocket 连接时会从 HTTP 请求头中获取 `Referer`，并存储在 `user_session` 中：

```python
# chainlit/socket.py
http_referer = environ.get("HTTP_REFERER")

# chainlit/session.py
self.http_referer = http_referer

# chainlit/user_session.py
user_session["http_referer"] = context.session.http_referer
```

当用户直接访问 `http://localhost:8000/?kb_id=xxx` 时，浏览器会将完整 URL 作为 `Referer` 发送给 WebSocket 连接。

### 为什么 on_message 能工作而 on_chat_start 不能

`on_chat_start` 在 WebSocket 连接建立后立即被调用，此时 Chainlit 的内部 `ContextVar` 可能还未正确初始化（Python 3.9 兼容性问题）。

`on_message` 在用户发送消息后被调用，此时上下文已完全建立，可以正常访问 `user_session`。

## 版本信息

- Chainlit: 2.3.0
- Python: 3.9.16
- 修复版本: 1.1.17

## 测试验证

```bash
# 启动服务
cd backend_py && chainlit run app.py --port 8000

# 访问测试
# 浏览器打开: http://localhost:8000/?kb_id=YOUR_SHARE_TOKEN
# 发送消息，应该能正常获取知识库回答
```

## 注意事项

1. **密码特殊字符编码**: 如果使用 pgvector，数据库密码中的特殊字符需要 URL 编码：
   - `?` → `%3F`
   - `!` → `%21`
   - `@` → `%40`

2. **开发环境**: 本地开发建议使用 Chroma (`USE_PGVECTOR=false`)，避免数据库连接问题。

3. **Python 版本**: 如果可能，建议升级到 Python 3.10+ 以获得更好的 Chainlit 兼容性。
