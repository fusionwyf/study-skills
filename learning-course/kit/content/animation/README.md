# content.animation 动画组件

Course Kit v2 L2 内容扩展模块，提供滚动触发动效与预设动画。

## 特性

- **预设动画**：`fadeIn`、`slideUp`、`bounce`
- **声明式配置**：通过 `data-animate` 系列属性控制动画名称、时长、延迟和缓动
- **滚动进入视口触发**：基于 `IntersectionObserver` 自动懒触发
- **无障碍保障**：媒体查询 `@media (prefers-reduced-motion: reduce)` 自动停用动效
- **就绪与事件集成**：支持 `kit.ready` 协议与 `kit:animation:complete` 自定义事件

## 使用方法

### 基础淡入
```html
<div data-animate="fadeIn">
  <p>内容在进入视口时淡入。</p>
</div>
```

### 滑入与延迟
```html
<div data-animate="slideUp" data-animate-delay="0.2s" data-animate-duration="0.8s">
  <p>带有延迟的向上滑入动效。</p>
</div>
```

### 立即播放
```html
<div data-animate="bounce" data-animate-trigger="immediate">
  <p>页面加载后立即弹跳播放。</p>
</div>
```
