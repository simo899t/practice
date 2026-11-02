/** One course card: code, tags, and the list of papers inside it. */

import { el, icon, ICONS } from '../core/dom.js';
import { parseTags, plural, splitTitle } from '../core/format.js';
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
    const label = FORMATS[format]?.short;
    if (!label) return;
    bits.push(el('span', { class: 'dot' }), el('span', { text: label }));
  });

  return bits;
}

function examRow(course, exam) {
  const best = scoreFor(exam.file);
  const meta = examMeta(exam);

  return el('li', { class: 'exam-row' }, [
    el('a', { class: 'exam', href: examHref(course, exam) }, [
      el('span', { class: 'exam-main' }, [
        el('span', { class: 'exam-name', text: exam.title }),
        meta.length ? el('span', { class: 'exam-sub' }, meta) : null,
      ]),
      el('span', { class: 'exam-side' }, [
        best
          ? el('span', {
              class: best.best >= 70 ? 'pill pill-good' : 'pill',
              text: `${best.best}%`,
              title: `Best of ${plural(best.attempts, 'attempt')}`,
            })
          : null,
        icon(ICONS.arrowRight, { size: 14 }),
      ]),
    ]),
    // Sibling links, not nested ones: the original PDFs sit beside the row.
    ...sourceLinks(exam),
  ]);
}

function sourceLinks(exam) {
  return (exam.sources ?? []).map((source) =>
    el('a', {
      class: 'exam-pdf',
      href: source.file,
      target: '_blank',
      rel: 'noopener',
      title: `${source.name} (PDF)`,
      'aria-label': `Open the original paper: ${source.name}`,
    }, [icon(ICONS.file, { size: 14 })])
  );
}

export function courseCard(course) {
  const exams = course.tests ?? [];
  const { code, name } = splitTitle(course.title);
  const tags = parseTags(course.description);

  const card = el('article', {
    class: 'course' + (exams.length ? '' : ' is-empty'),
  }, [
    el('div', { class: 'course-top' }, [
      el('span', { class: 'course-code', text: code || course.id || '' }),
      tags.length
        ? el('div', { class: 'tags' }, tags.map((tag) => el('span', { class: 'pill', text: tag })))
        : null,
    ]),
    el('h2', { class: 'course-name', text: name }),
  ]);

  if (!exams.length) {
    card.append(el('p', { class: 'course-empty', text: 'No papers transcribed yet' }));
    return card;
  }

  const questions = exams.reduce((sum, exam) => sum + (exam.questions ?? 0), 0);
  card.append(
    el('p', {
      class: 'course-meta',
      text: questions
        ? `${plural(exams.length, 'paper')} · ${questions} questions`
        : plural(exams.length, 'paper'),
    })
  );

  card.append(el('ul', { class: 'exams' }, exams.map((exam) => examRow(course, exam))));
  return card;
}
