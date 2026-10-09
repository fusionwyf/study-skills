# Question Handling

Use this reference when importing materials, extracting questions, generating variants, or choosing a delivery format.

## Source priority

Use this order when multiple sources conflict:

~~~text
official exam specification
past papers / official samples / official question bank
teacher scope / assignments / emphasized topics
user notes
Agent-generated variants
~~~

Mark uncertain source claims in SOURCES.md; do not silently treat weak notes as official scope.

General reliability hierarchy and conflict rules: see `../../shared/references/source-provenance.md`.

## Source registration

Field types and reliability values follow `../../shared/references/source-provenance.md` and `../../shared/schemas/source.schema.yaml`; the registration commands live in SKILL.md.

When files are large, extract only the sections needed for the current task and keep the original in source-materials/. Re-sync material counts after any registration or question-bank change (`update_exam.py --sync-materials`).

## Extraction rules

- Split full papers into individual question objects.
- Preserve original wording where possible.
- Keep answer keys, rubrics, and worked solutions separate from prompts.
- Mark incomplete extraction as status: draft.
- Add topic: unclassified rather than guessing too aggressively.
- Estimate time only when the source or exam format supports it.

Use scripts/build_question_bank.py for a first-pass JSONL draft from Markdown or text, then review and enrich the result.

## Synthetic variants

Generate variants only when:

- source-backed questions for a topic are exhausted,
- a user needs more practice on a confirmed weak point,
- a mock or review indicates a recurring pattern,
- the user explicitly requests extra practice.

Every generated variant must include:

~~~json
{
  "synthetic": true,
  "source": "synthetic-from-Q0001",
  "status": "ready"
}
~~~

Tell the user when a question is a generated variant rather than source material.

General synthetic-marking rules: see `../../shared/references/source-provenance.md`.

## Delivery by question type

Use HTML drill templates for:

- choice,
- fill,
- short answer,
- timed recall,
- checklist-style cram review.

### Formulas in drills

`assets/drill-template/math.js` is an optional local KaTeX bridge: it makes no network request and renders only when `vendor/katex/` is present.

~~~text
assets/drill-template/
├── index.html
├── math.js
└── vendor/katex/          # optional; drop KaTeX here to enable rendering
    ├── katex.min.css
    ├── katex.min.js
    └── fonts/
~~~

If `vendor/katex/` is absent, keep the page readable with plain formula text; do not add CDN links. Plain prompts may use \(...\), \[...\], or $$...$$, which the template converts into `data-tex` spans before calling `math.js`. For exact control use `prompt_html` or `answer_or_rubric_html`:

~~~html
<span class="math-expression" data-display-mode="inline" data-tex="P(A\mid B)">P(A given B)</span>
<span class="math-expression math-block" data-tex="x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}">quadratic formula</span>
~~~

Every formula needs readable fallback text or a nearby explanation.

Use chat or Markdown records for:

- essay,
- calculation,
- proof,
- code,
- design,
- any question where process and rubric matter more than exact text matching.

For big questions, ask the user to paste their answer, then review with the rubric-first flow from SKILL.md.
