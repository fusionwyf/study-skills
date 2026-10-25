"""Regression tests for chapter-aware ``kit.py shot`` lesson selection."""

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "learning-course" / "kit" / "build"
SCRIPTS = ROOT / "learning-course" / "scripts"
for path in (str(BUILD), str(SCRIPTS)):
    if path not in sys.path:
        sys.path.insert(0, path)

spec = importlib.util.spec_from_file_location("_kit_shot_under_test", BUILD / "kit_shot.py")
assert spec is not None and spec.loader is not None
kit_shot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kit_shot)


class SelectLessonsTest(unittest.TestCase):
    ENTRIES = [
        {"number": "0008", "chapter": "第九章"},
        {"number": "0009", "chapter": "第八章"},
        {"number": "0009", "chapter": "第九章"},
    ]

    def test_chapter_and_lesson(self):
        selected = kit_shot.select_lessons(self.ENTRIES, lesson=9, chapter="第九章")
        self.assertEqual([entry["chapter"] for entry in selected], ["第九章"])
        self.assertEqual(selected[0]["number"], "0009")

    def test_ambiguous_lesson_across_chapters_raises(self):
        with self.assertRaises(ValueError) as ctx:
            kit_shot.select_lessons(self.ENTRIES, lesson=9)
        message = str(ctx.exception)
        self.assertIn("ambiguous", message)
        self.assertIn("第八章/0009", message)
        self.assertIn("第九章/0009", message)
        self.assertIn("--chapter", message)

    def test_lesson_without_chapter_duplicate_is_unique(self):
        selected = kit_shot.select_lessons(self.ENTRIES, lesson=8)
        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]["chapter"], "第九章")

    def test_unknown_chapter_raises(self):
        with self.assertRaises(ValueError) as ctx:
            kit_shot.select_lessons(self.ENTRIES, lesson=9, chapter="第十章")
        message = str(ctx.exception)
        self.assertIn("not found", message)
        self.assertIn("第八章", message)
        self.assertIn("第九章", message)

    def test_flat_course_allows_single_match(self):
        flat = [
            {"number": "0008", "chapter": None},
            {"number": "0009", "chapter": None},
        ]
        selected = kit_shot.select_lessons(flat, lesson=9)
        self.assertEqual(selected, [{"number": "0009", "chapter": None}])

    def test_no_filter_returns_all(self):
        self.assertEqual(kit_shot.select_lessons(self.ENTRIES), self.ENTRIES)


if __name__ == "__main__":
    unittest.main()
