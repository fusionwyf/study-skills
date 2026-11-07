# 课件设计（Lesson）

创建、修改课件组件，选择教学模式，或设计认知层级时读取本文件。视觉设计由 Token 驱动，机器契约与无脚本降级行为保持稳定。

## 一、页面结构与 Lesson 根节点契约

每节课采用 Course Kit v2 标准页面布局：

```html
<!doctype html>
<html lang="zh-CN" data-theme="course">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>第 0001 课｜课程标题</title>
  <link rel="stylesheet" href="../assets/kit/kit.css">
  <link rel="stylesheet" href="../assets/course/theme.css">
  <script defer src="../assets/kit/kit.js"></script>
</head>
<body class="kit-page">
  <div class="kit-main">
    <header class="course-header">
      <p class="course-kicker">第 0001 课 · 课程主题</p>
      <h1 class="course-title">本课学习成果</h1>
      <nav class="course-nav" aria-label="课程导航"><a href="../index.html">课程首页</a></nav>
      <div data-theme-switcher></div>
    </header>

    <main
      class="lesson"
      id="lesson-content"
      data-course-id="course-id"
      data-lesson-id="0001"
      data-objective="objective-id"
      data-evidence="practice"
      data-retrieval="required"
      data-feedback="required"
      data-source-status="not-needed"
      data-answer-status="provided">
      <!-- 课程章节内容 -->
    </main>
  </div>
  <aside class="kit-rail">
    <nav class="kit-toc" aria-label="本课目录" data-kit-toc></nav>
  </aside>
</body>
</html>
```

状态枚举：
- `data-retrieval="required|not-applicable"`
- `data-feedback="required|not-applicable"`
- `data-source-status="verified|not-needed|unverified"`
- `data-answer-status="provided|not-applicable"`

当状态为 `required` 或 `provided` 时，页面必须包含对应的 `data-role` 内容：`objective`、`evidence`、`retrieval`、`learner-feedback`、`sources`、`answer-feedback`。

**分章课程包的引用深度**：课件位于 `lessons/<章>/` 时比扁平包深一层，资产链接相应改为

```html
<link rel="stylesheet" href="../../assets/kit/kit.css">
<link rel="stylesheet" href="../../assets/course/theme.css">
<script defer src="../../assets/kit/kit.js"></script>
```

`theme.css`、`config.json`、`nav.json` 始终在课程包的 `assets/course/` 内（每门课一份，不随章拆分）；只有课件、records、reference 按章分子目录。课程首页链接为 `../../index.html`。运行时 `nav.json` 的地址由 `kit.js` 的 `src` 反推，不依赖字面 `../`，两种深度都能取到。

## 二、教学模式

根据本课的可验证学习成果选择主模式（详见下文教学模式与 Bloom 认知层级）：
- **概念理解**：预测具体情境 → 现象与反例 → 概念模型 → 易混对比 → 新情境验证。
- **定量推导**：直觉数值/图形 → 严格定义与前提 → 分步推导 → 同构练习 → 边界变式。
- **编程与操作**：目标产物 → 最小可工作示例 → 关键决策与排错 → 补全与修改 → 独立迁移。
- **人文材料分析**：材料呈现 → 区分事实/解释/判断 → 权衡证据 → 构造论证 → 局限说明。

## 三、HTML 核心组件契约

### 0. 双轨写法（Custom Elements 简写）

所有核心组件都有两套等价写法：标准语义 HTML（`class` + `data-*`）与 Light DOM 自定义元素简写（由 core 模块 `shell.elements` 在 kit.js 求值时同步归一化）。归一化把简洁属性映射为标准 `data-*` 结构，随后由各内容模块按本节契约接管；两套写法产出**完全相同的机器契约**，`validate_course.py` 双轨识别，动态插入的节点由 `connectedCallback` 自动升级并触发对应模块重新初始化。

| 简写 | 等价标准写法 | 归一化规则 |
|---|---|---|
| `<kit-question kind question-id max-attempts expected tolerance unit accepted>` | `<section class="question" data-role="evidence">`（§1） | 同名属性前加 `data-`；自动补 `class="question"` 与 `data-role="evidence"` |
| `<kit-callout type label fold>` | `<aside class="callout" data-callout data-fold>`（§5） | `type→data-callout`、`fold→data-fold`；`label` 生成 `.callout__title` |
| `<kit-viz kind id>` | `<section class="visualization" data-visualization>`（§7） | `kind→data-visualization`；自动补类名，缺 `id` 自动生成 |
| `<kit-predict question-id answer tolerance unit>` | `<kit-predict data-question-id data-answer data-tolerance data-unit>`（§10） | 同名属性前加 `data-`；自动补 `data-predict` |
| `<kit-param name min max step value unit label>` | `<kit-param data-param data-min data-max data-step data-value data-unit data-label>`（§11） | 同名属性前加 `data-` |
| `<kit-island id name>` | `<kit-island data-island>`（§12） | 缺 `id` 时用 `name` 回填；自动补 `data-island` |

- 归一化只映射外壳属性，**不生成内部结构**：题干、选项、提示、解析、`data-viz-fallback` 后备等子结构两套写法完全相同，仍须按各组件契约编写。
- 例：`<kit-question kind="choice" question-id="q1" max-attempts="2">…选项与解析…</kit-question>` 与 §1 的 `<section class="question" data-role="evidence" data-question-id="q1" data-kind="choice" data-max-attempts="2">` 完全等价。

### 1. 统一题目块（Question Component）

统一题目块替代旧版分散的 `.quiz`、`data-answer-*`、`teaching-target`、`dialogue-practice`。所有题型共用外壳、状态机、多级提示、反馈区与证据导出接口。作者只写语义标记，运行时生成交互控件。简写：`<kit-question kind="choice" question-id="q1" max-attempts="2">`（属性归一化见 §三.0 双轨写法）。

#### 六类题型作者契约：

1. **单选题 choice**
   ```html
   <section class="question" data-role="evidence" data-question-id="q1" data-kind="choice" data-max-attempts="2">
     <div data-stem><p>题干描述？</p></div>
     <ol data-options>
       <li data-option>选项 A 描述<span data-why>解释原因 A</span></li>
       <li data-option data-correct>选项 B 描述<span data-why>正确依据</span></li>
     </ol>
     <ol data-hints><li>提示 1</li><li>提示 2</li></ol>
     <div data-explain><p>解析内容</p></div>
   </section>
   ```

2. **多选题 multi**
   ```html
   <section class="question" data-role="evidence" data-question-id="q2" data-kind="multi" data-max-attempts="2">
     <div data-stem><p>多选干描述？</p></div>
     <ol data-options>
       <li data-option data-correct>正确选项 1<span data-why>原因 1</span></li>
       <li data-option>错误选项 2<span data-why>原因 2</span></li>
       <li data-option data-correct>正确选项 3<span data-why>原因 3</span></li>
     </ol>
     <div data-explain><p>解析内容</p></div>
   </section>
   ```

3. **数值题 numeric**
   ```html
   <section class="question" data-role="evidence" data-question-id="q3" data-kind="numeric" data-expected="3.5" data-tolerance="0.05" data-unit="m/s">
     <div data-stem><p>平均速度是多少？</p></div>
     <ol data-hints><li>公式为路程除以时间。</li></ol>
     <div data-explain><p>7 ÷ 2 = 3.5 m/s。</p></div>
   </section>
   ```

4. **填空题 fill**
   ```html
   <section class="question" data-role="evidence" data-question-id="q4" data-kind="fill" data-accepted='["牛顿第二定律","第二定律","F=ma"]'>
     <div data-stem><p>F = ma 是哪条定律？</p></div>
     <div data-explain><p>牛顿第二定律。</p></div>
   </section>
   ```

5. **开放纠错 open**
   ```html
   <section class="question" data-role="evidence" data-question-id="q5" data-kind="open">
     <div data-stem><p>模拟学生说：“……”，请纠正并给出反例。</p></div>
     <div data-key>
       <ul><li>要点 1</li><li>要点 2</li></ul>
     </div>
   </section>
   ```

6. **多轮对话 dialogue**
   ```html
   <section class="question" data-role="evidence" data-question-id="q6" data-kind="dialogue">
     <div data-stem><p>请回答三轮追问。</p></div>
     <ol data-turns>
       <li>第一轮追问：解释依据？</li>
       <li>第二轮追问：去掉一个条件给反例？</li>
       <li>第三轮追问：新场景下如何判断？</li>
     </ol>
   </section>
   ```

#### 判定与辅助行为规则：
- **三重视觉反馈**：颜色 + 符号（✓ / ✗ / 虚线框）+ 文字，满足无障碍对比度。
- **可观察辅助行为**：页面只客观记录用户在页内的辅助行为（点击提示记录为 `with_hints`；带 `data-guidance="ai_guided"` 的提示记录为 `ai_guided`；点击查看答案记录为 `answer_revealed`；未用页内提示记录为 `none (未在页内使用提示；外部辅助不可观测)`）。**严禁将未用提示自动断言为 `independent`**。独立性属于定稿评估（finalized evaluation），由 Agent 根据完整证据链或学习者自述在定稿记录中确认，严格遵守共享契约 `../shared/references/record-contract.md`。
- **揭示保护**：未答对时隐藏答案，达到 `data-max-attempts`（默认 2）后提供“查看答案”按钮。

### 2. 代码块（Code Block）

作者只写原生语义标记：
```html
<pre><code class="language-python">for i in range(len(a)-1):
    m = min(range(i, len(a)), key=lambda j: a[j])
    a[i], a[m] = a[m], a[i]</code></pre>
```
- 支持扩展属性：`data-title`、`data-lines`（高亮指定行）、`data-linenos`（显示行号）、`data-fold`（默认折叠）、`data-wrap`（自动换行）。
- 运行时由 Kit 块外壳接管：右上角语言徽章、悬停复制按钮、官方 highlight.js 主题自动适配浅色/深色，复制只复制纯文本。

### 3. 公式块（Math Block）

- 行内公式使用 `\(...\)`，独立展示公式使用 `\[...\]`。
- Display 公式由块外壳增强，提供溢出滚动与“复制 LaTeX”动作按钮。KaTeX auto-render 自动解析。

### 4. 浮动目录（Shell TOC）

- **三态响应**：≥1200px 侧栏（可折叠）、768–1199px 右下浮层（popover）、<768px 顶部标题栏 + 底部抽屉。
- **平滑跟踪**：rAF 节流 scrollspy，目录自滚动只改变目录容器 `scrollTop`，禁止整页异常跳动。
- **离线与无脚本后备**：`kit sync` 自动提取标题生成静态 `<nav class="kit-toc">` 后备，无脚本时直接可读。

### 5. 提示折叠（Callout）

```html
<aside class="callout" data-callout="tip" data-fold="open">
  <div class="callout__title">重点提示</div>
  <p>具体提示内容……</p>
</aside>
```

- `data-callout` 取值：`note`、`info`、`tip`、`warning`、`danger`。
- 标题元素是 `.callout__title`（**双下划线**，与 `callout.js`/`callout.css` 一致）。省略标题时运行时按类型自动注入中文名（注意/说明/提示/警告/危险）；写成 `.callout-title` 不会被识别，会同时出现两个标题。
- `data-fold="open|closed"` 控制折叠交互。
- 简写：`<kit-callout type="tip" label="重点提示" fold="open">`（见 §三.0 双轨写法）。

### 6. 分步推导（Step）与反思输入（Reflection）

分步展开用 `learning.step`：未展开的步骤用 **`class="step is-hidden"`**（不是 `hidden` 属性），推进按钮必须带 `data-step-next`，作用域由 `[data-steps-scope]` 或最近的 `section / .card / .lesson` 决定。

```html
<div class="steps" data-steps-scope>
  <div class="step is-hidden"><strong>步骤 1</strong><p>……</p></div>
  <div class="step is-hidden"><strong>步骤 2</strong><p>……</p></div>
  <div class="steps-controls"><button type="button" data-step-next>展开下一步</button></div>
</div>
```

`data-feedback="required"` 的正文反思框用 `.reflection`：`learning.records` 只收集 `<label for="X">` + 同页 `id="X"` 的输入框，其它写法（如裸 `textarea[data-feedback-input]`）不会进入学习记录。

```html
<section class="course-actions">
  <div class="reflection" data-role="learner-feedback">
    <label for="fb-1">哪里看懂了？</label>
    <textarea id="fb-1" rows="3"></textarea>
  </div>
  <!-- 学习记录只在点击时提交（不做后台自动同步）：
       serve 运行时点击即落盘 records/<NNNN>-feedback.md，同时复制到剪贴板。 -->
  <button type="button" data-submit-feedback>复制并提交学习记录</button>
  <span data-submit-feedback-status role="status"></span>
</section>
```

**反思提示语不得复述内容题**：反思区只问过程与体验——哪里卡住、卡住后做了什么、是否回看/外部辅助及在哪一步（独立性自述）、哪行输出最意外、分量与节奏是否合适。内容掌握度由 evidence 题与独立任务承担；把练习題再问一遍（如「把 nleft 序列再写一遍」）会让反馈变成第二份作业而被跳过（2026-11-07 第十章 0002 实测：反思区整块未填写，学习者明确要求改为反馈式）。

### 7. 数据可视化（Visualizations）

使用 `data-visualization="chart|spatial|relation|timeline|process|sequence|table"` 容器与 `data-viz-config` 配置。简写：`<kit-viz kind="chart" id="demo-chart">`（见 §三.0 双轨写法）。
```html
<section class="visualization" id="demo-chart" data-visualization="chart">
  <h2>图表标题</h2>
  <div data-viz-fallback><p>无脚本文字描述后备</p></div>
  <div class="viz-host" id="demo-chart-host" data-viz-host hidden></div>
  <p data-viz-status role="status"></p>
  <script type="application/json" data-viz-config>
    {
      "model": "demo-chart",
      "domain": "数值范围",
      "precision": "精度说明",
      "traces": [...]
    }
  </script>
</section>
```

### 8. 动效增强（Animation Component - L2）

声明式滚动与即时动效组件：
```html
<div data-animate="slideUp" data-animate-delay="0.2s">
  <p>内容进入视口时平滑滑入。</p>
</div>
```
- **预设**：`fadeIn`、`slideUp`、`bounce`。
- **配置属性**：`data-animate`（预设名称或动画名）、`data-animate-duration`（时长）、`data-animate-delay`（延迟）、`data-animate-easing`（缓动曲线）、`data-animate-trigger="immediate"`（即时播放）。
- **无障碍**：自动响应 `@media (prefers-reduced-motion: reduce)` 停用动效并展示静态内容。
- **开发扩展**：自定义扩展模块参考 `references/assets.md`。

### 9. 版式节奏：边注、破栏与引语

连续的圆角卡片和 callout 会造成单调的视觉流。用三个基础版式类制造节奏，它们是 `foundation/layout.css` 的标准能力，所有主题可用：

```html
<aside class="sidenote">宽屏（≥1200px）浮动到正文右侧的小号边注，放术语出处、
直觉补充或“为什么不是另一种解释”；窄屏自动折叠回正文流内的注记。</aside>

<div class="wide">
  <!-- 破栏容器：图表、大图、宽表格可超出 50rem 正文度量，扩展到整个内容区 -->
  <section class="visualization" ...>...</section>
</div>

<p class="pull-quote">大号引语：本课最希望学习者带走的那句关键判断。</p>
```

- **使用时机**：每个 `.sidenote` 承担一个“如果放进正文会打断主线”的旁支；每课至多 1–2 处 `.wide`（多则失去破栏效果）；`.pull-quote` 用于认知转折点，不用于装饰。
- **打印与无脚本**：`.wide` 与 `.sidenote` 在打印样式与窄屏下自动回到常规文档流，无需作者处理。

### 10. 先预测后揭晓（Predict Component）

`learning.predict`（auto，自动打包）让学习者先承诺一个预测再揭晓真相，自动产出 ATTEMPT + RAW_ANSWER（+ 数值判定 VERDICT）证据。两种等价写法：

```html
<!-- 语义写法 -->
<kit-predict data-question-id="p1" data-answer="9.8" data-tolerance="0.5" data-unit="m/s">
  <div data-predict-prompt><p>先猜：下落 1 秒后的速度大约是多少？</p></div>
  <div data-reveal><p>真实值约 9.8 m/s²，因为重力加速度……（也是无脚本后备）</p></div>
</kit-predict>

<!-- 元素简写 -->
<kit-predict question-id="p1" answer="9.8" tolerance="0.5" unit="m/s">…</kit-predict>
```

- `data-answer` 为数值时自动判定：容差 `data-tolerance`（缺省真实值 10% 相对容差），揭晓后显示偏差条与"你的预测 vs 真实值"。
- 无 `data-answer` 时是开放预测：只记录原文，不判对错。
- **`data-reveal` 在 HTML 源码中必须可见可读**（无脚本/打印后备）；运行时增强后才隐藏，揭晓时展示。
- 使用时机：概念课的"先直觉后机制"、定量课的"先估值后推导"、每个反直觉事实之前。

### 11. 参数联动（Param Component）

`learning.param`（auto）是行内可拖动参数：滑块 + 可横向拖曳的数值（scrubbable number），所有参数进入 `lesson.__paramStore`，正文用 `<output data-param-out="...">` 联动显示。

```html
<p>质量 <kit-param data-param="mass" data-min="0.5" data-max="5" data-step="0.1"
   data-value="1" data-unit="kg" data-label="质量"></kit-param>，
   动能 E<sub>k</sub> = ½mv² = <output data-param-out="ke">0.5</output> J。</p>
```

- 当前值写入 `data-param-value`，`learning.records` 汇总为"参数探索"证据。
- 与 `viz.island` / LearnKit 探索容器组合时，多个 `kit-param` 共享同一参数存储，双店同步。
- 使用时机：任何"改变一个量、观察结果如何变"的联动；参数 ≤ 3 个，过多改用 island 或扩展模型。

### 12. 交互仿真孤岛（Island Component）

`viz.island`（auto）承载免构建学科仿真（单摆、内存布局、梯度下降动画……），底层直接挂在 LearnKit store 上，自带时间旅行、播放/暂停、步进、速度与重置控制。

```html
<kit-island id="pendulum">
  <h3>单摆仿真</h3>
  <div data-viz-fallback><p>无脚本说明：小角度单摆 T ≈ 2π√(L/g)，L=1m 时约 2.0s。</p></div>
  <div data-island-host hidden></div>
  <div data-island-controls hidden></div>
  <script type="text/plain" data-island-model>
    kit.island.define("pendulum", {
      initialState: function () { return { t: 0, theta: 0.6, omega: 0 }; },
      tick: function (s) {
        var dt = 0.05, alpha = -9.8 * s.theta;
        return { t: s.t + dt, theta: s.theta + s.omega * dt, omega: s.omega + alpha * dt };
      },
      actions: { push: { label: "推一下", reduce: function (s) { return Object.assign({}, s, { omega: s.omega + 0.8 }); } } },
      derive: function (s) { return { summary: "t = " + s.t.toFixed(2) + " s" }; },
      view: function (s, api) {
        return api.html`<p>θ = ${s.theta.toFixed(2)} rad，t = ${s.t.toFixed(2)} s</p>`;
      }
    });
  </script>
</kit-island>
```

- **契约**：`tick`/`reduce` 必须返回**新状态对象**（不可原地修改）；`view` 返回 HTML 字符串，插值默认转义，需要原始 HTML 用 `api.raw()`；自定义动作按钮由 `actions` 自动渲染。
- **`data-viz-fallback` 必须存在且可见**（无脚本/打印后备），校验器强制。
- 模型代码放在 `type="text/plain"` 脚本中由运行时编译（与页面脚本同一信任级）；也可在普通 `<script>` 里直接 `kit.island.define(...)`。
- 当前状态写入 `data-visual-state`，进入学习记录的"仿真孤岛观察"。
- 使用时机：连续演化 + 需要回放对比的动力学系统；一次性静态演示用普通可视化即可。

## 十三、教学表达：可视化与交互优先

先选学习动作，再选组件。写一个可视化/交互之前，先回答三个问题：

1. 学生要改变/观察哪个量？
2. 哪个量保持不变，才能看出因果关系？
3. 学生做完动作后，能说出什么判断？

| 内容特征 | 首选表达 | 学生动作 | 证据 |
|---|---|---|---|
| 连续演化、状态随时间变化 | `kit-island` | 播放/步进/回放/改参数 | 仿真观察 |
| 参数关系、权衡 | `kit-param` + `<output>` 或 `viz` | 拖动参数、预测曲线/数值 | 参数探索 |
| 反直觉事实 | `kit-predict` | 先写预测，再揭晓 | 预测原文 |
| 流程/状态机/时序 | Mermaid + `learning.step` | 逐步展开、复述 | 复述/题 |
| 数据/几何 | `viz.kinds.chart` / `plot` / `spatial`（opt-in） | 读图、比较、变换 | 题/解释 |
| 纯概念/术语 | Mermaid + 对比表 + 检索题 | 分类、举例、复述 | 题 |

规则：

- 每课至少一个学生动作；纯文本主题用 Mermaid + 分步推导 + 检索题，并在 `PLAN.md` 说明原因。
- 可视化必须回答「变什么、不变什么、该看出什么」；不服务判断的动画一律删掉。
- 仿真必须能暂停、步进、回放；参数必须改变一个可见量；不要自动循环且无法暂停。
- 先预测再解释：反直觉事实用 `<kit-predict>`，不要先讲答案再问。
- Mermaid 能表达的流程/状态图不要手写 SVG；数据/几何用 viz kinds，不用手写 Canvas。
- 每个可视化必须有 `data-viz-fallback`、无脚本/打印可读、`prefers-reduced-motion` 处理、窄屏检查。
- 可视化放 `.wide`，不要塞进窄卡片；一课最多 1–2 个 `.wide`。
- 交互要接入 evidence：预测原文、参数探索、仿真观察都会进入学习记录；静态图不会。
- 选择最小组件：静态 Mermaid 更清楚时不要动画；不要为了「看起来高级」上重型 viz。

反模式：

- 只放一张静态图，没有学生动作。
- 滑块拖了但图/数值不变。
- 动画自动播放、不能暂停，或只是装饰。
- 可视化没有文字后备/屏幕阅读器说明。
- 用动画替代必要的定义、公式或边界条件。

## 四、Bloom 认知层级

- `remember`：列出、识别、回忆。
- `understand`：解释、举例、分类。
- `apply`：使用、计算、执行。
- `analyze`：拆分、诊断、比较因果关系。
- `evaluate`：依据明确标准权衡决策并说明局限。
- `create`：在新情境中设计完整方案或产物。
