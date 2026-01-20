#!/bin/bash
# 1.2.35: 设置部署环境变量

export GCP_PROJECT_ID=581747554307
export GCP_REGION=asia-east1

echo "✅ 环境变量已设置："
echo "   GCP_PROJECT_ID=$GCP_PROJECT_ID"
echo "   GCP_REGION=$GCP_REGION"
echo ""
echo "现在可以运行："
echo "  ./setup-secrets.sh  # 设置密钥"
echo "  ./deploy-gcp.sh     # 部署服务"
