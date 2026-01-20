# Cloud Run 日志查看命令

## 📋 查看日志的几种方法

### 方法 1: 使用 gcloud run services logs read（推荐）

```bash
# 查看最近的日志（默认 50 条）
gcloud run services logs read yuichat-backend --region asia-east1

# 查看最近的 100 条日志
gcloud run services logs read yuichat-backend --region asia-east1 --limit 100

# 查看最近的 20 条日志
gcloud run services logs read yuichat-backend --region asia-east1 --limit 20
```

### 方法 2: 使用 gcloud logging read（更灵活）

```bash
# 查看最近的日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yuichat-backend" \
    --limit 50 \
    --format="table(timestamp,textPayload)" \
    --project yuichat

# 查看特定时间段的日志（最近 1 小时）
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yuichat-backend AND timestamp>=\"$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)\"" \
    --format="table(timestamp,textPayload)" \
    --project yuichat

# 只查看错误日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yuichat-backend AND severity>=ERROR" \
    --limit 50 \
    --format="table(timestamp,severity,textPayload)" \
    --project yuichat
```

### 方法 3: 实时查看日志（Beta 功能）

```bash
# 实时查看日志（需要交互式终端）
gcloud beta logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=yuichat-backend" \
    --project yuichat \
    --format="table(timestamp,textPayload)"
```

### 方法 4: 在 GCP Console 中查看

访问：
```
https://console.cloud.google.com/run/detail/asia-east1/yuichat-backend/logs?project=yuichat
```

## 🔍 常用日志查询

### 查看错误日志
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yuichat-backend AND severity>=ERROR" \
    --limit 50 \
    --project yuichat
```

### 查看特定端点的请求
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yuichat-backend AND textPayload:\"/api/chat\"" \
    --limit 50 \
    --project yuichat
```

### 查看健康检查日志
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yuichat-backend AND textPayload:\"/health\"" \
    --limit 20 \
    --project yuichat
```

## 📝 快速脚本

使用提供的脚本：
```bash
cd backend_py
./view-logs.sh
```

## ⚠️ 注意事项

1. `gcloud run services logs read` 不支持 `--follow` 参数
2. 实时查看需要使用 `gcloud beta logging tail`
3. 日志保留时间取决于 GCP 项目的日志保留策略
