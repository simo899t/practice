#!/usr/bin/env node
/**
 * Refreshes courses/manifest.json from what is actually on disk.
 *
 *   node tools/sync-manifest.mjs          # update counts, warn about new papers
 *   node tools/sync-manifest.mjs --add    # also add newly found papers
 *
 * Titles, ids, descriptions and ordering written by hand are preserved; the
 * script only maintains the derived fields (questions, points, formats) and the
 * links to the original PDFs sitting next to each exam file.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeExam, summarize } from '../assets/js/quiz/model.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const COURSES = join(ROOT, 'courses');
const MANIFEST = join(COURSES, 'manifest.json');
const SKIP_DIRS = new Set(['assets', 'test_template']);

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

/** Reads one exam folder into the fields the manifest caches. */
function describeExam(examDir) {
  const jsonFiles = filesIn(examDir, '.json');
  if (!jsonFiles.length) return null;

  const examFile = join(examDir, jsonFiles[0]);
  const { questions } = normalizeExam(JSON.parse(readFileSync(examFile, 'utf8')));
  const summary = summarize(questions);

  return {
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
      const { courseDir, examDir, ...fields } = match;
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

    const { courseDir, examDir, ...fields } = orphan;
    course.tests.push({ id: examDir, title: titleCase(examDir), ...fields });
    console.log(`+  added ${label} to ${course.id}`);
  }

  writeFileSync(MANIFEST, `${JSON.stringify(updated, null, 2)}\n`);

  const papers = updated.reduce((sum, course) => sum + course.tests.length, 0);
  const questions = updated.reduce(
    (sum, course) => sum + course.tests.reduce((n, test) => n + (test.questions ?? 0), 0),
    0
  );
  console.log(`✓  ${updated.length} courses · ${papers} papers · ${questions} questions`);
}

main();
