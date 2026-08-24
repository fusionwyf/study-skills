# WorkBuddy Study Skills

WorkBuddy skills for structured learning, exam preparation, and spaced review.

## Skills

### learning-course

Design and run structured study courses with a full learning loop: diagnose → design → teach → assess → review. Features:

- Schema v3 state management (`course.yaml`) with finalized-record mastery tracking
- Bloom-aligned cognitive levels and checkpoint system
- Spaced review queue with performance-adjusted intervals
- Interactive HTML lesson template with KaTeX math rendering, dark mode, keyboard nav
- Python scripts: `init_course.py`, `validate_course.py`, `update_progress.py`, `build_index.py`, `export_pdf.py`

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
- Python scripts: `build_review_session.py`, `complete_review.py`, plus the shared `spaced_repetition.py` interval algorithm

### source-grounded-study

Register study materials and keep every extracted fact traceable to its source. Features:

- Material registration with reliability tiers (official > course > user > synthetic; unknown when unsure)
- Verbatim excerpts with location tracking plus claim tracking (sourced / unverified / contested)
- Synthetic marking: Agent-generated content never poses as source fact (`synthetic-from-*`)
- Downstream traceability: exam questions and course lessons reference the `S###` they came from
- Works on exam packages (root `SOURCES.md` + `source-materials/`) and course or standalone workspaces (`sources/SOURCES.md` + `sources/<source_id>/`) under the same field contract
- Python scripts: `register_source.py`, `validate_sources.py`, backed by the shared `source.schema.yaml`

### study-report

Read-only progress reports over an existing course or exam package. Features:

- Strictly read-only: derives everything from state files, record frontmatter, lessons, question bank, and error log — never modifies the package
- Four-way labeling of every finding: confirmed (strong finalized evidence) / inferred / unknown / self-reported
- Evidence coverage vs activity: objectives-with-records or source-backed readiness next to raw activity counts
- Due-review surfacing and deterministic, citation-backed next-step suggestions
- Python scripts: `build_report.py`

### learning-handoff

Bounded mini-course handoffs between exam and course packages. Features:

- Turn a finalized exam-gap record into a bounded mini-course handoff (`H####`) with explicit include/exclude boundary
- Artifact coupling only: the handoff file is the sole link — packages never mutate each other's state
- Verifiable return conditions; completion requires a finalized record inside the target package
- Traceable gap origin: every handoff cites its source record and validates against the shared contract
- Python scripts: `create_handoff.py`, `complete_handoff.py`, `validate_handoffs.py`, backed by the shared `handoff.schema.yaml`

All leaf skills share the same infrastructure: unified record schemas in `shared/schemas/`, the human-readable record contract in `shared/references/record-contract.md`, and the generic validator `shared/scripts/validate_record.py` used by every skill's package validator.

## Requirements

- Python 3.10+ with PyYAML (for state updates and strict-schema validation)
- WorkBuddy or any compatible AI agent runtime

## Usage

Clone or copy the whole `study-skills` folder into your WorkBuddy skills folder — leaf skills read shared protocols from `shared/`, so single-skill copies are not self-contained.

Activate a skill explicitly by name:

- `$study` — not sure which one? The router recommends the right skill for your goal.
- `$learning-course` — durable mastery courses.
- `$exam-prep` — exam outcome preparation.
- `$spaced-review` — due review sessions over course or exam packages.
- `$source-grounded-study` — register materials, excerpt verbatim, and keep facts traceable to sources.
- `$study-report` — a read-only progress report: what is confirmed, what is shaky, what to do next.
- `$learning-handoff` — turn an exam gap into a bounded mini-course, then return with verifiable evidence.

## Validation

```text
python -m unittest discover -s tests -v
python learning-course/scripts/validate_course.py learning-course/assets/example-course --strict-schema --pedagogical
python exam-prep/scripts/validate_exam.py exam-prep/assets/example-exam --strict-schema
python source-grounded-study/scripts/validate_sources.py exam-prep/assets/example-exam
python shared/scripts/validate_record.py exam-prep/assets/example-exam/records/R0001.md
```

## License

MIT
