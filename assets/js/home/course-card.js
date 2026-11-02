/** One course in the index: code and name on the left, its papers on the right. */

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
      'aria-label': `Open the original paper: ${source.name}`,
    }, [icon(ICONS.file, { size: 15 }), el('span', { text: sourceLabel(source, sources.length) })])
  );
}

export function courseCard(course) {
  const exams = course.tests ?? [];
  const { codes, name } = courseParts(course.title);

  const info = el('div', { class: 'course-info' }, [
    el('p', { class: 'course-code', text: codes || course.id || '' }),
    el('h2', { class: 'course-name', text: name }),
  ]);

  const card = el('article', { class: 'course' + (exams.length ? '' : ' is-empty') }, [info]);

  if (!exams.length) {
    card.append(el('p', { class: 'course-empty', text: 'No papers transcribed yet.' }));
    return card;
  }

  const questions = exams.reduce((sum, exam) => sum + (exam.questions ?? 0), 0);
  info.append(
    el('p', {
      class: 'course-meta',
      text: questions
        ? `${plural(exams.length, 'paper')} · ${plural(questions, 'question')}`
        : plural(exams.length, 'paper'),
    })
  );

  card.append(el('ul', { class: 'exams' }, exams.map((exam) => examRow(course, exam))));
  return card;
}
