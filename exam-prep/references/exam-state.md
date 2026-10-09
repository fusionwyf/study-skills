# Exam State

Use this reference when creating, continuing, recovering, or validating an exam-prep package.

## Package rules

- Keep every exam in its own directory.
- Do not reuse a learning-course package or write course state.
- Preserve user-provided files in source-materials/ when practical.
- Keep PLAN.md human-maintained; do not regenerate it wholesale if the user has edited it.
- Treat generated plans as provisional until source coverage and exam constraints are known.

## exam.yaml

Use schema version 2:

~~~yaml
schema_version: 2
title: "Exam name"
status: provisional
mode: diagnose
created_at: "YYYY-MM-DD"
updated_at: "YYYY-MM-DD"
exam_date: null
target_score: null
time_budget:
  total_hours: null
  sessions_per_week: null
materials:
  source_count: 0
  question_count: 0
  synthetic_count: 0
readiness:
  accuracy: 0
  speed: 0
  coverage: 0
  stability: 0
  confidence: low
readiness_evidence: []
notes:
  - "Add constraints, risks, and open questions here."
~~~

status values:

- provisional: started with incomplete materials or unverified scope.
- confirmed: registered sources and source-backed questions are sufficient to drive a plan.
- archived: exam is over or no longer active.

## Question object

Every extracted or generated question should be represented as an object before being used for scheduling:

~~~json
{
  "id": "Q0001",
  "source": "source-id-or-file",
  "type": "choice|fill|short|essay|calculation|proof|code|other",
  "topic": "unclassified",
  "difficulty": "unknown|easy|medium|hard",
  "estimated_time": null,
  "prompt": "...",
  "answer_or_rubric": "",
  "status": "draft|ready|attempted|reviewed|retired",
  "synthetic": false
}
~~~

Draft extraction is allowed, but draft questions should not drive high-confidence readiness.

## Record object

Save user attempts and review outcomes in records/ as Markdown or JSON. Keep raw user answers intact.

Use YAML frontmatter so readiness updates can verify the record:

~~~markdown
---
record_schema: 1
assessment_status: finalized
record_id: R0001
mode: drill
attempted_at: YYYY-MM-DD
metrics:
  - accuracy
source_backed: true
synthetic: false
independence: independent   # 仅在该次尝试无 AI 辅助时使用；否则记录实际帮助
---
# Attempt

## User Answer

Preserve the user's answer verbatim.

## Review

- score_estimate:
- agent_observed_issue:
- suggested_causes:
- user_confirmed_cause:
- next_action:
~~~

Field types, enums, and required rules for these frontmatter fields are defined once in the shared contract: see [../../shared/references/record-contract.md](../../shared/references/record-contract.md). This file only keeps exam-specific semantics:

- `mode` uses the exam workflow modes; readiness evidence accepts only the assessment modes diagnose, drill, review, and mock.
- `metrics` lists exactly which readiness dimensions this record actually measured; a readiness update may only change metrics the record lists.
- Do not convert suggested_causes into user_confirmed_cause without the user's confirmation.
- Keep raw user answers verbatim in the record body; agent judgments are appended, never substituted for them.

## State updates

Use `scripts/update_exam.py --sync-materials` to derive counts from `SOURCES.md` and `question-bank/*.jsonl`. Use `--readiness ... --evidence-record records/<record>` for evidence-backed readiness changes. The referenced finalized record must list every numeric metric being changed. Keep confidence low when evidence is sparse, source material is weak, or most questions are synthetic.

`readiness_evidence` stores only record paths, measured metrics, and source/synthetic flags. The record remains the content source of truth.

## Recovery

When `exam.yaml` is missing, unparseable, or not schema v2:

1. Preserve the original file and inspect `PLAN.md`, `SOURCES.md`, question banks, records, mocks, and error log.
2. Generate `exam.recovered.yaml` using schema v2; annotate uncertain values in `notes` as `confirmed`, `inferred`, or `unknown`.
3. Validate a temporary package copy in which `exam.recovered.yaml` is named `exam.yaml`; keep the original package untouched.
4. Replace `exam.yaml` only after the user confirms the recovered state.

Completion criterion: the recovered file validates, every readiness value has a recoverable evidence record or is reset conservatively, and the original state remains available.
