from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "learning-course" / "scripts"))
from validate_course import validate_open_components, validate_answers_and_media


class OpenComponentTests(unittest.TestCase):
    def setUp(self):
        self.body = (ROOT / "learning-course/fixtures/legacy_template.html").read_text(encoding="utf-8")
        self.modern_template = (ROOT / "learning-course/templates/lesson.html").read_text(encoding="utf-8")

    def validate(self, body):
        errors = []
        validate_open_components(Path("0001-lesson.html"), body, errors)
        return errors

    def validate_modern(self, body):
        errors = []
        validate_answers_and_media(Path("0001-lesson.html"), body, errors)
        return errors

    def test_template_has_labeled_answers_and_complete_dialogue_teaching_controls(self):
        self.assertEqual(self.validate(self.body), [])

    def test_missing_round_answer_and_duplicate_round_are_rejected(self):
        missing = self.body.replace('<textarea id="dialogue-answer-2"></textarea>', '')
        self.assertTrue(any("prompt and one textarea" in e for e in self.validate(missing)))
        duplicate = self.body.replace('data-dialogue-turn="2"', 'data-dialogue-turn="1"')
        self.assertTrue(any("unique nonempty" in e for e in self.validate(duplicate)))

    def test_missing_labels_and_teaching_key_are_rejected(self):
        missing = self.body.replace('for="teach-ai-answer"', 'for="different-answer"').replace(' data-teaching-key', '')
        errors = self.validate(missing)
        self.assertTrue(any("labeled textarea" in e for e in errors))
        self.assertTrue(any("data-teaching-key" in e for e in errors))

    def test_legacy_lessons_without_optional_components_stay_valid(self):
        body = (ROOT / "learning-course/fixtures/example-course/lessons/0001-example.html").read_text(encoding="utf-8")
        self.assertEqual(self.validate(body), [])

    def test_modern_template_validates_cleanly(self):
        self.assertEqual(self.validate_modern(self.modern_template), [])

    def test_modern_open_question_validation(self):
        valid = '<section class="question" data-question-id="q-open" data-kind="open"><div data-stem><p>Stem</p></div><div data-key><p>Key</p></div></section>'
        self.assertEqual(self.validate_modern(valid), [])
        missing_stem = '<section class="question" data-question-id="q-open" data-kind="open"><div data-key><p>Key</p></div></section>'
        self.assertTrue(any("requires data-stem" in e for e in self.validate_modern(missing_stem)))
        missing_key = '<section class="question" data-question-id="q-open" data-kind="open"><div data-stem><p>Stem</p></div></section>'
        self.assertTrue(any("requires data-key or data-explain" in e for e in self.validate_modern(missing_key)))

    def test_modern_dialogue_question_validation(self):
        valid = '<section class="question" data-question-id="q-dialogue" data-kind="dialogue"><div data-stem><p>Stem</p></div><ol data-turns><li>Turn 1</li><li>Turn 2</li></ol></section>'
        self.assertEqual(self.validate_modern(valid), [])
        insufficient_turns = '<section class="question" data-question-id="q-dialogue" data-kind="dialogue"><div data-stem><p>Stem</p></div><ol data-turns><li>Turn 1</li></ol></section>'
        self.assertTrue(any("requires at least 2 dialogue turns" in e for e in self.validate_modern(insufficient_turns)))


if __name__ == "__main__":
    unittest.main()

