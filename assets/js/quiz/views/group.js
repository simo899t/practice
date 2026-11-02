/** True/false view: one shared setup, several binary statements, graded together. */

import { el, icon, ICONS } from '../../core/dom.js';
import { renderRich } from '../../content/richtext.js';
import { renderMath } from '../../content/math.js';
import { gradeGroup } from '../session.js';
import { cardFooter, keyHint, nextLabel, noteNode, questionBody, questionHead, statusIcon } from './parts.js';

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

    // A statement with its own displayed maths or several lines (a proof, say)
    // needs the full width; its buttons move underneath it.
    const wide = statement.text.includes('$$') || statement.text.includes('\n');
    const row = el('li', { class: 'statement' + (wide ? ' is-wide' : '') }, [
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
    on: { click: onNext },
  }, [nextLabel(isLast), icon(ICONS.arrowRight, { size: 15 })]);
  footer.node.append(nextButton);

  function paintProgress() {
    const done = answers.filter((answer) => answer !== null).length;
    progress.replaceChildren(
      el('span', {
        class: done === count ? 'pill pill-good' : 'pill',
        text: `${done} of ${count} answered`,
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
      const expected = result.expected ? question.positiveLabel : question.negativeLabel;

      let verdict;
      if (result.correct) {
        verdict = el('span', { class: 'verdict is-good' }, [statusIcon('good'), 'Correct']);
      } else if (result.given === null) {
        verdict = el('span', { class: 'verdict is-warn' }, [
          statusIcon('none'),
          `Not answered — the answer is ${expected}`,
        ]);
      } else {
        verdict = el('span', { class: 'verdict is-bad' }, [
          statusIcon('bad'),
          `Incorrect — the answer is ${expected}`,
        ]);
      }

      body.append(el('div', { class: 'answer-line' }, [verdict, note]));
    });

    footer.button.classList.add('hidden');
    footer.setHint(
      el('span', {
        class: 'verdict ' + (grade.earned === grade.possible ? 'is-good' : 'is-bad'),
        text: `${grade.earned} of ${grade.possible} correct`,
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

  footer.setHint(keyHint(['Enter'], 'to check your answers'));
  paintProgress();
  renderMath(card);
  return { node: card, onKey };
}
