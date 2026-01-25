---
name: ChatMax推荐问题实现
overview: 实现类似ChatMax的"推荐问题"功能，在AI回答完问题后自动推送与用户问题最相关的后续问题建议。当前项目已有基础框架，需要确保问题预生成机制正确运行并完善触发逻辑。
todos:
  - id: check-migration
    content: 确认 recommended_questions 数据库表已创建
    status: pending
  - id: add-trigger
    content: 在文档上传完成后添加问题预生成任务触发逻辑
    status: pending
    dependencies:
      - check-migration
  - id: add-manual-api
    content: 添加手动触发问题生成的 API 端点（供测试和管理使用）
    status: pending
    dependencies:
      - check-migration
  - id: verify-retrieval
    content: 验证问题检索逻辑是否正常工作
    status: pending
    dependencies:
      - add-trigger
  - id: test-e2e
    content: 端到端测试：上传文档 -> 生成问题 -> 对话返回 follow-up
    status: pending
    dependencies:
      - verify-retrieval
---

# ChatMax 推荐问题（Follow-up Questions）实现方案

## 当前实现状态

您的项目已经有了推荐问题功能的完整框架（1.3.0版本）：

### 后端模块

| 文件 | 功能 |
|------|------|
| [`backend_py/question_generator.py`](backend_py/question_generator.py) | 基于知识库文档使用 LLM 预生成多语言问题 |
| [`backend_py/question_retriever.py`](backend_py/question_retriever.py) | 基于向量相似度检索与用户问题相关的 follow-up |
| [`backend_py/app.py`](backend_py/app.py) | API 端点 `/api/chat` 和 `/api/chat/stream` 调用推荐问题 |

### 前端实现

[`src/components/ChatInterface.tsx`](src/components/ChatInterface.tsx) 第 98-100 行已实现 `followUpQuestions` 状态和显示逻辑。

### 数据库表

[`supabase/migrations/20260123000000_add_recommended_questions.sql`](supabase/migrations/20260123000000_add_recommended_questions.sql) 定义了 `recommended_questions` 表。

---

## 架构流程图

```mermaid
flowchart TD
    subgraph DocumentUpload[文档上传阶段]
        A[用户上传文档] --> B[文档向量化存储]
        B --> C[触发问题预生成任务]
        C --> D[LLM 生成多语言问题]
        D --> E[存储到 recommended_questions 表]
        D --> F[向量化存储到 collection_questions]
    end

    subgraph ChatPhase[对话阶段]
        G[用户发送问题] --> H[RAG 检索回答]
        H --> I[同时检索相似问题]
        I --> J[筛选 follow-up 问题]
        J --> K[返回 answer + follow_up]
    end

    subgraph Frontend[前端显示]
        K --> L[显示 AI 回复]
        L --> M[显示推荐问题按钮]
        M --> N[用户点击继续提问]
    end
```

---

## 当前问题诊断

根据 CHANGELOG 记录，`recommended_questions` 表可能为空。需要检查：

1. 问题预生成任务是否在文档上传时被触发
2. 向量集合 `{collection}_questions` 是否有数据
3. 检索逻辑是否正常工作

---

## 实现步骤

### 步骤 1：确保数据库表已迁移

运行 Supabase 迁移，确保 `recommended_questions` 表存在。

### 步骤 2：在文档上传后触发问题生成

需要在文档上传 API（如 `/api/upload` 或文档处理完成后）调用问题生成任务：

```python
from question_generator import async_generate_questions

# 在文档处理完成后触发
asyncio.create_task(async_generate_questions(kb_id, collection_name, doc_id))
```

### 步骤 3：验证问题检索逻辑

确保 `question_retriever.py` 中的向量检索正确配置：
- 集合名称格式：`{原collection}_questions`
- 相似度阈值：`QUESTION_SIMILARITY_THRESHOLD=0.7`

### 步骤 4：API 端点已支持

[`backend_py/app.py`](backend_py/app.py) 第 768-788 行已在 `/api/chat` 中调用 `get_recommended_questions` 并返回 `follow_up` 字段。

### 步骤 5：前端显示已实现

[`src/components/ChatInterface.tsx`](src/components/ChatInterface.tsx) 第 1458-1484 行已实现推荐问题的显示：

```tsx
{!isTyping && followUpQuestions.length > 0 && messages.length > 0 && (
  <motion.div className="ml-11 space-y-2 mt-4">
    <p className="text-xs text-gray-500">{t('followUpQuestions')}</p>
    {followUpQuestions.slice(0, 3).map((question, index) => (
      <motion.button onClick={() => handleRecommendedQuestionClick(question)}>
        {question}
      </motion.button>
    ))}
  </motion.div>
)}
```

---

## 需要完善的关键点

1. **问题预生成触发**：当前缺少在文档上传后自动触发问题生成的逻辑
2. **异步任务调度**：可使用 Cloud Tasks 或后台线程处理生成任务
3. **手动生成入口**：添加 API 端点供管理员手动触发问题生成
