# WorkBuddy Study Skills

Two complementary WorkBuddy skills for structured learning and exam preparation.

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

## Requirements

- Python 3.10+ with PyYAML (for state updates and strict-schema validation)
- WorkBuddy or any compatible AI agent runtime

## Usage

Copy either skill directory into your WorkBuddy skills folder and activate via the Skill tool.

## Validation

```text
python -m unittest discover -s tests -v
python learning-course/scripts/validate_course.py learning-course/assets/example-course --strict-schema --pedagogical
python exam-prep/scripts/validate_exam.py exam-prep/assets/example-exam --strict-schema
```

## License

MIT
