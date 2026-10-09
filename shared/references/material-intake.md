# Material Intake

向课程包或考试包导入资料、摘录原文、记录主张或检查资料冲突时读这里。此流程由当前学习 skill 执行，无需切换用户入口。

## 注册与验证

以下命令从 study-skills 仓库根目录执行；目标包路径使用绝对路径。

1. 定位资料服务的包。考试包沿用根目录 `SOURCES.md` 与 `source-materials/`；课程包与独立工作区使用 `sources/SOURCES.md` 与 `sources/<source_id>/`。已有来源先检查索引，引用原 `S###`。
2. 注册新来源：

   ```text
   python shared/scripts/register_source.py <package-dir> \
     --title "<标题>" --type <textbook|paper|webpage|lecture_notes|past_paper|syllabus|user_notes|other> \
     --reliability <official|course|user|synthetic|unknown> [--raw <原文件路径>]
   ```

   完成标准：分配 `S###`、写入索引、创建 `excerpts.md` 和 `claims.md`；本地原文件通过 `--raw` 保留副本。原文只增不改，无法判断可靠性时记 unknown。
3. 按下文四区分填充当前任务所需摘录与主张。外部事实有来源或显式标记 unverified；冲突主张标为 contested 并记录取舍依据。
4. 下游题目在 `source` 字段引用 `S###`；课程内容按 `../../learning-course/references/lesson.md` 的组件契约携带来源状态；合成派生物注明 `synthetic-from-*`。
5. 验证注册表：

   ```text
   python shared/scripts/validate_sources.py <package-dir>
   ```

   考试包登记或题库变化后，另运行 `python exam-prep/scripts/update_exam.py <package-dir> --sync-materials`，再按考试包流程验证。

完成标准：索引通过校验，下游内容可回查摘录或已标记未验证，考试包 materials 与实际资料及题库一致。来源校验只检查结构与引用；主张是否得到原文支持由 Agent 对照摘录核验。

可靠性、合成标记和冲突原则见 `source-provenance.md`；字段契约见 `../schemas/source.schema.yaml`。

## 四区分

处理资料的每一段输出都要能归入其一：

- **原文事实**：逐字摘录，标注章节、页码或位置。不改写。
- **来源摘要**：用自己的话压缩来源内容，注明"摘要自 S###"。
- **Agent 推断**：由来源推出但来源未明说的结论，标注推断及依据链。
- **Agent 生成**：练习题、示例、变式等生成物，携带合成标记。

前两类可以当作来源事实引用；后两类引用时必须保留标记。

## 材料转化

登记与摘录完成后，按当前学习目标选择一种转化。先确定覆盖范围、难度和可检查成果；保留题干、答案与评分依据的分离。生成物与逐字抽取物使用不同来源标记。

| 来源 | 转化 | 输出位置 | 追踪要求 |
|---|---|---|---|
| 教材章节 | 抽取原题，或生成基础/变式/迁移练习 | 考试包 `question-bank/`；课程包 lesson 或 `reference/` | 原题 `source: S###`；生成题 `synthetic: true`、`source: synthetic-from-S###`，附摘录位置 |
| 论文 | 论证结构：问题、主张、证据、假设、限制、反例 | 课程 `sources/S###/claims.md`；考试 `source-materials/S###/claims.md` | 每条 claim 回指 excerpt 的章节/页码，推断单独标记；论文没有报告的结果记 unverified |
| 讲义 | 检索卡片或按需导出 Anki TSV | 课程 `reference/`；考试 `exports/` | 生成卡片注明 `synthetic-from-S###` 和位置，答案核验原文；不宣称已导入 Anki |
| 真题 | 参数、表征或条件变化的变式 | 考试 `question-bank/`；课程 lesson 或 `reference/` | `synthetic: true`、`source: synthetic-from-Q####`，保存原题到 S### 的来源链 |
| 任意材料 | 模拟口试题与逐轮追问、评分要点 | 考试 `drills/`；课程 lesson 的 `dialogue-practice` | 题目/评分点引用 S### 与位置，预写追问和生成情境保留合成状态 |

教材/真题可先用 `python exam-prep/scripts/build_question_bank.py <material.md> <exam-dir> --output <bank.jsonl> --source-id S###` 从 Markdown/text 抽题，再人工核对原文并补评分点。PDF 先用可用解析工具或人工摘录转成文本；脚本不直接解析 PDF。`--source-id S###` 只适用于原文抽取，不为生成题伪造原始来源。

完成标准：覆盖当前目标，每个产物都能回查来源或明确标记合成/未验证，答案已对照原文核验，输出放在对应包的目录。转化材料不是掌握证据；后续仍让学习者先尝试再评估。

## 摘录纪律

- 只摘当前任务需要的章节；大文件保留原文，按需摘录。
- 每条摘录带位置信息（章节、页码或小节标题），下游能回查。
- 公式、定义、数据优先逐字；叙述性内容可摘要但注明。

## 主张（claims）

`claims.md` 记录"这段资料支持什么"：

```markdown
- claim: 条件概率 P(A|B) = P(A∩B)/P(B)
  source: S001
  location: §3.2
  status: sourced        # sourced | unverified | contested
```

- **sourced**：有摘录支撑。
- **unverified**：暂无来源，显式可见。
- **contested**：与其他来源冲突，注明依据什么取舍。

下游题目、lesson 内容引用主张时引用其 `source` 与 `location`。

## 冲突检查

两个来源对同一事实说法不一致时：

1. 按可靠性层级取舍（official > course > user > synthetic）。
2. 把落选说法记为 contested，注明取舍依据。
3. 不静默丢弃任何一方。
