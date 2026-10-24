from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "learning-course" / "scripts"))
from validate_course import validate_open_components, validate_answers_and_media

# Legacy open-component markup (teaching target + multi-turn dialogue), kept
# inline now that the legacy fixture pages are gone: the compat validators must
# keep accepting this shape without optional components installed.
LEGACY_BODY = """
<section class="card" data-role="evidence teaching-target" data-question-id="teach-ai" data-answer-kind="open" aria-labelledby="teach-ai-title">
  <h2 id="teach-ai-title">你来教 AI：纠正一个误解</h2>
  <p>下面是模拟学生的错误理解，请指出错误、说明适用条件，并给一个反例。</p>
  <label for="teach-ai-answer">你会怎样纠正这个学生？</label>
  <textarea id="teach-ai-answer"></textarea>
  <button class="button" type="button" data-teaching-check hidden>保存纠正并查看对照要点</button>
  <div class="answer review-only" data-role="answer-feedback" data-teaching-key>
    <p>对照要点：说明规则的前提；指出遗漏条件会怎样；用一个反例检验误解。</p>
  </div>
</section>
<section class="card" data-role="evidence dialogue-practice" data-question-id="dialogue-1" data-answer-kind="open" aria-labelledby="dialogue-title">
  <h2 id="dialogue-title">逐轮追问</h2>
  <div data-dialogue-turn="1">
    <label for="dialogue-answer-1" data-dialogue-prompt>先解释：你选择这条规则的依据是什么？</label>
    <textarea id="dialogue-answer-1"></textarea>
  </div>
  <div data-dialogue-turn="2">
    <label for="dialogue-answer-2" data-dialogue-prompt>如果去掉一个前提条件，你的结论还成立吗？给一个反例。</label>
    <textarea id="dialogue-answer-2"></textarea>
  </div>
  <div data-dialogue-turn="3">
    <label for="dialogue-answer-3" data-dialogue-prompt>换到一个新场景，你会先检查什么，再选择方法？</label>
    <textarea id="dialogue-answer-3"></textarea>
  </div>
  <button class="button" type="button" data-dialogue-next hidden>保存本轮并继续</button>
  <p data-dialogue-status role="status"></p>
</section>
"""


class OpenComponentTests(unittest.TestCase):
    def setUp(self):
        self.body = LEGACY_BODY
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
