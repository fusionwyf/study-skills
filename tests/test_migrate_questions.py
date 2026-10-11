#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Unit tests for kit/build/migrate_questions.py"""

import unittest
from pathlib import Path
import sys

# Ensure learning-course kit is importable
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "learning-course/kit/build"))

from migrate_questions import migrate_html_content


class MigrateQuestionsTests(unittest.TestCase):
    def test_migrates_legacy_quiz_to_modern_choice(self):
        legacy_html = """
        <div class="quiz" data-question-id="q1" data-max-attempts="3">
          <p class="quiz-stem">地球围绕什么公转？</p>
          <div class="quiz-option"><input type="radio" data-correct="true"><label>太阳</label><span data-why>公转中心是恒星</span></div>
          <div class="quiz-option"><input type="radio"><label>月球</label></div>
          <div class="quiz-hint-panel">提示：它是太阳系的中心恒星。</div>
          <div class="quiz-explain">地球围绕太阳公转，周期约一年。</div>
        </div>
        """
        migrated, report = migrate_html_content(legacy_html)
        self.assertEqual(report["choice"], 1)
        self.assertIn('class="question"', migrated)
        self.assertIn('data-kind="choice"', migrated)
        self.assertIn('data-question-id="q1"', migrated)
        self.assertIn('data-correct', migrated)
        self.assertIn('data-why', migrated)
        self.assertIn('data-hints', migrated)
        self.assertIn('data-explain', migrated)

    def test_migrates_legacy_numeric_answer(self):
        legacy_html = """
        <div data-question-id="q2" data-answer-kind="numeric" data-expected="9.8" data-tolerance="0.1" data-unit="m/s²">
          <p class="answer-stem">重力加速度 g 约等于？</p>
          <input data-answer-input>
          <button data-answer-check>检查</button>
        </div>
        """
        migrated, report = migrate_html_content(legacy_html)
        self.assertEqual(report["numeric"], 1)
        self.assertIn('data-kind="numeric"', migrated)
        self.assertIn('data-expected="9.8"', migrated)
        self.assertIn('data-unit="m/s²"', migrated)

    def test_migrates_legacy_teaching_target_to_open(self):
        legacy_html = """
        <div data-question-id="q3" data-role="teaching-target">
          <label>简述费曼技巧的四个步骤</label>
          <textarea></textarea>
          <div data-teaching-key>1. 选主题；2. 教给小白；3. 查漏补缺；4. 简化类比。</div>
        </div>
        """
        migrated, report = migrate_html_content(legacy_html)
        self.assertEqual(report["open"], 1)
        self.assertIn('data-kind="open"', migrated)
        self.assertIn('data-key', migrated)

    def test_removes_legacy_independence_dropdown(self):
        legacy_html = """
        <div data-role="independence">
          <select data-independence>
            <option value="independent">独立完成</option>
            <option value="with_hints">使用提示</option>
          </select>
        </div>
        """
        migrated, report = migrate_html_content(legacy_html)
        self.assertEqual(report["independence_removed"], 1)
        self.assertNotIn('select', migrated)


if __name__ == "__main__":
    unittest.main()
