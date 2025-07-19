# GitHub Actions 部署配置

## 必需的 GitHub Secrets

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中配置以下 secrets：

### Azure 凭证

1. **AZURE_CREDENTIALS** - Azure 服务主体凭证
```json
{
  "clientId": "<AZURE_CLIENT_ID>",
  "clientSecret": "<AZURE_CLIENT_SECRET>",
  "subscriptionId": "<AZURE_SUBSCRIPTION_ID>",
  "tenantId": "<AZURE_TENANT_ID>"
}
```

获取方式：
```bash
# 创建服务主体
az ad sp create-for-rbac --name "a1d-agent-github-actions" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP> \
  --json-auth
```


需要执行的操作：

1. 使用具有 Owner 或 User Access Administrator 权限的账户登录 Azure Portal
2. 导航到订阅 -> 访问控制 (IAM)
3. 添加角色分配：
  - 角色：Contributor（或者至少需要以下权限：）
      - 读取订阅
    - 管理容器注册表
    - 管理容器实例
  - 成员：选择服务主体 a1d-agent-github-actions

或者使用 Azure CLI（需要有权限的账户）：

# 使用有权限的账户登录
az login

# 为服务主体分配 Contributor 角色
az role assignment create \
  --assignee ba224055-2592-491e-a56f-9cf2ee314f7e \
  --role Contributor \
  --scope /subscriptions/50226c95-7971-4c95-97ee-4d9e30a806d3

在分配角色之后，服务主体才能访问订阅资源。


2. **PULUMI_ACCESS_TOKEN** - Pulumi 访问令牌

- 从 https://app.pulumi.com/account/tokens 获取

### 应用环境变量

将 `.env` 文件中的所有环境变量添加为 GitHub Secrets：

- ANTHROPIC_API_KEY
- CLOUDFLARE_ACCESS_KEY_ID
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_SECRET_KEY
- CLOUDFLARE_R2_BUCKET_NAME
- CONVEX_URL
- FAL_API_KEY
- GEMINI_API_KEY
- GROQ_API_KEY
- HUIYAN_A_API_KEY
- HUIYAN_B_API_KEY
- HUIYAN_C_API_KEY
- MINIMAX_API_KEY
- MINIMAX_GROUP_ID
- OPENROUTER_API_KEY
- POSTGRES_URL
- SPEEDPAINTER_API_KEY
- WAVESPEED_API_KEY
- XAI_API_KEY
- X_302_API_KEY

## 工作流触发方式

1. **自动触发**：推送到 `main` 分支时
2. **手动触发**：在 Actions 页面点击 "Run workflow"

## 部署流程

1. 检出代码
2. 设置 Node.js 环境
3. 登录 Azure
4. 构建并推送 Docker 镜像到 Azure Container Registry
5. 使用 Pulumi 部署到 Azure Container Apps
6. 生成部署摘要

## 故障排查

如果部署失败，检查：

1. **Azure 凭证**：确保服务主体有足够的权限
2. **Pulumi Token**：确保令牌有效且未过期
3. **环境变量**：确保所有必需的 secrets 都已配置
4. **ACR 权限**：确保服务主体有推送镜像的权限

## 本地测试

在本地测试部署流程：

```bash
# 登录 Azure
az login

# 运行部署脚本
./scripts/deploy.sh
```