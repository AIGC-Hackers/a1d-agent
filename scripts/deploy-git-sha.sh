#!/bin/bash
set -e

echo "🚀 开始部署..."

# 获取当前 Git commit SHA（短版本）
GIT_SHA=$(git rev-parse --short HEAD)
IMAGE_TAG="a1d-agent:${GIT_SHA}"
IMAGE_TAG_LATEST="a1d-agent:latest"

# 1. Azure 构建容器
echo "📦 构建和推送镜像..."
echo "   标签: ${IMAGE_TAG} 和 latest"
az acr build --registry a1dazureacr --image ${IMAGE_TAG} --image ${IMAGE_TAG_LATEST} .

# 2. 进入 pulumi 目录部署
echo "🏗️ 部署到 Azure..."
cd pulumi
# 将镜像标签传递给 Pulumi
pulumi config set containerImage "a1dazureacr.azurecr.io/${IMAGE_TAG}"
pulumi up --yes

echo "✅ 部署完成！"