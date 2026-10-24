# 资产选择、引入与验收

创建或修改 HTML 课件时读取。本协议规范 Course Kit v2 的模块选择、构建同步、DOM 接线和能力限制。

## 选择

`kit/` 目录是所有资产的唯一代码源，`kit/catalog.json` 与 `kit/kit.manifest.json` 是模块能力、依赖与接入方式的权威视图。按教学目标选择最小组合。

模块存在方式（presence）分为三类：
- **core**：运行时基础设施 L0（`core`）、视觉与主题引擎 L1（`foundation`）、公共块外壳 L2（`content._block`）、页面骨架与目录 L3（`shell.nav`、`shell.progress`、`shell.theme-switcher`、`shell.toc`）、学习记录模型 L4（`learning.records`）。随 `kit.js` 与 `kit.css` 默认打包。
- **auto**：代码块（`content.code`）、数学公式（`content.math`）、Mermaid 图表（`content.diagram`）、表格（`content.table`）、媒体（`content.media`）、动画（`content.animation`）、提示块（`content.callout`）、统一题目（`learning.question`）、步骤向导（`learning.step`）、可视化核心（`viz.core`）及无三方库 kind。`kit sync` 扫描课件自动识别并打包。
- **opt-in**：重型第三方库依赖（如 `viz.kinds.chart` 依赖 Plotly、`viz.kinds.spatial` 依赖 JSXGraph）。通过 `python kit/build/kit.py add <course-dir> <module-id>` 显式启用。

### 第三方库优先

制作组件前先查成熟库，按以下路由选择——这些是硬规则，不是建议：

| 内容类型 | 必须使用 | 禁止 |
|---|---|---|
| 代码块 | 原生 `<pre><code class="language-...">` + Kit 块外壳 + highlight.js | 裸 `<pre><code>` 无外壳、手写高亮 |
| 流程图、状态图、时序图、类图、甘特图、饼图 | Mermaid（`<pre class="mermaid">`） | 手写内联 SVG 替代 Mermaid 能表达的图形 |
| 数学公式 | KaTeX（`\(...\)` 与 `\[...\]`） | 手写公式图片或纯文本近似 |
| 2D 数据图表（折线、柱状、散点、饼图） | Chart.js（优先）或 Plotly（`chart`） | 手写 SVG/Canvas 画图表 |
| 3D 曲面、热图、等高线 | Plotly（`chart`） | — |
| 几何构造、数轴、坐标变换 | JSXGraph（`spatial`） | 手写 SVG 几何 |
| 复杂关系图（非 Mermaid 能覆盖） | Cytoscape | — |
| 时间轴（数据驱动） | vis-timeline / Kit timeline | — |

优先复用库已实现的解析、排版、布局、绘制与交互能力；课程自写部分负责领域模型、教学动作、状态与证据接线。原生 HTML 足够的表格/媒体控件仍用原生能力；内置简单 SVG 仅用于简图示意和降级后备，不作为正式图形方案。

允许固定版本 CDN，第三方库按 CDN + SRI 优先，`assets/course/config.json` 的 `vendor.mode=local` 切离线。把实际选用的库、版本、CDN/本地方式及对应课件记入 `PLAN.md`。运行验收必须看到真实 token 高亮、排版后的公式或布局后的图形。

## 引入与同步

Course Kit v2 将所有模块拓扑排序并拼接为单文件产物：
1. **自动同步**：运行 `python kit/build/kit.py sync <course-dir>`。脚本扫描 `lessons/*.html`，解析 auto 模块，将 active 模块打包输出到 `assets/kit/kit.js` 与 `assets/kit/kit.css`，并写入锁定清单 `assets/kit/kit.lock.json`。
2. **添加可选模块**：运行 `python kit/build/kit.py add <course-dir> <module-id>`（例如 `viz.kinds.chart`、`viz.kinds.spatial`），写入 `assets/course/config.json` 并自动同步。
3. **页面接线**：每个课件只需标准引用：
   ```html
   <link rel="stylesheet" href="../assets/kit/kit.css">
   <link rel="stylesheet" href="../assets/course/theme.css">
   <script defer src="../assets/kit/kit.js"></script>
   ```
4. **CSS 层次**：采用现代 `@layer` 规则：
   `@layer reset, tokens, base, content, shell, learning, viz, theme, course;`
   课程自定义样式写入 `assets/course/theme.css`，处于最优先的 `course` 层，完全解耦加载顺序与特异度竞争。

## 分章课程包的资产同步

一个课程包用 `lessons/<章>/`、`records/<章>/`、`reference/<章>/` 分子目录覆盖多章时，`assets/` 仍只有一份（`assets/kit/` bundle + `assets/course/` 配置），`kit sync <course-dir>` 会递归扫描全部章目录并取模块并集，`nav.json` 也仍是课程包级单文件。

- 递归扫描与进度组合键（`"<章>/<NNNN>"`）的唯一实现是 `scripts/course_layout.py`；`build_index.py`、`validate_course.py`、`update_progress.py` 与 `kit.py` 都从它取路径，不要另写 glob。
- 课号每章各自从 0001 起，所以 `update_progress.py` 在分章包上必须带 `--chapter <label|id>`（objective 声明了 `chapter` 且无歧义时可自动推断）。
- `assets/kit/` 是生成物，多章共用一份；章目录里不要再建 `assets/`。
- `vendor.mode=local` 时离线库落在 `assets/kit/vendor/`，运行时基址由 `kit.js` 的 `src` 反推，课件深度变化不影响解析。

## 导航与进度数据

侧边栏课表、当前课高亮、完成进度条由 `assets/course/nav.json` 承载。**`kit.py sync` 末尾会自动调用 `build_index.py --nav-only --nav` 只重新生成 nav.json**（不触碰 INDEX.md 与 index.html），无需手动跑。

`nav.json` 的内容与来源：

| 字段 | 来源 | 说明 |
|---|---|---|
| `lessons` | 扫描 `lessons/*.html` 的 `<title>` / `<h1>` | 课号、标题、前后课链接 |
| `current_lesson` | `course.yaml` 的 `current_lesson` | 侧边栏当前课高亮 |
| `completed_lessons` | 扫描 `records/*.md` 中 `assessment_status: finalized` 的记录 | 侧边栏 ✓ 标记 + 进度条分子 |
| `completed_count` | `completed_lessons` 的长度 | 进度条显示 |

如需重建课程索引页（INDEX.md 与 index.html），手动运行 `python scripts/build_index.py <course-dir>`。

## 主题与配色：内置预设 + 自创主题

- **L1 Token 系统**：三级设计令牌（primitive → semantic → component），包含 `--c-bg`、`--c-text`、`--c-accent`、`--series-1...8`、`--code-*`、`--toc-*`。组件 CSS 严格禁止出现字面十六进制色值。
- **第三方接线**：Chart.js/Plotly/JSXGraph 读取 `--series-*` 变量；highlight.js 官方主题由单个 `<link id="kit-hljs-theme">` 承载，主题切换时由主题引擎无缝切换；Mermaid `themeVariables` 自动响应主题变更派发的 `kit:themechange` 事件。
- **内置 8 套预设**（`init_course.py --theme` 选择，右上角切换器可换）：

| 预设 | 明暗 | 代码块 | 按需字体 | 适用 |
|---|---|---|---|---|
| `swiss` | 浅色 | 深色 | Noto Sans SC / JetBrains Mono | 理工、数学、排版严谨的推导课 |
| `blueprint` | 深色 | 深色 | Noto Sans SC / JetBrains Mono | 工程、系统、网络拓扑类内容 |
| `riso` | 浅色 | 深色 | Noto Sans SC / Space Grotesk | 通识、概念、设计感强的主题 |
| `brutal` | 浅色 | 深色 | Noto Sans SC / Space Grotesk / JetBrains Mono | 编程、练习、强节奏反馈 |
| `field` | 浅色 | 深色 | LXGW WenKai | 自然、生物、人文观察笔记 |
| `course` | 浅色 | 跟随页面 | — | 默认通用 |
| `ink` | 深色 | 深色 | — | 默认深色 |
| `paper` | 浅色 | 浅色 | — | 打印与纸质阅读 |

- **课程自创主题（开放扩展契约）**：在 `<course-dir>/assets/course/themes/<name>.css` 编写新预设，文件首行必须是元数据注释：

  ```css
  /* @kit-theme name="cyber-crt" label="复古终端" scheme="dark" code="dark" fonts="jetbrains-mono:400,700" */
  @layer theme {
    html[data-theme="cyber-crt"] { /* 覆盖语义色彩、字体、圆角与版式钩子 */ }
  }
  ```

  - `fonts` 内多个字体用 `;` 分隔（单个 spec 内 `,` 表示多字重）；值可以是 fontsource 包名（`noto-sans-sc:400,700`）或完整 CSS URL。
  - 必填 Token（对齐 `themes/course.css`）：背景层 `--c-bg`/`--c-surface`/`--c-surface-2`、文字层 `--c-text`/`--c-text-2`/`--c-muted`、边框 `--c-border`/`--c-border-strong`、强调色家族 `--c-accent`/`--c-accent-strong`/`--c-accent-bg`/`--c-accent-border`、语义色 `--c-warn(-bg)`/`--c-danger(-bg)`/`--c-success(-bg)`、数据色板 `--series-1..8`、阴影 `--shadow`/`--shadow-card`、字体栈 `--font-display`/`--font-body`/`--font-mono`；可选结构装饰钩子：背景肌理 `background-image`、`h2` 章节造型、`.callout`/`.question` 边框与阴影风格。
  - 门禁：`kit.py sync` 解析 `@kit-theme` 头并把主题合入 `kit.css` 与 `config.json` 的 `customThemes`/`themes`（无合法头部直接报错）；正文对比度 ≥ 4.5:1；深色主题必须 `scheme="dark"`（自动触发 SVG 亮色描边）；自创主题必须通过 `kit.py shot --theme <id>` 截图自检。
  - 晋升全局预设：把该 CSS 复制到 `kit/foundation/themes/<name>.css` 并运行 `kit.py build`，即可成为所有课程可用的内置预设。

## 扩展组件开发规范

无论是向 Kit 库新增共享模块，还是为单门课程编写专用交互模型，均遵循以下规范：

### 1. 课程级专用扩展（Course Extensions）
- 存放于 `assets/course/` 或 `assets/course/extensions/`，并在 `assets/course/config.json` 的 `extensions` 数组或 `assets/course/extensions.json` 中声明。
- **三类接口职责分明**：
  1. **模型（Model）**：负责业务状态与数据规约，实现 `initialState()`、`reduce(state, action)` 与 `derive(state)`。注册接口：`kit.store.registerModel(name, modelSpec)`。不涉及 DOM 渲染。
  2. **渲染器（Renderer）**：负责纯数据衍生视图绘制，实现 `function(node, derivedState)`。注册接口：`kit.store.registerRenderer(name, fn)`。
  3. **适配器（Kind）**：负责特定可视化类型或题目类型：
     - **可视化 Kind**：必须实现 `validate(config)` 与 `render(node, config, ctx)`；支持 `data-viz-source` 动态更新时实现可选的 `update(node, config, snapshot, instance)`；持有持久 DOM 或动画计时器时实现可选的 `destroy()`。注册接口：`kit.viz.registerKind(name, adapter)`。
     - **题型 Kind**：实现 `mount(ctx)`、`judge(ctx)` 或 `submit(ctx)`、`getRawAnswer(ctx)`、`reveal(ctx)`、`lock(ctx)`。注册接口：`kit.question.registerKind(name, adapter)`。
- **构建集成**：`kit sync` 扫描声明的扩展并自动打包 JS/CSS，并将其能力登记供 `validate_course.py` 校验识别，无需手动修改全局核心代码。

### 2. Kit 全局模块扩展（Kit Modular Extensions）
若要向 `kit/` 添加可复用的全新组件（如新动效、新可视化类型）：
1. **分层归属**：L2（`content/` 内容组件）、L3（`shell/` 框架组件）、L4（`learning/` 交互组件）、L5（`viz/` 可视化组件）。
2. **模块描述符 `module.json`**：声明 `id`、`layer` (0-5)、`requires`（至少含 `core`）、`presence` (`auto` 或 `opt-in`)、`detect.selectors`（auto 模式下自动感知的 HTML 选择器）、`provides` 与 `ready` 事件名。
3. **CSS 规则**：样式必须包裹在对应的 `@layer <layer_name> { ... }` 中，全部颜色使用 CSS Token。
4. **就绪与生命周期**：JS 初始化完成必须调用 `kit.ready.markReady("<module.id>")`。
5. **构建生效**：运行 `python kit/build/kit.py build` 重新编译 `kit.manifest.json` 与 `catalog.json`，随后在课程中通过 `kit.py sync` 打包。

## 验收

1. 运行 `python kit/build/kit.py check <course-dir>` 校验模块与产物哈希完整性。
2. 运行 `python scripts/validate_course.py <course-dir> --strict-schema --pedagogical` 检查课件契约、TOC 静态后备与学习证据。
3. 新组件或领域模型实际打开页面，检查 `kit:ready`（全局 `data-kit-ready`）与逐模块 `kit:<module>:ready`，确认无 `data-kit-state=failed` 容器。
4. 375px/768px/1280px 宽度实测：无水平溢出，TOC 三态切换正常，主题无刷新平滑切换。
5. 无脚本与打印时：正文、代码、公式源、Mermaid 源、静态目录均可读。
6. 视觉自检：`python kit/build/kit.py shot <course-dir> [--lesson N] [--theme <id>]` 用无头 Chromium 生成桌面（1440×2400）与窄屏（390×1600）截图到 `exports/shots/`；具备视觉能力的 Agent 直接读取 PNG 检查排版溢出、公式与图表渲染；自创主题必须截图验收对比度。
