#!/bin/bash
# 1.2.35: 查看 Cloud Run 服务日志

# 查看最近的日志
echo "📋 查看最近的日志（最近 50 条）:"
gcloud run services logs read yuichat-backend --region asia-east1 --limit 50

echo ""
echo "💡 提示："
echo "  - 查看实时日志，使用: gcloud logging tail"
echo "  - 查看特定时间段的日志，使用: gcloud logging read"
