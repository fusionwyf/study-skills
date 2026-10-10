# 渲染与可视化（LearnKit）

当课程包含公式、图表、交互或任何需要运行时渲染的组件时读取本文件。

制作入口是 **HTML + 稳定的 data-* 契约**。Agent 编写正文和后备，运行时绑定控件、状态与记录；它不会从 LessonSpec 自动生成完整页面。

职责与交付方式分别记录在 `assets/catalog.json`：common 管基础交互与证据，rendering 管通用呈现，specialized 管领域模型。default/optional/external/extension 说明如何交付。选资源与扩展流程见 `assets.md`。

遵守 assets.md 的第三方库优先策略：代码与公式默认开启成熟渲染引擎，复杂图形先选择现成库再接入课程模型。允许固定版本 CDN；课程主题在 assets/theme.css 自定义，官方高亮主题和数学选项在 assets/theme.js 配置。

数据流：页面 HTML/JSON → `registerModel` 的 reduce/derive → 状态订阅 → 通用 view/可视化 adapter → DOM。数学公式单独由 KaTeX auto-render 处理。

LearnKit 的 `registerModel` 管领域模型；`registerRenderer` 是专用 stage 的渲染钩子；CourseVisualizations 的 `registerKind` 管图形适配器。扩展放在课程 `assets/extensions/`，登记课程 registry 与 module，按依赖顺序加载。

## 一、LessonSpec 与实际页面

LessonSpec 只描述规划结构、校验 section id/type/title。`blocks` 如需保存片段，使用 `{type:"html", content:"..."}`；运行时不注入它。`concept-card`、`multiple-choice` 等尚未实现的声明式 block 会被拒绝。对应课件可以使用 `lesson.md` 的静态 HTML 契约。

动态容器写 `data-learnkit="explore|sequence|construct|compare|predict"` 与 `data-lk-config`；模型通过 `LearnKit.registerModel(name, {initialState, reduce, derive})` 提供，在 LearnKit 脚本之后、初始化之前注册。完整的概率联动示例见 `assets/acceptance-course/lessons/0002-probability.html`。

### 标准模式和动作

- `sequence`：步骤、推导、事件或执行轨迹；共享播放、前后退、跳转和历史。
- `explore`：参数变化驱动图表、表格和说明；每个可操作参数都必须改变可见结果。
- `construct`：拖动或排列对象；模型检查约束并生成反馈。
- `compare`：共享输入条件，展示两个方案的差异和变化摘要。
- `predict`：先提交预测，再运行或揭示结果，最后解释偏差；可以嵌入其他模式。

核心动作是 `PLAY`、`PAUSE`、`STEP_NEXT`、`STEP_PREVIOUS`、`SEEK`、`RESET`、`SET_PARAMETER`、`SELECT_OBJECT`、`MOVE_OBJECT`、`SUBMIT_ANSWER`。播放速度只影响展示定时器，不修改模型计算。

### 组件分层

静态 HTML 与 course.js 负责布局、文字、回答和证据；LearnKit 管状态；visualizations 的已实现 kind 管视图。simulation/hierarchy 是扩展槽位，使用前需要实际实现。领域模型提供数据，不复制历史与证据运行时。

HTML 属性与 JSON 字段按组件契约和最小用例编写；当前没有统一的 props → 页面渲染接口。视图、控件和模型通过状态订阅连接。

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

可视化适配器分两层，界线是「是否随课程内容决定」：

| 层 | 内容 | 来源 | 课程要做什么 |
|---|---|---|---|
| 默认 | 内核、`relation`、`timeline`、`process`、`sequence`、`table` | `init_course.py` 随默认包复制 | 按模板加载用到的模块 |
| 随内容决定 | `chart`、`spatial` | `install_optional.py` 按需安装 | 需要时装，然后加一支 script |

内核 `assets/visualizations/visualizations.js` 只管注册表、生命周期、容器接线和后备路径，**自己不渲染任何东西**。每个 kind 在自己的模块里：
`kinds/list.js`（关系/流程的 SVG 节点边及带日期的 HTML 时间轴）、`kinds/sequence.js`、`kinds/table.js`、`kinds/chart.js`、`kinds/spatial.js`。这样拆是因为 `chart` 要 4.7 MB 的 Plotly、`spatial` 要 JSXGraph，而另外五个是纯 HTML/SVG——合成一个文件会逼每门课都背上那两个重依赖。

加载顺序：内核在前，用到的 kind 模块在后。`chart` 和 `spatial` 模块会从同一课程包的 `visualizations/vendor/` 自动加载已校验的本地依赖；没有 `data-visualization` 容器的页面不会创建可视化实例。

### 选择表达方式

| 学习问题 | 适配器 | 最小数据 | 层 |
|---|---|---|---|
| 数值变化、实验测量、函数、分布 | `chart` | `traces` | 可选 |
| 概念、网络、调控、依赖 | `relation` | `nodes`、可选 `edges` | 通用 |
| 历史、实验过程、执行轨迹 | `timeline` | `events` | 通用 |
| 流程、状态机、决策树 | `process` | `nodes`、可选 `edges` | 通用 |
| 几何、结构、空间关系 | `spatial` | `matrix + vector` 或 `shapes` | 可选 |
| 推导、操作、算法步骤 | `sequence` | `steps` 或 `input` | 通用 |
| 结构化证据或结果 | `table` | `columns`、`rows` | 通用 |
| 学科模拟器 | `simulation` | 由扩展适配器声明 | 扩展 |

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

扩展适配器实现 `validate(config)` 和 `render(node, config, context)`，需要动态模型时返回 `update` / `destroy`，或在注册项上提供 `update`。容器声明 `data-viz-source="#learnkit-id"` 后，内核会把同一个 LearnKit store 的 snapshot 传给适配器。内置 chart/spatial/table/relation/process/timeline 从 `snapshot.derived.visualizations[容器 id]` 读取配置覆盖项，单视图也可用 `derived.visualization`；sequence 读取 `derived.index` 并限制到步骤范围。图表 update 使用 Plotly.react 或 SVG 重绘。绑定 sourceStore 的 spatial 向模型发送 SET_PARAMETER，参数名为 config.vectorParameter（默认 vector），领域模型需要处理该二维数组。声明状态源而适配器不支持 update 时明确失败。

例如概率模型返回 `derived.visualizations["probability-chart"] = {traces:[{type:"bar",x:["成功","失败"],y:[p,1-p]}]}`。同一横轴使用数值或分类之一；bar 接受分类字符串。graph edges 的 from/to 必须引用唯一节点 id。timeline 的 date 始终显示，事件顺序由生成的数据决定。渲染器应：

1. 初始化时核对数据形状、有限数值、定义域、单位和假设。
2. 用真实状态更新图形，同时把当前参数、步骤或选中对象写入 `data-visual-state`。
3. 用 `data-viz-status` 报告可读的当前状态，颜色和动画只做辅助。
4. 在没有脚本、第三方库缺失、WebGL 不可用或配置错误时保留 fallback，不显示空白舞台。
5. 为键盘、窄屏、打印和 `prefers-reduced-motion` 提供降级路径。

内置 `chart` 优先使用本地 Plotly；未加载 Plotly 时使用无依赖 SVG。`spatial` 在 JSXGraph 可用时提供可拖动向量，否则**列出 A、v 与 Av 供手工核对**，不留空白舞台。`relation`、`timeline`、`process`、`sequence` 和 `table` 使用 HTML，可独立打开 HTML 文件。

`sequence` 的控件使用一个带 label 的 range、上一项和下一项按钮；`spatial` 的数字输入必须可键盘编辑并限制在有限范围。播放、单步、暂停、重置属于通用 LearnKit 动作，适配器不各自复制一套状态机。

可视化只是探索工具，不自动证明掌握。课件仍应安排预测、解释、反例、无辅助变式或独立产物，并把可视化当前状态作为观察记录导出，而不是直接写成 mastery。数学、统计和算法内容还必须核对定义域、采样步长、比例、不变量和边界值。有限采样或透视图不能替代证明；算法回放来自真实执行状态，不能把观看回放当作实现能力。

## 四、代码着色与主题

代码着色和主题切换器**不在默认课程包里**。默认包只带 `course.css` 的中性基线、LearnKit 运行时和上面第一节说的通用可视化层；这两个需要时用安装脚本按需复制。

```text
python scripts/install_optional.py <course-dir> --components code-highlight theme
```

组件目录是 `assets/optional/<name>/`，每个都带 README 说明接线方式、可改的 token 和降级行为。装之前不要在课件里引用。

同理，`chart` 与 `spatial` 属于「随课程内容决定」的可选可视化 kind，也要显式安装；装完记得在页面里补上各自的 kinds 模块 script 标签。模块会自动接线同包 vendor，不需要再手工写 Plotly / JSXGraph 的 script 标签。

```text
python scripts/install_optional.py <course-dir> --components chart spatial
```

### 代码着色

含代码的课件默认加载 `code-highlight`：新课程初始化已安装适配层，它从 CDN 引入 highlight.js 11.12.0 的默认构建（约 126KB），扫描 `.code-block pre code` 并生成真正的 token 着色。已有课程先补装组件。课程没有代码时省略高亮脚本。

**配色直接用 CDN 官方主题，不手写色表**。引擎与主题均固定为 11.12.0，组件按课程表面自动挑选：

| 课程表面 | 官方主题 |
|---|---|
| `data-theme-surface="light"` | `github.min.css` |
| 其它 / 未声明且系统为深色 | `github-dark.min.css` |

官方主题的 token 颜色与课程的代码容器分开。agent 在课程 `assets/theme.css` 设定底色和布局，在课程 `assets/theme.js` 用 `COURSE_CODE_THEMES` 选择官方主题名或固定版本 URL；theme 切换器通过 `course:themechange` 联动。选择的新主题也应搭配合适的代码底色，实际检查对比度。

语言取自 `.code-language` 标签或 `code` 的 `language-*` class。组件不维护语言表，直接问引擎 `hljs.getLanguage()`；**它不认识的语言退化为不着色原文，不发额外请求，也不会被猜成别的语言**。完全离线时把同版本引擎放进包内并先用 `window.hljs` 注册即可。

细节见 `assets/optional/code-highlight/README.md`。

### 主题

新课程自带可编辑的 `assets/theme.css` 与 `assets/theme.js`，初始化时安装 theme 切换器。course.css 保留共享基线，课程 CSS 最后加载；创建时按学习者的视觉要求定制，续课保持一致：

```css
[data-theme="warm"] {
  --course-bg: #fbf7f2;  --course-text: #2c2118;
  --course-accent: #b45309;  --course-radius: 0.25rem;
}
```

共享切换器不包含课程配色；课程模板给出 course/ink 两套起始主题，agent 可替换。`assets/theme.js` 提供 COURSE_THEMES、COURSE_CODE_THEMES、COURSE_MATH_OPTIONS；页面 head 加载它，正文提供 `<div data-theme-switch>`。只有一个主题时不生成切换器。静态页面写 `<html data-theme="course" data-theme-surface="light">` 后也可应用主题。

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

- `LearnKit.validateLessonSpec(spec)` 只校验规划结构。交付前检查页面实际 ready 标记、操作结果与学习记录，结构校验不能替代运行验证。
- `assets/catalog.json` 是能力、文件和交付方式的权威来源；`scripts/sync_asset_catalog.py` 生成兼容登记表。`assets/visualizations/adapters.json` 是课程运行时的适配器投影，每个条目用 `tier`（`universal`/`optional`）标明它属于哪一层、用 `module` 标明实现在哪个文件；`scripts/validate_course.py` 用它检查容器契约。完整示例见 `assets/visualizations/demo.html`。
- 打印或导出前等待 `document.fonts.ready` 与 `window.__COURSE_VISUALIZATIONS_READY__ === true`，然后检查每个容器的 `data-viz-ready="true"`；失败时以 fallback 作为可读结果。使用公式时检查 `.katex` 已生成且无 `.katex-error`；使用代码高亮时检查 `window.__COURSE_CODE_HIGHLIGHT_READY__ === true`，并确认官方主题已加载、token 实际着色。主题切换后也需等待新样式生效。CDN 加载失败时按公式或代码原文交付可读降级，并在验证记录中区分“正常渲染通过”与“降级通过”。
