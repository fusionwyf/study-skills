# 课件设计（Lesson）

创建、修改课件组件，选择教学模式，或设计认知层级时读取本文件。视觉设计可自由变化，机器标记与无脚本降级行为保持稳定。

## 一、Lesson 根节点契约

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

`data-objective` 和 `data-evidence` 必须非空。可选的 `data-cognitive-level` 使用 Bloom 枚举（见第四节）。

`assets/course-template/lesson.html` 中的 `data-course-id="example-course"` 与 `data-objective="example-objective"` 是示例占位值。复制模板后必须替换为当前课程的真实值，并确认该 objective 已定义在 `course.yaml` 的 `objectives` 中，否则 validator 报 `lesson references unknown objective`。

当状态为 `required` 或 `provided` 时，页面必须包含对应的 `data-role` 内容：`objective`、`evidence`、`retrieval`、`learner-feedback`、`sources`、`answer-feedback`。

## 二、教学模式

先确定本课的可验证学习成果，再选择一个主模式。可以组合两个模式，但不要把结构机械叠加。

### 概念理解

科学概念、理论框架、术语体系、抽象机制。

序列：预测具体情境 → 展示现象/例子/反例 → 给出概念模型 → 对比易混概念 → 新情境检查。
主要证据：解释、对比、预测、反例判断。

### 数学与定量推理

公式、证明、计算、建模。

序列：用数值/图形建立直觉 → 严格定义及适用条件 → 分步推导并标明依据 → 示例后做同构练习 → 加入变式、边界、错误诊断。
主要证据：独立推导、选择方法、检查条件、解释结果。
可视化：函数/统计用 `chart`；几何用 `spatial`；结构关系用 `relation`；过程用 `timeline`/`process`。

### 编程与操作技能

代码、软件工具、实验流程、设备操作。

序列：展示目标产物和验收标准 → 最小可工作示例 → 解释关键选择和失败方式 → 让学习者补全/修改/排错 → 独立小任务并验证。
代码示例必须写明运行环境、输入、输出和验证方法；不要用复制整段答案代替练习。
主要证据：可运行产物、测试结果、故障诊断、迁移实现。

### 语言学习

序列：可理解输入和真实语境 → 引导注意目标形式 → 辨析和受控提取 → 简短输出 → 针对性反馈和延迟复现。
主要证据：主动提取、语境选择、理解与输出。不要只依据"认识这个词"。

### 写作、设计与创作

序列：分析两个以上有差异的范例 → 建立可观察的评价标准 → 局部创作 → 自评/互评 → 修订并说明理由。
主要证据：作品、评价判断、修订质量、决策解释。避免把审美偏好伪装成普遍规则。

### 历史、人文与社会科学

序列：呈现材料或冲突问题 → 区分事实/解释/价值判断 → 比较来源和立场 → 构造主张—证据—推理链 → 加入反例、替代解释、证据局限。
主要证据：来源判断、论证结构、反论证、不确定性表达。

### 判断与决策

序列：明确目标、约束和不可接受结果 → 建立判断维度 → 比较案例 → 处理边界和冲突信号 → 做决定并解释权衡。
主要证据：条件识别、权衡说明、边界意识、错误成本判断。高风险领域必须标注专业边界。

### LearnKit 模式映射

分步讲解用 `sequence`，参数变化用 `explore`，直接操作用 `construct`，并列证据用 `compare`，预测后验证用 `predict`。每课只设一个主模式；预测题可使用开放回答与先作答再揭示结构嵌入其余模式；它不是已实现的 LessonSpec renderer。

### 跨模式通用规则

- 用一个成果组织一课，而不是用一个术语组织一课。
- Worked example 之后安排 completion problem，再安排独立任务。
- 错误选项必须对应真实误区，并提供原因解释。
- 在后续课程用旧知识解决新问题，实现交错与迁移。
- 学习者失败时先诊断失败类型：知识缺口、步骤负荷、表征困难、动机脱节或任务表述不清。

## 三、HTML 组件

### 证据与练习

任何能获取学习者表现的任务都可使用 `data-role="evidence"`，不要求是测验。每个任务提供稳定的 `data-question-id`。

有标准答案的问答使用 `.quiz`、`.quiz-option`、`.quiz-feedback`；即时判定只报告该题结果，不推断 mastery。开放题使用输入框或文本域，保留原始答案。

提示控件使用 `data-hint`，使反馈导出可记录是否使用提示。答案、解释和错误原因必须在 DOM 中可访问，不能只靠颜色表达。

### 数字与填空回答

用 `data-role="evidence"`、唯一 `data-question-id`，并设 `data-answer-kind="numeric|fill"`。容器包含有 label 的 `data-answer-input`、`data-answer-check` 按钮和 `data-role="answer-feedback"`。numeric 使用有限 `data-expected` 与非负绝对 `data-tolerance`；fill 使用 `data-accepted='["答案","别名"]'`，默认 NFKC、去首尾空格、忽略大小写，可用 `data-case-sensitive="true"`。这是有限答案判定，不用于语义评分。

检查前保留原话，检查次数、答案与提示进入同一证据 store。即时结果不升级 mastery。示例见数学/听辨验收课件。

### 媒体与图片标注

需要图片热点时安装 `media` 并读取组件 README。音视频使用原生 controls 与可读文字稿，视频对白另提供字幕 track。热点标注配合开放文本回答，选择热点只是观察记录。未提供或未验证的专业媒体必须在课件中说明，不能用示意媒体声称完成真实听力训练。

### 学习者教 AI

使用 `data-role="evidence teaching-target"`、稳定 `data-question-id`、`data-answer-kind="open"`。标注模拟学生的错误理解，让学习者输入纠正、条件与反例。文本域关联 label；对照要点用 `data-teaching-key`，保存按钮用 `data-teaching-check`。

先留下原始回答，点击按钮后锁定回答并显示对照要点。页面只提供自检依据，不做关键词匹配评分。无脚本时问题、输入区与要点可读；学生版打印隐藏要点，审阅版显示。

### 多轮追问

使用 `data-role="evidence dialogue-practice"` 和 `data-answer-kind="open"`；每个轮次是 `data-dialogue-turn="1"` 容器，含 `data-dialogue-prompt` 的 label 及关联 textarea。继续按钮标 `data-dialogue-next`，状态区标 `data-dialogue-status`。

按"解释依据 → 条件/反例 → 新场景"预写追问，数量由目标决定。含方向提示标 `data-guidance="with_hints"`，提供关键推理步骤标 `data-guidance="ai_guided"`。

JavaScript 等本轮非空回答后保存原话、锁定文本域，再显示下一问。无脚本与打印时各轮可见。

### 学习记录复制

当 `data-feedback="required"` 时，提供 `data-copy-feedback` 按钮。`course.js` 汇总为结构化 Markdown：course ID、课号、objective ID、每题标识与原始答案、检查次数与提示使用、即时判定、学习者反思、辅助情况自述与页面观察、多轮追问的逐轮内容、可视化当前状态。浏览器不写回课程文件，也不生成 mastery 建议。

### 公式

使用 `.formula` 容器，公式正文直接写 LaTeX 定界符 `\(...\)` 或 `\[...\]`，由 KaTeX auto-render 渲染。公式旁提供一句文字，说明符号含义、成立条件和使用边界。渲染细节见 `render.md`。

### 代码

使用 `.code-block`、语言标记和 `<pre><code>`。说明输入、输出和运行条件。复制按钮是渐进增强，禁用 JavaScript 时代码仍可读。

出现代码默认启用 highlight.js；新课程已安装 code-highlight，已有课程补装。语言取自 `.code-language` 或 `language-*` 标记；缺少语法时选官方语言包。接线与官方主题选择见 `render.md`，验收时检查实际生成 token 样式。

### 图形与图解

按任务选择 `chart`、`relation`、`timeline`、`process`、`spatial`、`sequence`、`table`。概念关系图可使用带 `<title>`、`<desc>` 和文字摘要的 SVG；数学曲线、曲面、坐标几何、实验数据和算法状态应从计算模型和真实数据生成。详细契约见 `render.md`。

### 步骤与提示

使用 `.steps`、`.step` 或 `<details>`。隐藏步骤必须在无脚本或打印时可恢复；作为提示使用时标记 `data-hint`。

展开按钮使用 `data-step-next`，`course.js` 从最近的 `[data-steps-scope]` 容器收集 `.step` 展开。按钮与步骤列表为兄弟节点时，把这组元素一起放进带 `data-steps-scope` 的容器，展开才不会丢失作用域。

### 参数探索

滑杆提供数值读数、键盘操作、边界值和静态打印快照。核心结论不能只在拖动后出现。

### 术语与速查

使用 `.glossary` 或 `.reference-card`。同一课程保持术语一致，速查内容可写入 `reference/`。

### 学习反馈

使用 `.reflection` 和 `data-role="learner-feedback"`。问题应能直接回答；普通聊天回复同样可以成为反馈。

### 来源

只有使用时效性事实、统计数据、研究结论、引文、教材材料、外部案例、争议或高风险判断，或 Agent 实际读取外部材料时才需要来源。稳定常识、原创示例和纯演绎内容使用 `not-needed`。

`verified` 和 `unverified` 必须有 `data-role="sources"` 区块；`unverified` 由 validator 报 warning。来源可靠性见 `../../shared/references/source-provenance.md`。

### 通用行为

所有组件支持键盘、窄屏、打印和减少动画偏好。重要正文在 JavaScript 失败时仍可读取；交互状态不能只依靠颜色或悬停。

### 视觉与主题

`course.css` 是共享基线；课程自己的 `assets/theme.css` 最后加载，用于 token、布局与第三方组件外观。`assets/theme.js` 登记主题与渲染设置；新课程已安装主题切换器。agent 根据用户视觉约定修改课程副本并在续课复用，保留语义类名与 data-* 契约。

## 四、Bloom 认知层级

仅在设计学习目标、练习和检查点时参考。不要把六层机械套到每一课。

| 层级 | 目标动词 | 合适的证据 |
|---|---|---|
| `remember` | 列出、识别、回忆 | 延迟提取、术语辨认 |
| `understand` | 解释、举例、分类 | 自己的话说明、比较例子 |
| `apply` | 使用、计算、执行 | 熟悉任务中的独立完成 |
| `analyze` | 拆分、诊断、比较关系 | 变式、错误定位、因果链 |
| `evaluate` | 判断、论证、权衡 | 依据标准做决定并说明限制 |
| `create` | 设计、构建、改写 | 新场景中的作品或方案 |

使用规则：

- 为每个学习成果选择一个主要层级，必要时记录前置层级。
- 课程路线应逐步从记忆/理解走向应用、分析和迁移；并非所有主题都需要 `create`。
- 题目动词必须与目标层级一致。要求"解释"时，不能只给识别题。
- `cognitive_level` 是规划元数据，不是掌握状态。掌握仍由行为证据决定。
- 若学习者在高层级任务失败，先检查前置层级是否稳固，再降低任务负荷。
