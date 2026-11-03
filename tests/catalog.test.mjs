import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  courseHref,
  courseProgress,
  courseStats,
  groupBySubject,
  openableFirst,
  subjectsOf,
  testHref,
} from '../assets/js/core/catalog.js';

const course = (id, title, tests = [], archive = []) => ({ id, title, tests, archive });

const AI501 = course('AI501_DS843', 'AI501, DS843 - Introduction to Artificial Intelligence', [
  { title: 'Exam June 2025', file: 'a.json', questions: 30 },
]);
const DM507 = course('DM507', 'DM507, DM578, DS814 - Algorithms and Data Structures', [
  { title: 'Exam 2025', file: 'b.json', questions: 32 },
  { title: 'Exam 2024', file: 'c.json', questions: 10 },
]);
const DM573 = course('DM573', 'DM573 - Introduction to Computer Science');
const AI503 = course('AI503', 'AI503 - Calculus', [{ title: 'Exam', file: 'd.json', questions: 10 }]);

test('subjects come from the course codes, cross-listings included', () => {
  assert.deepEqual(subjectsOf(AI501), ['AI', 'DS']);
  assert.deepEqual(subjectsOf(DM507), ['DM', 'DS']);
  assert.deepEqual(subjectsOf(course('misc', 'Untitled')), []);
  assert.deepEqual(subjectsOf(course('AI512', 'Untitled')), ['AI']);
});

test('without a filter courses are grouped by their first code, AI before DM', () => {
  const groups = groupBySubject([DM573, AI501, DM507, AI503]);
  assert.deepEqual(groups.map((g) => g.subject), ['AI', 'DM']);
  assert.deepEqual(groups[0].courses.map((c) => c.id), ['AI501_DS843', 'AI503']);
  // courses with something to open come before empty ones
  assert.deepEqual(groups[1].courses.map((c) => c.id), ['DM507', 'DM573']);
});

test('the unfiltered list keeps manifest order, with empty courses last', () => {
  assert.deepEqual(
    openableFirst([DM573, AI501, DM507, AI503]).map((c) => c.id),
    ['AI501_DS843', 'DM507', 'AI503', 'DM573']
  );
});

test('a subject filter collects every course carrying that code', () => {
  const groups = groupBySubject([AI501, DM507, AI503, DM573], 'DS');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].subject, 'DS');
  assert.deepEqual(groups[0].courses.map((c) => c.id), ['AI501_DS843', 'DM507']);
});

test('course stats add up tests, questions and archive files', () => {
  assert.deepEqual(courseStats(DM507), { tests: 2, questions: 42, archived: 0 });
  assert.deepEqual(courseStats(DM573), { tests: 0, questions: 0, archived: 0 });
});

test('progress averages the best scores of the tests tried', () => {
  assert.equal(courseProgress(DM507, {}), null);
  assert.deepEqual(courseProgress(DM507, { 'b.json': { best: 80, attempts: 2 } }), {
    attempted: 1,
    total: 2,
    average: 80,
  });
  assert.deepEqual(
    courseProgress(DM507, { 'b.json': { best: 80 }, 'c.json': { best: 55 } }),
    { attempted: 2, total: 2, average: 68 }
  );
});

test('links carry the course id so the quiz can lead back to the course', () => {
  assert.equal(courseHref(AI501), 'course.html?id=AI501_DS843');
  const href = new URLSearchParams(testHref(AI501, AI501.tests[0]).split('?')[1]);
  assert.equal(href.get('file'), 'a.json');
  assert.equal(href.get('courseId'), 'AI501_DS843');
});
