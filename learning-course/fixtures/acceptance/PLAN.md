# 六类资产验收

这些是能力样本，不代表真实学习者已经完成课程。数学/算法/概率使用原创推演；历史与设计使用明确标注的模拟材料；听力使用 Microsoft Zira Desktop 合成原创英文短句，只验收播放与作答流程，不代表自然语音训练效果。

默认组件负责结构、记录和通用视图；概率模型通过 registerModel 注册；复杂专用模型留在课程中。共享资源由 init_course.py 与 install_optional.py 生成，不重复维护副本。

验收：结构校验、图表联动、步骤前后退、键盘热点、数值容差、填空匹配、原话记录、窄屏与打印后备。

制作约定：成熟第三方库优先，允许固定版本 CDN。算法代码用 highlight.js 11.12.0 CDN 引擎与官方 GitHub 明暗主题；数学排版用 KaTeX 0.16.11 CDN JS/CSS/auto-render。图表与几何使用已登记版本的本地 Plotly/JSXGraph。课程主题在 assets/theme.css 定制，assets/theme.js 登记课程主题与第三方渲染设置；续课复用。库的降级可读性与正常渲染分开验收。
