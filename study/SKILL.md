---
name: study
description: "Study skills 路由入口：判断学习意图，推荐应激活的叶子 skill。"
disable-model-invocation: true
---

# Study Router

只做推荐，不执行教学。判断用户目标属于哪一类，然后明确告诉用户下一步激活哪个 skill。

## 意图路由

| 用户目标 | 推荐激活 |
|---|---|
| 设计或执行 AI 辅助学习循环、AI 导师提示词、长期复盘或 Obsidian 学习工作流 | `$ai-study` |
| 长期系统学会一个主题（多课课程、持续掌握、课程包续学） | `$learning-course` |
| 准备一场考试（日期、分数、真题、刷题、模考、readiness） | `$exam-prep` |
| 复习到期知识点（间隔复习、交错练习、遗忘曲线） | `$spaced-review` |
| 从资料建立课程或抽题（PDF、教材、讲义、来源追踪） | `$source-grounded-study` |
| 查看学习进展（掌握情况、薄弱点、证据覆盖、下一步） | `$study-report` |
| 把错题转成补课 / 补完回到备考（跨包交接） | `$learning-handoff` |

## 使用方式

每个叶子 skill 独立激活、独立使用；router 不能替用户激活它们：

```text
$learning-course 继续上一课
$exam-prep 我两周后考概率论，先建立备考包
```

完成标准：用户清楚下一步该激活哪个 skill，以及用它做什么。
