/** The examples on the Add a test page must be clean test files of their own type. */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTest } from '../assets/js/quiz/markdown.js';
import { EXAMPLES } from '../assets/js/submit/examples.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

test('there is one example per question type', () => {
  assert.deepEqual(EXAMPLES.map((example) => example.format).sort(), ['group', 'open', 'single']);
});

for (const example of EXAMPLES) {
  test(`${example.file} reads cleanly and holds only ${example.format} questions`, () => {
    const { questions, issues, images } = parseTest(readFileSync(join(ROOT, example.file), 'utf8'));
    assert.deepEqual(issues, []);
    assert.ok(questions.length > 0);
    assert.ok(questions.every((question) => question.format === example.format));
    for (const { path } of images) assert.ok(existsSync(join(ROOT, dirname(example.file), path)), path);
  });
}

test('the template in courses/test_template reads cleanly', () => {
  const { title, questions, issues } = parseTest(readFileSync(join(ROOT, 'courses/test_template/test.md'), 'utf8'));
  assert.deepEqual(issues, []);
  assert.ok(title);
  assert.deepEqual(questions.map((question) => question.format), ['single', 'group', 'open']);
});
