#!/usr/bin/env node
/**
 * Refreshes courses/manifest.json from what is actually on disk.
 *
 *   node tools/sync-manifest.mjs          # update counts, warn about new files
 *   node tools/sync-manifest.mjs --add    # also add newly found tests and archive files
 *
 * Titles, ids, descriptions and ordering written by hand are preserved; the
 * script only maintains the derived fields (questions, points, formats), the
 * links to the original PDFs sitting next to each test file, and the list of
 * files in each course's archive/ folder (older exams, project descriptions
 * and other material that is linked rather than drilled). A new test takes
 * its title from the `# Title` line of its Markdown file.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTest } from '../assets/js/quiz/markdown.js';
import { summarize } from '../assets/js/quiz/model.js';
import { describeArchiveFile } from './archive-names.mjs';
import { stampPages } from './stamp-assets.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const COURSES = join(ROOT, 'courses');
const MANIFEST = join(COURSES, 'manifest.json');
const ARCHIVE_DIR = 'archive';
const SKIP_DIRS = new Set(['assets', 'test_template', ARCHIVE_DIR]);

const dirsIn = (path) =>
  readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
    .map((entry) => entry.name)
    .sort();

const filesIn = (path, extension) =>
  readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension))
    .map((entry) => entry.name)
    .sort();

/** Reads one test folder into the fields the manifest caches. */
function describeExam(examDir) {
  const testFiles = filesIn(examDir, '.md');
  if (!testFiles.length) return null;

  const examFile = join(examDir, testFiles[0]);
  const { title, questions, issues } = parseTest(readFileSync(examFile, 'utf8'));
  for (const issue of issues) console.warn(`!  ${relative(ROOT, examFile)}:${issue.line} ${issue.message}`);
  if (!questions.length) throw new Error('no usable questions');
  const summary = summarize(questions);

  return {
    title,
    file: relative(ROOT, examFile),
    questions: summary.count,
    points: summary.points,
    formats: summary.formats,
    sources: filesIn(examDir, '.pdf').map((name) => ({
      name: name.replace(/\.pdf$/i, ''),
      file: relative(ROOT, join(examDir, name)),
    })),
  };
}

/** Every exam folder on disk, keyed by its exam JSON path. */
function scan() {
  const found = new Map();

  for (const courseDir of dirsIn(COURSES)) {
    const coursePath = join(COURSES, courseDir);
    for (const examDir of dirsIn(coursePath)) {
      const path = join(coursePath, examDir);
      if (!statSync(path).isDirectory()) continue;

      try {
        const described = describeExam(path);
        if (described) found.set(described.file, { ...described, courseDir, examDir });
      } catch (error) {
        console.warn(`!  ${relative(ROOT, path)}: ${error.message}`);
      }
    }
  }

  return found;
}

/** Every file in a courses/<course>/archive/ folder. */
function scanArchives() {
  const found = [];

  for (const courseDir of dirsIn(COURSES)) {
    const dir = join(COURSES, courseDir, ARCHIVE_DIR);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;
      found.push({ courseDir, name: entry.name, file: relative(ROOT, join(dir, entry.name)) });
    }
  }

  return found.sort((a, b) => a.file.localeCompare(b.file));
}

/** Keeps hand-written archive entries, adds newly found files when asked to. */
function syncArchives(courses, addNew) {
  const listed = new Set();

  for (const course of courses) {
    for (const item of course.archive ?? []) {
      listed.add(item.file);
      if (!existsSync(join(ROOT, item.file))) {
        console.warn(`!  ${course.id}: archive entry "${item.title}" points at a missing file (${item.file})`);
      }
    }
  }

  for (const item of scanArchives()) {
    if (listed.has(item.file)) continue;

    const course = courses.find((entry) => item.courseDir.startsWith(entry.id));
    if (!course) {
      console.warn(`!  no course in the manifest matches ${item.courseDir}/${ARCHIVE_DIR}`);
      continue;
    }
    if (!addNew) {
      console.warn(`+  ${item.file} is not listed yet (run with --add)`);
      continue;
    }

    course.archive = [...(course.archive ?? []), { ...describeArchiveFile(item.name), file: item.file }];
    console.log(`+  added ${item.file} to the ${course.id} archive`);
  }
}

const titleCase = (slug) =>
  slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase())
    .trim();

function main() {
  const addNew = process.argv.includes('--add');
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const found = scan();
  const linked = new Set();

  const updated = manifest.map((course) => ({
    ...course,
    tests: (course.tests ?? []).map((test) => {
      const match = found.get(test.file);
      if (!match) {
        console.warn(`!  ${course.id}: "${test.title}" points at a missing file (${test.file})`);
        return test;
      }
      linked.add(test.file);
      // Hand-written titles stay; the file's own # title only names new tests.
      const { courseDir, examDir, title, ...fields } = match;
      return { ...test, ...fields };
    }),
  }));

  const orphans = [...found.values()].filter((exam) => !linked.has(exam.file));

  for (const orphan of orphans) {
    const course = updated.find((entry) => orphan.courseDir.startsWith(entry.id));
    const label = `${orphan.courseDir}/${orphan.examDir}`;

    if (!course) {
      console.warn(`!  no course in the manifest matches ${label}`);
      continue;
    }
    if (!addNew) {
      console.warn(`+  ${label} is not listed yet (run with --add)`);
      continue;
    }

    const { courseDir, examDir, title, ...fields } = orphan;
    course.tests.push({ id: examDir, title: title || titleCase(examDir), ...fields });
    console.log(`+  added ${label} to ${course.id}`);
  }

  syncArchives(updated, addNew);

  writeFileSync(MANIFEST, `${JSON.stringify(updated, null, 2)}\n`);

  const tests = updated.reduce((sum, course) => sum + course.tests.length, 0);
  const questions = updated.reduce(
    (sum, course) => sum + course.tests.reduce((n, test) => n + (test.questions ?? 0), 0),
    0
  );
  const archived = updated.reduce((sum, course) => sum + (course.archive ?? []).length, 0);
  console.log(
    `✓  ${updated.length} courses · ${tests} tests · ${questions} questions` +
      (archived ? ` · ${archived} archived files` : '')
  );

  const stamped = stampPages();
  if (stamped.length) console.log(`✓  stamped asset versions in ${stamped.join(', ')}`);
}

main();
