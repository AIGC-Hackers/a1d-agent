# R2 上传测试任务

## 任务目标

测试将本地图片文件（assets/images/p1.jpg, p2.jpg, p3.jpg）上传到 Cloudflare R2 存储的功能。

## 技术方案

### 1. 使用 Convex R2 组件

根据官方文档，Convex R2 组件提供了简化的 API 来处理文件存储：

**主要 API：**

- `r2.store(ctx, blob, options)` - 存储文件
  - `blob`: 文件内容（Blob 或 ArrayBuffer）
  - `options.key`: 可选的自定义 key
  - `options.type`: 可选的 MIME 类型
- `r2.getUrl(key, options)` - 获取文件 URL
  - `key`: 文件的存储 key
  - `options.expiresIn`: URL 过期时间（秒），默认 15 分钟
- `r2.deleteByKey(key)` - 删除文件
- `r2.getMetadata(key)` - 获取文件元数据

### 2. 实现思路

1. 在 Convex action 中读取本地文件或接收文件数据
2. 使用 `r2.store()` 存储文件到 R2
3. 使用 `r2.getUrl()` 生成访问 URL
4. 返回存储结果和访问链接

### 3. 测试步骤

1. 读取本地图片文件
2. 将文件内容转换为 Uint8Array
3. 调用 R2 store 函数上传文件
4. 获取上传后的 URL
5. 验证文件是否成功上传

### 4. 环境配置

需要确保以下环境变量已配置（在 Convex Dashboard 中设置）：

- `R2_TOKEN` - R2 API Token
- `R2_ACCESS_KEY_ID` - R2 访问密钥 ID
- `R2_SECRET_ACCESS_KEY` - R2 秘密访问密钥
- `R2_ENDPOINT` - R2 端点 URL
- `R2_BUCKET` - R2 存储桶名称

### 5. 前置准备

1. 安装 R2 组件：`npm install @convex-dev/r2`
2. 在 `convex/convex.config.ts` 中配置组件
3. 在 Cloudflare 中创建 R2 存储桶并配置 CORS 策略

## 测试脚本

见 `test-r2-upload.inspect.ts`

## 注意事项

1. 需要在 Convex 环境中运行，因为要使用 Convex components
2. 确保图片文件存在于 assets/images/ 目录
3. 注意文件大小限制和上传性能
