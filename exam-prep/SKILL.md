---
name: exam-prep
description: "Exam outcome preparation: diagnose, plan, drill, review, mock, and cram against an exam date, score, syllabus, or question format, even when materials are initially incomplete. Use for 备考, 刷题, 真题, 模考, 错题复盘, and 考前冲刺. Prefer learning-course when durable multi-session mastery is the primary outcome; handle one-off tutoring directly."
---

# Exam Prep

## 核心定位

以 exam outcome 为目标，把考试范围和资料转成可持续的备考循环：抽题、刷题、限时训练、错题反馈、模考复盘、readiness 跟踪和考前速记。

保持 exam-prep 与 learning-course 状态隔离，只读写独立考试包。知识漏洞在当前题目和知识点范围内讲解、示范和出变式题。

## 工作模式

- diagnose：起点证据和主要风险。
- plan：范围、资料、时间与训练路线。
- drill：题型、知识点、速度或错题模式训练。
- review：答案、可观察问题和用户确认错因。
- mock：限时模拟、估分和时间复盘。
- cram：高频、易错、公式、模板、陷阱和 checklist。
- postmortem：考后结果与下一次可复用经验。

进入任一 mode 时读取 `references/workflows.md` 的对应分支，执行到该分支的完成条件。一次只保持一个 active mode。

## 考试包

创建或继续备考时，使用独立考试包：

~~~text
{exam}/
├── exam.yaml
├── PLAN.md
├── SOURCES.md
├── source-materials/
├── question-bank/
├── drills/
├── mock-exams/
├── records/
├── error-log.md
└── exports/
~~~

使用 `scripts/init_exam.py <exam-dir> --title "<exam name>"` 初始化 schema v2。新包始终为 `provisional`；登记来源并生成题库后运行 `scripts/update_exam.py <exam-dir> --sync-materials`。只有来源和 source-backed questions 足以支撑计划时才设为 `confirmed`。

使用 `scripts/update_exam.py` 更新 mode、readiness 和 materials。readiness 更新必须同时传入 `--evidence-record`，且 record 明确列出本次测得的 metrics。恢复损坏文件时写入 `exam.recovered.yaml`，不直接修补原状态。

## 资料优先级

优先使用用户给定资料，不把 Agent 生成题当作默认来源。把资料保存或登记到 source-materials/ 和 SOURCES.md。从资料中抽取题目、处理来源优先级或生成变式题时读取 references/question-handling.md，并使用 scripts/build_question_bank.py 生成题库草稿。

## 题型处理

选择题、填空题和短答题可以使用 assets/drill-template/index.html 生成交互练习、计时、隐藏答案和复制记录。

大题使用 rubric-first 流程，不强行网页自动批改：

1. 展示题目、限制条件和评分点。
2. 让用户作答或粘贴答案。
3. 按 rubric 给出估分和可观察问题。
4. 给出 suggested causes，但不替用户定性。
5. 等用户确认 user_confirmed_cause。
6. 保存 record，更新 error-log.md 和 readiness。
7. 安排重做、变式题或同题型限时训练。

完成条件：raw answer 保留在 finalized record 中，observed issue 与 cause 分离，readiness 更新引用该 record，下一项训练已经落入计划。

## Readiness

使用 readiness，不使用 mastery。字段固定为 accuracy、speed、coverage、stability 和 confidence；它是备考工作指标，不是真实预测分。评分规则读取 `references/review-and-cram.md`。每次更新只修改 record 的 `metrics` 实际测得的字段；high confidence 需要 source-backed questions 和 source-backed evidence。

## 错题复盘

区分 agent_observed_issue、suggested_causes 和 user_confirmed_cause；Agent 可以建议，用户最终定性。记录结构读取 references/review-and-cram.md。

## Cram

进入 cram 后，以考前速记为主，不展开系统课程。如果用户要求补知识，只围绕高频题型和当前错题补最短路径，不创建 learning-course 任务。cram 输出结构读取 references/review-and-cram.md。

## 导出

默认导出 Markdown；HTML 只用于交互 drill、计时练习和 checklist。输出放入 exports/。

## 参考路由

- 创建、恢复或验证考试包：读取 references/exam-state.md。
- 进入 diagnose、plan、drill、review、mock、cram 或 postmortem：读取 references/workflows.md 的对应分支。
- 导入资料、抽题、生成变式题或处理题型：读取 references/question-handling.md。
- 复盘错题、估算 readiness、模考或冲刺：读取 references/review-and-cram.md。
- 生成交互选择、填空、短答或计时练习：复制并改造 assets/drill-template/index.html。
- HTML drill 包含公式时：读取 references/math-rendering.md，并保留无 KaTeX 时的纯文本后备。
- 需要查看完整包格式或调试 validator：读取 assets/example-exam/；日常备考不要修改示例包。

## 验证

修改考试包后运行：

~~~text
python scripts/validate_exam.py <exam-dir> --strict-schema
~~~

修改 skill 本身后运行 skill validator：

~~~text
python -X utf8 <skill-creator>/scripts/quick_validate.py <skill-dir>
~~~
