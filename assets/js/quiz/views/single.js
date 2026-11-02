/** Multiple-choice view: pick one option, see the answer immediately. */

import { el } from '../../core/dom.js';
import { renderRich } from '../../content/richtext.js';
import { renderMath } from '../../content/math.js';
import { optionKey } from '../../core/format.js';
import { gradeSingle } from '../session.js';
import { cardFooter, keyHint, nextLabel, noteNode, questionBody, questionHead, statusIcon } from './parts.js';

export function renderSingle({ question, index, total, isLast, resolve, onAnswer, onNext }) {
  const card = el('article', { class: 'card qcard' });
  card.append(questionHead(question, index, total));
  questionBody(card, question, resolve);

  const buttons = [];
  let answered = false;

  const list = el('ul', { class: 'options' });

  question.options.forEach((option, i) => {
    const body = el('span', { class: 'body' });
    renderRich(body, option.text, resolve);

    const button = el('button', {
      class: 'option',
      type: 'button',
      on: { click: () => choose(i) },
    }, [el('span', { class: 'key', text: optionKey(i) }), body]);

    buttons.push({ button, body });
    list.append(el('li', {}, [button]));
  });

  card.append(list);

  const footer = cardFooter({
    hint: '',
    label: nextLabel(isLast),
    onClick: onNext,
    hidden: true,
  });
  footer.setHint(keyHint(['A', optionKey(question.options.length - 1)], 'or click to answer', '–'));
  card.append(footer.node);

  function choose(selected) {
    if (answered) return;
    answered = true;

    const grade = gradeSingle(question, selected);

    buttons.forEach(({ button, body }, i) => {
      const option = question.options[i];
      button.disabled = true;

      if (option.correct) {
        button.classList.add('is-correct');
        button.append(el('span', { class: 'status' }, [statusIcon('good')]));
      } else if (i === selected) {
        button.classList.add('is-wrong');
        button.append(el('span', { class: 'status' }, [statusIcon('bad')]));
      } else {
        button.classList.add('is-muted');
      }

      if (option.correct || i === selected) {
        const note = noteNode(option.note, resolve);
        if (note) body.append(note);
      }
    });

    footer.setHint(
      grade.earned
        ? el('span', { class: 'verdict is-good' }, [statusIcon('good'), 'Correct'])
        : el('span', { class: 'verdict is-bad' }, [statusIcon('bad'), 'Not quite'])
    );
    footer.button.classList.remove('hidden');
    footer.button.focus({ preventScroll: true });

    renderMath(card);
    onAnswer(grade);
  }

  function onKey(event) {
    if (answered) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onNext();
      }
      return;
    }

    const digit = Number.parseInt(event.key, 10);
    if (Number.isInteger(digit) && digit >= 1 && digit <= question.options.length) {
      event.preventDefault();
      choose(digit - 1);
      return;
    }

    const letter = event.key.toUpperCase();
    if (/^[A-Z]$/.test(letter)) {
      const i = letter.charCodeAt(0) - 65;
      if (i < question.options.length) {
        event.preventDefault();
        choose(i);
      }
    }
  }

  renderMath(card);
  return { node: card, onKey };
}
