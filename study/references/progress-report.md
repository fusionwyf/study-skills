# Study Report

由 `$study` 在用户查询进展时执行：读取包的状态与记录，生成一份可追溯的进展报告。只观察，不改变任何学习状态。

## 核心约束

- 只读：不修改 `course.yaml`、`exam.yaml`、records、queue 或任何来源文件。
- 每个重要结论都引用具体 record 或来源；没有证据就说 unknown。
- 区分四类信息：confirmed（有定稿强证据）、inferred（依赖推断或弱证据）、unknown（无证据）、self-reported（仅学习者自述）。
- 完成活动不等于掌握：报告同时呈现活动量与证据量。

## 工作流程

1. **定位包**：从用户提供的路径或当前上下文定位目标包（含 `course.yaml` 或 `exam.yaml`）。多个候选包时先确认目标；没有包时说明缺少可报告状态，不新建包或编造掌握度。

2. **生成报告**：

   ```text
   # 从 study/ 目录执行；目标包路径使用绝对路径
   python scripts/build_report.py <package-dir> [--out REPORT.md]
   ```

   默认输出到 stdout；用户要求保存报告时才传入 `--out REPORT.md`。`--out` 只能写包内 `exports/` 下的报告文件，其余文件保持字节不变。失败时说明缺失或损坏的输入，不修补学习状态。

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
