# WorkBuddy Study Skills

WorkBuddy skills for structured learning, exam preparation, and spaced review.

## Learning Experiences

### ai-study

Use AI for explanation, practice, feedback, and review while checking independent ability. Includes a repeatable learning loop, reusable tutor/reviewer/coach prompts, subject-specific workflows, and a lightweight long-term Obsidian setup.

### learning-course

Design and run structured study courses with a full learning loop: diagnose → design → teach → assess → review. Features:

- Schema v3 state management (`course.yaml`) with finalized-record mastery tracking
- Assistance-aware evidence: `transfer` requires independent performance; `application` permits independent or hinted performance; AI-guided work supports recognition only
- Optional Bloom cognitive levels as planning metadata (not a separate checkpoint state)
- Spaced review queue with performance-adjusted intervals
- Interactive HTML lesson template with optional KaTeX math rendering (drop KaTeX into `assets/vendor/katex/`; without it formulas fall back to readable text)
- Learner-teaches-AI corrections and sequential dialogue practice, with every prompt and raw answer included in copied learning records
- Optional offline math/CS visualization kit: Plotly numeric curves, heatmaps and 3D surfaces; JSXGraph draggable 2D linear transformations with equal units; computed selection-sort playback with code and operation counts. Includes numeric/step print fallbacks and current-state capture in learning records
- Lesson, render and export guides: `learning-course/references/` (four documents: `state`, `lesson`, `render`, `export`); runnable showcase: `learning-course/assets/visualizations/demo.html`; selectively install with `install_visualizations.py` (no third-party libraries copied for HTML/SVG-only kinds)
- Python scripts: `init_course.py`, `validate_course.py`, `update_progress.py`, `build_index.py`, `export_pdf.py`, `install_visualizations.py`, `build_visualization_data.py`

### exam-prep

Targeted exam preparation from diagnosis to cram day. Features:

- 7-phase workflow: diagnose → plan → drill → review → mock → cram → postmortem
- Schema v2 state with record-linked readiness and package-derived material counts
- Question bank builder with auto type detection (choice / fill / proof / calculation / code / essay / short)
- Readiness scoring (accuracy, speed, coverage, stability, confidence)
- Error log with structured mistake analysis
- Interactive drill template with timer, keyboard nav, dark mode, KaTeX support
- Python scripts: `init_exam.py`, `validate_exam.py`, `update_exam.py`, `build_question_bank.py`

### spaced-review

Run due spaced-repetition review sessions against an existing course or exam package. Features:

- Due-session execution: collects due `review_queue` entries from `course.yaml` or `exam.yaml` and plans one time-boxed session
- Five review task types: retrieval, explanation, variation, transfer, and error discrimination (first review retrieves; poor performance triggers error discrimination)
- Record-linked interval updates: every interval change traces to a finalized review record (`records/RV####-*.md`) under the shared record contract
- Observed independence is recorded separately from task provenance; hinted or AI-guided success does not extend the review interval
- Python scripts: `build_review_session.py`, `complete_review.py`, plus the shared `spaced_repetition.py` interval algorithm

## Study Router and Progress Reports

`$study` recommends one of the four learning experiences. Progress queries run `study/scripts/build_report.py` directly, then explain the findings:

- Reads existing state, record frontmatter, lessons, question bank, and error log; preserves learning state
- Four-way labeling of every finding: confirmed (independence-qualified finalized evidence) / inferred / unknown / self-reported
- Assisted and unknown-independence records stay visible without confirming independent ability; three consecutive AI-guided attempts prompt an independent check
- Evidence coverage vs activity: objectives-with-records or source-backed readiness next to raw activity counts
- Due-review surfacing and deterministic, citation-backed next-step suggestions
- Prints reports by default; writes only under the package's `exports/` when saving is requested
- Protocol: `study/references/progress-report.md`

## Shared Infrastructure

Course and exam workflows call these services internally:

- **Source registration:** `shared/references/material-intake.md` and `shared/scripts/register_source.py`, `validate_sources.py`. Reliability tiers, verbatim excerpts, sourced/unverified/contested claims, and synthetic marking keep questions and lessons traceable to `S###`. Exam packages keep root `SOURCES.md` + `source-materials/`; course and standalone workspaces use `sources/SOURCES.md` + `sources/<source_id>/`.
- **Material transformation:** the intake protocol covers extracted vs generated exercises, paper argument maps, retrieval cards, variants, and oral-exam prompts, using each package's existing output layout and preserving source/synthetic markers.
- **Bounded handoffs:** `shared/references/learning-handoff.md` and `shared/scripts/create_handoff.py`, `complete_handoff.py`, `validate_handoffs.py`. Exam review or course continuation can turn a finalized gap record into a mini-course with include/exclude boundaries and verifiable return conditions. The handoff artifact links the packages; each maintains its own state. Learners choose the proposed lesson without activating an infrastructure skill.

Package-based skills share the same infrastructure: unified record schemas in `shared/schemas/`, the human-readable record contract in `shared/references/record-contract.md`, and the generic validator `shared/scripts/validate_record.py` used by package validators.

## Requirements

- Python 3.10+ with PyYAML (for state updates and strict-schema validation)
- WorkBuddy or any compatible AI agent runtime

## Usage

Clone or copy the whole `study-skills` folder into your WorkBuddy skills folder — leaf skills read shared protocols from `shared/`, so single-skill copies are not self-contained.

Activate a skill explicitly by name:

- `$study` — recommend a learning experience or directly query an existing package's progress.
- `$ai-study` — build an AI-assisted learning loop and verify independent learning.
- `$learning-course` — durable mastery courses.
- `$exam-prep` — exam outcome preparation.
- `$spaced-review` — due review sessions over course or exam packages.

To add a PDF to an existing package, ask its `$learning-course` or `$exam-prep` workflow. Source intake and cross-package handoffs are internal operations. All five entrypoints remain explicit-only (`disable-model-invocation: true` and `allow_implicit_invocation: false`).

The former source, report, and handoff skills no longer have `SKILL.md` or UI metadata. For direct script integrations, use the new paths above. Course schema v3, exam schema v2, and record schema v1 are retained with an additive `independence` field (`independent`, `with_hints`, `ai_guided`). Missing independence remains unknown: historical state validates with warnings and records are never auto-migrated, but new application/transfer updates and course completion require qualifying evidence.

## Validation

```text
python -m unittest discover -s tests -v
python learning-course/scripts/validate_course.py learning-course/assets/example-course --strict-schema --pedagogical
python exam-prep/scripts/validate_exam.py exam-prep/assets/example-exam --strict-schema
python shared/scripts/validate_sources.py exam-prep/assets/example-exam
python shared/scripts/validate_handoffs.py exam-prep/assets/example-exam
python study/scripts/build_report.py learning-course/assets/example-course
python shared/scripts/validate_record.py exam-prep/assets/example-exam/records/R0001.md
```

## License

MIT
