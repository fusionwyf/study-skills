# Review Session 设计

设计复习任务、给表现分级、组织一次复习 session 时读这里。间隔数值算法在 `shared/scripts/spaced_repetition.py`，本文档不复述数值。

## 任务类型

五种 `review_kind`，按目的选择：

- **retrieval** 延迟回忆：首次复习的默认形态。要求直接提取，不用选择题。
- **explanation** 解释：要求说出为什么、边界条件或反例，暴露理解漏洞。
- **variation** 变式：同一概念换参数、换表象、换提问方向。
- **transfer** 迁移：把方法带进全新场景，是掌握的关键证据。
- **error_discrimination** 错误辨析：针对上次错误的混淆点做对照辨析。

选择规则（脚本给建议，可依据最近记录改判）：

1. `review_count == 0` → retrieval。
2. 上次 `performance == poor` → error_discrimination。
3. 其余 → 在 variation / transfer / explanation 中轮换；每个 session 至少包含一项 variation 或 transfer。

## 表现分级

- **good**：独立完成，无提示，核心步骤正确。
- **medium**：独立完成但有瑕疵，或使用提示后完成。
- **poor**：未完成，或核心步骤错误。

`hint_used` 独立于 `performance` 记录：提示后做对是 medium，不是 good。

## Session 组织

- 有时间边界：覆盖全部到期项，或到达时间盒即停；剩余项明确延期并说明原因。
- 交错：不同目标的任务交替出现，不按目标分块连做。
- 出题依据：目标定义加最近记录中的错误模式；考试包参考 `error-log.md` 的 recurring_patterns。

## 间隔语义

原则：good 延长间隔，medium 微调，poor 重置到短间隔；variation 和 transfer 支持更长的延长。每次调整都由 `complete_review.py` 在写入记录的同一事务里完成，保证队列与记录一致。
