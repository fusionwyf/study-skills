# Math Rendering

Use this only when an HTML drill contains formulas.

## Assets

The drill template includes assets/drill-template/math.js. It makes no network requests and renders only when local KaTeX is available:

~~~text
assets/drill-template/
├── index.html
├── math.js
└── vendor/katex/
    ├── katex.min.css
    ├── katex.min.js
    └── fonts/
~~~

If vendor/katex/ is absent, keep the page usable with readable formula text. Do not add CDN links.

## Authoring

Plain text prompts can use \(...\), \[...\], or $$...$$. The template converts them into data-tex spans before calling math.js.

For exact control, use prompt_html or answer_or_rubric_html:

~~~html
<span class="math-expression" data-display-mode="inline" data-tex="P(A\mid B)">P(A given B)</span>
<span class="math-expression math-block" data-tex="x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}">quadratic formula</span>
~~~

Every formula needs readable fallback text or nearby explanation.
