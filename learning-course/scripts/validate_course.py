#!/usr/bin/env python3
"""Validate a schema-v3 learning-course package and its explicit HTML contract."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


REQUIRED_DIRS = ("lessons", "assets", "reference", "records", "exports")
REQUIRED_FILES = ("course.yaml", "PLAN.md", "INDEX.md", "index.html")
LINK_RE = re.compile(r"(?:href|src)\s*=\s*[\"']([^\"']+)[\"']", re.I)
LESSON_RE = re.compile(r"^(\d{4})-[a-z0-9\u4e00-\u9fff-]+\.html$", re.I)
PHASES = {"diagnostic", "designing", "teaching", "awaiting_evidence", "review_due", "recovery"}
STATUSES = {"draft", "active", "paused", "complete"}
COGNITIVE_LEVELS = {"remember", "understand", "apply", "analyze", "evaluate", "create"}
EVIDENCE_STRENGTHS = {"weak", "medium", "strong"}
REPO_ROOT = Path(__file__).resolve().parents[2]
VIZ_REGISTRY_PATH = Path(__file__).resolve().parents[1] / "assets" / "visualizations" / "adapters.json"
RECORD_SCHEMA_PATH = REPO_ROOT / "shared" / "schemas" / "record.schema.yaml"
SHARED_RECORD_VALIDATOR = REPO_ROOT / "shared" / "scripts" / "validate_record.py"
if str(SHARED_RECORD_VALIDATOR.parent) not in sys.path:
    sys.path.insert(0, str(SHARED_RECORD_VALIDATOR.parent))
# Only used when shared/schemas/record.schema.yaml cannot be read; the load failure
# itself is reported as an error, so the schema stays the source of truth.
FALLBACK_VOCABULARIES = {
    "mastery": ["unseen", "recognition", "application", "transfer", "uncertain"],
    "assessment_status": ["pending", "finalized"],
}
CONDITIONAL_VALUES = {
    "retrieval": {"required", "not-applicable"},
    "feedback": {"required", "not-applicable"},
    "source-status": {"verified", "not-needed", "unverified"},
    "answer-status": {"provided", "not-applicable"},
}


def data_value(body: str, name: str) -> str | None:
    match = re.search(rf"data-{re.escape(name)}\s*=\s*[\"']([^\"']*)[\"']", body, re.I)
    return match.group(1).strip().lower() if match else None


def has_data_role(body: str, role: str) -> bool:
    return re.search(rf"data-role\s*=\s*[\"'][^\"']*\b{re.escape(role)}\b[^\"']*[\"']", body, re.I) is not None


def load_record_vocabularies(errors: list[str]) -> dict[str, object]:
    """Load enum vocabularies from the unified record schema (source of truth)."""
    try:
        import yaml  # type: ignore
    except ImportError:
        errors.append("--strict-schema requires PyYAML")
        return dict(FALLBACK_VOCABULARIES)
    try:
        schema = yaml.safe_load(RECORD_SCHEMA_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"record schema cannot be loaded from {RECORD_SCHEMA_PATH}: {exc}")
        return dict(FALLBACK_VOCABULARIES)
    if not isinstance(schema, dict):
        errors.append("record schema root must be a mapping")
        return dict(FALLBACK_VOCABULARIES)
    vocabularies = schema.get("vocabularies")
    if not isinstance(vocabularies, dict) or not vocabularies:
        errors.append("record schema does not define vocabularies")
        return dict(FALLBACK_VOCABULARIES)
    return vocabularies


def run_shared_record_validator(record_path: Path, errors: list[str]) -> None:
    """Delegate per-record frontmatter validation to the shared validator.

    Non-zero exit means invalid; its ERROR lines are surfaced as errors while
    WARN lines stay non-fatal (legacy records without new common fields).
    """
    if not SHARED_RECORD_VALIDATOR.is_file():
        errors.append(f"shared record validator is missing: {SHARED_RECORD_VALIDATOR}")
        return
    try:
        completed = subprocess.run(
            [sys.executable, str(SHARED_RECORD_VALIDATOR), str(record_path)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except OSError as exc:
        errors.append(f"record validator could not run for {record_path.name}: {exc}")
        return
    lines = [line.strip() for line in (completed.stdout + completed.stderr).splitlines() if line.strip()]
    for line in lines:
        if line.startswith("WARN:"):
            print(f"RECORD WARNING ({record_path.name}): {line[len('WARN:'):].strip()}")
    if completed.returncode == 0:
        return
    reported = False
    for line in lines:
        if line.startswith(("ERROR:", "FAIL")):
            errors.append(f"{record_path.name}: {line}")
            reported = True
    if not reported:
        errors.append(f"{record_path.name}: shared record validator exited with {completed.returncode}")


def is_legacy_record(metadata: dict[str, object]) -> bool:
    """True when a finalized record predates the additive common fields.

    The contract is additive: old records lacking attempted_at/source_backed/
    synthetic keep validating through the local checks only, with no auto
    migration; records carrying the new fields get full contract validation.
    """
    return all(metadata.get(field) is None for field in ("attempted_at", "source_backed", "synthetic"))


def validate_record(root: Path, value: object, label: str, errors: list[str]) -> Path | None:
    if not isinstance(value, str) or not value:
        errors.append(f"{label} must be a records/ path")
        return None
    target = (root / value).resolve()
    try:
        target.relative_to((root / "records").resolve())
    except ValueError:
        errors.append(f"{label} escapes records/: {value}")
        return None
    if not target.is_file():
        errors.append(f"{label} does not exist: {value}")
        return None
    return target


def record_metadata(path: Path, yaml: object, label: str, errors: list[str]) -> dict[str, object] | None:
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---\n"):
        errors.append(f"{label} is missing YAML frontmatter")
        return None
    parts = text.split("---", 2)
    if len(parts) != 3:
        errors.append(f"{label} has invalid YAML frontmatter")
        return None
    try:
        metadata = yaml.safe_load(parts[1]) or {}  # type: ignore[attr-defined]
    except Exception as exc:
        errors.append(f"{label} frontmatter cannot be parsed: {exc}")
        return None
    if not isinstance(metadata, dict):
        errors.append(f"{label} frontmatter must be a mapping")
        return None
    if metadata.get("assessment_status") == "finalized" and any(
        marker in text for marker in ("待 Agent", "待判断", "待补充")
    ):
        errors.append(f"{label} finalized record still contains assessment placeholders")
    return metadata


def validate_yaml_schema(
    path: Path,
    root: Path,
    lesson_numbers: list[int],
    lesson_objectives: set[str],
    errors: list[str],
    warnings: list[str],
) -> None:
    try:
        import yaml  # type: ignore
        from validate_record import independence_error
    except ImportError:
        errors.append("--strict-schema requires PyYAML")
        return
    vocabularies = load_record_vocabularies(errors)
    mastery_vocab = vocabularies.get("mastery")
    mastery_values = set(mastery_vocab) if isinstance(mastery_vocab, list) else set(FALLBACK_VOCABULARIES["mastery"])
    status_vocab = vocabularies.get("assessment_status")
    assessment_statuses = (
        set(status_vocab) if isinstance(status_vocab, list) else set(FALLBACK_VOCABULARIES["assessment_status"])
    )
    try:
        state = yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"course.yaml cannot be parsed: {exc}")
        return
    if not isinstance(state, dict):
        errors.append("course.yaml root must be a mapping")
        return
    if state.get("schema_version") != 3:
        errors.append(f"course.yaml must use schema_version 3, got {state.get('schema_version')!r}")
    if state.get("status") not in STATUSES:
        errors.append(f"invalid status: {state.get('status')!r}")
    if state.get("phase") not in PHASES:
        errors.append(f"invalid phase: {state.get('phase')!r}")
    current_lesson = state.get("current_lesson")
    if not isinstance(current_lesson, int):
        errors.append("current_lesson must be an integer")
    elif current_lesson < 0:
        errors.append("current_lesson must be >= 0")
    elif current_lesson > 0 and current_lesson not in lesson_numbers:
        errors.append(f"current_lesson {current_lesson:04d} has no matching lesson file")
    if not isinstance(state.get("learner"), dict):
        errors.append("schema v3 requires learner mapping")
    for removed in ("feedback_status", "mode", "roadmap", "next_lesson", "checkpoint", "mastery"):
        if removed in state:
            errors.append(f"schema v3 removed top-level field: {removed}")

    diagnostic = state.get("diagnostic")
    if not isinstance(diagnostic, dict):
        errors.append("diagnostic must be a mapping")
    else:
        if diagnostic.get("status") not in {"pending", "complete", "skipped"}:
            errors.append(f"invalid diagnostic status: {diagnostic.get('status')!r}")
        if diagnostic.get("record") is not None:
            validate_record(root, diagnostic.get("record"), "diagnostic.record", errors)

    last_feedback = state.get("last_feedback")
    if last_feedback is not None:
        validate_record(root, last_feedback, "last_feedback", errors)

    objectives = state.get("objectives", [])
    objective_ids: set[str] = set()
    if not isinstance(objectives, list):
        errors.append("objectives must be a list")
    else:
        for index, objective in enumerate(objectives):
            if not isinstance(objective, dict):
                errors.append(f"objectives[{index}] must be a mapping")
                continue
            objective_id = objective.get("id")
            if not isinstance(objective_id, str) or not objective_id:
                errors.append(f"objectives[{index}] missing id")
            elif objective_id in objective_ids:
                errors.append(f"duplicate objective id: {objective_id}")
            else:
                objective_ids.add(objective_id)
            mastery = objective.get("mastery")
            if mastery not in mastery_values:
                errors.append(f"objectives[{index}] has invalid mastery")
            cognitive = objective.get("cognitive_level")
            if cognitive is not None and cognitive not in COGNITIVE_LEVELS:
                errors.append(f"objectives[{index}] has invalid cognitive_level")
            evidence = objective.get("evidence", [])
            if not isinstance(evidence, list):
                errors.append(f"objectives[{index}].evidence must be a list")
                continue
            if mastery in {"recognition", "application", "transfer"} and not evidence:
                errors.append(f"objectives[{index}] mastery {mastery!r} requires evidence")
            supports_current_mastery = False
            for evidence_index, item in enumerate(evidence):
                if not isinstance(item, dict):
                    errors.append(f"objectives[{index}].evidence[{evidence_index}] must be a mapping")
                    continue
                label = f"objectives[{index}].evidence[{evidence_index}]"
                target = validate_record(root, item.get("record"), f"{label}.record", errors)
                if not isinstance(item.get("type"), str) or not item.get("type"):
                    errors.append(f"{label} missing type")
                if item.get("strength") not in EVIDENCE_STRENGTHS:
                    errors.append(f"{label} invalid strength")
                evidence_mastery = item.get("mastery")
                if evidence_mastery not in mastery_values - {"unseen", "uncertain"}:
                    errors.append(f"{label} invalid or missing mastery")
                if evidence_mastery == mastery:
                    supports_current_mastery = True
                if target is not None:
                    metadata = record_metadata(target, yaml, label, errors)
                    if metadata is not None:
                        issue = independence_error(metadata, evidence_mastery)
                        if issue:
                            if metadata.get("independence") is None:
                                warnings.append(f"{label}: legacy independence unknown; {issue}; arrange independent verification")
                            else:
                                errors.append(f"{label}: {issue}")
                        if metadata.get("assessment_status") == "finalized":
                            if is_legacy_record(metadata):
                                print(
                                    f"RECORD NOTE ({target.name}): legacy record without new common "
                                    "fields; shared contract validation skipped"
                                )
                            else:
                                run_shared_record_validator(target, errors)
                        status = metadata.get("assessment_status")
                        if status not in assessment_statuses:
                            errors.append(f"{label} invalid assessment_status: {status!r}")
                        if metadata.get("record_schema") != 1 or status != "finalized":
                            errors.append(f"{label} must reference a finalized record_schema 1 record")
                        if metadata.get("evidence_type") != item.get("type"):
                            errors.append(f"{label} type disagrees with record frontmatter")
                        if metadata.get("evidence_strength") != item.get("strength"):
                            errors.append(f"{label} strength disagrees with record frontmatter")
                        supported = metadata.get("supported_objectives")
                        supported_pairs = {
                            (entry.get("id"), entry.get("mastery"))
                            for entry in supported
                            if isinstance(entry, dict)
                        } if isinstance(supported, list) else set()
                        if (objective_id, evidence_mastery) not in supported_pairs:
                            errors.append(f"{label} record does not support {objective_id}={evidence_mastery}")
            if mastery in {"recognition", "application", "transfer"} and evidence and not supports_current_mastery:
                errors.append(f"objectives[{index}] current mastery {mastery!r} lacks matching evidence")

    missing_objectives = sorted(lesson_objectives - objective_ids)
    for objective_id in missing_objectives:
        errors.append(f"lesson references unknown objective: {objective_id}")

    if state.get("status") == "complete" and (
        not isinstance(objectives, list)
        or not objectives
        or any(
            not isinstance(item, dict)
            or item.get("mastery") in {"unseen", "uncertain", None}
            or not item.get("evidence")
            for item in objectives
        )
    ):
        errors.append("status complete requires evidence-backed mastery for every objective")

    queue = state.get("review_queue", [])
    if not isinstance(queue, list):
        errors.append("review_queue must be a list")
    else:
        for index, item in enumerate(queue):
            if not isinstance(item, dict):
                errors.append(f"review_queue[{index}] must be a mapping")
                continue
            for key in ("objective_id", "due_at", "interval_days", "review_count"):
                if key not in item:
                    warnings.append(f"review_queue[{index}] missing {key}")
            if item.get("objective_id") not in objective_ids:
                errors.append(f"review_queue[{index}] references unknown objective")
            last_record = item.get("last_record")
            if last_record:
                label = f"review_queue[{index}].last_record"
                target = validate_record(root, last_record, label, errors)
                if target is not None:
                    metadata = record_metadata(target, yaml, label, errors)
                    if metadata is not None:
                        status = metadata.get("assessment_status")
                        if status != "finalized":
                            errors.append(f"{label} must reference a finalized review record")
                        elif not is_legacy_record(metadata):
                            run_shared_record_validator(target, errors)
                        record_objective = metadata.get("objective_id")
                        if record_objective is not None and record_objective != item.get("objective_id"):
                            errors.append(f"{label} references a different objective")


class ComponentParser(HTMLParser):
    """Collect element structure for the optional open-practice contracts."""
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__()
        self.nodes = []
        self.stack = []

    def handle_starttag(self, tag, attrs):
        node = {"tag": tag, "attrs": dict(attrs), "children": [], "text": ""}
        self.nodes.append(node)
        if self.stack:
            self.stack[-1]["children"].append(node)
        if tag not in self.VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index]["tag"] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        if self.stack:
            self.stack[-1]["text"] += data


def descendants(node):
    for child in node["children"]:
        yield child
        yield from descendants(child)


def validate_open_components(lesson: Path, body: str, errors: list[str]) -> None:
    parser = ComponentParser()
    parser.feed(body)
    tasks = [n for n in parser.nodes if set((n["attrs"].get("data-role") or "").split()) & {"teaching-target", "dialogue-practice"}]
    question_ids = []
    for task in tasks:
        attrs = task["attrs"]
        label = f"{lesson.name}: {attrs.get('data-question-id') or 'open component'}"
        question_ids.append(attrs.get("data-question-id"))
        if not attrs.get("data-question-id") or attrs.get("data-answer-kind") != "open":
            errors.append(f"{label} requires data-question-id and data-answer-kind=open")
        children = list(descendants(task))
        fields = [n for n in children if n["tag"] == "textarea"]
        labels = {n["attrs"].get("for") for n in children if n["tag"] == "label"}
        if not fields or any(not f["attrs"].get("id") or f["attrs"]["id"] not in labels for f in fields):
            errors.append(f"{label} requires labeled textarea answers")
        roles = (attrs.get("data-role") or "").split()
        if "dialogue-practice" in roles:
            turns = [n for n in children if "data-dialogue-turn" in n["attrs"]]
            ids = [n["attrs"].get("data-dialogue-turn") for n in turns]
            if not ids or any(not i for i in ids) or len(ids) != len(set(ids)):
                errors.append(f"{label} requires unique nonempty data-dialogue-turn ids")
            for turn in turns:
                contents = list(descendants(turn))
                if sum(n["tag"] == "textarea" for n in contents) != 1 or not any("data-dialogue-prompt" in n["attrs"] for n in contents):
                    errors.append(f"{label} each turn requires a prompt and one textarea")
                if turn["attrs"].get("data-guidance") not in {None, "with_hints", "ai_guided"}:
                    errors.append(f"{label} invalid data-guidance")
            if not any(n["tag"] == "button" and "data-dialogue-next" in n["attrs"] for n in children):
                errors.append(f"{label} missing data-dialogue-next button")
            if not any("data-dialogue-status" in n["attrs"] for n in children):
                errors.append(f"{label} missing data-dialogue-status")
        if "teaching-target" in roles:
            if not any(n["tag"] == "button" and "data-teaching-check" in n["attrs"] for n in children) or not any("data-teaching-key" in n["attrs"] for n in children):
                errors.append(f"{label} requires data-teaching-check button and data-teaching-key")
    if len(question_ids) != len(set(question_ids)):
        errors.append(f"{lesson.name}: duplicate open-practice question ids")


def validate_visualizations(lesson: Path, body: str, errors: list[str]) -> None:
    try:
        registry = json.loads(VIZ_REGISTRY_PATH.read_text(encoding="utf-8"))
        kinds = set((registry.get("kinds") or {}).keys())
    except (OSError, json.JSONDecodeError):
        kinds = {"chart", "relation", "timeline", "process", "spatial", "sequence", "table"}
    parser = ComponentParser()
    parser.feed(body)
    ids = [n["attrs"].get("id") for n in parser.nodes if n["attrs"].get("id")]
    for node in parser.nodes:
        kind = node["attrs"].get("data-visualization")
        if kind is None:
            continue
        label = f"{lesson.name}: visualization {node['attrs'].get('id') or kind}"
        children = list(descendants(node))
        if kind not in kinds:
            errors.append(f"{label} unsupported visualization type")
        if not node["attrs"].get("id") or ids.count(node["attrs"].get("id")) != 1:
            errors.append(f"{label} requires a unique id")
        configs = [n for n in children if "data-viz-config" in n["attrs"]]
        if len(configs) != 1 or configs[0]["tag"] != "script" or configs[0]["attrs"].get("type") != "application/json":
            errors.append(f"{label} requires one application/json data-viz-config")
        else:
            try:
                def reject_constant(value):
                    raise ValueError(f"non-finite JSON constant: {value}")
                config = json.loads(configs[0]["text"], parse_constant=reject_constant)
                if not isinstance(config, dict) or any(not isinstance(config.get(k), str) or not config[k].strip()
                                                       for k in ("model", "domain", "precision")):
                    errors.append(f"{label} requires model, domain and precision descriptions")
                elif kind == "chart" and not isinstance(config.get("traces"), list):
                    errors.append(f"{label} chart config requires traces")
                elif kind == "relation" and not isinstance(config.get("nodes"), list):
                    errors.append(f"{label} relation config requires nodes")
                elif kind == "timeline" and not isinstance(config.get("events"), list):
                    errors.append(f"{label} timeline config requires events")
                elif kind == "process" and not isinstance(config.get("nodes"), list):
                    errors.append(f"{label} process config requires nodes")
                elif kind == "table" and (not isinstance(config.get("columns"), list) or not isinstance(config.get("rows"), list)):
                    errors.append(f"{label} table config requires columns and rows")
                elif kind == "sequence" and not isinstance(config.get("steps"), list) and not isinstance(config.get("input"), list):
                    errors.append(f"{label} sequence config requires steps or input")
                elif kind == "spatial" and not ((isinstance(config.get("matrix"), list) and isinstance(config.get("vector"), list)) or isinstance(config.get("shapes"), list)):
                    errors.append(f"{label} spatial config requires matrix/vector or shapes")
            except (ValueError, TypeError) as exc:
                errors.append(f"{label} invalid JSON: {exc}")
        hosts = [n for n in children if "data-viz-host" in n["attrs"]]
        if len(hosts) != 1 or not hosts[0]["attrs"].get("id") or ids.count(hosts[0]["attrs"].get("id")) != 1:
            errors.append(f"{label} requires one uniquely identified data-viz-host")
        if not any("data-viz-status" in n["attrs"] and n["attrs"].get("role") == "status" for n in children):
            errors.append(f"{label} requires a data-viz-status with role=status")
        fallbacks = [n for n in children if "data-viz-fallback" in n["attrs"]]
        if not fallbacks or not any("".join(c["text"] for c in [f, *descendants(f)]).strip() for f in fallbacks) or any("hidden" in f["attrs"] for f in fallbacks):
            errors.append(f"{label} requires visible data-viz-fallback model and numeric/step description")
        if kind in {"spatial", "sequence"}:
            controls = [n for n in children if "data-viz-controls" in n["attrs"]]
            inputs = [n for c in controls for n in descendants(c) if n["tag"] == "input"]
            labels = {n["attrs"].get("for") for c in controls for n in descendants(c) if n["tag"] == "label"}
            expected = "number" if kind == "spatial" else "range"
            count = 2 if kind == "spatial" else 1
            if len(controls) != 1 or len(inputs) != count or any(n["attrs"].get("type") != expected or not n["attrs"].get("id") or n["attrs"]["id"] not in labels for n in inputs):
                errors.append(f"{label} requires labeled {expected} keyboard controls")
            if kind == "sequence" and any(not any(n["tag"] == "button" and key in n["attrs"] for n in children) for key in ("data-viz-prev", "data-viz-next")):
                errors.append(f"{label} requires previous/next step buttons")


def validate_pedagogy(lesson: Path, body: str, errors: list[str], warnings: list[str]) -> None:
    validate_open_components(lesson, body, errors)
    validate_visualizations(lesson, body, errors)
    objective = data_value(body, "objective")
    evidence = data_value(body, "evidence")
    if not objective or not has_data_role(body, "objective"):
        errors.append(f"pedagogical check missing learning objective: {lesson.name}")
    if not evidence or not has_data_role(body, "evidence"):
        errors.append(f"pedagogical check missing evidence opportunity: {lesson.name}")

    cognitive = data_value(body, "cognitive-level")
    if cognitive is not None and cognitive not in COGNITIVE_LEVELS:
        errors.append(f"invalid data-cognitive-level in lesson: {lesson.name}")

    values: dict[str, str | None] = {}
    for name, allowed in CONDITIONAL_VALUES.items():
        value = data_value(body, name)
        values[name] = value
        if value not in allowed:
            errors.append(f"invalid or missing data-{name} in lesson: {lesson.name}")

    if values.get("retrieval") == "required" and not has_data_role(body, "retrieval"):
        errors.append(f"retrieval is required but missing: {lesson.name}")
    if values.get("feedback") == "required" and not has_data_role(body, "learner-feedback"):
        errors.append(f"learner feedback is required but missing: {lesson.name}")
    if values.get("answer-status") == "provided" and not has_data_role(body, "answer-feedback"):
        errors.append(f"answer feedback is provided but missing: {lesson.name}")
    if values.get("source-status") in {"verified", "unverified"} and not has_data_role(body, "sources"):
        errors.append(f"sources are declared but missing: {lesson.name}")
    if values.get("source-status") == "unverified":
        warnings.append(f"lesson contains unverified sources: {lesson.name}")


def main() -> int:
    # Shared-validator output may contain non-ASCII record text; keep our own
    # streams UTF-8 so piped output stays decodable regardless of platform.
    try:
        for stream in (sys.stdout, sys.stderr):
            reconfigure = getattr(stream, "reconfigure", None)
            if callable(reconfigure):
                reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("course_dir")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as errors")
    parser.add_argument("--pedagogical", action="store_true")
    parser.add_argument("--strict-schema", action="store_true")
    args = parser.parse_args()

    root = Path(args.course_dir).expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []
    if not root.is_dir():
        print(f"ERROR: course directory does not exist: {root}")
        return 1
    for name in REQUIRED_DIRS:
        if not (root / name).is_dir():
            errors.append(f"missing directory: {name}/")
    for name in REQUIRED_FILES:
        if not (root / name).is_file():
            errors.append(f"missing file: {name}")

    yaml_path = root / "course.yaml"
    if yaml_path.is_file():
        text = yaml_path.read_text(encoding="utf-8", errors="replace")
        for key in ("schema_version", "course_id", "title", "status", "phase", "current_lesson", "learner", "diagnostic", "objectives", "review_queue", "last_feedback"):
            if not re.search(rf"^{re.escape(key)}\s*:", text, re.M):
                errors.append(f"course.yaml missing top-level key: {key}")
    lesson_dir = root / "lessons"
    lessons = sorted(lesson_dir.glob("*.html")) if lesson_dir.is_dir() else []
    numbers: list[int] = []
    lesson_objectives: set[str] = set()
    for lesson in lessons:
        match = LESSON_RE.match(lesson.name)
        if not match:
            errors.append(f"invalid lesson filename: lessons/{lesson.name}")
        else:
            numbers.append(int(match.group(1)))
        body = lesson.read_text(encoding="utf-8", errors="replace")
        objective = data_value(body, "objective")
        if objective:
            lesson_objectives.add(objective)
        if args.pedagogical:
            validate_pedagogy(lesson, body, errors, warnings)
        for link in LINK_RE.findall(body):
            parsed = urlsplit(link)
            if parsed.scheme or link.startswith("#") or link.startswith("//"):
                if parsed.scheme in {"http", "https"}:
                    warnings.append(f"external network dependency: {lesson.name} -> {link}")
                continue
            target = (lesson.parent / link.split("#", 1)[0]).resolve()
            try:
                target.relative_to(root)
            except ValueError:
                errors.append(f"link escapes course directory: {lesson.name} -> {link}")
                continue
            if link.split("#", 1)[0] and not target.exists():
                errors.append(f"missing local link: {lesson.name} -> {link}")

    if numbers and numbers != list(range(1, len(numbers) + 1)):
        errors.append(f"lesson numbers are not continuous from 0001: {numbers}")
    if yaml_path.is_file() and args.strict_schema:
        validate_yaml_schema(yaml_path, root, numbers, lesson_objectives, errors, warnings)
    for warning in warnings:
        print(f"WARNING: {warning}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    if args.strict and warnings:
        return 1
    print(f"OK: {root} ({len(lessons)} lesson(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
