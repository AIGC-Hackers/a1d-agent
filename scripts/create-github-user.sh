#!/bin/bash
set -e

echo "🔐 为 GitHub Actions 创建 IAM 用户..."

USER_NAME="a1d-agent-github-actions"
POLICY_NAME="A1DAgentDeploymentPolicy"

# 1. 创建 IAM 用户
echo "📝 创建 IAM 用户: $USER_NAME"
aws iam create-user --user-name $USER_NAME || echo "用户可能已存在"

# 2. 创建自定义策略
echo "📋 创建部署策略..."
cat > /tmp/deployment-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:PutImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:CreateRepository",
                "ecr:DescribeRepositories"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecs:*",
                "logs:*",
                "iam:PassRole",
                "iam:GetRole",
                "iam:CreateRole",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:DeleteRole",
                "iam:TagRole",
                "iam:UntagRole",
                "iam:ListAttachedRolePolicies",
                "elasticloadbalancing:*",
                "route53:*",
                "application-autoscaling:*",
                "sts:GetCallerIdentity"
            ],
            "Resource": "*"
        }
    ]
}
EOF

aws iam create-policy \
    --policy-name $POLICY_NAME \
    --policy-document file:///tmp/deployment-policy.json || echo "策略可能已存在"

# 3. 获取策略 ARN
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

# 4. 附加策略到用户
echo "🔗 附加策略到用户..."
aws iam attach-user-policy \
    --user-name $USER_NAME \
    --policy-arn $POLICY_ARN

# 5. 创建访问密钥
echo "🔑 创建访问密钥..."
CREDENTIALS=$(aws iam create-access-key --user-name $USER_NAME --output json)

ACCESS_KEY_ID=$(echo $CREDENTIALS | jq -r '.AccessKey.AccessKeyId')
SECRET_ACCESS_KEY=$(echo $CREDENTIALS | jq -r '.AccessKey.SecretAccessKey')

echo ""
echo "✅ GitHub Actions IAM 用户创建成功！"
echo ""
echo "请将以下凭证添加到 GitHub Secrets:"
echo "-------------------------------------------"
echo "AWS_ACCESS_KEY_ID: $ACCESS_KEY_ID"
echo "AWS_SECRET_ACCESS_KEY: $SECRET_ACCESS_KEY"
echo "-------------------------------------------"
echo ""
echo "⚠️  请立即保存这些凭证，它们不会再次显示！"

# 清理临时文件
rm -f /tmp/deployment-policy.json