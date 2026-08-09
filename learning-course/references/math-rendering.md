# 公式与 KaTeX 按需渲染

仅在课程包含公式时读取本文件。`math.js` 随所有课程模板复制；普通课程不加入 KaTeX vendor 资源。

## 课程目录

```text
assets/
├── math.js
└── vendor/katex/
    ├── katex.min.css
    ├── katex.min.js
    └── fonts/
```

把 KaTeX 文件放在课程包内，避免依赖 CDN。不同 Agent 可以使用已有本地资源；无法取得 KaTeX 时保留纯文本公式，不要编造或下载未经允许的资源。

## HTML 加载顺序

```html
<link rel="stylesheet" href="../assets/vendor/katex/katex.min.css">
<script src="../assets/vendor/katex/katex.min.js"></script>
<script src="../assets/math.js"></script>
```

在 `.math-expression` 或其他元素上使用 `data-tex`：

```html
<span class="math-expression" data-tex="a^2+b^2=c^2" aria-label="a 的平方加 b 的平方等于 c 的平方">a² + b² = c²</span>
```

`math.js` 只在检测到 `window.katex` 后渲染，不发起网络请求；没有 KaTeX 时保留元素原有文本。公式必须提供 `aria-label` 或附近的文字解释。行内公式使用 `data-display-mode="inline"`，默认公式按展示模式渲染。

## 打印

打印前等待 `document.fonts.ready` 和 `window.__COURSE_MATH_READY__`。PDF 导出不能依赖滑杆或鼠标悬停来显示公式。
