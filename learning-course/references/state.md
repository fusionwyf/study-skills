# 课程状态（schema v3）

仅在创建、续学、恢复或更新课程状态时读取本文件。

## 一、事实来源

- `course.yaml` 是唯一机器状态源。
- `PLAN.md` 是可人工维护的学习者课程契约；课程路线和边界以它为准。
- `INDEX.md` 与 `index.html` 是可重新生成的展示文件。
- `records/` 是学习者原始反馈、可观察行为和 Agent 判断的唯一内容来源。
- `sources/` 保存来源注册与摘录（由课程内部按 `../../shared/references/material-intake.md` 维护）。
- `last_feedback` 只保存最新 record 的相对路径，不复制反馈内容。

## 二、推荐结构

```yaml
schema_version: 3
course_id: probability-foundations
title: 概率论基础
language: zh-CN
created_at: 2026-01-01T00:00:00Z
updated_at: 2026-01-01T00:00:00Z
status: active
phase: designing

learner:
  goal: 能独立建立基础概率模型并解释结果
  motivation: null
  prior_knowledge: []
  constraints: {}

diagnostic:
  status: skipped
  record: null
  skipped_reason: 起点已有充分证据

success_criteria:
  - 能从自然语言中识别随机试验、样本空间和事件

current_lesson: 0
objectives:
  - id: event-modeling
    statement: 能为新问题建立样本空间
    cognitive_level: apply
    mastery: unseen
    evidence: []

review_queue: []
last_feedback: null
```

`cognitive_level` 是可选规划元数据。不要维护 `feedback_status`、`mode`、`roadmap`、`next_lesson`、独立 `checkpoint` 或顶层 `mastery`。

## 二·一、分章课程包（可选 `chapters`）

同一门课覆盖教材多个章节时，用**一个**课程包、按章分子目录，而不是拆成多个包：

```text
{course}/
├── course.yaml          # 单一 course_id，objectives 全局唯一
├── assets/              # 唯一的 kit bundle 与 nav.json
├── lessons/
│   ├── 第八章/0001-*.html
│   └── 第九章/0001-*.html
├── records/
│   ├── 第八章/0001-feedback.md
│   └── 第九章/0004-variant.md
└── reference/
    ├── 第八章/demos/
    └── 第九章/demos/
```

```yaml
chapters:
- id: ecf                    # objective.chapter 引用它
  label: 第八章              # 目录名，lessons/<label>/ 与 records/<label>/
  title: 异常控制流
  lesson_dir: lessons/第八章
  records_dir: records/第八章
  current_lesson: 11
  diagnostic:                # 可选；每章声明时顶层 diagnostic 可省略
    status: complete
    record: records/第八章/2026-08-07-lesson-0001.md
    skipped_reason: null
```

规则：

- **课号每章各自从 0001 起**，因此裸课号不唯一。顶层 `current_lesson` 表示全书已交付总数（等于各章之和），不再指向某个课号文件；每章进度写在自己的 `current_lesson`。
- **进度身份是组合键 `"<label>/<NNNN>"`**（扁平包仍是裸 `"<NNNN>"`）。`nav.json` 的 `completed_lessons` 与课件侧边栏打勾都按它判定。
- record 的章归属取自它所在的子目录，因此历史 record 内容无需改写；`lesson` 字段仍写该章内的课号。
- `objectives[].chapter` 可选；写了就必须匹配某个 `chapters[].id`，且声明该 objective 的课件必须位于对应章目录下（validator 会查）。
- evidence 的 `record` 路径形如 `records/第八章/0003-feedback.md`，仍必须落在 `records/` 内。
- 扁平包不受影响：没有 `chapters` 时以上规则全部不启用。

## 三、枚举

课程 `status`：

- `draft`：契约尚未开始执行。
- `active`：课程正在进行。
- `paused`：学习者主动暂停。
- `complete`：成功标准已有足够证据。

教学 `phase`：

- `diagnostic`：最小诊断正在获取起点证据。
- `designing`：正在规划课程或下一课。
- `teaching`：Agent 正在对话中单独回答课程问题，不表示正在生成课件。
- `awaiting_evidence`：等待练习、解释、作品、反思或其他学习反馈。
- `review_due`：有到期复习项。
- `recovery`：状态缺失、损坏或版本不兼容。

学习成果 `mastery`：`unseen`、`recognition`、`application`、`transfer`、`uncertain`。

不要要求学习者机械经过每一级。除设为 `uncertain` 外，更新 mastery 必须引用一个 finalized record，且该 record 必须明确列出对应 objective 和 mastery。

## 四、诊断

仅当起点不确定且会影响路线时进行最小诊断：

```yaml
diagnostic:
  status: pending | complete | skipped
  record: records/0000-diagnostic.md | null
  skipped_reason: null
```

题目、回答和判断写入 record，不复制进 YAML。

## 五、Objective evidence

```yaml
objectives:
  - id: process-lifecycle
    statement: 能解释进程创建与回收的关键状态变化
    mastery: application
    evidence:
      - record: records/0003-feedback.md
        type: application
        strength: strong
        mastery: application
```

任何学习反馈都可以记录为 evidence，但证据强度决定它能支持什么判断。单纯自评属于弱证据，不能独立升级 mastery。

模块检查点不使用独立状态对象：把综合任务作为 `assessment` evidence 附加到相关 objective；证据冲突或缺失时使用 `uncertain`。

诊断执行、练习梯度、证据优先级与升级、错误分类与干预，统一见：

- [`../../shared/references/diagnostic-protocol.md`](../../shared/references/diagnostic-protocol.md)
- [`../../shared/references/transfer-rubric.md`](../../shared/references/transfer-rubric.md)

## 六、Record 格式

记录文件保存在 `records/` 下，文件名使用 `NNNN-slug.md`（四位序号 + dash-case slug）。frontmatter 模板：

```markdown
---
record_schema: 1
assessment_status: finalized
record_id: L0003
attempted_at: 2026-01-15
source_backed: false
synthetic: false
independence: null           # 定稿前按实际过程填写，不能从正确答案猜测
lesson: 3
evidence_type: application
evidence_strength: strong
supported_objectives:
  - id: process-lifecycle
    mastery: application
---
# 第 0003 课学习记录

## 学习者原始反馈

> 原样保存粘贴内容或聊天回复。

## 可观察行为

- 回答了什么：
- 正确性或产物结果：
- 是否使用提示：
- 是否包含解释或迁移：

## Agent 判断

- evidence_type:
- evidence_strength:
- 支持的 mastery:
- 仍不确定：
```

各字段的类型、枚举和必填规则统一见 [`../../shared/references/record-contract.md`](../../shared/references/record-contract.md)；本文件只保留课程专属语义：

- 新反馈先以 `assessment_status: pending` 保存，frontmatter 中的 evidence 字段保持 `null` 或空列表。Agent 完成可观察行为和判断后再设为 `finalized`。finalized record 中不得保留"待判断""待补充"等占位内容；原始反馈正文保持不变。
- `supported_objectives` 是 mastery 更新的唯一依据：除设为 `uncertain` 外，更新 objective 的 mastery 必须引用一条 finalized record，且该 record 必须在 `supported_objectives` 中明确列出对应 objective 和 mastery。
- record 的 independence 同时满足共享契约的掌握级要求才可用于新更新；未知的旧记录只保留历史读取与警告。新的 complete 状态也要为每个目标提供符合独立性要求的证据。
- 旧记录兼容：缺少新增公共字段（如 `record_id`、`attempted_at`）的已定稿旧记录仍然有效，validator 只产生警告，不做自动迁移。

## 七、Phase 转换

- 初始化后根据是否需要诊断进入 `diagnostic` 或 `designing`。
- 生成课件后进入 `awaiting_evidence`。
- 单独回答课程问题时进入 `teaching`；要求学习者作答后进入 `awaiting_evidence`，纯澄清后恢复原 phase。
- 收到 record 并更新证据后进入 `designing` 或 `review_due`。
- 暂停和完成只修改 `status`，不创建同名 phase。

## 八、Recovery

遇到缺失、无法解析、schema v2 或其他不兼容状态时：

1. 进入 recovery，不覆盖原文件。
2. 检查 `PLAN.md`、`INDEX.md`、`lessons/` 和 `records/`。
3. 生成 `course.recovered.yaml`。
4. 标明哪些字段是 confirmed、inferred 或 unknown。
5. 用户确认后才替换 `course.yaml`。

不要提供或隐式执行 v2 到 v3 迁移。

## 九、更新纪律

- 每次状态更新修改 `updated_at`。
- 写入新课前检查目标课号不存在。
- 扁平包：`current_lesson > 0` 时必须存在对应的 `lessons/NNNN-*.html`。分章包：顶层值是全章之和，改为校验每个 `chapters[].current_lesson` 在 `lessons/<label>/` 下有对应课号。
- lesson 的 `data-objective`、review queue 和 evidence 只能引用已定义 objective。
- 只有每个 objective 都有 evidence-backed mastery，课程才能设为 `complete`。
- 不删除或重写历史证据；需要纠正时追加说明。
- 不把 HTML、长篇反馈或课程路线复制进 `course.yaml`。
