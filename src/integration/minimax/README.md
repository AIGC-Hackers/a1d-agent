# Minimax Integration

MiniMax AI API 集成，支持文本转音频、图像生成和语音克隆功能。

## 环境配置

运行测试前需要设置以下环境变量：

```bash
export MINIMAX_API_KEY=your_api_key_here
export MINIMAX_GROUP_ID=your_group_id_here
```

## Text-to-Audio (T2A) API

### 功能特性

- **多种模型支持**: `speech-02-hd`, `speech-02-turbo`, `speech-01-hd`, `speech-01-turbo`
- **语音混合**: 支持最多 4 种声音的权重混合
- **发音字典**: 手动控制中文发音和声调
- **多语言支持**: 24 种语言，包括中文普通话和粤语
- **实时流式生成**: SSE 流式音频生成
- **字幕生成**: 非流式模式支持字幕生成

### 基本用法

```typescript
import type { Text2AudioInput } from './t2a'
import { text2Audio } from './t2a'

// 基本音频生成
const input: Text2AudioInput = {
  model: 'speech-02-turbo',
  text: 'Hello, world!',
  voice_setting: {
    voice_id: 'male-qn-qingse',
    speed: 1.0,
    vol: 0.8,
  },
  audio_setting: {
    output_format: 'mp3',
    sample_rate: 24000,
  },
}

const result = await firstValueFrom(text2Audio(input, context))
```

### 语音混合

```typescript
const input: Text2AudioInput = {
  model: 'speech-02-turbo',
  text: 'Voice mixing example',
  timber_weights: [
    { voice_id: 'male-qn-qingse', weight: 60 },
    { voice_id: 'female-shaonv', weight: 40 },
  ],
}
```

### 发音字典

```typescript
const input: Text2AudioInput = {
  model: 'speech-02-turbo',
  text: '你好，我是小明。',
  voice_setting: {
    voice_id: 'male-qn-qingse',
  },
  pronunciation_dict: {
    tone: ['小明/(xiao3)(ming2)'],
  },
  language_boost: 'Chinese',
}
```

### 流式音频生成

```typescript
for await (const chunk of text2AudioSSEStream(input, context)) {
  const audioBytes = decodeAudioChunk(chunk.audio)
  // 处理音频块
}
```

## 运行测试

### 运行所有 T2A 测试

```bash
pnpm test src/integration/minimax/t2a.test.ts
```

### 运行特定测试组

```bash
# 基本 API 测试
pnpm test src/integration/minimax/t2a.test.ts -t "Basic API"

# 流式 API 测试
pnpm test src/integration/minimax/t2a.test.ts -t "Streaming API"

# 错误处理测试
pnpm test src/integration/minimax/t2a.test.ts -t "Error Handling"

# 性能测试
pnpm test src/integration/minimax/t2a.test.ts -t "Performance"
```

### 测试覆盖范围

测试套件包含以下测试场景：

1. **基本 API 功能**
   - 使用 voice_id 生成音频
   - 使用 timber_weights 混合声音
   - 发音字典功能
   - 字幕生成

2. **高级 API 功能**
   - 流式包装器
   - 多语言内容处理

3. **实时流式生成**
   - SSE 流式音频块
   - 额外信息获取

4. **工具函数**
   - 十六进制音频解码

5. **错误处理**
   - 无效模型名称
   - 缺少必需参数
   - 超过字符限制

6. **性能测试**
   - 短文本生成时间
   - 并发请求处理

## 注意事项

- 测试配置为永不超时，适合生成式任务
- 需要有效的 API 密钥和 Group ID
- 某些测试可能需要较长时间完成
- 流式测试会在收集足够数据后提前停止
