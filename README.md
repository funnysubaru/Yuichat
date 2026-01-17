# YUIChat - 企业知识库服务

基于 **LangGraph** + **Chainlit** 的现代化企业级 RAG 知识库管理平台。

## 技术栈

- **前端**: React 18 + Vite + TypeScript + Tailwind CSS
- **后端 (Python)**: LangGraph + Chainlit + LangChain (核心逻辑)
- **后端 (TypeScript)**: Supabase Edge Functions (认证与元数据)
- **数据库**: Supabase PostgreSQL + pgvector
- **向量库**: Chroma (本地) / Supabase pgvector (生产)
- **AI 模型**: OpenAI GPT-4o / Embedding

## 架构优势

1. **灵活的工作流**: 使用 LangGraph 编排 RAG 流程，支持复杂的条件判断和多步处理。
2. **多格式支持**: 深度支持 PDF, Word, Excel 文档解析。
3. **强大的交互**: Chainlit 提供原生大文件上传、流式输出和丰富的交互组件。
4. **解耦设计**: 解除对 Dify 的硬依赖，开发者可完全控制 AI 逻辑。
5. **项目级分享**: 一个项目包含多个文档，生成统一的公开访问链接，用户可基于项目内所有文档进行问答。

## 核心概念

- **项目 (Project) = 知识库 (Knowledge Base)**：每个项目拥有独立的向量集合
- **文档 (Document)**：项目下的文件，所有文档共享项目的向量空间
- **外部分享**：基于项目级别，用户可访问项目内所有文档的知识

更多详情请查看 [项目级分享说明](docs/PROJECT_LEVEL_SHARING.md)

## 快速开始

### 自动化配置（推荐）

```bash
# 1. 运行配置脚本
./setup.sh

# 2. 编辑环境变量文件
# - .env.local (前端)
# - backend_py/.env (Python 后端)

# 3. 安装 Python 依赖
cd backend_py
source venv/bin/activate
pip install -r requirements.txt

# 4. 启动服务（需要两个终端）
# 终端 1: Python 后端
cd backend_py && chainlit run app.py

# 终端 2: 前端管理端
npm run dev
```

详细配置说明请查看 [快速启动指南](QUICK_START_GUIDE.md)

## 项目结构

```
YUIChat/
├── src/                    # React 前端代码
├── backend/               # Supabase 后端 (Migrations, Edge Functions)
├── backend_py/            # Python 后端 (LangGraph 工作流, Chainlit UI)
│   ├── app.py             # Chainlit 入口
│   ├── workflow.py        # LangGraph 流程定义
│   └── requirements.txt   # Python 依赖
└── docs/                  # 项目文档
```

## 开发规范

- 严格遵循 `/Users/haya_ceo/Projects/ai-food advise/docs/SAFE_EDIT_GUIDE.md`
- 所有修改都要添加版本注释
- 使用语义化版本控制 (当前版本: 1.1.0)

## License

MIT
