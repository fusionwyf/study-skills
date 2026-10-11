# 兼容层策略与移除计划

> [!NOTE]
> 本文档为 Course Kit 重构与工程内部归档，仅记录架构设计与演进历史，**不作为 Agent 运行时参考文档**。
> Agent 创建与维护课程请参考根目录 `SKILL.md` 及 `references/` 目录。

## 背景

Course Kit v2 重构引入了统一问题组件，将旧版的 6 种分散写法（`.quiz`、`data-answer-*`、`data-teaching-check`、`data-dialogue-turn`、`data-independence` 下拉）合并为单一的 `<section class="question" data-kind="...">`。

为保证平滑迁移，v2.0.0 在 `kit.js` 中保留了兼容层（legacy bindings），自动识别旧写法并提供基础交互，但不享受新架构的完整功能（统一状态机、三重反馈、自动判定独立性）。

## 兼容层范围

### 已保留的旧写法支持

| 旧写法 | 对应新写法 | 兼容函数 | 限制 |
|--------|-----------|---------|------|
| `.quiz` + `data-quiz-submit` | `data-kind="choice"` | `bindLegacyQuiz` | 无多次尝试、无提示、无自动判定 |
| `[data-answer-input]` + `[data-answer-check]` | `data-kind="numeric/fill"` | `bindLegacyAnswer` | 无容差配置、无单位显示 |
| `[data-teaching-check]` + `[data-teaching-key]` | `data-kind="open"` | `bindLegacyTeachingTarget` | 只能查看一次对照要点 |
| `[data-dialogue-turn]` + `[data-dialogue-next]` | `data-kind="dialogue"` | `bindLegacyDialogue` | 无 AI 引导标记、无跨轮证据 |
| `<select data-independence>` | 自动判定 | `bindLegacyIndependence` | 仍显示下拉，但不再写入记录 |

### 兼容层代码位置

**文件：** `learning-course/kit/learning/question/question.js`

**函数范围：**
- `bindLegacyQuiz` (line ~530-580)
- `bindLegacyAnswer` (line ~580-630)
- `bindLegacyTeachingTarget` (line ~630-660)
- `bindLegacyDialogue` (line ~660-710)
- `bindLegacyIndependence` (line ~710-750)

**调用入口：** `enhanceModernQuestion` 函数在检测到新写法时使用主逻辑，`kit.records.view.init` 仍会扫描并绑定旧选择器作为降级。

## 移除时间表

### Phase 1: v2.0.0 - v2.2.0 (当前：保留期)

**策略：** 兼容层全部保留，旧写法可用但会在控制台输出 deprecation warning。

**行动：**
- ✅ 已完成：在 `kit.js` 构建时添加警告注释
- ✅ 已完成：在浏览器控制台输出 `console.warn` 提示迁移路径（`question.js`）
- ✅ 已完成：在 `SKILL.md` 和 `references/lesson.md` 标注旧写法为 `[已废弃]`
- ✅ 已完成：实现自动迁移脚本 `kit/build/migrate_questions.py` 并提供单元测试

**示例警告：**
```javascript
console.warn(
  "[Kit v2] 检测到旧版 .quiz 写法，请迁移到 data-kind=\"choice\"。" +
  "参考：learning-course/references/lesson.md#统一题目块。" +
  "兼容层将在 v2.3.0 移除。"
);
```

### Phase 2: v2.3.0 (当前版本：兼容层已正式移除)

**策略：** 移除所有 legacy binding 函数，旧写法不再工作（BREAKING CHANGE）。

**前置条件达成情况：**
1. ✅ 所有 acceptance fixtures、gallery 已全部迁移到现代统一题目块
2. ✅ 文档中旧写法已标注废弃说明与迁移指南
3. ✅ 提供自动迁移工具 `migrate_questions.py`

**移除清单执行状态：**
- ✅ 已删除 `question.js` 中 5 个 `bindLegacy*` 函数
- ✅ 已从 `initQuestions` 移除旧选择器扫描与旧实例更新
- ✅ 已从 `module.json` 的 `detect.selectors` 与 `provides.selectors` 移除旧选择器（`.quiz`, `[data-answer-input]`, 等）
- ✅ 已更新 CHANGELOG.md 标注为 **BREAKING CHANGE**

### Phase 3: v3.0.0 (清理遗留资产与现代路径对齐)

**策略：** 清理所有与旧写法相关的测试、冗余资产目录与引用路径。

**执行状态：**
- ✅ **彻底删除旧版 assets 目录**：物理移除 `learning-course/assets/` 整个目录（消除 `acceptance-course/`、`example-course/`、`learnkit/`、`optional/`、`visualizations/` 等全部历史冗余）。
- ✅ **测试用例与夹具现代化**：
  - `example-course` 迁移至 `fixtures/example-course`。
  - `prepare_acceptance.py` 直连 `fixtures/acceptance`。
  - `fixtures/gallery/viz.html` 接入统一的 `assets/kit/kit.css` 与 `kit.js`。
  - 更新 `tests/test_assets.py`、`tests/test_visualizations.py`、`tests/test_open_components.py` 及 Node.js 测试套件对齐新路径。
- ✅ **全量回归验证通过**：全量测试套件（114 项单元测试）100% PASS。

## 迁移指南

### 自动迁移脚本（已实现）

```bash
python kit/build/migrate_questions.py <course-dir> --dry-run
python kit/build/migrate_questions.py <course-dir> --apply
```

脚本功能：
1. 扫描所有 `.html` 文件
2. 识别旧写法模式
3. 生成对应的 `data-kind` 新写法
4. 保留 `data-question-id`、`data-max-attempts` 等元数据
5. 输出迁移报告

### 手动迁移对照表

#### 单选题
```html
<!-- 旧写法 -->
<div class="quiz" data-question-id="q1">
  <p>题干</p>
  <div class="quiz-option"><input type="radio" name="q1"><label>选项A</label></div>
  <button data-quiz-submit>提交</button>
</div>

<!-- 新写法 -->
<section class="question" data-question-id="q1" data-kind="choice" data-max-attempts="2">
  <div data-stem><p>题干</p></div>
  <ol data-options>
    <li data-option data-correct>选项A</li>
  </ol>
  <ol data-hints><li>提示内容</li></ol>
  <div data-explain><p>解析内容</p></div>
</section>
```

#### 数值题
```html
<!-- 旧写法 -->
<div data-question-id="q2">
  <input data-answer-input>
  <button data-answer-check>检查</button>
  <p data-role="answer-feedback"></p>
</div>

<!-- 新写法 -->
<section class="question" data-question-id="q2" data-kind="numeric" 
         data-expected="9.8" data-tolerance="0.05" data-unit="m/s²">
  <div data-stem><p>标准重力加速度是多少？</p></div>
  <ol data-hints><li>工程计算通常取 9.8</li></ol>
  <div data-explain><p>标称值 9.80665 m/s²</p></div>
</section>
```

#### 开放题
```html
<!-- 旧写法 -->
<div data-question-id="q3" data-role="teaching-target">
  <textarea></textarea>
  <button data-teaching-check>查看对照要点</button>
  <div data-teaching-key hidden>要点内容</div>
</div>

<!-- 新写法 -->
<section class="question" data-question-id="q3" data-kind="open">
  <div data-stem><p>简述系统误差与随机误差的区别</p></div>
  <div data-key><p>系统误差有确定规律，随机误差有统计分布</p></div>
</section>
```

#### 对话题
```html
<!-- 旧写法 -->
<div data-question-id="q4" data-role="dialogue-practice">
  <div data-dialogue-turn><p>第一轮提示</p><textarea></textarea></div>
  <div data-dialogue-turn><p>第二轮提示</p><textarea></textarea></div>
  <button data-dialogue-next>下一轮</button>
</div>

<!-- 新写法 -->
<section class="question" data-question-id="q4" data-kind="dialogue">
  <div data-stem><p>费曼技巧演练：向初学者解释熵增原理</p></div>
  <div data-turns>
    <div data-prompt="用日常比喻解释什么是熵？"></div>
    <div data-prompt="为什么系统自发向混乱度增大方向演化？"></div>
  </div>
  <div data-explain><p>完成两轮解释即达成证据采集</p></div>
</section>
```

## 测试策略

### 当前测试覆盖（v2.0.x）

1. **新写法主路径测试：** 6 种 data-kind 的完整状态机
2. **兼容层烟雾测试：** 确保旧写法不报错，基础交互可用
3. **迁移脚本测试：** 验证自动转换的正确性

### v2.3.0 移除前的回归测试

运行迁移脚本处理所有已知课程包，确保：
- 所有题目都有对应的新写法
- 记录格式与旧版保持一致（字段名可读取）
- 无 JavaScript 运行时错误

## 文档更新清单

### 立即标注为废弃（v2.0.x）

- [ ] `SKILL.md` 在旧写法示例前添加 `⚠️ [已废弃，将在 v2.3.0 移除]`
- [ ] `references/lesson.md` 移除旧写法示例，仅保留新写法
- [ ] `README.md` 在特性列表中注明"向后兼容旧版题目写法（至 v2.2.x）"

### v2.3.0 移除时更新

- [ ] CHANGELOG.md 添加 BREAKING CHANGE 章节
- [ ] 更新所有 example-course、tutorial 到新写法
- [ ] 生成迁移指南 PDF/视频

## FAQ

**Q: 我的课程使用了旧写法，现在还能正常运行吗？**  
A: 能。v2.0.0 - v2.2.x 全面兼容，但会在控制台输出警告。建议尽快迁移以享受新功能（多次尝试、提示系统、自动判定独立性）。

**Q: 迁移脚本会修改我的课件文件吗？**  
A: 默认 `--dry-run` 模式只输出报告不修改。使用 `--apply` 前建议先 git commit，脚本会备份原文件到 `.backup/`。

**Q: 旧写法的学习记录能否被新版读取？**  
A: 能。记录的核心字段（questionId、verdict、attempts）保持一致，只是新版增加了 assistance、hints 等字段。

**Q: 如果 v2.3.0 移除兼容层后发现遗留课程包怎么办？**  
A: 可以临时安装 v2.2.x 版本的 kit，运行迁移脚本后再升级到 v2.3+。或联系维护者请求延长兼容期。

---

**维护者：** Kit 架构组  
**最后更新：** 2026-10-11  
**审阅状态：** Draft → 需 Tech Lead 批准后执行
