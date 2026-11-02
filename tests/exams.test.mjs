/** Guards the real question files: every paper in the manifest must load. */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeExam, summarize } from '../assets/js/quiz/model.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifest = JSON.parse(readFileSync(join(ROOT, 'courses/manifest.json'), 'utf8'));
const papers = manifest.flatMap((course) =>
  (course.tests ?? []).map((exam) => ({ course: course.id, ...exam }))
);

test('the manifest lists at least one paper', () => {
  assert.ok(papers.length > 0);
});

for (const paper of papers) {
  test(`${paper.course} · ${paper.title} loads and matches its cached counts`, () => {
    const raw = JSON.parse(readFileSync(join(ROOT, paper.file), 'utf8'));
    const { questions } = normalizeExam(raw);
    const summary = summarize(questions);

    assert.equal(summary.count, paper.questions, 'question count is out of date');
    assert.equal(summary.points, paper.points, 'point total is out of date');
    assert.deepEqual(summary.formats, paper.formats, 'formats are out of date');
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
