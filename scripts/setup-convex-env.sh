#!/bin/bash

# 设置 Convex 环境变量脚本
# 使用 dotenvx 从本地环境获取变量，然后设置到 Convex 云端

echo "🔧 Setting up Convex environment variables..."

# R2 相关环境变量
echo "📦 Setting R2 configuration..."

R2_ACCESS_KEY_ID=$(dotenvx get CLOUDFLARE_ACCESS_KEY_ID)
R2_SECRET_ACCESS_KEY=$(dotenvx get CLOUDFLARE_SECRET_KEY)
R2_BUCKET=$(dotenvx get CLOUDFLARE_R2_BUCKET_NAME)
R2_BUCKET=${R2_BUCKET:-dev}
R2_ACCOUNT_ID=$(dotenvx get CLOUDFLARE_ACCOUNT_ID)

if [ -z "$R2_ACCESS_KEY_ID" ] || [ -z "$R2_SECRET_ACCESS_KEY" ] || [ -z "$R2_ACCOUNT_ID" ]; then
  echo "❌ Missing required Cloudflare R2 environment variables!"
  echo "Required: CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_KEY, CLOUDFLARE_ACCOUNT_ID"
  echo "Note: CLOUDFLARE_R2_BUCKET_NAME will default to 'dev' if not set"
  exit 1
fi

# 设置到 Convex
echo "⬆️  Uploading variables to Convex..."

pnpm convex env set R2_ACCESS_KEY_ID "$R2_ACCESS_KEY_ID"
pnpm convex env set R2_SECRET_ACCESS_KEY "$R2_SECRET_ACCESS_KEY"
pnpm convex env set R2_BUCKET "$R2_BUCKET"
pnpm convex env set R2_ACCOUNT_ID "$R2_ACCOUNT_ID"

# R2 endpoint (通常是标准格式)
R2_ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
pnpm convex env set R2_ENDPOINT "$R2_ENDPOINT"

echo "✅ Convex environment variables set successfully!"
echo ""
echo "📋 Variables set:"
echo "  - R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID:0:8}..."
echo "  - R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY:0:8}..."
echo "  - R2_BUCKET: $R2_BUCKET"
echo "  - R2_ACCOUNT_ID: $R2_ACCOUNT_ID"
echo "  - R2_ENDPOINT: $R2_ENDPOINT"
echo ""
echo "🚀 You can now run: pnpm convex dev"