# 资产验收记录

验收日期：2026-10-10。这里验证制作契约与组件行为，不代表学习者已掌握课程。

## 覆盖与扩展边界

| 课件 | 复用资产 | 仍由课程编写 | 验收结果 |
|---|---|---|---|
| 数学推导 | KaTeX、table、spatial、数值回答 | 差商推导、核对数据、容差 | CDN 公式排版、本地 JSXGraph、输入联动、数值回答原话通过 |
| 概率实验 | LearnKit、chart、数值回答 | Bernoulli 的 registerModel / reduce / derive | 参数变化同时更新状态与分类柱图通过 |
| 算法回放 | highlight.js、theme、sequence、process | 步骤、循环边、不变量与变式 | CDN 引擎与官方主题着色、深浅主题切换、下一步、键盘选择节点通过 |
| 历史材料 | timeline、relation、开放回答 | 明确标注的虚构材料、主张与证据关系 | 阶段标签、节点边与原文后备通过 |
| 设计观察 | media、开放回答 | 原创 SVG、百分比热点、评价标准 | 图片尺寸、键盘热点、原始观察记录通过 |
| 听辨流程 | 原生 audio、media、填空回答 | 合成语音、文字稿、接受答案与复述任务 | 实际播放、three 匹配、查看文字稿记录通过 |

可复用的通用骨架覆盖这些高频表达与回答流程；没有用统计样本证明“覆盖绝大多数课程”。复杂网络自动布局、专业几何、物理/生物仿真、自由绘制标注、语音识别评分仍需课程扩展。概率实验的领域计算留在课件模型中，通用内核只管理状态与呈现。

## 本次验证

- 仓库完整回归：107 项测试通过，无跳过。覆盖安装冲突前置检查、失败回滚、定制默认资源保留、目录投影、vendor 完整性、损坏登记文件、动态图表及异步失败、原话与媒体记录。
- 六课从维护源经过真实初始化、按需安装与索引生成；严格 schema 与教学结构校验通过。
- Chromium：六课初始化与交互通过；1200px 桌面、375px 窄屏无页面水平溢出；逐课截图检查。
- 禁用 JavaScript：六课正文与后备仍可读；打印媒体模式下后备可见，听力完整文字稿保留。
- 屏蔽本地 vendor 请求：chart 使用 SVG，spatial 使用矩阵核对表；二者输入变化仍能更新。
- CDN 正常：KaTeX 0.16.11 公式排版、highlight.js 11.12.0 引擎与官方主题着色通过；切换课程主题后官方样式跟随且源码不变。屏蔽 CDN 时保留代码与 LaTeX 原文。
- 额外检查：目录投影一致、skill 校验、JavaScript 语法、示例资源一致性与差异空白检查。

打印检查使用浏览器 print 媒体与截图，没有验证每一种 PDF 导出工具的分页。公式与代码着色已验证 CDN 正常渲染与失败降级，完全离线的本地引擎与主题部署仍按 references/render.md 和组件 README 另行验收。听力使用 Microsoft Zira Desktop 合成原创句子，不能据此断言自然听力训练效果。

## 复验

在 skills 仓库根目录运行；目标目录必须不存在：

```text
python learning-course/scripts/prepare_acceptance.py .tmp-asset-acceptance-review
python -m http.server 8766 --bind 127.0.0.1 --directory .tmp-asset-acceptance-review
```

另开终端，在已准备 Chromium 的环境中使用 Playwright CLI：

```text
npx --yes --package @playwright/cli playwright-cli -s=assets open http://127.0.0.1:8766
npx --yes --package @playwright/cli playwright-cli -s=assets run-code --filename tests/asset_browser_checks.js
npx --yes --package @playwright/cli playwright-cli -s=assets run-code --filename tests/asset_browser_fallbacks.js
```

浏览器脚本使用当前页面所在地址，截图输出至 output/playwright/。主机需有可用中文字体才能审阅中文截图；字体问题不应靠更改课件内容掩盖。普通使用可直接打开生成包的 index.html。
