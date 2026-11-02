import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  examFormats,
  normalizeExam,
  questionPoints,
  sectionOf,
  summarize,
  totalPoints,
} from '../assets/js/quiz/model.js';

const single = {
  type: 'single',
  section: 'MCQ 1',
  text: 'Pick one',
  options: [
    { text: 'a', correct: false },
    { text: 'b', correct: true, note: 'because' },
  ],
};

const group = {
  type: 'group',
  section: 'Q1',
  context: 'Setup',
  positiveLabel: 'True',
  negativeLabel: 'False',
  statements: [
    { text: 's1', answerIsPositive: true },
    { text: 's2', answerIsPositive: false },
  ],
};

const open = { type: 'open', text: 'Explain', answer: 'Because.' };

test('rejects anything that is not an array', () => {
  assert.throws(() => normalizeExam({}), /JSON array/);
});

test('throws when no item is usable', () => {
  assert.throws(() => normalizeExam([{}, { type: 'single' }]), /No usable questions/);
});

test('normalizes the three formats and counts skipped junk', () => {
  const { questions, skipped } = normalizeExam([single, group, open, {}]);

  assert.equal(skipped, 1);
  assert.deepEqual(questions.map((q) => q.format), ['single', 'group', 'open']);
  assert.deepEqual(questions.map((q) => q.id), ['q0', 'q1', 'q2']);
});

test('infers the format when `type` is missing', () => {
  const { questions } = normalizeExam([
    { options: single.options },
    { statements: group.statements },
    { text: 'Why?', answer: 'yes' },
  ]);
  assert.deepEqual(questions.map((q) => q.format), ['single', 'group', 'open']);
});

test('drops multiple choice with no correct option or too few options', () => {
  const noCorrect = { type: 'single', options: [{ text: 'a' }, { text: 'b' }] };
  const tooFew = { type: 'single', options: [{ text: 'a', correct: true }] };
  assert.throws(() => normalizeExam([noCorrect, tooFew]), /No usable questions/);
});

test('drops an open question with no prompt at all', () => {
  assert.throws(() => normalizeExam([{ type: 'open', answer: 'orphaned answer' }]),
    /No usable questions/);
});

test('keeps open questions whose model answer is not written up yet', () => {
  const { questions } = normalizeExam([{ type: 'open', text: 'Prove it', answer: '' }]);
  assert.equal(questions[0].hasAnswer, false);
  assert.equal(questions[0].answer, '');
});

test('coerces missing text fields to empty strings', () => {
  const { questions } = normalizeExam([{ type: 'single', options: single.options }]);
  assert.equal(questions[0].section, '');
  assert.equal(questions[0].context, '');
  assert.equal(questions[0].text, '');
});

test('defaults the labels of a group', () => {
  const { questions } = normalizeExam([{ type: 'group', statements: group.statements }]);
  assert.equal(questions[0].positiveLabel, 'True');
  assert.equal(questions[0].negativeLabel, 'False');
});

test('scores a group per statement and everything else per question', () => {
  const { questions } = normalizeExam([single, group, open]);
  assert.deepEqual(questions.map(questionPoints), [1, 2, 1]);
  assert.equal(totalPoints(questions), 4);
});

test('summarize reports count, points and formats in display order', () => {
  const { questions } = normalizeExam([open, group, single]);
  assert.deepEqual(summarize(questions), {
    count: 3,
    points: 4,
    formats: ['single', 'group', 'open'],
  });
  assert.deepEqual(examFormats(questions), ['single', 'group', 'open']);
});

test('sectionOf falls back to the format label', () => {
  const { questions } = normalizeExam([single, open]);
  assert.equal(sectionOf(questions[0]), 'MCQ 1');
  assert.equal(sectionOf(questions[1]), 'Written answer');
});

test('does not mutate the input', () => {
  const input = [structuredClone(single)];
  const copy = structuredClone(input);
  normalizeExam(input);
  assert.deepEqual(input, copy);
});
