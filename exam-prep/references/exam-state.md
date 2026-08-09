# Exam State

Use this reference when creating, continuing, recovering, or validating an exam-prep package.

## Package rules

- Keep every exam in its own directory.
- Do not reuse a learning-course package or write course state.
- Preserve user-provided files in source-materials/ when practical.
- Keep PLAN.md human-maintained; do not regenerate it wholesale if the user has edited it.
- Treat generated plans as provisional until source coverage and exam constraints are known.

## exam.yaml

Use schema version 1:

~~~yaml
schema_version: 1
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
notes:
  - "Add constraints, risks, and open questions here."
~~~

status values:

- provisional: started with incomplete materials or unverified scope.
- confirmed: enough exam facts are known to drive a plan.
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

Recommended fields:

~~~yaml
record_id: "R0001"
question_id: "Q0001"
mode: drill
attempted_at: "YYYY-MM-DD"
time_spent_minutes: null
user_answer: |
  Preserve the user's answer verbatim.
score_estimate: null
agent_observed_issue: []
suggested_causes: []
user_confirmed_cause: null
next_action: null
~~~

Do not convert suggested_causes into user_confirmed_cause without the user's confirmation.

## State updates

Use scripts/update_exam.py for mode, readiness, materials, and updated_at changes. Keep readiness conservative and evidence-backed; keep confidence low when evidence is sparse, source material is weak, or most questions are synthetic.
