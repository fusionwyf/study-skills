# learning-course HTML 课件 assets 重构计划(Course Kit v2)

状态:待执行。对应架构设计见同目录 `architecture.md`;两者冲突时以本计划第 2 节"已定决策"为准。
本文规定:做什么、按什么顺序、改哪些文件、怎样算完成。不含实现代码。

## 1. 目标与范围

### 1.1 目标
1. 技能内只保留一份资产源(`kit/`),课程包内的 `assets/kit/` 是生成物。
2. 主题成为 L1 基础设施,所有组件与第三方库配色由 token 驱动。
3. 代码块与数学块同属"块(block)",共用外壳与接入协议;作者只写语义 HTML。
4. 浮动目录重做为三态(侧栏/浮层/抽屉),scrollspy 与滚动行为正确。
5. `course.js`(824 行)按职责拆分;五份目录登记合并为一份模块描述符。
6. 统一就绪协议与单一入口接线。

### 1.2 非目标
- 不改 `course.yaml` schema v3、`exam.yaml` schema v2、记录契约(`shared/references/record-contract.md`)。
- 不改学习记录的字段与语义(`buildLearningRecord` 输出须逐字节等价)。
- 不新增学科领域模型;chart/spatial/relation 等 kind 的行为保持不变,只换位置。
- 不自动升级已生成的旧课程包(显式 `kit sync` 才升级)。
- 不做 LessonSpec 整页生成。

### 1.3 受影响面(已确认)
引用旧路径的文件:`SKILL.md`(13 处)、`scripts/init_course.py`、`install_optional.py`、`sync_asset_catalog.py`、`validate_assets.py`、`validate_course.py`、`prepare_acceptance.py`、`update_progress.py`(各少量)、`shared/scripts/validate_record.py`、`exam-prep/scripts/validate_exam.py`;测试 `tests/test_assets.py`、`asset_behaviour.cjs`、`optional_components.cjs`、`evidence_store.cjs`、`visualization_*.cjs`、`asset_browser_*.js`、`test_visualizations.py`、`test_open_components.py` 等。每个阶段必须同步这些引用,不留断链。

## 2. 已定决策(执行时不再讨论,变更需记入变更日志)

| # | 决策 | 理由 |
|---|---|---|
| D1 | 课程包内产物为单文件 `kit.js` + 单文件 `kit.css`(IIFE,不用 ES module) | `file://` 可打开,拷贝分发简单 |
| D2 | 第三方库默认固定版本 CDN + SRI;`config.json` 的 `vendor.mode=local` 切离线 | 保持现有"CDN 优先"硬规则 |
| D3 | 代码高亮配色继续走 CDN 官方 highlight.js 主题(固定版本);不自管 `--hl-*` palette。`config.json` 的 `code.themes: {light, dark}` 指定官方主题名或固定版本 URL,由主题引擎按当前 `data-scheme` 切换 | 用户决定;复用官方成熟配色,免维护 |
| D4 | 模块 presence 取 `core / auto / opt-in`;`auto` 由 `kit sync` 扫描课件决定 | 消除"用了代码却没安装"的失败模式 |
| D5 | 新作者契约为原生语义 HTML;旧 `.code-block` 等写法由 `kit sync` 规范化,validate 给 warning | 平滑迁移 |
| D6 | 旧就绪事件(`course-ready` 等)保留 shim 一个版本周期 | 导出脚本与外部验收不断 |
| D7 | `example-course`、`acceptance-course` 不再内置 `assets/`;fixtures 只含内容 | 消除重复副本 |
| D8 | CSS 使用 `@layer`;课程覆盖位于最后的 `course` 层 | 不靠加载顺序与权重 |
| D9 | `theme.js` 配置文件取消,并入 `assets/course/config.json` | 解除与切换器同名冲突 |
| D10 | 版本号:kit 从 `2.0.0` 起;技能 CHANGELOG 记录每个阶段 | 可追溯 |
| D11 | 题目统一为 `learning/question`,六种 `data-kind`;作答帮助方式由提示按钮点击自动判定,取消自述下拉 | 用户决定;减少学习者负担,证据来自可观察行为 |

## 3. 总体策略
- **先搬后改**:P1 只改位置与构建方式,行为零变化,用等价性测试守住。
- **双写过渡**:新旧契约同时被识别,直到六类验收课件全部通过后才切换默认。
- **每阶段独立可合并**:每个阶段结束时仓库全部测试通过,可单独提交与回退。
- **一阶段一提交序列**:阶段内按"测试先行 → 实现 → 文档"提交,不混阶段。

## 4. 阶段计划

### P0 冻结与基线(0.5 天)
做什么:
1. 将当前未提交的 `course.css/js`、`theme.css`、`validate_course.py` 改动评审后落库,或明确弃置;迁移期间不再并行修改三份副本。
2. 记录基线:运行 `tests/` 全量(Python + `.cjs` + 浏览器检查),保存输出为 `docs/baseline.txt`;对六类验收课件各截一张 375/768/1280 宽度截图作为视觉基线。
3. 为现有 `course.js` 公共接口列清单(`window.CourseRuntime`/LearnKit/CourseVisualizations 导出的方法),存入 `docs/api-baseline.md`,作为兼容性对照。

验收:基线测试全绿;清单与截图入库。

### P1 建立 `kit/` 并等价迁移(2–3 天)
做什么:
1. 创建目录:`kit/{core,foundation,content,shell,learning,viz,vendor,build}`、`templates/`、`fixtures/{gallery,acceptance}`。
2. 文件迁移(`git mv`,保留历史):

| 旧位置 | 新位置 |
|---|---|
| `assets/learnkit/learnkit.js` | `kit/core/store.js` |
| `assets/learnkit/{components.json,lesson-spec.schema.json}` | `kit/core/`(components.json 并入 module.json 后删除) |
| `assets/course-template/course.js` | 暂放 `kit/learning/_legacy-course.js`(P5 拆分) |
| `assets/course-template/course.css` | 暂放 `kit/foundation/_legacy-course.css`(P3/P4 拆分) |
| `assets/visualizations/visualizations.{js,css}` | `kit/viz/core/` |
| `assets/visualizations/kinds/*` | `kit/viz/kinds/<kind>/` |
| `assets/visualizations/vendor/*` | `kit/vendor/` |
| `assets/optional/{media,mermaid,code-highlight,theme}` | `kit/content/*`、`kit/shell/theme-switcher`(暂原样) |
| `assets/course-template/lesson.html` | `templates/lesson.html` |
| `assets/acceptance-course/{course.yaml,lessons,reference}` | `fixtures/acceptance/` |
| `assets/visualizations/demo.html` | `fixtures/gallery/viz.html` |

3. 为每个模块写 `module.json`(字段见架构 §3:id、layer、version、requires、presence、detect、provides、vendor、ready、degrade、print、tokens)。
4. 实现 `kit/build/kit.py`:`build`(汇总 manifest,拓扑排序,拼接为 `kit.js`/`kit.css`)与 `list`。此阶段 `kit.js` 仅按旧加载顺序拼接,不改代码。
5. 新增等价性测试:同一课件在"旧多文件接线"与"新 `kit.js` 接线"下,DOM 快照、学习记录输出、ready 事件一致。

验收:
- 全量基线测试通过(路径引用按 1.3 更新)。
- `kit build` 产物接线的六类验收课件与基线截图像素差在容差内。
- `catalog.json`、`optional/manifest.json` 等仍可由 `kit build` 生成并与旧版语义一致。

回退:整阶段为一个提交序列,`git revert` 即可。

### P2 去副本、改初始化与同步(2 天)
做什么:
1. 删除 `example-course/assets/**` 与 `acceptance-course` 内的资产副本;`.gitignore` 忽略课程包 `assets/kit/`。
2. `init_course.py`:不再逐文件 `shutil.copy2`;创建课程骨架后调用 `kit sync`,并写入 `assets/course/{config.json,theme.css}` 空模板。
3. 实现 `kit sync <course>`:扫描 `lessons/*.html` → 解析 auto 模块 → 打包到 `assets/kit/` → 写 `kit.lock.json`。
4. 实现 `kit check <course>`:校验 lock 哈希、漂移、缺失模块;取代 byte-identity 回归。
5. `install_optional.py` 重写为 `kit add` 的薄封装(保留命令一版并打印迁移提示,P6 移除);`sync_asset_catalog.py` 并入 `kit build`,`validate_assets.py` 改为校验 `kit.lock.json` 与模块描述符。
6. `prepare_acceptance.py` 改为:拷贝 fixtures 内容 + `kit sync`。
7. 更新 `tests/test_assets.py` 等断言(路径、manifest 结构、冲突回滚、已修改文件保护语义迁移为"生成物被手改则 check 失败")。

验收:
- 从零 `init_course.py` 生成的课程包可运行,`kit check` 通过。
- 仓库内不再存在 `assets/course.css` 等多份同名副本(脚本断言:同名文件仅允许出现在 `kit/` 与被忽略的生成目录)。
- 手改 `assets/kit/kit.js` 后 `kit check` 失败并提示改 `assets/course/`。

### P3 主题上移 L1(2–3 天)
做什么:
1. 建三级 token:`foundation/tokens.css`(primitive → semantic → component),定义 `--c-*`、`--radius`、`--font-*`、`--measure`、`--code-*`(仅块底色、前景、边框、标签色;token 色由官方主题 CSS 提供)、`--series-1…8`、`--viz-*`、`--toc-*`。
2. 建 `themes/{course,ink,paper}.css`,只含 `html[data-theme]` 的 token 值;主题声明自身 `data-scheme`。
3. 实现 `foundation/theme-engine.js`(L1,presence=core):读 config、写 `html[data-theme]`/`data-scheme`、`localStorage`(以 courseId 为键)、`prefers-color-scheme`、派发 `kit:themechange`。
4. `shell/theme-switcher` 仅作 UI,调用引擎。
5. `@layer reset, tokens, base, content, shell, learning, viz, theme, course;`,把旧 `course.css`、`visualizations.css`、`media.css` 的规则归层。
6. 合并 `theme.js` 配置到 `config.json`;提供读取兼容(若页面仍定义 `window.COURSE_THEMES/COURSE_CODE_THEMES/COURSE_MATH_OPTIONS` 则映射并 warning)。
7. 第三方主题接线:Chart.js/Plotly/JSXGraph 读 `--series-*`;Mermaid `themeVariables` 由 token 计算并在 `kit:themechange` 重渲染;highlight.js 官方主题 CSS 以单个 `<link id="kit-hljs-theme">` 承载,`kit:themechange` 时按 `data-scheme` 在 `code.themes.light/dark` 间替换 `href`,并在样式表加载完成前保持旧样式避免闪烁。官方主题的背景色被 `.kit-block` 的 `--code-bg` 覆盖,使代码块外观与块外壳一致。
8. 新增 lint(只针对 `kit/`):组件 CSS 不得出现字面色值;`validate_assets` 执行。
9. 当前仓库已 modified 的 `theme.css` 内容并入 `themes/*.css`。

验收:
- 三个主题切换时,代码、公式、Mermaid、图表、可视化全部跟随,无需刷新、无闪烁。
- 打印强制浅色 token。
- lint 通过;旧配置变量仍然生效并提示迁移。

### P4 内容渲染器:块外壳 + code/math/diagram(3–4 天)
做什么:
1. `content/_block`:块外壳(label 位、actions 位、body 位)、`data-kit-state`、折叠、复制、悬停显示/触屏常驻、打印规则、`overflow-x:auto`。
2. `code` 模块:
   - 作者契约 `<pre><code class="language-x">`;语言标签自动推断;支持 `data-title`、`data-lines`、`data-linenos`、`data-fold`、`data-wrap`。
   - Obsidian 风格视觉(无标题栏、右上语言标签、悬停出现复制、默认不换行、行内 code 胶囊)。
   - `aliases.json` 集中别名;未知语言降级纯文本。
   - 复制只取 `textContent`。
   - 移除 `copyCodeView`;保留 CDN 官方主题机制,把 `code-highlight/theme.js` 的主题挑选并入 `code` 模块与主题引擎(配置项改为 `config.json` 的 `code.themes`,默认 `github` / `github-dark`;旧 `COURSE_CODE_THEMES` 读取兼容)。
   - 块外壳只接管背景、边框、圆角、内边距与标签位,不覆盖 token 颜色。
3. `math` 模块:懒加载 KaTeX + auto-render;display 公式进块外壳(间距、滚动、复制 LaTeX、`\tag`);配置来自 `config.json`;只在检测到定界符时加载。
4. `diagram` 模块:Mermaid 以动态 `import()` 加载固定版本;失败保留源文本并标注;主题联动。
5. `core/loader`:`kit.need(id)` 统一加载第三方库(去重、SRI、超时、cdn/local 分流);各模块改用它。
6. 规范化器(并入 `kit sync`):把旧 `.code-block/.code-language` 展开为新契约;`validate_course` 对旧写法 warning。
7. `callout`、`table`、`media` 迁入块外壳;callout 采用 Obsidian 类型(note/tip/warning…)并支持折叠。
8. 双写期:新旧选择器同时识别;六类验收课件全部迁到新写法后,默认切换。

验收:
- 六类验收课件:代码出现真实 token 高亮、公式排版完成、Mermaid 布局完成(`data-kit-state=ready`),无 failed。
- 无脚本与打印下,代码、公式源、Mermaid 源可读。
- 旧写法课件经 `kit sync` 后外观与新写法一致。
- `.code-block` 独立组件在文档与 catalog 中消失。

### P5 页面框架、目录与 `course.js` 拆分(4–5 天)
做什么:
1. `foundation/layout.css`:`.kit-page`、`.kit-main`、`.kit-rail`、`.kit-bleed`,基于 container query。
2. `shell/toc`:
   - 三态:≥1200 侧栏(可折叠为窄条)、768–1199 右下浮层(popover)、<768 顶部当前章节条 + 底部抽屉(遮罩、焦点陷阱、Esc/下滑关闭、焦点返回)。
   - scrollspy:`rAF` 节流 + "最后一个 top ≤ 偏移的标题";替换 `-75%` IntersectionObserver。
   - 目录自滚动只改目录容器 `scrollTop`,禁止页面级 `scrollIntoView`。
   - 层级 `h2/h3`、当前 h2 展开、`aria-current="location"`;`[data-toc-skip]`、`[data-toc-label]`。
   - `scroll-margin-top`、`hashchange`/`popstate`/首次带 hash 定位、`prefers-reduced-motion`。
   - 阅读进度、折叠与已读状态入 `localStorage`;可选快捷键。
3. `shell/nav`:课程首页、上一课/下一课、课时列表;替换手写 `course-nav`。
4. `kit sync` 增加:标题 id 静态生成(中文 slug、冲突加后缀)写回 HTML;预生成 rail 内的静态目录后备;`validate_course` 检查 id 唯一与后备存在。
5. 拆分 `_legacy-course.js`:
   - `evidenceModel`、`buildLearningRecord`、`initPrintState` → `learning/records`
   - `quizView`、`answerView`、`hintView`、`teachingTargetView`、`dialogueView`、`independenceView` → 合并为 `learning/question`(设计见 architecture.md §7.4)
   - `stepView` → `learning/step`
   - 工具函数 → `core/util`
   - 每个模块独立 `module.json`;对外 API 与 `api-baseline.md` 对照,保持兼容。
6. `learning/records` 增加金标准测试:同一输入序列,拆分前后 `buildLearningRecord` 输出逐字节相等。
7. 统一题目块 `learning/question`(设计见 architecture.md §7.4,预览见 `docs/preview/quiz-preview.html`):
   - 实现六种 `data-kind`(choice/multi/numeric/fill/open/dialogue),共用外壳、状态机、逐级提示、反馈区与解析区;作者只写语义标记,运行时生成按钮与反馈。
   - 判定后选项以颜色 + 符号 + 文字三重表达,逐项 `data-why`;未答对不暴露答案,达到 `data-max-attempts`(默认 2)后提供"查看答案"。
   - **取消"作答帮助方式"自述下拉**:由提示按钮自动判定(点过提示 → `with_hints`;被点击的提示声明 `data-guidance="ai_guided"` → `ai_guided`;否则 `independent`),运行时自动派发 `OBSERVED_ASSISTANCE`/`INDEPENDENCE`,只升不降,学习记录字段与结构不变。
   - 页首可选汇总条(`data-question-summary`)。
   - 规范化器:把旧 `.quiz`、`data-answer-*`、`teaching-target`、`dialogue-practice` 展开为新契约;`validate_course` 增加题目块校验(kind 合法、choice 恰一个正确项、multi 至少一个、numeric 的期望值有限且容差非负、fill 的 accepted 为字符串数组、dialogue 至少 2 轮、question-id 唯一)。
   - 打印默认展开答案与解析(复习版),`config.question.print="blank"` 切空白版;无脚本下题干、选项、解释、提示、解析全部可读。
   - 测试:改写 `tests/test_independence.py` 以匹配"自动判定"语义;新增六题型的 DOM 行为测试;学习记录金标准覆盖"点提示/不点提示/揭示答案/开放题/对话"各一条路径;在 `file://` 与 HTTP 下各跑一次。

验收:
- 375/768/1280 三档实测:无水平溢出;抽屉可键盘操作;长目录不顶在正文前;上下滚动时当前项正确;点击目录不带动整页异常跳动。
- 宽内容(表格、可视化)不被 rail 挤压(bleed 生效)。
- 学习记录金标准测试全绿。
- `_legacy-course.*` 删除。

### P6 统一就绪协议、文档与收尾(2 天)
做什么:
1. 统一就绪:元素 `data-kit-state`,模块 `kit:<module>:ready`,全局 `data-kit-ready` 与 `kit:ready`(含 ready/failed 列表);保留旧事件 shim。
2. `export_pdf.py` 与验收脚本改为只等 `kit:ready` 并检查 `[data-kit-state=failed]`。
3. 重写文档:`references/assets.md`(选择与接入)、`render.md`(契约)、`lesson.md`(新作者写法)、`SKILL.md`(命令与流程)、仓库 `AGENTS.md` 的脚本清单、`README.md`、`CHANGELOG.md`;`catalog.json` 保留为生成的只读视图,文件头注明"勿手改"。
4. 删除 `optional/` 与 `learnkit/` 旧目录、`install_optional.py` 旧入口(保留一版转发提示后移除)、旧 manifest 文件。
5. 新增 `fixtures/gallery`:每个模块一个用例页,取代 example-course 的展示职责;`example-course` 缩减为最小内容样例。

验收:见第 6 节完成定义。

## 5. 工作量与顺序
P0 → P1 → P2 → P3 → P4 → P5 → P6 严格顺序;P3 与 P4 的 token 与块外壳部分可并行,但合并顺序固定为 P3 先。总估算约 16–20 个工作日。

## 6. 完成定义(全部满足才结案)
1. 仓库内不存在同名重复资产副本;`kit check` 对所有 fixtures 通过。
2. `assets.md` 中的"第三方库路由硬规则"仍成立:代码=highlight.js、公式=KaTeX、流程/状态/时序图=Mermaid、图表=Chart.js/Plotly、几何=JSXGraph。
3. 六类验收课件在 375/768/1280 宽度下:无水平溢出、`kit:ready` 触发、无 `failed`、目录三态正确、三个主题切换正常。
4. 无脚本与打印时:正文、代码、公式源、Mermaid 源、静态目录均可读。
5. 学习记录输出与基线逐字节一致;`validate_course.py --strict-schema --pedagogical`、`validate_exam.py --strict-schema`、`build_report.py` 全部通过。
6. 全量测试(Python、`.cjs`、浏览器检查)通过,新增测试覆盖:`kit sync/check/add`、规范化器、主题引擎、块外壳、toc 三态与 scrollspy、记录金标准。
7. 文档与 `AGENTS.md`、`SKILL.md` 与实际命令一致;CHANGELOG 记录各阶段。
8. 六类验收课件中的题目均已使用 `learning/question`;旧 `.quiz` 等写法零残留;`independence` 在记录中由自动判定产生,无自述控件。

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| P1 搬迁引发大量路径断裂 | 先在 1.3 清单逐项改引用;用 `rg` 断言旧路径零残留 |
| 单文件产物体积增大 | 目标 core+默认模块 < 200KB(不含 vendor);超出时对 auto 模块按需拼接 |
| auto 检测误判(如正文讲解 `$$`) | `data-kit-skip`;`kit sync` 报告触发依据 |
| 官方主题自带背景与块外壳不协调,或切换主题时样式表加载造成闪烁 | 块外壳覆盖背景;新样式表 `onload` 后再替换;离线模式使用本地官方主题 CSS |
| 旧课程包不兼容 | 不自动升级;`kit sync` 显式升级;旧 API shim 保留一个版本周期 |
| 目录三态在 iframe/打印下异常 | 使用 container query;打印规则单测;三档实测 |
| `file://` 下动态 `import()` 受限 | 在 P4 早期用 Playwright 在 `file://` 实测 Mermaid;不行则改用经典脚本 UMD 构建 |
| 学习记录回归 | 金标准逐字节测试;`records` 模块拆分最后一步并单独提交 |
| 取消自述后 `independent` 只代表"页内未用提示",页外使用 AI 不可见 | 文档与记录说明该局限;外部帮助仍由 `ai-study` 流程与教师评估补充;P5 开工前核对 `shared/references/record-contract.md` 与 `ai-study` 对 `independence` 的约定,必要时先更新契约文字 |

## 8. 变更与交付管理
- 分支:`worktree-kit-refactor-plan` 仅承载本计划文档;实施另开分支,每阶段一个 PR(草稿),不直接推 master。
- 每阶段 PR 描述包含:改动清单、验收结果、回退方式。
- 变更日志:`CHANGELOG.md` 每阶段追加一条。
- 若执行中需要推翻第 2 节决策,先更新本文再改代码。
