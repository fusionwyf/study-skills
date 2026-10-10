# 资产选择、引入与验收

创建或修改 HTML 课件时读取。本协议减少 agent 在目录、安装、DOM 接线和能力限制之间的猜测。

## 选择

`assets/catalog.json` 是能力、文件、依赖和交付方式的权威来源。只读取当前任务相关条目中的 supports/limitations/example；按教学目标选最小组合。roles 与 delivery 是两个维度：

| role | 职责 | 例子 |
|---|---|---|
| common | 状态、回答、提示与原话记录 | course-runtime、state-runtime、media |
| rendering | 数据或标记到通用视图 | chart、relation、timeline、公式、代码着色 |
| specialized | 课程领域模型与图元 | 概率抽样、电路、几何构造 |

| delivery | 引入 |
|---|---|
| default | 初始化复制，依照模板加载 |
| optional | install_optional.py 从目录解析依赖、校验文件并登记安装 |
| external | 按条目的 network 规则加载；课程要求完全离线时预置本地资源 |
| extension | 在课程 assets/extensions/ 实现与登记，完成运行验收后使用 |

课程 `asset-manifest.json` 是安装事实，不是能力目录；`components.json`、`optional/manifest.json`、`adapters.json` 是目录投影。目录维护后运行 `sync_asset_catalog.py`，用 `--check` 检测漂移。模板副本同步后进行 byte-identity 回归。

### 第三方库优先

制作组件前先查成熟库，按以下路由选择——这些是硬规则，不是建议：

| 内容类型 | 必须使用 | 禁止 |
|---|---|---|
| 代码块 | `.code-block` + `.code-language` + `<pre><code>` + highlight.js 着色 | 裸 `<pre><code>` 无 wrapper、手写着色 |
| 流程图、状态图、时序图、类图、甘特图、饼图 | Mermaid（`<pre class="mermaid">`） | 手写内联 SVG 替代 Mermaid 能表达的图形 |
| 数学公式 | KaTeX（`\(...\)` 与 `\[...\]`） | 手写公式图片或纯文本近似 |
| 2D 数据图表（折线、柱状、散点、饼图） | Chart.js（优先）或 Plotly | 手写 SVG/Canvas 画图表 |
| 3D 曲面、热图、等高线 | Plotly | — |
| 几何构造、数轴、坐标变换 | JSXGraph | 手写 SVG 几何 |
| 复杂关系图（非 Mermaid 能覆盖） | Cytoscape | — |
| 时间轴（数据驱动） | vis-timeline | — |

优先复用库已实现的解析、排版、布局、绘制与交互能力；课程自写部分负责领域模型、教学动作、状态与证据接线。原生 HTML 足够的表格/媒体控件仍用原生能力；内置简单 SVG 仅用于简图示意和降级后备，不作为正式图形方案。

允许固定版本 CDN，版本匹配 JS/CSS/插件与语言包；普通在线课件无需先打包全部第三方库。把实际选用的库、版本、CDN/本地方式及对应课件记入 PLAN.md。明确离线要求时再准备本地依赖。运行验收必须看到真实 token 高亮、排版后的公式或布局后的图形，原文可读仅证明降级有效。

出现代码默认启用高亮，出现公式默认启用数学渲染，出现流程/状态/时序图默认启用 Mermaid。运行时组件调用实际实现的接口；planned 与 extension-required 名称通过第三方库与课程适配层实现后使用。LessonSpec 只校验规划，当前不生成整页。

## 引入

从 skill 目录运行 `python scripts/install_optional.py <course-dir> --components <names>`。安装器解析目录依赖、读取与合并 manifest、校验全部 vendor 文件、检查冲突，之后写入；失败回滚。已修改文件受保护，只有确实需要替换时使用 --force。

页面顺序：LearnKit → course.js → 课程领域模型注册 → 可视化内核 → 用到的 kinds；media 在 course.js 之后。依赖链不使用 async，不混用前置 defer 与后置立即执行。chart/spatial 从同课程 vendor 加载。code-highlight 先引入主题选择脚本，再引入着色脚本。mermaid 用 `<script type="module">` 在 body 末尾引入，ESM 加载 CDN。

安装与页面引入是独立步骤；没有引用的资源不会自动生成组件。CSS 顺序为基线 → 可视化/按需样式 → 课程覆盖。动态模型的数据绑定见 render.md。

新课程包含 `assets/theme.css` 与 `assets/theme.js`，并安装 code-highlight/theme 适配层；模板已接线。theme.css 最后加载，agent 在课程副本中自定义 token、布局与第三方容器。theme.js 在主题切换器和渲染器之前加载，可登记 COURSE_THEMES、COURSE_CODE_THEMES（官方主题名或固定版本 URL）、COURSE_MATH_OPTIONS（如 macros）。创建与续课复用这两个文件，不改共享适配器以实现课程配色。页面只有需要的内容才加载对应引擎。

完全离线：chart/spatial 使用已校验的本地 vendor；KaTeX 本地包含同版本 JS/CSS/fonts，highlight.js 先注册本地 window.hljs，并在 COURSE_CODE_THEMES 指定本地官方主题 CSS；音视频、图片与字幕也留在包内。安装器当前不自动下载这些外部资源；agent 需准备、替换引入并实际断网验证。无法实现时报告具体限制。

## 专用扩展

先写课程资产；模型用 registerModel，专用画布用 registerRenderer 或 registerKind。课程 registry 添加 name/tier=extension/module，module 路径相对 assets/visualizations（可用 ../extensions/name.js）。JSON 只承载数据，计算函数由受约束的注册模型提供。

所有扩展实现 validate/render；使用 data-viz-source 时实现 update，持有资源时实现 destroy。导出参数与步骤为观察记录，掌握评估仍走 records。专业计算优先预计算步骤或独立模型，通用内核不添加学科算法。sequence 的 input 保留选择排序兼容用法，新算法使用 steps 或课程模型。

## 验收

1. build_index 与 validate_course --strict-schema --pedagogical 通过。检查 installed 文件、vendor 校验值、核心/模块/样式引入、顺序、数据形状与 source id。
2. 新组件或领域模型实际打开页面，检查 course-ready/lk-ready/viz-ready/media-ready；总 ready 只表示处理结束，逐容器 failed 必须检查。
3. 至少改变一个输入，核对图形、数值、状态、reset/前后退与边界。键盘操作与 375px 窄屏无水平溢出；记录中保留原话和提示，观察记录不等于掌握。
4. 无脚本与打印时核心模型、任务、文字稿、步骤与核对点可读。导出需要另检查分页与裁切。

验收课件源在 assets/acceptance-course；`prepare_acceptance.py <空目标目录>` 生成完整可运行包。六类分别覆盖数学推导、概率联动、算法轨迹、模拟历史材料、设计图片标注、听辨媒体。听力使用原创英文句子的本地合成语音验证流程，不代表自然语音训练效果。专业媒体、复杂图布局和学科仿真仍按 extension 处理。
