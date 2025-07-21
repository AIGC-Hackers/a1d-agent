#!/bin/bash
set -e

echo "🚀 开始部署..."

# 生成唯一的标签（使用时间戳和 git commit hash）
TIMESTAMP=$(date +%Y%m%d%H%M%S)
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "no-git")
TAG="${TIMESTAMP}-${GIT_HASH}"
IMAGE_NAME="a1d-agent:${TAG}"

echo "📦 构建镜像: ${IMAGE_NAME}"

# 1. 先设置 BUILD_TIMESTAMP 到 .env.production
echo "⚙️ 设置构建时间戳..."
dotenvx set BUILD_TIMESTAMP "${TIMESTAMP}" -f .env.production

# 2. Azure 构建容器
echo "📦 构建和推送镜像..."
az acr build \
  --registry a1dazureacr \
  --image ${IMAGE_NAME} \
  .

# 2. 更新 Pulumi 配置使用新的镜像标签
echo "🔧 更新 Pulumi 配置..."
cd pulumi
pulumi config set containerImage "a1dazureacr.azurecr.io/${IMAGE_NAME}"

# 3. 部署到 Azure
echo "🏗️ 部署到 Azure..."
pulumi up --yes

# 4. 也更新 latest 标签以便后续使用
echo "🏷️ 更新 latest 标签..."
az acr repository update \
  --name a1dazureacr \
  --image a1d-agent:latest \
  --delete-enabled true \
  --write-enabled true

az acr repository show-tags \
  --name a1dazureacr \
  --repository a1d-agent \
  --orderby time_desc \
  --top 1 \
  --output tsv | xargs -I {} az acr import \
  --name a1dazureacr \
  --source a1dazureacr.azurecr.io/a1d-agent:{} \
  --image a1d-agent:latest \
  --force

echo "✅ 部署完成！"
echo "📌 部署的镜像: ${IMAGE_NAME}"
echo "🌐 健康检查: https://a1d-agent.whiteboardanimation.ai/health"