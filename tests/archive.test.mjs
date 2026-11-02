import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  archiveKind,
  archiveTitle,
  archiveYear,
  describeArchiveFile,
} from '../tools/archive-names.mjs';

test('archive titles read like titles and keep course codes upper-case', () => {
  assert.equal(archiveTitle('ai512-project-description-2023.pdf'), 'AI512 Project Description 2023');
  assert.equal(archiveTitle('Exam_June_2019.pdf'), 'Exam June 2019');
  assert.equal(archiveTitle('dm507 reexam.pdf'), 'DM507 Reexam');
});

test('archive kinds are guessed from the name, solutions before exams', () => {
  assert.equal(archiveKind('jan-2025-exam-answers.pdf'), 'Solutions');
  assert.equal(archiveKind('project-description.pdf'), 'Project');
  assert.equal(archiveKind('reexam-2019.pdf'), 'Exam');
  assert.equal(archiveKind('weekly_exercises_3.pdf'), 'Assignment');
  assert.equal(archiveKind('lecture-slides-week-2.pdf'), 'Slides');
  assert.equal(archiveKind('random-scan.pdf'), 'Document');
});

test('archive years come from the name when there is one', () => {
  assert.equal(archiveYear('exam2019.pdf'), 2019);
  assert.equal(archiveYear('ai512-exam.pdf'), null);
  assert.equal(archiveYear('DM507-2015-v2.pdf'), 2015);
});

test('describeArchiveFile leaves out a year it cannot find', () => {
  assert.deepEqual(describeArchiveFile('project.pdf'), { title: 'Project', kind: 'Project' });
  assert.deepEqual(describeArchiveFile('exam-2018.pdf'), { title: 'Exam 2018', kind: 'Exam', year: 2018 });
});
