#!/bin/bash
set -e

echo "🚀 开始 AWS 部署..."

# 生成时间戳作为镜像标签
TIMESTAMP=$(date +%Y%m%d%H%M%S)
IMAGE_TAG="a1d-agent:${TIMESTAMP}"
IMAGE_TAG_LATEST="a1d-agent:latest"

# 检查必要的环境变量
if [ -z "$AWS_ACCOUNT_ID" ]; then
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
fi

if [ -z "$AWS_REGION" ]; then
    AWS_REGION="us-west-2"
fi

ECR_REPOSITORY_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/a1d-agent"

echo "📦 构建和推送镜像到 AWS ECR..."
echo "   AWS Account: ${AWS_ACCOUNT_ID}"
echo "   AWS Region: ${AWS_REGION}"
echo "   ECR Repository: ${ECR_REPOSITORY_URI}"
echo "   标签: ${IMAGE_TAG} 和 latest"

# 1. 确保 ECR 仓库存在
echo "🏗️ 检查/创建 ECR 仓库..."
if ! aws ecr describe-repositories --repository-names a1d-agent --region ${AWS_REGION} > /dev/null 2>&1; then
    echo "   创建 ECR 仓库: a1d-agent"
    aws ecr create-repository \
        --repository-name a1d-agent \
        --image-scanning-configuration scanOnPush=true \
        --region ${AWS_REGION}
else
    echo "   ECR 仓库已存在: a1d-agent"
fi

# 2. 登录 ECR
echo "🔐 登录 AWS ECR..."
# 修复 macOS Docker 凭证问题 - 使用临时配置
export DOCKER_CONFIG=$(mktemp -d)
cat > $DOCKER_CONFIG/config.json <<EOF
{
  "credsStore": ""
}
EOF
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPOSITORY_URI}

# 3. 构建镜像
echo "🔨 构建 Docker 镜像（针对 ARM64 平台）..."
docker build --platform linux/arm64 -t ${IMAGE_TAG} -t ${IMAGE_TAG_LATEST} .

# 4. 标记镜像
echo "🏷️ 标记镜像..."
docker tag ${IMAGE_TAG} ${ECR_REPOSITORY_URI}:${TIMESTAMP}
docker tag ${IMAGE_TAG_LATEST} ${ECR_REPOSITORY_URI}:latest

# 5. 推送镜像
echo "📤 推送镜像到 ECR..."
docker push ${ECR_REPOSITORY_URI}:${TIMESTAMP}
docker push ${ECR_REPOSITORY_URI}:latest

# 6. 进入 pulumi 目录部署
echo "🏗️ 部署到 AWS..."
cd pulumi
# 将镜像标签传递给 Pulumi
pulumi config set containerImage "${ECR_REPOSITORY_URI}:${TIMESTAMP}"
pulumi up --yes

echo "✅ AWS 部署完成！"
echo "🔗 镜像位置: ${ECR_REPOSITORY_URI}:${TIMESTAMP}"

# 清理临时 Docker 配置
if [ -n "$DOCKER_CONFIG" ] && [ -d "$DOCKER_CONFIG" ]; then
    rm -rf "$DOCKER_CONFIG"
fi