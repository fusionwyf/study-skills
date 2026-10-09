# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- **LearnKit capability manifest.** `assets/learnkit/components.json` is rebuilt as a truthful registry (runtime / views / kinds / static HTML / optional / planned) instead of an 81-name wishlist, so agents no longer reference components the runtime does not render. The new `optional` section is the single authority for on-demand components.
- **ai-study skill.** Adds a reusable AI-assisted learning loop centered on independent attempts, graduated tutoring, source checks, and unaided transfer evidence; includes long-term review and optional Obsidian workflows. The `$study` router and skill index now point to it.
- **Evidence independence.** Shared records distinguish `independent`, `with_hints`, and `ai_guided` performance from task provenance and evidence strength. New mastery updates and completion enforce the shared independence policy; legacy missing values remain unknown and historical state emits warnings without rewriting records.
- **Open learning interactions.** The course template adds learner-teaches-AI correction tasks and fixed sequential dialogue practice. Copied records include every prompt, raw response, submitted/displayed state, self-reported help, and observed guidance; component validation checks answer labels and complete round structures.
- **Independent-verification reminders.** Course updates and course/exam reports flag three consecutive finalized AI-guided attempts by attempt chronology, with citations and an independent follow-up rather than a claim of cognitive decline.
- **Optional, on-demand course components.** `install_optional.py` replaces `install_visualizations.py` and installs only what a course asks for, into `assets/optional/<name>/` or `assets/visualizations/`. The default package now carries no third-party library at all: a plain course stays small and offline, and a failed install refuses before copying anything rather than half-writing.
  - `code-highlight` — syntax colouring via the pinned CDN highlight.js 11.12.0 build (126 KB, 36 built-in languages). Wiring is a stylesheet plus a `highlightAll()` scan of `.code-block pre code`; the language comes from the existing `.code-language` label or a `language-*` class, with common aliases (`py`, `js`, `sh`, `c++`, `cs`, `yml`, …) normalised. A language outside the build degrades to uncoloured plain text instead of issuing a doomed request. Colours are `--code-token-*` variables, so a course can follow its own palette or drop in one of highlight.js's 516 themes. A course that self-hosts the engine under `vendor/` skips the network entirely.
  - `theme` — the full `--course-*` token layer plus an optional switcher. `course.css` keeps a neutral baseline; every visual decision becomes overridable, so a course can rebrand **without touching a component class name or `data-*` marker**. The component deliberately ships **no colour scheme**: a theme is the course's own CSS. `data-theme-surface` declares the light/dark lean so the code block can pick readable tokens, and a declaration in markup is never overwritten. Switcher resolves `data-theme` → `localStorage` → system preference, and is not rendered at all when fewer than two themes are registered.
- **Behavioural tests for the optional components.** `tests/optional_components.cjs` runs both components against a real DOM (jsdom) and pins the contracts a course relies on: token spans emitted, source text byte-identical after highlighting, aliases resolved, unknown languages degrading to `plaintext`, re-highlight idempotent, theme applied and persisted, `auto` resolved against the system setting, an invalid theme name not throwing, and a course with neither component installed left untouched. Wired into `test_visualizations.py`, which skips rather than fails when jsdom or the cached engine is absent.

### Fixed

- **Dead assertions in the visualization suites.** Several checks in `tests/visualization_invariants.cjs` and `tests/test_visualizations.py` only passed by accident: they called `validateConfig("plot"/"geometry", …)`, which threw "unknown kind" once aliases were removed. Rewritten against the canonical names, they now exercise real behavior and exposed two genuine gaps: `validateSpatial` accepted finite inputs whose matrix product overflows to `Infinity` (now rejected), and the showcase was missing a `spatial` container, so the fallback/label/unique-id tests were operating on absent markup (container added).
- **Evidence-store regression test.** `tests/evidence_store.cjs` pins the new runtime's invariants (single store, shared paint, hint and `observedAssistance` tracking, verdict storage, empty-submit exclusion) with a minimal DOM shim.
- **Optional components no longer depend on load timing.** Both components originally keyed off `document.readyState`, so a script injected after parsing on a host where `DOMContentLoaded` never fires would silently do nothing. They now start as soon as a body exists and keep the parsing listener only as a fallback, guarded by an idempotency flag.
- **A declared theme surface is preserved.** `theme.js` previously overwrote `data-theme-surface` whenever the active theme was not in the registered list, which broke the documented CSS-only route (hand-written `[data-theme]` rules with no `COURSE_THEMES`). An explicit markup declaration now wins unless the matched theme states its own surface.

### Changed

- **Math rendering unified on KaTeX auto-render.** Every real course writes formulas as `\(...\)` / `\[...\]` and renders them with KaTeX's auto-render plugin loaded from CDN; the previous `data-tex` span contract had zero adoption. The `LearnKit.registerRenderer` math renderer (`assets/learnkit/renderers/math.js`), the `data-tex` / `data-math-rendered` / `__COURSE_MATH_READY__` protocol, and the local `vendor/katex/` layout are removed. `init_course.py` no longer copies a renderer, `course-template/lesson.html` ships the CDN + auto-render snippet, and `render.md` / `lesson.md` / `export.md` / `components.json` describe one scheme instead of two. exam-prep's `drill-template/math.js` is deleted too: the drill template now loads the same CDN plugin and lets LaTeX delimiters render in place. Both skills keep a documented offline path (vendor the same KaTeX build and swap the URLs).
- **Course runtime collapsed to one evidence store.** `assets/course-template/course.js` no longer runs a second DOM track beside LearnKit. Nine `init*` functions that each queried the page and wrote shared `dataset` flags become one `LearnKit.createStore` evidence model plus eight registered views (`quiz` / `independence` / `hint` / `teaching-target` / `dialogue` / `step` / `copy-code` / `auto-toc`); a single subscription repaints every view, so no component reaches into another's DOM. The learning-record builder reads the store instead of re-scraping the page. `example-course` had shipped a stale hand-copied `course.js`; it is now the template file.
- **References consolidated 10 → 4.** Course-side docs merge by task: `state.md` (from `course-state.md`, absorbing assessment-mounting semantics), `lesson.md` (from `components.md` + `lesson-patterns.md` + `bloom-taxonomy.md`), `render.md` (from `learnkit.md` + `math-rendering.md` + `visualizations.md`), and `export.md` (from `pdf-export.md`). The standalone `assessment.md` forwarder shell is deleted; its two outbound pointers live in `state.md`. Shared-layer references are unchanged.
- **Docs realigned with implementation.** `SKILL.md` documents the required `init_course.py` arguments (`--course-dir` / `--title` / `--goal`); `lesson.md` states the `[data-steps-scope]` rule that keeps `data-step-next` bound to its `.step` list; `render.md` attributes `registerModel` to the L1 runtime, `registerKind` to the L3 adapter layer, and `registerRenderer` to an optional extension hook with no built-in implementation.
- **exam-prep references consolidated 5 → 4 and de-duplicated.** `question-handling.md` no longer restates the registration commands that already live in SKILL.md, and SKILL.md's Readiness section drops the update-constraint sentences that `review-and-cram.md` already carries verbatim. The separate `math-rendering.md` is gone; its formula guidance now lives in `question-handling.md` under the unified KaTeX scheme.
- **Dangling references repaired.** `shared/references/material-intake.md` pointed at the deleted `learning-course/references/components.md` (now `lesson.md`); `diagnostic-protocol.md` pointed at the deleted course-side `assessment` doc (now `state.md`). README's learning-course script list now includes `install_visualizations.py` and `build_visualization_data.py`.
- **Compatibility layers removed.** The `assets/math.js` shim, the `plot`/`geometry`/`algorithm` aliases, and the legacy `LEGACY_KINDS`/`CLI_CHOICES` path are gone. Every visualization kind uses one canonical name (`chart`/`spatial`/`sequence`/…) across `manifest.json`, `adapters.json`, `visualizations.js`, `validate_course.py`, and `install_visualizations.py`. The vendor manifest is renamed to standard kind keys, which also fixes the real root cause of the earlier silent `sequence` drop.
- **Visualization install reports vendor-free kinds.** `install_visualizations.py` lists kinds whose adapters render with HTML/SVG only (e.g. `sequence`) instead of silently dropping them when no vendor entry exists; unknown or legacy names are now rejected by `--components` choices.
- **Lesson template placeholder warning.** `SKILL.md` and `references/lesson.md` now state that copying `lesson.html` requires replacing the hardcoded `example-course` / `example-objective` values and aligning them with a `course.yaml` objective, which validator enforces as `lesson references unknown objective`.
- **Four learning experiences plus the study router.** Source intake and bounded handoffs are internal package operations; their former skill entrypoints and UI metadata are removed. Remaining entrypoints retain explicit-only invocation.
- **Shared source intake.** `register_source.py`, `validate_sources.py`, and `material-intake.md` move from `source-grounded-study/` to `shared/`. Course and exam workflows register sources directly; exam materials are re-synced after intake.
- **Progress queries in study.** `build_report.py` moves from `study-report/scripts/` to `study/scripts/`; the reporting protocol becomes `study/references/progress-report.md`. The router directly generates and interprets reports while preserving learning state.
- **Internal handoffs.** The handoff protocol becomes `shared/references/learning-handoff.md`, and its three scripts move to `shared/scripts/`. Exam review and course continuation handle bounded remediation and evidence return internally; cross-package learning still uses explicitly activated experience skills.
- Infrastructure relocation preserves existing package layouts and source/handoff helper behavior. Direct callers must update the removed script paths; regression tests use the new locations.
- Progress reports confirm course ability only with strong independent evidence, and exam metrics only with source-backed independent records. Assisted or unknown-independence records are labeled inferred. Hinted or AI-guided review success does not lengthen intervals.
- AI tutor prompts now state checkable teaching order, attempt-first assistance, and difficulty/redundancy adjustments; the role table includes AI as a simulated student. Material intake documents source-traceable transformations, and learning guidance cites verified retrieval/spacing study identifiers with the 2006 meta-analysis distinguished from the 2008 experiment.

## [0.2.2] - 2026-08-25

Recovery and evidence-contract hardening: atomic registry/report writes, rollback coverage, and shared record-contract enforcement for handoffs.

### Fixed

- **Registry atomic replace (P1).** `register_source.py` writes `SOURCES.md` through a same-directory temp file + `os.replace()`; a mid-write disk error can no longer truncate an existing registry, and the rollback path leaves the old registry byte-for-byte intact.
- **Review record write atomicity (P1).** `complete_review.py` writes the `RV####` record atomically too; a failed record write leaves no partial file that would block the next attempt, and the state replace still rolls the record back on failure.
- **Course feedback rollback (P2).** `update_progress.py` rolls back the newly written pending record when the atomic `course.yaml` replace fails, so the package never keeps an orphan record without a `last_feedback` association.
- **Handoff atomic update (P2).** `complete_handoff.py` updates the handoff via temp file + `os.replace()`, so a disk error cannot corrupt a previously valid `open` handoff.
- **Shared record contract for handoffs (P2).** `create_handoff.py`, `complete_handoff.py` and `validate_handoffs.py` now validate source/returned records through the shared `validate_record.py` (schema, type detection, required fields, finalized constraints) instead of only checking `assessment_status`; `validate_record.py` exposes `contract_errors()` for reuse.
- **Workspace-relative to.package (P2).** `create_handoff.py` stores `to.package` relative to the source package when both share a drive (absolute as a cross-drive fallback); `complete_handoff.py` / `validate_handoffs.py` resolve relative paths against the current directory first, then the source package, and the SKILL.md documents the semantics.
- **Shell-pipe examples (P2).** `spaced-review` SKILL.md and `complete_review.py` docstring split the mutually exclusive `--objective-id` / `--topic` into two separate command examples so `|` is never copied into a shell as a pipe.
- 6 regression tests added (59 → 65).

## [0.2.1] - 2026-08-25

Review fixes: explicit-invocation policy completed, shared-path corrections, and transactional state writes.

### Fixed

- **Explicit-only invocation completed (P1).** `spaced-review`, `source-grounded-study`, `study-report` and `learning-handoff` now ship `agents/openai.yaml` with `policy.allow_implicit_invocation: false`, matching their `disable-model-invocation: true` frontmatter so the runtime never auto-injects them.
- **Shared-reference paths (P1).** SKILL.md files referenced `../../shared/...`, which resolves outside the repository from a leaf skill directory; corrected to `../shared/...`. Command examples in the four leaf skills now use `python scripts/...` (skill-directory cwd) consistently with `learning-course`/`exam-prep`; cross-skill validation commands are explicitly marked as running from the repository root.
- **Review frontmatter serialization (P1).** `complete_review.py` no longer interpolates user text into YAML via f-strings; it builds the frontmatter mapping and serializes with `yaml.safe_dump`, so `--next-action` values containing `:`, `#` or newlines can no longer produce unparsable records.
- **Review record/state atomicity (P1).** `complete_review.py` stages the new state text first, then writes the record, then atomically replaces the state file; if the state replace fails, the new record is rolled back (with a recovery marker when rollback itself fails), preserving "no interval change without a finalized record".
- **Source registry pipe escaping (P2).** `register_source.py` now splits table rows on unescaped pipes only and unescapes `\|`, so titles or coverage containing `|` survive a write → read round trip instead of being misread by later validation.
- **Source registration rollback (P2).** `register_source.py` tracks every path it creates and rolls back partial registrations on mid-write failure, so retries are not blocked by orphaned detail folders.
- **Report output confinement (P2).** `build_report.py --out` is restricted to relative paths inside the package's `exports/` directory (`--out REPORT.md` → `exports/REPORT.md`); absolute paths, `..` escapes and existing state files can no longer be overwritten, preserving the read-only contract.
- **Handoff date validation (P2).** `validate_handoffs.py` accepts unquoted YAML dates (parsed as `datetime.date`) for `created_at`/`returned_at` in addition to quoted strings.
- **Handoff schema and returned-record checks (P2).** `handoff.schema.yaml` now requires `to.package`; `validate_handoffs.py` verifies that a returned/closed handoff's `returned_record` stays inside `to.package`, exists, and is a finalized record.
- **Bundled skill validator (P2).** added `shared/scripts/quick_validate.py`, which understands `disable-model-invocation` and checks `agents/openai.yaml` consistency; SKILL.md validation commands now point at it instead of the external `<skill-creator>` path.
- CHANGELOG test count corrected from 39 to the actual 48; 11 regression tests added for the fixed failure windows (48 → 59).

## [0.2.0] - 2026-08-24

Learning OS buildout: shared protocols, manual invocation model, and four new leaf skills.

### Added

- **shared/** infrastructure: unified record/source/review/handoff schemas (`shared/schemas/`), the human-readable record contract, source-provenance / transfer-rubric / diagnostic-protocol references, the generic `validate_record.py`, and the `spaced_repetition.py` interval algorithm extracted from learning-course.
- **spaced-review** skill: due-session executor over course or exam packages; five review task types (retrieval / explanation / variation / transfer / error discrimination); every interval change traces to a finalized review record.
- **source-grounded-study** skill: material registration with reliability tiers, verbatim excerpts, claim tracking (sourced / unverified / contested), synthetic marking, downstream traceability for questions and lessons.
- **study-report** skill: strictly read-only progress reports; every finding labeled confirmed / inferred / unknown / self-reported; activity shown separately from evidence.
- **learning-handoff** skill: bounded mini-course handoffs between exam and course packages via artifact files only, with verifiable return conditions.
- **study** router skill: intent-to-skill mapping; recommends only, never executes.
- Regression tests for every new capability (48 tests).

### Changed

- All leaf skills are user-invoked (`disable-model-invocation: true`); cross-skill routing moved out of descriptions into `$study` and skill bodies.
- Course records gain `record_id` / `attempted_at` / `source_backed` / `synthetic` under the unified record contract; legacy records stay valid (warnings only, no auto-migration).
- Validators load enum vocabularies from `shared/schemas/` instead of hardcoding them.
- exam-prep accepts an optional topic-keyed `review_queue`; example fixtures conformed to the source registry contract (`S001`).

## [0.1.0] - 2026-08-09

Initial release: `learning-course` and `exam-prep` skills with evidence-linked state machines, HTML lesson/drill templates, package validators, and example fixtures.
