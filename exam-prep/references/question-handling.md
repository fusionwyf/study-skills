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

The drill template loads KaTeX and its auto-render plugin from CDN and scans the page on load, so prompts and rubrics can carry LaTeX directly: \(...\) for inline math, \[...\] for display math.

~~~text
The conditional probability is \(P(A \mid B) = P(A \cap B) / P(B)\).

\[
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
~~~
~~~

No per-formula markup is needed. If KaTeX cannot load (offline, blocked CDN), the LaTeX source stays readable on the page and the rest of the drill is unaffected — so every formula should also have a nearby plain-language explanation of what it means. To keep a drill fully offline, vendor the same KaTeX build into the drill folder and swap the three CDN URLs for local relative paths; the formula authoring stays the same.

For exact control (custom HTML, tables, or a formula before other markup) use `prompt_html` or `answer_or_rubric_html`, which the template inserts verbatim and then scans for math like any other content.

Use chat or Markdown records for:

- essay,
- calculation,
- proof,
- code,
- design,
- any question where process and rubric matter more than exact text matching.

For big questions, ask the user to paste their answer, then review with the rubric-first flow from SKILL.md.
