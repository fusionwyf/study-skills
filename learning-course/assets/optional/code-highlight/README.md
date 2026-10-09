# 可选组件：代码块语法着色

零依赖接线，用 [highlight.js](https://highlightjs.org/) 给 `.code-block` 上色。引擎从 CDN 取，本组件只负责加载和主题对接。

## 引入

在课件 `<head>` 加样式，在 `</body>` 前加脚本（顺序不能反）：

```html
<link rel="stylesheet" href="../assets/optional/code-highlight/code-highlight.css">
...
<script src="../assets/optional/code-highlight/code-highlight.js"></script>
```

脚本自动处理页面上**所有** `.code-block pre code`，不需要逐块标注。

## 语言怎么识别

按以下顺序取第一个命中的：

1. `.code-language` 标签的可见文本（推荐，和现有课件写法一致）
2. `code` 的 class，如 `language-python` / `lang-c` / `highlight-js`

常见别名会自动归一：`js→javascript`、`py→python`、`sh→bash`、`yml→yaml`、`html→xml`、`c++→cpp`、`cs→csharp`。

固定版本 11.12.0 的默认构建内置 **36 种语言**：

```text
bash c cpp csharp css diff go graphql ini java javascript json kotlin less lua
makefile markdown objectivec perl php plaintext python python-repl r ruby rust
scss shell sql swift typescript vbnet wasm xml yaml
```

**不在这个清单里的语言不会发额外请求**，而是退化为不着色的纯文本——宁可不上色，也不引入一个会失败的远程依赖。需要清单外的语言时，见下文「离线与扩展」。

## 换配色（两种方式）

**方式一：改 token 变量**（推荐，跟着课程主题走）

在课程自己的样式里覆盖这几个变量即可：

```css
.code-block {
  --code-token-comment: #8b949e;
  --code-token-keyword: #ff7b72;
  --code-token-string:  #a5d6ff;
  --code-token-number:  #79c0ff;
  --code-token-title:   #d2a8ff;
  --code-token-builtin: #79c0ff;
  --code-token-attr:    #7ee787;
  --code-token-symbol:  #ffa657;
}
```

如果课程走浅色代码底，除了上面这些还要调 `.code-block` 的 `--course-code-bg` / `--course-code-text`。装了 `theme` 组件时，给 `<html>` 加 `data-theme-surface="light"` 会自动应用一套浅色 code token，不用手写。

**方式二：直接套用官方主题**

highlight.js 有 516 套现成主题。它们的 token 类名和本文件一致，所以**在本文件之后**再引入主题样式即可覆盖：

```html
<link rel="stylesheet" href="../assets/optional/code-highlight/code-highlight.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/styles/github.min.css">
```

常用主题：`github`（浅）、`github-dark`（深）、`atom-one-dark`、`nord`、`vs2015`。注意官方主题会连带设置代码块的背景和文字色，可能和课程配色冲突；要保留课程配色就只用方式一。

## 离线与扩展

**完全离线**：把同版本资源放进包内并先用全局变量注册，脚本检测到 `window.hljs` 存在就不会再发网络请求。

```html
<link rel="stylesheet" href="../assets/vendor/highlight/styles/github-dark.min.css">
<script src="../assets/vendor/highlight/highlight.min.js"></script>
<link rel="stylesheet" href="../assets/optional/code-highlight/code-highlight.css">
...
<script src="../assets/optional/code-highlight/code-highlight.js"></script>
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
| 语言不在内置清单 | 该块不着色，其余块正常 |
| 打印 | 所有 token 强制还原为可复制纯文本，不做着色 |
| `prefers-reduced-motion` | 关闭 token 过渡动画 |

代码块原有的复制按钮、语言标签、`pre` 横向滚动都继续可用。

## 动态插入的代码块

脚本只在初始化时扫描一次。课件的某个交互后续插入了新代码块时，调用：

```js
window.CourseCodeHighlight.highlightAll(容器元素);
```
