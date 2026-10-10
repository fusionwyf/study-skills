# 可选组件：代码块语法着色

零依赖接线，用 [highlight.js](https://highlightjs.org/) 给 `.code-block` 上色。引擎从 CDN 取，配色用**官方主题**，本组件只负责加载、挑主题和保住课程自己的代码底。

## 引入

主题与样式在 `<head>`，脚本在 `</body>` 前：

```html
<link rel="stylesheet" href="../assets/optional/code-highlight/code-highlight.css">
...
<script src="../assets/optional/code-highlight/theme.js"></script>
<script src="../assets/optional/code-highlight/code-highlight.js"></script>
```

`theme.js` 会按 `data-theme-surface`（缺省时按系统偏好）插一个官方主题样式表；`code-highlight.js` 负责上色。顺序不能反。脚本自动处理页面上**所有** `.code-block pre code`，不需要逐块标注。

## 配色：官方主题，不是手写色表

本组件**不自带 token 颜色**，引擎与主题都使用同一固定版本的官方 CDN 构建：

| 课程表面 | 加载的官方主题 |
|---|---|
| `data-theme-surface="light"` | `github.min.css` |
| 其它 / 未声明且系统为深色 | `github-dark.min.css` |
| 未声明且系统为浅色 | `github.min.css` |

默认主题地址是 `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/styles/github.min.css` 与同目录的 `github-dark.min.css`。课程要换配色时在自己的 `assets/theme.js` 声明 `window.COURSE_CODE_THEMES = {light: "github", dark: "atom-one-dark"}`；官方主题名从固定版本 CDN 加载，也可以填写固定版本的完整 CDN URL，或以 `./`、`../` 开头的课件相对路径。设置在主题选择脚本之前加载，按 `data-theme-surface` 切换。不修改共享 theme.js，不手写 token 色表。明确要求离线时将选中的官方主题预置本地并填写对应路径。

装了 `theme` 组件并用切换器换肤时，组件会监听 `course:themechange` 事件自动换主题，不用手动干预。

## 课程配色仍然优先

官方主题会给 `code.hljs` 硬塞 `background:#fff` 和 `padding:1em`，这会盖掉课程底色。`code-highlight.css` 用更高优先级的 `.code-block code.hljs` 把这两项收回课程自己管：

```css
.code-block code.hljs { background: none; padding: 0; color: inherit; ... }
```

结果就是：**token 颜色来自官方主题，底色和留白来自 `course.css`**。因此代码块的底色、圆角、等宽字体、复制按钮、语言标签、`pre` 横向滚动全部照常，不受主题影响。

只用 `theme` 组件的 `data-theme-surface="light"` 时，代码底会自动切到浅色（`#f6f8fa` / `#1f2328`），和 `github` 主题正好配套，不用手写。

## 语言怎么识别

按以下顺序取第一个命中的：

1. `.code-language` 标签的可见文本（推荐，和现有课件写法一致）
2. `code` 的 class，如 `language-python` / `lang-c` / `highlight-js`

highlight.js 自己认识绝大多数别名（`js`、`py`、`sh`、`yml`、`html`、`c++`、`c#`、`objc`、`toml`…），组件不再抄一份语言表，而是直接问引擎：`hljs.getLanguage(name)`。只有少数它不认识的才在 `EXTRA_ALIASES` 里补：`node→javascript`、`console/terminal→shell`、`conf/cfg→ini`。

固定版本 11.12.0 的默认构建内置 **36 种语言**：

```text
bash c cpp csharp css diff go graphql ini java javascript json kotlin less lua
makefile markdown objectivec perl php plaintext python python-repl r ruby rust
scss shell sql swift vbnet wasm xml yaml
```

**不在这个清单里的语言退化为不着色的纯文本**，且**不发额外请求、也不会被猜成别的语言**——宁可不上色，也不引入一个会失败的远程依赖，更不给读者错误的着色暗示。想看当前构建支持哪些语言：

```js
window.CourseCodeHighlight.languages();
```

## 离线与扩展

**完全离线**：将同版本引擎和选用的官方主题放进包内；先加载本地引擎注册 window.hljs，并在 COURSE_CODE_THEMES 指定本地主题路径。默认组件不复制主题 CSS。

```html
<script src="../assets/vendor/highlight/highlight.min.js"></script>
```

**清单外的语言**：官方构建单文件不含全部 193 种语言。额外语言要单独加载，在引擎之后、本脚本之前注册：

```html
<script src=".../highlight.min.js"></script>
<script src=".../languages/elixir.min.js"></script>
```

## 降级行为

| 情况 | 表现 |
|---|---|
| CDN 不可达 | 保留单色原文，`window.__COURSE_CODE_HIGHLIGHT_READY__ = false` |
| 禁用 JavaScript | 保留单色原文 |
| 语言不在内置清单 | 该块不着色，且不被自动猜测，其余块正常 |
| 官方主题文件缺失 | token 无色，但仍可读、可复制 |
| 打印 | 所有 token 强制还原为可复制纯文本，不做着色 |
| `prefers-reduced-motion` | 关闭 token 过渡动画 |
| `prefers-contrast: more` | 代码块加内描边 |

代码块原有的复制按钮、语言标签、`pre` 横向滚动都继续可用。

## 动态插入的代码块

脚本只在初始化时扫描一次。课件的某个交互后续插入了新代码块时，调用：

```js
window.CourseCodeHighlight.highlightAll(容器元素);
```
