/**
 * The course catalogue: loading courses/manifest.json and the small pure
 * helpers both the home page and the course pages build on.
 */

import { codePrefixes, courseParts } from './format.js';

export const MANIFEST_URL = 'courses/manifest.json';

/** Subject prefixes of IMADA course codes, in the order the home page shows them. */
export const SUBJECTS = {
  AI: 'Artificial Intelligence',
  DM: 'Computer Science',
  DS: 'Data Science',
};

/** Always revalidates, so a new deploy is never hidden behind a cached copy. */
export async function loadCatalog() {
  const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('manifest.json must be a JSON array.');
  return data;
}

/** "AI501, DS843 - …" -> ["AI", "DS"]; falls back to the manifest id. */
export function subjectsOf(course) {
  const fromTitle = codePrefixes(course.title);
  if (fromTitle.length) return fromTitle;
  return codePrefixes(`${course.id ?? ''} - `);
}

export function subjectName(subject) {
  return SUBJECTS[subject] ?? subject;
}

/** Known subjects first, in SUBJECTS order; anything else alphabetically after. */
function subjectRank(subject) {
  const order = Object.keys(SUBJECTS);
  const at = order.indexOf(subject);
  return at === -1 ? order.length : at;
}

const hasContent = (course) => (course.tests ?? []).length + (course.archive ?? []).length > 0;

/** Courses with something to open come first; manifest order is kept otherwise. */
export function openableFirst(courses) {
  return [...courses].sort((a, b) => Number(hasContent(b)) - Number(hasContent(a)));
}

/**
 * Groups courses by subject. With no filter each course sits under its first
 * code's subject; with a filter there is one group holding every course that
 * carries that subject (so DS shows the cross-listed AI and DM courses).
 * @returns {Array<{subject: string, courses: Array}>}
 */
export function groupBySubject(courses, filter = 'all') {
  const groups = new Map();

  for (const course of courses) {
    const subjects = subjectsOf(course);
    const keys = filter === 'all' ? [subjects[0] ?? 'Other'] : subjects.includes(filter) ? [filter] : [];
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(course);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => subjectRank(a) - subjectRank(b) || a.localeCompare(b))
    .map(([subject, list]) => ({ subject, courses: openableFirst(list) }));
}

export function courseStats(course) {
  const tests = course.tests ?? [];
  return {
    tests: tests.length,
    questions: tests.reduce((sum, test) => sum + (test.questions ?? 0), 0),
    archived: (course.archive ?? []).length,
  };
}

/**
 * How far this browser has got with a course, from the stored best scores.
 * @returns {{attempted: number, total: number, average: number} | null}
 */
export function courseProgress(course, scores) {
  const tests = course.tests ?? [];
  const bests = tests.map((test) => scores?.[test.file]?.best).filter((best) => typeof best === 'number');
  if (!bests.length) return null;

  return {
    attempted: bests.length,
    total: tests.length,
    average: Math.round(bests.reduce((sum, best) => sum + best, 0) / bests.length),
  };
}

export function findCourse(courses, id) {
  return courses.find((course) => course.id === id) ?? null;
}

export function courseHref(course) {
  return `course.html?${new URLSearchParams({ id: course.id })}`;
}

export function testHref(course, test) {
  return `quiz.html?${new URLSearchParams({
    file: test.file,
    title: test.title,
    course: course.title,
    courseId: course.id,
  })}`;
}

/** Display name and codes for headings: { codes: "AI501, DS843", name: "…" }. */
export function courseLabel(course) {
  const { codes, name } = courseParts(course.title);
  return { codes: codes || course.id || '', name: name || course.id || '' };
}
