# Course Kit v2 扩展组件开发指南

本指南面向需要为 Course Kit 添加自定义模块的开发者（包括 AI Agent）。

## 快速开始

### 1. 确定模块分层

根据功能性质选择所属层级：

| 层级 | 目录 | 用途 | 示例 |
|------|------|------|------|
| L0 | `kit/core/` | 运行时基础设施 | 事件总线、配置加载器、状态存储 |
| L1 | `kit/foundation/` | 视觉基础与主题 | 设计令牌、主题引擎、基础布局 |
| L2 | `kit/content/` | 内容增强组件 | 代码块、数学公式、图表、**动画** |
| L3 | `kit/shell/` | 页面骨架与导航 | TOC、进度条、主题切换器 |
| L4 | `kit/learning/` | 教学交互组件 | 问题、步骤引导、记录系统 |
| L5 | `kit/viz/` | 数据可视化 | 算法演示、图表库、几何画板 |

**选择原则：**
- 不依赖教学语义 → L2 content
- 需要访问学习记录 → L4 learning
- 纯数据驱动的可视化 → L5 viz
- 全局 UI 框架 → L3 shell

### 2. 创建模块文件

假设添加 **动画组件** 到 L2：

```bash
cd learning-course/kit/content
mkdir animation
cd animation
```

创建 4 个必需文件：
- `module.json` - 模块描述符
- `animation.css` - 样式（必须使用 @layer）
- `animation.js` - 逻辑（必须调用 kit.ready）
- `README.md` - 作者文档（可选但推荐）

### 3. 编写模块描述符

**`module.json`** 是模块的元数据声明：

```json
{
  "id": "content.animation",
  "layer": 2,
  "version": "2.0.0",
  "requires": ["core", "foundation"],
  "presence": "auto",
  "detect": {
    "selectors": [
      "[data-animate]",
      ".animate-fade-in",
      ".animate-slide"
    ]
  },
  "provides": {
    "css": ["animation.css"],
    "js": ["animation.js"]
  },
  "ready": "kit:content.animation:ready"
}
```

**字段说明：**

| 字段 | 必需 | 说明 |
|------|------|------|
| `id` | ✅ | 模块唯一标识，格式 `层级.模块名` |
| `layer` | ✅ | 层级编号 (0-5)，决定 CSS @layer 顺序 |
| `version` | ✅ | 语义化版本号 |
| `requires` | ✅ | 依赖的其他模块 ID，必须包含 `"core"` |
| `presence` | ✅ | 加载策略：`"core"` / `"auto"` / `"opt-in"` |
| `detect` | 条件 | presence=auto 时必需，用于自动检测的选择器 |
| `provides.css` | 可选 | CSS 文件列表（相对路径） |
| `provides.js` | 可选 | JS 文件列表（相对路径） |
| `ready` | ✅ | 就绪事件名，格式 `kit:<模块id>:ready` |

**presence 三态：**

- **core**: 总是加载（如 core、foundation、learning.records）
- **auto**: 检测到 `detect.selectors` 时自动加载（如 content.code、learning.question）
- **opt-in**: 手动添加才加载（如 viz.kinds.spatial、content.animation）

### 4. 编写 CSS（遵循 @layer 规范）

**`animation.css`**

```css
@layer content {
  /* 基础动画类 */
  [data-animate] {
    --anim-duration: var(--duration, 0.6s);
    --anim-delay: var(--delay, 0s);
    --anim-easing: var(--easing, cubic-bezier(0.4, 0, 0.2, 1));
  }

  [data-animate]:not(.is-animated) {
    opacity: 0;
  }

  [data-animate].is-animated {
    animation: var(--anim-name) var(--anim-duration) var(--anim-easing) var(--anim-delay) forwards;
  }

  /* 预设动画 */
  @keyframes kit-fade-in {
    to { opacity: 1; }
  }

  @keyframes kit-slide-up {
    from {
      opacity: 0;
      transform: translateY(2rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes kit-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1rem); }
  }

  /* 无障碍：尊重用户偏好 */
  @media (prefers-reduced-motion: reduce) {
    [data-animate] {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
  }
}
```

**CSS 编写规范：**

1. **必须使用 @layer**，层级名对应 module.json 的 layer：
   - L0 → `@layer reset`
   - L1 → `@layer tokens` 或 `@layer base`
   - L2 → `@layer content`
   - L3 → `@layer shell`
   - L4 → `@layer learning`
   - L5 → `@layer viz`

2. **使用语义令牌**，不要硬编码颜色：
   ```css
   /* ✅ 推荐 */
   color: var(--c-text);
   background: var(--c-surface);
   border: 1px solid var(--c-border);
   
   /* ❌ 避免 */
   color: #333;
   background: white;
   ```

3. **响应式使用容器查询**（如果适用）：
   ```css
   @container (max-width: 767px) {
     .animation-controls { display: none; }
   }
   ```

### 5. 编写 JavaScript（遵循就绪协议）

**`animation.js`**

```javascript
(function (root) {
  "use strict";

  // 1. 获取全局 kit 对象
  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  // 2. 预设配置
  var PRESETS = {
    fadeIn: { name: "kit-fade-in", duration: "0.6s", easing: "ease-out" },
    slideUp: { name: "kit-slide-up", duration: "0.6s", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    bounce: { name: "kit-bounce", duration: "0.8s", easing: "ease-in-out" }
  };

  // 3. IntersectionObserver 配置
  var observerOptions = {
    root: null,
    rootMargin: "0px 0px -10% 0px",
    threshold: 0.1
  };

  var observer = null;

  // 4. 核心函数
  function parseConfig(el) {
    var preset = el.dataset.animate;
    var duration = el.dataset.animateDuration;
    var delay = el.dataset.animateDelay || "0s";
    var easing = el.dataset.animateEasing;

    if (PRESETS[preset]) {
      var p = PRESETS[preset];
      return {
        name: p.name,
        duration: duration || p.duration,
        easing: easing || p.easing,
        delay: delay
      };
    }

    // 自定义动画名
    return {
      name: preset,
      duration: duration || "0.6s",
      easing: easing || "ease-out",
      delay: delay
    };
  }

  function animateElement(el) {
    if (el.classList.contains("is-animated")) return;

    var cfg = parseConfig(el);
    el.style.setProperty("--anim-name", cfg.name);
    el.style.setProperty("--anim-duration", cfg.duration);
    el.style.setProperty("--anim-easing", cfg.easing);
    el.style.setProperty("--anim-delay", cfg.delay);
    el.classList.add("is-animated");

    // 动画完成后触发事件
    el.addEventListener("animationend", function onEnd() {
      el.removeEventListener("animationend", onEnd);
      kit.emit("kit:animation:complete", { element: el, id: el.id });
    }, { once: true });
  }

  function observeCallback(entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateElement(entry.target);
        if (observer) observer.unobserve(entry.target);
      }
    });
  }

  // 5. 初始化入口
  function enhance() {
    var elements = document.querySelectorAll("[data-animate]");
    if (!elements.length) {
      // 即使没有元素也要标记就绪
      kit.ready("content.animation");
      return;
    }

    // 支持 IntersectionObserver 时使用滚动触发
    if ("IntersectionObserver" in root) {
      observer = new IntersectionObserver(observeCallback, observerOptions);
      Array.prototype.forEach.call(elements, function (el) {
        if (el.dataset.animateTrigger === "immediate") {
          animateElement(el);
        } else {
          observer.observe(el);
        }
      });
    } else {
      // 降级：立即播放所有动画
      Array.prototype.forEach.call(elements, animateElement);
    }

    // 6. 标记模块就绪（必需！）
    kit.ready("content.animation");
  }

  // 7. 等待 DOM 就绪后初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhance);
  } else {
    enhance();
  }

  // 8. 暴露公共 API（可选）
  kit.animation = {
    animate: animateElement,
    presets: PRESETS
  };

})(typeof window !== "undefined" ? window : this);
```

**JavaScript 编写规范：**

1. **必须调用 `kit.ready(模块id)`**，否则 kit 会无限等待
2. **使用 IIFE 包装**，避免全局变量污染
3. **兼容 SSR/Node 环境**：`typeof window !== "undefined"`
4. **事件使用 kit.emit**，不要直接 `dispatchEvent`
5. **访问 store**：`var store = kit.store;`

### 6. 重建 Kit 清单

```bash
cd learning-course
python kit/build/kit.py build
```

输出示例：
```
[Kit] Scanning modules...
[Kit] Found 24 modules
[Kit] Topological order: core → foundation → content._block → content.animation → ...
[Kit] Writing kit/kit.manifest.json
[Kit] Updating kit/catalog.json
✓ Build complete
```

### 7. 在课程中使用

#### 方式 A：自动检测（presence=auto）

直接在课件中使用 `data-animate`：

```html
<section data-animate="fadeIn" data-animate-delay="0.2s">
  <h2>标题会在滚动到视口时淡入</h2>
</section>
```

运行 sync 自动打包：
```bash
python kit/build/kit.py sync path/to/course
```

#### 方式 B：手动添加（presence=opt-in）

```bash
python kit/build/kit.py add path/to/course content.animation
```

生成的 `assets/course/config.json`：
```json
{
  "modules": ["content.animation"]
}
```

### 8. 创建演示 Gallery

**`learning-course/fixtures/gallery/animation.html`**

```html
<!doctype html>
<html lang="zh-CN" data-theme="course">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Gallery · Animation Component</title>
  <link rel="stylesheet" href="../acceptance/assets/kit/kit.css">
  <link rel="stylesheet" href="../acceptance/assets/course/theme.css">
</head>
<body class="kit-page">
  <div class="kit-main">
    <header class="course-header">
      <h1>Animation Component (L2)</h1>
      <p>滚动触发动画、预设配置、自定义时序</p>
    </header>

    <section data-animate="fadeIn">
      <h2>Fade In</h2>
      <p>滚动到视口时淡入</p>
    </section>

    <section data-animate="slideUp" data-animate-delay="0.2s">
      <h2>Slide Up with Delay</h2>
      <p>延迟 0.2s 后向上滑入</p>
    </section>

    <div data-animate="bounce" data-animate-trigger="immediate">
      <h2>Immediate Bounce</h2>
      <p>页面加载立即播放弹跳动画</p>
    </div>

    <section data-animate="fadeIn" data-animate-duration="2s" data-animate-easing="ease-in-out">
      <h2>Custom Duration & Easing</h2>
      <p>自定义动画时长 2s 和缓动函数</p>
    </section>
  </div>
  <script src="../acceptance/assets/kit/kit.js"></script>
</body>
</html>
```

### 9. 编写作者文档

**`learning-course/kit/content/animation/README.md`**

```markdown
# Animation Component

为内容块添加滚动触发或立即播放的动画效果。

## 使用方式

### 基础用法

\`\`\`html
<section data-animate="fadeIn">
  <h2>内容会在滚动到视口时淡入</h2>
</section>
\`\`\`

### 预设动画

- `fadeIn` - 淡入
- `slideUp` - 向上滑入
- `bounce` - 弹跳

### 自定义参数

\`\`\`html
<div data-animate="slideUp"
     data-animate-duration="1s"
     data-animate-delay="0.3s"
     data-animate-easing="cubic-bezier(0.68, -0.55, 0.27, 1.55)">
  自定义动画配置
</div>
\`\`\`

### 立即播放

\`\`\`html
<div data-animate="fadeIn" data-animate-trigger="immediate">
  页面加载立即播放，不等滚动
</div>
\`\`\`

## 事件

\`\`\`javascript
kit.on("kit:animation:complete", function(e) {
  console.log("动画完成:", e.element.id);
});
\`\`\`

## 无障碍

自动尊重用户的 `prefers-reduced-motion` 设置，禁用所有动画。

## 浏览器兼容

- IntersectionObserver: Chrome 51+, Firefox 55+, Safari 12.1+
- 降级策略: 不支持时立即播放所有动画
\`\`\`

## 10. 更新技能文档

在 `learning-course/references/lesson.md` 添加章节：

```markdown
### 动画组件 (L2)

为内容添加滚动触发或立即播放的动画效果。

**基础用法：**
\`\`\`html
<section data-animate="fadeIn">
  <h2>滚动到视口时淡入</h2>
</section>
\`\`\`

**预设动画：** `fadeIn`, `slideUp`, `bounce`

**自定义参数：**
- `data-animate-duration` - 持续时间（默认 0.6s）
- `data-animate-delay` - 延迟时间（默认 0s）
- `data-animate-easing` - 缓动函数
- `data-animate-trigger="immediate"` - 立即播放

参考完整文档：[kit/content/animation/README.md](../../kit/content/animation/README.md)
```

## 高级主题

### 依赖其他模块

如果动画需要依赖 block chrome：

```json
{
  "id": "content.animation",
  "requires": ["core", "foundation", "content._block"]
}
```

访问依赖模块的 API：
```javascript
var block = kit.block.create({ kind: "animation", label: "演示" });
animateElement(block.body);
```

### 访问学习记录 Store

```javascript
var store = kit.store;

// 读取状态
var state = store.getState();
var lessonId = state.lesson.id;

// 派发事件
store.dispatch({
  type: "ANIMATION_VIEWED",
  elementId: el.id,
  timestamp: Date.now()
});

// 订阅变化
store.subscribe(function() {
  var newState = store.getState();
  // 响应状态变化
});
```

### 使用配置系统

在 `assets/course/config.json` 添加配置：
```json
{
  "animation": {
    "defaultDuration": "0.8s",
    "observerThreshold": 0.2,
    "disableOnMobile": true
  }
}
```

读取配置：
```javascript
var config = kit.config && kit.config.animation;
var duration = (config && config.defaultDuration) || "0.6s";
```

### 响应式设计

使用 CSS 容器查询：
```css
@layer content {
  @container (max-width: 767px) {
    [data-animate] {
      /* 移动端禁用复杂动画 */
      --anim-duration: 0.3s;
    }
  }
}
```

使用 JavaScript 媒体查询：
```javascript
var isMobile = window.matchMedia("(max-width: 767px)").matches;
if (isMobile && config.disableOnMobile) {
  // 跳过动画
  el.classList.add("is-animated");
  return;
}
```

### 性能优化

1. **使用 `will-change` 提示浏览器：**
   ```css
   [data-animate]:not(.is-animated) {
     will-change: opacity, transform;
   }
   ```

2. **动画完成后清理：**
   ```javascript
   el.addEventListener("animationend", function() {
     el.style.willChange = "auto";
   });
   ```

3. **节流 IntersectionObserver：**
   ```javascript
   var observer = new IntersectionObserver(observeCallback, {
     rootMargin: "0px 0px -10% 0px", // 提前 10% 触发
     threshold: 0.1
   });
   ```

### 测试

在 `learning-course/tests/test_animation.py` 添加测试：

```python
def test_animation_detection():
    """测试动画模块自动检测"""
    html = '<section data-animate="fadeIn">Content</section>'
    manifest = load_manifest()
    modules = detect_modules_for_html(html, manifest)
    assert "content.animation" in modules

def test_animation_config_parsing():
    """测试配置解析"""
    # 使用 Playwright 或 Selenium 测试 JS 逻辑
    page.set_content("""
        <div id="test" data-animate="slideUp" 
             data-animate-duration="1s"></div>
        <script src="kit.js"></script>
    """)
    duration = page.evaluate("document.getElementById('test').style.getPropertyValue('--anim-duration')")
    assert duration == "1s"
```

## 常见问题

**Q: 如何调试模块未加载？**

A: 检查以下步骤：
1. `python kit/build/kit.py build` 是否成功
2. `kit.manifest.json` 是否包含新模块
3. `detect.selectors` 是否匹配课件中的元素
4. 浏览器控制台是否有错误

**Q: CSS 样式优先级冲突怎么办？**

A: 确保使用了正确的 @layer，层级顺序为：
```
reset < tokens < base < content < shell < learning < viz < theme < course
```

**Q: 如何让模块在所有课程中都可用？**

A: 设置 `"presence": "core"`，但需评估必要性，避免膨胀基础包体积。

**Q: 可以使用第三方库吗？**

A: 可以。有两种方式：
1. 放入 `kit/vendor/` 并更新 `vendor/manifest.json`
2. 使用 CDN，在 module.json 的 `cdn` 字段声明

示例（使用 GSAP）：
```json
{
  "id": "content.animation-advanced",
  "cdn": [
    {
      "url": "https://cdn.jsdelivr.net/npm/gsap@3.12.0/dist/gsap.min.js",
      "integrity": "sha384-...",
      "global": "gsap"
    }
  ]
}
```

## 发布清单

发布扩展组件前确保：

- [ ] 通过 `kit.py build` 无错误
- [ ] 在 acceptance 或 gallery 中有演示
- [ ] 编写了 README.md 作者文档
- [ ] 更新了 `references/lesson.md`
- [ ] 添加了单元测试
- [ ] 在 Chrome/Firefox/Safari 中测试通过
- [ ] 检查了无障碍（键盘导航、屏幕阅读器、prefers-reduced-motion）
- [ ] 在 CHANGELOG.md 中记录

## 模板仓库

完整的模块模板参考：
- `learning-course/kit/content/callout/` - 简单内容组件
- `learning-course/kit/learning/question/` - 复杂交互组件
- `learning-course/kit/viz/kinds/chart/` - 数据可视化组件

---

**维护者：** Kit 架构组  
**最后更新：** 2026-10-11  
**适用版本：** Course Kit v2.0+
