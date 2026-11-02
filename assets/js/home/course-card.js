/**
 * One course in the index: code and name on the left; its tests on the right,
 * with the course archive (older exams, project descriptions…) folded away
 * underneath them.
 */

import { el, icon, ICONS } from '../core/dom.js';
import { courseParts, plural } from '../core/format.js';
import { scoreFor } from '../core/storage.js';
import { FORMATS } from '../quiz/model.js';

function examHref(course, exam) {
  const query = new URLSearchParams({
    file: exam.file,
    title: exam.title,
    course: course.title,
  });
  return `quiz.html?${query}`;
}

function examMeta(exam) {
  const bits = [];
  if (exam.questions) bits.push(el('span', { text: plural(exam.questions, 'question') }));

  (exam.formats ?? []).forEach((format) => {
    const label = FORMATS[format]?.label;
    if (!label) return;
    bits.push(el('span', { class: 'dot', 'aria-hidden': 'true' }), el('span', { text: label }));
  });

  return bits;
}

function bestScore(exam) {
  const best = scoreFor(exam.file);
  if (!best) return null;

  const tone = best.best >= 70 ? ' pill-good' : best.best < 50 ? ' pill-bad' : '';
  return el('span', {
    class: 'pill' + tone,
    text: `Best ${best.best}%`,
    title: `Best of ${plural(best.attempts, 'attempt')}`,
  });
}

/**
 * The title link stretches over the whole card (see .exam-link::after), and
 * the PDF links sit above it — so the card is one big target without nesting
 * links inside links.
 */
function examRow(course, exam) {
  const meta = examMeta(exam);

  return el('li', { class: 'exam' }, [
    el('div', { class: 'exam-main' }, [
      el('a', { class: 'exam-link', href: examHref(course, exam), text: exam.title }),
      meta.length ? el('span', { class: 'exam-sub' }, meta) : null,
    ]),
    el('div', { class: 'exam-side' }, [
      bestScore(exam),
      ...sourceLinks(exam),
      icon(ICONS.arrowRight, { size: 17 }),
    ]),
  ]);
}

/** "final-answers" reads better as "Answers" when a paper ships with its key. */
function sourceLabel(source, count) {
  if (count > 1 && /answer|solution|key/i.test(source.name)) return 'Answers';
  return 'PDF';
}

function sourceLinks(exam) {
  const sources = exam.sources ?? [];
  return sources.map((source) =>
    el('a', {
      class: 'exam-pdf',
      href: source.file,
      target: '_blank',
      rel: 'noopener',
      title: `${source.name} (PDF)`,
      'aria-label': `Open the original PDF: ${source.name}`,
    }, [icon(ICONS.file, { size: 15 }), el('span', { text: sourceLabel(source, sources.length) })])
  );
}

/* ── Archive ───────────────────────────────────────────────────────────── */

const extensionOf = (file) => (String(file).match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toUpperCase();

function archiveItem(item) {
  const meta = [item.kind, item.year, extensionOf(item.file)].filter(Boolean).join(' · ');

  return el('li', {}, [
    el('a', {
      class: 'archive-item',
      href: item.file,
      target: '_blank',
      rel: 'noopener',
    }, [
      icon(ICONS.file, { size: 15 }),
      el('span', { class: 'archive-title', text: item.title }),
      meta ? el('span', { class: 'archive-meta', text: meta }) : null,
    ]),
  ]);
}

/** Matches the home page search, so a hit inside the archive unfolds it. */
export function archiveMatches(item, query) {
  return `${item.title} ${item.kind ?? ''} ${item.year ?? ''}`.toLowerCase().includes(query);
}

function archiveBlock(course, query) {
  const items = course.archive ?? [];
  if (!items.length) return null;

  const details = el('details', { class: 'archive' });
  // Fold it away unless it is all the course has, or the search found something in it.
  details.open = !(course.tests ?? []).length || Boolean(query && items.some((item) => archiveMatches(item, query)));

  details.append(
    el('summary', {}, [
      icon(ICONS.chevron, { size: 15, stroke: 2 }),
      el('span', { class: 'archive-label', text: 'Archive' }),
      el('span', { class: 'archive-count', text: plural(items.length, 'file') }),
    ]),
    el('div', { class: 'archive-body' }, [
      el('p', {
        class: 'archive-note',
        text: 'Older exams, project descriptions and other material. They open as files, not as quizzes.',
      }),
      el('ul', { class: 'archive-list' }, items.map(archiveItem)),
    ])
  );
  return details;
}

/* ── Course ────────────────────────────────────────────────────────────── */

export function courseCard(course, { query = '' } = {}) {
  const exams = course.tests ?? [];
  const archive = archiveBlock(course, query);
  const { codes, name } = courseParts(course.title);

  const info = el('div', { class: 'course-info' }, [
    el('p', { class: 'course-code', text: codes || course.id || '' }),
    el('h2', { class: 'course-name', text: name }),
  ]);

  const body = el('div', { class: 'course-body' });
  const empty = !exams.length && !archive;
  const card = el('article', { class: 'course' + (empty ? ' is-empty' : '') }, [info, body]);

  if (!exams.length) {
    body.append(el('p', { class: 'course-empty', text: 'No tests transcribed yet.' }));
  } else {
    const questions = exams.reduce((sum, exam) => sum + (exam.questions ?? 0), 0);
    info.append(
      el('p', {
        class: 'course-meta',
        text: questions
          ? `${plural(exams.length, 'test')} · ${plural(questions, 'question')}`
          : plural(exams.length, 'test'),
      })
    );
    body.append(el('ul', { class: 'exams' }, exams.map((exam) => examRow(course, exam))));
  }

  if (archive) body.append(archive);
  return card;
}
