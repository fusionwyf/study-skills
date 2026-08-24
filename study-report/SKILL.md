---
name: study-report
description: "Read-only progress report across a study package: evidence coverage, weak spots, due reviews, and next actions."
disable-model-invocation: true
---

# Study Report

回答"学得怎么样"：读取包的状态与记录，生成一份可追溯的进展报告。只观察，不改变任何学习状态。

## 核心约束

- 只读：不修改 `course.yaml`、`exam.yaml`、records、queue 或任何来源文件。
- 每个重要结论都引用具体 record 或来源；没有证据就说 unknown。
- 区分四类信息：confirmed（有定稿强证据）、inferred（依赖推断或弱证据）、unknown（无证据）、self-reported（仅学习者自述）。
- 完成活动不等于掌握：报告同时呈现活动量与证据量。

## 工作流程

1. **定位包**：确认目标包目录（含 `course.yaml` 或 `exam.yaml`）。

2. **生成报告**：

   ```text
   python study-report/scripts/build_report.py <package-dir> [--out REPORT.md]
   ```

   完成标准：得到结构化报告；不带 `--out` 时输出到 stdout。`--out` 只写指定的报告文件，其余文件保持字节不变。

3. **解读与建议**：基于报告数据向用户呈现关键发现，逐条标注依据（record 路径或来源 id）；下一步建议具体到一次可执行的学习动作。

## 报告结构

```text
当前目标
证据覆盖率
已确认能力        # confirmed
仍不确定能力      # inferred / unknown / self-reported 分列
最近错误模式
到期复习
风险
下一步建议
```

## 参考路由

| 需要什么 | 读取 |
|---|---|
| 证据等级语义（什么算 confirmed） | `../../shared/references/transfer-rubric.md` |
| 记录字段契约 | `../../shared/references/record-contract.md` |
| 复习队列一致性 | `../../shared/schemas/review.schema.yaml` |
