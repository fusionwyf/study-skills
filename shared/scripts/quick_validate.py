#!/usr/bin/env python3
"""Validate a study-skills skill directory (repo-bundled validator).

Replaces the external `<skill-creator>/scripts/quick_validate.py` reference:
that script predates the `disable-model-invocation` frontmatter key and
rejects it as an unknown key, so every skill here failed validation. This
bundled version understands the current skill mechanism.

Checks:
- SKILL.md exists with YAML frontmatter (not just a regex scan);
- `name` is present and hyphen-case (lowercase letters/digits/hyphens);
- `description` is present and free of angle brackets;
- no unknown frontmatter keys (only name / description /
  disable-model-invocation are allowed);
- `disable-model-invocation: true` implies agents/openai.yaml exists and
  sets policy.allow_implicit_invocation: false — i.e. the skill is
  user-invoked only and never auto-injected by the runtime.

Usage:
    python shared/scripts/quick_validate.py <skill-dir>

Exit codes: 0 = valid, 1 = invalid, 2 = usage/IO error.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ALLOWED_KEYS = {"name", "description", "disable-model-invocation"}
NAME_RE = re.compile(r"^[a-z0-9-]+$")


def fail(message: str) -> int:
    print(f"ERROR: {message}", file=sys.stderr)
    return 1


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python shared/scripts/quick_validate.py <skill-directory>", file=sys.stderr)
        return 2
    skill_dir = Path(sys.argv[1]).expanduser().resolve()
    if not skill_dir.is_dir():
        return fail(f"skill directory does not exist: {skill_dir}")

    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        return fail(f"{skill_md.name} not found in {skill_dir}")
    try:
        raw = skill_md.read_text(encoding="utf-8")
    except OSError as exc:
        return fail(f"{skill_md.name} cannot be read: {exc}")
    if not raw.startswith("---"):
        return fail(f"{skill_md.name} has no YAML frontmatter")
    parts = raw.split("---", 2)
    if len(parts) != 3:
        return fail(f"{skill_md.name} frontmatter is not terminated")
    try:
        fm = yaml.safe_load(parts[1])
    except Exception as exc:
        return fail(f"{skill_md.name} frontmatter cannot be parsed: {exc}")
    if not isinstance(fm, dict):
        return fail(f"{skill_md.name} frontmatter must be a mapping")

    unknown = set(fm) - ALLOWED_KEYS
    if unknown:
        return fail(f"{skill_md.name}: unexpected frontmatter keys: {sorted(unknown)}")

    name = fm.get("name")
    if not isinstance(name, str) or not NAME_RE.match(name):
        return fail(f"{skill_md.name}: name must be hyphen-case, got {name!r}")
    if name.startswith("-") or name.endswith("-") or "--" in name:
        return fail(f"{skill_md.name}: name cannot start/end with '-' or contain '--'")

    description = fm.get("description")
    if not isinstance(description, str) or not description.strip():
        return fail(f"{skill_md.name}: description must be a non-empty string")
    if "<" in description or ">" in description:
        return fail(f"{skill_md.name}: description cannot contain angle brackets")

    explicit_only = fm.get("disable-model-invocation")
    if explicit_only is True:
        openai_yaml = skill_dir / "agents" / "openai.yaml"
        if not openai_yaml.is_file():
            return fail(
                f"{skill_md.name}: disable-model-invocation: true requires agents/openai.yaml "
                "so the runtime knows the skill is user-invoked only"
            )
        try:
            policy = yaml.safe_load(openai_yaml.read_text(encoding="utf-8"))
        except Exception as exc:
            return fail(f"{skill_md.name}: agents/openai.yaml cannot be parsed: {exc}")
        if (
            not isinstance(policy, dict)
            or not isinstance(policy.get("policy"), dict)
            or policy["policy"].get("allow_implicit_invocation") is not False
        ):
            return fail(
                f"{skill_md.name}: agents/openai.yaml must set policy.allow_implicit_invocation: false "
                "to match disable-model-invocation: true"
            )

    print(f"OK {name} is valid!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
