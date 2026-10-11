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

## 二、教学模式

根据本课的可验证学习成果选择主模式（详见 `architecture.md` 与 Bloom 认知层级）：
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
- **自动辅助判定**：取消自述下拉控件。点击提示自动记录 `with_hints`；带 `data-guidance="ai_guided"` 的提示记录为 `ai_guided`；未用提示且答对记录为 `independent`。记录输出保持逐字节等价性。
- **揭示保护**：未答对时隐藏答案，达到 `data-max-attempts`（默认 2）后提供“查看答案”按钮。

#### ⚠️ 旧写法废弃与迁移说明（将在 v2.3.0 移除）：
- 旧版 `.quiz` 提交模式 ➔ 迁移为 `data-kind="choice"`
- 旧版 `[data-answer-input]` / `[data-answer-check]` ➔ 迁移为 `data-kind="numeric"` 或 `data-kind="fill"`
- 旧版 `[data-role~="teaching-target"]` ➔ 迁移为 `data-kind="open"`
- 旧版 `[data-role~="dialogue-practice"]` ➔ 迁移为 `data-kind="dialogue"`
- 旧版 `<select data-independence>` ➔ 移除自述下拉，已改为提示按钮自动判定
- 自动迁移：运行 `python kit/build/migrate_questions.py <course-dir> --apply`。详细策略见 `docs/compatibility.md`。

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

遵循 Obsidian 语法：
```html
<aside class="callout" data-callout="tip" data-fold="open">
  <p class="callout-title">重点提示</p>
  <p>具体提示内容……</p>
</aside>
```
支持 `note`、`tip`、`warning`、`important` 等语义类型及折叠交互。

### 6. 数据可视化（Visualizations）

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

### 7. 动效增强（Animation Component - L2）

声明式滚动与即时动效组件：
```html
<div data-animate="slideUp" data-animate-delay="0.2s">
  <p>内容进入视口时平滑滑入。</p>
</div>
```
- **预设**：`fadeIn`、`slideUp`、`bounce`。
- **配置属性**：`data-animate`（预设名称或动画名）、`data-animate-duration`（时长）、`data-animate-delay`（延迟）、`data-animate-easing`（缓动曲线）、`data-animate-trigger="immediate"`（即时播放）。
- **无障碍**：自动响应 `@media (prefers-reduced-motion: reduce)` 停用动效并展示静态内容。
- **开发扩展**：自定义扩展模块参考 `docs/extension-guide.md`。

## 四、Bloom 认知层级

- `remember`：列出、识别、回忆。
- `understand`：解释、举例、分类。
- `apply`：使用、计算、执行。
- `analyze`：拆分、诊断、比较因果关系。
- `evaluate`：依据明确标准权衡决策并说明局限。
- `create`：在新情境中设计完整方案或产物。
