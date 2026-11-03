import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  BRANCH,
  EMAIL,
  REPO,
  courseFolder,
  mailUrl,
  newFileUrl,
  slugify,
  submissionPath,
  uploadUrl,
} from '../assets/js/submit/submission.js';

const AI512 = {
  id: 'AI512',
  title: 'AI512 - Introduction to Machine Learning',
  tests: [{ file: 'courses/AI512_ML/exam-2025-fall/exam-2025-fall.md' }],
};
const DM573 = { id: 'DM573', tests: [] };

test('slugify makes a folder-safe name from a test title', () => {
  assert.equal(slugify('Exam June 2025 (Part I)'), 'exam-june-2025-part-i');
  assert.equal(slugify('  Re-exam: Février 2024! '), 're-exam-fevrier-2024');
  assert.equal(slugify(''), '');
});

test('courseFolder reuses the folder a course already has', () => {
  assert.equal(courseFolder(AI512), 'AI512_ML');
  assert.equal(courseFolder({ id: 'X1', archive: [{ file: 'courses/X1_OLD/archive/a.pdf' }] }), 'X1_OLD');
  assert.equal(courseFolder(DM573), 'DM573');
});

test('submissionPath lands where the manifest sync looks for tests', () => {
  assert.equal(
    submissionPath({ course: AI512, title: 'Exam May 2023' }),
    'courses/AI512_ML/exam-may-2023/exam-may-2023.md'
  );
  assert.equal(submissionPath({ code: 'dm 579', title: 'Exam 2024' }), 'courses/DM579/exam-2024/exam-2024.md');
  assert.equal(submissionPath({}), 'courses/NEW/new-test/new-test.md');
});

test('newFileUrl fills in short files and leaves long ones to the clipboard', () => {
  const short = newFileUrl('courses/A/b/b.md', '## Q\n');
  assert.equal(short.prefilled, true);
  const url = new URL(short.href);
  assert.equal(url.origin + url.pathname, `https://github.com/${REPO}/new/${BRANCH}`);
  assert.equal(url.searchParams.get('filename'), 'courses/A/b/b.md');
  assert.equal(url.searchParams.get('value'), '## Q\n');

  const long = newFileUrl('courses/A/b/b.md', 'x'.repeat(10000));
  assert.equal(long.prefilled, false);
  assert.equal(new URL(long.href).searchParams.has('value'), false);
});

test('uploadUrl opens courses/, where the downloaded course folder is dropped', () => {
  assert.equal(uploadUrl(), `https://github.com/${REPO}/upload/${BRANCH}/courses`);
});

test('mailUrl addresses the maintainer with the details filled in', () => {
  const url = new URL(mailUrl({ course: AI512, title: 'Exam May 2023' }));
  assert.equal(url.protocol + url.pathname, `mailto:${EMAIL}`);
  assert.equal(
    decodeURIComponent(url.search.match(/subject=([^&]*)/)[1]),
    'New test: AI512 - Introduction to Machine Learning: Exam May 2023'
  );
  assert.match(decodeURIComponent(url.search.match(/body=([^&]*)/)[1]), /^Course: AI512 - Introduction to Machine Learning\nTest: Exam May 2023\n/);
  assert.match(mailUrl({}), /subject=New%20test&/);
});
