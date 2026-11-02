/** Written-answer view: write, reveal the model answer, then self-grade. */

import { el } from '../../core/dom.js';
import { richNode } from '../../content/richtext.js';
import { renderMath } from '../../content/math.js';
import { gradeOpen } from '../session.js';
import { cardFooter, nextLabel, questionBody, questionHead } from './parts.js';

export function renderOpen({ question, index, total, isLast, resolve, onAnswer, onNext }) {
  const card = el('article', { class: 'card qcard' });
  card.append(questionHead(question, index, total));
  questionBody(card, question, resolve);

  const textarea = el('textarea', {
    class: 'open-answer',
    placeholder: 'Work through your answer here…',
    spellcheck: false,
  });
  card.append(textarea);

  let revealed = false;
  let graded = false;

  const footer = cardFooter({
    hint: 'Graded by you against the model answer.',
    label: 'Reveal answer',
    onClick: reveal,
  });
  card.append(footer.node);

  const nextButton = el('button', {
    class: 'btn hidden',
    type: 'button',
    text: nextLabel(isLast),
    on: { click: onNext },
  });
  footer.node.append(nextButton);

  function reveal() {
    if (revealed) return;
    revealed = true;
    textarea.disabled = true;
    footer.button.classList.add('hidden');

    const answer = el('div', { class: 'model-answer' }, [
      el('div', { class: 'eyebrow', text: 'Model answer' }),
    ]);

    if (question.hasAnswer) {
      answer.append(richNode('div', '', question.answer, resolve));
    } else {
      answer.append(
        el('p', {
          class: 'muted',
          text: 'No model answer has been written up for this question yet.',
        })
      );
    }

    card.insertBefore(answer, footer.node);
    card.insertBefore(selfGrade(), footer.node);
    renderMath(card);
  }

  function selfGrade() {
    const row = el('div', { class: 'selfgrade' }, [el('span', { text: 'How did you do?' })]);

    const mark = (selfRated) => {
      if (graded) return;
      graded = true;
      row.replaceChildren(
        el('span', {
          class: 'pill ' + (selfRated ? 'pill-good' : 'pill-bad'),
          text: selfRated ? 'Counted as correct' : 'Counted as missed',
        })
      );
      nextButton.classList.remove('hidden');
      nextButton.focus({ preventScroll: true });
      onAnswer(gradeOpen(question, { text: textarea.value, selfRated }));
    };

    row.append(
      el('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: 'I got it',
        on: { click: () => mark(true) },
      }),
      el('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: 'I missed it',
        on: { click: () => mark(false) },
      })
    );
    return row;
  }

  function onKey(event) {
    const typing = document.activeElement === textarea;
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey || !typing)) {
      event.preventDefault();
      if (!revealed) reveal();
      else if (graded) onNext();
    }
  }

  renderMath(card);
  return { node: card, onKey, focus: () => textarea.focus({ preventScroll: true }) };
}
