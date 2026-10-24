# Mermaid 图表组件

用 Mermaid 文本语法渲染流程图、状态图、时序图、类图、甘特图和饼图。agent 写文本定义，Mermaid 生成 SVG。

## 加载

Mermaid 是 Kit v2 的 auto 模块。课件中出现 `<pre class="mermaid">` 时，`kit sync` 自动将 `content.diagram` 模块打包进 `assets/kit/kit.js` 与 `assets/kit/kit.css`。页面只需标准 Kit 引用：

```html
<link rel="stylesheet" href="../assets/kit/kit.css">
<script defer src="../assets/kit/kit.js"></script>
```

脚本从 CDN 加载 Mermaid 11.x（`cdn.jsdelivr.net/npm/mermaid@11`）。无 `.mermaid` 容器时不渲染。

## 课件写法

用 `<pre class="mermaid">` 写图定义：

```html
<pre class="mermaid">
flowchart TD
    A[用户程序] --> B[trap 指令]
    B --> C[内核态切换]
    C --> D[异常处理程序]
    D --> E{是否可恢复?}
    E -->|是| F[返回用户态]
    E -->|否| G[进程终止]
</pre>
```

支持的图类型：

| 图类型 | 语法 | 适用场景 |
|--------|------|----------|
| 流程图 | `flowchart TD/LR` | 异常处理、决策流程、算法步骤 |
| 状态图 | `stateDiagram-v2` | 进程状态、协议状态机 |
| 时序图 | `sequenceDiagram` | 进程间通信、API 调用、fork/exec |
| 类图 | `classDiagram` | 数据结构关系、OOP 概念 |
| 甘特图 | `gantt` | 项目计划、实验时间线 |
| 饼图 | `pie` | 资源分配、概率分布 |

## 主题

脚本自动按课程表面选择主题：

| 课程表面 | Mermaid 主题 |
|----------|-------------|
| `data-theme-surface="light"` | `default` |
| `data-theme-surface="dark"` 或系统深色 | `dark` |

课程可在 `mermaid.js` 之前设置覆盖：

```html
<script>window.COURSE_MERMAID_THEME = "forest";</script>
```

## 降级

- **CDN 失败**：`<pre class="mermaid">` 内的文本定义仍然可读，`window.__COURSE_MERMAID_READY__` 设为 `false`。
- **无 JavaScript**：`<pre>` 内的文本定义直接显示，可读。
- **打印**：Mermaid 生成的 SVG 正常打印；边框简化。

## 同步

Mermaid 为 auto 模块，课件包含 `<pre class="mermaid">` 后运行：

```text
python kit/build/kit.py sync <course-dir>
```

`kit sync` 自动检测并打包 `content.diagram` 模块。无需手动安装。

## 验收

1. 打开含 `.mermaid` 容器的页面，确认 SVG 已生成。
2. 检查 `window.__COURSE_MERMAID_READY__ === true`。
3. 切换主题后确认 Mermaid 主题跟随变化。
4. 375px 窄屏无水平溢出。
5. 禁用脚本后文本定义可读。
