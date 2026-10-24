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
<link rel="stylesheet" href="../assets/course/theme.css">
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

### 1. 统一题目块（Question Component）

统一题目块替代旧版分散的 `.quiz`、`data-answer-*`、`teaching-target`、`dialogue-practice`。所有题型共用外壳、状态机、多级提示、反馈区与证据导出接口。作者只写语义标记，运行时生成交互控件。

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

### 6. 分步推导（Step）与反思输入（Reflection）

分步展开用 `learning.step`：未展开的步骤用 **`class="step is-hidden"`**（不是 `hidden` 属性），推进按钮必须带 `data-step-next`，作用域由 `[data-steps-scope]` 或最近的 `section / .card / .lesson` 决定。

```html
<div class="steps" data-steps-scope>
  <div class="step is-hidden"><strong>步骤 1</strong><p>……</p></div>
  <div class="step is-hidden"><strong>步骤 2</strong><p>……</p></div>
  <div class="steps-controls"><button type="button" data-step-next>展开下一步</button></div>
</div>
```

`data-feedback="required"` 的正文反思框用 `.reflection`：`learning.records` 只收集 `<label for="X">` + 同页 `id="X"` 的输入框，其它写法（如裸 `textarea[data-feedback-input]`）不会进入复制的学习记录。

```html
<section class="course-actions">
  <div class="reflection">
    <label for="fb-1">哪里看懂了？</label>
    <textarea id="fb-1" rows="3"></textarea>
  </div>
  <button type="button" data-copy-feedback>复制学习记录</button>
  <span data-copy-feedback-status role="status"></span>
</section>
```

### 7. 数据可视化（Visualizations）

使用 `data-visualization="chart|spatial|relation|timeline|process|sequence|table"` 容器与 `data-viz-config` 配置。
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

## 四、Bloom 认知层级

- `remember`：列出、识别、回忆。
- `understand`：解释、举例、分类。
- `apply`：使用、计算、执行。
- `analyze`：拆分、诊断、比较因果关系。
- `evaluate`：依据明确标准权衡决策并说明局限。
- `create`：在新情境中设计完整方案或产物。
