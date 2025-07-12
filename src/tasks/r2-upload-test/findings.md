# R2 组件实现差异总结

## 与官方文档的差异

### 1. API 导入方式

- **官方文档**：`import r2 from '@convex-dev/r2'`
- **实际项目**：通过 `components.r2` 访问（已在 convex.config.ts 中配置）

### 2. store 函数签名

- **官方文档**：`r2.store(ctx, blob, options)`
  - 接收 Blob 对象
- **实际项目**：`components.r2.store(ctx, uint8Array, options)`
  - 接收 Uint8Array（参考 speedpaint.ts）

### 3. 环境变量

- **官方文档**：需要在 Convex Dashboard 设置
  - `R2_TOKEN`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_ENDPOINT`
  - `R2_BUCKET`
- **实际项目**：可能已经在 Convex Dashboard 中配置

## 正确的实现方式

基于项目中 `speedpaint.ts` 的实现，正确的使用方式是：

```typescript
import { components } from './_generated/api'

// 上传文件
const key = await components.r2.store(ctx, uint8Array, {
  key: 'custom-key', // 可选
  type: 'image/jpeg', // MIME 类型
})

// 获取 URL
const url = await components.r2.getUrl(ctx, key, {
  expiresIn: 60 * 60 * 24 * 7, // 秒为单位
})
```

## 测试步骤

1. 将 `r2-upload-action.ts` 的内容复制到 `src/convex/r2Upload.ts`
2. 运行 `npx convex dev` 部署函数
3. 运行测试脚本：`pnpm x tasks/r2-upload-test/test-r2-final.inspect.ts`

## 注意事项

1. 确保 R2 组件已在 `convex/convex.config.ts` 中配置（项目中已配置）
2. 环境变量需要在 Convex Dashboard 中设置，而不是本地 .env 文件
3. 文件数据应该是 Uint8Array 格式，而不是 Blob
