# GCP Cloud Tasks 配置指南

## 概述

1.3.1 版本新增了 Cloud Tasks 支持，用于异步执行问题生成任务。这解决了在 Cloud Run 中使用 `asyncio.create_task()` 不可靠的问题。

## 架构

```
文档上传 → Cloud Run (app.py)
              ↓
        创建 Cloud Task
              ↓
        Cloud Tasks 队列
              ↓ (异步调用，延迟5秒)
        Cloud Run /api/generate-questions
              ↓
        生成问题并存储到数据库
```

## 配置步骤

### 1. 启用 Cloud Tasks API

```bash
gcloud services enable cloudtasks.googleapis.com
```

### 2. 创建 Cloud Tasks 队列

```bash
# 在 asia-northeast1 区域创建队列（与 Cloud Run 同区域）
gcloud tasks queues create yuichat-tasks \
    --location=asia-northeast1 \
    --max-dispatches-per-second=10 \
    --max-concurrent-dispatches=5 \
    --max-attempts=3 \
    --min-backoff=10s \
    --max-backoff=300s
```

### 3. 配置 IAM 权限

Cloud Run 服务账号需要以下权限：
- `roles/cloudtasks.enqueuer` - 创建任务
- `roles/run.invoker` - 调用 Cloud Run 服务

```bash
# 获取项目 ID
PROJECT_ID=$(gcloud config get-value project)

# 获取 Cloud Run 服务账号
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

# 授予 Cloud Tasks 权限
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/cloudtasks.enqueuer"

# 允许 Cloud Tasks 调用 Cloud Run
gcloud run services add-iam-policy-binding yuichat-backend \
    --region=asia-northeast1 \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/run.invoker"
```

### 4. 设置环境变量

在 Cloud Run 服务中添加以下环境变量：

| 环境变量 | 描述 | 示例值 |
|---------|------|--------|
| `GCP_PROJECT_ID` | GCP 项目 ID | `my-project-123` |
| `GCP_LOCATION` | Cloud Tasks 队列区域 | `asia-northeast1` |
| `GCP_TASK_QUEUE` | 队列名称 | `yuichat-tasks` |
| `CLOUD_RUN_SERVICE_URL` | Cloud Run 服务 URL | `https://yuichat-backend-xxx.run.app` |

可以通过 Cloud Run 控制台或 CLI 设置：

```bash
gcloud run services update yuichat-backend \
    --region=asia-northeast1 \
    --set-env-vars="GCP_PROJECT_ID=your-project-id" \
    --set-env-vars="GCP_LOCATION=asia-northeast1" \
    --set-env-vars="GCP_TASK_QUEUE=yuichat-tasks" \
    --set-env-vars="CLOUD_RUN_SERVICE_URL=https://yuichat-backend-xxx.run.app"
```

## 本地开发

在本地开发时，如果未配置 Cloud Tasks 环境变量，系统会自动回退到同步执行问题生成。

可以在 `.env.local` 中添加以下配置来测试 Cloud Tasks（需要本地 GCP 认证）：

```bash
# .env.local
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=asia-northeast1
GCP_TASK_QUEUE=yuichat-tasks
CLOUD_RUN_SERVICE_URL=https://yuichat-backend-xxx.run.app
```

但通常本地开发不需要配置 Cloud Tasks，同步执行即可。

## 监控和调试

### 查看队列状态

```bash
gcloud tasks queues describe yuichat-tasks --location=asia-northeast1
```

### 查看任务列表

```bash
gcloud tasks list --queue=yuichat-tasks --location=asia-northeast1
```

### 查看 Cloud Run 日志

```bash
gcloud run logs read yuichat-backend --region=asia-northeast1 --limit=50
```

### 常见问题

#### 1. 任务创建失败

检查：
- GCP_PROJECT_ID 是否正确
- Cloud Tasks API 是否已启用
- 服务账号是否有 `roles/cloudtasks.enqueuer` 权限

#### 2. 任务执行失败（HTTP 403）

检查：
- Cloud Tasks 服务账号是否有 `roles/run.invoker` 权限
- CLOUD_RUN_SERVICE_URL 是否正确

#### 3. 任务超时

Cloud Run 默认超时为 300 秒。问题生成任务可能需要较长时间，可以调整：

```bash
gcloud run services update yuichat-backend \
    --region=asia-northeast1 \
    --timeout=600
```

## 回退机制

如果 Cloud Tasks 不可用（未配置或创建失败），系统会自动回退到同步执行问题生成。这确保了功能的可用性，但可能会增加文件上传的响应时间。

日志中会显示使用的执行方式：
- `🚀 Question generation scheduled via Cloud Tasks` - 使用 Cloud Tasks
- `✅ Question generation completed (sync)` - 同步执行
