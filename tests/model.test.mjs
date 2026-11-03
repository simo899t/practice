import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { examFormats, questionPoints, sectionOf, summarize, totalPoints } from '../assets/js/quiz/model.js';
import { parseTest } from '../assets/js/quiz/markdown.js';

const { questions } = parseTest(`
## MCQ 1
Pick one

- [ ] a
- [x] b

##
Setup

- [true] s1
- [false] s2

## Q3
Explain
`);

test('scores a group per statement and everything else per question', () => {
  assert.deepEqual(questions.map(questionPoints), [1, 2, 1]);
  assert.equal(totalPoints(questions), 4);
});

test('summarize reports count, points and formats in display order', () => {
  assert.deepEqual(summarize([...questions].reverse()), {
    count: 3,
    points: 4,
    formats: ['single', 'group', 'open'],
  });
  assert.deepEqual(examFormats([questions[2], questions[0]]), ['single', 'open']);
});

test('sectionOf falls back to the format label', () => {
  assert.equal(sectionOf(questions[0]), 'MCQ 1');
  assert.equal(sectionOf(questions[1]), 'True / false');
});
