# 资产选择、引入与验收

创建或修改 HTML 课件时读取。本协议减少 agent 在目录、安装、DOM 接线和能力限制之间的猜测。

## 选择

`assets/catalog.json` 是能力、文件、依赖和交付方式的权威来源。只读取当前任务相关条目中的 supports/limitations/example；按教学目标选最小组合。roles 与 delivery 是两个维度：

| role | 职责 | 例子 |
|---|---|---|
| common | 状态、回答、提示与原话记录 | course-runtime、state-runtime、media |
| rendering | 数据或标记到通用视图 | chart、relation、timeline、公式、代码着色 |
| specialized | 课程领域模型与图元 | 概率抽样、电路、几何构造 |

| delivery | 引入 |
|---|---|
| default | 初始化复制，依照模板加载 |
| optional | install_optional.py 从目录解析依赖、校验文件并登记安装 |
| external | 按条目的 network 规则加载；课程要求完全离线时预置本地资源 |
| extension | 在课程 assets/extensions/ 实现与登记，完成运行验收后使用 |

课程 `asset-manifest.json` 是安装事实，不是能力目录；`components.json`、`optional/manifest.json`、`adapters.json` 是目录投影。目录维护后运行 `sync_asset_catalog.py`，用 `--check` 检测漂移。模板副本同步后进行 byte-identity 回归。

静态 HTML/SVG 足够表达目标时直接使用，并保留可访问的说明。运行时组件只能调用已实现接口；planned 与 extension-required 名称必须先实现。LessonSpec 只校验规划，当前不生成整页。

## 引入

从 skill 目录运行 `python scripts/install_optional.py <course-dir> --components <names>`。安装器解析目录依赖、读取与合并 manifest、校验全部 vendor 文件、检查冲突，之后写入；失败回滚。已修改文件受保护，只有确实需要替换时使用 --force。

页面顺序：LearnKit → course.js → 课程领域模型注册 → 可视化内核 → 用到的 kinds；media 在 course.js 之后。依赖链不使用 async，不混用前置 defer 与后置立即执行。chart/spatial 从同课程 vendor 加载。code-highlight 先引入主题选择脚本，再引入着色脚本。

安装与页面引入是独立步骤；没有引用的资源不会自动生成组件。CSS 顺序为基线 → 可视化/按需样式 → 课程覆盖。动态模型的数据绑定见 render.md。

完全离线：chart/spatial 使用已校验的本地 vendor；KaTeX 本地包含同版本 JS/CSS/fonts，highlight.js 先注册本地 window.hljs；音视频、图片与字幕也留在包内。安装器当前不自动下载这些外部资源；agent 需准备、替换引入并实际断网验证。无法实现时报告具体限制。

## 专用扩展

先写课程资产；模型用 registerModel，专用画布用 registerRenderer 或 registerKind。课程 registry 添加 name/tier=extension/module，module 路径相对 assets/visualizations（可用 ../extensions/name.js）。JSON 只承载数据，计算函数由受约束的注册模型提供。

所有扩展实现 validate/render；使用 data-viz-source 时实现 update，持有资源时实现 destroy。导出参数与步骤为观察记录，掌握评估仍走 records。专业计算优先预计算步骤或独立模型，通用内核不添加学科算法。sequence 的 input 保留选择排序兼容用法，新算法使用 steps 或课程模型。

## 验收

1. build_index 与 validate_course --strict-schema --pedagogical 通过。检查 installed 文件、vendor 校验值、核心/模块/样式引入、顺序、数据形状与 source id。
2. 新组件或领域模型实际打开页面，检查 course-ready/lk-ready/viz-ready/media-ready；总 ready 只表示处理结束，逐容器 failed 必须检查。
3. 至少改变一个输入，核对图形、数值、状态、reset/前后退与边界。键盘操作与 375px 窄屏无水平溢出；记录中保留原话和提示，观察记录不等于掌握。
4. 无脚本与打印时核心模型、任务、文字稿、步骤与核对点可读。导出需要另检查分页与裁切。

验收课件源在 assets/acceptance-course；`prepare_acceptance.py <空目标目录>` 生成完整可运行包。六类分别覆盖数学推导、概率联动、算法轨迹、模拟历史材料、设计图片标注、听辨媒体。听力使用原创英文句子的本地合成语音验证流程，不代表自然语音训练效果。专业媒体、复杂图布局和学科仿真仍按 extension 处理。
