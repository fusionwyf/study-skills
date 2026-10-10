# 渲染与可视化（Course Kit v2 / LearnKit）

当课程包含公式、图表、交互或任何需要运行时渲染的组件时读取本文件。

制作入口是 **HTML + 稳定的 data-* 契约**。Agent 编写语义标记和后备，Course Kit v2 运行时接管组件外壳、状态流转与证据记录。

## 一、架构分层与加载机制

Course Kit v2 将所有渲染组件划分为清晰的 6 层（L0–L5）：

- **L0 核心层（`kit/core`）**：总线（`kit.bus`）、配置（`kit.config`）、加载器（`kit.need`）、就绪管理（`kit.ready`）、状态存储（`kit.store` / `LearnKit`）。
- **L1 基础与主题（`kit/foundation`）**：全局 Token（`tokens.css`）、预设主题（`course`/`ink`/`paper`）、基线排版与主题引擎（`theme-engine.js`）。
- **L2 块外壳与内容（`kit/content`）**：统一块外壳（`_block`，提供复制/折叠/语言徽章）、代码（`code`）、数学（`math`）、流程图（`diagram`）、表格与媒体。
- **L3 页面骨架（`kit/shell`）**：响应式布局、三态目录（`toc`）、导航与主题切换器。
- **L4 学习交互（`kit/learning`）**：统一题目（`question`，支持 6 种题型）、步骤（`step`）、学习证据模型（`records`）。
- **L5 可视化层（`kit/viz`）**：可视化内核（`core`）与图表适配器（`kinds/*`）。

所有模块经 `kit sync` 拓扑排序后打包为：
- 单一 JS：`assets/kit/kit.js`（IIFE 经典脚本，支持 `file://` 直接打开）
- 单一 CSS：`assets/kit/kit.css`（声明 `@layer reset, tokens, base, content, shell, learning, viz, theme, course;`）

## 二、数学公式渲染

公式使用 KaTeX 语法（`\(...\)` 行内，`\[...\]` 或 `$$...$$` 独立展示）。
- `content.math` 模块检测到定界符时自动渲染。
- 独立展示的公式自动由块外壳包裹，提供水平滚动保护与“复制 LaTeX”动作。
- 若无法加载 KaTeX，自动优雅降级为可读的 LaTeX 源码。

## 三、代码高亮与块外壳

- 作者编写原生语义标记 `<pre><code class="language-...">`。
- 块外壳接管：右上角显示规范语言名称，悬停显示“复制”按钮（复制纯文本代码）。
- 主题同步：代码块背景与边框由 Token `--code-bg` / `--code-border` 驱动，语法颜色由官方 highlight.js 主题提供。主题引擎在浅色/深色切换时，动态替换 `<link id="kit-hljs-theme">` 的主题表，无刷新且不闪烁。

## 四、图表与图解（Mermaid & Visualizations）

### 1. Mermaid 流程图与状态图
- 书写 `<pre class="mermaid">`。
- `content.diagram` 动态加载 Mermaid 并依据当前主题的语义 Token 计算 `themeVariables` 进行渲染。
- 监听 `kit:themechange` 事件并在主题切换时自动重新渲染。

### 2. 数据可视化适配器
可视化采用“内核 + 种类适配器”架构：
- **通用种类（通用 HTML/SVG）**：`relation`（关系图）、`timeline`（时间轴）、`process`（流程）、`sequence`（步骤回放）、`table`（动态表格）。
- **重型扩展**：`chart`（基于 Plotly 的 2D/3D 图表）、`spatial`（基于 JSXGraph 的几何与坐标变换）。

每个可视化容器由 `data-visualization="<kind>"` 声明，包含：
1. `<div data-viz-fallback>`：必须存在的无脚本文字/表格后备。
2. `<div class="viz-host" id="..." data-viz-host hidden>`：图形挂载容器。
3. `<p data-viz-status role="status">`：屏幕阅读器状态通报。
4. `<script type="application/json" data-viz-config>`：严格 JSON 数据配置。

### 3. 色彩通道与 Token 绑定
所有可视化适配器严格禁止写死十六进制色值：
- 图表序列颜色读取 `--series-1` 到 `--series-8` 变量。
- 背景、网格线与文本读取 `--c-surface`、`--c-border` 与 `--c-text`。

## 五、状态模型与 LearnKit 联动

动态模型通过 `kit.store.registerModel(name, { initialState, reduce, derive })` 注册。
- 容器使用 `data-learnkit="explore"` 与 `data-lk-config`。
- 控件使用 `data-lk-bind="params.xxx"` 自动进行状态双向绑定。
- 可视化容器通过 `data-viz-source="#lk-id"` 订阅状态派生结果并实时更新图表。
