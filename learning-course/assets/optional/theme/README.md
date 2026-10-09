# 可选组件：主题与自定义 Theme

把 `course.css` 里原本写死的视觉决策暴露成可覆盖的 token，让每门课能自己换肤，而**不需要改动任何组件类名或机器标记**。

本组件**不提供任何配色方案**。主题是课程自己的 CSS，这里只负责记住选择并应用。

## 引入

```html
<head>
  <link rel="stylesheet" href="../assets/course.css">
  <link rel="stylesheet" href="../assets/optional/theme/theme.css">
</head>
<body>
  ...
  <!-- 需要切换器时给一个容器，脚本会往里面放下拉框 -->
  <div data-theme-switch></div>
  <script src="../assets/optional/theme/theme.js"></script>
</body>
```

`theme.css` 必须在 `course.css` **之后**引入。样式文件单独用也行（不起脚本也能换肤，见「只用 CSS」）。

## 定义一套主题

在课程自己的样式里写一组 `[data-theme]` 规则。以下是完整可用的例子：

```css
/* 冷色学术风 */
[data-theme="scholar"] {
  --course-bg: #f7f8fb;
  --course-surface: #ffffff;
  --course-text: #1d2433;
  --course-accent: #3157d5;
  --course-accent-strong: #203a9c;
}

/* 暖色人文风 */
[data-theme="warm"] {
  --course-bg: #fbf7f2;
  --course-surface: #fffdfa;
  --course-text: #2c2118;
  --course-text-muted: #6b5a4a;
  --course-border: #e6dbcd;
  --course-accent: #b45309;
  --course-accent-strong: #8a3f07;
  --course-radius: 0.25rem;   /* 直角一点 */
  --course-shadow: none;      /* 去投影 */
}
```

可覆盖的 token 分三组。

### 一、`course.css` 原有 token

| Token | 作用 |
|---|---|
| `--course-bg` / `--course-surface` / `--course-surface-muted` | 页面底色、卡片面、次级面 |
| `--course-text` / `--course-text-muted` | 正文、次要文字 |
| `--course-border` | 全部描边 |
| `--course-accent` / `--course-accent-strong` | 主强调色、链接与 hover |
| `--course-success` / `--course-warning` / `--course-danger` | callout 语义色 |
| `--course-code-bg` / `--course-code-text` | 代码块底色与文字 |
| `--course-radius` / `--course-shadow` | 圆角、投影 |
| `--course-max` / `--course-leading` | 内容宽度、行高 |
| `--course-font` / `--course-mono` | 正文字体、等宽字体 |

### 二、本组件补的 token（`course.css` 原本写死）

| Token | 作用 |
|---|---|
| `--course-code-muted` | 代码块语言标签文字色 |
| `--course-code-border` | 复制按钮描边 |
| `--course-code-hover` | 复制按钮 hover 底色 |
| `--course-step-badge-bg` / `--course-step-badge-text` | 步骤序号圆标 |
| `--course-viz-border` / `--course-viz-surface` / `--course-viz-head-bg` | 可视化容器面 |
| `--course-viz-active-border` / `--course-viz-highlight` | 可视化选中态 |
| `--course-viz-sorted-bg` / `--course-viz-sorted-border` | 可视化已排序态 |

改这些能让主题连可视化组件一起带上，不用另写选择器。

### 三、声明主题表面

代码高亮的 token 要按明/暗两套取值。在 `<html>` 上标一下即可：

```html
<html lang="zh-CN" data-theme-surface="light">
```

`light` 会启用一套浅色代码配色；不写则按深色处理。两个组件都装了才需要关心这个。

## 注册与切换

脚本不猜主题，由课程显式登记。在 `theme.js` **之前**定义：

```html
<script>
  window.COURSE_THEMES = [
    {name: "scholar", label: "学术", surface: "light"},
    {name: "warm",    label: "人文", surface: "light"},
    {name: "ink",     label: "墨色", surface: "dark"}
  ];
</script>
```

- `name` 对应 CSS 里的 `[data-theme="..."]`
- `label` 是下拉框显示的文字
- `surface` 决定 `data-theme-surface`，影响代码块配色

**主题数 < 2 时不生成切换器**，减少界面噪音。需要切换器就给 `<html>` 里放一个 `<div data-theme-switch>`。

选择顺序：**`<html data-theme="x">` 显式指定 → `localStorage` 记住的选择 → 跟随系统**。选「跟随系统」时按 `prefers-color-scheme` 挑第一个 `surface` 匹配的主题；没有匹配的就用列表第一个。

## 只用 CSS

不起脚本也能换肤——直接给 `<html>` 写死主题即可，切换器不出现：

```html
<html lang="zh-CN" data-theme="warm" data-theme-surface="light">
```

这是最省事的路子，适合一门课一套配色的情况。

## 降级行为

| 情况 | 表现 |
|---|---|
| 未引入 `theme.js` | 按 `<html data-theme>` 或 `course.css` 默认值呈现；切换器不出现 |
| `localStorage` 不可用（隐私模式） | 本次会话内切换生效，不持久化 |
| 打印 | 强制浅色，隐藏切换器 |
| 主题名写错 | 回退到 `course.css` 的 `:root` 默认值，不报错 |

## 与代码高亮的关系

两个组件是解耦的：`theme` 改颜色，`code-highlight` 上色。同时使用时，`theme.js` 切换主题会派发 `course:themechange` 事件：

```js
window.addEventListener("course:themechange", function (e) {
  // e.detail = {theme: "ink", surface: "dark"}
  // 需要的话在这里让第三方组件重新取色
});
```
