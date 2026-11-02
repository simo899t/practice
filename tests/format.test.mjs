import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  courseParts,
  duration,
  optionKey,
  parseTags,
  percent,
  plural,
  splitTitle,
  truncate,
} from '../assets/js/core/format.js';

test('plural picks the right word', () => {
  assert.equal(plural(1, 'paper'), '1 paper');
  assert.equal(plural(3, 'paper'), '3 papers');
  assert.equal(plural(0, 'paper'), '0 papers');
  assert.equal(plural(2, 'try', 'tries'), '2 tries');
});

test('percent rounds and survives an empty exam', () => {
  assert.equal(percent(3, 4), 75);
  assert.equal(percent(2, 3), 67);
  assert.equal(percent(0, 0), 0);
});

test('duration drops the minutes when there are none', () => {
  assert.equal(duration(9_000), '9s');
  assert.equal(duration(95_000), '1m 35s');
  assert.equal(duration(-5), '0s');
});

test('optionKey labels options A, B, C', () => {
  assert.deepEqual([0, 1, 25].map(optionKey), ['A', 'B', 'Z']);
});

test('splitTitle separates the course code from the name', () => {
  assert.deepEqual(splitTitle('DM507, DM578 - Algorithms'), {
    code: 'DM507, DM578',
    name: 'Algorithms',
  });
  assert.deepEqual(splitTitle('Calculus'), { code: '', name: 'Calculus' });
});

test('parseTags splits a slash-separated description', () => {
  assert.deepEqual(parseTags('AI/CS'), ['AI', 'CS']);
  assert.deepEqual(parseTags('AI'), ['AI']);
  assert.deepEqual(parseTags(''), []);
  assert.deepEqual(parseTags(undefined), []);
});

test('truncate cuts on a word boundary and only when needed', () => {
  assert.equal(truncate('short', 20), 'short');
  assert.equal(truncate('one two three four five', 12), 'one two…');
  assert.ok(truncate('x'.repeat(40), 10).length <= 11);
});

test('courseParts turns a manifest title into display parts', () => {
  assert.deepEqual(courseParts('AI501, DS843 - Introduction to Artificial Intelligence'), {
    codes: 'AI501 · DS843',
    name: 'Introduction to Artificial Intelligence',
  });
  assert.deepEqual(courseParts('AI503 - Calculus'), { codes: 'AI503', name: 'Calculus' });
  assert.deepEqual(courseParts('Exam practice'), { codes: '', name: 'Exam practice' });
  assert.deepEqual(courseParts(''), { codes: '', name: '' });
  assert.deepEqual(courseParts(null), { codes: '', name: '' });
});
