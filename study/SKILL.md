---
name: study
description: "学习入口：推荐四种学习体验，并直接查询学习包的只读进展报告。"
disable-model-invocation: true
---

# Study Router

学习活动按目标推荐四个体验型 skill；进展查询由本入口直接执行只读报告。用户无需选择来源登记、报告或交接等基础设施入口。

## 意图路由

| 用户目标 | 推荐激活 |
|---|---|
| 设计或执行 AI 辅助学习循环、AI 导师提示词、长期复盘或 Obsidian 学习工作流 | `$ai-study` |
| 长期系统学会一个主题（多课课程、持续掌握、课程包续学） | `$learning-course` |
| 准备一场考试（日期、分数、真题、刷题、模考、readiness） | `$exam-prep` |
| 复习到期知识点（间隔复习、交错练习、遗忘曲线） | `$spaced-review` |

用户提供 PDF、教材或讲义时，按资料服务的学习目标推荐 `$learning-course` 或 `$exam-prep`；已有包按包类型推荐对应 skill，由它内部注册来源。跨包补课和返回交接由当前包的体验型 skill 内部处理。

## 进展查询

用户询问掌握情况、薄弱点、证据覆盖或下一步时，读取 `references/progress-report.md` 并执行：

```text
# 从 study/ 目录执行；目标包路径使用绝对路径
python scripts/build_report.py <package-dir>
```

默认只输出报告；用户要求保存时使用 `--out REPORT.md`，仅写包内 `exports/`。按 confirmed / inferred / unknown / self-reported 呈现结论并引用记录，区分活动量与证据量。需要实际学习时再推荐对应体验型 skill。

完成标准：目标包明确、报告生成成功、关键结论有依据、下一步具体且未修改学习状态。输入缺失或损坏时说明原因，多个候选包时确认目标。

## 使用方式

四个体验型 skill 保持独立显式激活；router 推荐学习活动，用户选择后激活：

```text
$learning-course 继续上一课
$exam-prep 我两周后考概率论，先建立备考包
$study 查看我的概率论课程包的学习进展
```

学习路由完成标准：用户清楚下一步该激活哪个体验型 skill，以及用它做什么。
