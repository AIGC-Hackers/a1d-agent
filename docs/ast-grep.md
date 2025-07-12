# ast-grep 使用指南

ast-grep 是一个基于 AST（抽象语法树）的代码搜索和重构工具，特别适合在 TypeScript 项目中进行精确的代码搜索和分析。

## 基本用法

### 命令行基础

```bash
# 搜索模式
ast-grep --pattern 'console.log($$$)'

# 使用规则文件
ast-grep --rule rule.yaml

# 在特定文件类型中搜索
ast-grep --pattern 'import { $$ } from "@mastra/$PKG"' --lang ts
```

## 规则速查表

### 原子规则 (Atomic Rules)

原子规则用于匹配单个 AST 节点的属性。

#### Pattern 模式匹配

```yaml
pattern: console.log($ARG)
```

匹配代码结构，如 `console.log` 调用。`$ARG` 是元变量，匹配任意表达式。

#### Context 和 Selector

```yaml
pattern:
  context: '{ key: value }'
  selector: pair
```

通过指定 AST selector 来解析歧义模式。

#### Kind 节点类型

```yaml
kind: if_statement
```

按 AST 节点类型匹配（如 `function_declaration`, `variable_declarator` 等）。

#### Regex 正则表达式

```yaml
regex: ^regex.+$
```

使用 Rust 风格的正则表达式匹配节点文本。

#### NthChild 位置匹配

```yaml
nthChild: 1
```

按节点在兄弟节点中的位置匹配（从 1 开始）。

高级位置控制：

```yaml
nthChild:
  position: 2
  reverse: true # 从后往前数
  ofRule: { kind: argument_list }
```

### 关系规则 (Relational Rules)

关系规则定义节点之间的结构关系。

#### Inside 内部规则

```yaml
inside:
  kind: function_declaration
```

目标节点必须在指定的父/祖先节点内部。

#### Has 包含规则

```yaml
has:
  kind: method_definition
```

目标节点必须包含匹配子规则的子/后代节点。

#### Field 语义角色

```yaml
has:
  kind: statement_block
  field: body
```

按语义角色匹配节点。

#### Precedes/Follows 顺序规则

```yaml
precedes:
  pattern: function $FUNC() { $$ }
```

匹配在特定节点之前/之后的节点。

### 复合规则 (Composite Rules)

复合规则组合多个规则以创建复杂的匹配逻辑。

#### All 全部匹配

```yaml
all:
  - pattern: import { $$ } from "$MODULE"
  - inside:
      kind: source_file
```

所有子规则都必须匹配。

#### Any 任意匹配

```yaml
any:
  - pattern: console.log($$$)
  - pattern: console.error($$$)
```

至少一个子规则匹配。

#### Not 否定匹配

```yaml
not:
  pattern: console.log($$$)
```

不匹配指定的规则。

### 实用规则 (Utility Rules)

#### Matches 元变量匹配

```yaml
matches: ARG
```

匹配之前模式中捕获的元变量。

## TypeScript 项目中的实用示例

### 查找特定导入

```yaml
rule:
  pattern: import { $IMPORT } from "@mastra/$PKG"
```

### 查找未使用的变量

```yaml
rule:
  all:
    - pattern: const $VAR = $VALUE
    - not:
        has:
          matches: VAR
```

### 查找特定的函数调用

```yaml
rule:
  pattern: createVirtualFileSystem($PROJECT_ID)
```

### 查找错误处理模式

```yaml
rule:
  all:
    - kind: try_statement
    - has:
        kind: catch_clause
        has:
          pattern: console.error($$$)
```

## 元变量 (Meta Variables)

- `$VAR` - 匹配单个 AST 节点
- `$$VAR` - 匹配零个或多个 AST 节点（用于列表）
- `$$$VAR` - 匹配任意数量的 AST 节点（贪婪匹配）

## 在项目中使用 ast-grep

1. **代码搜索**：快速定位特定的代码模式
2. **重构验证**：确保重构没有遗漏任何地方
3. **代码审查**：查找潜在的代码问题
4. **依赖分析**：分析模块依赖关系

### 示例：查找所有 VFS 使用

```bash
ast-grep --pattern 'createVirtualFileSystem($$$)' --lang ts
```

### 示例：查找所有 Mastra 工具定义

```bash
ast-grep --pattern 'tool({ name: $NAME, $$ })' --lang ts
```

## 提示

- 使用 `--debug-query` 查看 AST 结构
- 使用 `--json` 输出 JSON 格式的结果
- 结合 `--rewrite` 进行代码重构
- 使用 YAML 规则文件处理复杂的搜索场景
