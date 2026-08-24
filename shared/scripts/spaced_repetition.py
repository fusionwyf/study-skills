#!/usr/bin/env python3
"""Shared spaced-repetition interval policy.

Single source of truth for review interval math. `learning-course`'s
update_progress.py historically implemented this as `adjusted_interval`;
the function below reproduces that behavior exactly whenever `review_kind`
and `hint_used` are not provided, and adds the spaced-review refinements
documented in spaced-review/references/review-session.md:

- good 延长间隔，medium 保持，poor 重置到短间隔；
- variation / transfer 支持更长的延长；
- 提示后做对不拿满延长（提示后做对按 medium 对待）。

This module must stay dependency-free and pure: no I/O, no clock access.
Callers pass in the previous interval and derive dates themselves.
"""

from __future__ import annotations

MIN_INTERVAL_DAYS = 1
MAX_INTERVAL_DAYS = 60
GOOD_MULTIPLIER = 2
LONG_KIND_MULTIPLIER = 3
POOR_DIVISOR = 2
# Kinds whose successful completion supports a longer extension.
LONG_EXTENDING_KINDS = frozenset({"variation", "transfer"})


def next_interval(
    previous_interval_days: int,
    performance: str | None,
    review_kind: str | None = None,
    hint_used: bool = False,
) -> int:
    """Return the next interval in whole days.

    previous_interval_days <= 0 is clamped up to MIN_INTERVAL_DAYS, matching
    the historical update_progress.py behavior. With review_kind=None and
    hint_used=False the result is identical to the legacy adjusted_interval:
    good -> min(60, base*2), poor -> max(1, base//2), otherwise unchanged.
    """
    base = max(MIN_INTERVAL_DAYS, int(previous_interval_days))
    if performance == "good":
        if hint_used:
            # 提示后做对是 medium，不是 good：不给延长。
            return base
        if review_kind in LONG_EXTENDING_KINDS:
            return min(MAX_INTERVAL_DAYS, base * LONG_KIND_MULTIPLIER)
        return min(MAX_INTERVAL_DAYS, base * GOOD_MULTIPLIER)
    if performance == "poor":
        return max(MIN_INTERVAL_DAYS, base // POOR_DIVISOR)
    return base
