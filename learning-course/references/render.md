# 渲染与可视化（LearnKit）

当课程包含公式、图表、交互或任何需要运行时渲染的组件时读取本文件。

LearnKit 把课程页面拆成四层：L1 运行时、L2 基础 UI、L3 可视化与交互、L4 教学模板。Agent 只生成声明式 `LessonSpec` 和受约束的模型注册；运行时创建 HTML、绑定控件、保存历史并提供无脚本后备。

主数据流是单向的：

```text
LessonSpec / DOM 标记 → L1 运行时解析 → 模型(registerModel) → derive 派生值
                                ↓
                    注册表分发 → renderer(可选节点渲染) / adapter(chart·spatial·…) → DOM
```

数学公式不在这条管线里：它由页面直接引入的 KaTeX auto-render 处理，见第二节。

两个内置注册表加一个可选钩子：L1 运行时的 `registerModel` 管模型逻辑、`registerRenderer` 是留给扩展的节点渲染钩子（当前无内置实现），L3 适配器层的 `registerKind` 管可视化适配器（图表、几何等）。扩展只新增注册项，不修改核心运行时。

## 一、LessonSpec

```js
const lesson = {
  version: "1.0",
  title: "探索一个系统如何变化",
  sections: [
    { id: "intro", type: "explain", title: "基本概念", blocks: [
      { type: "concept-card", title: "初始状态", content: "系统从给定条件开始。" }
    ] },
    { id: "explore", type: "explore", title: "交互实验", model: "example-model",
      controls: [{ type: "slider", label: "参数", bind: "params.value", min: 0, max: 100, step: 1 }],
      views: [{ type: "chart", source: "derived.chartData" }, { type: "property-table", source: "derived.properties" }] },
    { id: "check", type: "practice", title: "检查理解", exercise: {
      type: "single-choice", prompt: "改变参数后，哪个状态会发生变化？", options: ["A", "B", "C"], answer: 1,
      explanation: "根据状态更新规则，B 会变化。"
    } }
  ]
};
```

`version`、`title` 和每个 section 的 `id/type/title` 是必填项。section 类型是 `explain`、`sequence`、`explore`、`construct`、`compare`、`predict`、`practice`。配置只描述内容、绑定和数据；模型逻辑通过 `LearnKit.registerModel(name, {initialState, reduce, derive})` 提供。

### 标准模式和动作

- `sequence`：步骤、推导、事件或执行轨迹；共享播放、前后退、跳转和历史。
- `explore`：参数变化驱动图表、表格和说明；每个可操作参数都必须改变可见结果。
- `construct`：拖动或排列对象；模型检查约束并生成反馈。
- `compare`：共享输入条件，展示两个方案的差异和变化摘要。
- `predict`：先提交预测，再运行或揭示结果，最后解释偏差；可以嵌入其他模式。

核心动作是 `PLAY`、`PAUSE`、`STEP_NEXT`、`STEP_PREVIOUS`、`SEEK`、`RESET`、`SET_PARAMETER`、`SELECT_OBJECT`、`MOVE_OBJECT`、`SUBMIT_ANSWER`。播放速度只影响展示定时器，不修改模型计算。

### 组件分层

L2 负责布局、文字、公式、代码、输入和反馈；L3 负责 `ChartView`、`RelationGraph`、`TimelineView`、`ProcessDiagram`、`SpatialCanvas`、`SimulationStage`、`TableView`、`SequenceView`、`HierarchyView` 和观察面板；L4 将它们组合成概念讲解、分步推导、交互实验、案例比较和练习模板。领域适配器只新增模型和图元契约，不复制状态、事件、历史和证据记录。

公共属性可使用 `id`、`title`、`description`、`data`、`bind`、`actions`、`disabled`、`visible`、`className`。组件没有意义的属性应省略。视图、控件和模型通过状态订阅连接，避免组件互相查询 DOM。

## 二、数学渲染

公式用 KaTeX：课程页面从 CDN 引入 KaTeX 与它的 auto-render 插件，公式直接写成 LaTeX 定界符，插件扫描全文渲染。不需要注册 LearnKit renderer，也不需要逐条标注公式。

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function () {
  if (!window.renderMathInElement) return;
  renderMathInElement(document.body, {
    delimiters: [
      {left: "\\(", right: "\\)", display: false},
      {left: "\\[", right: "\\]", display: true}
    ],
    throwOnError: false
  });
});
</script>
```

公式直接写在正文里：

```html
行内写法：设 \(f\) 在 \(P_0\) 处可微，则方向的坡度是 \(D_{\mathbf{u}} f(P_0)\)。

展示写法：
\[
D_{\mathbf{u}} f(P_0) = \nabla f(P_0) \cdot \mathbf{u}
\]
```

`throwOnError: false` 让单个公式出错时不中断整页；公式语法错误退化为可读的原文。auto-render 找不到 KaTeX（离线、CDN 被拦）时页面保留 LaTeX 源码，正文其余部分不受影响，因此公式旁仍应有一句文字说明符号含义和成立条件。

课程包默认不加本地 KaTeX 资源。需要完全离线时，把同版本 KaTeX 放进包内 `assets/vendor/katex/`，并把上面三处 CDN 地址改为本地相对路径；两条路径都只改引入方式，公式写法不变。

## 三、可视化适配器

核心运行时只管理状态、动作、历史和记录，适配器负责把同一份模型数据呈现为图表、关系图、时间轴、流程、空间画布或步骤回放。学科扩展应登记数据契约并调用 `registerKind()`，不把某一门课的计算逻辑写进核心渲染器。

### 选择表达方式

| 学习问题 | 适配器 | 最小数据 |
|---|---|---|
| 数值变化、实验测量、函数、分布 | `chart` | `traces` |
| 概念、网络、调控、依赖 | `relation` | `nodes`、可选 `edges` |
| 历史、实验过程、执行轨迹 | `timeline` | `events` |
| 流程、状态机、决策树 | `process` | `nodes`、可选 `edges` |
| 几何、结构、空间关系 | `spatial` | `matrix + vector` 或 `shapes` |
| 推导、操作、算法步骤 | `sequence` | `steps` |
| 结构化证据或结果 | `table` | `columns`、`rows` |
| 学科模拟器 | `simulation` | 由扩展适配器声明 |

### 容器契约

每个可视化容器都需要唯一 `id`、`data-visualization`、JSON 配置、可读后备和状态区：

```html
<section class="visualization" id="population-chart" data-visualization="chart">
  <h2>样本量如何改变分布</h2>
  <div class="viz-fallback" data-viz-fallback>
    <p>模型：正态分布采样。范围：样本量 10–1000。精度：固定随机种子，显示经验频率。</p>
    <p>核对点：均值接近 0，样本量增大时抽样波动减小。</p>
  </div>
  <div class="viz-host" id="population-chart-host" data-viz-host hidden></div>
  <p class="viz-status" data-viz-status role="status"></p>
  <script type="application/json" data-viz-config>{
    "model": "normal-sample",
    "domain": "sample size 10..1000",
    "precision": "seeded sample; histogram bins fixed",
    "traces": [{"type": "scatter", "x": [10, 20], "y": [0.2, 0.15]}]
  }</script>
</section>
```

配置只承载数据。不要放可执行表达式、函数体或 `eval` 字符串。模型计算应在页面脚本中以受约束的注册模型提供，或者在生成阶段预计算成 JSON。

### 适配器生命周期

扩展适配器实现 `validate(config)` 和 `render(node, config)`，需要动态模型时再提供 `update(state, derived)`、`select(target)`、`destroy()`。渲染器应：

1. 初始化时核对数据形状、有限数值、定义域、单位和假设。
2. 用真实状态更新图形，同时把当前参数、步骤或选中对象写入 `data-visual-state`。
3. 用 `data-viz-status` 报告可读的当前状态，颜色和动画只做辅助。
4. 在没有脚本、第三方库缺失、WebGL 不可用或配置错误时保留 fallback，不显示空白舞台。
5. 为键盘、窄屏、打印和 `prefers-reduced-motion` 提供降级路径。

内置 `chart` 优先使用本地 Plotly；未加载 Plotly 时使用无依赖 SVG。`spatial` 在 JSXGraph 可用时提供可拖动向量，否则保留结构说明。`relation`、`timeline`、`process`、`sequence` 和 `table` 使用 HTML，可独立打开 HTML 文件。

`sequence` 的控件使用一个带 label 的 range、上一项和下一项按钮；`spatial` 的数字输入必须可键盘编辑并限制在有限范围。播放、单步、暂停、重置属于通用 LearnKit 动作，适配器不各自复制一套状态机。

可视化只是探索工具，不自动证明掌握。课件仍应安排预测、解释、反例、无辅助变式或独立产物，并把可视化当前状态作为观察记录导出，而不是直接写成 mastery。数学、统计和算法内容还必须核对定义域、采样步长、比例、不变量和边界值。有限采样或透视图不能替代证明；算法回放来自真实执行状态，不能把观看回放当作实现能力。

## 四、代码着色与主题

这两个能力**不在默认课程包里**。默认包只带 `course.css` 的中性基线和 LearnKit 运行时；需要时用安装脚本按需复制。

```text
python scripts/install_optional.py <course-dir> --components code-highlight theme
```

组件目录是 `assets/optional/<name>/`，每个都带 README 说明接线方式、可改的 token 和降级行为。装之前不要在课件里引用。

### 代码着色

代码块默认只有等宽字体和底色，**没有任何 token 着色**。需要着色时装 `code-highlight`：它从 CDN 引入 highlight.js 11.12.0 的默认构建（约 126KB，内置 36 种语言，含 C、Python、bash、SQL、Rust、Go、Java），一行 `highlightAll()` 扫描全文的 `.code-block pre code`。

语言取自 `.code-language` 标签或 `code` 的 `language-*` class，常见别名会自动归一。**不在内置清单里的语言退化为不着色原文，不会发额外请求**。完全离线时把同版本引擎放进包内并先用 `window.hljs` 注册，组件检测到就不会联网。

换配色有两条路：改 `.code-block` 的 `--code-token-*` 变量（跟着课程主题走），或在本组件样式之后引入 highlight.js 官方主题（516 套）。细节见 `assets/optional/code-highlight/README.md`。

### 主题

`course.css` 里所有视觉决策都是 `--course-*` token。装 `theme` 组件后，这些 token 变成可整体覆盖的换肤层，**组件类名和 `data-*` 契约完全不动**：

```css
[data-theme="warm"] {
  --course-bg: #fbf7f2;  --course-text: #2c2118;
  --course-accent: #b45309;  --course-radius: 0.25rem;
}
```

本组件**不提供任何配色方案**——主题就是课程自己的 CSS。要给代码块声明明暗表面时在 `<html>` 上加 `data-theme-surface="light"`。需要切换器时提供 `window.COURSE_THEMES` 列表和 `<div data-theme-switch>`；只有一个主题时不生成切换器。不起脚本、只写死 `<html data-theme="...">` 也能换肤。

完整 token 清单、切换器配置和降级行为见 `assets/optional/theme/README.md`。

## 五、生成检查与验证

生成前先选一个可验证学习成果和一个主模式；生成后检查：

- 每个控件都有标准动作，且能更新至少一个可见结果。
- 播放可暂停，步骤可后退或跳转，所有实验可重置。
- 颜色、线型、符号和动画都有文字图例；减少动画后仍可理解。
- 公式、代码、图形、表格和说明使用同一变量名、单位和状态编号。
- 输入有边界和错误反馈；配置错误显示信息并保留 fallback。
- 页面在键盘、窄屏、打印和脚本失败时仍可读。
- 可视化状态只作为观察记录；掌握必须来自题目、解释、作品或迁移任务。

验证入口：

```text
python scripts/install_optional.py <course-dir> --components chart spatial
python scripts/build_index.py <course-dir>
python scripts/validate_course.py <course-dir> --strict-schema --pedagogical
```

- `LearnKit.validateLessonSpec(spec)` 校验页面结构。
- `assets/visualizations/adapters.json` 是适配器目录的单一来源，`scripts/validate_course.py` 用它与 `learnkit.js` 注册表检查容器契约。完整示例见 `assets/visualizations/demo.html`。
- 打印或导出前等待 `document.fonts.ready` 与 `window.__COURSE_VISUALIZATIONS_READY__ === true`，然后检查每个容器的 `data-viz-ready="true"`；失败时以 fallback 作为可读结果。KaTeX 公式会在 `DOMContentLoaded` 后的同步扫描中渲染完，等待字体就绪即可覆盖。装了代码着色时可选等待 `window.__COURSE_CODE_HIGHLIGHT_READY__`；为 `false` 说明 CDN 不可达，此时按无色原文打印即可。
