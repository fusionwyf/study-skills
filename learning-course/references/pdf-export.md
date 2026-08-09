# PDF 导出规范

## 原则

把 HTML 课程包视为源文件，把 PDF 视为可重复生成的发布物。不要从 PDF 反向恢复课程状态，也不要把学习反馈、内部推断和课程状态默认导出。

## 导出范围

- 单课：`exports/0001-topic.student.pdf` 或 `exports/0001-topic.review.pdf`。
- 当前课程：`exports/course-current.student.pdf` 或 `exports/course-current.review.pdf`。
- 完结课程：`exports/course-final.review.pdf`。

`student` 隐藏答案与解析但保留作答空间；`review` 显示答案、解析、推导和参考结果。

## HTML 的打印约定

- 使用 `@page` 设置尺寸和页边距；中文默认 A4。
- 在 `@media print` 中移除导航、复制按钮、滑杆和其他无意义控件。
- 展开 `<details>`、`.step` 和推导区块。
- 避免标题与后续正文分离，避免代码块和公式被截断。
- 为动态图表准备 `.print-snapshot`；滑杆至少输出起点、典型值和边界值。
- 图表使用矢量 SVG 或足够分辨率的静态图。
- 链接保留可点击目标；必要时在打印版显示 URL。
- 使用本地字体和数学资源，等待 `document.fonts.ready`。

## 渲染优先级

1. 当前 Agent 提供的现代浏览器 PDF 能力。
2. Playwright/Chromium `page.pdf()`。
3. Chrome、Edge 或 Chromium 的无头打印。
4. 学习者手动使用浏览器打印。

只有在课程没有 JavaScript 渲染依赖时才使用不完整支持现代浏览器行为的 HTML-to-PDF 引擎。

## 导出前检查

- HTML 在普通浏览器中已经完成视觉检查。
- 公式、字体、图表和代码高亮已经渲染。
- `student` 与 `review` 的答案可见性正确。
- 课程内链接使用相对路径；外部链接已核实。
- 没有把 `records/` 或 `course.yaml` 嵌入页面。

## 导出后检查

- PDF 文件大小大于零且可以打开。
- 没有意外空白页、裁切、重叠、孤立标题或缺失字符。
- 代码行没有超出页面；长 URL 可以换行。
- 图表标题、坐标、图例和替代说明仍然可理解。
- 页数和导出模式符合预期。

## 导出记录

可在 `exports/export-log.md` 追加：

```markdown
- 2026-01-01T00:00:00Z
  - source: lessons/0001-topic.html
  - output: exports/0001-topic.student.pdf
  - mode: student
  - renderer: Chromium
  - visual_check: passed
```

导出失败时记录原因，不创建空 PDF 或把 HTML 改名为 `.pdf`。
