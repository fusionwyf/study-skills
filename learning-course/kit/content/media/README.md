# 媒体与图片标注

安装 `media`，加载 `media.css`；LearnKit、course.js 之后加载 `media.js`。图片、音频、视频使用原生 HTML，音视频设置 controls，提供可读文字稿；视频有对白时同时提供 captions track。

图片热点使用下列结构。坐标相对于图片，取 0..100；图片使用自然比例，不使用裁切。每个热点可键盘选择。文字说明始终可读，脚本不自动评分。

```html
<section data-role="evidence" data-question-id="design-notes" data-answer-kind="open">
  <figure data-media>
    <div data-media-frame><img src="../reference/example.svg" alt="入口与庭院的平面图"></div>
    <figcaption data-media-fallback>1. 入口位于图左侧。2. 庭院位于中央。请解释动线。</figcaption>
    <p data-media-status role="status"></p>
    <script type="application/json" data-media-config>{"hotspots":[{"id":"entry","label":"入口","x":10,"y":50,"description":"观察入口与庭院的关系"}]}</script>
  </figure>
  <label for="notes">你的观察与理由</label><textarea id="notes"></textarea>
</section>
```

热点选择是观察状态，原始文字回答进入 course.js 证据 store；“复制学习记录”包含两者。无脚本与打印时依靠图片和完整说明，不依赖热点才能理解任务。音视频播放本身不作为掌握证据。

听辨任务的文字稿用 `details[data-media-transcript]`，放在问题容器内，或在 figure 上通过 `data-media-question="问题 id"` 关联。展开文字稿会记录参考答案已查看与提示辅助；打印另提供 `.print-only` 完整文字稿。避免在初始反馈中提前展示正确答案。
