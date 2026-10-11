# HTML 课件 assets 架构设计 v2(Course Kit)

> [!NOTE]
> 本文档为 Course Kit 重构与工程内部归档，仅记录架构设计与演进历史，**不作为 Agent 运行时参考文档**。
> Agent 创建与维护课程请参考根目录 `SKILL.md` 及 `references/` 目录。

状态: 已完全实施（Implemented in v2.3.0 / v3.0.0）。执行记录见 `COMPLETIONS.md`。

## 0. 现状诊断

| # | 问题 | 证据 | 根因 |
|---|---|---|---|
| 1 | 同一份代码有多份副本 | `course-template/{course,theme}.*`、`optional/theme/theme.css`、`example-course/assets/{course,theme}.*`、`example-course/assets/optional/theme/*` 各有一份,`acceptance-course` 另有一份(合计 6MB 以上);仓库当前有 9 个 css/js 同时处于修改状态,靠"byte-identity 回归"补救 | 没有"唯一源 + 生成"模型,课程包与示例是手工副本 |
| 2 | theme 被当作可选组件,且重名 | `optional/theme/theme.js`(切换器)与 `course-template/theme.js`(配置)同名不同职责;`theme.css` 有三份 | theme 是所有组件依赖的基础设施,却放在 optional |
| 3 | 分类维度混乱 | `role(common/rendering/specialized)` × `delivery(default/optional/external/extension)`;`catalog.json`、`asset-manifest.json`、`optional/manifest.json`、`components.json`、`adapters.json` 五份目录互相"投影" | 一个概念多处登记,靠 `sync_asset_catalog.py` 对齐 |
| 4 | 代码块独立成组件 | 要求 `.code-block` + `.code-language` + `<pre><code>`;高亮在 optional 的 `code-highlight`;复制按钮在 `course.js` 的 `copyCodeView`;主题靠 `theme.js` 选 CDN 主题 CSS | 代码、数学、Mermaid 走三套不同接入协议 |
| 5 | 浮动目录适配差 | `.toc` 为 grid 右栏 + `position:sticky`;≤52rem 变 `position:static; order:-1`,长目录整块顶在正文前;scrollspy 用 `rootMargin:-75%` 的 IntersectionObserver,只在"进入"时触发;`it.item.scrollIntoView()` 会带动整页滚动;宽内容与右栏争抢空间 | 目录被当作"版式的一列",而不是独立壳层组件 |
| 6 | `course.js` 巨石 | 824 行,测验、回答、提示、对话、学习记录、目录、复制代码混在一起 | 没有模块边界 |
| 7 | 接线靠人工 | `render.md` 里有一整段页面顺序:LearnKit → course.js → 模型 → 内核 → kinds;media 在 course.js 之后;mermaid 需 `type=module`;另有 `course-ready`/`lk-ready`/`viz-ready`/`media-ready`/`__COURSE_MATH_READY__` 五套就绪信号 | 缺依赖图与统一就绪协议 |

## 1. 设计原则

1. **单一源**:技能内只有一份 `kit/`;课程包内 `assets/kit/` 是生成物,不手改,可校验。
2. **分层单向依赖**:L0→L5,上层可依赖下层,反之不行。
3. **按契约接入,不按交付档位**:用"模块描述符"取代 default/optional/external/extension。
4. **内容原语统一**:代码、公式、图、表格、图片同属"块(block)",共用外壳与接入协议。
5. **作者只写语义 HTML**:`<pre><code class="language-py">`、`$$…$$`、`<pre class="mermaid">`,不写 wrapper;增强由运行时完成,脚本缺失时原文可读。
6. **主题是地基**:全部视觉来自 token;第三方库(highlight.js、Mermaid、Chart.js 等)的配色由主题引擎联动。
7. **`file://` 可打开**:产物是经典脚本(IIFE),不使用 `<script type=module>`。

## 2. 分层与目录

### 2.1 分层

```
L5  viz / domain      可视化内核、kinds、课程领域模型、extensions
L4  learning          question(统一题目块)、step、records(证据)
L3  shell             toc、nav、reading-progress、theme-switcher、toolbar
L2  content           math、code、diagram(Mermaid)、table、media、callout   ← 内容渲染器
L1  foundation        tokens、themes、base(排版)、layout(page frame)、print、a11y、theme-engine
L0  core              registry、loader(依赖图 + 懒加载)、ready 协议、config、bus、store(现 LearnKit 状态内核)、util
```

规则:L2 不依赖 L3/L4;L4 只经 L0 的 store 与 L3 通信;L5 的领域模型通过 `registerModel` 接入 L0。

### 2.2 技能内(唯一源)

```
learning-course/
  kit/
    kit.manifest.json            # 由各 module.json 汇总的唯一目录
    core/        registry.js loader.js ready.js config.js bus.js store.js util.js
    foundation/  tokens.css base.css layout.css print.css theme-engine.js
                 themes/        course.css ink.css paper.css      # 只含 token 值
    content/
      _block/    block-chrome.js block-chrome.css                 # 公共块外壳(§4)
      math/      module.json math.js math.css
      code/      module.json code.js code.css aliases.json
      diagram/   module.json mermaid.js mermaid.css
      table/ media/ callout/
    shell/       toc/  nav/  progress/  theme-switcher/
    learning/    question/ step/ records/
    viz/         core/ kinds/(list sequence table chart spatial)
    vendor/      仅离线时拷贝;含 manifest(版本、SRI、许可证)
    build/       kit.py(build | sync | check | add | list)
  templates/     lesson.html course.yaml INDEX 等骨架,不含任何 css/js
  fixtures/
    gallery/     每个模块一个用例页
    acceptance/  六类课件源,只放内容(course.yaml lessons reference),不放 assets
  references/    lesson.md render.md assets.md  → 精简为"契约"文档
  scripts/       init_course.py validate_course.py …(validate_assets 改为校验 kit.lock)
  docs/          architecture.md refactor-plan.md   # 迁移期另有 baseline.txt api-baseline.md(见计划 P0)
```

### 2.3 课程包内

```
<course>/
  assets/
    kit/                     # 生成物:kit.js(单文件 IIFE) kit.css(@layer 包) kit.lock.json
    course/                  # 课程唯一允许手改的位置
      config.json            # 主题、数学宏、代码主题、目录选项、vendor 模式
      theme.css              # 仅覆盖 token 与少量 @layer course 规则
      extensions/            # 课程专用 model / kind
  lessons/ records/ reference/ …
```

- `example-course` 与 `acceptance-course` 不再带 `assets/`;需要时由 `init_course.py` 与 `kit sync` 生成,被 `.gitignore` 忽略。
- "byte-identity 回归"改为 `kit check`:对比 `kit.lock.json` 的哈希与当前文件;手改生成物即报错,并提示应改 `assets/course/`。

## 3. 统一的模块描述符

每个模块自带 `module.json`,构建时汇总为 `kit.manifest.json`。

```jsonc
{
  "id": "content.code",
  "layer": 2,
  "version": "1.0.0",
  "requires": ["core", "foundation", "content._block"],
  "presence": "auto",                        // core | auto | opt-in
  "detect": { "selectors": ["pre > code"] }, // auto 时据此扫描课件
  "provides": { "css": "code.css", "js": "code.js", "selectors": ["pre > code"] },
  "vendor": [{ "id": "hljs", "version": "11.12.0",
               "cdn": "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/highlight.min.js",
               "sri": "sha384-…", "local": "vendor/hljs/…" }],
  "ready": "kit:code:ready",
  "degrade": "保留 <pre> 原文",
  "print": "pre-wrap,隐藏操作按钮",
  "tokens": ["--code-bg", "--code-fg", "--code-border", "--code-label"]
}
```

两个正交维度取代原来的 4 档交付:

- **presence**(是否进包)
  - `core`:永远打包(L0、L1、toc、theme)。
  - `auto`:`kit sync` 扫描 `lessons/*.html`,出现 `pre>code`、`\(`/`$$`、`.mermaid`、`data-viz` 等即纳入;取代"用了代码却忘记 install_optional"的失败模式。
  - `opt-in`:`config.json` 的 `modules` 显式声明(chart、spatial、课程 extension)。
- **source**(外部库来源):`cdn`(默认,固定版本 + SRI)或 `local`(离线,从 `kit/vendor` 拷贝)。切换只改 `config.json` 的 `vendor.mode`,不改 HTML。

`install_optional.py` 并入 `kit add` 与 `kit sync`。

## 4. 内容渲染器:代码块与数学块同级

### 4.1 共同的块外壳(`content/_block`)

display 公式、代码、Mermaid、表格、图片共用 `kit-block` 外壳:

```
<figure class="kit-block" data-kind="code|math|diagram|table|figure" data-kit-state="ready">
  <div class="kit-block__label">python</div>              ← 右上角,小号弱化
  <div class="kit-block__actions"> 复制 / 折叠 / 全屏 </div>  ← 悬停或聚焦显示,触屏常驻
  <div class="kit-block__body"> …渲染内容… </div>
</figure>
```

统一:圆角、边框与背景 token、内边距、`overflow-x:auto`、标签位、操作位、折叠、打印规则、`:focus-visible`、`data-kit-state=pending|ready|failed`。各渲染器只负责 body 与自己特有的 action。

### 4.2 作者契约(原生语义 HTML + 可选 data 属性)

| 内容 | 作者写法 | 可选属性 |
|---|---|---|
| 代码 | `<pre><code class="language-python">…</code></pre>` | `data-title`、`data-lines="2,4-6"`、`data-linenos`、`data-fold`、`data-wrap` |
| 行内代码 | `<code>x</code>` | 自动胶囊样式,不进块外壳 |
| 公式 | `\(…\)`、`$$…$$`、`\[…\]` | display 公式支持 `\tag{}`,可复制 LaTeX |
| 图 | `<pre class="mermaid">…</pre>` | `data-title`、`data-zoom` |
| 表格 | 原生 `<table>` | `data-sortable`、`data-sticky-head` |
| 提示块 | `<aside class="callout" data-callout="note">`(Obsidian 风格 note/tip/warning…,可折叠) | `data-fold` |

- 作者不再写 `.code-block`、`.code-language`;语言标签由 `language-*` 推断。
- 旧写法仍被接受:`kit sync` 的规范化步骤会把旧 wrapper 展开为新契约;`validate_course` 对旧写法给 warning。
- 跳过增强:`data-kit-skip`。

### 4.3 代码块(Obsidian 风格视觉,CDN 官方主题配色)

视觉与行为:
- 默认干净:无标题栏,圆角块,右上角一枚语言标签。
- 悬停或聚焦时显示复制按钮(占用标签位),触屏常驻。
- 默认不显示行号,横向滚动不换行。
- 仅在设置 `data-title` 时出现文件名栏;设置 `data-lines` 才有高亮行;设置 `data-fold` 且超过阈值才有折叠。
- 行内 `code` 为弱底色胶囊,继承字号。
- 复制只取 `code.textContent`,不含行号与标签。

配色(**保持 CDN 官方 highlight.js 主题**):
- 高亮引擎与官方主题 CSS 均来自固定版本 CDN(`cdn-release`)。
- `config.json` 的 `code.themes: { light: "github", dark: "github-dark" }`,值可为官方主题名或固定版本 URL;离线模式指向 `kit/vendor` 内的本地官方主题 CSS。
- 主题 CSS 由单个 `<link id="kit-hljs-theme">` 承载;主题引擎在 `kit:themechange` 时按当前 `data-scheme` 选择 light/dark 条目并替换 `href`,新样式表 `onload` 后才替换以避免闪烁。
- 块外壳通过 `--code-bg / --code-fg / --code-border / --code-label` 覆盖官方主题的背景与外框,使代码块与其它块外观一致;token 颜色完全由官方主题决定,不另设 palette。
- 语言别名集中在 `code/aliases.json`;highlight.js 已识别的不重复登记;未知语言降级为纯文本,不错误着色。

### 4.4 数学

- KaTeX 与 auto-render 由 `math` 模块懒加载,仅当页面出现定界符才加载。
- 配置来自 `config.json` 的 `math`:`macros`、`trust`、`strict`、`throwOnError:false`。
- 行内公式不进块外壳;display 公式进块外壳,获得与代码块一致的间距、滚动、复制 LaTeX 与 `\tag` 编号。
- 颜色继承 `--c-text`,暗色主题无需特殊处理。

### 4.5 Mermaid

- `diagram` 模块以动态 `import()` 加载固定版本 ESM(经典脚本中可用,`file://` 下需 P4 早期实测)。
- `themeVariables` 由当前 token 计算,`kit:themechange` 时重新渲染。
- 渲染失败时保留源文本,块外壳标签位标注"渲染失败"。

### 4.6 第三方库加载器(`core/loader`)

```js
kit.need("hljs")   // Promise;去重、SRI、超时;cdn/local 分流;版本只在 module.json 写一次
```

## 5. 主题系统(L1,通用基础设施)

### 5.1 三级 token

```
primitive   --blue-600, --gray-50 …           只在 themes/*.css 内使用
semantic    --c-bg --c-surface --c-surface-2 --c-text --c-text-2
            --c-border --c-accent --c-accent-strong --c-success --c-warn --c-danger
            --radius --shadow --font-body --font-mono --leading --measure
component   --code-bg --code-fg --code-border --code-label
            --math-fg --toc-w --toc-top --series-1…8 --viz-*
```

组件只引用 semantic 与 component token,不得写字面色值(`validate_assets` 对 `kit/` 加 lint)。

### 5.2 CSS 层

```css
@layer reset, tokens, base, content, shell, learning, viz, theme, course;
```

课程的 `assets/course/theme.css` 位于最后的 `course` 层,无需靠加载顺序与选择器权重覆盖。

### 5.3 主题包与引擎

- `themes/*.css` 只含 `html[data-theme="x"]{ …token… }`;内置 `course`(浅)、`ink`(深)、`paper`(暖),可再加。
- `data-scheme="light|dark"` 与 `data-theme` 分离:主题声明自己的 scheme;`auto` 跟随 `prefers-color-scheme`。
- `theme-engine.js`(L1,presence=core)负责读 `config.theme`、写 `html[data-theme]/data-scheme`、以 courseId 为键持久化到 `localStorage`、派发 `kit:themechange`。
- `shell/theme-switcher` 只是可选 UI,调用引擎。配置型的 `theme.js` 取消,并入 `config.json`(旧 `COURSE_THEMES/COURSE_CODE_THEMES/COURSE_MATH_OPTIONS` 读取兼容并告警)。
- 课程自定义主题:在 `assets/course/theme.css` 增加 `html[data-theme="mine"]{…}`,在 `config.json` 的 `themes` 声明;其余自动适配。
- 打印强制浅色 token。

### 5.4 第三方库接入主题

| 库 | 取色方式 |
|---|---|
| highlight.js | CDN 官方主题 CSS,按 scheme 在 `code.themes` 间切换;块外壳覆盖背景 |
| KaTeX | 继承文字色 |
| Mermaid | token 生成 `themeVariables`,主题变化时重渲染 |
| Chart.js / Plotly | `--series-1…8`、`--c-text`、`--c-border` |
| JSXGraph | 同上 |

## 6. 浮动目录与页面框架

### 6.1 页面框架(`foundation/layout.css`)

```
.kit-page  { display:grid; grid-template-columns: minmax(0,1fr) var(--rail-w,0); column-gap:2rem; container-type:inline-size }
.kit-main  正文,最大宽度 var(--measure-wide)
.kit-rail  右侧栏,放 toc / nav
.kit-bleed 宽内容(表格、可视化)的出血位,可向 rail 一侧溢出,不被挤压
```

使用 container query 而非仅用视口媒体查询,使课件嵌入 iframe 或打印预览时也正确布局。

### 6.2 目录三态(`shell/toc`)

| 容器宽度 | 形态 |
|---|---|
| ≥ 1200px | **侧栏**:右侧 sticky,`top: var(--toc-top)`,自带滚动,可折叠为只显示进度的窄条 |
| 768–1199px | **浮层**:右下"目录"胶囊按钮,点开为锚定在按钮上的 popover,不占版面 |
| < 768px | **抽屉**:顶部紧凑"当前章节"条(sticky),点击或右下按钮弹出底部抽屉(约 80dvh,带遮罩),选中即关闭,Esc 或下滑关闭,聚焦陷阱 |

### 6.3 行为

- **Scrollspy**:`rAF` 节流的滚动监听,当前章节 = 最后一个 `top ≤ 偏移` 的标题;替换 `-75%` IntersectionObserver(它只在"进入"时触发,在向上滚动与短章节时出错)。
- **目录自滚动**:只操作目录容器的 `scrollTop` 保持当前项可见,**不对页面调用 `scrollIntoView`**。
- **层级**:支持 `h2/h3`(`config.toc.depth`),只展开当前 h2 组;当前项 `aria-current="location"`。
- **跳转**:`scroll-margin-top: var(--toc-top)`;尊重 `prefers-reduced-motion`;`hashchange`、`popstate` 与首次带 hash 加载时均正确定位。
- **进度**:目录标题旁阅读进度条,可选已读勾;折叠与已读状态存 `localStorage`。
- **数据源**:默认抓 `h2,h3`;`[data-toc-skip]` 排除;`[data-toc-label="…"]` 为非标题块(如"练习")加入口。
- **稳定锚点**:标题 id 在 `kit sync` 阶段静态生成(支持中文 slug,冲突加后缀)并写回 HTML,避免运行时才生成导致外链失效;`validate_course` 检查重复 id。
- **多课时导航**:`shell/nav` 与 toc 同在 rail,提供课程首页、上一课/下一课、课时列表,取代手写 `course-nav`。
- **无障碍**:`<nav aria-label>`、键盘可达、抽屉聚焦陷阱与关闭后焦点返回;可选快捷键(如 `t`)。
- **打印**:rail、浮层、抽屉均 `display:none`。
- **无脚本**:rail 内保留 `kit sync` 预生成的静态"本课目录"链接列表,脚本仅做增强。

## 7. 运行时与就绪协议

### 7.1 接线

课件 HTML 只留:

```html
<link rel="stylesheet" href="../assets/kit/kit.css">
<link rel="stylesheet" href="../assets/course/theme.css">   <!-- 课程覆盖,可选 -->
<script defer src="../assets/kit/kit.js"></script>
```

- `kit.js` 为构建出的单文件 IIFE,依赖顺序由构建时拓扑排序决定,作者无需关心。
- 页面级配置可选:`<script type="application/json" id="kit-config">…</script>`,与 `assets/course/config.json` 合并(页面优先)。
- `kit.css` 内部按 `@layer` 排好。

### 7.2 就绪协议

- 每个增强元素:`data-kit-state="pending|ready|failed"` 与 `data-kit-module`。
- 每个模块:派发 `kit:<module>:ready`。
- 全局:`document.documentElement.dataset.kitReady="true"`,派发 `kit:ready`,载荷 `{ready:[…], failed:[…]}`。
- 导出与验收脚本只等 `kit:ready`,再检查 `[data-kit-state=failed]`。旧的 `course-ready`、`lk-ready`、`viz-ready`、`media-ready`、`__COURSE_MATH_READY__` 由 shim 保留一个版本周期。

### 7.3 `course.js` 拆分

| 现有 | 去向 |
|---|---|
| `evidenceModel`、`buildLearningRecord`、`initPrintState` | `learning/records` |
| `quizView`、`answerView`、`hintView`、`teachingTargetView`、`dialogueView`、`independenceView` | 合并为 `learning/question`(六种题型 + 提示 + 自动判定帮助方式,见 §7.4) |
| `stepView` | `learning/step` |
| `copyCodeView` | `content/_block` 的 copy action |
| `autoTocView` | `shell/toc` |
| `slugify`、`copyText`、`plainText` | `core/util` |
| LearnKit(state、history、registerModel/View) | `core/store`,接口兼容 |
| visualizations 内核与 kinds | `viz/core`、`viz/kinds/*` |

### 7.4 统一题目块(`learning/question`)

预览:`docs/preview/quiz-preview.html`(六种题型、浅/深主题,可直接交互;它是设计演示,不是正式实现)。

### 现状问题
- 选择题(`.quiz`)、数值/填空(`data-answer-*`)、纠错(`teaching-target`)、对话(`dialogue-practice`)各有一套标记、各自的反馈元素与按钮属性。
- 提示是独立按钮 + `aria-controls`,单级;"作答帮助方式"下拉框对每题固定追加,要求学习者自述。
- 选择题只给泛化反馈:没有逐项解释、没有答案揭示策略、没有解析区。

### 一个组件,六种题型
`data-kind="choice | multi | numeric | fill | open | dialogue"`,共用外壳、状态机、提示、反馈、证据接口,只有"输入区"按题型不同。

作者契约(只写语义标记,外壳、按钮、反馈区全部由运行时生成):

```html
<section class="question" data-question-id="q1" data-kind="choice" data-max-attempts="2">
  <div data-stem>题干(可含 code、公式)</div>
  <ol data-options>
    <li data-option>错误项<span data-why>为什么错</span></li>
    <li data-option data-correct>正确项<span data-why>为什么对</span></li>
  </ol>
  <ol data-hints><li>提示 1</li><li>提示 2</li></ol>   <!-- 可选,逐级揭示 -->
  <div data-explain>解析(可选)</div>
</section>
```

| kind | 输入 | 特有属性 / 子元素 | 判定 |
|---|---|---|---|
| `choice` | 单选 | `[data-option]`,恰好一个 `[data-correct]` | 选中项即正确项 |
| `multi` | 多选 | 至少一个 `[data-correct]` | 选中集合等于正确集合 |
| `numeric` | 数值框 | `data-expected`、`data-tolerance`、`data-unit` | 有限数值,绝对误差内 |
| `fill` | 文本框 | `data-accepted='["答案","别名"]'`、`data-case-sensitive` | NFKC 规范化后匹配 |
| `open` | 文本域 | `[data-key]` 对照要点 | 不判对错;保存后展开要点 |
| `dialogue` | 多轮文本域 | `[data-turns]>li` 每轮一个追问 | 不判对错;逐轮保存锁定 |

### 状态机
- `choice/multi/numeric/fill`:`idle → incorrect*(循环) → correct`;未答对次数达到 `data-max-attempts`(默认 2)后出现"查看答案",揭示后记为已完成但保留 `incorrect` 判定与"已查看答案"标记;答对后锁定并展开解析。
- `open`:`idle → saved`;保存后文本域只读,展开对照要点。
- `dialogue`:每轮保存即锁定为气泡,再出现下一轮;最后一轮保存后 `saved`。
- 空提交只给提示,不计入尝试次数、不产生判定事件。

### 视觉与反馈
- 左侧状态轨(未作答灰、正确绿、再想想琥珀、已保存蓝);头部为题号、题型、状态胶囊,右侧为"第 n 次作答 · 提示 k/N · 独立完成/用过提示"。
- 判定后每个选项用**颜色 + 符号(✓/✗)+ 文字**三重表达;漏选以虚线框加"应选 ·"前缀;`data-why` 在判定后才显示。
- 未答对时只说明"还不对",不暴露答案;答案与解析只在答对或点击"查看答案"后出现。
- 反馈区 `role="status" aria-live="polite"`;单选/多选的原生 input 保留键盘与读屏行为(视觉隐藏,焦点环画在选项标记上)。
- 提示为逐级揭示:按钮显示"再来一个提示 (k/N)",用完后禁用。

### 作答帮助方式:由提示按钮自动判定(取消自述下拉)
- 不再追加"这次作答用了哪些帮助?"选择框。
- 运行时判定:点击过任一提示 → `with_hints`;某条提示声明 `data-guidance="ai_guided"` 且被点击 → `ai_guided`;否则 `independent`。写入元素 `data-assistance`,并派发与现有 `OBSERVED_ASSISTANCE`/`INDEPENDENCE` 同形的证据事件,学习记录字段与结构不变。
- 只升不降:一旦出现更强的帮助级别,不会被后续动作降级(沿用现有 `strongerAssistance` 规则)。
- 局限:页面只能观察到页内提示;学习者在页外使用 AI 的情况页面不可知,仍由 `ai-study` 流程与记录评估补充,记录里 `independent` 只表示"页内未使用提示"。

### 汇总条
- 一课含 2 道及以上题目时可在页首显示粘性汇总条:已作答/总数、进度条、正确数、用过提示数。作者放置 `<div data-question-summary></div>` 即启用;不放置则不显示。
- 汇总只统计页面事实,不推断掌握。

### 证据事件映射(与现有一致)
| 操作 | 事件 |
|---|---|
| 提交答案 | `ATTEMPT`、`VERDICT`(`correct`/`incorrect`)、`RAW_ANSWER` |
| 点击提示 | `HINT`、`OBSERVED_ASSISTANCE` |
| 保存开放题 | `RAW_ANSWER`、`KEY_VIEWED` |
| 保存对话一轮 | `TURN_RAW`、`TURN_SUBMITTED` |
| 判定帮助方式 | `INDEPENDENCE`(运行时自动派发) |
| 查看答案 | `KEY_VIEWED` |

### 兼容、无脚本与打印
- 旧写法 `.quiz/.quiz-option/data-quiz-submit`、`data-answer-kind` + `data-answer-input/check`、`teaching-target`、`dialogue-practice` 由 `kit sync` 规范化为新契约;`validate_course` 对旧写法 warning。
- 无脚本:`[data-stem]`、选项文字、`[data-why]`、提示、解析、对照要点全部是静态 DOM,可读;选项在无脚本时显示为带标记的列表。
- 打印:隐藏操作按钮与汇总条;展开答案标记、逐项解释、解析与对照要点,形成复习版;`config.question.print = "blank"` 可改为空白练习版。(此项为设计要求,预览页中仅实现了默认复习版。)
- 校验(`validate_course`):`data-kind` 合法;`choice` 恰好一个正确项,`multi` 至少一个;`numeric` 的 `data-expected` 为有限数、`data-tolerance` 非负;`fill` 的 `data-accepted` 为字符串数组;`dialogue` 至少 2 轮;`data-question-id` 唯一。

---

## 8. 目录登记去重

| 旧 | 新 |
|---|---|
| `catalog.json` | 由 `kit.manifest.json` 生成的只读视图(供 agent 检索,文件头注明勿手改) |
| `asset-manifest.json`(课程内) | `assets/kit/kit.lock.json` |
| `optional/manifest.json` | 并入各模块 `module.json` |
| `learnkit/components.json` | 并入 core 与 learning 的 `module.json` |
| `visualizations/adapters.json` | 并入 `viz/kinds/*/module.json` |
| `sync_asset_catalog.py` | `kit build` 的一个步骤 |
| `install_optional.py` | `kit add` / `kit sync` |

`kit.lock.json` 示例:

```jsonc
{ "kit": "2.0.0",
  "modules": { "core": "…", "content.code": "…" },
  "files": { "kit.js": "sha256-…", "kit.css": "sha256-…" },
  "vendor": { "hljs": { "mode": "cdn", "version": "11.12.0" } } }
```

## 9. 工具链与校验

| 命令 | 作用 |
|---|---|
| `kit build` | 技能内构建所有模块,更新 manifest 与 catalog 视图 |
| `kit sync <course>` | 扫描课件 → 解析 auto 模块 → 打包 `assets/kit/` → 规范化旧写法 → 生成标题 id 与 TOC 静态后备 → 写 lock |
| `kit add <course> <module>` | 登记 opt-in 模块(chart、spatial、课程扩展) |
| `kit check <course>` | 校验 lock 哈希、漂移与缺失模块,取代 byte-identity 回归 |
| `kit list` | 列出模块、presence、能力、限制,供 agent 选择 |

`validate_course.py` 新增或调整:
- 使用的内容类型与已纳入模块匹配(如有 `pre>code` 但缺 `content.code`,或存在 `failed` 状态)。
- 标题 id 唯一且稳定,rail 内存在静态目录后备。
- 旧 wrapper 写法给 warning。
- 保留无脚本与打印下核心内容可读的检查。
- 字面色值 lint 只针对 `kit/`,课程自定义不受限。

验收沿用 `references/assets.md` 的四条;"逐容器 failed"改为查 `data-kit-state`;"改变一个输入"仍需人工或 Playwright 验证。

## 10. 取舍与开放问题

- **单文件产物**:对 `file://` 与拷贝分发最友好,代价是每课程多带未用到的 core 代码(目标 core + 默认模块 < 200KB,不含 vendor)。
- **CDN 官方高亮主题**:免维护、配色成熟;代价是切换主题时需替换样式表,并依赖 CDN(离线时用本地官方主题 CSS)。
- **auto 检测误判**:正文讲解 `$$` 等纯文本会误触发 math;用 `data-kit-skip` 或转义解决,并在 `kit sync` 报告列出触发依据。
- **旧课程兼容**:已生成课程不自动升级;`kit sync` 为显式操作,旧 `course.js` 对外 API 保留一个版本周期。
- **`file://` 下动态 `import()`**:Mermaid 的加载方式需在迁移早期实测,不可行则改为 UMD 构建的经典脚本。
