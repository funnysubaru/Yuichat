# Dify 部署指南

## 系统要求

- CPU >= 2 Core
- RAM >= 4 GiB
- 已安装 Docker 和 Docker Compose

## 快速部署

### 1. 克隆 Dify 仓库

```bash
git clone https://github.com/langgenius/dify.git
cd dify/docker
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量。

### 3. 启动服务

```bash
docker compose up -d
```

### 4. 访问 Dify

打开浏览器访问：http://localhost/v1/health

如果看到 `{"status": "healthy"}`，说明部署成功。

### 5. 创建应用和知识库

1. 访问 Dify 管理界面（通常是 http://localhost）
2. 创建新的应用（选择"聊天助手"类型）
3. 创建知识库（Dataset）
4. 获取 API Key：
   - 进入应用设置
   - 复制 API Key

### 6. 配置 API Key

将获取的 API Key 配置到 Supabase Edge Functions 环境变量中。

## 生产环境部署

生产环境建议：

1. 使用域名和 HTTPS
2. 配置反向代理（Nginx）
3. 设置防火墙规则
4. 定期备份数据

详细说明请参考 Dify 官方文档：https://docs.dify.ai

