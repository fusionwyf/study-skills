# Changelog

All notable changes to this project are documented in this file.

## [0.2.0] - 2026-08-24

Learning OS buildout: shared protocols, manual invocation model, and four new leaf skills.

### Added

- **shared/** infrastructure: unified record/source/review/handoff schemas (`shared/schemas/`), the human-readable record contract, source-provenance / transfer-rubric / diagnostic-protocol references, the generic `validate_record.py`, and the `spaced_repetition.py` interval algorithm extracted from learning-course.
- **spaced-review** skill: due-session executor over course or exam packages; five review task types (retrieval / explanation / variation / transfer / error discrimination); every interval change traces to a finalized review record.
- **source-grounded-study** skill: material registration with reliability tiers, verbatim excerpts, claim tracking (sourced / unverified / contested), synthetic marking, downstream traceability for questions and lessons.
- **study-report** skill: strictly read-only progress reports; every finding labeled confirmed / inferred / unknown / self-reported; activity shown separately from evidence.
- **learning-handoff** skill: bounded mini-course handoffs between exam and course packages via artifact files only, with verifiable return conditions.
- **study** router skill: intent-to-skill mapping; recommends only, never executes.
- Regression tests for every new capability (39 tests).

### Changed

- All leaf skills are user-invoked (`disable-model-invocation: true`); cross-skill routing moved out of descriptions into `$study` and skill bodies.
- Course records gain `record_id` / `attempted_at` / `source_backed` / `synthetic` under the unified record contract; legacy records stay valid (warnings only, no auto-migration).
- Validators load enum vocabularies from `shared/schemas/` instead of hardcoding them.
- exam-prep accepts an optional topic-keyed `review_queue`; example fixtures conformed to the source registry contract (`S001`).

## [0.1.0] - 2026-08-09

Initial release: `learning-course` and `exam-prep` skills with evidence-linked state machines, HTML lesson/drill templates, package validators, and example fixtures.
