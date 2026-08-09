#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path


START_RE = re.compile(
    r"^\s*(?:#{1,6}\s*)?(?:(?:Q|Question)\s*)?\d+[\).、:：]\s+|^\s*第[一二三四五六七八九十百0-9]+[题問问]\s*"
)


def looks_like_start(line):
    return bool(START_RE.search(line))


def split_blocks(text):
    blocks = []
    current = []
    for line in text.splitlines():
        if looks_like_start(line) and current:
            block = "\n".join(current).strip()
            if block:
                blocks.append(block)
            current = [line]
        else:
            current.append(line)

    block = "\n".join(current).strip()
    if block:
        blocks.append(block)

    if len(blocks) <= 1:
        candidates = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
        useful = [
            part
            for part in candidates
            if any(marker in part for marker in ["?", "？", "____", "计算", "证明", "Explain", "Show"])
        ]
        if useful:
            blocks = useful

    return blocks


def _count_option_markers(text):
    """Count distinct A-D option markers like A. A) (A) A、."""
    seen = set()
    for m in re.finditer(r"(?:^|\n)\s*[A-Da-d][\).、:：]|\s\([a-d]\)", text):
        raw = m.group().strip().upper()
        for ch in "ABCD":
            if ch in raw:
                seen.add(ch)
    return len(seen)


# Single-word tokens (matched after split)
CODE_TOKENS = {
    "def", "class", "import", "return", "print", "yield", "lambda", "raise",
    "try:", "except", "finally:", "async", "await", "elif", "else:",
    "printf", "scanf", "function", "variable", "compiler", "syntax", "debug",
    "compile", "method", "inheritance", "polymorphism", "array", "string",
    "int", "float", "boolean", "bool", "void", "static", "main",
    "inherits", "overload", "override",
}
# Multi-word / special-character signals (checked in raw lowercased text)
CODE_PHRASES = [
    "public static", "console.log", "#include", "system.out",
    "npm install", "pip install", "git clone", "def ", "class ",
]


def _is_code_context(text):
    """Check if text contains programming context signals (no regex)."""
    lower = text.lower()
    # 1) split-word tokens
    tokens = set(lower.replace("(", " ").replace(")", " ").replace(",", " ").split())
    if tokens & CODE_TOKENS:
        return True
    # 2) multi-word / special-character phrases
    for phrase in CODE_PHRASES:
        if phrase in lower:
            return True
    # 3) Chinese code keywords
    if "编程" in text or "代码" in text or "程序" in text:
        return True
    return False


def detect_type(prompt):
    # 1) choice: two or more A-D option markers
    if _count_option_markers(prompt) >= 2:
        return "choice"

    # 2) fill in the blank
    if "____" in prompt or "填空" in prompt:
        return "fill"

    # 3) proof
    if "证明" in prompt or "prove" in prompt.lower() or "show that" in prompt.lower():
        return "proof"

    # 4) code (before calculation — "用代码计算" should be code)
    if _is_code_context(prompt):
        return "code"

    # 5) calculation
    if "计算" in prompt or "calculate" in prompt.lower() or "compute" in prompt.lower():
        return "calculation"

    # 6) essay (long text)
    if len(prompt) > 900:
        return "essay"

    # 7) default
    return "short"


def next_id_start(output_path):
    if not output_path.exists():
        return 1
    max_id = 0
    for line in output_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        match = re.match(r"Q(\d+)$", str(obj.get("id", "")))
        if match:
            max_id = max(max_id, int(match.group(1)))
    return max_id + 1


def main():
    parser = argparse.ArgumentParser(description="Build a draft question bank JSONL file from text or Markdown.")
    parser.add_argument("input", help="Input Markdown or text file.")
    parser.add_argument("exam_dir", help="Exam package directory.")
    parser.add_argument("--source-id", default=None, help="Source id to attach to extracted questions.")
    parser.add_argument("--output", default=None, help="Output JSONL path. Defaults to question-bank/questions.jsonl.")
    parser.add_argument("--append", action="store_true", help="Append to an existing question bank.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite the output file.")
    parser.add_argument("--default-topic", default="unclassified")
    parser.add_argument("--default-difficulty", default="unknown")
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    exam_dir = Path(args.exam_dir).expanduser().resolve()
    if not input_path.exists():
        print("ERROR: input file not found: " + str(input_path), file=sys.stderr)
        return 1
    if not exam_dir.exists():
        print("ERROR: exam directory not found: " + str(exam_dir), file=sys.stderr)
        return 1

    output_path = Path(args.output).expanduser().resolve() if args.output else exam_dir / "question-bank" / "questions.jsonl"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() and not (args.append or args.overwrite):
        print("ERROR: output exists; use --append or --overwrite: " + str(output_path), file=sys.stderr)
        return 1

    text = input_path.read_text(encoding="utf-8-sig")
    blocks = split_blocks(text)
    source_id = args.source_id or input_path.name
    start = next_id_start(output_path) if args.append else 1

    questions = []
    for offset, block in enumerate(blocks):
        prompt = block.strip()
        if not prompt:
            continue
        questions.append(
            {
                "id": "Q" + str(start + offset).zfill(4),
                "source": source_id,
                "type": detect_type(prompt),
                "topic": args.default_topic,
                "difficulty": args.default_difficulty,
                "estimated_time": None,
                "prompt": prompt,
                "answer_or_rubric": "",
                "status": "draft",
                "synthetic": False,
            }
        )

    mode = "a" if args.append else "w"
    with output_path.open(mode, encoding="utf-8") as handle:
        for item in questions:
            handle.write(json.dumps(item, ensure_ascii=False) + "\n")

    print("Wrote " + str(len(questions)) + " draft questions to " + str(output_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
