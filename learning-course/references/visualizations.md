# 数学与计算机可视化

创建数学图形、数值图表、几何或算法交互时读取。已有公式仍走 `math-rendering.md`，不必安装本组件包。

## 按问题选组件

| 学习任务 | 已提供组件 | 输入与约束 |
|---|---|---|
| 函数、统计曲线、矩阵热图、三维曲面 | Plotly 4.1.2 | `scatter` 的 x/y 数组或 `surface`/`heatmap` 的 x/y/z 网格；有限数值，明确采样域、步长和误差 |
| 坐标几何、二维线性变换 | JSXGraph 1.14.0 | 当前封装为 2×2 矩阵作用于可拖动向量；输出点从输入点实时计算，等单位比例；数字框可键盘操作 |
| 数组算法、循环与复杂度 | 无依赖的算法步骤回放 | 当前提供选择排序，状态来自真实比较/交换；数组、关注位置、代码行、操作计数联动，支持前后步和滑杆 |

几何封装支持旋转、剪切、缩放、投影等二维矩阵；一般尺规构造、三维几何、其他算法需要扩展封装，不能声称已经支持。Plotly 三维需要 WebGL，失败时保留数值说明。

库资源随 skill 仓库提供，课程按需复制。页面无 CDN 请求。版本、上游地址、归档完整性与文件 SHA256 见 `assets/visualizations/vendor/manifest.json`，每个库保留许可证。JSXGraph 按其 MIT 许可使用。

## 安装与示例

从 `learning-course/` 运行，目标课程先用 `scripts/init_course.py` 初始化：

```text
python scripts/install_visualizations.py <course-dir> --components plot geometry algorithm
```

只用算法时传 `--components algorithm`，不复制第三方库。已有组件目录会拒绝覆盖；确定要更新本组件资源时用 `--force`。更新组件资源后仍需独立验证课件。

完整可运行样例：`assets/visualizations/demo.html`。可直接在浏览器打开，无需安装服务或联网。它是组件展示，不是现成课程契约；为真实课件选择与本课目标相关的一两个组件，保留 evidence 与反馈区。

课件加入基础组件 CSS/JS，并只引入用到的库（下面路径相对 `lessons/`）：

```html
<link rel="stylesheet" href="../assets/visualizations/visualizations.css">
<!-- geometry 时才需要这一项 -->
<link rel="stylesheet" href="../assets/visualizations/vendor/jsxgraph/jsxgraph.css">
<!-- plot 时才需要这一项 -->
<script src="../assets/visualizations/vendor/plotly.js-dist-min/plotly.min.js"></script>
<!-- geometry 时才需要这一项 -->
<script src="../assets/visualizations/vendor/jsxgraph/jsxgraphcore.js"></script>
<script src="../assets/visualizations/visualizations.js"></script>
```

### 数据与标记

每个容器：唯一 `id`、`data-visualization="plot|geometry|algorithm"`，内部包含：

- 唯一 `id` 的 `data-viz-host`（初始 `hidden`，样式类 `viz-host`）。
- 永久可读的 `data-viz-fallback`（样式类 `viz-fallback`），写模型、范围、精度、核对数值/步骤和核心结论；不能只写“需要启用 JS”。
- `data-viz-status role="status"` 显示当前数值或步骤。
- 单个 `<script type="application/json" data-viz-config>`，包含 `model`、`domain`、`precision` 的非空说明及下面的数据。

JSON 里的 `<` 编码为 `\u003c`，避免 `</script>` 截断数据。不接受可执行的表达式字符串，不用 `eval`。

plot：`traces` 为 Plotly 数据列表，`layout` 为坐标轴/标题布局。只接收 scatter、surface、heatmap。断点用不同 trace 或 `y: null`，强制 `connectgaps: false`；不要让未知奇点靠自动检测。surface/heatmap 的 `z[row][column]` 对应 `y[row]`、`x[column]`。

geometry：`matrix: [[a,b],[c,d]]`、`vector: [x,y]`。`data-viz-controls` 内按 x、y 顺序放两个有 label 的 `number` 输入框，范围 −1000…1000；初始 hidden，样式类 `viz-controls`。组件保留真实浮点状态，读数显示 8 位有效数字。x/y 单位等比例，超出视域的键盘输入会调整视域。打印显示作者写明的默认核对点。

algorithm：`input` 为 2–32 个有限数字。`data-viz-controls` 包含有 label 的 range（min=0、step=1）、`data-viz-prev` 和 `data-viz-next` 按钮，初始 hidden；代码列表用 `data-code-line="0"`…`"5"` 与示例语义对应。当前不支持任意代码执行或自选算法名称。

可复现绘图数据示例：

```text
python scripts/build_visualization_data.py reciprocal --output reciprocal.json
python scripts/build_visualization_data.py surface --output surface.json
```

将结果内联到 `data-viz-config`，不依赖浏览器 fetch（兼容本地 file 打开）。其他函数/模型由可信计算代码生成；复杂模型可用 SymPy、NumPy、SciPy，成品静态图可用 Matplotlib。这些 Python 库不是本 skill 的必装依赖，也尚未作为执行环境捆绑。

## 准确性与教学检查

1. 定义模型与假设：函数定义域、单位、奇点、坐标约定、算法输入限制。
2. 核对至少三个解析值/边界点；矩阵用代数检查 Av，算法检查数组元素多重集、已排序前缀及比较计数。
3. 写明数值精度、网格/采样步长和插值限制。需要误差保证时给出可核查的界，不能由图像“看起来平滑”推断。
4. 保持几何等单位比例；概念示意允许不按比例，但显式注明。三维透视角度不能作为等长、正交证据。
5. 安排“预测 → 探索 → 解释/推导 → 无辅助变式”；浏览、拖动和播放本身不作为 application/transfer。

SVG 可以用于计算生成的准确二维图形，问题在于手工猜路径。概念流程图可用 Mermaid 或 Graphviz 自动布局；仓库没有捆绑这些库，也不将其用于数值曲线。

## 降级、打印与记录

无 JS、库缺失或配置错误时，保留文字、数值表、步骤表与练习，状态区说明失败原因，不显示空白实验区。控件支持键盘，不自动播放动画。

Plotly 尝试生成初始视角的本地 PNG 用于打印；打印隐藏交互区域和控件，始终保留后备说明。几何与算法默认打印静态核对点/逐轮表，不能把打印图误称为最新交互快照。需要打印当前参数时另行生成并注明参数。

支持浏览器自动化时，在截屏/导出前等待 `window.__COURSE_VISUALIZATIONS_READY__ === true`，随后逐组件检查 `data-viz-ready="true"`，再等待字体和可选公式就绪。全局就绪表示初始化结束，失败组件仍可能存在；需要图像时也检查 `data-snapshot-status`。命令行 PDF 导出以等待预算和后备内容保障可读，不能只因退出码为零就宣布图像验证通过。

`course.js` 复制记录时包含当前参数/步骤，不记录完整交互历史，也不评估 mastery。解释答案仍使用稳定的 `data-question-id`、label/textarea，并按记录契约判断辅助程度。

已有课程若使用旧版 `assets/course.js`，需将新模板的可视化观察导出逻辑合并到课程脚本后再验证；安装器仅复制可视化组件资源，不覆盖课程自己的脚本。

运行课程验证时，`--pedagogical` 检查组件标记、JSON、模型说明、后备内容与键盘控件。它不证明公式或算法正确；数值模型和新增算法仍需独立不变量测试、真实浏览器交互检查。

## 后续值得加入的组件

优先按真实学习目标扩展，不将所有组件默认塞进一课：

| 建议组件 | 学习价值 | 验收方式 |
|---|---|---|
| 矩阵行变换与消元实验 | 联动方程、矩阵、秩、解空间；下一步先让学习者预测 | 分数精确运算；保持等价解集；处理奇异矩阵 |
| 证明步骤与反例探索 | 区分结论、前提、依据，暴露遗漏条件 | 人工/符号核验；不能用关键词或 LLM 判断声称形式证明 |
| 概率与统计模拟 | 比较理论分布、经验频率、置信区间和样本量 | 固定随机种子、多次重复、理论值与采样误差 |
| 代码执行与测试实验台 | 让学习者改代码、运行测试、检查故障 | 本地隔离执行、资源限制、原始输出；不用浏览器 eval 执行任意代码 |
| 树/图遍历与调用栈 | 联动 BFS/DFS 队列、递归栈、访问顺序 | 从真实执行生成状态；验证可达性、不重复访问和边界图 |
| 复杂度对照实验 | 将操作计数与 n、n log n、n² 相比较 | 明确输入分布与计数单位，区分操作次数和墙钟时间 |
| 先修知识诊断图 | 把一次错误定位到可验证的前置缺口 | 缺口判断关联原始记录；每条补课建议有返回测试 |

最先做矩阵实验、概率模拟和代码测试台：分别填补“代数步骤”“不确定性”“独立产物”三类证据。目前表内组件为建议，未宣称已实现。
