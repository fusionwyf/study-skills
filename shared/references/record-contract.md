# Record 契约

learning-course、exam-prep 和 spaced-review 的所有学习记录共用这一份字段契约。创建记录、定稿记录、或排查 validator 报错时读这里；字段定义的机器可读版是 [`../schemas/record.schema.yaml`](../schemas/record.schema.yaml)，两者冲突时以 schema 文件为准。

## 三种记录类型

| 类型 | record_type | 产出方 | 例子 |
|---|---|---|---|
| 教学证据 | attempt（默认） | learning-course | 一节课后学习者反馈 |
| 考试尝试 | attempt（默认） | exam-prep | 一次 drill/mock/review |
| 复习 | review | spaced-review | 一次到期复习 |

交接记录不使用本契约，见 [`../schemas/handoff.schema.yaml`](../schemas/handoff.schema.yaml)。

## 公共字段

每条记录的 frontmatter 必须携带：

```yaml
record_schema: 1
assessment_status: pending   # pending | finalized
```

`assessment_status` 为 `finalized` 时，还必须携带：

```yaml
attempted_at: 2026-08-08     # 学习发生日期
source_backed: false         # 证据任务是否来自已注册来源
synthetic: false             # 任务是否为 Agent 合成
```

并推荐携带：

```yaml
record_id: L0001             # ^[A-Z]{1,2}[0-9]{4}$；前缀约定：L=课程，R=考试，RV=复习
record_type: attempt         # attempt | review，默认 attempt
independence: independent    # independent | with_hints | ai_guided
```

## 独立性与证据边界

新记录定稿时填写 `independence`，独立于 `source_backed`（任务来源）和 `evidence_strength`（证据强度）：

- `independent`：该次尝试没有 AI 提示、代答或关键步骤引导；学习者自行完成。
- `with_hints`：给过方向或局部提示，关键工作仍由学习者完成。
- `ai_guided`：AI 提供关键推理、实质性步骤或答案，学习者在其引导下完成。

依据可观察过程填写，并在正文区分页面观察、学习者自述和 Agent 判断。`hint_used: false` 只说明没有记录到提示，不自动证明 independent；`hint_used: true` 与 independent 不相容。多轮回答保留逐轮问题、原话、提示及顺序；同一条记录使用支持目标的尝试中最低的独立性。需要为独立复测单独记证据时新建记录。

mastery 限制以 schema 的 `mastery_independence` 为准：transfer 必须 independent；application 至少 with_hints 或 independent；ai_guided 最多 recognition。独立性达标是必要条件，仍须任务与表现支持相应级别，不能自动升级。

旧记录未填写时表示 unknown，不猜测、不修改定稿历史。它仍可用于阅读和历史状态校验（警告），但不能支撑新的 application/transfer 更新；新增一次可核验尝试来补证。报告对 independent + strong 才确认独立能力，其余证据注明辅助程度或未知。

## 类型专属字段

**course_lesson**（检测特征：`lesson` 字段）

```yaml
lesson: 3                    # 课号
evidence_type: application   # 证据任务类型
evidence_strength: strong    # strong | medium | weak
supported_objectives:        # 本条记录支撑的目标及主张的掌握级
  - id: variables-and-assignment
    mastery: application     # unseen|recognition|application|transfer|uncertain
```

pending 记录允许这些字段为空；finalized 时必须完整。

**exam_attempt**（检测特征：`mode` 字段）

```yaml
mode: drill                  # diagnose|plan|drill|review|mock|cram|postmortem
metrics:                     # 本次记录实际测量了哪些 readiness 维度
  - accuracy                 # accuracy|speed|coverage|stability 的子集
```

**review**（检测特征：`review_kind` 字段）

```yaml
review_kind: variation       # retrieval|explanation|variation|transfer|error_discrimination
performance: good            # good | medium | poor
hint_used: false
evidence_strength: strong    # strong | medium | weak
next_action: delayed-transfer
objective_id: process-lifecycle   # 课程复习用 objective_id，考试复习用 topic，二选一
```

## 正文四段

frontmatter 之外，记录正文按固定顺序保留四类内容：

1. **原始回答** —— 学习者原话逐字保留，禁止改写或概括。
2. **可观察行为** —— 答案里实际能看到什么，只描述不解释。
3. **Agent 判断** —— observed issue、suggested_causes 等，明确标注为推断。
4. **下一步** —— next_action 具体到下一次动作。

`suggested_causes` 未经用户确认不得写成 `user_confirmed_cause`。原始回答是事实来源；Agent 判断可以追加修订，但不得伪装成原始事实。

## 定稿不可变

一旦 `assessment_status: finalized`，frontmatter 与原始回答不再修改。发现判断错误时新建一条记录并引用旧记录，而不是改旧记录。

## 旧记录兼容

不做自动迁移。缺少推荐字段的已定稿旧记录（如没有 `record_id` 的课程记录）只产生警告，从文件名推导编号；缺少必需字段或枚举非法才判失败。
