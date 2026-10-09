---
name: learning-course
description: "Build and continue evidence-backed multi-lesson courses for durable mastery."
disable-model-invocation: true
---

# 通用教学课程

## 核心约束

以 durable mastery 为目标，把主题组织成可持续的自适应课程。HTML 是课程内容源产物；PDF 是按需生成的静态发布物。

考试日期、目标分数、真题和 readiness 是主要目标时，选择 exam-prep；一次性辅导直接处理，不建课程包。

课程必须能够跨 Agent、跨会话继续维护：

- `course.yaml` 保存机器状态。
- `PLAN.md` 保存学习者可读、可人工维护的课程契约、路线和边界。
- `records/` 保存学习者原始反馈、可观察行为和 Agent 判断。
- mastery 依据学习证据更新，不依据 Agent 已经讲过什么。

不能渲染 PDF 时保留 HTML 并说明限制，不创建伪 PDF。无法完成要求的视觉检查时明确标记未验证。

## 工作模式

- **create**：建立课程契约、课程包和第一课。
- **continue**：根据状态、到期复习和最新 evidence 继续教学。
- **export**：导出单课或整门课程，不改变学习状态。

向已有包添加资料是当前课程的内部操作，按下文注册来源，不要求切换 skill。

单次答疑保持普通答疑。课程中的独立知识问题可以进入 `teaching` phase，但回答本身不等于生成新课件。

## 课程包

```text
{course}/
├── course.yaml
├── PLAN.md
├── INDEX.md
├── index.html
├── lessons/0001-<slug>.html
├── assets/
├── reference/
├── records/
└── exports/
```

保留完整目录骨架。课号使用四位连续数字，slug 使用安全的 dash-case。创建前检查现有文件，避免覆盖已有课程。

## Create

1. 确认学习者的真实目标和可观察成功标准。动机、基础、时间和其他约束只在会影响路线时补充。
   携带补课交接文件时先读取 `../shared/references/learning-handoff.md`，将 goal、boundary 和返回条件写入目标包 `PLAN.md`，保存交接路径并遵守该边界。
2. 当起点不确定且会改变路线时进行最小诊断；题数和形式由 Agent 决定。
3. 读取 `references/course-state.md`，确定 v3 初始状态。使用 `scripts/init_course.py`；需要诊断时传入 `--diagnostic`。
4. 在 `PLAN.md` 中维护课程路线和边界。它不是可重新生成文件。
5. 选择适合本主题的教学模式，生成一个具有可验证学习成果和 evidence opportunity 的 HTML 课件。
6. 将 phase 设为 `awaiting_evidence`，重新生成索引并验证课程包。

完成条件：成功标准和 objective 已写入状态，第一课文件存在且引用已定义 objective，phase 为 `awaiting_evidence`，两条验证命令均通过。

## Continue

1. 读取 `course.yaml`、`PLAN.md`、最近相关 lesson 和最新 `records/`；有交接时同时定位 `PLAN.md` 保存的 incoming 交接路径或当前包 `handoffs/` 中的 outgoing 交接。
2. schema 缺失、损坏或不是 v3 时按 recovery 处理，不自动迁移。
3. 优先处理到期复习和学习者明确提出的问题。
4. 根据 evidence 强度决定保持难度、补前置、增加变式、推进或设为 `uncertain`。
   若有 incoming 交接、已有跨包交接待返回，或 finalized evidence 表明需要独立的有界补课包，读取 `../shared/references/learning-handoff.md` 并按对应分支处理。incoming 补课获得约定的返回证据时执行协议的返回分支；课程内可补的前置仍按本流程教学。
5. 生成下一课后进入 `awaiting_evidence`。不要提前创建不存在的反馈。

完成条件：所有新 mastery 都可追溯到 finalized record；下一项动作是到期复习、针对性补救、有界补课交接或一节引用已定义 objective 的新课；状态与索引已经验证。

单独回答课程问题时使用 `teaching`：要求学习者作答后进入 `awaiting_evidence`；纯澄清后恢复先前 phase。生成课件不使用 `teaching`。

## 注册来源

学习者提供 PDF、教材、讲义或网页时，读取 `../shared/references/material-intake.md`。从 `learning-course/` 目录运行（目标包路径使用绝对路径）：

```text
python ../shared/scripts/register_source.py <course-dir> \
  --title "<标题>" --type textbook --reliability unknown --raw <原文件路径>
python ../shared/scripts/validate_sources.py <course-dir>
```

按实际资料选择 type 和 reliability；网页无本地文件时省略 `--raw`。完成条件：`sources/SOURCES.md` 已登记 `S###`，所需摘录与主张可回查，lesson 按组件契约引用来源，来源校验通过。

## Evidence 与反馈

每课必须包含一个获取掌握证据的机会。证据可以是练习答案、解释、作品、操作结果、反思或普通聊天回复。

HTML 的“复制学习记录”按钮只汇总原始答案、检查次数、提示使用、即时题目判定和学习者反思，不推断 mastery。学习者把结构化 Markdown 粘贴给 Agent 后使用两阶段记录：

1. 使用 `scripts/update_progress.py <course-dir> --lesson <N> --feedback-file <file>` 捕获原始反馈；生成的 record 保持 `assessment_status: pending`。
2. 在 record 中区分可观察行为和自我报告，填写 evidence type、strength、independence、supported objectives，并设为 `assessment_status: finalized`。独立性字段与升级边界读取 `../shared/references/record-contract.md`；页面反馈包含多轮回答时逐轮保留问题与原话。
3. 使用 `--evidence-record <record> --objective <ID=MASTERY>` 更新状态。objective 必须已经存在，record 必须明确支持该更新。

完成条件：原始反馈未被改写，finalized record 不含待判断占位符，状态中的 evidence type、strength 和 mastery 与 record frontmatter 一致。除 `uncertain` 外，修改 mastery 必须引用 finalized record。复习间隔只由 `update_progress.py` 的当前算法管理，主文件不复制算法。

最近 3 条定稿记录连续为 `ai_guided` 时提醒近期缺乏独立验证，下一步安排无辅助变式或迁移任务。这是补证信号，不能据此断言能力下降；长期比较应使用难度、允许工具和评分标准可比的独立测试。

## Recovery

读取 `references/course-state.md`。从 `PLAN.md`、`INDEX.md`、lessons 和 records 生成 `course.recovered.yaml`，标明 confirmed、inferred 和 unknown；用户确认后才替换原 `course.yaml`。不要提供或执行 v2 自动迁移。

## Export

读取 `references/pdf-export.md`，确认范围和 `student`/`review` 模式，再使用 `scripts/export_pdf.py` 或可用的浏览器打印能力。PDF 放入 `exports/`；打印课件且模型具备视觉能力时检查分页、公式、图表、重叠和裁切。

## 参考路由

- 创建、更新、续学或恢复状态：读取 `references/course-state.md`。
- 记录字段契约、record 校验报错：读取 `../shared/references/record-contract.md`。
- 导入资料、摘录、主张追踪或来源冲突：读取 `../shared/references/material-intake.md`。
- 跨包补课的创建、续接或返回：读取 `../shared/references/learning-handoff.md`。
- 设计诊断、证据、难度调整或 mastery 判断：读取 `references/assessment.md`。
- 需要显式设计认知层级时：读取 `references/bloom-taxonomy.md`；`cognitive_level` 始终可选。
- 选择学科教学模式时：读取 `references/lesson-patterns.md`。
- 创建或修改代码、图表、步骤、提示、参数探索、术语、反馈、问答、来源或其他 HTML 组件时：读取 `references/components.md` 并复用 `assets/course-template/`。
- 使用公式组件时：同时读取 `references/math-rendering.md`。
- 导出或审查 PDF 时：读取 `references/pdf-export.md`。

`assets/example-course/` 只用于模板调试或 validator 烟雾测试，日常 create/continue 不读取。

## 验证

生成或修改课程后运行：

```text
python scripts/build_index.py <course-dir>
python scripts/validate_course.py <course-dir> --strict-schema --pedagogical
python -X utf8 ../shared/scripts/quick_validate.py <skill-dir>
```

validator 只认显式 schema 和 `data-*` 契约，不使用关键词猜测。只有需要打印且模型具备视觉能力，或学习者明确报告视觉问题时才进行视觉检查。
