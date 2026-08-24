---
name: learning-handoff
description: "Create bounded cross-package handoffs: turn an exam gap into a mini-course, then return with verifiable evidence."
disable-model-invocation: true
---

# Learning Handoff

在考试包和课程包之间建立显式交接：把暴露的漏洞转成一次有边界的补课，补完带着可验证的证据回来。两个包始终保持独立。

## 核心约束

- 只通过交接文件传递（artifact coupling）：不直接修改对方包的内部状态。
- 补课有边界：boundary 的 include/exclude 划定范围，防止补课无限扩张。
- 返回条件可验证：至少一条"看到什么记录才算完成"的条件。
- 漏洞来源可追溯：交接记录引用源包的具体 record。

## 工作流程

1. **从漏洞出发**：定位源包中暴露缺口的已定稿 record（如一次 review 暴露的条件概率错误）。

2. **创建交接**：

   ```text
   python learning-handoff/scripts/create_handoff.py <source-pkg> \
     --record records/R0012.md --target-pkg <补课包目录> \
     --goal "能区分条件概率的分母和分子" \
     --include "conditional probability" --include "denominator selection" \
     --exclude "full probability course" \
     --return-condition "one finalized application record" --return-condition "one transfer task"
   ```

   完成标准：得到 `H####` 交接文件，保存在源包 `handoffs/`；boundary 与 return_condition 已填写。

3. **补课**：激活 `$learning-course`，在目标包目录创建有界 mini-course；以交接文件的 goal 和 boundary 为课程契约。补课按正常课程流程产生 finalized evidence。

4. **返回**：

   ```text
   python learning-handoff/scripts/complete_handoff.py --handoff <H####.md> --returned-record <目标包内记录路径>
   ```

   完成标准：交接状态变为 returned，returned_record 指向目标包内已定稿记录。

5. **回到原包**：在源包 `PLAN.md` 写入一个可验证的下一步（引用 H####），不复制课程状态。

6. **验证**：

   ```text
   python learning-handoff/scripts/validate_handoffs.py <package-dir>
   ```

   完成标准：所有交接文件通过校验；交接链条完整可追溯。

## 参考路由

| 需要什么 | 读取 |
|---|---|
| 交接字段契约与规则 | `../../shared/schemas/handoff.schema.yaml` |
| 记录字段契约（校验 returned_record） | `../../shared/references/record-contract.md` |
