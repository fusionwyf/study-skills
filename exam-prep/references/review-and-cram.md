# Review And Cram

Use this reference for mistake review, readiness scoring, mock exams, and last-stage cram output.

## Mistake review

Separate what the Agent observes from what the user confirms:

~~~yaml
agent_observed_issue:
  - "Formula was applied outside its stated condition."
suggested_causes:
  - method_gap
  - misread_prompt
user_confirmed_cause: null
~~~

Allowed confirmed causes:

- concept_gap
- method_gap
- careless_error
- time_pressure
- misread_prompt
- format_issue
- trap_pattern
- other

If the user is unsure, keep user_confirmed_cause null and schedule a discriminating drill.

## Error log structure

Organize error-log.md by action value:

~~~text
high-yield_errors
recurring_patterns
one-off_mistakes
needs_relearn
resolved
~~~

Move items to resolved only after a later attempt shows the same pattern no longer appears.

## Readiness scoring

Scores are working indicators, not predicted exam scores.

- accuracy: source-backed correctness under comparable conditions.
- speed: ability to complete within exam-like time.
- coverage: portion of known scope practiced with source-backed questions.
- stability: performance when topics are mixed, delayed, or timed.
- confidence: evidence quality, low, medium, or high.

Prefer ranges or conservative updates when data is limited. Do not raise confidence above medium from synthetic questions alone.

## Mock review

After a mock, report:

- score estimate and confidence,
- time allocation,
- missed high-yield points,
- repeated error patterns,
- topics to stop expanding,
- next drill set,
- cram-sheet additions.

Save mock outputs in mock-exams/ and review records in records/.

## Cram mode

Cram mode prioritizes recall and execution. Avoid starting new broad learning tracks.

Produce:

- must-know facts,
- high-yield methods,
- common traps,
- formula sheet,
- pattern-to-method map,
- last-day checklist.

For every cram item, prefer source-backed or error-log-backed content. Mark speculative additions clearly.
