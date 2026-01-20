# 1.2.35: YUIChat Python 后端 Dockerfile for GCP Cloud Run
# 基于 Python 3.11，支持 FastAPI、LangGraph、Selenium/Playwright

FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
# 1.2.35: 安装 Chromium 和浏览器驱动（Selenium/Playwright 需要）
RUN apt-get update && apt-get install -y \
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
    && rm -rf /var/lib/apt/lists/*

# 设置 Chromium 环境变量（Selenium 使用）
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 安装 Playwright 浏览器（如果需要）
# 注意：Playwright 在 Cloud Run 中可能需要额外配置
# RUN playwright install chromium

# 复制应用代码
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
