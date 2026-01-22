# 1.2.46: YUIChat Python 后端 Dockerfile for GCP Cloud Run
# 优化构建速度：
# - 使用 BuildKit 缓存挂载加速 pip 安装
# - 优化层顺序，最大化缓存命中
# - 分离稳定依赖和频繁变更依赖

# syntax=docker/dockerfile:1.4
FROM python:3.11-slim AS builder

# 设置工作目录
WORKDIR /app

# 设置 pip 配置 - 使用国内镜像加速（可选，Cloud Build 通常不需要）
# ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple

# 安装系统依赖（这层很少变化，会被很好地缓存）
# 1.2.35: 安装 Chromium 和浏览器驱动（Selenium/Playwright 需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-driver \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 设置 Chromium 环境变量（Selenium 使用）
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

# 1.2.46: 先复制 requirements.txt，利用 Docker 层缓存
# 只有 requirements.txt 变化时才会重新安装依赖
COPY requirements.txt .

# 1.2.46: 使用 BuildKit 缓存挂载加速 pip 安装
# 这样即使 requirements.txt 没变化，pip 缓存也能在多次构建间复用
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install -r requirements.txt

# 1.2.46: 最后复制应用代码（这层变化最频繁，放在最后）
COPY . .

# 设置环境变量
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# 1.2.35: 生产环境默认配置
ENV ENV=production
ENV USE_PGVECTOR=true

# 暴露端口（Cloud Run 使用 PORT 环境变量）
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# 启动命令
# Cloud Run 会自动设置 PORT 环境变量
CMD exec uvicorn app:fastapi_app --host 0.0.0.0 --port ${PORT:-8080} --workers 1
