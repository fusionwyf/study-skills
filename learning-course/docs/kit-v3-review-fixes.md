# Course Kit v3 审查修复计划

状态: 已全部完成（2026-10-24，提交 15e4714..468b9ec，Phase 1–4 全部门禁通过：三 fixture validate/check 绿、sync 字节一致、serve 冒烟、主题晋升端到端）
来源: 双轴代码审查(Standards / Spec),审阅范围 `origin/master..master` 即 `ba3dcef..7817e7c` 共 8 个提交;Spec 对照 `kit-v3-proposal.md`(Course Kit v3 完整提案)。
日期: 2026-10-24

本文规定: 每项发现的问题、修复方案与验收标准。不含实现代码。

---

## 0. 已接受的决定(不在本计划修复范围)

| # | 决定 | 说明 |
|---|---|---|
| D1 | **点击式提交是最终行为** | 通道 A 语义由提案的"后台自动上报"改为"学习者点击 `[data-submit-feedback]` 后实时落盘"(7817e7c)。`SKILL.md:122`、`templates/lesson.html:68`、`records.js` 已一致。提案文档以本决定为准,不再维护其通道 A 原始表述。唯一遗留: 工作区 `AGENTS.md:35` 的"作答实时落盘"措辞需同步(见 C5)。 |
| D2 | **超出提案的功能全部保留** | IndexedDB 离线队列 + 重开自动补传(records.js:378-410)、`learning.cards` 模块、observable-plot 入库 vendor、nav/toc 改版、`style-specimen.html`、`shot` 的 `--browser/--wait-ms`、删除 `docs/` 旧归档与 `install_optional.py`/`migrate_questions.py`。 |
| D3 | **命名以仓库文档为准** | 提案中的 `Kit.island(name,{model,view})` 实际为 `kit.island.define(name,{initialState,tick,view})`(render.md:76,87 与 island.js:286 一致,正确);提案的 token 名(`--c-sidebar/--c-info/--c-ok`)实际为(`--c-muted/--c-success/--c-danger`),`references/assets.md` 已按真实 token 记载。提案原文过时,不改。 |

---

## 1. 修复清单总览

| 编号 | 来源轴 | 问题 | 阶段 |
|---|---|---|---|
| A1 | Standards-硬性 | 记录正文缺第 4 段「下一步」,违反共享记录契约 | P2 |
| A2 | Standards-硬性 | 模块描述符校验与 assets.md 规则不一致(layer 0-8、不强制 core) | P2 |
| A3 | Spec(a) | validate_course 未显式豁免 `records/inbox/` | P1 |
| B1 | Standards-架构 | vendor 注册表三份手抄,plot 本地路径已分叉 | P3 |
| B2 | Standards-架构 | `__NAV_DATA__` 与 nav.json 双实现,且内嵌时机早于 nav.json 重生成 | P3 |
| B3 | Standards-架构 | 依赖闭包循环与 extensions 校验多处重复 | P3 |
| B4 | Standards-架构 | YAML frontmatter 四处各自手写解析 | P3 |
| B5 | Standards/Spec | theme-engine `THEMES` 硬编码,主题晋升"全自动"名不副实 | P3 |
| B6 | Standards-架构 | `kit.py` 1772 行承载六类职责 | P4 |
| B7 | Standards-坏味道 | 薄委托转发函数、死代码 | P1 |
| C1 | Spec(a) | lesson.md 缺 Custom Elements 双轨说明,SKILL.md 指向落空 | P1 |
| C2 | Spec(a) | shell.dashboard 未登记为 Kit 模块 | P2 |
| C3 | Spec(a) | 仪表盘实际端点与提案/文档不符(不读 nav.json) | P1 |
| C4 | Spec(a) | `templates/PLAN.md` 与 init_course 内联模板漂移 | P1 |
| C5 | Spec(a)/D1 | 工作区 `AGENTS.md:35`"作答实时落盘"与点击提交语义不符 | P1 |

---

## 2. 逐项修复方案

### A1 记录正文补第 4 段「下一步」

**问题**: `shared/references/record-contract.md:95` 要求记录正文四段,第 4 段为「下一步 —— next_action 具体到下一次动作」。`scripts/record_builder.py` 的 `render_pending_record` 模板只有三段(学习者原始反馈/可观察行为/Agent 判断);fixtures/showcase 的 4 份 finalized 记录同样止于三段。SKILL.md 声称该模板"各路径字节级一致"即为权威模板,故模板本身违反契约。

**修复**:
1. `render_pending_record` 模板增加 `## 下一步` 段(pending 状态下留 `- (pending: 由 Agent 在定稿时填写 next_action)` 占位,不虚构内容)。
2. `records.js` 自动生成的「Agent 判断」区不涉及第 4 段,无需改动;Agent 定稿流程(SKILL.md Evidence 章节)补一句: 定稿时填写「下一步」段的 next_action。
3. fixtures/showcase 的 4 份 finalized 记录按各自 course.yaml 的下一步补齐第 4 段。

**验收**: 新建 pending 记录(kit.py serve 提交或 update_progress)含四段标题;showcase 4 份记录含四段;三个 fixture 校验全绿。

### A2 模块描述符校验与文档对齐

**问题**: `references/assets.md`「模块描述符」规定 `layer (0-5)`、`requires` 至少含 `core`;`kit.py validate_descriptor` 实际接受 layer 0..8,且不检查 `core`(`viz.kinds.*` 仅 requires `viz.core`,传递可达但字面不符)。

**修复**(以收紧代码为准,分层是架构不变量):
1. `validate_descriptor` 收紧: layer 只接受 0..5,越界报错。
2. core 依赖改为**传递可达**语义: requires 闭包能到达 `core` 即合规(避免强迫每个 viz kind 字面写 core);在 assets.md 把该条措辞改为"`requires` 须经传递依赖到达 `core`"。
3. 同步在 `kit.py check` 中对 catalog 全量执行该规则。

**验收**: 现有 29 个 module.json 在新规则下全部通过;人为构造 layer=6 的描述符被拒绝。

### A3 validate_course 显式豁免 records/inbox/

**问题**: 提案 §1.4 要求显式加固;当前 validator 因从不扫描 records/ 目录而事实上豁免,但规则不成文,后续若新增记录目录扫描会静默破坏。

**修复**: 在 validate_course 的记录扫描入口加显式跳过 `records/inbox/`(含章节课程 `chapters/*/records/inbox/`),并加注释说明豁免原因(inbox 为设备原始快照,非 Agent 定稿记录)。

**验收**: 构造带非法 JSON 文件的 inbox 目录,validate_course 仍通过;同文件放进 records/ 根目录则报错。

### B1 vendor 注册表收敛为单一来源

**问题**: 同一 vendor 注册表存在三份手抄: `kit.py UNIFIED_VENDORS`、`kit/core/loader.js DEFAULT_VENDORS`、loader 硬编码 `localPackages=["plotly","jsxgraph"]`。已实际漂移: plot 的 local 路径 kit.py 用 `plot.bundle.min.js`(正确),loader 用 `plot.umd.min.js`(按 vendor/manifest.json 注释为错误路径)。离线模式下 loader 走的是错的那份。

**修复**:
1. 以 `kit.py UNIFIED_VENDORS` + `kit/vendor/manifest.json` 为唯一事实源。
2. `bundle_kit` 构建时把注册表注入 bundle(如 `kit.__VENDORS__` 常量),`loader.js` 优先读注入值,仅保留最小内置回退供非 bundle 场景(`kit/` 源直接引用)。
3. 删除 loader 的 `localPackages` 硬编码,离线可用性由 vendor/manifest.json 的文件清单推导。
4. 顺手修正 loader 内 plot 路径错误(收敛后自然消除)。

**验收**: 三个 fixture 重跑 sync,除 loader 注入段外产物字节不变;`config.json vendor.mode=local` 时 plot/plotly/jsxgraph 离线加载全部成功(可用 shot 或浏览器断言)。

### B2 移除 `__NAV_DATA__` 内嵌双实现

**问题**: `kit.py bundle_kit`(约 803-882 行)自行从 course.yaml 重建 nav 数据内嵌 `__NAV_DATA__`,与 `build_index.py write_navigation_data` 双实现;且内嵌发生在 sync 末尾 `build_index.py --nav-only` 重生成 nav.json **之前**,内嵌副本天然过期(nav.js 运行时会重新 fetch,只有兜底路径读到旧数据)。

**修复**: 删除 bundle 内嵌构建;nav.js 的兜底路径改为 fetch nav.json 失败时的错误提示(或缓存上次成功结果),不再依赖内嵌副本。

**验收**: sync 后删除 nav.json 再 `file://` 打开,导航区呈现明确的加载失败提示而非过期数据;正常路径行为不变。

### B3 依赖闭包与 extensions 校验去重

**问题**: 传递依赖闭包的 `while expanded` 循环在 `detect_modules_for_course` 与 `bundle_kit` 各一份;extensions 合法性校验在 detect/bundle/check_course 三处重复。

**修复**: 在 kit.py(或拆分后的共享模块)提取 `expand_requires(modules, seeds)` 与 `validate_extensions(...)` 各一份,原调用点改调用。纯重构,不改行为。

**验收**: 重构前后对三个 fixture 的 `sync` 产物字节一致(用 git diff 证明)。

### B4 frontmatter 解析收敛为一个共享解析器

**问题**: YAML frontmatter 被 4 处各自手写解析: `kit.py list_record_metadata`(字符串切分)、`course_layout.py`(正则)、`update_progress.py`、`validate_course.py` 各一套。四份实现字段容错不一致,是记录解析漂移的温床。

**修复**: 在 `scripts/record_builder.py`(记录域的自然归属)暴露 `parse_record_frontmatter(text) -> dict`,四处改调用;解析规则以 record-contract.md 字段表为准。

**验收**: 全部既有记录(fixture + showcase inbox 流程)解析结果与重构前一致;构造缺字段/多字段记录,四个调用点行为一致。

### B5 主题注册表数据驱动(兑现"晋升即内置")

**问题**: `assets.md:104` 承诺"复制 CSS 到 `kit/foundation/themes/` + `kit.py build` 即成内置预设",但切换器元数据硬编码于 `theme-engine.js:28` 的 `THEMES` 表,新主题回退 `{label:name, scheme:"light"}`(:45-47),深色 SVG 描边、按需字体全部失效。课程级 `@kit-theme` 头已有解析器,全局级却没有,两条路径不对称。

**修复**:
1. `kit.py build` 扫描 `kit/foundation/themes/*.css` 的 `@kit-theme` 头,生成 `kit/foundation/themes.json`(name/label/scheme/code/fonts),与现有 8 套预设的元数据合并(现有 8 套补写 @kit-theme 头或保留在生成源中,二选一,以代码量小者为准)。
2. `theme-engine.js` 删除硬编码 `THEMES`,boot 时读取注入的 themes.json(随 bundle 注入,机制同 B1)。
3. 全局预设与课程级 `config.customThemes` 走同一个 `register` 路径,消除两套注册逻辑。

**验收**: 复制 crt-terminal.css(现仅在 showcase 课程级)到 `kit/foundation/themes/` + build 后,新课程切换器出现"复古终端"、scheme=dark 生效(SVG 描边变亮)、字体按需加载;`kit.py check` 通过。

### B6 kit.py 按职责拆分

**问题**: `kit.py` 1772 行同时承载 build/sync/check/serve/ingest/shot 六类职责,`bundle_kit` 约 270 行混杂 CSS、vendor、nav、JS、哈希。B1-B5 落地后仍是单文件,继续膨胀。

**修复**: 拆为 `kit/build/` 包: `cli.py`(入口+参数)、`bundle.py`(build/sync)、`serve.py`(serve/ingest/记录落盘)、`shot.py`、`check.py`;对外命令 `python kit/build/kit.py ...` 不变(kit.py 保留为薄入口)。**纯搬家,B1-B5 先行,本项最后做、单独提交**,便于字节级回归证明。

**验收**: 拆分前后对三个 fixture 的 sync/check 产物与退出码完全一致;所有文档中的 kit.py 调用命令不需修改。

### B7 薄委托内联与死代码清理

**问题**:
- `kit.py collect_completed_lessons_from_records` 是 `course_layout.completed_lesson_keys` 的纯转发;
- `update_progress.py` 的 `lesson_exists`/`next_record_sequence` 同为薄委托;
- `record_builder.py ingest_inbox` 中 `if update_last_feedback(...): pass`(约 213-215 行)为死代码。

**修复**: 调用点直接调用真实实现,删除转发函数;删除死分支(update_last_feedback 的调用保留,仅去掉无意义的 `if...pass` 结构,行为不变)。

**验收**: 纯重构,sync/ingest/update_progress 产物字节一致。

### C1 lesson.md 补 Custom Elements 双轨契约

**问题**: 提案 §4.3 与 `SKILL.md:74` 均指向 lesson.md 的双轨说明,但 lesson.md 全文 0 处提及 `kit-question`/`kit-callout`/`kit-viz`(说明散落在 render.md:14 与 elements.js 注释)。Agent 按 SKILL.md 指引查契约会落空。

**修复**: 在 lesson.md「三、HTML 核心组件契约」开头新增「### 0. 双轨写法(Custom Elements 简写)」: 说明 `<kit-question>`≡`<section class="question" data-role="evidence">`、`<kit-callout>`≡`<aside class="callout">`、`<kit-viz>`≡`<section class="visualization">`,属性归一化规则(引用 elements.js 的 connectedCallback 行为),以及"两写法产出完全相同的 data-* 契约,校验器双轨识别"一句话;§1/§5/§7 各加一行"简写: `<kit-...>`"交叉引用。

**验收**: grep lesson.md 含三个元素名;SKILL.md:74 的指引可循;showcase 课件中任一双轨写法样本通过 validate_course。

### C2 shell.dashboard 登记为 serve 专属模块

**问题**: 提案 §3 列 `shell.dashboard`(presence `serve`),实际目录只有 index.html,无 module.json,manifest/catalog 均无登记。功能正常(kit.py:1442-1483 托管 /dashboard),但模块清单与提案不一致,"serve" 这一 presence 档位在模块系统里不存在。

**修复**(二选一,推荐前者):
1. 扩展 presence 枚举支持 `serve`: module.json 登记 `shell.dashboard`(layer 3, requires core),`kit.py check` 校验它**不得**被 sync 打进课程 bundle(serve 托管专属);catalog/manifest 补登记。
2. 若判定仪表盘本质是 serve 的内置页面而非课件模块: 在 assets.md 模块表明确写"dashboard 由 serve 直接托管,不属于模块系统",并把提案该行标注为已被实现替代。

**验收**(方案 1): `kit.py check` 通过;sync 产物不含 dashboard;serve 下 /dashboard 可用。

### C3 仪表盘端点文档对齐

**问题**: 提案 §3 称仪表盘读取 `/api/course`、`/api/inbox` 与 `nav.json`;实际 `dashboard/index.html:182` 只取 `/api/course`、`/api/records`、`/api/inbox`(课程结构信息已含于 /api/course,无需 nav.json)。

**修复**: 以实际行为为准更新文档: 在 render.md(或 SKILL.md 的 serve 章节)写明仪表盘三个数据端点及各自职责;不为此改 dashboard 代码。本文件 §0.D3 同时记录该提案偏差。

**验收**: 仓库文档中不存在"仪表盘读取 nav.json"的表述;三个端点各有出处说明。

### C4 templates/PLAN.md 与 init_course 单源化

**问题**: `init_course.py:144-146` 内联了一份新 PLAN 模板(含视觉预设与 serve 行),`templates/PLAN.md` 仍是旧写法,两份已漂移。继续双份必然再漂移。

**修复**: `init_course.py` 改为读取 `templates/PLAN.md` 并做占位替换(标题/目标/主题),删除内联副本;`templates/PLAN.md` 内容更新为与现内联版一致(含 `- 视觉预设：<theme>` 与 serve 命令行)。

**验收**: `init_course.py` 新建课程的 PLAN.md 与 templates/PLAN.md 替换后逐字一致;修改模板后再次 init 即生效。

### C5 工作区 AGENTS.md 措辞对齐点击提交

**问题**: 工作区 `AGENTS.md:35` 注释"本地服务: 作答实时落盘 records/"暗示后台自动上报,与 D1 决定的点击提交语义不符。

**修复**: 改为"本地服务: 点击提交后实时落盘 records/"。

**验收**: 全仓库(含 references/、templates/)无"自动落盘/自动上报"残留表述(grep 验证)。

---

## 3. 执行顺序

| 阶段 | 内容 | 提交粒度 | 依赖 |
|---|---|---|---|
| Phase 1 | A3、B7、C1、C3、C4、C5(低风险速赢: 一行修复、文档、死代码) | 可合并为 1-2 个提交 | 无 |
| Phase 2 | A1、A2、C2(契约与登记) | 每项一个提交 | 无 |
| Phase 3 | B1、B2、B3、B4、B5(架构单源化) | **每项独立提交**,便于字节级回归 | B5 依赖 B1 的注入机制 |
| Phase 4 | B6(kit.py 拆分,纯搬家) | 单独提交 | B1-B5 全部完成 |

## 4. 总验收门禁(每阶段结束执行)

1. `python scripts/validate_course.py fixtures/{acceptance,example-course,showcase} --strict-schema --pedagogical` 全绿。
2. `python kit/build/kit.py check` 全绿;Phase 2 起含 A2 新规则。
3. 临时副本重跑 `kit.py sync`,产物与提交内 `assets/kit/*` 字节一致(Phase 3 的 B1/B5 允许声明的注入段差异)。
4. Phase 2 起新增回归用例: 记录四段完整性(A1)、inbox 豁免(A3)、双轨识别(C1)、serve 模块不入包(C2)。

## 附: 审查已确认无需动作的项

- L0→L5 分层: 29 个 module.json 的 requires 全部合规,拓扑校验强制;
- catalog.json 与 kit.manifest.json 逐模块一致(29/29);
- serve 三件事 + finalized 不覆盖(record_builder.py:113-116);
- update_progress 与 serve 经 record_builder 字节级一致,`--from-inbox` 存在;
- 8 预设表、对比度 4.5:1 门禁、Observable Plot 首选路由、`@kit-theme` 解析报错行为;
- 记录契约字段与语义未动,无旧课程包自动迁移。
