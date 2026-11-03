/** Guards the real test files: every test in the manifest must read cleanly. */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTest } from '../assets/js/quiz/markdown.js';
import { summarize } from '../assets/js/quiz/model.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifest = JSON.parse(readFileSync(join(ROOT, 'courses/manifest.json'), 'utf8'));

// Figures that were never added to the repo; the site shows "Figure unavailable".
// The AI503 sample exam asks about a confusion matrix whose image is missing.
const KNOWN_MISSING = new Set(['courses/AI503_CALC/sample_exam1/assets/CM.png']);
const papers = manifest.flatMap((course) =>
  (course.tests ?? []).map((exam) => ({ course: course.id, ...exam }))
);

test('the manifest lists at least one paper', () => {
  assert.ok(papers.length > 0);
});

for (const paper of papers) {
  test(`${paper.course} · ${paper.title} reads cleanly and matches its cached counts`, () => {
    const { questions, issues, images } = parseTest(readFileSync(join(ROOT, paper.file), 'utf8'));
    assert.deepEqual(issues, [], 'the file has problems to fix');

    const summary = summarize(questions);
    assert.equal(summary.count, paper.questions, 'question count is out of date');
    assert.equal(summary.points, paper.points, 'point total is out of date');
    assert.deepEqual(summary.formats, paper.formats, 'formats are out of date');

    for (const { line, path } of images) {
      const file = join(dirname(paper.file), path);
      if (KNOWN_MISSING.has(file)) continue;
      assert.ok(existsSync(join(ROOT, file)), `line ${line}: missing figure ${path}`);
    }
  });
}

const archived = manifest.flatMap((course) =>
  (course.archive ?? []).map((item) => ({ course: course.id, ...item }))
);

for (const item of archived) {
  test(`${item.course} archive · ${item.title} points at a real file`, () => {
    assert.ok(String(item.title ?? '').trim(), 'archive entries need a title');
    assert.ok(existsSync(join(ROOT, item.file)), `missing file: ${item.file}`);
  });
}
