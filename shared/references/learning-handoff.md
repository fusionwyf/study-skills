# Learning Handoff

在考试包和课程包之间建立显式交接：把暴露的漏洞转成一次有边界的补课，补完带着可验证的证据回来。两个包始终保持独立。

此协议由 `exam-prep` 的 review 或 `learning-course` 的 continue 内部读取。用户只需决定是否补课，不需要选择一个交接 skill。

## 触发与续接

- 考试 review：finalized record 暴露系统性前置漏洞，当前题型内的提示或变式不足以修复时，说明漏洞、mini-course 的目标、include/exclude 与返回条件。cram 保持最短补救路径，不创建新课程交接。
- 课程 continue：先检查用户给定的交接文件和当前包 `handoffs/`。incoming 交接按其 goal 与 boundary 续学；outgoing 交接有返回证据时执行返回分支。
- 当前课程内可补的前置直接按正常 continue 教学。只有需要独立维护的有界补课包时才创建新的 outgoing 交接；先说明依据和边界，学习者选择补课后执行。
- 已有对应 open 交接时复用，避免为同一漏洞重复建包。目标 skill 保持显式激活策略：建议补课时给出一次 `$learning-course` 调用，附目标目录与交接文件路径；不声称内部激活了该 skill。

## 核心约束

- 只通过交接文件传递（artifact coupling）：不直接修改对方包的内部状态。
- 补课有边界：boundary 的 include/exclude 划定范围，防止补课无限扩张。
- 返回条件可验证：至少一条"看到什么记录才算完成"的条件。
- 漏洞来源可追溯：交接记录引用源包的具体 record，且来源与返回证据都通过共享 record contract 校验（不只检查 `assessment_status`）。
- `to.package` 在源包与目标包同盘时保存为**相对源包的路径**：整个工作区（源包+目标包）一起移动或同步后仍可用；跨盘符时退回绝对路径，移动工作区后需手动更新该字段。

## 工作流程

以下命令从 study-skills 仓库根目录执行；包与交接文件路径使用绝对路径。

1. **从漏洞出发**：定位源包中暴露缺口的已定稿 record（如一次 review 暴露的条件概率错误），确定目标目录、goal、include/exclude 和可观察的 return_condition。

2. **创建交接**：

   ```text
   python shared/scripts/create_handoff.py <source-pkg> \
     --record records/R0012.md --target-pkg <补课包目录> \
     --goal "能区分条件概率的分母和分子" \
     --include "conditional probability" --include "denominator selection" \
     --exclude "full probability course" \
     --return-condition "one finalized application record" --return-condition "one transfer task"
   ```

   完成标准：得到 `H####` 交接文件，保存在源包 `handoffs/`；boundary 与 return_condition 已填写。

3. **补课**：学习者显式进入 `$learning-course` 后，在目标包目录按 create/continue 工作流创建或续学有界 mini-course；以交接文件的 goal 和 boundary 为 `PLAN.md` 契约，并保存交接文件路径以便续接。目标包通过交接文件获取漏洞信息，不读取源包内部状态；正常课程流程产生 finalized evidence。

4. **返回**：

   ```text
   python shared/scripts/complete_handoff.py --handoff <H####.md> --returned-record <目标包内记录路径>
   ```

   调用前对照 return_condition 核验记录包含约定的可观察成果；脚本只验证记录结构、定稿状态和包内路径，不判断教学目标是否达成。完成标准：约定的返回条件已有证据，交接状态变为 returned，returned_record 指向目标包内已定稿记录。

5. **回到原包**：给出交接文件和 returned_record 路径，引导学习者回到源包的体验型 skill。该 skill 读取返回证据，在用户确认后把可验证的下一步写入自己的 `PLAN.md`（引用 H####）。交接本身不提升 mastery/readiness；仍按源包的证据更新流程处理。

6. **验证**：

   ```text
   python shared/scripts/validate_handoffs.py <source-pkg>
   ```

   完成标准：所有交接文件通过校验；交接链条完整可追溯。

## 参考路由

| 需要什么 | 读取 |
|---|---|
| 交接字段契约与规则 | `../schemas/handoff.schema.yaml` |
| 记录字段契约（校验 returned_record） | `record-contract.md` |
