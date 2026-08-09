# HTML 组件契约

创建或修改课件组件时读取本文件。视觉设计可以变化，以下机器标记和无脚本降级行为保持稳定。

## Lesson 根节点

每课的 `.lesson` 必须包含：

```html
<main
  class="lesson"
  data-course-id="course-id"
  data-lesson-id="0001"
  data-objective="objective-id"
  data-evidence="practice"
  data-retrieval="required"
  data-feedback="required"
  data-source-status="not-needed"
  data-answer-status="provided">
```

状态枚举：

- `data-retrieval="required|not-applicable"`
- `data-feedback="required|not-applicable"`
- `data-source-status="verified|not-needed|unverified"`
- `data-answer-status="provided|not-applicable"`

`data-objective` 和 `data-evidence` 必须非空。可选的 `data-cognitive-level` 使用 Bloom 枚举。

当状态为 `required` 或 `provided` 时，页面必须包含对应的 `data-role` 内容：

- `objective`
- `evidence`
- `retrieval`
- `learner-feedback`
- `sources`
- `answer-feedback`

## 证据与练习

任何能获取学习者表现的任务都可以使用 `data-role="evidence"`，不要求必须是测验。为每个任务提供稳定的 `data-question-id`。

有标准答案的问答使用 `.quiz`、`.quiz-option` 和 `.quiz-feedback`。即时判定只报告该题结果，不推断 mastery。开放题使用输入框或文本域，并保留学习者原始答案。

提示控件使用 `data-hint`，使反馈导出可以记录是否使用提示。答案、解释和错误原因必须在 DOM 中可访问，不能只靠颜色表达。

## 学习记录复制

当 `data-feedback="required"` 时，提供 `data-copy-feedback` 按钮。`course.js` 将以下内容汇总为结构化 Markdown：

- course ID、课号、objective ID
- 每题标识与原始答案
- 检查次数与提示使用情况
- 有标准答案时的即时判定
- 学习者填写的困惑、解释或反思

浏览器不写回课程文件，也不生成 mastery 建议。学习者把记录粘贴给 Agent，Agent 原样保存到 `records/`。

## 公式

使用 `.formula` 容器和带 `data-tex` 的 `.math-expression`。提供可读后备文本及 `aria-label`。需要公式时同时读取 `math-rendering.md`。

## 代码

使用 `.code-block`、语言标记和 `<pre><code>`。说明输入、输出和运行条件。复制按钮是渐进增强，禁用 JavaScript 时代码仍可读。

## 图表与图解

优先使用带 `<title>`、`<desc>` 和文字摘要的语义 SVG。动态图表准备静态打印状态，不只用颜色表达关系。

## 步骤与提示

使用 `.steps`、`.step` 或 `<details>`。隐藏步骤必须在无脚本或打印时可恢复；作为提示使用时标记 `data-hint`。

## 参数探索

滑杆提供数值读数、键盘操作、边界值和静态打印快照。核心结论不能只在拖动后出现。

## 术语与速查

使用 `.glossary` 或 `.reference-card`。同一课程保持术语一致，速查内容可以写入 `reference/`。

## 学习反馈

使用 `.reflection` 和 `data-role="learner-feedback"`。问题应能直接回答；普通聊天回复同样可以成为反馈，不强制学习者使用页面表单。

## 来源

只有使用时效性事实、统计数据、研究结论、引文、教材材料、外部案例、争议或高风险判断，或者 Agent 实际读取外部材料时才需要来源。稳定常识、原创示例和纯演绎内容使用 `not-needed`。

`verified` 和 `unverified` 必须有 `data-role="sources"` 区块；`unverified` 由 validator 报 warning。

## 通用行为

所有组件支持键盘、窄屏、打印和减少动画偏好。重要正文在 JavaScript 失败时仍可读取；交互状态不能只依靠颜色或悬停。
