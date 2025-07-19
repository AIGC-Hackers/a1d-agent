#!/bin/bash
set -e

echo "🚀 开始部署..."

# 1. Azure 构建容器
echo "📦 构建和推送镜像..."
az acr build --registry a1dazureacr --image a1d-agent:latest .

# 2. 进入 pulumi 目录部署
echo "🏗️ 部署到 Azure..."
cd pulumi
pulumi up --yes

echo "✅ 部署完成！"
