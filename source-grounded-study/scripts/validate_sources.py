#!/usr/bin/env python3
"""Validate a package's source registry against shared/schemas/source.schema.yaml.

Usage:
    python scripts/validate_sources.py <package-dir>

Checks:
- registry exists at the package-native location (exam: root SOURCES.md;
  course/standalone: sources/SOURCES.md);
- rows have unique ids matching ^S[0-9]{3}$ with required fields present and
  enum values loaded from the schema file;
- course/standalone layouts: every registered id has a detail folder with
  excerpts.md and claims.md (exam packages keep material in source-materials/
  per their own conventions, so the folder check is not mandatory there);
- claims entries reference registered source ids and use status in
  {sourced, unverified, contested}.

Exit codes: 0 = valid, 1 = validation errors, 2 = usage/IO error.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_SCHEMA_PATH = REPO_ROOT / "shared" / "schemas" / "source.schema.yaml"

SOURCE_ID_RE = re.compile(r"^S(\d{3})$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CLAIM_RE = re.compile(r"^- claim:\s*(.*)$")
FIELD_RE = re.compile(r"^\s+([a-z_]+):\s*(.*)$")
CLAIM_STATUSES = {"sourced", "unverified", "contested"}
FALLBACK_VOCABULARIES = {
    "source_type": ["textbook", "paper", "webpage", "lecture_notes", "past_paper", "syllabus", "user_notes", "other"],
    "reliability": ["official", "course", "user", "synthetic", "unknown"],
}


def reconfigure_streams() -> None:
    try:
        for stream in (sys.stdout, sys.stderr):
            reconfigure = getattr(stream, "reconfigure", None)
            if callable(reconfigure):
                reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def resolve_layout(root: Path) -> tuple[str, Path, Path]:
    """Return (kind, registry_path, detail_base_dir)."""
    if (root / "exam.yaml").is_file():
        return "exam", root / "SOURCES.md", root / "source-materials"
    sources_dir = root / "sources"
    return ("course" if (root / "course.yaml").is_file() else "standalone"), (
        sources_dir / "SOURCES.md"
    ), sources_dir


def load_vocabularies(errors: list[str]) -> dict[str, list[str]]:
    try:
        import yaml  # type: ignore
    except ImportError:
        errors.append(f"PyYAML is required to load {SOURCE_SCHEMA_PATH}")
        return dict(FALLBACK_VOCABULARIES)
    try:
        schema = yaml.safe_load(SOURCE_SCHEMA_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"source schema cannot be loaded from {SOURCE_SCHEMA_PATH}: {exc}")
        return dict(FALLBACK_VOCABULARIES)
    vocabularies = schema.get("vocabularies") if isinstance(schema, dict) else None
    if not isinstance(vocabularies, dict):
        errors.append("source schema does not define vocabularies")
        return dict(FALLBACK_VOCABULARIES)
    merged = dict(FALLBACK_VOCABULARIES)
    for key in merged:
        if isinstance(vocabularies.get(key), list) and vocabularies[key]:
            merged[key] = [str(item) for item in vocabularies[key]]
    return merged


def parse_rows(text: str) -> list[tuple[int, list[str]]]:
    """Return (line_number, cells) for every data row of the markdown table.

    Honors the ``\\|`` escaping written by register_source.py: cells are split
    on pipes that are NOT preceded by a backslash, then unescaped, so a title
    containing a literal pipe still parses as a single cell.
    """
    rows: list[tuple[int, list[str]]] = []
    for number, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        body = stripped.strip("|")
        cells = [unescape_pipe(cell.strip()) for cell in re.split(r"(?<!\\)\|", body)]
        if not cells or cells[0] in {"source_id", "---"} or set(cells[0]) <= {"-", ":"}:
            continue
        rows.append((number, cells))
    return rows


def unescape_pipe(value: str) -> str:
    return value.replace("\\|", "|")


def strip_html_comments(text: str) -> str:
    return re.sub(r"<!--.*?-->", "", text, flags=re.S)


def parse_claims(text: str) -> list[dict[str, str]]:
    claims: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for line in strip_html_comments(text).splitlines():
        stripped = line.strip()
        claim_match = CLAIM_RE.match(stripped) if stripped else None
        if claim_match:
            current = {"claim": claim_match.group(1).strip()}
            claims.append(current)
            continue
        field_match = FIELD_RE.match(line) if stripped else None
        if current is not None and field_match:
            value = field_match.group(2).split("#", 1)[0].strip()
            current[field_match.group(1)] = value
        elif not stripped:
            continue
        else:
            current = None
    return claims


def validate_registry(registry_path: Path, vocabularies: dict[str, list[str]], errors: list[str]) -> list[str]:
    try:
        text = registry_path.read_text(encoding="utf-8")
    except OSError as exc:
        errors.append(f"registry cannot be read: {registry_path}: {exc}")
        return []
    seen: set[str] = set()
    ids: list[str] = []
    for number, cells in parse_rows(text):
        label = f"SOURCES.md:{number}"
        if len(cells) < 6:
            errors.append(f"{label} row must have 6 columns (source_id/title/type/registered_at/reliability/coverage)")
            continue
        source_id, title, source_type, registered_at, reliability = cells[:5]
        if not SOURCE_ID_RE.match(source_id):
            errors.append(f"{label} invalid source_id {source_id!r}; must match ^S[0-9]{{3}}$")
        elif source_id in seen:
            errors.append(f"{label} duplicate source_id: {source_id}")
        else:
            seen.add(source_id)
            ids.append(source_id)
        if not title:
            errors.append(f"{label} ({source_id}) missing title")
        if source_type not in vocabularies["source_type"]:
            errors.append(f"{label} ({source_id}) invalid type {source_type!r}; allowed {vocabularies['source_type']}")
        if reliability not in vocabularies["reliability"]:
            errors.append(f"{label} ({source_id}) invalid reliability {reliability!r}; allowed {vocabularies['reliability']}")
        if not DATE_RE.match(registered_at):
            errors.append(f"{label} ({source_id}) registered_at must be YYYY-MM-DD, got {registered_at!r}")
    return ids


def validate_detail_folders(detail_base: Path, kind: str, ids: list[str], errors: list[str]) -> None:
    if kind == "exam":
        # Exam packages keep excerpts/material under source-materials/ per their
        # own conventions; the per-id folder is created by register_source but
        # not mandatory for registries that predate this skill.
        return
    for source_id in ids:
        for filename in ("excerpts.md", "claims.md"):
            if not (detail_base / source_id / filename).is_file():
                errors.append(f"missing {filename} for {source_id}: sources/{source_id}/{filename}")


def collect_claim_files(detail_base: Path, kind: str, ids: list[str]) -> list[Path]:
    if kind == "exam":
        files = [
            path
            for path in sorted(detail_base.glob("S*/claims.md"))
            if path.parent.name in set(ids)
        ]
        return files
    return [detail_base / source_id / "claims.md" for source_id in ids]


def validate_claims(claim_files: list[Path], registered_ids: set[str], errors: list[str]) -> tuple[int, int]:
    unverified = 0
    contested = 0
    for path in claim_files:
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            errors.append(f"claims file cannot be read: {path}: {exc}")
            continue
        for index, claim in enumerate(parse_claims(text), start=1):
            label = f"{path.relative_to(path.parents[2])}#{index}"
            source_ref = claim.get("source", "")
            if source_ref not in registered_ids:
                errors.append(f"{label} references unknown source id {source_ref!r}")
            status = claim.get("status", "")
            if status not in CLAIM_STATUSES:
                errors.append(f"{label} invalid status {status!r}; allowed {sorted(CLAIM_STATUSES)}")
            elif status == "unverified":
                unverified += 1
            elif status == "contested":
                contested += 1
    return unverified, contested


def main() -> int:
    reconfigure_streams()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package_dir")
    args = parser.parse_args()

    root = Path(args.package_dir).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: package directory does not exist: {root}", file=sys.stderr)
        return 2

    errors: list[str] = []
    vocabularies = load_vocabularies(errors)
    kind, registry_path, detail_base = resolve_layout(root)
    if not registry_path.is_file():
        expected = "SOURCES.md" if kind == "exam" else "sources/SOURCES.md"
        errors.append(f"source registry is missing: {expected}")

    registered_ids = validate_registry(registry_path, vocabularies, errors) if registry_path.is_file() else []
    validate_detail_folders(detail_base, kind, registered_ids, errors)
    claim_files = collect_claim_files(detail_base, kind, registered_ids)
    unverified, contested = validate_claims(claim_files, set(registered_ids), errors)

    for error in errors:
        print(f"ERROR: {error}")
    print(f"SUMMARY: sources={len(registered_ids)} unverified={unverified} contested={contested}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
