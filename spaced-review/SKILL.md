---
name: spaced-review
description: "Run due spaced-repetition review sessions against a course or exam package."
disable-model-invocation: true
---

# Spaced Review

执行到期复习：读取包的 `review_queue`，组织一次有时间边界的复习 session，把每次复习落成记录并更新间隔。

## 核心约束

- 复习测试记忆和迁移，不重放原题：优先变式、迁移、错误辨析；纯回忆检索只用于首次复习。
- 每个到期项必须有明确结果：完成（写记录）、延期（说明原因并顺延）、失败（降级处理）。
- 间隔变化必须能追溯到一条复习记录；没有记录就没有间隔变化。
- 只读写目标包自己的 `review_queue` 和 `records/`，不修改课程目标、mastery、readiness。

## 工作流程

1. **定位包**：确认目标包目录（含 `course.yaml` 或 `exam.yaml`）。读取 `references/review-session.md`。

2. **计算到期项**：

   ```text
   python scripts/build_review_session.py <package-dir>
   ```

   完成标准：得到到期项列表及每项的建议任务类型；列表为空则告知用户无需复习并结束。

3. **执行复习 session**：按建议任务类型逐项出题，限时作答，逐字保留原始回答。一次 session 覆盖全部到期项，或到达时间盒即停并把剩余项明确延期。

4. **落记录并更新队列**（每项一次调用）：

   ```text
   python scripts/complete_review.py <package-dir> --objective-id <id> | --topic <t> \
     --review-kind <retrieval|explanation|variation|transfer|error_discrimination> \
     --performance <good|medium|poor> --hint-used <true|false> \
     --evidence-strength <strong|medium|weak> \
     --raw-answer "<学习者原话>" [--next-action "<下一步>"]
   ```

   完成标准：脚本确认记录已写入且队列已更新；延期项不调用本步，直接在队列中顺延。

5. **验证**：

   ```text
   # 跨 skill 验证：从 study-skills 仓库根目录执行
   python learning-course/scripts/validate_course.py <pkg> --strict-schema --pedagogical   # 课程包
   python exam-prep/scripts/validate_exam.py <pkg> --strict-schema                        # 考试包
   ```

   完成标准：validator 通过，queue 与 records 一致。

## 参考路由

| 需要什么 | 读取 |
|---|---|
| 任务类型选择、表现分级、session 组织 | `references/review-session.md` |
| 复习记录字段契约 | `../shared/references/record-contract.md` |
| 队列条目字段与一致性规则 | `../shared/schemas/review.schema.yaml` |
