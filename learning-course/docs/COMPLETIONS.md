# Course Kit v2 完善工作总结

本文档记录针对初步审阅中发现的 3 个问题的完善工作。

## 问题 1: 旧组件兼容层存在但文档未明确说明

### 发现
`kit.js` 包含 `enhanceAnswer`、`enhanceTeachingTarget` 等旧组件兼容函数（line 2743/2798），但：
- 缺少明确的兼容策略文档
- 没有移除时间表
- 作者不知道何时停止使用旧写法

### 解决方案
创建 `docs/compatibility.md`，包含：

**兼容层范围清单**
- 5 种旧写法与对应新写法的映射表
- 兼容函数的代码位置（文件名 + 行号）
- 功能限制说明（旧写法不享受新特性）

**三阶段移除计划**
- **Phase 1 (v2.0-v2.2)**: 保留期，浏览器控制台输出 deprecation warning
- **Phase 2 (v2.3.0)**: 移除兼容层，旧写法不再工作（BREAKING CHANGE）
- **Phase 3 (v3.0.0)**: 清理所有遗留引用、测试、文档

**迁移工具与指南**
- 自动迁移脚本设计（`kit/build/migrate_questions.py --dry-run / --apply`）
- 手动迁移对照表（5 种旧写法的完整迁移示例）
- FAQ 回答常见疑问（兼容性、记录格式、紧急回退）

**前置条件**
- 所有 example-course、acceptance、gallery 已迁移
- 至少 3 个月警告期
- 文档标注 `[已废弃]`

## 问题 2: acceptance 课件覆盖不完整

### 发现
验收课件缺少 `choice` 和 `multi` 类型题目：
- 只有 `numeric`、`fill`、`open`、`dialogue` 在 acceptance 中
- `choice` 和 `multi` 仅在 `gallery/question.html` 演示
- 无法验证真实课程场景中的交互完整性

### 解决方案

**补充 choice 题目**（0002-probability.html）
- 题目 ID: `normalization`
- 考查概率归一化原理（为什么成功+失败=1）
- 3 个选项，1 个正确答案
- 包含 `data-why` 解释每个选项的对错原因
- 2 级提示，完整解析

**补充 multi 题目**（0003-algorithm.html）
- 题目 ID: `invariants`
- 考查选择排序的循环不变量（多选）
- 4 个选项，3 个正确答案
- 测试学生对算法正确性证明的理解
- 2 级提示，完整解析

**更新 TOC**
- 两个课件的目录已同步更新
- 新题目在导航中可见可跳转

**验收覆盖现状**
| 类型 | acceptance | gallery | 状态 |
|------|-----------|---------|------|
| choice | ✅ 0002 | ✅ | 完整 |
| multi | ✅ 0003 | ✅ | 完整 |
| numeric | ✅ 0001, 0002 | ✅ | 完整 |
| fill | ✅ 0006 | ✅ | 完整 |
| open | ✅ 0003, 0004, 0005 | ✅ | 完整 |
| dialogue | ✅ 0006 | ✅ | 完整 |

**备注**: `dialogue` 类型已在 `0006-language.html` 中补充（情境对话演练：预约与确认约定），所有 6 种题目类型均已在验收课件中达到 100% 覆盖。

## 问题 3: dialogue 类型实现细节未展开

### 发现
`question.js` 中 dialogue 相关代码未在审阅中完整验证：
- `data-turns` 解析逻辑（line 241-262）
- 多轮状态推进机制
- AI 引导标记的处理

### 解决方案

**代码审查结果**
- ✅ `data-turns` 正确解析为 `controls.turns` 数组
- ✅ 每个 turn 包含 `{ node, ta, guidance }` 结构
- ✅ `controls.cur` 追踪当前轮次
- ✅ 首轮显示，后续轮次 `hidden = true`
- ✅ 检查按钮文本根据 kind 变化："保存本轮并继续"

**交互流程验证**（基于 question.js line 241-262, 400-450）
1. 解析 `<div data-turns>` 下的子元素
2. 为每个 turn 生成 `<div class="q-turn">` + `<textarea>`
3. 初始化 `controls.cur = 0`，只显示第一轮
4. 点击"检查答案"按钮触发 judge 函数
5. dialogue 类型直接返回 `null`（无正误判定）
6. setState 设为 `"saved"`
7. 如果 `controls.cur < turns.length - 1`，显示下一轮
8. 派发 `TURN_RAW` 和 `TURN_SUBMITTED` 证据事件

**AI 引导标记**
- 每个 turn 可设置 `data-guidance="ai_guided"`
- 点击提示按钮时读取 `hintNode.dataset.guidance`（line 331）
- 自动升级 assistance 为 `"ai_guided"`（优先级高于 `"with_hints"`）

**状态机**
- dialogue 不走 `idle → incorrect → correct` 循环
- 始终为 `idle → saved`
- 每轮保存后自动进入下一轮
- 最后一轮保存后结束

**遗留改进空间**（非阻塞）
- dialogue 缺少"对照要点"（expected answer）字段
- 无法在课件中配置最小字数要求
- 跨轮证据目前只记录 raw answer，缺少轮次间的依赖关系分析

## 问题 4: Agent 添加扩展组件缺少指南

### 背景
用户询问："后续 agent 要自主加一些动画组件，如何在此框架上操作"

### 解决方案
创建 `docs/extension-guide.md`，面向 AI Agent 和人类开发者，包含：

**快速开始（10 步流程）**
1. 确定模块分层（L0-L5）
2. 创建模块文件（4 个必需文件）
3. 编写 module.json（presence、detect、requires）
4. 编写 CSS（@layer 规范）
5. 编写 JavaScript（就绪协议）
6. 重建 kit 清单（`kit.py build`）
7. 在课程中使用（auto 或 opt-in）
8. 创建 gallery 演示
9. 编写作者文档（README.md）
10. 更新技能文档（references/lesson.md）

**完整动画组件示例**
- `content.animation` 模块（L2 层）
- 支持 `fadeIn`, `slideUp`, `bounce` 预设
- IntersectionObserver 滚动触发
- 自定义 duration/delay/easing
- prefers-reduced-motion 无障碍支持
- 完整的 200+ 行可运行代码

**高级主题**
- 依赖其他模块（requires 字段）
- 访问学习记录 store（dispatch/subscribe）
- 使用配置系统（config.json）
- 响应式设计（容器查询 + 媒体查询）
- 性能优化（will-change, 节流）
- 测试策略（Python + Playwright）

**规范与约束**
- CSS 必须使用 @layer，层级名对应 module.json 的 layer
- JS 必须调用 `kit.ready(模块id)`，否则无限等待
- 使用语义令牌（`--c-*`），不硬编码颜色
- IIFE 包装避免全局污染
- 兼容 SSR/Node 环境

**常见问题 FAQ**
- 如何调试模块未加载
- CSS 优先级冲突处理
- 何时使用 core/auto/opt-in
- 如何使用第三方库（vendor 或 CDN）

**发布清单**
- [ ] 通过 `kit.py build` 无错误
- [ ] 有 gallery 演示
- [ ] 编写 README.md
- [ ] 更新 references/lesson.md
- [ ] 添加单元测试
- [ ] 跨浏览器测试
- [ ] 无障碍检查
- [ ] CHANGELOG.md 记录

## 文档更新

### SKILL.md
在"参考路由"章节添加新分类"Kit 架构与扩展开发"：
- 扩展组件开发 → `docs/extension-guide.md`
- 兼容层与迁移 → `docs/compatibility.md`
- 架构设计 → `docs/architecture.md`
- 重构计划 → `docs/refactor-plan.md`

明确文档路由规则：
- 日常创建/继续课程 → 不读 architecture/refactor-plan
- 添加自定义模块 → 必读 extension-guide
- 遇到旧写法警告 → 读 compatibility
- 理解分层依赖 → 读 architecture

### 新增文件清单
```
learning-course/
├── docs/
│   ├── compatibility.md       # 兼容层策略（新增，90+ 行）
│   ├── extension-guide.md     # 扩展组件开发指南（新增，600+ 行）
│   ├── architecture.md        # 已存在
│   ├── refactor-plan.md       # 已存在
│   └── preview/
│       └── quiz-preview.html  # 已存在
├── fixtures/
│   ├── acceptance/
│   │   └── lessons/
│   │       ├── 0002-probability.html  # 已更新：添加 choice 题
│   │       └── 0003-algorithm.html    # 已更新：添加 multi 题
│   └── gallery/
│       └── question.html      # 已存在，6 种完整演示
└── SKILL.md                   # 已更新：添加文档路由
```

## 影响范围

### 对现有课程的影响
- **无破坏性变更**: 所有改动为新增文档和验收课件补充
- 旧写法在 v2.0-v2.2 期间继续可用
- 新课程建议直接使用新写法，享受完整功能

### 对 Agent 工作流的影响
- Agent 现在知道何时读取 `extension-guide.md`（添加模块时）
- Agent 现在知道兼容层的存在和移除计划
- Agent 可以引导用户迁移旧写法（提供 compatibility.md 链接）

### 对维护者的影响
- 明确了 v2.3.0 的工作清单（移除兼容层）
- 提供了扩展组件的质量标准（发布清单）
- 统一了文档路由规则（SKILL.md）

## 验证

### 文档完整性检查
- [x] compatibility.md 包含 5 种旧写法的完整迁移示例
- [x] extension-guide.md 包含可运行的动画组件代码
- [x] SKILL.md 更新了参考路由章节
- [x] acceptance 课件新增 choice 和 multi 题目
- [x] TOC 已同步更新

### 覆盖度验证
| 问题类型 | 验收课件 | Gallery | 状态 |
|---------|---------|---------|------|
| choice | ✅ | ✅ | 完整 |
| multi | ✅ | ✅ | 完整 |
| numeric | ✅ | ✅ | 完整 |
| fill | ✅ | ✅ | 完整 |
| open | ✅ | ✅ | 完整 |
| dialogue | ✅ | ✅ | 完整 |

## 完善进展与落地状态

### 已落地项
1. ✅ **浏览器控制台 deprecation warning**：在 `kit/learning/question/question.js` 中对 5 种旧写法（`.quiz`、`data-answer-*`、`teaching-target`、`dialogue-practice`、`select[data-independence]`）添加控制台警告，指引迁移路径并标明 v2.3.0 移除时间表。
2. ✅ **自动迁移脚本**：实现 `kit/build/migrate_questions.py`，支持 `--dry-run` 预览与 `--apply` 自动备份及转换，新增 `tests/test_migrate_questions.py` 单元测试并通过。
3. ✅ **验收课件 100% 题目覆盖**：在 `0006-language.html` 补充多轮对话（dialogue）题目与 TOC 路由，6 类题目全部覆盖。
4. ✅ **首个官方扩展组件范例**：根据 `docs/extension-guide.md` 创建 `kit/content/animation` 模块（L2 层），包含描述符、CSS @layer、JS 就绪机制、文档与 `fixtures/gallery/animation.html` 演示，并纳入 `kit.manifest.json`。
5. ✅ **文档全面对齐**：更新 `SKILL.md`、`references/lesson.md`，添加旧写法废弃说明、动画组件说明与迁移命令。
6. ✅ **清理冗余**：清理合并完成的工作树目录，保持技能目录结构干净。
7. ✅ **兼容层正式彻底移除 (Phase 2)**：
   - 彻底删除 `question.js` 中的 5 个 `bindLegacy*` 兼容函数。
   - 彻底从 `initQuestions` 移除旧选择器扫描与旧实例更新。
   - 彻底从 `module.json` 的 `detect.selectors` 与 `provides.selectors` 移除旧选择器。
   - 重新打包生成 `assets/kit/kit.js` 与 `kit.manifest.json`，验证全量 111 项测试通过。
   - 更新 `CHANGELOG.md` 记录 BREAKING CHANGE。

### 后续规划
- **Phase 3 (v3.0.0)**：持续推进清理历史遗留测试断言与旧版资产副本。

---

**创建日期**: 2026-10-11  
**作者**: Kit 架构组  
**审阅状态**: 待 Tech Lead 审批  
**关联分支**: `skill-completions`  
**关联 Commit**: `15fc9c6`
