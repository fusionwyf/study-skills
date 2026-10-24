# Course Kit 组件全览

## 课程契约

- 学习目标：通过亲手操作掌握 Course Kit 全部组件的适用场景与证据回流机制

## 课程边界

待与学习者确认。

## 成功标准

待与学习者确认。

## 路线概览

待设计。路线可以根据后续学习证据调整。

## 课件制作约定

- 视觉预设：`swiss`（切换器可选 `swiss、course、ink、paper、blueprint、riso、brutal、field`；课程自创主题放 `assets/course/themes/<name>.css`，`kit.py sync` 自动发现）。
- 课程专用样式与配置：`assets/course/theme.css` 与 `assets/course/config.json`。
- 本地服务：`python .agents/skills/learning-course/kit/build/kit.py serve <course-dir> --lan`，点击提交后实时落盘 `records/`；视觉自检用 `python .agents/skills/learning-course/kit/build/kit.py shot <course-dir>`。
- 第三方库：按内容优先选成熟库；通过 `kit.py sync` 自动打包管理。
- 依赖记录：产物由 `kit.lock.json` 锁定哈希。

## 学习记录约定

学习者原始反馈和 Agent 的证据判断保存在 `records/`。
