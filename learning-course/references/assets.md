# 资产选择、引入与验收

创建或修改 HTML 课件时读取。本协议规范 Course Kit v2 的模块选择、构建同步、DOM 接线和能力限制。

## 选择

`kit/` 目录是所有资产的唯一代码源，`assets/catalog.json` 与 `kit/kit.manifest.json` 是模块能力、依赖与接入方式的权威视图。按教学目标选择最小组合。

模块存在方式（presence）分为三类：
- **core**：L0 核心运行时（bus/config/store/loader/util）、L1 基础与主题引擎、L4 学习记录模型。随 `kit.js` 默认打包。
- **auto**：代码块（`content.code`）、数学公式（`content.math`）、Mermaid 图表（`content.diagram`）、表格、目录（`shell.toc`）、题目（`learning.question`）、可视化核心（`viz.core`）及无库 kind。`kit sync` 扫描课件自动识别并打包。
- **opt-in**：重型第三方库依赖（如 `viz.kinds.chart` 依赖 Plotly、`viz.kinds.spatial` 依赖 JSXGraph）。通过 `kit add` 显式启用。

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

## 主题与配色

- **L1 Token 系统**：三级设计令牌（primitive → semantic → component），包含 `--c-bg`、`--c-text`、`--c-accent`、`--series-1...8`、`--code-*`、`--toc-*`。组件 CSS 严格禁止出现字面十六进制色值。
- **内置主题**：`course`、`ink`、`paper`，声明自身 `color-scheme`。
- **第三方接线**：Chart.js/Plotly/JSXGraph 读取 `--series-*` 变量；highlight.js 官方主题由单个 `<link id="kit-hljs-theme">` 承载，主题切换时由主题引擎无缝切换；Mermaid `themeVariables` 自动响应主题变更派发的 `kit:themechange` 事件。

## 专用扩展

先写课程资产；模型用 `registerModel`，专用画布用 `registerRenderer` 或 `registerKind`。
所有扩展实现 `validate`/`render`；使用 `data-viz-source` 时实现 `update`，持有资源时实现 `destroy`。导出参数与步骤为观察记录，掌握评估仍走 records。

## 验收

1. 运行 `python kit/build/kit.py check <course-dir>` 校验模块与产物哈希完整性。
2. 运行 `python scripts/validate_course.py <course-dir> --strict-schema --pedagogical` 检查课件契约、TOC 静态后备与学习证据。
3. 新组件或领域模型实际打开页面，检查 `kit:ready`（全局 `data-kit-ready`）与逐模块 `kit:<module>:ready`，确认无 `data-kit-state=failed` 容器。
4. 375px/768px/1280px 宽度实测：无水平溢出，TOC 三态切换正常，主题无刷新平滑切换。
5. 无脚本与打印时：正文、代码、公式源、Mermaid 源、静态目录均可读。
