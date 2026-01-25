---
name: 切换至 LangGraph + Chainlit 架构
overview: 将现有的基于 Dify 的 RAG 架构重构为基于 LangGraph (工作流) 和 Chainlit (交互界面) 的方案，以支持更灵活的文件处理（PDF/Word/Excel）和精细的 RAG 流程控制。
todos:
  - id: init-py-envReference-py-env
    content: 创建 Python 后端目录并初始化环境 (requirements.txt, .env)
    status: completed
  - id: implement-langgraph-logic
    content: 实现 LangGraph 核心工作流逻辑 (文件解析、切片、向量存储、RAG)
    status: completed
  - id: build-chainlit-ui
    content: 构建 Chainlit 聊天界面与文件上传交互
    status: completed
  - id: update-supabase-schema
    content: 更新 Supabase 数据库 Schema 以适配新架构
    status: completed
  - id: update-docs-and-versions
    content: 配置项目版本记录并在 docs 中更新项目状态
    status: completed
---

# 切换至 LangGraph + Chainlit 架构

本计划旨在将项目的 AI 引擎从 Dify 迁移到自定义的 LangGraph 工作流，并集成 Chainlit 作为主要的交互界面。

## 1. 环境准备

- 在根目录下创建 `backend_py` 目录，用于存放 Python 后端代码。
- 初始化 `requirements.txt`，包含以下核心依赖：
- `langgraph`, `chainlit`, `langchain`, `langchain-openai`
- `pypdf`, `docx2txt`, `pandas`, `openpyxl`
- `chromadb` (向量库) 或 `vecs` (Supabase pgvector 客户端)
- 配置 `.env` 文件，包含 OpenAI API Key 和 Supabase 凭证。

## 2. 设计 LangGraph 工作流

- **状态定义**: 定义包含 `file_path`, `docs`, `splits`, `vectorstore`, `messages` 等字段的状态对象。
- **节点实现**:
- `process_file_node`: 利用 `PyPDFLoader`, `Docx2txtLoader`, `UnstructuredExcelLoader` 解析上传的文件。
- `split_text_node`: 使用 `RecursiveCharacterTextSplitter` 进行文本切片。
- `embed_and_store_node`: 调用 OpenAI Embedding 并存入向量库（初始使用 Chroma，后续可扩展至 Supabase）。
- `chat_node`: 实现检索增强生成 (RAG) 逻辑。
- **流程编排**: 连接各节点，处理文件上传后的自动化流程。

## 3. 实现 Chainlit 交互

- 在 `backend_py/app.py` 中编写 Chainlit 代码：
- 使用 `@cl.on_chat_start` 监听对话开始，弹出文件上传窗口。
- 使用 `@cl.on_message` 接收用户问题，触发 LangGraph 工作流，并流式输出 AI 响应。
- 整合 Chainlit 的 `AskFileMessage` 功能以支持 PDF/Word/Excel 上传。

## 4. 数据库与元数据同步 (Supabase)

- 修改 `backend/supabase/migrations`，使表结构不再依赖 Dify (如将 `dify_dataset_id` 改为通用的 `collection_id`)。
- 实现文档状态同步，当 LangGraph 处理完成后更新 Supabase 中的文档状态。

## 5. 前端整合建议

- 方案 : 将 React 应用作为管理后台，Chainlit 作为核心对话服务。

## 关键文件变更

- [`backend_py/requirements.txt`](backend_py/requirements.txt) (新建)
- [`backend_py/workflow.py`](backend_py/workflow.py) (新建 - LangGraph 逻辑)
- [`backend_py/app.py`](backend_py/app.py) (新建 - Chainlit 入口)
- [`backend/supabase/migrations/20260117000000_update_schema_for_langgraph.sql`](backend/supabase/migrations/20260117000000_update_schema_for_langgraph.sql) (新建)