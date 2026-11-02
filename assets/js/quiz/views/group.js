/** True/false view: one shared setup, several binary statements, graded together. */

import { el } from '../../core/dom.js';
import { renderRich } from '../../content/richtext.js';
import { renderMath } from '../../content/math.js';
import { plural } from '../../core/format.js';
import { gradeGroup } from '../session.js';
import { cardFooter, nextLabel, noteNode, questionBody, questionHead } from './parts.js';

export function renderGroup({ question, index, total, isLast, resolve, onAnswer, onNext }) {
  const card = el('article', { class: 'card qcard' });
  card.append(questionHead(question, index, total));
  questionBody(card, question, resolve);

  const count = question.statements.length;
  let answers = question.statements.map(() => null);
  let answered = false;

  const progress = el('span', {});
  card.append(
    el('div', { class: 'group-hint' }, [
      el('span', {
        text: `Decide ${question.positiveLabel.toLowerCase()} or ${question.negativeLabel.toLowerCase()} for each statement.`,
      }),
      progress,
    ])
  );

  const rows = [];
  const list = el('ul', { class: 'statement-list' });

  question.statements.forEach((statement, i) => {
    const body = el('span', { class: 'body' });
    renderRich(body, statement.text, resolve);

    const positive = el('button', {
      type: 'button',
      text: question.positiveLabel,
      'aria-pressed': 'false',
      on: { click: () => set(i, true) },
    });
    const negative = el('button', {
      type: 'button',
      text: question.negativeLabel,
      'aria-pressed': 'false',
      on: { click: () => set(i, false) },
    });

    const row = el('li', { class: 'statement' }, [
      body,
      el('div', { class: 'segmented' }, [positive, negative]),
    ]);

    rows.push({ row, body, positive, negative });
    list.append(row);
  });

  card.append(list);

  const footer = cardFooter({ label: 'Submit answers', onClick: submit });
  card.append(footer.node);

  const nextButton = el('button', {
    class: 'btn hidden',
    type: 'button',
    text: nextLabel(isLast),
    on: { click: onNext },
  });
  footer.node.append(nextButton);

  function paintProgress() {
    const done = answers.filter((answer) => answer !== null).length;
    progress.replaceChildren(
      el('span', {
        class: done === count ? 'pill pill-accent' : 'pill',
        text: `${done} / ${count} answered`,
      })
    );
  }

  function set(i, value) {
    if (answered) return;
    answers = answers.map((existing, j) => (j === i ? value : existing));
    rows[i].positive.setAttribute('aria-pressed', String(value === true));
    rows[i].negative.setAttribute('aria-pressed', String(value === false));
    paintProgress();
  }

  function submit() {
    if (answered) return;
    answered = true;

    const grade = gradeGroup(question, answers);

    grade.statements.forEach((result, i) => {
      const { row, body, positive, negative } = rows[i];
      const statement = question.statements[i];

      positive.disabled = true;
      negative.disabled = true;

      if (result.given === null) row.classList.add('is-unanswered');
      row.classList.add(result.correct ? 'is-correct' : 'is-wrong');

      const note = noteNode(
        result.expected ? statement.positiveNote : statement.negativeNote,
        resolve
      );

      body.append(
        el('div', { class: 'answer-line' }, [
          el('span', {
            class: 'pill ' + (result.correct ? 'pill-good' : 'pill-bad'),
            text: result.expected ? question.positiveLabel : question.negativeLabel,
          }),
          note,
        ])
      );
    });

    footer.button.classList.add('hidden');
    footer.setHint(
      el('span', {
        class: 'pill ' + (grade.earned === grade.possible ? 'pill-good' : 'pill-bad'),
        text: `${grade.earned} / ${grade.possible} correct`,
      })
    );
    nextButton.classList.remove('hidden');
    nextButton.focus({ preventScroll: true });

    renderMath(card);
    onAnswer(grade);
  }

  function onKey(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (answered) onNext();
    else submit();
  }

  footer.setHint(plural(count, 'statement'));
  paintProgress();
  renderMath(card);
  return { node: card, onKey };
}
