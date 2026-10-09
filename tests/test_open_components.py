from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "learning-course" / "scripts"))
from validate_course import validate_open_components


class OpenComponentTests(unittest.TestCase):
    def setUp(self):
        self.body = (ROOT / "learning-course/assets/course-template/lesson.html").read_text(encoding="utf-8")

    def validate(self, body):
        errors = []
        validate_open_components(Path("0001-lesson.html"), body, errors)
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
        body = (ROOT / "learning-course/assets/example-course/lessons/0001-example.html").read_text(encoding="utf-8")
        self.assertEqual(self.validate(body), [])


if __name__ == "__main__":
    unittest.main()
