---
name: source-grounded-study
description: "Register study materials and keep every extracted fact, question, and lesson traceable to its source."
disable-model-invocation: true
---

# Source Grounded Study

把资料接入学习系统：注册来源、摘录原文、追踪主张，让课程和题库里的每个外部事实都能回答"从哪来"。

## 核心约束

- 原始资料只增不改：登记后原文保持原样，摘录逐字并标注位置。
- 每个外部事实要么有来源，要么显式标记未验证。
- Agent 推断和生成内容不伪装成来源事实；合成内容永远携带标记。
- 来源注册遵循统一契约；课程包与考试包追溯同一套协议。

## 工作流程

1. **定位目标**：确认资料服务于哪个包（course / exam / 独立工作区）。读取 `references/material-intake.md`。

2. **注册来源**：

   ```text
   python scripts/register_source.py <package-dir> \
     --title "<标题>" --type <textbook|paper|webpage|lecture_notes|past_paper|syllabus|user_notes|other> \
     --reliability <official|course|user|synthetic|unknown> [--raw <原文件路径>]
   ```

   完成标准：脚本分配 `S###`、写入注册索引、创建摘录与主张文件。判断不了可靠性就记 unknown。

3. **摘录与主张**：按四区分（原文事实 / 来源摘要 / Agent 推断 / Agent 生成）填充 `excerpts.md` 和 `claims.md`。完成标准：当前任务需要的章节已摘录；每个支撑下游内容的 claim 都能指回摘录，或标为未验证。

4. **下游标注**：抽取的题目在 `source` 字段引用 `S###`；课程内容按 components 契约携带来源状态；合成派生物注明 `synthetic-from-*`。

5. **冲突检查**：笔记与教材冲突时按可靠性层级取舍，冲突本身记录为 contested claim，不静默取舍。

6. **验证**：

   ```text
   python scripts/validate_sources.py <package-dir>
   ```

   完成标准：注册表通过校验；无来源的外部事实已被标记。

## 注册索引位置

- 考试包沿用根目录 `SOURCES.md` 与 `source-materials/`。
- 课程包与独立工作区使用 `sources/SOURCES.md` 与 `sources/<source_id>/`。

两种位置使用同一字段契约（见参考路由）。

## 参考路由

| 需要什么 | 读取 |
|---|---|
| 可靠性层级、合成标记、冲突处理原则 | `../shared/references/source-provenance.md` |
| 来源条目字段契约 | `../shared/schemas/source.schema.yaml` |
| 摘录与主张的写法、四区分 | `references/material-intake.md` |
