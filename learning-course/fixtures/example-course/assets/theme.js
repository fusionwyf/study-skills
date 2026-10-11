/* Course-owned configuration. Add theme names and matching rules in theme.css.
 * Load before optional/theme/theme.js and rendering adapters. */
window.COURSE_THEMES = [
  { name: "course", label: "课程主题", surface: "light" },
  { name: "ink", label: "深色阅读", surface: "dark" },
];

// Official highlight.js stylesheet names or pinned absolute CDN/local URLs.
// Names use the pinned engine version's CDN, including GitHub defaults.
// Change palettes here instead of editing the shared picker.
window.COURSE_CODE_THEMES = { light: "github", dark: "github-dark" };

// KaTeX options merged with the page's delimiters and safe fallback settings.
window.COURSE_MATH_OPTIONS = { macros: {} };
